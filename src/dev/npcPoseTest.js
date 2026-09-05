// Dev: a line-up of NPC models in walk-cycle phases and idle poses, to eyeball proportions and the gait.
import * as THREE from 'three';
import { createNpcPool, randomAppearance } from '../entities/npcModel.js';
import { mulberry32 } from '../core/textures.js';
export function build(ctx) {
  const { M, scene, collision, floorPlane } = ctx;
  scene.add(floorPlane(40, 20, M.granite(), { y: 0, z: 0 })); collision.addFloor({ xMin: -20, xMax: 20, zMin: -10, zMax: 10, y: 0 });
  const pool = createNpcPool(ctx, { max: 40 });
  const rng = mulberry32(3);
  const slots = [];
  // row 1: one walker frozen at 8 phases of the cycle
  for (let k = 0; k < 8; k++) { const a = randomAppearance(rng, { tourist: 0 }); a.height = 1.75; const s = pool.alloc(a); slots.push({ s, x: -7 + k * 2, z: 2, phase: k * Math.PI / 4, stride: 1 }); }
  // row 2: idle, phone, photographing, suitcase pulling, staff, tourist w/ backpack, child
  const kinds = [{}, { phoneUp: 1 }, { phoneHigh: 1 }, { suitcase: 1, stride: 1, phase: 1 }, { staff: true }, { tourist: 1 }, { child: 1 }, { hood: true }];
  kinds.forEach((k, i) => { const a = randomAppearance(rng, { tourist: k.tourist ? 1 : 0, staff: !!k.staff, child: k.child ? 1 : 0 }); if (k.suitcase) a.suitcase = true; if (k.phoneUp || k.phoneHigh) a.phone = true; if (k.hood) a.hood = true; const s = pool.alloc(a); slots.push({ s, x: -7 + i * 2, z: -2, phase: k.phase || 0, stride: k.stride || 0, phoneUp: k.phoneUp || 0, phoneHigh: k.phoneHigh || 0, suitcase: k.suitcase || 0 }); });
  let t = 0;
  ctx.onUpdate(dt => { t += dt; for (const p of slots) pool.pose(p.s, { x: p.x, y: 0, z: p.z, heading: 0, phase: p.phase, stride: p.stride, idle: t, phoneUp: p.phoneUp, phoneHigh: p.phoneHigh, suitcase: p.suitcase }); pool.flush(); });
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(6, 14, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -14; sun.shadow.camera.right = 14; sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14; scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xdde6ff, 0x444444, 1.1));
  return { pool };
}
