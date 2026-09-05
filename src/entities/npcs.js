// ---------------------------------------------------------------------------
// npcs.js — the passengers and street pedestrians of Westminster.
//
// A pool of instanced humanoids (npcModel.js) driven by journeys over a waypoint
// graph (npcBehaviour.js). The graph is built lazily on the first update — after
// every world module has registered its floors, escalators, nav graphs and spawn
// points — and validated against the real collision world, so the crowd adapts
// to whatever geometry exists (one module in the harness, or the whole station).
//
//   ctx.register('npcs', { list, spawn(area), count, graph })
//
// Journeys: street wanderers (pavements, crossings, Big Ben photographs at Exit 1),
// enterers (street → stairs → hall → tap in → escalators/stairs → platform → wait → board),
// alighters spawned at train doorways on 'doorsOpen' (→ exits or interchange), riders
// standing inside stopped trains, and staff in hi-vis at fixed posts.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { LEVELS, TICKET_HALL } from '../core/layout.js';
import { STOCK_1996, STOCK_S7, doorPositions } from './trainSpec.js';
import { createNpcPool, randomAppearance } from './npcModel.js';
import { attachEscalators, mergeExternal, validateGraph, Agent, pathToWaypoints } from './npcBehaviour.js';
import { buildDefaultGraph, buildWaitSpots, onPlatform, staffPosts, murmurSpots, gateCrossing, gateCentre, GATELINE, BIG_BEN } from './npcGraph.js';
import { mulberry32 } from '../core/textures.js';

const CELL = 2.5;

class Population {
  constructor(ctx, { max = null, seed = 4242 } = {}) {
    this.ctx = ctx; this.rng = mulberry32(seed);
    this.max = max ?? (ctx.quality === 'low' ? 100 : 180);
    this.pool = createNpcPool(ctx, { max: this.max });
    this.agents = []; this.G = null; this.ready = false; this.time = 0; this.tick = 0; this.spawnT = 0; this.secT = 0;
    this.grid = new Map(); this.spots = {}; this.trainsHooked = false; this.riders = new Map(); this.timers = [];
    this.footstepAt = 0; this.murmur = []; this.gateWarned = false; this.stats = { spawned: 0, despawned: 0, boarded: 0, alighted: 0 };
    this.targets = ctx.quality === 'low' ? { street: 22, enter: 14, photo: 4, wait: { 4: 7, 3: 7, 1: 5, 2: 5 } } : { street: 46, enter: 30, photo: 8, wait: { 4: 14, 3: 13, 1: 10, 2: 10 } };
    this._registerSynths();
    this.api = { list: this.agents, spawn: area => this.spawnIn(area), get count() { return 0; }, graph: null, population: this, stats: this.stats };
    Object.defineProperty(this.api, 'count', { get: () => this.agents.length });
    Object.defineProperty(this.api, 'ready', { get: () => this.ready });
  }

  // ------------------------------------------------------------------ lazy init
  init() {
    const { ctx } = this; const collision = ctx.collision; const t0 = performance.now();
    const G = buildDefaultGraph();
    try { this.escalators = attachEscalators(G, collision); } catch (e) { console.warn('[npcs] attachEscalators', e); this.escalators = []; }
    try { const m = mergeExternal(G, ctx); if (m.merged) console.log(`[npcs] merged ${m.merged} external nav graph(s), ${m.ids.length} nodes`); } catch (e) { console.warn('[npcs] mergeExternal', e); }
    const v = validateGraph(G, collision);
    this.G = G; this.api.graph = G;
    const alive = G.nodes.filter(n => n.alive).length;
    console.log(`[npcs] nav graph: ${alive}/${G.nodes.length} nodes alive, ${v.dropped} edges dropped, ${this.escalators.length} escalator lanes`);
    this._buildWaitSpots();
    this.has = { street: G.withTag('street').length > 2, hall: G.withTag('hall').length > 3, box: G.withTag('box').length > 0 };
    for (const p of [1, 2, 3, 4]) this.has['platform' + p] = (this.spots[p] || []).length > 4 && G.withTag('platform' + p).length > 1;
    this._preseed();
    this.ready = true;
    console.log(`[npcs] ready: ${this.agents.length} passengers seeded in ${(performance.now() - t0).toFixed(0)} ms`);
  }

  /** A random point from a spawn list another module registered as ctx.register('spawn:<area>', [{x,y,z}]) — or null. */
  _extSpawn(area) {
    const list = this.ctx.get('spawn:' + area); if (!Array.isArray(list) || !list.length) return null;
    const s = list[Math.floor(this.rng() * list.length)]; if (!s || typeof s.x !== 'number') return null;
    return { x: s.x, y: s.y ?? 0, z: s.z };
  }

  _buildWaitSpots() {
    const { collision } = this.ctx;
    const ok = (x, y, z) => { const f = collision.floorAt(x, z, y + 0.6, { stepUp: 0.7, drop: 1.4 }); return f && Math.abs(f.y - y) < 0.35; };
    this.spots = buildWaitSpots(this.rng, ok);
  }

  _pickSpot(platform) {
    const list = (this.spots[platform] || []).filter(s => !s.agent); if (!list.length) return null;
    let total = 0; for (const s of list) total += s.w; let r = this.rng() * total; for (const s of list) { r -= s.w; if (r <= 0) return s; } return list[list.length - 1];
  }

  // ------------------------------------------------------------------ spawning helpers
  _make(x, y, z, appOpts = {}) {
    if (this.agents.length >= this.max) return null;
    const app = randomAppearance(this.rng, appOpts); const a = new Agent(this.pool, app, x, y, z, this.rng); if (a.slot < 0) return null;
    a.footstepCb = ag => this._footstep(ag); this.agents.push(a); this.stats.spawned++; return a;
  }
  _nodeAt(id) { const n = this.G.nodes[id]; return new THREE.Vector3(n.x, n.y, n.z); }
  _randomOf(tag) { const l = this.G.withTag(tag); return l.length ? l[Math.floor(this.rng() * l.length)] : -1; }
  _nearestNode(a) { return this.G.nearest(a.pos.x, a.pos.y, a.pos.z, { maxDist: 14, yTol: 1.6 }); }

  /** Route agent to node `to`; returns true if a path exists. Inserts the ticket-gate ritual where the route crosses the gateline. */
  _routeTo(a, to, { jitter = 0.7, reach = null } = {}) {
    const from = this._nearestNode(a); if (from < 0 || to < 0) return false;
    const seed = a.costSeed; const costMul = e => (e.kind === 'esc' ? 0.85 + ((seed * 7919 + e.from * 31) % 1) * 0.4 : 1);
    const ids = this.G.path(from, to, costMul); if (!ids) return false;
    let wps = pathToWaypoints(this.G, ids, { jitter, rng: this.rng, collision: this.ctx.collision });
    wps = this._insertGates(a, wps);
    if (reach != null && wps.length) { const last = wps[wps.length - 1]; last.meta = Object.assign({}, last.meta, { reach }); }
    a.setPath(wps); return wps.length > 0;
  }
  _insertGates(a, wps) {
    const out = []; const H = TICKET_HALL.floor;
    for (let i = 0; i < wps.length; i++) {
      const w = wps[i];
      if (i > 0) {
        const p = wps[i - 1];
        if (Math.abs(p.y - H) < 1 && Math.abs(w.y - H) < 1) {
          const c = gateCrossing(p.x, p.z, w.x, w.z);
          if (c) {
            let gi = c.gate; if (a.app.suitcase || a.app.child) gi = GATELINE.wide;
            const g = gateCentre(gi); const n = GATELINE.normal; const dir = c.dir;   // +1 entering the paid side
            const A = new THREE.Vector3(g.x - n.x * dir * 1.6, H, g.z - n.y * dir * 1.6); A.meta = { pause: 0.55 + this.rng() * 0.4, reach: 0.3, onReach: ag => this._tapGate(gi, ag, A), lookAt: new THREE.Vector3(g.x + n.x * dir * 6, H, g.z + n.y * dir * 6) };
            const B = new THREE.Vector3(g.x + n.x * dir * 1.6, H, g.z + n.y * dir * 1.6); B.meta = { skipWalls: true, reach: 0.35 };
            w.meta = Object.assign({}, w.meta, { skipWalls: false });
            out.push(A, B);
          }
        }
      }
      out.push(w);
    }
    return out;
  }
  _tapGate(gi, a, at) {
    const { ctx } = this; a.tapT = 0.45;
    try {
      const gates = ctx.get('gates'); let g = null;
      if (Array.isArray(gates)) g = gates[gi]; else if (gates && Array.isArray(gates.gates)) g = gates.gates[gi]; else if (gates && Array.isArray(gates.list)) g = gates.list[gi];
      if (g && typeof g.open === 'function') g.open({ npc: true, agent: a }); else if (gates && typeof gates.open === 'function') gates.open(gi, { npc: true });
      else if (gates && !this.gateWarned) { this.gateWarned = true; console.warn('[npcs] gates registered but no open() found', gates); }
    } catch (e) { if (!this.gateWarned) { this.gateWarned = true; console.warn('[npcs] gate open failed', e); } }
    const audio = ctx.audio; if (audio && audio.ready && this._listenerDist(at) < 30) audio.play('gateBeep', { position: at.clone().setY(at.y + 1), gain: 0.25, refDistance: 2, maxDistance: 25, params: { count: 1 } });
  }
  _listenerDist(p) { const pl = this.ctx.player && this.ctx.player.pos; return pl ? Math.hypot(pl.x - p.x, pl.y - p.y, pl.z - p.z) : 1e9; }

  // ------------------------------------------------------------------ journeys (plans are arrays of steps)
  /** Street wanderer: pavement end → end, maybe crossing the road, maybe a Big Ben photo. */
  planStreet(a) {
    const r = this.rng(); const plan = []; const has = t => this.G.withTag(t).length > 0;
    if (r < 0.3 && has('photo')) plan.push({ kind: 'goto', tags: this._photoTags() }, { kind: 'photo', seconds: 14 + this.rng() * 30 });
    else if (r < 0.38 && has('busStop')) plan.push({ kind: 'goto', tags: ['busStop'] }, { kind: 'linger', seconds: 25 + this.rng() * 60, look: new THREE.Vector3(20, 0, 8) });
    const ends = ['streetEndW', 'streetEndE', 'streetEndN', 'streetEndNW'].filter(has);
    plan.push({ kind: 'goto', tags: ends.length ? [ends[Math.floor(this.rng() * ends.length)]] : ['street'], far: true }, { kind: 'despawn' });
    a.role = 'street'; a.plan = plan; a.stepIdx = -1; this._advance(a);
  }
  /** Enterer: → entrance → hall (→ ticket machine) → platform → wait → board. */
  planEnter(a, platform = null) {
    const plan = [];
    if (!platform) { const cands = [3, 3, 3, 4, 4, 4, 1, 1, 2, 2].filter(p => this.has['platform' + p]); platform = cands.length ? cands[Math.floor(this.rng() * cands.length)] : null; }
    if (a.app.tourist && this.rng() < 0.35 && this.G.withTag('ticketMachine').length) plan.push({ kind: 'goto', tags: ['ticketMachine'] }, { kind: 'linger', seconds: 5 + this.rng() * 8, lookRel: new THREE.Vector3(-3, 0, 0), phone: false });
    if (platform) plan.push({ kind: 'wait', platform }); else plan.push({ kind: 'goto', tags: ['hall'] }, { kind: 'linger', seconds: 20 }, { kind: 'despawn' });
    a.role = 'enter'; a.plan = plan; a.stepIdx = -1; this._advance(a);
  }
  /** Alighter: from a doorway → exit (street) or interchange to another platform. */
  planExit(a, fromPlatform) {
    const plan = []; const r = this.rng();
    const others = [1, 2, 3, 4].filter(p => p !== fromPlatform && this.has['platform' + p] && ((p <= 2) !== (fromPlatform <= 2)));
    if (r < 0.28 && others.length) { plan.push({ kind: 'wait', platform: others[Math.floor(this.rng() * others.length)] }); a.role = 'enter'; }
    else {
      const tourist = a.app.tourist; const has = t => this.G.withTag(t).length > 0;
      // exit choice: Bridge Street (4) is the main one; tourists favour Exit 3 (Big Ben) and the Embankment (1/2); Whitehall (5/6) for the offices
      const choices = [['exit4', tourist ? 3 : 5], ['exit3', tourist ? 4 : 1.5], ['exit2', tourist ? 2 : 1.2], ['exit1', tourist ? 1.2 : 0.6], ['exit5', 1.2], ['exit6', 0.6]].filter(([t]) => t === 'exit4' ? has('entrance') : has(t));
      let total = 0; for (const c of choices) total += c[1]; let pick = choices.length ? choices[0][0] : null; let rr = this.rng() * total; for (const c of choices) { rr -= c[1]; if (rr <= 0) { pick = c[0]; break; } }
      if (pick === 'exit3' || pick === 'exit4' || pick === 'exit2') { if (has('photo') && this.rng() < (tourist ? 0.75 : 0.25)) plan.push({ kind: 'goto', tags: [pick === 'exit4' ? 'entrance' : pick], filter: n => n.tags.has('street') }, { kind: 'goto', tags: pick === 'exit2' ? this._photoTags() : ['photo'], near: true }, { kind: 'photo', seconds: 15 + this.rng() * 30 }); }
      else if (pick) plan.push({ kind: 'goto', tags: [pick], filter: n => n.tags.has('street') });
      const ends = ['streetEndW', 'streetEndE', 'streetEndN', 'streetEndNW'].filter(has);
      if (this.rng() < 0.12 && has('busStop')) plan.push({ kind: 'goto', tags: ['busStop'] }, { kind: 'linger', seconds: 20 + this.rng() * 50, look: new THREE.Vector3(20, 0, 8) });
      plan.push({ kind: 'goto', tags: ends.length ? [ends[Math.floor(this.rng() * ends.length)]] : (this.has.hall ? ['hall'] : ['box', 'dcPlatform']), far: true }, { kind: 'despawn' });
      a.role = 'exit';
    }
    a.plan = plan; a.stepIdx = -1; this._advance(a);
  }
  planStaff(a, post) { a.role = 'staff'; a.post = post; a.lookAt = post.look; a.plan = [{ kind: 'staff' }]; a.stepIdx = -1; a.state = 'staff'; this._advance(a); }

  /** Execute the next step of the plan. */
  _advance(a) {
    a.stepIdx++; const step = a.plan[a.stepIdx];
    if (!step) { if (a.plan.length === 1 && a.plan[0].kind === 'despawn') { a.state = 'despawn'; return; } a.plan = [{ kind: 'despawn' }]; a.stepIdx = -1; return this._advance(a); }
    a.step = step; a.stepT = 0; a.lookAt = null;
    switch (step.kind) {
      case 'goto': {
        let target = -1; const cands = [];
        for (const t of step.tags) for (const id of this.G.withTag(t)) if (!step.filter || step.filter(this.G.nodes[id])) cands.push(id);
        if (!cands.length) return this._advance(a);
        // prefer far targets for "leave the area" steps, random otherwise; try a few until a route exists
        const order = step.far ? cands.slice().sort((p, q) => this._dist(a, q) - this._dist(a, p)) : step.near ? cands.slice().sort((p, q) => this._dist(a, p) - this._dist(a, q)) : cands.slice().sort(() => this.rng() - 0.5);
        for (const id of order.slice(0, 4)) { if (this._routeTo(a, id)) { target = id; break; } }
        if (target < 0) { a.failed = (a.failed || 0) + 1; if (a.failed > 2) { a.plan = [{ kind: 'despawn' }]; a.stepIdx = -1; } return this._advance(a); }
        a.state = 'walk'; break;
      }
      case 'wait': {
        const spot = this._pickSpot(step.platform); if (!spot) { a.waitRetries = (a.waitRetries || 0) + 1; if (a.waitRetries > 6) { a.plan = [{ kind: 'despawn' }]; a.stepIdx = -1; return this._advance(a); } a.plan.splice(a.stepIdx, 0, { kind: 'linger', seconds: 4 + this.rng() * 4 }); a.stepIdx--; return this._advance(a); }
        // route to the platform node nearest the spot, then to the spot itself
        const near = this.G.nearest(spot.x, spot.y, spot.z, { maxDist: 40, yTol: 1, filter: n => n.tags.has('platform' + step.platform) });
        if (near < 0 || !this._routeTo(a, near)) { a.failed = (a.failed || 0) + 1; if (a.failed > 2) { a.plan = [{ kind: 'despawn' }]; a.stepIdx = -1; } return this._advance(a); }
        const sp = new THREE.Vector3(spot.x, spot.y, spot.z); sp.meta = { reach: 0.3, slow: 0.8 }; a.path.push(sp);
        spot.agent = a; a.waitSpot = spot; a.platform = step.platform; a.state = 'walk'; break;
      }
      case 'linger': case 'photo': { a.state = step.kind === 'photo' ? 'photo' : 'linger'; a.timer = step.seconds; if (step.look) a.lookAt = step.look; if (step.lookRel) a.lookAt = a.pos.clone().add(step.lookRel); if (step.kind === 'photo') { a.lookAt = BIG_BEN; a.nextFidget = 0.2; } break; }
      case 'staff': { a.state = 'staff'; a.timer = 8 + this.rng() * 20; break; }
      case 'despawn': { a.state = 'despawn'; break; }
      default: return this._advance(a);
    }
  }
  _dist(a, id) { const n = this.G.nodes[id]; return Math.hypot(n.x - a.pos.x, n.z - a.pos.z) + Math.abs(n.y - a.pos.y) * 3; }
  /** Photo spot tags: tourists gather on the river wall by Exit 1 / Boadicea (the full tower above the bridge corner) as much as at the foot of the tower. */
  _photoTags() { return this.G.withTag('photoExit1').length && this.rng() < 0.45 ? ['photoExit1'] : ['photo']; }

  /** Per-agent state progression (after movement). */
  _step(a, dt) {
    a.stepT += dt;
    switch (a.state) {
      case 'walk': case 'pause': {
        // stuck detection by displacement over time (instantaneous speed flickers at slab edges)
        if (!a.progPos) { a.progPos = a.pos.clone(); a.progT = 0; }
        a.progT += dt;
        if (a.progT > 1.6) {
          const moved = Math.hypot(a.pos.x - a.progPos.x, a.pos.z - a.progPos.z); a.progPos.copy(a.pos); a.progT = 0;
          if (a.state === 'walk' && !a.onEsc && moved < 0.35) {
            a.stuckCount = (a.stuckCount || 0) + 1;
            if (a.stuckCount > 4) { a.state = 'despawn'; break; }
            // skip the waypoint we cannot reach; when off the floor, try re-routing from the nearest node instead
            if (!a.floor && a.step && a.step.kind === 'goto' && a.stuckCount <= 2) { a.stepIdx--; this._advance(a); } else a._nextWaypoint(true);
          }
        }
        break;
      }
      case 'idle': {
        // arrived at the end of the path
        if (a.step && a.step.kind === 'wait' && a.waitSpot && Math.abs(a.pos.y - a.waitSpot.y) > 1.0) { this._releaseSpot(a); a.plan = [{ kind: 'despawn' }]; a.stepIdx = -1; this._advance(a); }   // arrived on the wrong level (geometry gap): give up quietly
        else if (a.step && a.step.kind === 'wait') { a.state = 'waiting'; a.lookAt = a.waitSpot ? a.waitSpot.face : null; a.user.tunnelYaw = a.waitSpot ? this._relYaw(a, a.waitSpot.tunnelYaw) : 0; a.user.indicatorYaw = (this.rng() < 0.5 ? -0.8 : 0.8); a.nextFidget = 0.5; a.timer = 0; }
        else if (a.step && a.step.kind === 'board') { this.stats.boarded++; a.state = 'despawn'; }
        else if (a.step && a.step.kind === 'alightOut') { this.planExit(a, a.step.platform); }
        else this._advance(a);
        break;
      }
      case 'waiting': {
        a.timer += dt;
        if (a.timer > 900) { this._releaseSpot(a); a.plan = [{ kind: 'despawn' }]; a.stepIdx = -1; this._advance(a); }   // never left behind forever
        break;
      }
      case 'linger': case 'photo': { a.timer -= dt; if (a.timer <= 0) this._advance(a); break; }
      case 'staff': {
        a.timer -= dt;
        if (a.timer <= 0) { a.timer = 12 + this.rng() * 25; if (this.rng() < 0.4) { const n = this.G.nearest(a.post.x + (this.rng() - 0.5) * 6, a.post.y, a.post.z + (this.rng() - 0.5) * 6, { maxDist: 5, yTol: 0.6 }); if (n >= 0 && this._routeTo(a, n, { jitter: 0.3 })) { const back = new THREE.Vector3(a.post.x, a.post.y, a.post.z); back.meta = { reach: 0.25 }; a.path.push(back); a.state = 'walk'; a.step = { kind: 'staffWalk' }; } } }
        break;
      }
      case 'despawn': { this._remove(a); break; }
    }
    if (a.state === 'idle' && a.step && a.step.kind === 'staffWalk') { a.state = 'staff'; a.lookAt = a.post.look; a.timer = 10 + this.rng() * 20; a.step = { kind: 'staff' }; }
  }
  _relYaw(a, absYaw) { let d = absYaw - a.heading; return Math.atan2(Math.sin(d), Math.cos(d)); }
  _releaseSpot(a) { if (a.waitSpot) { a.waitSpot.agent = null; a.waitSpot = null; } }
  _remove(a) { this._releaseSpot(a); const i = this.agents.indexOf(a); if (i >= 0) this.agents.splice(i, 1); a.dispose(); this.stats.despawned++; }

  // ------------------------------------------------------------------ pre-seeding & flow
  _preseed() {
    const T = this.targets;
    for (let i = 0; i < T.street * 0.7; i++) this._spawnStreet(true);
    for (let i = 0; i < T.enter * 0.6; i++) this._spawnEnterer(true);
    for (const p of [3, 4, 1, 2]) { if (!this.has['platform' + p]) continue; for (let i = 0; i < T.wait[p] * 0.8; i++) this._spawnWaiting(p); }
    this._spawnStaff();
    for (let i = 0; i < T.photo * 0.6; i++) this._spawnPhoto();
  }
  _spawnStreet(preseed = false) {
    const starts = ['streetEndW', 'streetEndE', 'streetEndN', 'streetEndNW'].map(t => this.G.withTag(t)).flat(); if (!starts.length) return null;
    const id = starts[Math.floor(this.rng() * starts.length)]; const n = this.G.nodes[id];
    const ext = this.rng() < 0.35 ? this._extSpawn('street') : null;
    const a = ext ? this._make(ext.x, ext.y, ext.z, { tourist: 0.45, child: 0.05 }) : this._make(n.x + (this.rng() - 0.5) * 2, n.y, n.z + (this.rng() - 0.5) * 1.5, { tourist: 0.45, child: 0.05 }); if (!a) return null;
    this.planStreet(a); if (preseed) this._skipAhead(a); return a;
  }
  _spawnEnterer(preseed = false) {
    let x, y, z;
    const starts = ['streetEndW', 'streetEndE', 'streetEndN', 'streetEndNW', 'exit3', 'exit2'].map(t => this.G.withTag(t)).flat().filter(id => this.G.nodes[id].tags.has('street'));
    const ext = this.rng() < 0.5 ? (this._extSpawn('street') || (this.rng() < 0.3 ? this._extSpawn('ticketHall') : null)) : null;   // other modules' spawn points (street doors, the lifts)
    if (ext) { x = ext.x; y = ext.y; z = ext.z; }
    else if (starts.length) { const n = this.G.nodes[starts[Math.floor(this.rng() * starts.length)]]; x = n.x + (this.rng() - 0.5) * 2; y = n.y; z = n.z; }
    else { const h = this.G.withTag('hall'); if (!h.length) return null; const n = this.G.nodes[h[Math.floor(this.rng() * h.length)]]; x = n.x; y = n.y; z = n.z; }
    const a = this._make(x, y, z, { tourist: 0.35, child: 0.04 }); if (!a) return null;
    this.planEnter(a); if (preseed) this._skipAhead(a); return a;
  }
  _spawnWaiting(platform) {
    const spot = this._pickSpot(platform); if (!spot) return null;
    const a = this._make(spot.x, spot.y, spot.z, { tourist: platform >= 3 ? 0.3 : 0.2 }); if (!a) return null;
    spot.agent = a; a.waitSpot = spot; a.platform = platform; a.role = 'enter'; a.plan = [{ kind: 'wait', platform }]; a.stepIdx = 0; a.step = a.plan[0]; a.state = 'idle'; a.heading = Math.atan2(spot.face.x - spot.x, spot.face.z - spot.z); a.headingTarget = a.heading; return a;
  }
  _spawnPhoto() {
    const ids = this.G.withTag(this._photoTags()[0]); if (!ids.length) return null; const n = this.G.nodes[ids[Math.floor(this.rng() * ids.length)]];
    const a = this._make(n.x + (this.rng() - 0.5) * 1.5, n.y, n.z + (this.rng() - 0.5) * 1, { tourist: 0.9 }); if (!a) return null;
    a.role = 'street'; a.plan = [{ kind: 'photo', seconds: 10 + this.rng() * 30 }, { kind: 'goto', tags: ['streetEndW', 'streetEndE', 'streetEndN'].filter(t => this.G.withTag(t).length), far: true }, { kind: 'despawn' }]; a.stepIdx = -1; this._advance(a); return a;
  }
  _spawnStaff() {
    for (const p of staffPosts()) { const f = this.ctx.collision.floorAt(p.x, p.z, p.y + 0.5, { stepUp: 0.6, drop: 1.2 }); if (!f || Math.abs(f.y - p.y) > 0.3) continue; const a = this._make(p.x, p.y, p.z, { staff: true }); if (!a) continue; a.heading = Math.atan2(p.look.x - p.x, p.look.z - p.z); a.headingTarget = a.heading; this.planStaff(a, p); }
  }
  /** Teleport a freshly planned walker part-way along its path so the station looks lived-in from frame one. */
  _skipAhead(a) {
    if (a.state !== 'walk' || a.path.length < 2) return;
    const k = Math.floor(this.rng() * (a.path.length - 1)); const p = a.path[k]; a.pos.set(p.x, p.y, p.z); a.pathIdx = k; a.waypoint = a.path[k + 1] || null; a.onEdge = a.waypoint ? (a.waypoint.edge || null) : null;
    if (a.waypoint && a.waypoint.meta && a.waypoint.meta.skipWalls != null) a.skipWalls = !!a.waypoint.meta.skipWalls;
    if (a.waypoint) { a.heading = a.headingTarget = Math.atan2(a.waypoint.x - a.pos.x, a.waypoint.z - a.pos.z); }
    if (!a.waypoint) a.state = 'idle';
  }
  spawnIn(area) {
    if (!this.ready) return null;
    switch (area) { case 'street': return this._spawnStreet(); case 'enter': case 'ticketHall': return this._spawnEnterer(); case 'photo': return this._spawnPhoto(); default: { const p = Number(String(area).replace(/\D/g, '')); if (p >= 1 && p <= 4) return this._spawnWaiting(p); return this._spawnStreet(); } }
  }
  _flow(dt) {
    this.spawnT -= dt; if (this.spawnT > 0) return; this.spawnT = 0.6 + this.rng() * 0.6;
    if (this.agents.length >= this.max - 2) return;
    const counts = { street: 0, enter: 0, photo: 0, wait: { 1: 0, 2: 0, 3: 0, 4: 0 } };
    for (const a of this.agents) { if (a.state === 'waiting' && a.platform) counts.wait[a.platform]++; else if (a.role === 'street') counts.street++; else if (a.role === 'enter') counts.enter++; if (a.state === 'photo') counts.photo++; }
    const T = this.targets; const wants = [];
    if (this.has.street && counts.street < T.street) wants.push(['street', (T.street - counts.street) / T.street]);
    if ((this.has.street || this.has.hall) && counts.enter < T.enter) wants.push(['enter', (T.enter - counts.enter) / T.enter * 1.2]);
    if (this.has.street && counts.photo < T.photo) wants.push(['photo', (T.photo - counts.photo) / T.photo * 0.5]);
    for (const p of [1, 2, 3, 4]) if (this.has['platform' + p] && counts.wait[p] < T.wait[p] * 0.6) wants.push(['wait' + p, 0.6]);
    if (!wants.length) return;
    let total = 0; for (const w of wants) total += w[1]; let r = this.rng() * total; let pick = wants[0][0]; for (const w of wants) { r -= w[1]; if (r <= 0) { pick = w[0]; break; } }
    if (pick === 'street') this._spawnStreet(); else if (pick === 'enter') this._spawnEnterer(); else if (pick === 'photo') this._spawnPhoto(); else this._spawnWaiting(Number(pick.slice(4)));
  }

  // ------------------------------------------------------------------ trains
  _hookTrains() {
    const svc = this.ctx.get('trainService'); if (!svc || !svc.on) return; this.trainsHooked = true;
    svc.on('stopped', e => { try { this._onStopped(e); } catch (err) { console.warn('[npcs] stopped', err); } });
    svc.on('doorsOpen', e => { try { this._onDoorsOpen(e); } catch (err) { console.warn('[npcs] doorsOpen', err); } });
    svc.on('doorsClosing', e => { try { this._onDoorsClosing(e); } catch (err) { console.warn('[npcs] doorsClosing', err); } });
    svc.on('departing', e => { try { this._onDeparting(e); } catch (err) { console.warn('[npcs] departing', err); } });
    svc.on('gone', e => { try { this._onGone(e); } catch (err) { console.warn('[npcs] gone', err); } });
    console.log('[npcs] hooked train service');
  }
  _specOf(e) { return (e.train && e.train.spec) || (String(e.track).startsWith('jubilee') ? STOCK_1996 : STOCK_S7); }
  _platY(e) { return e.track === 'jubileeUpper' ? LEVELS.jubUpper : e.track === 'jubileeLower' ? LEVELS.jubLower : LEVELS.dcPlatform; }
  /** Door approach / sill points on the platform side of a stopped train. */
  _doors(e) {
    const train = e.train; const spec = this._specOf(e); if (!train || !train.group) return [];
    train.group.updateMatrixWorld(true); const floorY = train.floorY ?? spec.floorHeight; const platY = this._platY(e);
    const out = []; const v = new THREE.Vector3();
    for (const d of doorPositions(spec)) {
      for (const side of [-1, 1]) {
        const p = train.group.localToWorld(v.set(side * (spec.width / 2 + 1.15), floorY, -d.s).clone());
        if (!onPlatform(e.track, e.platform, p.x, p.z)) continue;
        const sill = train.group.localToWorld(v.set(side * (spec.width / 2 - 0.5), floorY, -d.s).clone());
        const inside = train.group.localToWorld(v.set(side * (spec.width / 2 - 0.5) * 0.3, floorY, -d.s).clone());
        out.push({ approach: new THREE.Vector3(p.x, platY, p.z), sill: new THREE.Vector3(sill.x, platY, sill.z), inside: new THREE.Vector3(inside.x, platY, inside.z), s: d.s, side, boarders: 0, width: d.width });
      }
    }
    return out;
  }
  _onStopped(e) {
    // a few passengers already aboard, standing in the saloon (visible through the doors / for the player who boards)
    const train = e.train; if (!train || !train.group || this.riders.has(train)) return;
    const spec = this._specOf(e); const list = []; const n = Math.min(10, 3 + Math.floor(this.rng() * 8)); const L = spec.carLength.reduce((a, b) => a + b, 0);
    for (let i = 0; i < n; i++) {
      const local = new THREE.Vector3((this.rng() - 0.5) * 0.7, train.floorY ?? spec.floorHeight, (this.rng() - 0.5) * (L - 6));
      const a = this._make(0, 0, 0, { tourist: 0.2 }); if (!a) break; a.role = 'rider'; a.state = 'rider'; a.train = train; a.local = local; a.localYaw = this.rng() * Math.PI * 2; a.lookAt = null; a.plan = [{ kind: 'rider' }]; a.stepIdx = 0; a.step = a.plan[0]; a.skipWalls = true;
      list.push(a);
    }
    this.riders.set(train, list);
  }
  _onDoorsOpen(e) {
    const doors = this._doors(e); if (!doors.length) return; const platform = e.platform; const platY = this._platY(e);
    // ---- alighters: appear inside each doorway over the first seconds and walk out
    const load = 0.9 + this.rng() * 1.4;
    let delay = 0.6;
    for (const d of doors) {
      const k = Math.min(4, Math.floor(this.rng() * load + this.rng() * load * 0.7));
      for (let j = 0; j < k; j++) {
        const at = delay + j * (0.9 + this.rng() * 0.5);
        this.timers.push({ at: this.time + at, fn: () => {
          if (this.agents.length >= this.max - 3) return;
          const a = this._make(d.inside.x, platY, d.inside.z, { tourist: platform >= 3 ? 0.3 : 0.2 }); if (!a) return;
          a.skipWalls = true; a.role = 'exit'; a.platform = platform; this.stats.alighted++;
          const out = d.approach.clone().addScaledVector(new THREE.Vector3(d.approach.x - d.sill.x, 0, d.approach.z - d.sill.z).normalize(), 0.8 + this.rng() * 0.8); out.meta = { skipWalls: false, reach: 0.4 };
          const sill = d.sill.clone(); sill.meta = { reach: 0.3 };
          a.heading = a.headingTarget = Math.atan2(out.x - a.pos.x, out.z - a.pos.z);
          a.setPath([sill, out]); a.plan = [{ kind: 'alightOut', platform }]; a.stepIdx = 0; a.step = a.plan[0];
        } });
      }
      delay += 0.15;
    }
    // riders near a door step off too
    const riders = this.riders.get(e.train) || [];
    for (const a of riders.slice()) { const door = doors.find(d => Math.abs(-d.s - a.local.z) < 2.2); if (!door || this.rng() < 0.4) continue; a.train = null; a.local = null; a.pos.set(door.inside.x, platY, door.inside.z); const out = door.approach.clone(); out.meta = { skipWalls: false, reach: 0.4 }; const sill = door.sill.clone(); sill.meta = { reach: 0.3 }; a.setPath([sill, out]); a.plan = [{ kind: 'alightOut', platform }]; a.stepIdx = 0; a.step = a.plan[0]; a.role = 'exit'; riders.splice(riders.indexOf(a), 1); }
    // ---- boarders: waiting passengers on this platform walk to the nearest doorway (after the alighters have had a moment)
    const waiting = this.agents.filter(a => a.state === 'waiting' && a.platform === platform);
    for (const a of waiting) {
      if (this.rng() > 0.88) continue;
      let best = null, bd = Infinity; for (const d of doors) { if (d.boarders >= 6) continue; const dd = Math.hypot(d.approach.x - a.pos.x, d.approach.z - a.pos.z); if (dd < bd) { bd = dd; best = d; } }
      if (!best || bd > 60) continue; best.boarders++;
      const dl = 2.2 + this.rng() * 3 + bd * 0.05;
      this.timers.push({ at: this.time + dl, fn: () => {
        if (a.dead || a.state !== 'waiting') return; this._releaseSpot(a);
        const ap = best.approach.clone(); ap.x += (this.rng() - 0.5) * 0.5; ap.z += (this.rng() - 0.5) * 0.5; ap.meta = { reach: 0.45 };
        const sill = best.sill.clone(); sill.meta = { skipWalls: true, reach: 0.3 }; const inside = best.inside.clone(); inside.meta = { reach: 0.35 };
        a.setPath([ap, sill, inside]); a.plan = [{ kind: 'board' }]; a.stepIdx = 0; a.step = a.plan[0]; a.boardingTrain = e.train; a.lookAt = null;
      } });
    }
  }
  _onDoorsClosing(e) {
    // anyone still more than a couple of metres from the doors misses this train and goes back to waiting
    for (const a of this.agents) {
      if (a.boardingTrain !== e.train) continue;
      const last = a.path[a.path.length - 1]; const d = last ? Math.hypot(last.x - a.pos.x, last.z - a.pos.z) : 0;
      if (d > 2.6) { a.boardingTrain = null; a.skipWalls = false; a.plan = [{ kind: 'wait', platform: a.platform }]; a.stepIdx = -1; this._advance(a); }
    }
  }
  _onDeparting(e) { for (const a of this.agents) if (a.boardingTrain === e.train) { this._remove(a); } }
  _onGone(e) { const riders = this.riders.get(e.train); if (riders) { for (const a of riders) this._remove(a); this.riders.delete(e.train); } }
  _updateRiders() {
    const q = new THREE.Quaternion(), eu = new THREE.Euler();
    for (const [train, list] of this.riders) {
      if (!train.group.parent) { for (const a of list) this._remove(a); this.riders.delete(train); continue; }
      train.group.getWorldQuaternion(q); eu.setFromQuaternion(q, 'YXZ');
      for (const a of list) { if (a.dead) continue; a.pos.copy(train.group.localToWorld(a.local.clone())); a.pos.y = train.group.position.y + (train.floorY ?? 0.66); a.heading = a.localYaw + eu.y; a.idleT += 1 / 60; a.stride *= 0.9; }
    }
  }

  // ------------------------------------------------------------------ audio
  _registerSynths() {
    const audio = this.ctx.audio; if (!audio || !audio.registerSynth) return;
    // crowd murmur: three slowly modulated bands of pink-ish noise (chatter, shuffling), level-controlled
    audio.registerSynth('npc:murmur', (c, { level = 0.2 } = {}) => {
      const out = c.createGain(); out.gain.value = level;
      const len = c.sampleRate * 2; const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0); let b0 = 0, b1 = 0, seed = 7;
      for (let i = 0; i < len; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; const w = seed / 4294967296 * 2 - 1; b0 = 0.98 * b0 + w * 0.06; b1 = 0.90 * b1 + w * 0.2; d[i] = (b0 * 3 + b1) * 0.5; }
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      const bands = [[320, 1.0, 0.31], [640, 1.6, 0.53], [1250, 2.0, 0.23]].map(([f, Q, rate]) => { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = Q; const g = c.createGain(); g.gain.value = 0.5; const lfo = c.createOscillator(); lfo.frequency.value = rate; const lg = c.createGain(); lg.gain.value = 0.35; lfo.connect(lg); lg.connect(g.gain); src.connect(bp); bp.connect(g); g.connect(out); return lfo; });
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; out.disconnect(); out.connect(lp);
      return { output: lp, start() { src.start(); bands.forEach(l => l.start()); }, stop() { try { src.stop(); bands.forEach(l => l.stop()); } catch (e) {} }, set(k, v) { if (k === 'level') out.gain.setTargetAtTime(v, c.currentTime, 0.5); } };
    });
    const spots = murmurSpots();
    for (const [x, y, z] of spots) { try { const em = audio.emitter({ position: new THREE.Vector3(x, y, z), synth: 'npc:murmur', params: { level: 0.2 }, gain: 0.0, refDistance: 4, maxDistance: 30, rolloff: 1.2 }); this.murmur.push({ em, pos: new THREE.Vector3(x, y, z) }); } catch (e) { console.warn('[npcs] murmur emitter', e); } }
  }
  _updateMurmur() {
    for (const m of this.murmur) { let n = 0; for (const a of this.agents) { if (Math.abs(a.pos.y - m.pos.y) > 3) continue; const d = Math.hypot(a.pos.x - m.pos.x, a.pos.z - m.pos.z); if (d < 14) n++; } m.em.setGain(Math.min(0.45, n * 0.035), 0.8); }
  }
  _footstep(a) {
    const audio = this.ctx.audio; if (!audio || !audio.ready) return; const pl = this.ctx.player && this.ctx.player.pos; if (!pl) return;
    const d = Math.hypot(pl.x - a.pos.x, pl.y - a.pos.y, pl.z - a.pos.z); if (d > 6) return;
    const now = performance.now(); if (now - this.footstepAt < 90) return; this.footstepAt = now;
    audio.play('footstep', { position: a.pos.clone(), gain: 0.09 + this.rng() * 0.06, refDistance: 1.5, maxDistance: 8, params: { surface: (a.floor && a.floor.sound) || 'hard', run: false } });
  }

  // ------------------------------------------------------------------ main update
  update(dt) {
    if (!this.ready) { try { this.init(); } catch (e) { console.error('[npcs] init failed', e); this.ready = true; this.G = this.G || buildDefaultGraph(); } }
    dt = Math.min(dt, 0.1); this.time += dt; this.tick++;
    if (!this.trainsHooked) this._hookTrains();
    if (this.timers.length) { const due = this.timers.filter(t => t.at <= this.time); if (due.length) { this.timers = this.timers.filter(t => t.at > this.time); for (const t of due) { try { t.fn(); } catch (e) { console.warn('[npcs] timer', e); } } } }
    this._flow(dt);
    // spatial hash for separation
    const grid = this.grid; grid.clear();
    for (const a of this.agents) { const k = Math.floor(a.pos.x / CELL) + ',' + Math.floor(a.pos.z / CELL); let c = grid.get(k); if (!c) { c = []; grid.set(k, c); } c.push(a); }
    const pl = this.ctx.player && this.ctx.player.pos; const cam = this.ctx.camera; const ref = pl || (cam && cam.position) || new THREE.Vector3();
    const world = { collision: this.ctx.collision, player: pl, agentsNear: null };
    const near = [];
    for (const a of this.agents.slice()) {
      if (a.dead) continue;
      if (a.train) continue;
      const d = Math.hypot(a.pos.x - ref.x, a.pos.z - ref.z) + Math.abs(a.pos.y - ref.y) * 1.5;
      const rate = d < 30 ? 1 : d < 70 ? 2 : d < 140 ? 4 : 8; const farCull = d > 220;
      a.accum += dt; if ((this.tick + a.id) % rate !== 0) continue;
      near.length = 0; const cx = Math.floor(a.pos.x / CELL), cz = Math.floor(a.pos.z / CELL);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const c = grid.get((cx + i) + ',' + (cz + j)); if (c) for (const o of c) near.push(o); }
      world.agentsNear = near;
      const step = Math.min(a.accum, 0.25); a.accum = 0;
      a.update(step, world); this._step(a, step); if (!farCull) a.render(); else if (!a.hidden) { a.hidden = true; this.pool.hide(a.slot); }
      if (farCull) continue; if (a.hidden) a.hidden = false;
    }
    this._updateRiders(); for (const [, list] of this.riders) for (const a of list) if (!a.dead) a.render();
    this.pool.flush();
    this.secT += dt; if (this.secT > 1) { this.secT = 0; this._updateMurmur(); if (!this.trainsHooked) this._hookTrains(); this._lateMerge(); }
  }

  /** Every few seconds fold in nav graphs registered after we started (dev modules, late builders); only the new nodes are validated. */
  _lateMerge() {
    this.mergeT = (this.mergeT || 0) + 1; if (this.mergeT < 5 || !this.G) return; this.mergeT = 0;
    try {
      const m = mergeExternal(this.G, this.ctx); if (!m.merged) return;
      const v = validateGraph(this.G, this.ctx.collision, { only: new Set(m.ids) });
      console.log(`[npcs] late-merged ${m.merged} nav graph(s): ${m.ids.length} nodes, ${v.killed} without floor, ${v.dropped} edges dropped`);
      this._buildWaitSpots();
    } catch (e) { console.warn('[npcs] late merge', e); }
  }
}

export function build(ctx) {
  const pop = new Population(ctx);
  ctx.onUpdate(dt => pop.update(dt));
  ctx.register('npcs', pop.api);
  return { group: pop.pool.group, npcs: pop.api, population: pop };
}
