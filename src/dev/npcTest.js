// Dev: a flat floor + a stair ramp + one escalator bank (layout.ESCALATORS[0]) and 40 NPCs walking a loop:
// upper floor → escalator down → lower floor → stairs back up → upper floor. The scene is built relative to the
// escalator's own run direction so it works for any bank in the layout.
//   node test/screenshot.mjs --module dev/npcTest --advance 25 --views "..." --outdir /tmp/shots/npcTest
import * as THREE from 'three';
import { createEscalator } from '../entities/escalator.js';
import { ESCALATORS } from '../core/layout.js';
import { createNpcPool, randomAppearance } from '../entities/npcModel.js';
import { NavGraph, attachEscalators, validateGraph, Agent, pathToWaypoints } from '../entities/npcBehaviour.js';
import { mulberry32 } from '../core/textures.js';

export function build(ctx) {
  const { M, scene, collision, floorPlane } = ctx;
  const e = ESCALATORS[0]; const top = new THREE.Vector3(e.top.x, e.top.y, e.top.z), bot = new THREE.Vector3(e.bottom.x, e.bottom.y, e.bottom.z);
  const d = new THREE.Vector3(bot.x - top.x, 0, bot.z - top.z).normalize();       // downhill direction in plan
  const side = new THREE.Vector3(-d.z, 0, d.x);                                   // perpendicular
  const P = (o, along, across, y) => new THREE.Vector3(o.x + d.x * along + side.x * across, y, o.z + d.z * along + side.z * across);
  const rect = (pts) => ({ xMin: Math.min(...pts.map(p => p.x)), xMax: Math.max(...pts.map(p => p.x)), zMin: Math.min(...pts.map(p => p.z)), zMax: Math.max(...pts.map(p => p.z)) });
  const slab = (r, y) => { scene.add(floorPlane(r.xMax - r.xMin, r.zMax - r.zMin, M.granite(), { x: (r.xMin + r.xMax) / 2, y, z: (r.zMin + r.zMax) / 2 })); collision.addFloor({ ...r, y }); };
  // upper floor ends at the top comb (the escalator registers its own landing plates); lower floor starts at the bottom comb
  slab(rect([P(top, -0.3, -14, top.y), P(top, -20, 14, top.y)]), top.y);
  slab(rect([P(bot, 0.3, -14, bot.y), P(bot, 22, 14, bot.y)]), bot.y);
  const esc = createEscalator(ctx, { top: e.top, bottom: e.bottom, dir: e.dir, lanes: e.lanes, name: 'esc-' + e.name });
  // a straight stair 10 m to the side of the bank, parallel to it, climbing back from the lower floor to the upper floor
  const sa = P(bot, 4, 10, bot.y), sb = P(top, -4, 10, top.y);
  collision.addRamp(sa, sb, 3.0, { sound: 'stairs', tag: 'stairs' });
  const riser = 0.16, n = Math.round((sb.y - sa.y) / riser); const len = Math.hypot(sb.x - sa.x, sb.z - sa.z);
  const stepMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(3.0, riser, len / n + 0.02), M.precast(), n); const m = new THREE.Matrix4(); const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(sb.x - sa.x, sb.z - sa.z), 0));
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; m.compose(new THREE.Vector3(sa.x + (sb.x - sa.x) * t, sa.y + (sb.y - sa.y) * t, sa.z + (sb.z - sa.z) * t), q, new THREE.Vector3(1, 1, 1)); stepMesh.setMatrixAt(i, m); }
  stepMesh.receiveShadow = true; scene.add(stepMesh);
  for (const s of [-1, 1]) { const a = P(sa, 0, s * 1.6, 0), b = P(sb, 0, s * 1.6, 0); collision.addWall(a.x, a.z, b.x, b.z, bot.y, top.y + 1.2, 0.2, 'stairwall'); }
  // lights
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(top.x - 30, top.y + 30, top.z + 20); sun.target.position.copy(bot); scene.add(sun.target); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 150 }); scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xdde6ff, 0x444444, 1.3));

  // ---- nav loop
  const G = new NavGraph();
  const u1 = G.add(...P(top, -12, -6, top.y).toArray(), ['upper']), u2 = G.add(...P(top, -8, 0, top.y).toArray(), ['upper']), u3 = G.add(...P(top, -12, 8, top.y).toArray(), ['upper']);
  const l1 = G.add(...P(bot, 12, -6, bot.y).toArray(), ['lower']), l2 = G.add(...P(bot, 8, 0, bot.y).toArray(), ['lower']), l3 = G.add(...P(bot, 12, 8, bot.y).toArray(), ['lower']);
  const stB = G.add(...P(sa, 1.5, 0, bot.y).toArray(), ['stairBottom']), stT = G.add(...P(sb, -1.5, 0, top.y).toArray(), ['stairTop']);
  G.link(u1, u2); G.link(u2, u3); G.link(u3, u1); G.link(l1, l2); G.link(l2, l3); G.link(l1, l3);
  G.link(l3, stB); G.link(stB, stT, { kind: 'stairs', oneWay: true }); G.link(stT, u3); G.link(stT, u2);
  const lanes = attachEscalators(G, collision);
  validateGraph(G, collision);
  console.log('[npcTest] escalator lanes found:', lanes.length, 'graph nodes:', G.nodes.filter(n => n.alive).length);

  // ---- 40 NPCs on the loop
  const pool = createNpcPool(ctx, { max: 48 }); const rng = mulberry32(11); const agents = [];
  const loop = [u1, u2, l2, l1, l3, stB, stT, u3, u1];
  for (let i = 0; i < 40; i++) {
    const app = randomAppearance(rng, { tourist: 0.3, staff: i === 0 });
    const start = loop[i % (loop.length - 1)]; const nn = G.nodes[start];
    const a = new Agent(pool, app, nn.x + (rng() - 0.5) * 4, nn.y, nn.z + (rng() - 0.5) * 4, rng); a.loopIdx = i % (loop.length - 1); agents.push(a);
  }
  const route = a => { const from = G.nearest(a.pos.x, a.pos.y, a.pos.z, { maxDist: 30, yTol: 2 }); a.loopIdx = (a.loopIdx + 1) % loop.length; if (a.loopIdx === 0) a.loopIdx = 1; const ids = G.path(from, loop[a.loopIdx]); if (!ids) { a.loopIdx = 0; return; } a.setPath(pathToWaypoints(G, ids, { jitter: 1.0, rng })); };
  agents.forEach(route);
  const CELL = 2.5; const grid = new Map(); const near = [];
  ctx.onUpdate(dt => {
    dt = Math.min(dt, 0.1); grid.clear();
    for (const a of agents) { const k = Math.floor(a.pos.x / CELL) + ',' + Math.floor(a.pos.z / CELL); let c = grid.get(k); if (!c) { c = []; grid.set(k, c); } c.push(a); }
    for (const a of agents) {
      near.length = 0; const cx = Math.floor(a.pos.x / CELL), cz = Math.floor(a.pos.z / CELL);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const c = grid.get((cx + i) + ',' + (cz + j)); if (c) for (const o of c) near.push(o); }
      a.update(dt, { collision, player: ctx.player && ctx.player.pos, agentsNear: near });
      if (a.state === 'idle') route(a);
      a.render();
    }
    pool.flush();
  });
  // handy camera anchors for screenshots (printed once)
  console.log('[npcTest] top', top.toArray().map(v => v.toFixed(1)).join(','), 'bottom', bot.toArray().map(v => v.toFixed(1)).join(','), 'stairs', sa.toArray().map(v => v.toFixed(1)).join(','), '->', sb.toArray().map(v => v.toFixed(1)).join(','));
  return { esc, pool, agents, graph: G };
}
