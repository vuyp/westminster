// Dev: the WHOLE station as bare slabs/ramps straight from layout.js (street, stairs, hall, gateline housings,
// escalators A/B/C, box walkways, platforms) + the train service + the real NPC module — an integration test for
// journeys, gates, escalators, waiting, boarding and alighting before the world modules exist.
//   node test/screenshot.mjs --module dev/npcStationTest --advance 60 --views "hall:0,-4.5,-10:-10,-6,-30" --outdir /tmp/shots/st
import * as THREE from 'three';
import { LEVELS, STREET, TICKET_HALL, DISTRICT, JUBILEE, ESCALATORS, BOX_WALKWAYS } from '../core/layout.js';
import { createEscalator } from '../entities/escalator.js';
import { build as buildService } from '../systems/trainService.js';
import { build as buildNpcs } from '../entities/npcs.js';

export async function build(ctx) {
  const { M, scene, collision, floorPlane } = ctx;
  const slab = (r, y, mat) => { scene.add(floorPlane(r.xMax - r.xMin, r.zMax - r.zMin, mat, { x: (r.xMin + r.xMax) / 2, y, z: (r.zMin + r.zMax) / 2 })); collision.addFloor({ xMin: r.xMin, xMax: r.xMax, zMin: r.zMin, zMax: r.zMax, y, sound: mat === M.paving() ? 'pavement' : 'hard' }); };
  const stairRamp = (a, b, width, tag) => { collision.addRamp(a, b, width, { sound: 'stairs', tag }); const n = Math.round(Math.abs(b.y - a.y) / 0.16); const im = new THREE.InstancedMesh(new THREE.BoxGeometry(width, 0.16, Math.hypot(b.x - a.x, b.z - a.z) / n + 0.02), M.precast(), n); const m = new THREE.Matrix4(); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; m.makeTranslation(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t); im.setMatrixAt(i, m); } scene.add(im); };
  // ---- street: pavements + road (flat) + a stub of the Embankment pavement
  slab({ xMin: STREET.bridgeStreetX.min, xMax: STREET.bridgeStreetX.max, zMin: STREET.pavementNorth.zMin, zMax: STREET.pavementNorth.zMax }, 0, M.paving());
  slab({ xMin: STREET.bridgeStreetX.min, xMax: STREET.bridgeStreetX.max, zMin: STREET.road.zMin, zMax: STREET.road.zMax }, -0.12, M.tarmac());
  slab({ xMin: STREET.bridgeStreetX.min, xMax: STREET.bridgeStreetX.max, zMin: STREET.pavementSouth.zMin, zMax: STREET.pavementSouth.zMax }, 0, M.paving());
  slab({ xMin: 30, xMax: 40, zMin: -30, zMax: -2 }, 0, M.paving());
  // ---- main stairs (well cut into the north pavement) and the hall
  const ms = TICKET_HALL.mainStairs; stairRamp(new THREE.Vector3(0, ms.yTop, ms.zTop), new THREE.Vector3(0, ms.yBottom, ms.zBottom), ms.xMax - ms.xMin, 'mainStairs');
  const hallOpening = TICKET_HALL.boxOverlook;
  for (const r of [{ xMin: TICKET_HALL.xMin, xMax: TICKET_HALL.xMax, zMin: hallOpening.zMax, zMax: TICKET_HALL.zMax }, { xMin: hallOpening.xMax, xMax: TICKET_HALL.xMax, zMin: TICKET_HALL.zMin, zMax: hallOpening.zMax }, { xMin: TICKET_HALL.xMin, xMax: hallOpening.xMin, zMin: TICKET_HALL.zMin, zMax: hallOpening.zMax }]) slab(r, LEVELS.ticketHall, M.granite());
  const e1 = TICKET_HALL.exit1Stairs; stairRamp(new THREE.Vector3(6, e1.yBottom, e1.zBottom), new THREE.Vector3(6, e1.yTop, e1.zTop), e1.xMax - e1.xMin, 'exit1');
  const em = TICKET_HALL.embankmentStairs; stairRamp(new THREE.Vector3(em.xMax + 0.5, em.yTop, em.zTop), new THREE.Vector3(em.xMin - 2, em.yBottom, em.zBottom), 4, 'embankment'); slab({ xMin: TICKET_HALL.xMax, xMax: em.xMin - 2, zMin: em.zTop - 2.5, zMax: em.zTop + 2.5 }, LEVELS.ticketHall, M.granite());
  // gateline: housings as blockers with 0.6 m openings between them (paddles omitted — gates module not present here)
  const g = TICKET_HALL.gateline; const pitch = (g.xMax - g.xMin) / g.gates;
  for (let i = 0; i <= g.gates; i++) { const x = g.xMin + i * pitch; const w = i === 0 || i === g.gates ? 0.3 : pitch - (i === 1 ? 0.9 : 0.6); const cx = i === 0 ? x + 0.15 : i === g.gates ? x - 0.15 : x; collision.addBlocker({ xMin: cx - w / 2, xMax: cx + w / 2, yMin: LEVELS.ticketHall, yMax: LEVELS.ticketHall + 1.1, zMin: g.z - 0.9, zMax: g.z + 0.9 }, 'gate'); const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, 1.8), M.stainless()); mesh.position.set(cx, LEVELS.ticketHall + 0.55, g.z); scene.add(mesh); }
  collision.addWall(g.xMin, g.z, TICKET_HALL.xMin, g.z, LEVELS.ticketHall, LEVELS.ticketHall + 2.2, 0.3, 'fence'); collision.addWall(g.xMax, g.z, TICKET_HALL.xMax, g.z, LEVELS.ticketHall, LEVELS.ticketHall + 2.2, 0.3, 'fence');
  // ---- District stairs + platforms
  for (const st of TICKET_HALL.dcStairs) stairRamp(new THREE.Vector3((st.xMin + st.xMax) / 2, st.yTop ?? LEVELS.ticketHall, st.zTop), new THREE.Vector3((st.xMin + st.xMax) / 2, LEVELS.dcPlatform, st.zBottom), st.xMax - st.xMin, 'dcStairs');
  for (const p of Object.values(DISTRICT.platforms)) slab({ xMin: DISTRICT.xMin, xMax: DISTRICT.xMax, zMin: p.zMin, zMax: p.zMax }, LEVELS.dcPlatform, M.granite());
  // ---- Jubilee box walkways, escalators and platforms
  for (const w of BOX_WALKWAYS) slab(w, w.y, M.granite());
  for (const e of ESCALATORS) createEscalator(ctx, { top: e.top, bottom: e.bottom, dir: e.dir, lanes: e.lanes, name: 'esc-' + e.name });
  for (const y of [LEVELS.jubUpper, LEVELS.jubLower]) slab({ xMin: JUBILEE.platformXMin, xMax: JUBILEE.platformXMax, zMin: JUBILEE.zMin, zMax: JUBILEE.zMax }, y, M.granite());
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(20, 40, 30); scene.add(sun);
  // ---- train service with trains arriving soon, then the NPCs
  const svc = await buildService(ctx);
  for (const line of Object.values(svc.lines)) { line.queue.forEach((q, i) => q.at = 5 + i * 70 + (line.platform % 2) * 30); }
  const npcs = buildNpcs(ctx);
  return { svc, npcs, population: npcs.population, agents: npcs.population.agents };
}
