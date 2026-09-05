// ---------------------------------------------------------------------------
// ticketHallDevLights.js — DEV ONLY: stands in for the street module's sky /
// hemisphere light when the ticket hall is rendered alone in the test harness
// (the harness adds its own defaults only when a module adds no light at all).
//   node test/screenshot.mjs --module world/ticketHall,world/ticketHallDevLights ...
// Not loaded by main.js.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
export function build(ctx) {
  const g = new THREE.Group(); g.name = 'ticketHallDevLights';
  g.add(new THREE.HemisphereLight(0xe8eef6, 0x3b3936, 0.9));
  ctx.scene.add(g);
  return { group: g };
}
