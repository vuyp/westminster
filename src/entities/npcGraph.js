// ---------------------------------------------------------------------------
// npcGraph.js — the default passenger waypoint graph, derived ONLY from layout.js (v2 topology):
//   street (Bridge Street pavements, Parliament Street footways, Embankment, bridge footways, crossings,
//   bus stop H, Big Ben photo spots) → six exits → subway strip / Whitehall & Embankment passages →
//   concourse grid split by the NW–SE gateline → D&C stairs (rotated s/t frame) → D&C platforms →
//   interchange EAST / WEST → (escalators are attached dynamically from the collision ramps) → the four
//   wells → passages → Jubilee platforms 3 and 4.
// Nodes carry tags used by the journeys ('street', 'hall', 'paid', 'platform3', 'photo', 'exit3', …).
// Everything is validated later against the real floors, so missing modules simply prune the graph.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { LEVELS, STREET, TICKET_HALL, DISTRICT, JUBILEE, dcToWorld, worldToDc } from '../core/layout.js';
import { NavGraph } from './npcBehaviour.js';

export const BIG_BEN = new THREE.Vector3(STREET.elizabethTower.x, STREET.elizabethTower.clockHeight, STREET.elizabethTower.z);

// ---- gateline geometry: segment from → to, paid side = north-east (positive along `normal`) ----
const GL = TICKET_HALL.gateline;
export const GATELINE = (() => {
  const from = new THREE.Vector2(GL.from[0], GL.from[1]), to = new THREE.Vector2(GL.to[0], GL.to[1]);
  const dir = to.clone().sub(from); const len = dir.length(); dir.divideScalar(len);
  const normal = new THREE.Vector2(dir.y, -dir.x);           // points +x / -z → north-east (paid side)
  if (normal.x + (-normal.y) < 0) normal.negate();
  return { from, to, dir, normal, len, pitch: len / GL.gates, gates: GL.gates, wide: GL.wideGateIndex ?? 0 };
})();
/** Centre (x,z) of gate i along the line. */
export function gateCentre(i) { const g = GATELINE; const d = (i + 0.5) * g.pitch; return { x: g.from.x + g.dir.x * d, z: g.from.y + g.dir.y * d }; }
/** Signed distance from the gateline (positive = paid side). */
export function paidSide(x, z) { const g = GATELINE; return (x - g.from.x) * g.normal.x + (z - g.from.y) * g.normal.y; }
/** Where segment p→q crosses the gateline segment: returns { x, z, t, gate, dir } or null. */
export function gateCrossing(px, pz, qx, qz) {
  const g = GATELINE; const a = paidSide(px, pz), b = paidSide(qx, qz); if (a * b >= 0) return null;
  const t = a / (a - b); const x = px + (qx - px) * t, z = pz + (qz - pz) * t;
  const along = (x - g.from.x) * g.dir.x + (z - g.from.y) * g.dir.y; if (along < -0.8 || along > g.len + 0.8) return null;
  const gate = Math.max(0, Math.min(g.gates - 1, Math.floor(along / g.pitch)));
  return { x, z, t, gate, dir: b > 0 ? 1 : -1 };   // dir +1 = entering the paid side
}

export function buildDefaultGraph() {
  const G = new NavGraph(); const H = LEVELS.concourse, S = LEVELS.street, DC = LEVELS.dcPlatform;
  const N = (x, y, z, tags, area) => G.add(x, y, z, tags, area);
  const chain = (ids, opts) => { for (let i = 1; i < ids.length; i++) G.link(ids[i - 1], ids[i], opts); };
  const nearTag = (tag, x, y, z, maxDist = 12) => G.nearest(x, y, z, { maxDist, yTol: 1, filter: n => n.tags.has(tag) });

  // ======================================================================= STREET
  const zN = 2.2, zS = (STREET.pavementSouth.zMin + STREET.pavementSouth.zMax) / 2;     // 2.2 (kerb side of the arcade) / 24.5
  const xsN = [-76, -62, -48, -36, -27, -20, -12, -5, 0, 5, 12, 22, 32, 40, 46];
  const north = xsN.map(x => N(x, S, zN, ['street', 'pavementN'], 'street')); chain(north);
  G.tag(north[0], 'streetEndW');
  const xsS = [-76, -62, -48, -36, -24, -12, 0, 10, 18, 26, 34, 40, 52, 58, 66, 74, 82];
  const south = xsS.map(x => N(x, S, zS, ['street', 'pavementS'], 'street')); chain(south);
  G.tag(south[0], 'streetEndW');
  // Westminster Bridge footways (deck 0.4 m): north footway continues the north pavement past the Embankment junction
  const bridgeN = [N(90, S + 0.3, zN, ['street', 'bridge'], 'street'), N(104, S + 0.4, zN, ['street', 'bridge', 'streetEndE'], 'street')];
  const bridgeS = [N(90, S + 0.3, 24, ['street', 'bridge'], 'street'), N(104, S + 0.4, 24, ['street', 'bridge', 'streetEndE'], 'street')];
  chain(bridgeN); chain(bridgeS); G.link(south[south.length - 1], bridgeS[0]);
  // Embankment corner: pavement east of Portcullis House, the crossing over Victoria Embankment, the riverside pavement
  const embW = [N(44, S, -6, ['street', 'embankmentW'], 'street'), N(44, S, -22, ['street', 'embankmentW'], 'street'), N(44, S, -40, ['street', 'embankmentW'], 'street'), N(44, S, -58, ['street', 'embankmentW', 'streetEndN'], 'street')];
  chain(embW); G.link(north[north.length - 1], embW[0]);
  const crossEmb = [52, 60].map(x => N(x, S, zN, ['street', 'crossing'], 'street')); chain([north[north.length - 1], ...crossEmb]);
  const river = [N(70, S, zN, ['street', 'riverside'], 'street'), N(75, S, -3, ['street', 'riverside', 'boadicea'], 'street'), N(78, S, -14, ['street', 'riverside'], 'street'), N(77, S, -26, ['street', 'riverside'], 'street'), N(77, S, -46, ['street', 'riverside'], 'street'), N(78, S, -70, ['street', 'riverside', 'streetEndN'], 'street')];
  chain([crossEmb[1], ...river]); G.link(river[0], bridgeN[0]);
  // pedestrian crossings over Bridge Street: Parliament Street corner and the bridge/Embankment end
  for (const cx of [-76, 40]) { const a = north[xsN.indexOf(cx)], b = south[xsS.indexOf(cx)]; const mids = [9, 14, 19].map(z => N(cx, S, z, ['street', 'crossing'], 'street')); chain([a, ...mids, b]); }
  // Parliament Street footways (Exits 5 & 6 come up here) heading north towards Whitehall
  const parlE = [N(-74, S, -8, ['street', 'parliamentSt'], 'street'), N(-74, S, -24, ['street', 'parliamentSt'], 'street'), N(-74, S, -44, ['street', 'parliamentSt', 'streetEndNW'], 'street')];
  chain([north[0], ...parlE]);
  const parlW = [N(-104, S, 3, ['street', 'parliamentSt'], 'street'), N(-104, S, -12, ['street', 'parliamentSt'], 'street'), N(-104, S, -30, ['street', 'parliamentSt'], 'street'), N(-104, S, -46, ['street', 'parliamentSt', 'streetEndNW'], 'street')];
  chain(parlW); const crossParl = [N(-84, S, 4, ['street', 'crossing'], 'street'), N(-94, S, 4, ['street', 'crossing'], 'street')]; chain([north[0], ...crossParl, parlW[0]]);
  // bus stop H (eastbound), 24 m west of the entrance: people wait at the kerb
  const bus = [[-26, 3.6], [-23.5, 3.9], [-21.5, 3.5], [-28, 3.8]].map(([x, z]) => N(x, S, z, ['street', 'busStop'], 'street'));
  bus.forEach(b => { G.link(b, north[xsN.indexOf(-27)]); G.link(b, north[xsN.indexOf(-20)]); });
  // Big Ben photo spots: the south pavement at the foot of the tower, the entrance pavement opposite, and the Boadicea corner
  // … and the riverside by Exits 1 & 2 (76 m from the tower at bearing 229°: the full tower above the bridge corner)
  const photo = [[30, 25.3], [36, 25.6], [42, 25.2], [50, 25.5], [56, 25.6], [26, 25.8], [8, 3.6], [14, 3.9], [3, 3.8], [72, -1], [76, -7], [79.5, -12.5], [78, -19.5], [76.5, -22]].map(([x, z]) => N(x, S, z, ['street', 'photo', x > 70 && z < -10 ? 'photoExit1' : 'photoOther'], 'street'));
  photo.forEach(p => { const n = G.nodes[p]; const near = G.nearest(n.x, S, n.z, { maxDist: 12, filter: m => (m.tags.has('pavementS') || m.tags.has('pavementN') || m.tags.has('riverside')) && m.id !== p }); if (near >= 0) G.link(p, near); });

  // ======================================================================= EXIT 4: the Bridge Street entrance
  const ms = TICKET_HALL.mainStairs, ep = TICKET_HALL.entrancePassage;
  const ent = N(STREET.entranceMain.x, S, 0.8, ['street', 'entrance'], 'street'); G.link(ent, north[xsN.indexOf(0)]); G.link(ent, north[xsN.indexOf(-5)]); G.link(ent, north[xsN.indexOf(5)]);
  const pas = N((ep.xMin + ep.xMax) / 2, S, (ep.zMin + ep.zMax) / 2, ['street', 'entrancePassage'], 'street'); G.link(ent, pas);
  const laneW = (ms.xMin + ms.xMax) / 2 - 2.0, laneE = (ms.xMin + ms.xMax) / 2 + 2.0;
  const topW = N(laneW, S, ms.zTop + 0.2, ['stairTop', 'mainStairs'], 'stairs'), topE = N(laneE, S, ms.zTop + 0.2, ['stairTop', 'mainStairs'], 'stairs');
  const botW = N(laneW, H, ms.zBottom - 1.3, ['stairBottom', 'mainStairs', 'hall'], 'ticketHall'), botE = N(laneE, H, ms.zBottom - 1.3, ['stairBottom', 'mainStairs', 'hall'], 'ticketHall');
  G.link(pas, topW); G.link(pas, topE);
  G.link(topW, botW, { oneWay: true, kind: 'stairs' }); G.link(botE, topE, { oneWay: true, kind: 'stairs' });   // keep left: down on the west lane, up on the east lane
  G.link(topW, botW, { kind: 'stairs', cost: 40 }); G.link(topE, botE, { kind: 'stairs', cost: 40 });          // wrong-lane fallbacks

  // ======================================================================= CONCOURSE grid
  const xs = [], zs = []; for (let x = -48; x <= 46; x += 6) xs.push(x); for (let z = -38; z <= 16; z += 6) zs.push(z);
  const blocked = [];
  blocked.push({ xMin: ms.xMin - 1, xMax: ms.xMax + 1, zMin: ms.zBottom - 0.5, zMax: -2 });                 // under the entrance stair
  for (const r of DISTRICT.stairOpeningsWorld) blocked.push({ xMin: r.xMin - 0.8, xMax: r.xMax + 0.8, zMin: r.zMin - 0.8, zMax: r.zMax + 0.8 });
  blocked.push({ xMin: TICKET_HALL.streetLift.x - 1.8, xMax: TICKET_HALL.streetLift.x + 1.8, zMin: TICKET_HALL.streetLift.z - 1.8, zMax: TICKET_HALL.streetLift.z + 1.8 });
  blocked.push({ xMin: 40, xMax: 48, zMin: -12, zMax: -4 });                                                   // bank (a) top landing (the escalator registers it)
  const inB = (x, z) => blocked.some(b => x > b.xMin && x < b.xMax && z > b.zMin && z < b.zMax);
  const grid = new Map();
  for (const x of xs) for (const z of zs) {
    if (x < TICKET_HALL.xMin + 2 || x > TICKET_HALL.xMax - 2 || z < TICKET_HALL.zMin + 2 || z > TICKET_HALL.zMax - 2) continue;
    if (inB(x, z)) continue;
    const tags = ['hall', paidSide(x, z) > 0 ? 'paid' : 'unpaid']; if (z > 0) tags.push('subway');
    grid.set(x + ',' + z, N(x, H, z, tags, 'ticketHall'));
  }
  for (const x of xs) for (const z of zs) {
    const a = grid.get(x + ',' + z); if (a == null) continue;
    const link = (x2, z2) => { const b = grid.get(x2 + ',' + z2); if (b == null) return; const c = gateCrossing(x, z, x2, z2); if (c) { if (x !== x2 && z !== z2) return; G.link(a, b, { kind: 'gate', cost: Math.hypot(x2 - x, z2 - z) + 4 }); return; } if (paidSide(x, z) * paidSide(x2, z2) < 0) return; G.link(a, b); };
    link(x + 6, z); link(x, z + 6); link(x + 6, z + 6); link(x + 6, z - 6);
  }
  const hallNear = (x, z, maxDist = 10) => G.nearest(x, H, z, { maxDist, yTol: 1, filter: n => n.tags.has('hall') && !n.tags.has('stairBottom') });
  for (const b of [botW, botE]) for (const [x, z] of [[-6, -20], [0, -20], [6, -20], [-6, -14], [6, -14]]) { const n = hallNear(x, z, 4.5); if (n != null && n >= 0) G.link(b, n); }
  // ticket machines / cash machines (unpaid, west wall) and the map by the gateline: places to pause
  const tm = TICKET_HALL.ticketMachines; for (const z of [tm.zMin + 2, tm.zMax - 2]) { const n = N(tm.x + 2.4, H, z, ['hall', 'unpaid', 'ticketMachine'], 'ticketHall'); const g = hallNear(tm.x + 6, z, 9); if (g >= 0) G.link(n, g); }
  const cm = TICKET_HALL.cashMachines; { const n = N(cm.x + 2.4, H, (cm.zMin + cm.zMax) / 2, ['hall', 'unpaid', 'cashMachine'], 'ticketHall'); const g = hallNear(cm.x + 6, (cm.zMin + cm.zMax) / 2, 9); if (g >= 0) G.link(n, g); }
  // bank (a) top landing area (paid, east end of the south side) — the escalator entry nodes attach here
  const escTopA = N(38.5, H, -8, ['hall', 'paid', 'escTopArea'], 'ticketHall'); for (const [x, z] of [[34, -8], [34, -14], [40, -14], [34, -2]]) { const g = hallNear(x, z, 4.5); if (g >= 0) G.link(escTopA, g); }

  // ======================================================================= passages & exits from the concourse
  // Exit 3 (Houses of Parliament): east end of the Bridge Street subway strip → south under the road → stair up to the Big Ben pavement
  const e3 = TICKET_HALL.exit3Passage; const e3x = (e3.xMin + e3.xMax) / 2;
  const e3p = [N(e3x, H, e3.zFrom + 1.5, ['hall', 'unpaid', 'subway', 'exit3Passage'], 'ticketHall'), N(e3x, H, (e3.zFrom + e3.zTo) / 2, ['hall', 'unpaid', 'exit3Passage'], 'ticketHall'), N(e3x, H, e3.zTo - 1.6, ['hall', 'unpaid', 'stairBottom', 'exit3'], 'ticketHall')];
  chain(e3p); { const g = hallNear(e3x - 2, e3.zFrom - 2, 8); if (g >= 0) G.link(e3p[0], g); const g2 = hallNear(e3x - 6, e3.zFrom + 2, 8); if (g2 >= 0) G.link(e3p[0], g2); }
  const e3top = N(e3.stairsTop[0], S, e3.stairsTop[1] + 1.4, ['street', 'stairTop', 'exit3'], 'street'); G.link(e3p[2], e3top, { kind: 'stairs' });
  G.link(e3top, south[xsS.indexOf(40)]); G.link(e3top, south[xsS.indexOf(52)]); G.link(e3top, photo[2]); G.link(e3top, photo[3]);
  // Embankment passage (Exits 1 & 2): leaves the east side of the concourse (4 steps down), runs east under the Embankment corner
  const emb = TICKET_HALL.embankmentPassage; const embZ = (emb.zMin + emb.zMax) / 2;
  const embp = [N(emb.xFrom + 1.5, H, embZ, ['hall', 'embankmentPassage'], 'ticketHall'), N(emb.xFrom + 9, H - 0.7, embZ, ['hall', 'embankmentPassage'], 'ticketHall'), N(emb.xFrom + 18, H - 0.7, embZ, ['hall', 'embankmentPassage'], 'ticketHall'), N(emb.xTo - 1, H - 0.7, embZ, ['hall', 'embankmentPassage', 'stairBottom', 'exit2'], 'ticketHall')];
  chain(embp, { kind: 'stairs' }); { const g = hallNear(emb.xFrom - 4, embZ, 8); if (g >= 0) G.link(embp[0], g); const g2 = hallNear(emb.xFrom - 4, embZ - 6, 9); if (g2 >= 0) G.link(embp[0], g2); }
  const e2top = N(STREET.exit2.x, S, STREET.exit2.z + 4.5, ['street', 'stairTop', 'exit2', 'riverside'], 'street'); G.link(embp[3], e2top, { kind: 'stairs' }); G.link(e2top, river[1]); G.link(e2top, river[0]);
  const e1bot = N(STREET.exit1.x - 4, H - 0.7, STREET.exit1.z, ['hall', 'embankmentPassage', 'stairBottom', 'exit1'], 'ticketHall'); G.link(embp[3], e1bot);
  const e1top = N(STREET.exit1.x, S, STREET.exit1.z - 3, ['street', 'stairTop', 'exit1', 'riverside'], 'street'); G.link(e1bot, e1top, { kind: 'stairs' }); G.link(e1top, river[2]); G.link(e1top, river[3]);
  // Whitehall passage (Exits 5 & 6): leaves the west side of the concourse, runs west under Parliament Street
  const wh = TICKET_HALL.whitehallPassage; const whZ = (wh.zMin + wh.zMax) / 2;
  const whp = [N(wh.xFrom - 1.5, H, whZ, ['hall', 'unpaid', 'whitehallPassage'], 'ticketHall'), N(wh.xFrom - 10, H, whZ, ['hall', 'whitehallPassage'], 'ticketHall'), N(wh.xFrom - 20, H, whZ, ['hall', 'whitehallPassage'], 'ticketHall'), N(wh.xTo + 1.5, H, whZ, ['hall', 'whitehallPassage', 'stairBottom', 'exit5'], 'ticketHall')];
  chain(whp); { const g = hallNear(wh.xFrom + 4, whZ, 8); if (g >= 0) G.link(whp[0], g); const g2 = hallNear(wh.xFrom + 4, whZ - 6, 9); if (g2 >= 0) G.link(whp[0], g2); }
  const e5top = N(STREET.exit5.x + 1, S, STREET.exit5.z + 4.5, ['street', 'stairTop', 'exit5', 'parliamentSt'], 'street'); G.link(whp[3], e5top, { kind: 'stairs' }); G.link(e5top, parlE[0]); G.link(e5top, parlE[1]);
  const e6p = [N(-88, H, whZ, ['hall', 'whitehallPassage'], 'ticketHall'), N(-100, H, whZ, ['hall', 'whitehallPassage'], 'ticketHall'), N(STREET.exit6.x + 1, H, whZ, ['hall', 'whitehallPassage', 'stairBottom', 'exit6'], 'ticketHall')];
  chain([whp[3], ...e6p]);
  const e6top = N(STREET.exit6.x + 2, S, STREET.exit6.z + 4.5, ['street', 'stairTop', 'exit6', 'parliamentSt'], 'street'); G.link(e6p[2], e6top, { kind: 'stairs' }); G.link(e6top, parlW[1]); G.link(e6top, parlW[2]);

  // ======================================================================= DISTRICT & CIRCLE (rotated frame)
  const dcN = (s, t, y, tags, area = 'district') => { const w = dcToWorld(s, t); return N(w.x, y, w.z, tags, area); };
  const dcChains = {};
  for (const p of Object.values(DISTRICT.platforms)) {
    const inward = p.edgeT > 0 ? 1 : -1;                     // P1: edge at +3.7, platform beyond (+t); P2: edge at -3.7
    const tWalk = p.edgeT + inward * 2.9;                     // walking line, behind the waiting line
    const ids = []; for (let s = -60; s <= 60; s += 8) ids.push(dcN(s, tWalk, DC, ['platform' + p.number, 'dcPlatform'], 'district'));
    chain(ids); dcChains[p.number] = ids;
  }
  // stairs from the concourse (two flights along the platform, descending towards +s) into P2's first recess / P1's wide west end
  for (const st of DISTRICT.stairs) {
    const t = (st.tMin + st.tMax) / 2;
    const topW = dcToWorld(st.sTop - 1.6, t), botW = dcToWorld(st.sBottom + 1.4, t);
    const top = N(topW.x, H, topW.z, ['hall', 'dcStairTop', 'dcStairTop' + st.platform], 'ticketHall'); const bot = N(botW.x, DC, botW.z, ['platform' + st.platform, 'dcStairBottom'], 'district');
    G.link(top, bot, { kind: 'stairs' });
    const near = []; for (const [dx, dz] of [[-4, 0], [4, 0], [0, -4], [0, 4], [-5, -5], [5, 5], [5, -5], [-5, 5]]) { const n = hallNear(topW.x + dx, topW.z + dz, 8); if (n >= 0 && !near.includes(n)) near.push(n); }
    near.slice(0, 3).forEach(n => G.link(top, n));
    const chainIds = dcChains[st.platform]; const bw = worldToDc(botW.x, botW.z); const cand = chainIds.filter(i => Math.abs(worldToDc(G.nodes[i].x, G.nodes[i].z).s - bw.s) < 10); cand.forEach(i => G.link(bot, i));
    // the recess / wide end itself (a place to stand between the stair and the platform)
    const rc = dcN(st.sBottom + 5, t * 0.85, DC, ['platform' + st.platform, 'dcRecess'], 'district'); G.link(bot, rc); cand.forEach(i => G.link(rc, i));
  }
  // recess nodes where banks (c) and (d) leave the platforms (escalator entries attach here dynamically)
  { const c = dcN(-24 + 2.5, -10.2, DC, ['platform2', 'dcRecess', 'escTopArea'], 'district'); dcChains[2].filter(i => Math.abs(worldToDc(G.nodes[i].x, G.nodes[i].z).s + 22) < 9).forEach(i => G.link(c, i));
    const d = dcN(-26 + 2.5, 10.2, DC, ['platform1', 'dcRecess', 'escTopArea'], 'district'); dcChains[1].filter(i => Math.abs(worldToDc(G.nodes[i].x, G.nodes[i].z).s + 24) < 9).forEach(i => G.link(d, i)); }

  // ======================================================================= INTERCHANGE levels
  const IE = JUBILEE.interchangeEast, IW = JUBILEE.interchangeWest;
  const ie = [[16, -8], [24, -8], [30, -14], [22, -16], [16, -22], [26, -22], [20, -26]].map(([x, z]) => N(x, IE.y, z, ['box', 'interchangeEast'], 'box'));
  chain(ie); G.link(ie[0], ie[3]); G.link(ie[1], ie[3]); G.link(ie[2], ie[5]); G.link(ie[3], ie[5]); G.link(ie[4], ie[6]); G.link(ie[3], ie[4]);
  const iw = [[-36, -12], [-30, -6], [-24, -12], [-16, -8], [-12, -14], [-30, -20], [-20, -22], [-30, 4], [-24, 10], [-36, 0]].map(([x, z]) => N(x, IW.y, z, ['box', 'interchangeWest'], 'box'));
  chain(iw.slice(0, 5)); G.link(iw[0], iw[5]); G.link(iw[2], iw[5]); G.link(iw[2], iw[6]); G.link(iw[4], iw[6]); G.link(iw[5], iw[6]); G.link(iw[1], iw[7]); G.link(iw[7], iw[8]); G.link(iw[7], iw[9]); G.link(iw[0], iw[9]); G.link(iw[1], iw[9]); G.link(iw[3], iw[1]);

  // ======================================================================= WELLS + passages + Jubilee platforms
  const wells = {};
  for (const [lvlName, y] of [['upper', LEVELS.jubUpper], ['lower', LEVELS.jubLower]]) {
    for (const [side, w] of Object.entries(JUBILEE.wells)) {
      const cx = (w.xMin + w.xMax) / 2; const pts = [[cx, -8], [cx - 6, -14], [cx + 6, -14], [cx, -20], [cx - 6, -22], [cx + 6, -22], [cx - 8, -8], [cx + 8, -8]];
      const ids = pts.map(([x, z]) => N(x, y, z, ['box', 'well', 'well' + side[0].toUpperCase() + side.slice(1) + lvlName[0].toUpperCase() + lvlName.slice(1)], 'box'));
      G.link(ids[0], ids[1]); G.link(ids[0], ids[2]); G.link(ids[1], ids[3]); G.link(ids[2], ids[3]); G.link(ids[1], ids[4]); G.link(ids[2], ids[5]); G.link(ids[3], ids[4]); G.link(ids[3], ids[5]); G.link(ids[0], ids[6]); G.link(ids[0], ids[7]); G.link(ids[1], ids[6]); G.link(ids[2], ids[7]); G.link(ids[1], ids[2]);
      wells[side + lvlName] = ids;
    }
  }
  const platY = { 3: LEVELS.jubUpper, 4: LEVELS.jubLower };
  for (const [num, y] of Object.entries(platY)) {
    const zWalk = JUBILEE.platformZMin + 0.9;               // walking line at the back of the 3 m platform
    const ids = []; for (let x = JUBILEE.xMin + 5; x <= JUBILEE.xMax - 5; x += 8) ids.push(N(x, y, zWalk, ['platform' + num, 'jubPlatform'], 'jubilee'));
    chain(ids);
    const lvl = num === '3' ? 'upper' : 'lower';
    for (const p of JUBILEE.passages) {
      const side = p.x < 0 ? 'west' : 'east';
      const a = N(p.x, y, JUBILEE.box.zMax - 2.2, ['box', 'passage'], 'box'), b = N(p.x, y, JUBILEE.platformZMin + 0.9, ['platform' + num, 'passage'], 'jubilee');
      G.link(a, b); const w = wells[side + lvl]; G.link(a, w[0]); G.link(a, w[6]); G.link(a, w[7]);
      ids.filter(i => Math.abs(G.nodes[i].x - p.x) < 9).forEach(i => G.link(b, i));
    }
  }
  return G;
}

/** Waiting spots along the platforms (behind the yellow line / PED threshold). Each: { x,y,z, w, face, tunnelYaw } */
export function buildWaitSpots(rng, floorOk) {
  const spots = {};
  // Jubilee: the platform is 3 m wide; people stand c. 1.0–1.4 m back from the PED line, denser near the passages
  for (const [num, y] of [[3, LEVELS.jubUpper], [4, LEVELS.jubLower]]) {
    const list = [];
    for (let x = JUBILEE.xMin + 6; x < JUBILEE.xMax - 6; x += 2.2) {
      const xx = x + (rng() - 0.5) * 1.2; const z = JUBILEE.pedZ - 1.0 - rng() * 0.45; if (!floorOk(xx, y, z)) continue;
      const w = (Math.abs(xx + 20) < 22 || Math.abs(xx - 20) < 22) ? 1 : 0.35;
      list.push({ x: xx, y, z, w, agent: null, face: new THREE.Vector3(xx, y, JUBILEE.trackZ), tunnelYaw: num === 3 ? -Math.PI / 2 : Math.PI / 2 });
    }
    spots[num] = list;
  }
  // District: 1.4–2 m behind the platform edge (yellow line 0.5 m in), denser near the stairs / recesses (west end)
  for (const p of Object.values(DISTRICT.platforms)) {
    const list = []; const inward = p.edgeT > 0 ? 1 : -1; const trackT = DISTRICT.tracks[p.direction].t;
    for (let s = DISTRICT.sMin + 6; s < DISTRICT.sMax - 6; s += 2.2) {
      const ss = s + (rng() - 0.5) * 1.2; const t = p.edgeT + inward * (1.4 + rng() * 0.6); const w = dcToWorld(ss, t); if (!floorOk(w.x, LEVELS.dcPlatform, w.z)) continue;
      const f = dcToWorld(ss, trackT); const weight = ss < -10 ? 1 : 0.4;
      // tunnel the train comes from: westbound (P1) trains arrive from +s (NE); eastbound (P2) from -s
      const fromS = p.direction === 'westbound' ? 1 : -1; const dir = dcToWorld(ss + fromS * 10, t); const tunnelYaw = Math.atan2(dir.x - w.x, dir.z - w.z);
      list.push({ x: w.x, y: LEVELS.dcPlatform, z: w.z, w: weight, agent: null, face: new THREE.Vector3(f.x, LEVELS.dcPlatform, f.z), tunnelYaw });
    }
    spots[p.number] = list;
  }
  return spots;
}

/** Is a world point on the platform that serves this track (used to pick the platform side of a train's doors)? */
export function onPlatform(track, platform, x, z) {
  if (String(track).startsWith('jubilee')) return x > JUBILEE.xMin + 2 && x < JUBILEE.xMax - 2 && z > JUBILEE.platformZMin - 0.3 && z < JUBILEE.pedZ + 0.3;
  const p = DISTRICT.platforms[platform]; if (!p) return false; const l = worldToDc(x, z);
  return l.s > DISTRICT.sMin + 2 && l.s < DISTRICT.sMax - 2 && l.t > Math.min(p.tMin, p.tMax) - 0.3 && l.t < Math.max(p.tMin, p.tMax) + 0.3;
}

/** Staff posts (hi-vis): gateline wide gate, top of bank (a), each platform. */
export function staffPosts() {
  const H = LEVELS.concourse; const g0 = gateCentre(GATELINE.wide); const n = GATELINE.normal;
  const p1 = dcToWorld(-14, 6.2), p1f = dcToWorld(10, 6.2), p2 = dcToWorld(-14, -6.2), p2f = dcToWorld(10, -6.2);
  return [
    { x: g0.x - n.x * 2.0 + GATELINE.dir.x * 1.2, y: H, z: g0.z - n.y * 2.0 + GATELINE.dir.y * 1.2, look: new THREE.Vector3(g0.x - n.x * 12, H, g0.z - n.y * 12) },   // faces the arriving (unpaid) crowd
    { x: 36, y: H, z: -11.5, look: new THREE.Vector3(42, H, -8) },
    { x: -6, y: LEVELS.jubUpper, z: JUBILEE.platformZMin + 1.0, look: new THREE.Vector3(30, LEVELS.jubUpper, JUBILEE.platformZMin + 1.0) },
    { x: 6, y: LEVELS.jubLower, z: JUBILEE.platformZMin + 1.0, look: new THREE.Vector3(-30, LEVELS.jubLower, JUBILEE.platformZMin + 1.0) },
    { x: p1.x, y: LEVELS.dcPlatform, z: p1.z, look: new THREE.Vector3(p1f.x, LEVELS.dcPlatform, p1f.z) },
    { x: p2.x, y: LEVELS.dcPlatform, z: p2.z, look: new THREE.Vector3(p2f.x, LEVELS.dcPlatform, p2f.z) },
  ];
}

/** Where crowd murmur is emitted from. */
export function murmurSpots() {
  const H = LEVELS.concourse; const a = dcToWorld(-20, 6.5), b = dcToWorld(-20, -6.5), c = dcToWorld(20, 6.5);
  return [
    [0, H + 1.5, -22], [28, H + 1.5, -12], [-30, H + 1.5, -8], [20, H + 1.5, 5],
    [24, LEVELS.interchangeEast + 1.5, -14], [-24, LEVELS.interchangeWest + 1.5, -6],
    [-20, LEVELS.jubUpper + 1.5, 2.5], [20, LEVELS.jubUpper + 1.5, 2.5], [-20, LEVELS.jubLower + 1.5, 2.5], [20, LEVELS.jubLower + 1.5, 2.5],
    [a.x, LEVELS.dcPlatform + 1.5, a.z], [b.x, LEVELS.dcPlatform + 1.5, b.z], [c.x, LEVELS.dcPlatform + 1.5, c.z],
    [0, 1.5, 2.5], [44, 1.5, 24.5], [75, 1.5, -3], [-24, 1.5, 3.5],
  ];
}
