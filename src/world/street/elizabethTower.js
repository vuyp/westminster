// ---------------------------------------------------------------------------
// street/elizabethTower.js — the Elizabeth Tower ("Big Ben"), 96 m, 12.2 m square, at layout.STREET.elizabethTower.
// Anston limestone Gothic Revival: granite plinth, the buttressed shaft with three stages of blind lancets,
// the corbelled clock stage with four 6.9 m opal dials in Prussian-blue-and-gilt frames (hands driven by
// ctx.stationTime(), updated every minute), the gilded Latin inscription below each dial, the belfry with
// its pointed louvred openings and corner pinnacles, the cast-iron pyramidal spire with lucarnes and gilt
// hips, the Ayrton Light lantern and the finial. Leans 0.26° to the north-west. Dossier §11.3.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { Merger, Instancer, makeMaterials, COL, signMat, clockDialTexture, dialSurroundTexture, pointedArchShape, hex, DEG } from './kit.js';

export function buildElizabethTower(ctx, group, plan, state) {
  const { layout, collision, T } = ctx; const mats = makeMaterials(ctx); const ET = layout.STREET.elizabethTower;
  const W = ET.width, H = ET.height, CLOCK = ET.clockHeight, BELFRY = 62, BELFRY_TOP = ET.spireBase, SPIRE = ET.spireBase;
  const tower = new THREE.Group(); tower.name = 'elizabethTower'; tower.position.set(ET.x, 0, ET.z);
  const lean = 0.26 * DEG; tower.rotation.set(-lean * 0.7, 0, lean * 0.7);   // top drifts ~0.4 m to the north-west
  group.add(tower);
  const M = new Merger(tower, 'bigben'); const I = new Instancer(tower);
  const h = W / 2;

  // ================================================================ plinth and shaft
  M.chunk('shaft');
  M.boxUp(mats.graniteDark, W + 1.6, 1.0, W + 1.6, { x: 0, y: 0, z: 0 });
  M.boxUp(mats.anstonDark, W + 1.0, 2.6, W + 1.0, { x: 0, y: 1.0, z: 0, uvWorld: true });
  M.boxUp(mats.anston, W, CLOCK - 5.5 - 3.6, W, { x: 0, y: 3.6, z: 0, uvWorld: true });                         // core up to the clock-stage corbel
  // corner buttresses in three set-offs
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const cx = sx * (h - 1.0), cz = sz * (h - 1.0);
    M.boxUp(mats.anston, 2.4, 20, 2.4, { x: cx, y: 3.6, z: cz, uvWorld: true });
    M.box(mats.anstonDark, 2.6, 0.5, 2.6, { x: cx, y: 23.75, z: cz });
    M.boxUp(mats.anston, 2.2, 16, 2.2, { x: cx, y: 24, z: cz, uvWorld: true });
    M.box(mats.anstonDark, 2.4, 0.5, 2.4, { x: cx, y: 40.25, z: cz });
    M.boxUp(mats.anston, 2.05, CLOCK - 5.5 - 40.5, 2.05, { x: cx, y: 40.5, z: cz, uvWorld: true });
  }
  // recessed lancet faces between the buttresses (the tower-face texture: 7.8 m wide × 50 m)
  const faceW = W - 2 * 2.2;
  for (const [ry, ox, oz] of [[0, 0, 1], [Math.PI / 2, 1, 0], [Math.PI, 0, -1], [-Math.PI / 2, -1, 0]]) M.quad(mats.towerFace, faceW, CLOCK - 5.5 - 3.6, { x: ox * (h + 0.01), y: 3.6 + (CLOCK - 5.5 - 3.6) / 2, z: oz * (h + 0.01), ry, metric: true });
  // string courses across the faces at the stage lines
  for (const y of [13.2, 26.2, 39.7]) M.box(mats.anstonDark, W + 0.5, 0.45, W + 0.5, { x: 0, y, z: 0 });

  // ================================================================ clock stage (corbelled out to 13.8 m square)
  M.chunk('clock');
  const CW = W + 1.6, C0 = CLOCK - 5.5, C1 = CLOCK + 5.5;
  M.box(mats.anstonDark, CW, 1.2, CW, { x: 0, y: C0 - 0.6, z: 0 });                       // corbel course
  M.box(mats.anston, W + 0.9, 1.2, W + 0.9, { x: 0, y: C0 - 1.7, z: 0, uvWorld: true });
  M.boxUp(mats.anston, CW, C1 - C0, CW, { x: 0, y: C0, z: 0, uvWorld: true });
  M.box(mats.anstonDark, CW + 0.6, 0.8, CW + 0.6, { x: 0, y: C1 + 0.4, z: 0 });            // cornice over the dials
  // the four dials
  const dialTex = clockDialTexture(T), surroundTex = dialSurroundTexture(T, { m: 11 });
  const dialMat = signMat(ctx, dialTex, { emissive: 0.55, transparent: true }); const surroundMat = signMat(ctx, surroundTex, { emissive: 0.12 });
  const latin = T.sign({ width: 2048, height: 160, bg: hex(COL.prussian), lines: [{ text: 'DOMINE SALVAM FAC REGINAM NOSTRAM VICTORIAM PRIMAM', x: 1024, y: 118, size: 92, align: 'center', color: '#e2b93b', weight: 'bold', font: "'Times New Roman', 'DejaVu Serif', Georgia, serif" }] });
  const latinMat = signMat(ctx, latin, { emissive: 0.5 });
  const handGeo = (len, wid) => { const g = new THREE.BoxGeometry(wid, len, 0.08); g.translate(0, len / 2 - len * 0.12, 0); return g; };
  const faces = []; const faceDefs = [[0, 0, 1, 'south'], [Math.PI / 2, 1, 0, 'east'], [Math.PI, 0, -1, 'north'], [-Math.PI / 2, -1, 0, 'west']];
  for (const [ry, ox, oz, name] of faceDefs) {
    // the static parts of each face are merged into the tower (one mesh per material); only the hands stay as meshes
    const pose = { x: ox * (CW / 2), y: CLOCK, z: oz * (CW / 2), ry };
    M.add(surroundMat, new THREE.PlaneGeometry(11, 11).translate(0, 0, 0.02), pose);
    M.add(dialMat, new THREE.CircleGeometry(3.45, 64).translate(0, 0, 0.09), pose);
    M.add(mats.prussian, new THREE.TorusGeometry(3.52, 0.13, 10, 64).translate(0, 0, 0.1), pose);
    M.add(mats.gilt, new THREE.TorusGeometry(3.7, 0.07, 8, 64).translate(0, 0, 0.06), pose);
    M.add(mats.gilt, new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16).rotateX(Math.PI / 2).translate(0, 0, 0.3), pose);
    M.add(latinMat, new THREE.PlaneGeometry(10.4, 0.8).translate(0, -5.1, 0.04), pose);
    const f = new THREE.Group(); f.position.set(pose.x, pose.y, pose.z); f.rotation.y = ry; tower.add(f);
    const hour = new THREE.Mesh(handGeo(2.7, 0.26), mats.prussian); hour.position.z = 0.18; hour.castShadow = false; f.add(hour);
    const minute = new THREE.Mesh(handGeo(4.3, 0.18), mats.prussian); minute.position.z = 0.26; minute.castShadow = false; f.add(minute);
    faces.push({ name, group: f, hour, minute });
  }
  // gilt ornament at the corners of the clock stage + small pinnacles on the cornice
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { M.boxUp(mats.anston, 1.4, C1 - C0 + 2.4, 1.4, { x: sx * (CW / 2 - 0.4), y: C0 - 0.6, z: sz * (CW / 2 - 0.4), uvWorld: true }); M.cone(mats.anstonDark, 0.7, 2.6, 8, { x: sx * (CW / 2 - 0.4), y: C1 + 3.1, z: sz * (CW / 2 - 0.4) }); M.sphere(mats.gilt, 0.25, { x: sx * (CW / 2 - 0.4), y: C1 + 4.5, z: sz * (CW / 2 - 0.4) }); }

  // ================================================================ belfry (62..70): pointed louvred openings, corner pinnacles
  M.chunk('belfry');
  const B0 = C1 + 0.8, B1 = BELFRY_TOP; const BW = W - 0.4;
  M.boxUp(mats.anston, BW, B1 - B0, BW, { x: 0, y: B0, z: 0, uvWorld: true });
  M.box(mats.anstonDark, BW + 0.5, 0.6, BW + 0.5, { x: 0, y: B1 + 0.3, z: 0 });
  const arch = pointedArchShape(1.7, 3.6, 5.4); const archGeo = new THREE.ShapeGeometry(arch); const louvre = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.9 });
  const archSet = I.set(archGeo, louvre, { castShadow: false, name: 'belfry-arches' }); const hoodGeo = new THREE.ShapeGeometry(pointedArchShape(2.2, 3.8, 5.9)); const hoodSet = I.set(hoodGeo, mats.anstonDark, { castShadow: false, name: 'belfry-hoods' });
  for (const [ry, ox, oz] of faceDefs) for (const u of [-3.2, 0, 3.2]) { const [x, z] = ox ? [ox * (BW / 2 + 0.02), u] : [u, oz * (BW / 2 + 0.02)]; archSet.add(x, B0 + 1.2, z, { ry }); hoodSet.add(ox ? ox * (BW / 2 + 0.01) : u, B0 + 1.0, oz ? oz * (BW / 2 + 0.01) : u, { ry }); }
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { M.boxUp(mats.anston, 1.6, B1 - B0 + 1.2, 1.6, { x: sx * (BW / 2 - 0.2), y: B0, z: sz * (BW / 2 - 0.2), uvWorld: true }); M.cone(mats.anstonDark, 0.85, 5.5, 8, { x: sx * (BW / 2 - 0.2), y: B1 + 1.2 + 2.75, z: sz * (BW / 2 - 0.2) }); M.sphere(mats.gilt, 0.28, { x: sx * (BW / 2 - 0.2), y: B1 + 1.2 + 5.6, z: sz * (BW / 2 - 0.2) }); }

  // ================================================================ spire (70..96): cast-iron pyramid with gilt hips, lucarnes, the Ayrton Light and the finial
  M.chunk('spire');
  const LANTERN = 86.5, SP_H = LANTERN - SPIRE; const rBase = (BW / 2) * Math.SQRT2, rTop = 1.9 * Math.SQRT2;
  M.cyl(mats.spireIron, rTop, rBase, SP_H, 4, { x: 0, y: SPIRE + SP_H / 2, z: 0, ry: Math.PI / 4 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.tube(mats.gilt, { x: sx * BW / 2, y: SPIRE, z: sz * BW / 2 }, { x: sx * 1.9, y: LANTERN, z: sz * 1.9 }, 0.12, 6);
  // lucarne dormers with gilt finials on each face
  for (const [ry, ox, oz] of faceDefs) { const t = 0.22; const y = SPIRE + t * SP_H; const r = (BW / 2) * (1 - t) + 1.9 * t; const [x, z] = [ox * (r - 0.6), oz * (r - 0.6)]; M.boxUp(mats.anston, 2.6, 3.6, 2.2, { x, y: y - 0.6, z, ry }); M.cone(mats.spireIron, 1.7, 2.2, 4, { x, y: y + 3.0 + 1.1, z, ry: Math.PI / 4 + ry }); M.sphere(mats.gilt, 0.22, { x, y: y + 5.4, z }); M.add(mats.anstonDark, new THREE.ShapeGeometry(pointedArchShape(1.2, 1.6, 2.6)), { x: x + ox * 1.12, y: y - 0.2, z: z + oz * 1.12, ry }); }
  // the Ayrton Light: octagonal lantern, lit when the Commons sits
  M.cyl(mats.gilt, 2.2, 2.2, 0.4, 8, { x: 0, y: LANTERN + 0.2, z: 0 });
  const ayrton = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 2.6, 8, 1, true), mats.lumWhite); ayrton.position.y = LANTERN + 1.7; tower.add(ayrton);
  M.cyl(mats.spireIron, 0.3, 2.3, 1.0, 8, { x: 0, y: LANTERN + 3.3, z: 0 });
  M.cone(mats.spireIron, 1.4, H - LANTERN - 5.0, 8, { x: 0, y: LANTERN + 3.8 + (H - LANTERN - 5.0) / 2, z: 0 });
  M.sphere(mats.gilt, 0.35, { x: 0, y: H - 1.0, z: 0 }); M.cone(mats.gilt, 0.18, 1.6, 6, { x: 0, y: H - 0.2, z: 0 });
  // the tower is inside its railed enclosure; keep the player off its base
  collision.addBlocker({ xMin: ET.x - h - 0.9, xMax: ET.x + h + 0.9, yMin: -0.5, yMax: 8, zMin: ET.z - h - 0.9, zMax: ET.z + h + 0.9 }, 'bigBen:base');
  M.flush(); I.flush();

  // ================================================================ the clock
  let lastMinute = -1, acc = 0;
  const setTime = (d) => { const hrs = d.getHours() % 12, min = d.getMinutes(), sec = d.getSeconds(); const am = (min + sec / 60) / 60 * Math.PI * 2, ah = (hrs + min / 60) / 12 * Math.PI * 2; for (const f of faces) { f.minute.rotation.z = -am; f.hour.rotation.z = -ah; } };
  const now = ctx.stationTime ? ctx.stationTime() : new Date(); setTime(now); lastMinute = now.getMinutes();
  ctx.onUpdate((dt) => { acc += dt; if (acc < 1) return; acc = 0; const d = ctx.stationTime ? ctx.stationTime() : new Date(); if (d.getMinutes() !== lastMinute) { lastMinute = d.getMinutes(); setTime(d); } });
  const clock = { setTime, faces, get time() { return ctx.stationTime ? ctx.stationTime() : new Date(); } };
  return { group: tower, clock, ayrton };
}
