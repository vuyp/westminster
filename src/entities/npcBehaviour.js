// ---------------------------------------------------------------------------
// npcBehaviour.js — navigation + locomotion for the passengers.
//
//  NavGraph            waypoint graph with directed edges and A*.
//  (buildDefaultGraph lives in npcGraph.js — the station graph derived only from layout.js)
//  attachEscalators    discovers every moving ramp registered in the collision world (whatever module built it)
//                      and adds one-way "ride" edges in the direction the steps travel.
//  validateGraph       drops default edges that have no floor beneath them / run through walls, so the
//                      graph adapts to whatever geometry actually exists (single module in the harness, or all).
//  mergeExternal       folds in graphs other modules register as ctx.register('nav:<area>', {nodes, edges}).
//  Agent               one passenger: path following, separation, player repulsion, wall resolve, floor snap,
//                      escalator riding (stand right / walk left), stairs, gait phase, idle fidgets, head look.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

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
      // nothing beneath (module not loaded here / stepped off a slab edge): step back, stop, and drift back towards the last waypoint we came from
      this.pos.x = prevX; this.pos.z = prevZ; this.vel.set(0, 0, 0); this.floor = null;
      const back = this.pathIdx > 0 ? this.path[this.pathIdx - 1] : null; if (back) { const bx = back.x - this.pos.x, bz = back.z - this.pos.z; const bd = Math.hypot(bx, bz) || 1; this.pos.x += bx / bd * 0.4 * dt; this.pos.z += bz / bd * 0.4 * dt; }
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
    const e = v.edge; const next = ids[i + 1] != null ? G.edge(ids[i], ids[i + 1]) : null;
    if (opts.jitter && (!e || e.kind === 'walk') && (!next || next.kind === 'walk') && !n.tags.has('escEntry') && !n.tags.has('escExit') && !n.tags.has('stairTop') && !n.tags.has('stairBottom') && !n.tags.has('passage')) {
      const jx = (opts.rng() - 0.5) * 2 * opts.jitter, jz = (opts.rng() - 0.5) * 2 * opts.jitter;
      // only jitter onto real floor (narrow slabs / passages keep people on the centreline)
      if (!opts.collision || opts.collision.floorAt(v.x + jx, v.z + jz, v.y + 0.5, { stepUp: 0.6, drop: 1.2 })) { v.x += jx; v.z += jz; }
    }
    pts.push(v);
  }
  return pts;
}
