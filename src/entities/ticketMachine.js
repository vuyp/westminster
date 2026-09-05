// ---------------------------------------------------------------------------
// ticketMachine.js — TfL ticket machine (dossier §4.4): Corporate Blue fascia with a
// white Johnston 'Tickets' header and roundel, c. 15" touch-screen at 1.2–1.4 m with a
// yellow Oyster reader pad beside it, card / coin / note slots on the right, ticket and
// change trays at c. 0.9 m, brushed-stainless lower skirt; c. 0.75 m wide × 2.0 m tall,
// flush in the wall. Interactive: "E — touch the screen" plays a touch-screen beep.
//
//   createTicketMachine(ctx, { x, y, z, facing, parent, S, signMat, mats })  → { group, position }
// `facing` is the direction the fascia points ('east' for a machine in the west wall).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { Merger } from '../world/ticketHallKit.js';

export function createTicketMachine(ctx, { x, y, z, facing = 'east', parent, S, signMat, mats, width = 0.75, height = 2.0, cash = true }) {
  const rot = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }[facing] ?? 0;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; parent.add(g);   // local +z = out of the wall (towards the passenger)
  const m = new Merger(g);
  const D = 0.12;   // how far the fascia stands proud of the wall face
  // body (mostly inside the wall recess) + stainless skirt + blue fascia
  m.box(mats.stainless, width, 0.55, D + 0.3, { x: 0, y: 0.275, z: -0.15 + D / 2 }, false);
  m.box(mats.blue, width, height - 0.55, D + 0.3, { x: 0, y: 0.55 + (height - 0.55) / 2, z: -0.15 + D / 2 }, false);
  m.box(mats.stainless, width + 0.06, height + 0.03, 0.02, { x: 0, y: height / 2, z: -0.29 + 0.0 }, false);   // recess surround (flush with the wall face)
  // header 'Tickets' + roundel
  m.quad(signMat(S.ticketsHeader(), { emissive: 0.6 }), width - 0.06, 0.13, { x: 0, y: height - 0.12, z: D + 0.002 });
  // touch screen (15", tilted back ~15°) at 1.25 m centre, black bezel
  m.box(mats.black, 0.4, 0.31, 0.03, { x: -0.13, y: 1.27, z: D + 0.005, rx: -0.26 }, false);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.255), signMat(S.machineScreen(), { emissive: 1.5 })); screen.position.set(-0.13, 1.27 + 0.004, D + 0.023); screen.rotation.x = -0.26; g.add(screen);
  // yellow Oyster reader pad beside the screen (raised black housing, yellow disc on top)
  m.box(mats.black, 0.16, 0.05, 0.16, { x: 0.24, y: 1.08, z: D + 0.02, rx: -0.5 }, false);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.055, 24), signMat(S.oysterDisc(), { emissive: 0.9, transparent: true })); disc.position.set(0.24, 1.105, D + 0.045); disc.rotation.x = -Math.PI / 2 + 0.5 - 0.0; g.add(disc);
  m.quad(signMat(S.touchHere(), { emissive: 0.5 }), 0.22, 0.07, { x: 0.24, y: 1.2, z: D + 0.002 });
  // right-hand column: card reader (chip & PIN), coin slot, note slot
  m.box(mats.black, 0.16, 0.1, 0.04, { x: 0.24, y: 1.45, z: D + 0.01 }, false); m.quad(signMat(S.cardSlot(), { emissive: 0.4 }), 0.15, 0.055, { x: 0.24, y: 1.53, z: D + 0.002 });
  m.box(mats.stainless, 0.06, 0.008, 0.02, { x: 0.24, y: 1.44, z: D + 0.03 }, false);
  m.box(mats.black, 0.14, 0.03, 0.03, { x: 0.24, y: 0.98, z: D + 0.01 }, false); m.box(mats.stainless, 0.08, 0.006, 0.02, { x: 0.24, y: 0.99, z: D + 0.02 }, false);   // note slot
  m.cyl(mats.black, 0.02, 0.02, 0.03, 10, { x: 0.3, y: 0.9, z: D + 0.01, rx: Math.PI / 2 });   // coin slot
  m.quad(signMat(S.coinsNotes(), { emissive: 0.4 }), 0.16, 0.06, { x: 0.24, y: 0.93, z: D + 0.002 });
  // PIN pad (stainless keys)
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) m.box(mats.stainless, 0.02, 0.015, 0.008, { x: -0.3 + c * 0.028, y: 1.12 - r * 0.02, z: D + 0.005 }, false);
  // ticket / receipt tray and change tray at c. 0.9 m; stainless lip
  m.box(mats.black, 0.28, 0.12, 0.06, { x: -0.13, y: 0.86, z: D - 0.01 }, false); m.box(mats.stainless, 0.3, 0.012, 0.08, { x: -0.13, y: 0.8, z: D + 0.02 }, false);
  m.box(mats.black, 0.16, 0.12, 0.06, { x: 0.24, y: 0.7, z: D - 0.01 }, false); m.box(mats.stainless, 0.18, 0.012, 0.08, { x: 0.24, y: 0.64, z: D + 0.02 }, false);
  // small camera dome + 'CCTV' label, contactless mark
  m.cyl(mats.black, 0.015, 0.015, 0.01, 8, { x: -0.3, y: height - 0.3, z: D + 0.005, rx: Math.PI / 2 });
  m.flush({ name: 'ticketMachine' });

  const position = new THREE.Vector3(x, y, z);
  ctx.interactive(g, {
    prompt: 'E — touch the screen', distance: 2.0,
    onInteract() { const a = ctx.audio; if (a && a.ready) a.play('gateBeep', { position: position.clone().setY(y + 1.3), gain: 0.3, refDistance: 1.5, maxDistance: 12, params: { freq: 1240, dur: 0.07, count: 1 } }); if (ctx.hud && ctx.hud.notice) ctx.hud.notice('Contactless payment cards are accepted at the gates — no ticket needed.', 3); },
  });
  return { group: g, position };
}
