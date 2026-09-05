// ---------------------------------------------------------------------------
// street/whitehall.js — the backdrop north and west of the station: Norman Shaw South and North (banded red
// brick and Portland, corner turrets) behind Portcullis House, 1 Parliament Street and the Victorian row up
// the east side of Parliament Street (St Stephen's Tavern on the corner, the Red Lion), the Ministry of
// Defence and the Whitehall blocks, HM Treasury (Government Offices Great George Street) with its curved
// corner onto Parliament Square, the Foreign Office and the Cabinet Office up the west side, Parliament
// Square with its twelve statues (Churchill at the north-east corner), Middlesex Guildhall (the Supreme
// Court), Westminster Abbey and St Margaret's beyond. Dossier §11.10.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { Merger, Instancer, makeMaterials, signMat, nameplate, figureGeometry, ridgeRoofGeometry, scaleUV, mulberry, DEG } from './kit.js';

export function buildWhitehall(ctx, group, plan, state) {
  const { layout, collision, T } = ctx; const mats = makeMaterials(ctx); const S = layout.STREET;
  const M = new Merger(group, 'whitehall'); const I = new Instancer(group);
  const blk = (r, tag) => collision.addBlocker(r, tag);
  const block = (r, h, mat, tag, { roof = 'flat', roofMat = mats.chimney, roofH = 3, cornice = true } = {}) => {
    M.boxUp(mat, r.xMax - r.xMin, h, r.zMax - r.zMin, { x: (r.xMin + r.xMax) / 2, y: 0, z: (r.zMin + r.zMax) / 2, uvWorld: true });
    if (cornice) M.box(mats.portland, r.xMax - r.xMin + 0.8, 0.7, r.zMax - r.zMin + 0.8, { x: (r.xMin + r.xMax) / 2, y: h - 0.35, z: (r.zMin + r.zMax) / 2 });
    if (roof === 'mansard') { const w = r.xMax - r.xMin, d = r.zMax - r.zMin; const g = new THREE.CylinderGeometry(Math.min(w, d) * 0.28, Math.max(w, d) * 0.72, roofH, 4, 1); g.rotateY(Math.PI / 4); g.scale(w / Math.max(w, d), 1, d / Math.max(w, d)); M.add(roofMat, g, { x: (r.xMin + r.xMax) / 2, y: h + roofH / 2, z: (r.zMin + r.zMax) / 2 }); }
    else if (roof === 'pitched') { const w = r.xMax - r.xMin, d = r.zMax - r.zMin; M.add(roofMat, ridgeRoofGeometry(Math.min(w, d), Math.max(w, d), roofH, d >= w), { x: (r.xMin + r.xMax) / 2, y: h, z: (r.zMin + r.zMax) / 2 }); }
    blk({ ...r, yMin: -0.5, yMax: h }, tag);
  };
  const chimneyStack = I.set(new THREE.BoxGeometry(1.2, 2.4, 0.8).translate(0, 1.2, 0), mats.brickStack || mats.chimney, { name: 'stacks' });

  // ================================================================ Norman Shaw South / North (behind PH) and the Curtis Green block
  M.chunk('normanShaw');
  const NS = S.normanShaw; block(NS, NS.height, mats.facadeBrick, 'normanShawS', { roof: 'mansard', roofMat: mats.spireIron, roofH: 6 });
  const NSN = { xMin: NS.xMin, xMax: NS.xMax, zMin: NS.zMin - 65, zMax: NS.zMin - 8 }; block(NSN, NS.height, mats.facadeBrick, 'normanShawN', { roof: 'mansard', roofMat: mats.spireIron, roofH: 6 });
  M.rect(mats.paving, { xMin: NS.xMin, xMax: NS.xMax, zMin: NSN.zMax, zMax: NS.zMin }, 0.01);
  for (const B of [NS, NSN]) for (const [sx, sz] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const x = sx ? B.xMax - 3 : B.xMin + 3, z = sz ? B.zMax - 3 : B.zMin + 3; M.cyl(mats.facadeBrick, 3.4, 3.4, NS.height + 4, 12, { x, y: (NS.height + 4) / 2, z }); M.cone(mats.spireIron, 3.8, 6, 12, { x, y: NS.height + 7, z }); }
  for (const B of [NS, NSN]) for (let x = B.xMin + 8; x < B.xMax; x += 12) { chimneyStack.add(x, NS.height + 5, B.zMin + 8); chimneyStack.add(x, NS.height + 5, B.zMax - 8); }
  block({ xMin: NS.xMin, xMax: NS.xMax + 6, zMin: -240, zMax: NSN.zMin - 6 }, 28, mats.facadeBaroque, 'curtisGreen', { roof: 'mansard', roofMat: mats.spireIron, roofH: 5 });
  block({ xMin: -70, xMax: 44, zMin: -335, zMax: -248 }, 36, mats.facadeBaroque, 'mod', { roof: 'flat' });   // Ministry of Defence main building
  block({ xMin: -70, xMax: -40, zMin: -380, zMax: -340 }, 24, mats.facadeModern, 'whitehallN1');

  // ================================================================ 1 Parliament Street and the east side of Parliament Street
  M.chunk('parliamentStE');
  const OPS = S.oneParliamentStreet; block(OPS, OPS.height, mats.facadeVictorian, 'oneParliamentStreet', { roof: 'mansard', roofMat: mats.spireIron, roofH: 5 });
  for (let x = OPS.xMin + 4; x < OPS.xMax; x += 6) chimneyStack.add(x, OPS.height + 4.4, OPS.zMin + 6);
  // St Stephen's Tavern on the corner (dark green pub frontage), and the ground-floor shopfronts along Bridge Street
  const pubTex = T.sign({ width: 1024, height: 160, bg: '#1e3d2b', border: { color: '#c9a227', width: 6 }, lines: [{ text: "ST STEPHEN'S TAVERN", x: 512, y: 112, size: 84, align: 'center', color: '#e9d8a6' }] });
  M.quad(signMat(ctx, pubTex, { emissive: 0.35 }), 9, 1.2, { x: OPS.xMin + 5.5, y: 3.9, z: OPS.zMax + 0.03, facing: 'south' }); M.quad(signMat(ctx, pubTex, { emissive: 0.35 }), 9, 1.2, { x: OPS.xMin - 0.03, y: 3.9, z: OPS.zMax - 6, facing: 'west' });
  M.box(mats.ironGreenDark, 12, 4.4, 0.25, { x: OPS.xMin + 6, y: 2.2, z: OPS.zMax + 0.05 }); M.quad(mats.glassDark, 10, 2.4, { x: OPS.xMin + 6, y: 1.9, z: OPS.zMax + 0.2, facing: 'south' });
  M.box(mats.ironGreenDark, 0.25, 4.4, 12, { x: OPS.xMin - 0.05, y: 2.2, z: OPS.zMax - 6 }); M.quad(mats.glassDark, 10, 2.4, { x: OPS.xMin - 0.2, y: 1.9, z: OPS.zMax - 6, facing: 'west' });
  M.quad(signMat(ctx, nameplate(T, 'PARLIAMENT STREET'), { emissive: 0.35 }), 1.3, 0.4, { x: OPS.xMin - 0.03, y: 3.0, z: OPS.zMax - 1.2, facing: 'west' });
  block({ xMin: OPS.xMin, xMax: OPS.xMax, zMin: -120, zMax: OPS.zMin - 3 }, 24, mats.facadeVictorianDark, 'derbyGate', { roof: 'mansard', roofMat: mats.spireIron, roofH: 4.5 });
  M.rect(mats.paving, { xMin: OPS.xMin, xMax: OPS.xMax, zMin: OPS.zMin - 3, zMax: OPS.zMin }, 0.01);   // Derby Gate (lane)
  block({ xMin: OPS.xMin, xMax: OPS.xMax, zMin: -175, zMax: -124 }, 22, mats.facadeVictorian, 'redLion', { roof: 'mansard', roofMat: mats.spireIron, roofH: 4 });   // 53 Parliament St / the Red Lion
  M.quad(signMat(ctx, T.sign({ width: 1024, height: 160, bg: '#8b1a1a', lines: [{ text: 'THE RED LION', x: 512, y: 112, size: 90, align: 'center', color: '#f3e6c3' }] }), { emissive: 0.35 }), 7, 1.1, { x: OPS.xMin - 0.03, y: 4.0, z: -160, facing: 'west' });
  block({ xMin: OPS.xMin, xMax: OPS.xMax + 20, zMin: -240, zMax: -180 }, 18, mats.facadeModern, 'richmondHouse');

  // ================================================================ HM Treasury (GOGGS), Foreign Office, Cabinet Office — west side
  M.chunk('treasury');
  const TR = { xMin: -300, xMax: -108, zMin: -100, zMax: -8 }; const TRH = 30;
  block({ xMin: TR.xMin, xMax: TR.xMax - 12, zMin: TR.zMin, zMax: TR.zMax }, TRH, mats.facadeBaroque, 'treasury', { roof: 'mansard', roofMat: mats.copper, roofH: 6 });
  block({ xMin: TR.xMax - 14, xMax: TR.xMax, zMin: TR.zMin, zMax: TR.zMax - 12 }, TRH, mats.facadeBaroque, 'treasuryE', { cornice: true });
  { const cg = new THREE.CylinderGeometry(12, 12, TRH, 24, 1, false, 0, Math.PI / 2); scaleUV(cg, 2 * Math.PI * 12 / 4, TRH); cg.translate(0, TRH / 2, 0); M.add(mats.facadeBaroque, cg, { x: TR.xMax - 12, y: 0, z: TR.zMax - 12, ry: 0 }); M.cyl(mats.portland, 12.6, 12.6, 0.7, 24, { x: TR.xMax - 12, y: TRH - 0.35, z: TR.zMax - 12 }); M.cyl(mats.copper, 6, 11, 5, 24, { x: TR.xMax - 12, y: TRH + 2.5, z: TR.zMax - 12 }); }
  block({ xMin: TR.xMin, xMax: TR.xMax, zMin: -232, zMax: -110 }, 32, mats.facadeBaroque, 'foreignOffice', { roof: 'mansard', roofMat: mats.spireIron, roofH: 5 });
  block({ xMin: TR.xMin, xMax: TR.xMax, zMin: -380, zMax: -242 }, 24, mats.facadeVictorian, 'cabinetOffice', { roof: 'mansard', roofMat: mats.spireIron, roofH: 4 });
  M.rect(mats.paving, { xMin: TR.xMin, xMax: TR.xMax, zMin: -242, zMax: -232 }, 0.01); M.rect(mats.paving, { xMin: TR.xMin, xMax: TR.xMax, zMin: -110, zMax: -100 }, 0.01);   // King Charles Street / the gaps
  M.quad(signMat(ctx, nameplate(T, 'GREAT GEORGE STREET'), { emissive: 0.35 }), 1.3, 0.4, { x: TR.xMax - 30, y: 3.0, z: TR.zMax + 0.03, facing: 'south' });

  // ================================================================ Parliament Square: lawn edging, the twelve statues, Middlesex Guildhall, the Abbey, St Margaret's
  M.chunk('square');
  const SQ = plan.squareLawn; M.box(mats.granite, SQ.xMax - SQ.xMin + 0.6, 0.25, 0.3, { x: (SQ.xMin + SQ.xMax) / 2, y: 0.125, z: SQ.zMin }); M.box(mats.granite, SQ.xMax - SQ.xMin + 0.6, 0.25, 0.3, { x: (SQ.xMin + SQ.xMax) / 2, y: 0.125, z: SQ.zMax }); M.box(mats.granite, 0.3, 0.25, SQ.zMax - SQ.zMin, { x: SQ.xMin, y: 0.125, z: (SQ.zMin + SQ.zMax) / 2 }); M.box(mats.granite, 0.3, 0.25, SQ.zMax - SQ.zMin, { x: SQ.xMax, y: 0.125, z: (SQ.zMin + SQ.zMax) / 2 });
  const statue = I.set(figureGeometry(), mats.bronzeStatue, { name: 'square-statues' });
  const plinth = (x, z, ry, scale, ph, name) => { M.boxUp(mats.granite, 1.6 * scale, ph, 1.6 * scale, { x, y: 0, z }); statue.add(x, ph, z, { ry, s: scale }); M.quad(signMat(ctx, T.sign({ width: 512, height: 128, bg: '#5c5a55', lines: [{ text: name, x: 256, y: 92, size: 64, align: 'center', color: '#e8e4da' }] }), { emissive: 0.2 }), 1.3 * scale, 0.32 * scale, { x, y: ph * 0.55, z: z + 0.8 * scale + 0.02, facing: 'south' }); blk({ xMin: x - 0.9 * scale, xMax: x + 0.9 * scale, yMin: -0.5, yMax: ph + 2, zMin: z - 0.9 * scale, zMax: z + 0.9 * scale }, 'statue'); };
  plinth(S.churchill.x, S.churchill.z, Math.PI * 0.75, 2.0, 2.4, 'CHURCHILL');
  const others = [['LLOYD GEORGE', -118, 14], ['SMUTS', -130, 12], ['PALMERSTON', -150, 12], ['DERBY', -170, 12], ['DISRAELI', -186, 22], ['PEEL', -186, 42], ['CANNING', -186, 62], ['LINCOLN', -186, 82], ['MANDELA', -170, 92], ['GANDHI', -150, 92], ['FAWCETT', -130, 92]];
  for (const [n, x, z] of others) plinth(x, z, Math.atan2(-x - 150, -z + 50), 1.4, 2.0, n);
  // trees on the west side of the lawn
  if (state.trees) for (const [x, z] of [[-178, 30], [-176, 55], [-178, 80], [-160, 20], [-162, 85]]) state.trees.tree(x, z, 5.5, 4.2);
  block({ xMin: -230, xMax: -195, zMin: 10, zMax: 95 }, 28, mats.facadeVictorianDark, 'supremeCourt', { roof: 'mansard', roofMat: mats.spireIron, roofH: 6 });
  { const x = -195 - 6, z = 52; M.boxUp(mats.facadeVictorianDark, 9, 40, 9, { x, y: 0, z, uvWorld: true }); M.cone(mats.spireIron, 6, 9, 4, { x, y: 44.5, z, ry: Math.PI / 4 }); }   // the Guildhall's central tower
  // Westminster Abbey: nave, north transept with the rose window, the crossing lantern, the two west towers (69 m); St Margaret's in front
  M.chunk('abbey');
  const AB = { xMin: -205, xMax: -125, zMin: 150, zMax: 200 };
  M.boxUp(mats.towerFace, AB.xMax - AB.xMin, 31, AB.zMax - AB.zMin, { x: (AB.xMin + AB.xMax) / 2, y: 0, z: (AB.zMin + AB.zMax) / 2, uvWorld: true }); blk({ ...AB, yMin: -0.5, yMax: 31 }, 'abbey');
  M.add(mats.spireIron, ridgeRoofGeometry(AB.zMax - AB.zMin, AB.xMax - AB.xMin, 9, false), { x: (AB.xMin + AB.xMax) / 2, y: 31, z: (AB.zMin + AB.zMax) / 2 });
  M.boxUp(mats.towerFace, 18, 34, 22, { x: -150, y: 0, z: AB.zMin - 10, uvWorld: true }); M.cyl(mats.prussian, 4.5, 4.5, 0.3, 24, { x: -150, y: 25, z: AB.zMin - 21.1, rx: Math.PI / 2 }); M.torus(mats.anstonDark, 4.7, 0.3, 6, 24, { x: -150, y: 25, z: AB.zMin - 21 });   // north transept + rose window
  M.boxUp(mats.anston, 14, 44, 14, { x: -160, y: 0, z: 175, uvWorld: true }); M.cone(mats.spireIron, 10, 8, 4, { x: -160, y: 48, z: 175, ry: Math.PI / 4 });   // crossing lantern
  for (const z of [AB.zMin + 6, AB.zMax - 6]) { M.boxUp(mats.towerFace, 11, 69, 11, { x: AB.xMin - 2, y: 0, z, uvWorld: true }); M.box(mats.anstonDark, 12.2, 1.2, 12.2, { x: AB.xMin - 2, y: 69.6, z }); for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.cone(mats.anstonDark, 1.1, 6, 8, { x: AB.xMin - 2 + sx * 4.6, y: 73, z: z + sz * 4.6 }); }
  M.boxUp(mats.towerFace, 40, 16, 12, { x: -165, y: 0, z: 128, uvWorld: true }); M.boxUp(mats.towerFace, 7, 26, 7, { x: -182, y: 0, z: 128, uvWorld: true }); blk({ xMin: -190, xMax: -145, yMin: -0.5, yMax: 16, zMin: 122, zMax: 134 }, 'stMargarets');   // St Margaret's church

  M.flush(); I.flush();
  return {};
}
void mulberry; void DEG;
