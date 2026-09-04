// Dev: platforms as plain slabs + the train service, to check trains stop where the platforms are.
import * as THREE from 'three';
import { LEVELS, JUBILEE, DISTRICT } from '../core/layout.js';
import { build as buildService } from '../systems/trainService.js';
export async function build(ctx) {
  const { M, scene, collision, floorPlane } = ctx;
  // Jubilee platforms (both levels) + District platforms
  for (const y of [LEVELS.jubUpper, LEVELS.jubLower]) { const w = JUBILEE.platformXMax - JUBILEE.platformXMin; const f = floorPlane(w, JUBILEE.zMax - JUBILEE.zMin, M.granite(), { x: (JUBILEE.platformXMin + JUBILEE.platformXMax) / 2, y, z: (JUBILEE.zMin + JUBILEE.zMax) / 2 }); scene.add(f); collision.addFloor({ xMin: JUBILEE.platformXMin, xMax: JUBILEE.platformXMax, zMin: JUBILEE.zMin, zMax: JUBILEE.zMax, y }); }
  for (const p of Object.values(DISTRICT.platforms)) { const f = floorPlane(DISTRICT.xMax - DISTRICT.xMin, p.zMax - p.zMin, M.granite(), { x: (DISTRICT.xMin + DISTRICT.xMax) / 2, y: LEVELS.dcPlatform, z: (p.zMin + p.zMax) / 2 }); scene.add(f); collision.addFloor({ xMin: DISTRICT.xMin, xMax: DISTRICT.xMax, zMin: p.zMin, zMax: p.zMax, y: LEVELS.dcPlatform }); }
  // marker posts at platform centres
  const mk = (x, y, z, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), M.paint(c)); m.position.set(x, y + 1.5, z); scene.add(m); };
  mk(-36, LEVELS.jubUpper, -79.5, 0xff0000); mk(-9, LEVELS.dcPlatform, 5.5, 0xff0000); mk(-9, LEVELS.dcPlatform, 18.5, 0x00ff00);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));
  const svc = await buildService(ctx);
  // speed the clock: make trains appear sooner for the test
  for (const line of Object.values(svc.lines)) { line.queue.forEach((q, i) => q.at = 2 + i * 60); }
  return { svc };
}
