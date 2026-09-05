// ---------------------------------------------------------------------------
// street/palace.js — the Palace of Westminster south of the tower (Barry & Pugin's Perpendicular Gothic
// massing in Anston limestone: the river front and its terrace, Speaker's House at the north-east corner,
// the Central Tower, the Victoria Tower with the Union flag, pinnacles along every parapet), Westminster
// Hall with its great roof and twin north towers, New Palace Yard behind Edward Barry's 2.1 m black-and-gilt
// railings (lime avenue, catalpas, the 1977 Silver Jubilee Fountain, the Carriage Gates with the security
// booth, the LU vent shaft), Speaker's Green in front of the tower, Cromwell Green and the statues on the
// west side. Dossier §11.4.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { Merger, Instancer, makeMaterials, COL, signMat, unionFlagTexture, canopyGeometry, figureGeometry, ridgeRoofGeometry, mulberry, hex } from './kit.js';

export function buildPalace(ctx, group, plan, state) {
  const { layout, collision, T } = ctx; const mats = makeMaterials(ctx); const S = layout.STREET; const P = S.palace, WH = S.westminsterHall, NPY = S.newPalaceYard, ET = S.elizabethTower;
  const M = new Merger(group, 'palace'); const I = new Instancer(group);
  const blk = (r, tag) => collision.addBlocker(r, tag);
  const PARAPET = 22, RIVER_X = P.xMax;

  // ================================================================ the main ranges (bay texture on the boxes, real pinnacles above)
  M.chunk('palace-main');
  const range = (r, h, tag) => { M.boxUp(mats.palace, r.xMax - r.xMin, h, r.zMax - r.zMin, { x: (r.xMin + r.xMax) / 2, y: 0, z: (r.zMin + r.zMax) / 2, uvWorld: true }); blk({ ...r, yMin: -0.5, yMax: h }, tag); };
  const tx1 = ET.x + ET.width / 2;   // 28.1
  range({ xMin: tx1, xMax: RIVER_X, zMin: P.zMin, zMax: P.zMin + 34 }, PARAPET, 'palace:speakersHouse');               // Speaker's House (NE corner, north front onto Speaker's Green)
  range({ xMin: RIVER_X - 24, xMax: RIVER_X, zMin: P.zMin + 34, zMax: P.zMax }, PARAPET + 2, 'palace:riverFront');     // river front range
  range({ xMin: P.xMin, xMax: RIVER_X - 24, zMin: WH.zMax, zMax: P.zMax }, PARAPET - 2, 'palace:westRanges');           // west/south ranges behind Westminster Hall
  range({ xMin: WH.xMax, xMax: RIVER_X - 24, zMin: P.zMin + 4, zMax: WH.zMax }, PARAPET - 3, 'palace:innerCourts');      // inner courts between the hall and the river front
  range({ xMin: ET.x - ET.width / 2 - 1, xMax: tx1 + 1, zMin: ET.z + ET.width / 2 - 0.5, zMax: P.zMin + 30 }, 16, 'palace:towerLink');   // the low link between the tower and Speaker's House
  // steep roofs behind the parapets (cast-iron tiles, grey-green)
  const roof = (xMin, xMax, zMin, zMax, y0, rise, alongZ = true) => { const w = alongZ ? xMax - xMin : zMax - zMin, len = alongZ ? zMax - zMin : xMax - xMin; M.add(mats.spireIron, ridgeRoofGeometry(w, len, rise, alongZ), { x: (xMin + xMax) / 2, y: y0, z: (zMin + zMax) / 2 }); };
  roof(RIVER_X - 22, RIVER_X - 2, P.zMin + 36, P.zMax - 2, PARAPET + 1.6, 6); roof(tx1 + 2, RIVER_X - 2, P.zMin + 2, P.zMin + 32, PARAPET - 0.4, 6, false); roof(P.xMin + 2, RIVER_X - 26, WH.zMax + 2, P.zMax - 2, PARAPET - 2.4, 5);
  // pinnacles along the parapets (6.1 m bay rhythm)
  const pin = I.set(pinnacleGeometry(), mats.anstonDark, { name: 'palace-pinnacles' });
  const along = (x0, x1, z0, z1, y, step = 6.1) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / step)); for (let i = 0; i <= n; i++) pin.add(x0 + (x1 - x0) * i / n, y, z0 + (z1 - z0) * i / n); };
  along(RIVER_X, RIVER_X, P.zMin, P.zMax, PARAPET + 2); along(P.xMin, P.xMin, WH.zMax, P.zMax, PARAPET - 2); along(tx1, RIVER_X, P.zMin, P.zMin, PARAPET); along(P.xMin, RIVER_X, P.zMax, P.zMax, PARAPET - 2);
  // Central Tower (91 m octagonal lantern with a spire) and the Victoria Tower (98.5 m, 22 m square, corner turrets, the Union flag)
  M.chunk('palace-towers');
  { const cx = RIVER_X - 40, cz = P.zMin + 145; M.cyl(mats.anston, 7.5, 7.5, 62 - PARAPET, 8, { x: cx, y: PARAPET + (62 - PARAPET) / 2, z: cz }); M.cyl(mats.anstonDark, 8.4, 8.4, 0.8, 8, { x: cx, y: 62.4, z: cz }); M.cone(mats.spireIron, 7.2, 29, 8, { x: cx, y: 62.8 + 14.5, z: cz }); M.cone(mats.gilt, 0.4, 3, 6, { x: cx, y: 91 + 1, z: cz }); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8; M.cone(mats.anstonDark, 0.9, 6, 6, { x: cx + Math.cos(a) * 8.2, y: 62.8 + 3, z: cz + Math.sin(a) * 8.2 }); } }
  { const VT = { x: P.xMin + 11, z: P.zMax - 11, w: 22, h: 98.5 }; M.boxUp(mats.palace, VT.w, 70, VT.w, { x: VT.x, y: 0, z: VT.z, uvWorld: true }); M.boxUp(mats.anston, VT.w - 1, VT.h - 70, VT.w - 1, { x: VT.x, y: 70, z: VT.z, uvWorld: true }); M.box(mats.anstonDark, VT.w + 1, 1.0, VT.w + 1, { x: VT.x, y: 70.5, z: VT.z }); M.box(mats.anstonDark, VT.w + 0.6, 1.0, VT.w + 0.6, { x: VT.x, y: VT.h - 0.5, z: VT.z });
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { M.cyl(mats.anston, 1.9, 1.9, 12, 8, { x: VT.x + sx * (VT.w / 2 - 1.0), y: VT.h + 3, z: VT.z + sz * (VT.w / 2 - 1.0) }); M.cone(mats.spireIron, 2.1, 4, 8, { x: VT.x + sx * (VT.w / 2 - 1.0), y: VT.h + 11, z: VT.z + sz * (VT.w / 2 - 1.0) }); M.sphere(mats.gilt, 0.4, { x: VT.x + sx * (VT.w / 2 - 1.0), y: VT.h + 13.2, z: VT.z + sz * (VT.w / 2 - 1.0) }); }
    blk({ xMin: VT.x - VT.w / 2, xMax: VT.x + VT.w / 2, yMin: -0.5, yMax: VT.h, zMin: VT.z - VT.w / 2, zMax: VT.z + VT.w / 2 }, 'palace:victoriaTower');
    // flagpole with the Union flag (gently waving)
    M.cyl(mats.white, 0.12, 0.16, 22, 8, { x: VT.x, y: VT.h + 11, z: VT.z });
    const flagGeo = new THREE.PlaneGeometry(9, 4.5, 18, 6); flagGeo.translate(4.5, 0, 0); const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ map: unionFlagTexture(T), side: THREE.DoubleSide, roughness: 0.9 })); flag.position.set(VT.x + 0.2, VT.h + 19.5, VT.z); flag.castShadow = false; group.add(flag);
    const base = flagGeo.attributes.position.array.slice(); ctx.onUpdate((dt, t) => { const p = flagGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = base[i * 3], y = base[i * 3 + 1]; p.setZ(i, Math.sin(x * 0.9 - t * 4.2) * 0.35 * (x / 9) + Math.sin(y * 1.5 + t * 2.7) * 0.12 * (x / 9)); } p.needsUpdate = true; }); }

  // ================================================================ Westminster Hall: buttressed walls, the great roof, twin north towers
  M.chunk('hall');
  const HW = 14;
  M.boxUp(mats.anston, WH.xMax - WH.xMin, HW, WH.zMax - WH.zMin, { x: (WH.xMin + WH.xMax) / 2, y: 0, z: (WH.zMin + WH.zMax) / 2, uvWorld: true }); blk({ ...WH, yMin: -0.5, yMax: WH.height }, 'palace:westminsterHall');
  for (let z = WH.zMin + 3; z < WH.zMax; z += 6.5) { M.boxUp(mats.anstonDark, 1.6, HW + 1.5, 1.2, { x: WH.xMin - 0.8, y: 0, z, uvWorld: true }); M.cone(mats.anstonDark, 0.7, 2.5, 6, { x: WH.xMin - 0.8, y: HW + 2.75, z }); }
  M.add(mats.spireIron, ridgeRoofGeometry(WH.xMax - WH.xMin + 1.6, WH.zMax - WH.zMin + 1, WH.height - HW, true), { x: (WH.xMin + WH.xMax) / 2, y: HW, z: (WH.zMin + WH.zMax) / 2 });
  // north gable with the great window (tower-face lancets), flanked by the two towers
  M.quad(mats.towerFace, WH.xMax - WH.xMin - 8, 16, { x: (WH.xMin + WH.xMax) / 2, y: 10, z: WH.zMin - 0.02, facing: 'north', metric: true });
  for (const x of [WH.xMin + 2, WH.xMax - 2]) { M.boxUp(mats.anston, 4.2, 32, 4.2, { x, y: 0, z: WH.zMin + 1.5, uvWorld: true }); M.box(mats.anstonDark, 4.8, 0.8, 4.8, { x, y: 32.2, z: WH.zMin + 1.5 }); for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.cone(mats.anstonDark, 0.6, 3, 6, { x: x + sx * 1.8, y: 33.8, z: WH.zMin + 1.5 + sz * 1.8 }); }
  M.box(mats.anstonDark, WH.xMax - WH.xMin + 1, 1.0, 0.8, { x: (WH.xMin + WH.xMax) / 2, y: 16.5, z: WH.zMin + 0.3 });

  // ================================================================ New Palace Yard: railings, drive, lawn, trees, fountain, gates, vent shaft
  M.chunk('yard');
  M.rect(mats.grass, { xMin: NPY.xMin + 6, xMax: NPY.xMax - 6, zMin: NPY.zMin + 6, zMax: NPY.zMax - 2 }, 0.05);
  M.rect(mats.tarmac, { xMin: NPY.xMin, xMax: NPY.xMax, zMin: NPY.zMin, zMax: NPY.zMax }, 0.02);
  // the car park entrance ramp (descending east of the gates) and the security booth
  M.box(mats.concrete, 8, 0.4, 0.5, { x: NPY.xMin + 14, y: 0.2, z: NPY.zMin + 12 }); M.box(mats.concrete, 8, 0.4, 0.5, { x: NPY.xMin + 14, y: 0.2, z: NPY.zMin + 18 }); M.box(mats.dark, 8, 0.05, 5.5, { x: NPY.xMin + 14, y: 0.03, z: NPY.zMin + 15 });
  M.boxUp(mats.steelGrey, 3.2, 2.8, 2.6, { x: NPY.xMin + 5, y: 0, z: NPY.zMin + 18 }); M.quad(mats.glassDark, 3.0, 1.1, { x: NPY.xMin + 5, y: 1.7, z: NPY.zMin + 18 - 1.31, facing: 'north' }); M.quad(mats.glassDark, 2.4, 1.1, { x: NPY.xMin + 5 - 1.61, y: 1.7, z: NPY.zMin + 18, facing: 'west' });
  // LU vent shaft (dossier: inside the yard near the Parliament Square corner)
  M.boxUp(mats.portland, 4.5, 3.4, 3.5, { x: -60, y: 0, z: 32, uvWorld: true }); M.box(mats.grate, 4.0, 0.1, 3.0, { x: -60, y: 3.45, z: 32 });
  // the Silver Jubilee Fountain (Walenty Pytel, 1977): octagonal basin, central column of welded-steel beasts, gilded crown
  { const fx = -27, fz = 45; M.cyl(mats.portland, 5.2, 5.4, 0.8, 8, { x: fx, y: 0.4, z: fz }); M.cyl(ctx.M.water(), 4.6, 4.6, 0.1, 8, { x: fx, y: 0.75, z: fz }); M.cyl(mats.ironBlack, 0.5, 0.7, 5.5, 8, { x: fx, y: 3.5, z: fz });
    const rnd = mulberry(5); for (let k = 0; k < 14; k++) { const a = rnd() * Math.PI * 2, r = 0.6 + rnd() * 0.9, y = 1.6 + rnd() * 4; M.box(mats.ironBlack, 0.35 + rnd() * 0.5, 0.25 + rnd() * 0.6, 0.2 + rnd() * 0.4, { x: fx + Math.cos(a) * r, y, z: fz + Math.sin(a) * r, ry: a, rz: rnd() * 0.6 }); }
    M.torus(mats.gilt, 0.9, 0.12, 8, 16, { x: fx, y: 6.4, z: fz, rx: Math.PI / 2 }); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; M.tube(mats.gilt, { x: fx + Math.cos(a) * 0.9, y: 6.4, z: fz + Math.sin(a) * 0.9 }, { x: fx, y: 7.6, z: fz }, 0.06, 5); } M.sphere(mats.gilt, 0.2, { x: fx, y: 7.7, z: fz }); }
  // trees: the lime avenue just inside the north railings and the west side, three big catalpas by the hall
  // (the tree instancers live on state.late so that later parts — Whitehall, furniture — can add trees before the final flush)
  const LI = state.late || I;
  const canopyA = canopyGeometry(3), canopyB = canopyGeometry(9); const leavesA = LI.set(canopyA, mats.leaf, { name: 'trees-a' }), leavesB = LI.set(canopyB, mats.leafLight, { name: 'trees-b' });
  const trunks = LI.set(new THREE.CylinderGeometry(0.22, 0.34, 1, 7).translate(0, 0.5, 0), mats.bark, { name: 'trunks' });
  const rnd = mulberry(17);
  const tree = (x, z, h, s, wide = 1) => { trunks.add(x, 0, z, { sy: h, sx: 1 + s * 0.15, sz: 1 + s * 0.15 }); const set = rnd() < 0.5 ? leavesA : leavesB; set.add(x, h + s * 0.7, z, { ry: rnd() * 6.28, sx: s * wide, sy: s * 0.9, sz: s * wide }); };
  for (let x = NPY.xMin + 8; x <= NPY.xMax - 6; x += 7.5) tree(x + (rnd() - 0.5), NPY.zMin + 3.2 + (rnd() - 0.5) * 0.4, 5.5 + rnd() * 1.5, 3.4 + rnd() * 0.8);
  for (let z = NPY.zMin + 10; z <= NPY.zMax - 6; z += 7.5) tree(NPY.xMin + 4 + (rnd() - 0.5), z, 5.5 + rnd() * 1.5, 3.2 + rnd() * 0.8);
  for (const [x, z] of [[-40, 56], [-14, 54], [2, 48]]) tree(x, z, 4.0, 4.8, 1.5);
  state.trees = { tree };   // other parts (furniture) may add trees with the same instancers before flush
  // Speaker's Green and the tower's enclosure: grass, gravel path to the tower base
  M.rect(mats.mud, { xMin: plan.towerYard.xMin, xMax: plan.towerYard.xMax, zMin: plan.towerYard.zMin, zMax: plan.towerYard.zMax }, 0.03);
  for (const [x, z] of [[40, 40], [58, 42], [72, 39]]) tree(x, z, 5, 3.6);

  // ================================================================ Barry's railings (2.1 m, black with gilt spear finials) on a granite plinth
  const bar = I.set(new THREE.BoxGeometry(0.035, 1.75, 0.035).translate(0, 0.875, 0), mats.ironBlack, { name: 'railing-bars' });
  const spear = I.set(new THREE.ConeGeometry(0.05, 0.2, 5).translate(0, 0.1, 0), mats.gilt, { castShadow: false, name: 'railing-spears' });
  const post = I.set(new THREE.BoxGeometry(0.14, 2.05, 0.14).translate(0, 1.025, 0), mats.ironBlack, { name: 'railing-posts' });
  const cap = I.set(new THREE.SphereGeometry(0.11, 8, 6), mats.gilt, { castShadow: false, name: 'railing-caps' });
  const railing = (x0, z0, x1, z1, { plinth = 0.35, tag = 'railings', gap = null } = {}) => {
    const len = Math.hypot(x1 - x0, z1 - z0); const ux = (x1 - x0) / len, uz = (z1 - z0) / len; const ry = Math.atan2(ux, uz) + Math.PI / 2;
    M.chunk('railings'); M.box(mats.graniteDark, Math.abs(x1 - x0) + 0.35 || 0.35, plinth, Math.abs(z1 - z0) + 0.35 || 0.35, { x: (x0 + x1) / 2, y: plinth / 2, z: (z0 + z1) / 2 });
    const rail = (y) => M.box(mats.ironBlack, Math.abs(x1 - x0) || 0.06, 0.06, Math.abs(z1 - z0) || 0.06, { x: (x0 + x1) / 2, y, z: (z0 + z1) / 2 });
    rail(plinth + 0.25); rail(plinth + 1.55);
    for (let d = 0; d <= len; d += 0.15) { const x = x0 + ux * d, z = z0 + uz * d; if (gap && d > gap[0] && d < gap[1]) continue; bar.add(x, plinth, z); spear.add(x, plinth + 1.75, z); }
    for (let d = 0; d <= len + 0.01; d += 3) { const x = x0 + ux * d, z = z0 + uz * d; post.add(x, plinth, z, { ry }); cap.add(x, plinth + 2.1, z); }
    blk({ xMin: Math.min(x0, x1) - 0.2, xMax: Math.max(x0, x1) + 0.2, yMin: -0.5, yMax: plinth + 2.1, zMin: Math.min(z0, z1) - 0.2, zMax: Math.max(z0, z1) + 0.2 }, tag);
  };
  const RZ = S.railingsZ;
  railing(NPY.xMin, RZ, NPY.xMax, RZ, { tag: 'railings:bridgeStreet' });                                       // along Bridge Street
  railing(NPY.xMax, RZ, NPY.xMax, plan.towerRailZ, { tag: 'railings:return' }); railing(NPY.xMax, plan.towerRailZ, S.riverWallX - 0.4, plan.towerRailZ, { tag: 'railings:speakersGreen' });   // return + the tower / Speaker's Green line
  railing(NPY.xMin, RZ, NPY.xMin, NPY.zMax, { tag: 'railings:west', gap: [9, 15] });                            // Parliament Square side, with the Carriage Gates opening
  railing(NPY.xMin, NPY.zMax, WH.xMin, NPY.zMax, { tag: 'railings:cromwell' }); railing(WH.xMin, NPY.zMax, WH.xMin, 150, { tag: 'railings:hall', plinth: 0.6 });
  // the Carriage Gates: two tall stone piers with gilt lanterns, closed gate leaves (bars), rising bollards, the PC Keith Palmer memorial outside
  { const gz0 = RZ + 9, gz1 = RZ + 15; M.chunk('railings');
    for (const z of [gz0, gz1]) { M.boxUp(mats.portland, 1.2, 4.0, 1.2, { x: NPY.xMin, y: 0, z, uvWorld: true }); M.box(mats.anstonDark, 1.5, 0.4, 1.5, { x: NPY.xMin, y: 4.1, z }); M.box(mats.ironBlack, 0.5, 0.7, 0.5, { x: NPY.xMin, y: 4.7, z }); M.box(mats.lumWarm, 0.36, 0.5, 0.36, { x: NPY.xMin, y: 4.7, z }); M.cone(mats.ironBlack, 0.4, 0.4, 4, { x: NPY.xMin, y: 5.25, z }); }
    for (let z = gz0 + 0.75; z < gz1 - 0.6; z += 0.15) { bar.add(NPY.xMin + 0.1, 0.05, z, { sy: 1.5 }); spear.add(NPY.xMin + 0.1, 2.68, z); }
    M.box(mats.ironBlack, 0.08, 0.1, gz1 - gz0 - 1.2, { x: NPY.xMin + 0.1, y: 2.5, z: (gz0 + gz1) / 2 }); M.box(mats.ironBlack, 0.08, 0.1, gz1 - gz0 - 1.2, { x: NPY.xMin + 0.1, y: 0.25, z: (gz0 + gz1) / 2 });
    for (const z of [gz0 + 1.5, gz0 + 3, gz0 + 4.5]) M.cyl(mats.steelGrey, 0.14, 0.14, 0.9, 10, { x: NPY.xMin - 2.5, y: 0.45, z });
    M.boxUp(mats.graniteDark, 1.1, 0.9, 0.35, { x: NPY.xMin - 1.6, y: 0, z: gz0 - 3 }); M.quad(signMat(ctx, T.sign({ width: 512, height: 384, bg: '#3a3a3a', lines: [{ text: 'PC KEITH PALMER GM', x: 256, y: 120, size: 44, align: 'center' }, { text: '1968 – 2017', x: 256, y: 200, size: 40, align: 'center', weight: 'normal' }, { text: 'Died protecting Parliament', x: 256, y: 290, size: 34, align: 'center', weight: 'normal' }] }), { emissive: 0.2 }), 0.9, 0.6, { x: NPY.xMin - 1.6 - 0.18, y: 0.5, z: gz0 - 3, facing: 'west' });
    blk({ xMin: NPY.xMin - 0.4, xMax: NPY.xMin + 0.4, yMin: -0.5, yMax: 3, zMin: gz0, zMax: gz1 }, 'railings:carriageGates'); }

  // ================================================================ Cromwell Green and the west side statues
  M.chunk('yard');
  M.box(mats.portland, plan.cromwellGreen.xMax - plan.cromwellGreen.xMin, 1.0, 0.5, { x: (plan.cromwellGreen.xMin + plan.cromwellGreen.xMax) / 2, y: 0.5, z: plan.cromwellGreen.zMin + 0.25 });
  M.box(mats.portland, 0.5, 1.0, plan.cromwellGreen.zMax - plan.cromwellGreen.zMin, { x: plan.cromwellGreen.xMin + 0.25, y: 0.5, z: (plan.cromwellGreen.zMin + plan.cromwellGreen.zMax) / 2 });
  blk({ xMin: plan.cromwellGreen.xMin, xMax: plan.cromwellGreen.xMax, yMin: -0.5, yMax: 1.2, zMin: plan.cromwellGreen.zMin, zMax: plan.cromwellGreen.zMax }, 'cromwellGreen');
  const statue = I.set(figureGeometry(), mats.bronzeStatue, { name: 'statues' });
  const plinthStatue = (x, z, ry, scale, ph, name) => { M.chunk('statues'); M.boxUp(mats.granite, 1.8 * scale, ph, 1.8 * scale, { x, y: 0, z }); statue.add(x, ph, z, { ry, s: scale }); if (name) M.quad(signMat(ctx, T.sign({ width: 512, height: 128, bg: '#5a5752', lines: [{ text: name, x: 256, y: 92, size: 70, align: 'center', color: '#e8e4da' }] }), { emissive: 0.2 }), 1.4 * scale, 0.35 * scale, { x, y: ph * 0.55, z: z - 0.9 * scale - 0.02, facing: 'north' }); blk({ xMin: x - scale, xMax: x + scale, yMin: -0.5, yMax: ph + 2, zMin: z - scale, zMax: z + scale }, 'statue'); };
  plinthStatue(-42, 118, -Math.PI / 2, 1.7, 3.6, 'CROMWELL');     // Hamo Thornycroft, 1899, in front of Westminster Hall
  plinthStatue(-46, 200, -Math.PI / 2, 2.2, 4.0, 'RICHARD I');    // Old Palace Yard (equestrian in reality)

  M.flush(); I.flush();
  return { railing };
}

/** A parapet pinnacle: a short square shaft with a crocketed spire (as an instanced geometry, y=0 at its base). */
function pinnacleGeometry() {
  const shaft = new THREE.BoxGeometry(0.9, 2.2, 0.9); shaft.translate(0, 1.1, 0);
  const spire = new THREE.ConeGeometry(0.62, 3.2, 8); spire.translate(0, 2.2 + 1.6, 0);
  const parts = [shaft, spire].map(g => g.toNonIndexed()); let total = 0; parts.forEach(g => total += g.attributes.position.count);
  const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3), uv = new Float32Array(total * 2); let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nrm.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}
void COL; void hex;
