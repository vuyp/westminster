import * as THREE from 'three';
import { createEscalator } from '../entities/escalator.js';
import { ESCALATORS } from '../core/layout.js';
export function build(ctx) {
  const { M, scene, collision, floorPlane } = ctx;
  const e = ESCALATORS[0];
  const esc = createEscalator(ctx, { top: e.top, bottom: e.bottom, dir: e.dir, lanes: e.lanes, name: 'esc-A' });
  // landings: flat floors beyond each comb (bank a runs east→west)
  scene.add(floorPlane(12, 30, M.granite(), { x: e.top.x + 6, y: e.top.y, z: e.top.z }));
  scene.add(floorPlane(12, 30, M.granite(), { x: e.bottom.x - 6, y: e.bottom.y, z: e.bottom.z }));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(-10, 20, -70); scene.add(sun); scene.add(new THREE.HemisphereLight(0xdde6ff, 0x333333, 1.2));
  return { esc };
}
