// ---------------------------------------------------------------------------
// street/thames.js — the river and everything beyond it: the Thames (animated normal-mapped water, 240 m
// wide, flowing north), Bazalgette's granite Embankment wall with its rounded coping and Vulliamy's dolphin
// lamp standards, the four flush JLE vent grates on the riverside footway (with their tunnel-air rumble),
// Westminster Millennium Pier (floating pontoon, gangway, kiosks, a moored river bus), a river bus cruising
// the tideway, County Hall (Edwardian Baroque with the concave colonnaded river front), the London Eye
// (32 pods, one revolution every 30 minutes), St Thomas' Hospital, Jubilee Gardens, the Shell Centre, the
// Royal Festival Hall and a fogged skyline behind. Dossier §11.7–11.9.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { Merger, Instancer, makeMaterials, COL, signMat, bluePanel, waterNormalTexture, latheGeo, figureGeometry, scaleUV, hex, mulberry } from './kit.js';

export function buildThames(ctx, group, plan, state) {
  const { layout, collision, T, audio } = ctx; const mats = makeMaterials(ctx); const S = layout.STREET; const TH = S.thames;
  const M = new Merger(group, 'thames'); const I = new Instancer(group);
  const blk = (r, tag) => collision.addBlocker(r, tag);
  const WALL_X = S.riverWallX, WATER = TH.level, FAR_X = TH.xMax;

  // ================================================================ water
  const water = (() => {
    const nm = waterNormalTexture(T); nm.wrapS = nm.wrapT = THREE.RepeatWrapping; nm.repeat.set(1 / 14, 1 / 14);
    const mat = new THREE.MeshStandardMaterial({ color: COL.water, roughness: 0.32, metalness: 0.12, normalMap: nm, normalScale: new THREE.Vector2(0.55, 0.55), envMapIntensity: 1.6 });
    const g = new THREE.PlaneGeometry(FAR_X - WALL_X + 2, TH.zMax - TH.zMin); scaleUV(g, FAR_X - WALL_X + 2, TH.zMax - TH.zMin); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat); m.position.set((WALL_X + FAR_X) / 2 - 1, WATER, (TH.zMin + TH.zMax) / 2); m.receiveShadow = true; m.name = 'thames'; group.add(m);
    ctx.onUpdate((dt) => { nm.offset.x += dt * 0.0035; nm.offset.y -= dt * 0.006; });   // flow north (-z) with a slow drift
    return m;
  })();
  // river bed (mud) so nothing reads as a void at low water; the far bank wall
  M.chunk('river'); M.rect(mats.mud, { xMin: WALL_X - 2, xMax: FAR_X + 2, zMin: TH.zMin, zMax: TH.zMax }, WATER - 3.5);
  M.box(mats.concrete, 1.2, 10.5, TH.zMax - TH.zMin, { x: FAR_X + 0.6, y: -4.0, z: (TH.zMin + TH.zMax) / 2 });

  // ================================================================ the near river wall (granite ashlar, rounded coping) north and south of the bridge
  const wall = (z0, z1) => { M.box(mats.graniteDark, 1.6, 11, z1 - z0, { x: WALL_X + 0.2, y: -4.5, z: (z0 + z1) / 2, uvWorld: true }); M.box(mats.granite, 1.0, 1.1, z1 - z0, { x: WALL_X, y: 0.55, z: (z0 + z1) / 2, uvWorld: true }); M.cyl(mats.granite, 0.28, 0.28, z1 - z0, 10, { x: WALL_X, y: 1.1, z: (z0 + z1) / 2, rx: Math.PI / 2 }); blk({ xMin: WALL_X - 0.6, xMax: WALL_X + 1.2, yMin: -6, yMax: 1.5, zMin: z0, zMax: z1 }, 'riverWall'); };
  wall(plan.riverside.zMin, -77.5); wall(-72.5, S.bridge.zMin - 0.3);   // gap at the pier gangway
  wall(S.bridge.zMax + 0.3, 430);                                          // the Palace terrace and Victoria Tower Gardens
  M.rect(mats.paving, { xMin: S.palace.xMax, xMax: WALL_X, zMin: S.bridge.zMax, zMax: S.palace.zMax }, 0.02);   // the Terrace strip
  // lion-head mooring rings on the river face
  const ring = I.set(new THREE.TorusGeometry(0.22, 0.04, 6, 14), mats.ironBlack, { castShadow: false, name: 'mooring-rings' });
  for (let z = -20; z > plan.riverside.zMin; z -= 15) ring.add(WALL_X + 0.85, -0.9, z, { ry: Math.PI / 2 });
  // dolphin lamp standards along the parapet every 27 m
  const dolphin = dolphinLampGeometry(); const dolphinSet = I.set(dolphin.post, mats.ironBlack, { name: 'dolphin-lamps' }); const globeSet = I.set(dolphin.globe, mats.ledGlobe, { castShadow: false, name: 'dolphin-globes' });
  for (let z = -14; z > plan.riverside.zMin; z -= 27) { if (z > -80 && z < -68) continue; dolphinSet.add(WALL_X - 0.05, 1.1, z); globeSet.add(WALL_X - 0.05, 1.1, z); blk({ xMin: WALL_X - 0.7, xMax: WALL_X + 0.6, yMin: -1, yMax: 3, zMin: z - 0.6, zMax: z + 0.6 }, 'dolphinLamp'); }
  for (let z = 40; z < 420; z += 27) { dolphinSet.add(WALL_X - 0.05, 1.1, z); globeSet.add(WALL_X - 0.05, 1.1, z); }
  // Embankment flagpoles with Union flags
  { const flagMat = new THREE.MeshStandardMaterial({ map: unionFlagLite(T), side: THREE.DoubleSide, roughness: 0.9 });
    for (const z of [-30, -120]) { M.chunk('river'); M.cyl(mats.white, 0.06, 0.09, 9, 8, { x: WALL_X - 1.8, y: 4.5, z }); M.quad(flagMat, 2.4, 1.2, { x: WALL_X - 1.8 - 1.2, y: 8.2, z: z + 0.05, facing: 'south' }); blk({ xMin: WALL_X - 2.1, xMax: WALL_X - 1.5, yMin: -1, yMax: 3, zMin: z - 0.3, zMax: z + 0.3 }, 'flagpole'); } }

  // ================================================================ JLE vent grates (four 3.5 × 2 m panels + a strip), with the tunnel-air rumble
  { const V = S.ventGrates; const pitch = (V.zMax - V.zMin) / V.count; M.chunk('river');
    for (let i = 0; i < V.count; i++) { const z = V.zMin + (i + 0.5) * pitch; M.box(mats.grate, 2.0, 0.06, 3.5, { x: V.x, y: 0.03, z }); M.box(mats.steelGrey, 2.3, 0.02, 3.8, { x: V.x, y: 0.045, z }); }
    M.box(mats.grate, 0.5, 0.05, 12, { x: V.x + 2.2, y: 0.03, z: (V.zMin + V.zMax) / 2 });
    // (the warm-air rumble of the grates is emitted by the soundscape module — src/audio/soundscape.js — so it is not duplicated here)
    void audio; }

  // ================================================================ Westminster Pier: pontoon, shelter, gangway, kiosks, totem, moored river bus
  { const P = S.pier; M.chunk('pier'); const PY = WATER + 0.9;
    M.box(mats.busBlack, 46, 1.6, 12, { x: P.x, y: WATER + 0.1, z: P.z }); M.rect(mats.paving, { xMin: P.x - 22.5, xMax: P.x + 22.5, zMin: P.z - 5.5, zMax: P.z + 5.5 }, PY);
    M.box(mats.white, 30, 0.25, 5, { x: P.x, y: PY + 3.2, z: P.z + 1.5 }); for (let x = P.x - 14; x <= P.x + 14; x += 4) M.cyl(mats.steelGrey, 0.08, 0.08, 3.2, 8, { x, y: PY + 1.6, z: P.z + 3.8 }); M.quad(mats.glass, 30, 2.6, { x: P.x, y: PY + 1.7, z: P.z + 3.8, facing: 'north' });
    for (const [x0, x1, z] of [[P.x - 23, P.x + 23, P.z - 6], [P.x - 23, P.x + 23, P.z + 6]]) { M.box(mats.steelGrey, x1 - x0, 0.05, 0.05, { x: (x0 + x1) / 2, y: PY + 1.05, z }); for (let x = x0; x <= x1; x += 2) M.box(mats.steelGrey, 0.05, 1.05, 0.05, { x, y: PY + 0.52, z }); }
    M.quad(signMat(ctx, T.sign({ width: 1024, height: 200, bg: '#ffffff', lines: [{ text: 'WESTMINSTER PIER', x: 512, y: 145, size: 110, align: 'center', color: '#0d2a4a' }] }), { emissive: 0.4 }), 12, 2.2, { x: P.x, y: PY + 4.5, z: P.z + 1.5, facing: 'west' });
    // gangway (brow) from the parapet gap down to the pontoon
    const gx0 = WALL_X, gx1 = P.x - 23.5, gz = -75; const len = Math.hypot(gx1 - gx0, PY - 0); const ang = Math.atan2(0 - PY, gx1 - gx0);
    M.box(mats.steelGrey, len, 0.25, 2.6, { x: (gx0 + gx1) / 2, y: (0 + PY) / 2, z: gz, rz: -ang }); for (const s of [-1, 1]) { M.box(mats.steelGrey, len, 0.05, 0.05, { x: (gx0 + gx1) / 2, y: (0 + PY) / 2 + 1.05, z: gz + s * 1.3, rz: -ang }); }
    M.box(mats.steelGrey, 1.6, 2.6, 3.0, { x: WALL_X - 0.9, y: 1.3, z: gz - 0.0 }, false); M.quad(signMat(ctx, bluePanel(T, ['Westminster Pier', 'River Bus  ·  River Tours'], { width: 1024, height: 384 }), { emissive: 0.5 }), 1.5, 0.56, { x: WALL_X - 1.72, y: 2.2, z: gz, facing: 'west' });
    collision.addRamp(new THREE.Vector3(gx0 - 0.5, 0, gz), new THREE.Vector3(gx1, PY, gz), 2.4, { tag: 'pier:gangway', sound: 'metal' }); collision.addFloor({ xMin: P.x - 22.5, xMax: P.x + 22.5, zMin: P.z - 5.5, zMax: P.z + 5.5, y: PY, sound: 'metal', tag: 'pier:pontoon' });
    blk({ xMin: P.x - 23, xMax: P.x + 23, yMin: PY - 1, yMax: PY + 1.2, zMin: P.z - 6.4, zMax: P.z - 5.8 }, 'pier:railN'); blk({ xMin: P.x - 23, xMax: P.x + 23, yMin: PY - 1, yMax: PY + 1.2, zMin: P.z + 5.8, zMax: P.z + 6.4 }, 'pier:railS'); blk({ xMin: P.x + 22.4, xMax: P.x + 23.2, yMin: PY - 1, yMax: PY + 1.2, zMin: P.z - 6, zMax: P.z + 6 }, 'pier:railE'); blk({ xMin: P.x - 23.2, xMax: P.x - 22.4, yMin: PY - 1, yMax: PY + 1.2, zMin: P.z - 6, zMax: gz - 1.5 }, 'pier:railW1'); blk({ xMin: P.x - 23.2, xMax: P.x - 22.4, yMin: PY - 1, yMax: PY + 1.2, zMin: gz + 1.5, zMax: P.z + 6 }, 'pier:railW2');
    for (const s of [-1, 1]) blk({ xMin: gx0, xMax: gx1, yMin: -6, yMax: PY + 1.3, zMin: gz + s * 1.3 - 0.2 + (s > 0 ? 0 : 0), zMax: gz + s * 1.3 + 0.2 }, 'pier:gangwayRail');
    // kiosks on the riverside pavement (river tours / river bus) and the pier totem
    const kiosk = (x, z, body, label, bg) => { M.boxUp(body, 2.6, 2.3, 2.2, { x, y: 0, z }); M.box(mats.white, 2.8, 0.15, 2.4, { x, y: 2.35, z }); M.quad(signMat(ctx, T.sign({ width: 1024, height: 256, bg, lines: [{ text: label, x: 512, y: 170, size: 120, align: 'center', color: '#ffffff' }] }), { emissive: 0.45 }), 2.4, 0.6, { x: x - 1.32, y: 2.0, z, facing: 'west' }); M.quad(mats.glassDark, 2.0, 0.9, { x: x - 1.31, y: 1.2, z, facing: 'west' }); blk({ xMin: x - 1.3, xMax: x + 1.3, yMin: -1, yMax: 2.5, zMin: z - 1.1, zMax: z + 1.1 }, 'kiosk'); };
    kiosk(80, -66, mats.kioskRed, 'RIVER TOURS', '#b0201c'); kiosk(80, -84, mats.busBlack, 'RIVER BUS', '#111111');
    M.cyl(mats.tfLBlue, 0.5, 0.5, 3.0, 12, { x: 76, y: 1.5, z: -75 }); M.quad(signMat(ctx, bluePanel(T, ['Westminster Pier'], { width: 1024, height: 256, roundel: false, bg: '#0d2a4a' }), { emissive: 0.5 }), 1.6, 0.4, { x: 76, y: 2.6, z: -75 - 0.51, facing: 'north' }); blk({ xMin: 75.4, xMax: 76.6, yMin: -1, yMax: 3, zMin: -75.6, zMax: -74.4 }, 'pierTotem');
    // a river bus moored alongside (black hull, white superstructure)
    const boat = riverBus(mats); boat.position.set(P.x + 2, WATER, P.z + 14); boat.rotation.y = Math.PI / 2; group.add(boat); }

  // ================================================================ a river bus cruising downstream (north) and back
  { const boat = riverBus(mats); group.add(boat); let s = 0; const zA = 600, zB = -640; boat.position.set(190, WATER, zA); boat.rotation.y = Math.PI; state.boat = boat;
    ctx.onUpdate((dt) => { s += dt * 6.5; const t = (s % ((zA - zB) * 2)); const down = t < (zA - zB); const z = down ? zA - t : zB + (t - (zA - zB)); boat.position.set(down ? 190 : 230, WATER + Math.sin(s * 0.4) * 0.08, z); boat.rotation.y = down ? Math.PI : 0; }); }

  // ================================================================ County Hall (Ralph Knott, 1922) with the concave colonnaded river front, green copper roofs
  M.chunk('countyHall'); const CH = S.countyHall;
  M.boxUp(mats.facadeCountyHall, CH.xMax - CH.xMin - 8, CH.height, CH.zMax - CH.zMin, { x: (CH.xMin + 8 + CH.xMax) / 2, y: 0, z: (CH.zMin + CH.zMax) / 2, uvWorld: true });
  for (const [z0, z1] of [[CH.zMin, -125], [-75, CH.zMax]]) M.boxUp(mats.facadeCountyHall, 8, CH.height, z1 - z0, { x: CH.xMin + 4, y: 0, z: (z0 + z1) / 2, uvWorld: true });
  { const R = 50; const cg = new THREE.CylinderGeometry(R, R, CH.height, 32, 1, true, Math.PI / 3, Math.PI / 3); scaleUV(cg, R * Math.PI / 3, CH.height); cg.translate(0, CH.height / 2, 0); M.add(mats.facadeCountyHall, cg, { x: CH.xMin - R * Math.cos(Math.PI / 6), y: 0, z: -100 });
    for (let k = 0; k <= 12; k++) { const a = Math.PI / 3 + (Math.PI / 3) * k / 12; const x = CH.xMin - R * Math.cos(Math.PI / 6) + (R - 2.5) * Math.sin(a), z = -100 + (R - 2.5) * Math.cos(a); M.cyl(mats.portland, 0.9, 1.0, 16, 10, { x, y: 8 + 8, z }); } M.box(mats.portland, 2, 1.6, 52, { x: CH.xMin + 6, y: 24.8, z: -100 }); }
  M.box(mats.copper, CH.xMax - CH.xMin - 4, 0.3, CH.zMax - CH.zMin - 4, { x: (CH.xMin + CH.xMax) / 2, y: CH.height + 0.15, z: (CH.zMin + CH.zMax) / 2 });
  for (const z of [CH.zMin + 10, CH.zMax - 10]) M.cone(mats.copper, 9, 12, 4, { x: CH.xMin + 12, y: CH.height + 6, z, ry: Math.PI / 4 });
  M.add(mats.copper, roofPrism(CH.xMax - CH.xMin - 20, 30, 6), { x: (CH.xMin + CH.xMax) / 2 + 4, y: CH.height, z: (CH.zMin + CH.zMax) / 2 });
  blk({ ...CH, yMin: -1, yMax: CH.height }, 'countyHall');

  // ================================================================ the London Eye (32 capsules, 120 m diameter, one revolution per 30 minutes)
  { const E = S.londonEye; const eye = new THREE.Group(); eye.position.set(E.x, E.hubHeight, E.z); group.add(eye);
    const wheel = new THREE.Group(); eye.add(wheel);   // rotates about x (the wheel's plane is parallel to the river)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(E.radius, 1.1, 8, 72), mats.eyeWhite); rim.rotation.y = Math.PI / 2; wheel.add(rim);
    const rim2 = new THREE.Mesh(new THREE.TorusGeometry(E.radius - 2.2, 0.5, 6, 72), mats.eyeWhite); rim2.rotation.y = Math.PI / 2; wheel.add(rim2);
    const spokes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, E.radius - 3, 5), mats.steelGrey, 64); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const v = new THREE.Vector3();
    for (let i = 0; i < 64; i++) { const a = i * Math.PI / 32; q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), a); v.set(0, (E.radius - 3) / 2 + 1.5, 0).applyQuaternion(q); m4.compose(v, q, new THREE.Vector3(1, 1, 1)); spokes.setMatrixAt(i, m4); } spokes.instanceMatrix.needsUpdate = true; wheel.add(spokes);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 6, 16).rotateZ(Math.PI / 2), mats.eyeWhite); eye.add(hub);
    // A-frame legs on the land (east) side leaning on the hub, plus the boarding platform by the river
    for (const dz of [-14, 14]) { const a = new THREE.Vector3(0, 0, 0), b = new THREE.Vector3(38, -E.hubHeight, dz); const d = b.clone().sub(a); const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, d.length(), 10), mats.eyeWhite); leg.position.copy(a).add(b).multiplyScalar(0.5); leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); eye.add(leg); }
    for (const dz of [-8, 8]) { const b = new THREE.Vector3(-40, -E.hubHeight + 2, dz * 6); const d = b.clone(); const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, d.length(), 5), mats.steelGrey); cable.position.copy(b).multiplyScalar(0.5); cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); eye.add(cable); }
    const pods = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8).scale(2.0, 2.0, 4.0), mats.eyeGlass, 32); pods.castShadow = false; eye.add(pods);
    let angle = 0; const podR = E.radius + 2.6; const placePods = () => { for (let i = 0; i < 32; i++) { const a = angle + i * Math.PI / 16; v.set(0, Math.cos(a) * podR, Math.sin(a) * podR); m4.makeTranslation(v.x, v.y, v.z); pods.setMatrixAt(i, m4); } pods.instanceMatrix.needsUpdate = true; };
    placePods(); ctx.onUpdate((dt) => { angle += dt * (Math.PI * 2 / 1800); wheel.rotation.x = angle; placePods(); });
    M.chunk('southBank'); M.boxUp(mats.concrete, 30, 4, 60, { x: E.x - 30, y: 0, z: E.z }); M.rect(mats.paving, { xMin: FAR_X, xMax: E.x + 60, zMin: E.z - 80, zMax: E.z + 80 }, 0.0); state.eye = { group: eye, wheel, pods }; }

  // ================================================================ the South Bank: walkway, Jubilee Gardens, St Thomas' Hospital, the Shell Centre, the Festival Hall, a fogged skyline
  M.chunk('southBank');
  const SB = S.southBank;
  M.rect(mats.paving, { xMin: FAR_X, xMax: FAR_X + 22, zMin: SB.zMin, zMax: SB.zMax }, 0.0); collision.addFloor({ xMin: FAR_X, xMax: FAR_X + 22, zMin: SB.zMin, zMax: SB.zMax, y: 0, sound: 'pavement', tag: 'southBankWalk' });
  M.box(mats.steelGrey, 0.06, 1.1, SB.zMax - SB.zMin, { x: FAR_X + 0.4, y: 0.55, z: (SB.zMin + SB.zMax) / 2 }); blk({ xMin: FAR_X - 0.5, xMax: FAR_X + 0.6, yMin: -6, yMax: 1.5, zMin: SB.zMin, zMax: SB.zMax }, 'southBankRail');
  M.rect(mats.grass, { xMin: FAR_X + 22, xMax: 420, zMin: -330, zMax: -170 }, 0.05);   // Jubilee Gardens
  const bld = (r, h, mat, tag) => { M.boxUp(mat, r.xMax - r.xMin, h, r.zMax - r.zMin, { x: (r.xMin + r.xMax) / 2, y: 0, z: (r.zMin + r.zMax) / 2, uvWorld: true }); blk({ ...r, yMin: -1, yMax: h }, tag); };
  bld({ xMin: 348, xMax: 400, zMin: 60, zMax: 140 }, 46, mats.facadeModern, 'stThomas');           // St Thomas' Hospital north wing tower
  bld({ xMin: 348, xMax: 470, zMin: 140, zMax: 300 }, 22, mats.facadeModern, 'stThomasLow');
  bld({ xMin: 350, xMax: 470, zMin: 34, zMax: 60 }, 14, mats.facadeVictorianDark, 'stThomasOld');
  bld({ xMin: 420, xMax: 456, zMin: -330, zMax: -292 }, 107, mats.facadeModern, 'shellCentre');    // the Shell Centre tower
  bld({ xMin: 356, xMax: 470, zMin: -292, zMax: -240 }, 30, mats.facadeModern, 'shellLow');
  bld({ xMin: 336, xMax: 420, zMin: -455, zMax: -385 }, 32, mats.facadeModernDark, 'festivalHall');
  bld({ xMin: 470, xMax: 560, zMin: -200, zMax: 40 }, 34, mats.facadeModernDark, 'waterlooBlocks');
  // distant skyline blocks (fogged silhouettes)
  const sky = mulberry(23);
  for (const [x, z, w, d, h] of [[700, -320, 60, 60, 120], [640, 120, 50, 50, 85], [820, 40, 70, 60, 150], [560, -520, 60, 40, 70], [-420, -600, 80, 60, 60], [-200, -700, 90, 60, 55], [120, -820, 120, 60, 45], [420, -700, 70, 50, 90], [-620, 300, 60, 60, 50], [-500, 500, 90, 60, 40]]) M.boxUp(sky() < 0.5 ? mats.facadeModernDark : mats.facadeModern, w, h, d, { x, y: 0, z, uvWorld: true });

  M.flush(); I.flush();
  return { water };
}

/** Vulliamy dolphin lamp standard (1870): two dolphins around the base, fluted column, opal globe + crown. Feet at y = 0 (on the parapet coping). */
function dolphinLampGeometry() {
  const parts = [];
  const base = latheGeo([[0.55, 0], [0.55, 0.12], [0.42, 0.16], [0.4, 0.5], [0.3, 0.55], [0.14, 0.7], [0.12, 2.6], [0.16, 2.7], [0.12, 2.8], [0.1, 3.2]], 10); parts.push(base);
  for (const s of [-1, 1]) { const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(s * 0.55, 0.2, 0), new THREE.Vector3(s * 0.62, 0.7, 0.15), new THREE.Vector3(s * 0.45, 1.25, 0.05), new THREE.Vector3(s * 0.2, 1.5, -0.05), new THREE.Vector3(s * 0.32, 1.85, -0.2)]); const tube = new THREE.TubeGeometry(curve, 16, 0.11, 6, false); parts.push(tube); const head = new THREE.SphereGeometry(0.16, 7, 6); head.scale(1, 1, 1.5); head.translate(s * 0.32, 1.9, -0.25); parts.push(head); }
  const collar = new THREE.CylinderGeometry(0.2, 0.16, 0.2, 8); collar.translate(0, 3.3, 0); parts.push(collar);
  const crown = new THREE.ConeGeometry(0.16, 0.3, 8); crown.translate(0, 4.05, 0); parts.push(crown);
  const post = mergeAll(parts);
  const globe = new THREE.SphereGeometry(0.28, 12, 10); globe.translate(0, 3.65, 0);
  return { post, globe };
}
/** Thames river bus: black hull, white superstructure, dark window band. Local -z forward, water line at y = 0. */
function riverBus(mats) {
  const g = new THREE.Group(); const M = new Merger(g, 'boat');
  M.box(mats.busBlack, 7.2, 1.6, 34, { x: 0, y: 0.5, z: 0 });
  { const bow = new THREE.Shape(); bow.moveTo(-3.6, 0); bow.lineTo(3.6, 0); bow.lineTo(0.6, -5.5); bow.lineTo(-0.6, -5.5); bow.closePath(); const bg = new THREE.ExtrudeGeometry(bow, { depth: 1.6, bevelEnabled: false }); bg.rotateX(Math.PI / 2); bg.translate(0, 1.3, -17); M.add(mats.busBlack, bg); M.box(mats.white, 5.4, 0.12, 4.0, { x: 0, y: 1.36, z: -18.5 }); }
  M.box(mats.white, 6.4, 2.2, 24, { x: 0, y: 2.4, z: 1 }); M.box(mats.glassDark, 6.5, 0.9, 22, { x: 0, y: 2.6, z: 1 }); M.box(mats.white, 5.0, 1.2, 7, { x: 0, y: 4.1, z: -6 }); M.box(mats.glassDark, 5.1, 0.6, 6, { x: 0, y: 4.2, z: -6 });
  M.box(mats.red, 0.5, 0.5, 0.5, { x: 0, y: 4.9, z: -8 }); M.cyl(mats.steelGrey, 0.05, 0.05, 3, 6, { x: 0, y: 6, z: 8 });
  M.flush({ castShadow: false }); return g;
}
function roofPrism(w, len, rise) { const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, rise); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2); scaleUV(g, 0.2, 0.2); return g; }
function mergeAll(parts) { const np = parts.map(g => g.toNonIndexed()); let total = 0; np.forEach(g => total += g.attributes.position.count); const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3), uv = new Float32Array(total * 2); let o = 0; for (const g of np) { pos.set(g.attributes.position.array, o * 3); nrm.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g; }
function unionFlagLite(T) { const c = T.canvas(256, 128); const x = c.getContext('2d'); x.fillStyle = '#012169'; x.fillRect(0, 0, 256, 128); x.strokeStyle = '#fff'; x.lineWidth = 24; x.beginPath(); x.moveTo(0, 0); x.lineTo(256, 128); x.moveTo(256, 0); x.lineTo(0, 128); x.stroke(); x.strokeStyle = '#c8102e'; x.lineWidth = 8; x.beginPath(); x.moveTo(0, 0); x.lineTo(256, 128); x.moveTo(256, 0); x.lineTo(0, 128); x.stroke(); x.fillStyle = '#fff'; x.fillRect(108, 0, 40, 128); x.fillRect(0, 44, 256, 40); x.fillStyle = '#c8102e'; x.fillRect(116, 0, 24, 128); x.fillRect(0, 52, 256, 24); return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping }); }
void figureGeometry; void hex;
