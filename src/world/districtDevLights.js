// ---------------------------------------------------------------------------
// districtDevLights.js — DEV ONLY: stands in for the street module's sky /
// hemisphere light when the District platforms are rendered alone in the test
// harness (the harness only adds its own defaults when a module adds no light).
//   node test/screenshot.mjs --module world/districtPlatforms,world/districtDevLights ...
// Not loaded by main.js.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
export function build(ctx) {
  const g = new THREE.Group(); g.name = 'districtDevLights';
  g.add(new THREE.HemisphereLight(0xdfe6f0, 0x3a3835, 1.1));
  ctx.scene.add(g);
  return { group: g };
}
