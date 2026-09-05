// Dev: the WHOLE station (layout v2) as bare slabs/ramps straight from layout.js — pavements, subway strip, concourse,
// passages, gateline housings, D&C stairs + rotated platforms, interchange E/W, all seven escalator banks, wells,
// passages, both Jubilee platforms — plus the train service and the real NPC module. An integration test for journeys,
// gates, escalators, waiting, boarding and alighting before the world modules exist.
//   node test/screenshot.mjs --module dev/npcStationTest --advance 60 --views "hall:0,-2,-18:20,-3,-10" --outdir /tmp/shots/st
import * as THREE from 'three';
import { LEVELS, STREET, TICKET_HALL, DISTRICT, JUBILEE, ESCALATORS, BOX_WALKWAYS, dcToWorld } from '../core/layout.js';
import { createEscalator } from '../entities/escalator.js';
import { build as buildService } from '../systems/trainService.js';
import { build as buildNpcs } from '../entities/npcs.js';

export async function build(ctx) {
  const { M, scene, collision, floorPlane } = ctx;
  const slab = (r, y, mat, sound = 'hard') => { scene.add(floorPlane(r.xMax - r.xMin, r.zMax - r.zMin, mat, { x: (r.xMin + r.xMax) / 2, y, z: (r.zMin + r.zMax) / 2 })); collision.addFloor({ xMin: r.xMin, xMax: r.xMax, zMin: r.zMin, zMax: r.zMax, y, sound }); };
  /** flat or sloped strip between two points (rotated slabs = flat ramps) with a visible mesh */
  const strip = (a, b, width, { sound = 'hard', mat = M.granite(), steps = false, tag = 'strip' } = {}) => {
    collision.addRamp(a, b, width, { sound, tag });
    const len = Math.hypot(b.x - a.x, b.z - a.z); const yaw = Math.atan2(b.x - a.x, b.z - a.z); const rise = b.y - a.y;
    if (!steps) { const g = new THREE.PlaneGeometry(width, Math.hypot(len, rise)); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, mat); m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); m.rotation.order = 'YXZ'; m.rotation.y = yaw; m.rotation.x = -Math.atan2(rise, len); scene.add(m); return; }
    const n = Math.max(2, Math.round(Math.abs(rise) / 0.16)); const im = new THREE.InstancedMesh(new THREE.BoxGeometry(width, 0.16, len / n + 0.02), M.precast(), n); const mm = new THREE.Matrix4(); const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; mm.compose(new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, mm); } scene.add(im);
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // ---- street: pavements, road, Embankment corner, riverside, Parliament Street footways, bridge footways
  slab({ xMin: STREET.bridgeStreetX.min - 32, xMax: 48, zMin: STREET.pavementNorth.zMin, zMax: STREET.pavementNorth.zMax }, 0, M.paving(), 'pavement');
  slab({ xMin: STREET.bridgeStreetX.min - 32, xMax: 84, zMin: STREET.road.zMin, zMax: STREET.road.zMax }, -0.12, M.tarmac(), 'pavement');
  slab({ xMin: STREET.bridgeStreetX.min - 32, xMax: 84, zMin: STREET.pavementSouth.zMin, zMax: STREET.pavementSouth.zMax + 5 }, 0, M.paving(), 'pavement');
  slab({ xMin: STREET.embankmentPavementWest.xMin, xMax: STREET.embankmentPavementWest.xMax, zMin: -70, zMax: 5 }, 0, M.paving(), 'pavement');
  slab({ xMin: STREET.embankmentRoad.xMin, xMax: STREET.embankmentRoad.xMax, zMin: -70, zMax: 5 }, -0.12, M.tarmac(), 'pavement');
  slab({ xMin: STREET.riversidePavement.xMin, xMax: STREET.riversidePavement.xMax, zMin: -80, zMax: 5 }, 0, M.paving(), 'pavement');
  slab({ xMin: 84, xMax: 110, zMin: 0, zMax: 26 }, 0.4, M.paving(), 'pavement');
  slab({ xMin: STREET.parliamentStreet.eastFootway[0], xMax: STREET.parliamentStreet.eastFootway[1], zMin: -60, zMax: 5 }, 0, M.paving(), 'pavement');
  slab({ xMin: STREET.parliamentStreet.westFootway[0], xMax: STREET.parliamentStreet.westFootway[1], zMin: -60, zMax: 5 }, 0, M.paving(), 'pavement');
  // ---- Exit 4: passage + 16 steps north into the concourse; the concourse polygon (as a rectangle); subway strip + passages
  const ms = TICKET_HALL.mainStairs, ep = TICKET_HALL.entrancePassage;
  slab({ xMin: ep.xMin, xMax: ep.xMax, zMin: ep.zMin, zMax: ep.zMax }, 0, M.granite());
  strip(V(0, ms.yTop, ms.zTop), V(0, ms.yBottom, ms.zBottom), ms.xMax - ms.xMin, { sound: 'stairs', steps: true, tag: 'mainStairs' });
  const H = LEVELS.concourse;
  slab({ xMin: TICKET_HALL.xMin, xMax: TICKET_HALL.xMax, zMin: TICKET_HALL.zMin, zMax: TICKET_HALL.zMax }, H, M.granite());
  const e3 = TICKET_HALL.exit3Passage; slab({ xMin: e3.xMin, xMax: e3.xMax, zMin: TICKET_HALL.zMax, zMax: e3.zTo }, H, M.tiles());
  strip(V((e3.xMin + e3.xMax) / 2, H, e3.zTo - 0.5), V((e3.xMin + e3.xMax) / 2, 0, e3.stairsTop[1] + 1), e3.xMax - e3.xMin, { sound: 'stairs', steps: true, tag: 'exit3' });
  const emb = TICKET_HALL.embankmentPassage; strip(V(emb.xFrom, H, (emb.zMin + emb.zMax) / 2), V(emb.xFrom + 3, H - 0.7, (emb.zMin + emb.zMax) / 2), emb.zMax - emb.zMin, { sound: 'stairs', steps: true, tag: 'embSteps' });
  slab({ xMin: emb.xFrom + 3, xMax: emb.xTo + 2, zMin: emb.zMin, zMax: emb.zMax }, H - 0.7, M.tiles());
  strip(V(STREET.exit2.x, H - 0.7, emb.zMin), V(STREET.exit2.x, 0, STREET.exit2.z + 3), 4, { sound: 'stairs', steps: true, tag: 'exit2' });
  slab({ xMin: STREET.exit1.x - 6, xMax: STREET.exit1.x - 2, zMin: STREET.exit1.z - 2, zMax: emb.zMin }, H - 0.7, M.tiles());
  strip(V(STREET.exit1.x - 4, H - 0.7, STREET.exit1.z - 1), V(STREET.exit1.x, 0, STREET.exit1.z - 3.5), 3, { sound: 'stairs', steps: true, tag: 'exit1' });
  const wh = TICKET_HALL.whitehallPassage; slab({ xMin: STREET.exit6.x - 1, xMax: wh.xFrom, zMin: wh.zMin, zMax: wh.zMax }, H, M.tiles());
  strip(V(STREET.exit5.x + 1, H, wh.zMin), V(STREET.exit5.x + 1, 0, STREET.exit5.z + 3.5), 3, { sound: 'stairs', steps: true, tag: 'exit5' });
  strip(V(STREET.exit6.x + 2, H, wh.zMin), V(STREET.exit6.x + 2, 0, STREET.exit6.z + 3.5), 3, { sound: 'stairs', steps: true, tag: 'exit6' });
  // gateline: 15 housings along the NW–SE line with 0.6 m aisles (paddles omitted: the gates module is not present here)
  const g = TICKET_HALL.gateline; const from = new THREE.Vector2(...g.from), to = new THREE.Vector2(...g.to); const dir = to.clone().sub(from); const len = dir.length(); dir.divideScalar(len); const pitch = len / g.gates;
  for (let i = 0; i <= g.gates; i++) {
    const d = i * pitch; const cx = from.x + dir.x * d, cz = from.y + dir.y * d; const w = (i === 0 || i === g.gates) ? 0.4 : pitch - (i === 1 ? 0.95 : 0.6);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 1.05, 1.9), M.stainless()); mesh.position.set(cx, H + 0.525, cz); mesh.rotation.y = -Math.atan2(dir.y, dir.x); scene.add(mesh);
    collision.addBlocker(mesh, 'gate');
  }
  // ---- District & Circle: rotated platforms as flat strips, stairs, recesses
  const DCY = LEVELS.dcPlatform;
  for (const p of Object.values(DISTRICT.platforms)) { const t = (p.tMin + p.tMax) / 2; const a = dcToWorld(DISTRICT.sMin, t), b = dcToWorld(DISTRICT.sMax, t); strip(V(a.x, DCY, a.z), V(b.x, DCY, b.z), p.tMax - p.tMin, { mat: M.granite(), tag: 'dcPlatform' + p.number }); }
  { const w = DISTRICT.platforms[1].wideWestEnd; const t = (DISTRICT.platforms[1].tMax + w.tMax) / 2; const a = dcToWorld(w.sMin, t), b = dcToWorld(w.sMax, t); strip(V(a.x, DCY, a.z), V(b.x, DCY, b.z), w.tMax - DISTRICT.platforms[1].tMax + 0.4, { tag: 'p1wide' }); }
  for (const r of DISTRICT.platforms[2].recesses) { const t = (DISTRICT.platforms[2].tMin + r.tMin) / 2; const a = dcToWorld(r.sMin, t), b = dcToWorld(r.sMax, t); strip(V(a.x, DCY, a.z), V(b.x, DCY, b.z), DISTRICT.platforms[2].tMin - r.tMin + 0.4, { tag: 'p2recess' }); }
  for (const st of DISTRICT.stairs) { const t = (st.tMin + st.tMax) / 2; const a = dcToWorld(st.sTop, t), b = dcToWorld(st.sBottom, t); strip(V(a.x, H, a.z), V(b.x, DCY, b.z), st.tMax - st.tMin, { sound: 'stairs', steps: true, tag: 'dcStairs' + st.platform }); }
  // ---- box walkways (interchange + wells), passages, escalators, Jubilee platforms
  for (const w of BOX_WALKWAYS) { if (w.publicAccess === false) continue; slab(w, w.y, M.stainless()); }
  for (const y of [LEVELS.jubUpper, LEVELS.jubLower]) { for (const p of JUBILEE.passages) slab({ xMin: p.x - p.width / 2, xMax: p.x + p.width / 2, zMin: JUBILEE.box.zMax - 0.5, zMax: JUBILEE.platformZMin + 0.5 }, y, M.tiles()); slab({ xMin: JUBILEE.xMin, xMax: JUBILEE.xMax, zMin: JUBILEE.platformZMin, zMax: JUBILEE.pedZ }, y, M.granite()); }
  for (const e of ESCALATORS) createEscalator(ctx, { top: e.top, bottom: e.bottom, dir: e.dir, lanes: e.lanes, name: 'esc-' + e.name });
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(20, 40, 30); scene.add(sun);
  // ---- train service with trains arriving soon, then the NPCs
  const svc = await buildService(ctx);
  for (const line of Object.values(svc.lines)) { line.queue.forEach((q, i) => q.at = 5 + i * 70 + (line.platform % 2) * 30); }
  const npcs = buildNpcs(ctx);
  return { svc, npcs, population: npcs.population, agents: npcs.population.agents };
}
