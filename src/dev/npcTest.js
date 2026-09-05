// Dev: a flat floor + a stair ramp + one escalator bank (layout.ESCALATORS[0]) and ~40 NPCs walking a loop:
// hall floor → escalator A down → lower floor → stairs back up → hall floor. Use --wait 6000 (or --advance) to let them move.
//   node test/screenshot.mjs --module dev/npcTest --wait 6000 --views "top:-6,-3,-40:-16,-8,-60;esc:-12,-8,-70:-16,-16,-70" --outdir /tmp/shots/npcTest
import * as THREE from 'three';
import { createEscalator } from '../entities/escalator.js';
import { ESCALATORS, LEVELS } from '../core/layout.js';
import { createNpcPool, randomAppearance } from '../entities/npcModel.js';
import { NavGraph, attachEscalators, validateGraph, Agent, pathToWaypoints } from '../entities/npcBehaviour.js';
import { mulberry32 } from '../core/textures.js';

export function build(ctx) {
  const { M, scene, collision, floorPlane } = ctx;
  const e = ESCALATORS[0];  // top (-16, hall, -52) → bottom (-16, upper, -86.6), down
  const top = e.top, bot = e.bottom;
  // upper floor (hall level) and lower floor (upper Jubilee level)
  const upperFloor = { xMin: top.x - 14, xMax: top.x + 14, zMin: top.z + 0.3, zMax: top.z + 18, y: top.y };   // ends at the comb line: the escalator registers its own landing plates
  const lowerFloor = { xMin: bot.x - 14, xMax: bot.x + 14, zMin: bot.z - 20, zMax: bot.z - 0.3, y: bot.y };
  for (const f of [upperFloor, lowerFloor]) { scene.add(floorPlane(f.xMax - f.xMin, f.zMax - f.zMin, M.granite(), { x: (f.xMin + f.xMax) / 2, y: f.y, z: (f.zMin + f.zMax) / 2 })); collision.addFloor(f); }
  const esc = createEscalator(ctx, { top, bottom: bot, dir: e.dir, lanes: e.lanes, name: 'esc-A' });
  // a straight stair on the east side, from the lower floor back up to the upper floor (rise 20 m over 34.6 m: same 30°)
  const sx = top.x + 10; const sa = new THREE.Vector3(sx, bot.y, bot.z - 4), sb = new THREE.Vector3(sx, top.y, top.z + 4);
  collision.addRamp(sa, sb, 3.0, { sound: 'stairs', tag: 'stairs' });
  // visible steps for the stair (instanced boxes)
  const riser = 0.16, n = Math.round((sb.y - sa.y) / riser); const tread = (sb.z - sa.z) / n;
  const stepMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(3.0, riser, Math.abs(tread) + 0.02), M.precast(), n); const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { m.makeTranslation(sx, sa.y + (i + 0.5) * riser, sa.z + (i + 0.5) * tread); stepMesh.setMatrixAt(i, m); } stepMesh.receiveShadow = true; scene.add(stepMesh);
  for (const side of [-1, 1]) collision.addWall(sx + side * 1.6, sa.z, sx + side * 1.6, sb.z, bot.y, top.y + 1.2, 0.2, 'stairwall');
  // lights
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-30, 30, -90); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 150 }); scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xdde6ff, 0x444444, 1.3));

  // ---- nav loop: upper floor → esc entry → esc exit → lower floor → stair bottom → stair top → upper floor
  const G = new NavGraph();
  const u1 = G.add(top.x - 6, top.y, top.z + 12, ['upper']), u2 = G.add(top.x, top.y, top.z + 8, ['upper']), u3 = G.add(top.x + 8, top.y, top.z + 12, ['upper']);
  const l1 = G.add(bot.x - 6, bot.y, bot.z - 12, ['lower']), l2 = G.add(bot.x, bot.y, bot.z - 8, ['lower']), l3 = G.add(bot.x + 8, bot.y, bot.z - 12, ['lower']);
  const stB = G.add(sx, bot.y, sa.z - 1.5, ['stairBottom']), stT = G.add(sx, top.y, sb.z + 1.5, ['stairTop']);
  G.link(u1, u2); G.link(u2, u3); G.link(u3, u1); G.link(l1, l2); G.link(l2, l3); G.link(l1, l3);
  G.link(l3, stB); G.link(stB, stT, { kind: 'stairs', oneWay: true }); G.link(stT, u3); G.link(stT, u2);
  const lanes = attachEscalators(G, collision);   // entry nodes get linked to u2/u1/u3 (within 7 m), exits to l2 etc.
  validateGraph(G, collision);
  console.log('[npcTest] escalator lanes found:', lanes.length, 'graph nodes:', G.nodes.filter(n => n.alive).length);

  // ---- 40 NPCs on the loop
  const pool = createNpcPool(ctx, { max: 48 }); const rng = mulberry32(11); const agents = [];
  const loop = [u1, u2, l2, l1, l3, stB, stT, u3, u1];   // via A* between consecutive anchors so they use escalator lanes and the stairs
  for (let i = 0; i < 40; i++) {
    const app = randomAppearance(rng, { tourist: 0.3, staff: i === 0 });
    const start = loop[i % (loop.length - 1)]; const n = G.nodes[start];
    const a = new Agent(pool, app, n.x + (rng() - 0.5) * 4, n.y, n.z + (rng() - 0.5) * 4, rng); a.loopIdx = i % (loop.length - 1); agents.push(a);
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
  return { esc, pool, agents, graph: G };
}
