// ---------------------------------------------------------------------------
// npcBehaviour.js — navigation + locomotion for the passengers.
//
//  NavGraph            waypoint graph with directed edges and A*.
//  buildDefaultGraph   a full station graph derived ONLY from layout.js (street → stairs → hall →
//                      gateline → overlook → escalators → box landings → platforms; District stairs; pavements).
//  attachEscalators    discovers every moving ramp registered in the collision world (whatever module built it)
//                      and adds one-way "ride" edges in the direction the steps travel.
//  validateGraph       drops default edges that have no floor beneath them / run through walls, so the
//                      graph adapts to whatever geometry actually exists (single module in the harness, or all).
//  mergeExternal       folds in graphs other modules register as ctx.register('nav:<area>', {nodes, edges}).
//  Agent               one passenger: path following, separation, player repulsion, wall resolve, floor snap,
//                      escalator riding (stand right / walk left), stairs, gait phase, idle fidgets, head look.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { LEVELS, STREET, TICKET_HALL, DISTRICT, JUBILEE, BOX_WALKWAYS } from '../core/layout.js';

// ============================================================================ NavGraph
export class NavGraph {
  constructor() { this.nodes = []; this.adj = []; this.tagIndex = new Map(); }
  add(x, y, z, tags = [], area = '') {
    const id = this.nodes.length; const set = new Set(Array.isArray(tags) ? tags : [tags]);
    this.nodes.push({ id, x, y, z, tags: set, area, alive: true }); this.adj.push([]);
    for (const t of set) { if (!this.tagIndex.has(t)) this.tagIndex.set(t, []); this.tagIndex.get(t).push(id); }
    return id;
  }
  tag(id, t) { this.nodes[id].tags.add(t); if (!this.tagIndex.has(t)) this.tagIndex.set(t, []); this.tagIndex.get(t).push(id); }
  link(a, b, { oneWay = false, cost = null, kind = 'walk', data = null } = {}) {
    if (a == null || b == null || a === b || a < 0 || b < 0) return null;
    const na = this.nodes[a], nb = this.nodes[b]; const d = Math.hypot(na.x - nb.x, na.y - nb.y, na.z - nb.z);
    const e = { from: a, to: b, cost: cost ?? d, len: d, kind, data }; this.adj[a].push(e);
    if (!oneWay) this.adj[b].push({ from: b, to: a, cost: cost ?? d, len: d, kind, data });
    return e;
  }
  unlink(a, b) { this.adj[a] = this.adj[a].filter(e => e.to !== b); this.adj[b] = this.adj[b].filter(e => e.to !== a); }
  edge(a, b) { return this.adj[a].find(e => e.to === b) || null; }
  withTag(t) { return (this.tagIndex.get(t) || []).filter(i => this.nodes[i].alive); }
  /** Nearest alive node to a point (heavily penalising level differences). */
  nearest(x, y, z, { maxDist = 8, yTol = 1.5, filter = null } = {}) {
    let best = -1, bd = maxDist * maxDist;
    for (const n of this.nodes) { if (!n.alive) continue; if (Math.abs(n.y - y) > yTol) continue; if (filter && !filter(n)) continue; const d = (n.x - x) ** 2 + (n.z - z) ** 2 + (n.y - y) ** 2 * 4; if (d < bd) { bd = d; best = n.id; } }
    return best;
  }
  /** A* from node a to node b. costMul(edge) may bias per agent (lane preference). Returns node id list or null. */
  path(a, b, costMul = null) {
    if (a === b) return [a]; if (a < 0 || b < 0) return null;
    const N = this.nodes; const tb = N[b]; const h = i => Math.hypot(N[i].x - tb.x, N[i].y - tb.y, N[i].z - tb.z);
    const g = new Map([[a, 0]]), came = new Map(); const open = [[h(a), a]]; const closed = new Set();
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, cur] = open.splice(bi, 1)[0]; if (cur === b) { const out = [b]; let c = b; while (came.has(c)) { c = came.get(c); out.push(c); } return out.reverse(); }
      if (closed.has(cur)) continue; closed.add(cur);
      for (const e of this.adj[cur]) {
        if (!N[e.to].alive) continue; const ng = g.get(cur) + e.cost * (costMul ? costMul(e) : 1);
        if (ng < (g.get(e.to) ?? Infinity)) { g.set(e.to, ng); came.set(e.to, cur); open.push([ng + h(e.to), e.to]); }
      }
      if (closed.size > 4000) break;
    }
    return null;
  }
}

// ============================================================================ default graph from layout
const GATE = TICKET_HALL.gateline;
export const GATE_PITCH = (GATE.xMax - GATE.xMin) / GATE.gates;
export const gateX = i => GATE.xMin + (i + 0.5) * GATE_PITCH;
export const BIG_BEN = new THREE.Vector3(STREET.elizabethTower.x, STREET.elizabethTower.clockHeight, STREET.elizabethTower.z);

export function buildDefaultGraph() {
  const G = new NavGraph(); const H = LEVELS.ticketHall, S = LEVELS.street;
  const N = (x, y, z, tags, area) => G.add(x, y, z, tags, area);
  const chain = (ids, opts) => { for (let i = 1; i < ids.length; i++) G.link(ids[i - 1], ids[i], opts); };

  // ---------------- street: north pavement (Portcullis House side), south pavement (Palace side), crossings
  const zN = (STREET.pavementNorth.zMin + STREET.pavementNorth.zMax) / 2 + 0.5;      // 2.5
  const zS = (STREET.pavementSouth.zMin + STREET.pavementSouth.zMax) / 2 + 0.3;      // 31.8
  const xsN = [-58, -46, -34, -22, -12, -5, 0, 5, 12, 22, 32, 42];
  const north = xsN.map(x => N(x, S, zN, ['street', 'pavementN'], 'street'));
  chain(north); G.tag(north[0], 'streetEndW'); G.tag(north[north.length - 1], 'streetEndE');
  const xsS = [-58, -46, -34, -22, -12, -4, 2, 6, 12, 20, 30, 42];
  const south = xsS.map(x => N(x, S, zS, ['street', 'pavementS'], 'street'));
  chain(south); G.tag(south[0], 'streetEndW'); G.tag(south[south.length - 1], 'streetEndE');
  // photo spots by Exit 1, looking at Big Ben
  const photo = [[-3, 33.4], [1, 33.8], [-8, 33.2], [12, 33.6], [-14, 33.5], [16, 33.2]].map(([x, z]) => N(x, S, z, ['street', 'photo'], 'street'));
  photo.forEach((p, i) => { G.link(p, G.nearest(G.nodes[p].x, S, zS, { filter: n => n.tags.has('pavementS') })); });
  // pedestrian crossings over Bridge Street (west of the entrance towards the Abbey / Parliament Square, and at the bridge end)
  for (const cx of [-12, 42]) {
    const a = north[xsN.indexOf(cx)], b = south[xsS.indexOf(cx)];
    const mids = [10, 17, 24].map(z => N(cx, S, z, ['street', 'crossing'], 'street'));
    chain([a, ...mids, b]);
  }
  // ---------------- Bridge Street entrance + main stairs (descend NORTH from the facade line; keep left going down)
  const ms = TICKET_HALL.mainStairs;
  const ent = N(STREET.entranceMain.x, S, zN - 1.2, ['street', 'entrance'], 'street'); G.link(ent, north[xsN.indexOf(0)]); G.link(ent, north[xsN.indexOf(-5)]); G.link(ent, north[xsN.indexOf(5)]);
  const laneW = (ms.xMin + ms.xMax) / 2 - 2.6, laneE = (ms.xMin + ms.xMax) / 2 + 2.6;
  const topW = N(laneW, S, ms.zTop - 0.2, ['stairTop', 'mainStairs'], 'stairs'), topE = N(laneE, S, ms.zTop - 0.2, ['stairTop', 'mainStairs'], 'stairs');
  const botW = N(laneW, H, ms.zBottom - 1.2, ['stairBottom', 'mainStairs', 'hall'], 'ticketHall'), botE = N(laneE, H, ms.zBottom - 1.2, ['stairBottom', 'mainStairs', 'hall'], 'ticketHall');
  G.link(ent, topW); G.link(ent, topE);
  G.link(topW, botW, { oneWay: true, kind: 'stairs' }); G.link(botE, topE, { oneWay: true, kind: 'stairs' });   // down on the west (left) lane, up on the east lane
  G.link(topW, botW, { oneWay: false, kind: 'stairs', cost: 40 }); G.link(topE, botE, { kind: 'stairs', cost: 40 });   // wrong-lane fallbacks (expensive)
  // ---------------- Exit 1 stairs (rise SOUTH to the Palace-side pavement facing Big Ben)
  const e1 = TICKET_HALL.exit1Stairs; const e1W = (e1.xMin + e1.xMax) / 2 - 1.5, e1E = (e1.xMin + e1.xMax) / 2 + 1.5;
  const e1TopW = N(e1W, S, e1.zTop + 1.4, ['stairTop', 'exit1', 'street'], 'street'), e1TopE = N(e1E, S, e1.zTop + 1.4, ['stairTop', 'exit1', 'street'], 'street');
  const e1BotW = N(e1W, H, e1.zBottom - 1.4, ['stairBottom', 'exit1', 'hall'], 'ticketHall'), e1BotE = N(e1E, H, e1.zBottom - 1.4, ['stairBottom', 'exit1', 'hall'], 'ticketHall');
  G.link(e1BotE, e1TopE, { oneWay: true, kind: 'stairs' }); G.link(e1TopW, e1BotW, { oneWay: true, kind: 'stairs' });   // going up (facing south) keep left = east lane
  G.link(e1BotE, e1TopE, { kind: 'stairs', cost: 40 }); G.link(e1TopW, e1BotW, { kind: 'stairs', cost: 40 });
  for (const t of [e1TopW, e1TopE]) { G.link(t, south[xsS.indexOf(6)]); G.link(t, south[xsS.indexOf(2)]); G.link(t, south[xsS.indexOf(12)]); }
  // ---------------- Embankment stairs (Exit 3/5), east of Portcullis House
  const em = TICKET_HALL.embankmentStairs; const emTop = N(em.xMax + 1.6, S, em.zTop, ['street', 'embankment', 'stairTop'], 'street'); const emBot = N(em.xMin - 1.4, H, em.zBottom, ['hall', 'embankment', 'stairBottom'], 'ticketHall');
  G.link(emTop, emBot, { kind: 'stairs' });
  const emPave = [N(STREET.embankmentRoad.xMin + 2, S, -2, ['street'], 'street'), N(STREET.embankmentRoad.xMin + 2, S, -20, ['street', 'streetEndN'], 'street')];
  G.link(emTop, emPave[0]); chain(emPave); G.link(emPave[0], north[xsN.indexOf(32)]);

  // ---------------- ticket hall: a coarse grid, minus the stair wells, the ticket machines and the box opening
  const xs = [-40, -32, -24, -16, -8, 0, 8, 16, 22], zs = [-46, -38, -30, -24, -16, -8, 0, 8, 16, 24, 30];
  const inRect = (x, z, r) => x > r.xMin - 0.5 && x < r.xMax + 0.5 && z > Math.min(r.zTop, r.zBottom) - 0.5 && z < Math.max(r.zTop, r.zBottom) + 0.5;
  const wells = [ms, e1, ...TICKET_HALL.dcStairs];
  const tm = TICKET_HALL.ticketMachines;
  const grid = new Map();
  for (const x of xs) for (const z of zs) {
    if (wells.some(w => inRect(x, z, w))) continue;
    if (x >= tm.x - 3 && z >= tm.zMin - 2 && z <= tm.zMax + 2) continue;
    const bo = TICKET_HALL.boxOverlook; if (x > bo.xMin - 2 && x < bo.xMax + 2 && z < bo.zMax + 3) continue;
    const tags = ['hall']; if (z < GATE.z) tags.push('paid'); else tags.push('unpaid');
    if (x === 16 && (z === -8 || z === 0)) tags.push('ticketMachine');
    grid.set(x + ',' + z, N(x, H, z, tags, 'ticketHall'));
  }
  const crossesGateline = (x1, z1, x2, z2) => (z1 - GATE.z) * (z2 - GATE.z) < 0;
  for (const x of xs) for (const z of zs) {
    const a = grid.get(x + ',' + z); if (a == null) continue;
    const nx = xs[xs.indexOf(x) + 1], nz = zs[zs.indexOf(z) + 1];
    const tryLink = (x2, z2) => {
      const b = grid.get(x2 + ',' + z2); if (b == null) return;
      if (crossesGateline(x, z, x2, z2)) { if (x !== x2 || x < GATE.xMin - 0.5 || x > GATE.xMax + 0.5) return; G.link(a, b, { kind: 'gate' }); return; }
      G.link(a, b);
    };
    if (nx != null) tryLink(nx, z); if (nz != null) tryLink(x, nz);
    if (nx != null && nz != null) tryLink(nx, nz); if (nx != null && zs.indexOf(z) > 0) tryLink(nx, zs[zs.indexOf(z) - 1]);
  }
  const hallNear = (x, z, maxDist = 12) => G.nearest(x, H, z, { maxDist, filter: n => n.tags.has('hall') && !n.tags.has('stairBottom') });
  for (const b of [botW, botE]) { for (const [x, z] of [[-8, -16], [0, -16], [8, -16], [-8, -8], [8, -8]]) { const n = grid.get(x + ',' + z); if (n != null) G.link(b, n); } }
  for (const b of [e1BotW, e1BotE]) { for (const [x, z] of [[0, 16], [8, 16], [16, 16], [0, 24], [16, 24]]) { const n = grid.get(x + ',' + z); if (n != null) G.link(b, n); } }
  G.link(emBot, grid.get('22,-8') ?? hallNear(22, -8)); G.link(emBot, grid.get('16,-8'));
  // box overlook (balustrade) — a place to linger and look down into the box
  const look = [N(-26, H, -44.5, ['hall', 'paid', 'overlook'], 'ticketHall'), N(-34, H, -44.5, ['hall', 'paid', 'overlook'], 'ticketHall')];
  look.forEach(l => { G.link(l, grid.get('-24,-46') ?? hallNear(-24, -46)); G.link(l, grid.get('-32,-46') ?? hallNear(-32, -46)); G.link(l, grid.get('-40,-46') ?? hallNear(-40, -46)); });
  // top landing area of the Jubilee escalators (bank A) — the escalator entries attach here dynamically
  const escTop = N(-16, H, -47.5, ['hall', 'paid', 'escTopArea'], 'ticketHall'); G.link(escTop, grid.get('-16,-46') ?? hallNear(-16, -46)); G.link(escTop, grid.get('-8,-46') ?? hallNear(-8, -46)); G.link(escTop, grid.get('-24,-46') ?? hallNear(-24, -46));
  // District stairs: from the hall grid down to each platform
  const dcBottoms = {};
  for (const st of TICKET_HALL.dcStairs) {
    const x = (st.xMin + st.xMax) / 2; const dirS = st.zBottom > st.zTop ? 1 : -1;
    const top = N(x, H, st.zTop - dirS * 1.3, ['hall', 'dcStairTop'], 'ticketHall'); const bot = N(x, LEVELS.dcPlatform, st.zBottom + dirS * 0.9, ['platform' + st.platform, 'dcStairBottom'], 'district');
    G.link(top, bot, { kind: 'stairs' });
    const near = [];
    for (const [gx, gz] of [[x - 2, st.zTop - dirS * 8], [x + 2, st.zTop - dirS * 8], [x, st.zTop - dirS * 8]]) { const n = hallNear(gx, gz, 9); if (n != null && !near.includes(n)) near.push(n); }
    near.forEach(n => G.link(top, n));
    (dcBottoms[st.platform] = dcBottoms[st.platform] || []).push(bot);
  }
  // ---------------- District & Circle platforms (y = dcPlatform): a chain along each platform behind the yellow line
  for (const p of Object.values(DISTRICT.platforms)) {
    const edge = p.edgeZ; const inward = p.zMin === edge ? 1 : -1;    // platform 2's edge is its zMin (track to the north of it)
    const zc = edge + inward * 2.6;
    const xsP = [-64, -52, -40, -28, -16, -4, 8, 20, 32, 44, 54];
    const ids = xsP.map(x => N(x, LEVELS.dcPlatform, zc, ['platform' + p.number, 'dcPlatform'], 'district')); chain(ids);
    for (const b of (dcBottoms[p.number] || [])) { const nb = G.nodes[b]; const near = ids.filter(i => Math.abs(G.nodes[i].x - nb.x) < 8); near.forEach(i => G.link(b, i)); }
  }
  // ---------------- Jubilee box: upper level (landing + bridge) and lower landing, platforms 4 (upper) and 3 (lower)
  const up = LEVELS.jubUpper, lo = LEVELS.jubLower; const px = (JUBILEE.platformXMin + JUBILEE.platformXMax) / 2 + 0.3;  // -35.6 (stand a little back from the PEDs)
  const upperLanding = [N(-16, up, -91, ['box', 'upperLanding'], 'box'), N(-24, up, -96, ['box', 'upperLanding'], 'box'), N(-30, up, -90, ['box', 'upperLanding'], 'box'), N(-20, up, -104, ['box', 'upperLanding'], 'box'), N(-30, up, -104, ['box', 'upperLanding'], 'box'), N(-16, up, -84, ['box', 'upperLanding'], 'box'), N(-26, up, -84, ['box', 'upperLanding'], 'box')];
  chain(upperLanding); G.link(upperLanding[0], upperLanding[2]); G.link(upperLanding[1], upperLanding[4]); G.link(upperLanding[0], upperLanding[6]); G.link(upperLanding[5], upperLanding[2]); G.link(upperLanding[1], upperLanding[6]); G.link(upperLanding[3], upperLanding[1]);
  const upperBridge = [N(-16, up, -62, ['box', 'upperBridge'], 'box'), N(-24, up, -62, ['box', 'upperBridge'], 'box'), N(-30, up, -58.5, ['box', 'upperBridge'], 'box'), N(-20, up, -66, ['box', 'upperBridge'], 'box')];
  chain(upperBridge); G.link(upperBridge[0], upperBridge[3]); G.link(upperBridge[1], upperBridge[3]);
  const lowerLanding = [N(-16, lo, -83, ['box', 'lowerLanding'], 'box'), N(-24, lo, -80, ['box', 'lowerLanding'], 'box'), N(-30, lo, -80, ['box', 'lowerLanding'], 'box'), N(-20, lo, -87, ['box', 'lowerLanding'], 'box'), N(-28, lo, -86, ['box', 'lowerLanding'], 'box')];
  chain(lowerLanding); G.link(lowerLanding[0], lowerLanding[3]); G.link(lowerLanding[1], lowerLanding[4]); G.link(lowerLanding[3], lowerLanding[4]); G.link(lowerLanding[2], lowerLanding[4]);
  // platform chains (both levels) with access from the landings / bridge
  const zsJ = [-132, -122, -112, -104, -96, -88, -80, -72, -64, -56, -48, -40, -30, -22];
  const p4 = zsJ.map(z => N(px, up, z, ['platform4', 'jubPlatform'], 'jubilee')); chain(p4);
  const p3 = zsJ.map(z => N(px, lo, z, ['platform3', 'jubPlatform'], 'jubilee')); chain(p3);
  const linkAccess = (ids, from, zRange) => { for (const i of ids) { const z = G.nodes[i].z; if (z >= zRange[0] && z <= zRange[1]) for (const f of from) if (Math.abs(G.nodes[f].z - z) < 12) G.link(i, f); } };
  linkAccess(p4, [upperLanding[2], upperLanding[4], upperLanding[6]], [BOX_WALKWAYS[0].zMin, BOX_WALKWAYS[0].zMax]);
  linkAccess(p4, [upperBridge[2], upperBridge[1]], [BOX_WALKWAYS[1].zMin, BOX_WALKWAYS[1].zMax]);
  linkAccess(p3, [lowerLanding[2], lowerLanding[4], lowerLanding[1]], [BOX_WALKWAYS[2].zMin, BOX_WALKWAYS[2].zMax]);
  return G;
}

// ============================================================================ escalators from the collision world
/**
 * For every moving ramp in `collision` create entry/exit nodes on the landings and a one-way 'esc' edge, then
 * link them into the graph (nodes on the same level within `linkDist`). A costly reverse edge lets exiters
 * walk up a down escalator when no up-lane exists (they hurry; noted as a fallback).
 */
export function attachEscalators(G, collision, { linkDist = 7 } = {}) {
  const out = [];
  for (const f of collision.floors) {
    if (f.kind !== 'ramp' || !f.move) continue;
    const a = new THREE.Vector3(f.ax, f.ya, f.az), b = new THREE.Vector3(f.bx, f.yb, f.bz);
    const along = new THREE.Vector3(f.dx, 0, f.dz);
    const forward = (f.move.x * along.x + f.move.z * along.z) >= 0;     // steps travel a → b ?
    const entry = forward ? a : b, exit = forward ? b : a; const dir = forward ? along : along.clone().negate();
    const ein = entry.clone().addScaledVector(dir, -1.9), eout = exit.clone().addScaledVector(dir, 1.9);
    const nIn = G.add(ein.x, ein.y, ein.z, ['escEntry'], 'escalator'), nOut = G.add(eout.x, eout.y, eout.z, ['escExit'], 'escalator');
    const data = { ramp: f, dir: { x: dir.x, z: dir.z }, right: { x: -dir.z, z: dir.x }, halfWidth: f.halfWidth, entry: ein, exit: eout, name: f.tag || 'esc' };
    G.link(nIn, nOut, { oneWay: true, kind: 'esc', data, cost: ein.distanceTo(eout) * 0.8 });
    G.link(nOut, nIn, { oneWay: true, kind: 'escReverse', data, cost: ein.distanceTo(eout) * 6 });
    for (const [n, p] of [[nIn, ein], [nOut, eout]]) {
      let linked = 0;
      for (const m of G.nodes) { if (!m.alive || m.tags.has('escEntry') || m.tags.has('escExit')) continue; if (Math.abs(m.y - p.y) > 0.8) continue; const d = Math.hypot(m.x - p.x, m.z - p.z); if (d <= linkDist) { G.link(n, m.id); linked++; } }
      if (!linked) { const near = G.nearest(p.x, p.y, p.z, { maxDist: 14, yTol: 0.8, filter: m => !m.tags.has('escEntry') && !m.tags.has('escExit') }); if (near >= 0) G.link(n, near); }
    }
    out.push({ nIn, nOut, data });
  }
  return out;
}

/** Fold external graphs (ctx.register('nav:<area>', {nodes:[{id,x,y,z}], edges:[[a,b] | [a,b,{oneWay,kind}]]})) into G. */
export function mergeExternal(G, ctx) {
  const reg = ctx._registry; if (!reg) return 0; let merged = 0;
  for (const [key, val] of reg) {
    if (!key.startsWith('nav:') || !val || !Array.isArray(val.nodes)) continue; if (val._npcMerged) continue; val._npcMerged = true;
    const area = key.slice(4); const map = new Map();
    for (const n of val.nodes) { if (n == null || typeof n.x !== 'number') continue; const tags = ['ext', area]; if (Array.isArray(n.tags)) tags.push(...n.tags); if (typeof n.tag === 'string') tags.push(n.tag); const id = G.add(n.x, n.y, n.z, tags, area); map.set(n.id ?? map.size, id); }
    for (const e of (val.edges || [])) { if (!Array.isArray(e)) continue; const a = map.get(e[0]), b = map.get(e[1]); if (a == null || b == null) continue; const o = e[2] || {}; G.link(a, b, { oneWay: !!o.oneWay, kind: o.kind || 'walk', cost: o.cost ?? null }); }
    // stitch: each external node to default nodes within 3 m on the same level
    for (const id of map.values()) { const n = G.nodes[id]; for (const m of G.nodes) { if (m.tags.has('ext') || !m.alive) continue; if (Math.abs(m.y - n.y) > 0.8) continue; const d = Math.hypot(m.x - n.x, m.z - n.z); if (d < 3.5) G.link(id, m.id); } }
    merged++;
  }
  return merged;
}

/** Drop edges with no walkable floor under them or which run through blockers; kill nodes with no floor. */
export function validateGraph(G, collision, { keepKinds = ['esc', 'escReverse'] } = {}) {
  const floorOk = (x, z, y) => !!collision.floorAt(x, z, y + 0.9, { stepUp: 0.5, drop: 2.6 });
  const inBlocker = (x, z, y) => { const c = collision._cell(x, z); if (!c) return false; for (const b of c.blockers) if (x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z && y + 1.2 > b.min.y && y + 1.2 < b.max.y && y + 0.6 < b.max.y) return true; return false; };
  let dropped = 0, killed = 0;
  for (const n of G.nodes) { if (!n.alive) continue; if (!floorOk(n.x, n.z, n.y)) { n.alive = false; killed++; } }
  for (let a = 0; a < G.nodes.length; a++) {
    const na = G.nodes[a]; if (!na.alive) { G.adj[a] = []; continue; }
    G.adj[a] = G.adj[a].filter(e => {
      const nb = G.nodes[e.to]; if (!nb.alive) return false; if (keepKinds.includes(e.kind)) return true;
      const steps = Math.max(2, Math.ceil(e.len / 0.7));
      for (let i = 1; i < steps; i++) {
        const t = i / steps; const x = na.x + (nb.x - na.x) * t, z = na.z + (nb.z - na.z) * t, y = na.y + (nb.y - na.y) * t;
        if (!floorOk(x, z, y)) { dropped++; return false; }
        if (e.kind !== 'gate' && inBlocker(x, z, y)) { dropped++; return false; }
      }
      return true;
    });
  }
  // isolated nodes die too
  for (const n of G.nodes) { if (n.alive && G.adj[n.id].length === 0) { const hasIn = G.adj.some(l => l.some(e => e.to === n.id)); if (!hasIn) { n.alive = false; killed++; } } }
  return { dropped, killed };
}

// ============================================================================ Agent
const WALK_MIN = 1.15, WALK_MAX = 1.65;
const RADIUS = 0.30, HEIGHT = 1.72, STEP_UP = 0.45;
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
let AGENT_ID = 1;

export class Agent {
  constructor(pool, app, x, y, z, rng = Math.random) {
    this.id = AGENT_ID++; this.pool = pool; this.app = app; this.rng = rng;
    this.slot = pool.alloc(app);
    this.pos = new THREE.Vector3(x, y, z); this.vel = new THREE.Vector3(); this.heading = rng() * Math.PI * 2; this.headingTarget = this.heading;
    this.speedPref = (WALK_MIN + rng() * (WALK_MAX - WALK_MIN)) * (app.child ? 0.85 : 1) * (app.suitcase ? 0.85 : 1);
    this.speed = this.speedPref;
    this.phase = rng() * Math.PI * 2; this.stride = 0; this.selfSpeed = 0;
    this.path = []; this.pathIdx = 0; this.waypoint = null; this.onEdge = null;
    this.state = 'idle'; this.plan = []; this.stepIdx = 0; this.timer = 0; this.age = 0;
    this.floor = null; this.onEsc = false; this.walksOnEsc = rng() < 0.28 && !app.suitcase && !app.child; this.skipWalls = false; this.frozen = false;
    this.headYaw = 0; this.headPitch = 0; this.headYawT = 0; this.headPitchT = 0; this.lookAt = null; this.nextFidget = 1 + rng() * 4; this.fidget = null; this.phoneUp = 0; this.phoneUpT = 0; this.phoneHigh = 0; this.phoneHighT = 0; this.tap = 0; this.tapT = 0;
    this.idleT = rng() * 10; this.lean = 0; this.lodTick = 0; this.accum = 0; this.dead = false; this.train = null; this.local = null;
    this.lastStepPhase = 0; this.footstepCb = null; this.platform = null; this.waitSpot = null; this.user = {};
    this.costSeed = rng();
  }

  /** Follow a list of THREE.Vector3 (with optional .meta) — replaces the current path. */
  setPath(points) { this.path = points; this.pathIdx = 0; this.state = points.length ? 'walk' : 'idle'; this.waypoint = points[0] || null; this.onEdge = null; }
  get arrived() { return this.state !== 'walk'; }

  /** Move + animate. dt may be a multi-frame accumulation for far agents. */
  update(dt, world) {
    const { collision, player, agentsNear } = world;
    this.age += dt; this.idleT += dt;
    const app = this.app;
    // ---- steering
    let desiredX = 0, desiredZ = 0, wantSpeed = 0;
    if (this.train && this.local) { this._ride(world); return; }
    if (this.state === 'pause') { this.timer -= dt; if (this.timer <= 0) { this.state = 'walk'; this._nextWaypoint(true); } }
    if (this.state === 'walk' && this.waypoint) {
      const wp = this.waypoint; let tx = wp.x, tz = wp.z;
      const meta = wp.meta || null;
      // on an escalator: hold the lane side (stand right / walk left) — target stays the exit, but we bias laterally
      if (this.onEdge && this.onEdge.kind === 'esc') {
        const d = this.onEdge.data; const side = this.walksOnEsc ? -0.22 : 0.25; tx = wp.x + d.right.x * side; tz = wp.z + d.right.z * side;
      }
      let dx = tx - this.pos.x, dz = tz - this.pos.z; const dist = Math.hypot(dx, dz);
      const reach = meta && meta.reach != null ? meta.reach : (this.onEsc ? 0.9 : 0.45);
      if (dist < reach) { this._nextWaypoint(); }
      else {
        dx /= dist; dz /= dist;
        wantSpeed = this.speed;
        if (this.onEsc) wantSpeed = (this.onEdge && this.onEdge.kind === 'escReverse') ? this.speed + 0.9 : (this.walksOnEsc ? 0.75 : 0);   // standers let the steps carry them; wrong-way walkers hurry
        else if (this.floor && this.floor.sound === 'stairs') wantSpeed = this.speed * 0.8;
        else if (this.onEdge && this.onEdge.kind === 'escReverse' && this.floor && this.floor.move) wantSpeed = Math.max(1.5, this.speed + 0.8);
        if (meta && meta.slow) wantSpeed *= meta.slow;
        // slow down when about to reach the last waypoint (arrive gracefully)
        if (this.pathIdx === this.path.length - 1 && dist < 1.0 && !this.onEsc) wantSpeed *= Math.max(0.35, dist);
        desiredX = dx * wantSpeed; desiredZ = dz * wantSpeed;
      }
    }
    // ---- separation from other agents + soft repulsion from the player
    let pushX = 0, pushZ = 0;
    if (agentsNear) {
      for (const o of agentsNear) {
        if (o === this || o.dead || o.train) continue; const ox = this.pos.x - o.pos.x, oz = this.pos.z - o.pos.z; const d2 = ox * ox + oz * oz; if (d2 > 1.0 || d2 < 1e-6) continue; if (Math.abs(o.pos.y - this.pos.y) > 1.2) continue;
        const d = Math.sqrt(d2); const k = (1 - d) * (this.state === 'walk' ? 1.6 : 0.6) / d; pushX += ox * k; pushZ += oz * k;
        // the one behind slows down instead of pushing through (queueing)
        if (this.state === 'walk' && o.state !== 'walk' && d < 0.7 && (ox * desiredX + oz * desiredZ) < 0) { desiredX *= 0.35; desiredZ *= 0.35; }
      }
    }
    if (player) {
      const ox = this.pos.x - player.x, oz = this.pos.z - player.z; const d2 = ox * ox + oz * oz;
      if (d2 < 1.44 && d2 > 1e-6 && Math.abs(player.y - this.pos.y) < 1.5) { const d = Math.sqrt(d2); const k = (1.2 - d) * 2.2 / d; pushX += ox * k; pushZ += oz * k; if (d < 0.8 && this.state === 'walk') { desiredX *= 0.4; desiredZ *= 0.4; } }
    }
    if (this.onEsc && !this.walksOnEsc) { pushX *= 0.15; pushZ *= 0.15; }   // standing on the steps: don't get shoved about
    // ---- integrate
    const k = 1 - Math.exp(-dt * (this.onEsc ? 4 : 7));
    this.vel.x += ((desiredX + pushX) - this.vel.x) * k; this.vel.z += ((desiredZ + pushZ) - this.vel.z) * k;
    { const vm = Math.hypot(this.vel.x, this.vel.z); const cap = Math.max(wantSpeed, this.speed) * 1.25 + 0.2; if (vm > cap) { this.vel.x *= cap / vm; this.vel.z *= cap / vm; } }
    const prevX = this.pos.x, prevZ = this.pos.z;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    if (this.floor && this.floor.move) { this.pos.x += this.floor.move.x * dt; this.pos.z += this.floor.move.z * dt; }
    if (!this.skipWalls) collision.resolve(this.pos, RADIUS, HEIGHT, STEP_UP);
    // ---- ground
    const onSlope = this.onEdge && (this.onEdge.kind === 'esc' || this.onEdge.kind === 'escReverse' || this.onEdge.kind === 'stairs');
    const support = collision.floorAt(this.pos.x, this.pos.z, this.pos.y, { stepUp: 0.55, drop: onSlope ? 2.6 : 1.6 });
    if (support) {
      const dy = support.y - this.pos.y;
      if (Math.abs(dy) < 0.03 || this.floor === support.floor) this.pos.y = support.y; else this.pos.y += dy * Math.min(1, dt * 16);
      this.floor = support.floor;
    } else if (!this.skipWalls) {
      // nothing beneath (module not loaded here / stepped off the world): step back and stop
      this.pos.x = prevX; this.pos.z = prevZ; this.vel.set(0, 0, 0); this.floor = null;
    }
    this.onEsc = !!(this.floor && this.floor.move);
    // ---- gait
    const sx = this.vel.x, sz = this.vel.z; this.selfSpeed = Math.hypot(sx, sz);
    const strideLen = (0.62 + 0.3 * Math.min(1, this.selfSpeed / 1.5)) * (app.height / 1.75) * 2;
    if (this.selfSpeed > 0.08) { this.phase += (2 * Math.PI * this.selfSpeed / strideLen) * dt; }
    else { const target = Math.round(this.phase / Math.PI) * Math.PI; this.phase += (target - this.phase) * Math.min(1, dt * 6); }
    const gTarget = Math.min(1, this.selfSpeed / 1.25); this.stride += (gTarget - this.stride) * Math.min(1, dt * 8);
    if (this.selfSpeed > 0.3) { this.headingTarget = Math.atan2(sx, sz); }
    else if (this.lookAt) { this.headingTarget = Math.atan2(this.lookAt.x - this.pos.x, this.lookAt.z - this.pos.z); }
    else if (this.onEsc && this.floor.move) { this.headingTarget = Math.atan2(this.floor.move.x, this.floor.move.z); }
    let dh = this.headingTarget - this.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); this.heading += dh * Math.min(1, dt * (this.selfSpeed > 0.3 ? 9 : 3));
    // ---- footsteps (phase crossing multiples of π = a foot plant)
    if (this.footstepCb && this.selfSpeed > 0.3) { const step = Math.floor(this.phase / Math.PI); if (step !== this.lastStepPhase) { this.lastStepPhase = step; this.footstepCb(this); } }
    // ---- head / fidgets
    this._fidgets(dt, world);
    // lean: forward when walking briskly, backwards slightly when riding down an escalator
    const leanT = this.selfSpeed > 0.3 ? 0.05 * this.selfSpeed : (this.onEsc ? -0.03 : 0);
    this.lean += (leanT - this.lean) * Math.min(1, dt * 4);
  }

  _ride(world) { /* passengers inside a train are positioned by the population manager each frame */ }

  _nextWaypoint(afterPause = false) {
    const cur = this.waypoint;
    if (!afterPause && cur && cur.meta && cur.meta.pause) { this.state = 'pause'; this.timer = cur.meta.pause; this.vel.set(0, 0, 0); if (cur.meta.lookAt) this.lookAt = cur.meta.lookAt; try { cur.meta.onReach && cur.meta.onReach(this); } catch (e) { console.warn('[npc] onReach', e); } return; }
    if (cur && cur.meta && cur.meta.lookAt) this.lookAt = null;
    this.pathIdx++;
    if (this.pathIdx >= this.path.length) { this.state = 'idle'; this.waypoint = null; this.onEdge = null; this.vel.multiplyScalar(0.3); return; }
    this.waypoint = this.path[this.pathIdx]; this.onEdge = this.waypoint.edge || null;
    if (this.waypoint.meta && this.waypoint.meta.skipWalls != null) this.skipWalls = !!this.waypoint.meta.skipWalls;
  }

  _fidgets(dt, world) {
    const app = this.app; const walking = this.selfSpeed > 0.3;
    this.nextFidget -= dt;
    if (this.nextFidget <= 0) {
      this.nextFidget = 2.5 + this.rng() * 7;
      const r = this.rng();
      if (walking) { this.fidget = r < 0.25 ? 'lookAround' : r < 0.32 && app.phone ? 'phoneWalk' : 'none'; }
      else if (this.state === 'photo') { this.fidget = r < 0.7 ? 'photo' : 'lookUp'; }
      else { this.fidget = r < 0.35 && app.phone ? 'phone' : r < 0.55 ? 'lookIndicator' : r < 0.75 ? 'lookTunnel' : r < 0.85 ? 'lookAround' : 'none'; }
      this.headYawT = 0; this.headPitchT = 0; this.phoneUpT = 0; this.phoneHighT = 0;
      switch (this.fidget) {
        case 'lookAround': this.headYawT = (this.rng() - 0.5) * 1.4; this.headPitchT = (this.rng() - 0.5) * 0.2; break;
        case 'phoneWalk': this.phoneUpT = 1; this.headPitchT = 0.55; break;
        case 'phone': this.phoneUpT = 1; this.headPitchT = 0.55; break;
        case 'photo': this.phoneHighT = 1; this.headPitchT = -0.35; break;
        case 'lookUp': this.headPitchT = -0.5; this.headYawT = (this.rng() - 0.5) * 0.6; break;
        case 'lookIndicator': this.headPitchT = -0.4; this.headYawT = this.user.indicatorYaw ?? (this.rng() < 0.5 ? -0.9 : 0.9); break;
        case 'lookTunnel': this.headYawT = this.user.tunnelYaw ?? (this.rng() < 0.5 ? -1.2 : 1.2); this.headPitchT = 0.05; break;
        default: break;
      }
    }
    if (this.tapT > 0) { this.tapT -= dt; this.tap += (1 - this.tap) * Math.min(1, dt * 8); } else this.tap += (0 - this.tap) * Math.min(1, dt * 6);
    const k = Math.min(1, dt * 3);
    this.headYaw += (this.headYawT - this.headYaw) * k; this.headPitch += (this.headPitchT - this.headPitch) * k;
    this.phoneUp += (this.phoneUpT - this.phoneUp) * k; this.phoneHigh += (this.phoneHighT - this.phoneHigh) * k;
  }

  /** Write the pose into the pool (call at the LOD rate). */
  render() {
    if (this.slot < 0 || this.dead) return;
    const app = this.app;
    this.pool.pose(this.slot, {
      x: this.pos.x, y: this.pos.y, z: this.pos.z, heading: this.heading, phase: this.phase, stride: this.stride, idle: this.idleT,
      lean: this.lean, headYaw: this.headYaw, headPitch: this.headPitch, phoneUp: Math.max(this.phoneUp, this.tap * 0.0), phoneHigh: this.phoneHigh,
      suitcase: app.suitcase ? (this.selfSpeed > 0.3 ? 1 : 0.0) : 0, tap: this.tap,
    });
  }

  dispose() { if (this.slot >= 0) this.pool.free(this.slot); this.slot = -1; this.dead = true; }
}

/** Convert a node-id path into Vector3 waypoints with edge metadata (escalator lanes, gates, stairs). */
export function pathToWaypoints(G, ids, opts = {}) {
  const pts = [];
  for (let i = 0; i < ids.length; i++) {
    const n = G.nodes[ids[i]]; const v = new THREE.Vector3(n.x, n.y, n.z); v.node = n.id;
    if (i > 0) { const e = G.edge(ids[i - 1], ids[i]); v.edge = e; }
    // jitter: don't all walk the same line (except escalators / stairs / gates)
    const e = v.edge; if (opts.jitter && (!e || e.kind === 'walk') && !n.tags.has('escEntry') && !n.tags.has('escExit') && !n.tags.has('stairTop') && !n.tags.has('stairBottom')) { v.x += (opts.rng() - 0.5) * 2 * opts.jitter; v.z += (opts.rng() - 0.5) * 2 * opts.jitter; }
    pts.push(v);
  }
  return pts;
}
