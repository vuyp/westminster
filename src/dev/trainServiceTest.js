// Dev: platforms as plain slabs + the train service, to check trains stop where the platforms are.
import * as THREE from 'three';
import { LEVELS, JUBILEE, DISTRICT, dcToWorld, DC_YAW } from '../core/layout.js';
import { build as buildService } from '../systems/trainService.js';
export async function build(ctx) {
  const { M, scene, collision, floorPlane } = ctx;
  // Jubilee platforms (both levels): along x, between the back wall and the PED line
  for (const y of [LEVELS.jubUpper, LEVELS.jubLower]) {
    const w = JUBILEE.pedZ - JUBILEE.platformZMin; const f = floorPlane(JUBILEE.xMax - JUBILEE.xMin, w, M.granite(), { x: 0, y, z: (JUBILEE.platformZMin + JUBILEE.pedZ) / 2 }); scene.add(f);
    collision.addFloor({ xMin: JUBILEE.xMin, xMax: JUBILEE.xMax, zMin: JUBILEE.platformZMin, zMax: JUBILEE.pedZ, y });
  }
  // District platforms: rotated slabs in the local frame (s along, t across). Register as many small flat floors (axis-aligned approximation).
  for (const p of Object.values(DISTRICT.platforms)) {
    const len = DISTRICT.sMax - DISTRICT.sMin, wid = p.tMax - p.tMin; const c = dcToWorld((DISTRICT.sMin + DISTRICT.sMax) / 2, (p.tMin + p.tMax) / 2);
    const g = new THREE.PlaneGeometry(wid, len); g.rotateX(-Math.PI / 2); const mesh = new THREE.Mesh(g, M.granite()); mesh.position.set(c.x, LEVELS.dcPlatform, c.z); mesh.rotation.y = DC_YAW; scene.add(mesh);
    for (let s = DISTRICT.sMin; s < DISTRICT.sMax; s += 2) { const q = dcToWorld(s + 1, (p.tMin + p.tMax) / 2); collision.addFloor({ xMin: q.x - 2.2, xMax: q.x + 2.2, zMin: q.z - 2.2, zMax: q.z + 2.2, y: LEVELS.dcPlatform }); }
  }
  const mk = (x, y, z, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), M.paint(c)); m.position.set(x, y + 1.5, z); scene.add(m); };
  mk(0, LEVELS.jubUpper, 2.5, 0xff0000); const c1 = dcToWorld(0, 6.2), c2 = dcToWorld(0, -6.2); mk(c1.x, LEVELS.dcPlatform, c1.z, 0xff0000); mk(c2.x, LEVELS.dcPlatform, c2.z, 0x00ff00);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));
  const svc = await buildService(ctx);
  for (const line of Object.values(svc.lines)) { line.queue.forEach((q, i) => q.at = 2 + i * 60); }
  return { svc };
}
