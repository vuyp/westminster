// ---------------------------------------------------------------------------
// street/bridge.js — Westminster Bridge (Thomas Page / Charles Barry, 1862): 250 × 26 m, seven segmental
// cast-iron arches on granite piers with cutwaters, painted Commons green, gilt shields on the spandrels,
// the pierced Gothic parapets with trefoil tracery on a granite plinth, the 1862 octagonal lamp standards
// over every pier and at mid-span, the post-2017 dark-grey hostile-vehicle barriers along both kerbs, the
// humped deck profile (0.4 m crown), the South Bank Lion at the far end, and Boadicea and Her Daughters
// on its granite plinth at the Embankment corner. Dossier §11.5–11.6.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { Merger, Instancer, makeMaterials, COL, signMat, spandrelGeometry, archRibGeometry, latheGeo, figureGeometry, scaleUV, hex, mulberry } from './kit.js';

export function buildBridge(ctx, group, plan, state) {
  const { layout, collision, T } = ctx; const mats = makeMaterials(ctx); const S = layout.STREET; const B = S.bridge;
  const M = new Merger(group, 'bridge'); const I = new Instancer(group);
  const blk = (r, tag) => collision.addBlocker(r, tag);
  const X0 = B.xMin, X1 = B.xMax, Z0 = B.zMin, Z1 = B.zMax, L = X1 - X0, SPAN = L / B.arches, PIER_W = 3.6;
  const RAMP = 22;   // metres over which the deck rises to its crown
  const deckY = (x) => { const t = Math.min(1, Math.max(0, Math.min(x - X0, X1 - x) / RAMP)); return B.deck * (t * t * (3 - 2 * t)); };
  state.deckY = deckY;
  const KERB = plan.KERB, ROAD_Z0 = plan.bridgeRoad.zMin, ROAD_Z1 = plan.bridgeRoad.zMax;

  // ================================================================ deck: carriageway + footways as ribbons following the profile
  const ribbon = (mat, zMin, zMax, dy, step = 5) => {
    const pos = [], uv = [], idx = []; let k = 0;
    for (let x = X0; x <= X1 + 0.01; x += step) { const xx = Math.min(x, X1); const y = deckY(xx) + dy; pos.push(xx, y, zMin, xx, y, zMax); uv.push(xx, zMin, xx, zMax); if (k > 0) { const b = (k - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } k++; }   // wound so the normals face UP
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); M.add(mat, g);
  };
  M.chunk('deck');
  ribbon(mats.tarmac, ROAD_Z0, ROAD_Z1, -KERB); ribbon(mats.paving, Z0, ROAD_Z0, 0); ribbon(mats.paving, ROAD_Z1, Z1, 0);
  // kerbs, deck slab (green iron fascia), markings
  for (let x = X0; x < X1; x += 5) { const xm = x + 2.5, y = deckY(xm); M.box(mats.kerb, 5.02, 0.17, 0.3, { x: xm, y: y - 0.08, z: ROAD_Z0 + 0.15 }); M.box(mats.kerb, 5.02, 0.17, 0.3, { x: xm, y: y - 0.08, z: ROAD_Z1 - 0.15 }); M.box(mats.ironGreen, 5.05, 0.7, Z1 - Z0 + 1.0, { x: xm, y: y - 0.85, z: (Z0 + Z1) / 2 }); }   // the green deck fascia stays 0.35 m below the tarmac (no z-fighting at distance)
  const MY = -KERB + 0.004;
  for (let x = X0 + 2; x < X1 - 2; x += 6) M.box(mats.whiteLine, 4, 0.006, 0.1, { x: x + 2, y: deckY(x + 2) + MY, z: (ROAD_Z0 + ROAD_Z1) / 2 });
  for (let x = X0 + 2; x < X1 - 2; x += 9) { M.box(mats.whiteLine, 2, 0.006, 0.1, { x: x + 1, y: deckY(x + 1) + MY, z: ROAD_Z0 + 5.8 + 3.6 }); M.box(mats.whiteLine, 2, 0.006, 0.1, { x: x + 1, y: deckY(x + 1) + MY, z: ROAD_Z1 - 5.8 - 3.6 }); }
  for (let x = X0; x < X1; x += 5) { M.box(mats.whiteLine, 5.02, 0.006, 0.12, { x: x + 2.5, y: deckY(x + 2.5) + MY, z: ROAD_Z0 + 1.6 }); M.box(mats.whiteLine, 5.02, 0.006, 0.12, { x: x + 2.5, y: deckY(x + 2.5) + MY, z: ROAD_Z1 - 1.6 }); }   // cycle lanes
  // collision: three sloped strips (rise, crown, fall) for each of the footways and the carriageway
  const strips = [[Z0, ROAD_Z0, 0, 'bridge:footwayN'], [ROAD_Z0, ROAD_Z1, -KERB, 'bridge:carriageway'], [ROAD_Z1, Z1, 0, 'bridge:footwayS']];
  for (const [za, zb, dy, tag] of strips) { const zc = (za + zb) / 2, w = zb - za; const V = (x) => new THREE.Vector3(x, deckY(x) + dy, zc);
    collision.addRamp(V(X0 - 0.3), V(X0 + RAMP), w, { tag, sound: dy ? 'hard' : 'pavement' }); collision.addFloor({ xMin: X0 + RAMP - 0.1, xMax: X1 - RAMP + 0.1, zMin: za, zMax: zb, y: B.deck + dy, sound: dy ? 'hard' : 'pavement', tag }); collision.addRamp(V(X1 - RAMP), V(X1 + 0.3), w, { tag, sound: dy ? 'hard' : 'pavement' }); }

  // ================================================================ arches, piers, abutments
  M.chunk('arches');
  const SPRING = -5.2, RISE = 4.0, ARCH_SPAN = SPAN - PIER_W;
  for (let k = 0; k < B.arches; k++) {
    const xc = X0 + (k + 0.5) * SPAN; const top = deckY(xc) - 1.2 - SPRING;
    const sp = spandrelGeometry(ARCH_SPAN, RISE, top, Z1 - Z0 + 1.2, { pierHalf: PIER_W / 2 }); scaleUV(sp, 0.25, 0.25); M.add(mats.ironGreen, sp, { x: xc, y: SPRING, z: Z0 - 0.6 });
    M.add(mats.ironGreenDark, archRibGeometry(ARCH_SPAN + 0.2, RISE + 0.1, 0.9, Z1 - Z0 + 1.4), { x: xc, y: SPRING - 0.05, z: Z0 - 0.7 });
    // gilt shields / roundels on both spandrel faces at the crown
    for (const z of [Z0 - 0.62, Z1 + 0.62]) { M.cyl(mats.gilt, 0.8, 0.8, 0.12, 16, { x: xc, y: SPRING + RISE + 0.9, z, rx: Math.PI / 2 }); M.cyl(mats.red, 0.5, 0.5, 0.14, 16, { x: xc, y: SPRING + RISE + 0.9, z, rx: Math.PI / 2 }); }
  }
  for (let k = 1; k < B.arches; k++) { const x = X0 + k * SPAN; M.box(mats.granite, PIER_W, 6.5, Z1 - Z0 + 2.4, { x, y: SPRING - 3.2, z: (Z0 + Z1) / 2 }); for (const z of [Z0 - 1.2, Z1 + 1.2]) M.box(mats.granite, PIER_W * 0.72, 6.5, PIER_W * 0.72, { x, y: SPRING - 3.2, z, ry: Math.PI / 4 }); M.box(mats.granite, PIER_W + 0.6, 0.5, Z1 - Z0 + 3.2, { x, y: SPRING + 0.2, z: (Z0 + Z1) / 2 }); }
  for (const x of [X0 - 1.5, X1 + 1.5]) M.box(mats.granite, 3.4, 9.5, Z1 - Z0 + 2.4, { x, y: -4.5, z: (Z0 + Z1) / 2 });

  // ================================================================ parapets: granite plinth, pierced Gothic panels, posts, top rail
  const PANEL = 3.57, NP = Math.round(L / PANEL);
  const panelGeo = new THREE.PlaneGeometry(PANEL - 0.3, 1.2); scaleUV(panelGeo, PANEL - 0.3, 1.2); panelGeo.translate(0, 0.6, 0);
  const panels = I.set(panelGeo, mats.parapet, { castShadow: false, name: 'bridge-parapet' });
  const posts = I.set(new THREE.BoxGeometry(0.3, 1.55, 0.36).translate(0, 0.775, 0), mats.ironGreenDark, { name: 'bridge-posts' });
  M.chunk('parapet');
  for (const [z, ry] of [[Z0 + 0.15, 0], [Z1 - 0.15, Math.PI]]) {
    for (let i = 0; i < NP; i++) { const xa = X0 + i * PANEL, xm = xa + PANEL / 2; const y = deckY(xm); panels.add(xm, y + 0.3, z, { ry }); posts.add(xa, y, z); M.box(mats.granite, PANEL + 0.02, 0.3, 0.45, { x: xm, y: y + 0.15, z }); M.box(mats.ironGreenDark, PANEL + 0.02, 0.08, 0.2, { x: xm, y: y + 1.55, z }); }
    posts.add(X1, deckY(X1), z);
  }
  blk({ xMin: X0 - 0.5, xMax: X1 + 0.5, yMin: -1, yMax: 2.2, zMin: Z0 - 0.4, zMax: Z0 + 0.4 }, 'bridge:parapetN'); blk({ xMin: X0 - 0.5, xMax: X1 + 0.5, yMin: -1, yMax: 2.2, zMin: Z1 - 0.4, zMax: Z1 + 0.4 }, 'bridge:parapetS');
  // lamp standards: over every pier and at mid-span (13 per side)
  const lamp = gothicLampGeometry(); const lampSet = I.set(lamp.post, mats.ironGreen, { name: 'bridge-lamps' }); const lanternSet = I.set(lamp.lantern, mats.lumWarm, { castShadow: false, name: 'bridge-lanterns' }); const crownSet = I.set(lamp.crown, mats.ironGreenDark, { castShadow: false, name: 'bridge-lamp-crowns' });
  for (let k = 1; k <= 13; k++) { const x = X0 + k * SPAN / 2; for (const z of [Z0 + 0.45, Z1 - 0.45]) { const y = deckY(x) + 0.3; lampSet.add(x, y, z); lanternSet.add(x, y, z); crownSet.add(x, y, z); blk({ xMin: x - 0.4, xMax: x + 0.4, yMin: -1, yMax: 3, zMin: z - 0.4, zMax: z + 0.4 }, 'bridge:lamp'); } }
  // hostile-vehicle barriers along both kerbs (from 2017)
  const hvm = I.set(new THREE.BoxGeometry(1.9, 1.0, 0.45).translate(0, 0.5, 0), mats.barrierGrey, { name: 'bridge-hvm' });
  for (let x = X0 + 6; x < X1 - 6; x += 2.0) { hvm.add(x, deckY(x), ROAD_Z0 - 0.35); hvm.add(x, deckY(x), ROAD_Z1 + 0.35); }
  blk({ xMin: X0 + 5, xMax: X1 - 5, yMin: -1, yMax: 1.0, zMin: ROAD_Z0 - 0.6, zMax: ROAD_Z0 - 0.1 }, 'bridge:hvmN'); blk({ xMin: X0 + 5, xMax: X1 - 5, yMin: -1, yMax: 1.0, zMin: ROAD_Z1 + 0.1, zMax: ROAD_Z1 + 0.6 }, 'bridge:hvmS');
  // the far (South Bank) end: junction pavement, the Coade-stone lion on its plinth
  M.chunk('southEnd'); M.rect(mats.paving, { xMin: X1, xMax: X1 + 16, zMin: Z0 - 12, zMax: Z1 + 12 }, 0.0); collision.addFloor({ xMin: X1, xMax: X1 + 16, zMin: Z0 - 12, zMax: Z1 + 12, y: 0, sound: 'pavement', tag: 'southBankEnd' });
  M.rect(mats.tarmac, { xMin: X1, xMax: X1 + 16, zMin: ROAD_Z0, zMax: ROAD_Z1 }, -0.15 + 0.001);
  { const lx = X1 + 3, lz = Z0 - 3; M.boxUp(mats.granite, 4.5, 3.6, 2.6, { x: lx, y: 0, z: lz }); M.add(mats.coade, lionGeometry(), { x: lx, y: 3.6, z: lz, ry: -Math.PI / 2 }); blk({ xMin: lx - 2.3, xMax: lx + 2.3, yMin: -1, yMax: 8, zMin: lz - 1.4, zMax: lz + 1.4 }, 'southBankLion'); }

  // ================================================================ Boadicea and Her Daughters (Thornycroft, 1902) at the Embankment corner
  { const bx = S.boadicea.x - 1, bz = S.boadicea.z - 0.5; M.chunk('boadicea');
    M.boxUp(mats.granite, 5.2, 0.5, 3.4, { x: bx, y: 0, z: bz }); M.boxUp(mats.granite, 4.6, 3.6, 2.8, { x: bx, y: 0.5, z: bz }); M.box(mats.granite, 5.0, 0.4, 3.2, { x: bx, y: 4.3, z: bz });
    const face = (text, w, h, pose) => M.quad(signMat(ctx, T.sign({ width: 1024, height: 512, bg: '#7a7671', lines: text.map((t, i) => ({ text: t, x: 512, y: 120 + i * 78, size: 56, align: 'center', color: '#2a2622', weight: i === 0 ? 'bold' : 'normal', font: "'Times New Roman', 'DejaVu Serif', Georgia, serif" })) }), { emissive: 0.15 }), w, h, pose);
    face(['BOADICEA', '(BOUDICCA)', 'QUEEN OF THE ICENI', 'WHO DIED A.D. 61', 'AFTER LEADING HER PEOPLE', 'AGAINST THE ROMAN INVADER'], 2.6, 1.6, { x: bx - 1.9, y: 2.4, z: bz, facing: 'west' });
    face(['REGIONS CAESAR NEVER KNEW', 'THY POSTERITY SHALL SWAY'], 2.4, 1.0, { x: bx, y: 2.4, z: bz + 1.42, facing: 'south' });
    face(['THIS STATUE BY THOMAS THORNYCROFT', 'WAS PRESENTED TO LONDON BY HIS SON', 'SIR JOHN ISAAC THORNYCROFT C.E.', 'AND PLACED HERE BY THE', 'LONDON COUNTY COUNCIL A.D. 1902'], 2.4, 1.3, { x: bx, y: 2.4, z: bz - 1.42, facing: 'north' });
    const grp = new THREE.Group(); grp.position.set(bx, 4.5, bz); grp.rotation.y = Math.atan2(-(S.elizabethTower.x - bx), -(S.elizabethTower.z - bz)) + Math.PI;   // the horses rear towards Big Ben (local -z forward)
    group.add(grp); const G = new Merger(grp, 'boadicea-bronze'); const br = mats.bronzeStatue;
    // chariot: platform, sides, two big wheels with scythes
    G.box(br, 1.7, 0.25, 1.6, { x: 0, y: 1.05, z: 0.5 }); G.box(br, 0.12, 1.1, 1.5, { x: -0.8, y: 1.6, z: 0.5 }); G.box(br, 0.12, 1.1, 1.5, { x: 0.8, y: 1.6, z: 0.5 }); G.box(br, 1.6, 1.0, 0.1, { x: 0, y: 1.6, z: 1.25 });
    for (const sx of [-1, 1]) { G.torus(br, 0.85, 0.09, 8, 20, { x: sx * 0.95, y: 0.9, z: 0.6, ry: Math.PI / 2 }); for (let k = 0; k < 8; k++) G.box(br, 0.05, 1.6, 0.05, { x: sx * 0.95, y: 0.9, z: 0.6, rx: k * Math.PI / 8 }); G.box(br, 1.0, 0.06, 0.12, { x: sx * 1.5, y: 0.9, z: 0.6, rz: 0.3 }); }
    // two rearing horses (bodies tilted up, forelegs raised, necks arched)
    for (const sx of [-0.75, 0.75]) { const hx = sx; G.add(br, new THREE.SphereGeometry(0.55, 12, 10).scale(1, 0.9, 1.9), { x: hx, y: 1.6, z: -1.3, rx: -0.6 }); G.add(br, new THREE.CylinderGeometry(0.28, 0.36, 1.3, 8), { x: hx, y: 2.75, z: -2.4, rx: 0.6 }); G.add(br, new THREE.SphereGeometry(0.28, 8, 6).scale(1, 0.8, 1.6), { x: hx, y: 3.35, z: -2.85, rx: 0.9 }); for (const lx of [-0.25, 0.25]) { G.add(br, new THREE.CylinderGeometry(0.09, 0.07, 1.4, 6), { x: hx + lx, y: 0.7, z: -0.55, rx: 0.35 }); G.add(br, new THREE.CylinderGeometry(0.08, 0.06, 1.3, 6), { x: hx + lx, y: 2.1, z: -2.55, rx: -1.3 }); } G.add(br, new THREE.CylinderGeometry(0.09, 0.03, 1.2, 6), { x: hx, y: 1.3, z: -0.1, rx: -0.9 }); }
    // Boudica standing, spear raised in her right hand, left hand raised; the two daughters crouching
    G.add(br, figureGeometry({ coat: true }), { x: 0, y: 1.2, z: 0.5, sx: 1.45, sy: 1.5, sz: 1.45 }); G.add(br, new THREE.CylinderGeometry(0.06, 0.05, 1.2, 6), { x: 0.5, y: 3.2, z: 0.4, rz: -0.5 }); G.add(br, new THREE.CylinderGeometry(0.03, 0.03, 3.6, 6), { x: 0.85, y: 3.2, z: 0.4 }); G.add(br, new THREE.CylinderGeometry(0.06, 0.05, 1.2, 6), { x: -0.5, y: 3.2, z: 0.4, rz: 0.7 });
    G.add(br, figureGeometry({ coat: false }), { x: -0.55, y: 1.2, z: 0.85, sx: 1.0, sy: 0.65, sz: 1.0 }); G.add(br, figureGeometry({ coat: false }), { x: 0.55, y: 1.2, z: 0.9, sx: 1.0, sy: 0.6, sz: 1.0 });
    G.flush();
    blk({ xMin: bx - 2.7, xMax: bx + 2.7, yMin: -1, yMax: 9, zMin: bz - 1.8, zMax: bz + 1.8 }, 'boadicea'); }

  M.flush(); I.flush();
  return { deckY };
}

/** 1862 Gothic lamp standard: octagonal shaft + octagonal lantern with a pointed crown (feet at y = 0). */
function gothicLampGeometry() {
  const post = latheGeo([[0.5, 0], [0.5, 0.25], [0.34, 0.3], [0.3, 0.9], [0.22, 1.0], [0.17, 2.4], [0.24, 2.5], [0.17, 2.6], [0.13, 4.0], [0.2, 4.1], [0.12, 4.2], [0.1, 4.4]], 8);
  const lantern = new THREE.CylinderGeometry(0.34, 0.28, 0.95, 8); lantern.translate(0, 4.9, 0);
  const crown = new THREE.ConeGeometry(0.42, 0.7, 8); crown.translate(0, 5.72, 0);
  return { post, lantern, crown };
}
/** The South Bank Lion (Coade stone, 3.7 m tall × 4 m long), standing, facing local -z. */
function lionGeometry() {
  const parts = [];
  const body = new THREE.CapsuleGeometry(0.7, 2.2, 4, 10); body.rotateX(Math.PI / 2); body.translate(0, 1.9, 0.2); parts.push(body);
  const chest = new THREE.SphereGeometry(0.85, 10, 8); chest.translate(0, 2.0, -1.0); parts.push(chest);
  const head = new THREE.SphereGeometry(0.55, 10, 8); head.translate(0, 2.9, -1.6); parts.push(head);
  const mane = new THREE.SphereGeometry(0.75, 10, 8); mane.scale(1, 1.1, 0.8); mane.translate(0, 2.75, -1.35); parts.push(mane);
  for (const [x, z] of [[-0.45, -0.9], [0.45, -0.9], [-0.45, 1.2], [0.45, 1.2]]) { const leg = new THREE.CylinderGeometry(0.2, 0.24, 1.6, 8); leg.translate(x, 0.8, z); parts.push(leg); }
  const tail = new THREE.CylinderGeometry(0.06, 0.1, 1.8, 6); tail.rotateX(-0.9); tail.translate(0, 1.5, 2.0); parts.push(tail);
  let total = 0; const np = parts.map(g => g.toNonIndexed()); np.forEach(g => total += g.attributes.position.count);
  const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3), uv = new Float32Array(total * 2); let o = 0;
  for (const g of np) { pos.set(g.attributes.position.array, o * 3); nrm.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}
void COL; void hex; void mulberry;
