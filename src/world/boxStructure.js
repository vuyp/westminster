// ---------------------------------------------------------------------------
// boxStructure.js — the structural shell of the Jubilee box (dossier §5.1–§5.3):
//   * diaphragm walls (rough, earth-cast cell backs) with the 2.5 m grillage of
//     buttresses and walings on the two long walls, plain end walls;
//   * the 2 m centreline columns at 11.8 m c/c (cast collars where the struts pass,
//     blue mosaic bands 1.1–1.4 m above every floor, ring-mounted uplighter/spot
//     brackets) and the 1 m secondaries in the open section;
//   * the 660 mm solid forged-steel struts across the 26 m width at
//     JUBILEE.strutLevels, tubular diagonal braces with forked clevis ends, the
//     discrete steel support structures carrying the escalator trusses, tie rods;
//   * the base slab with its maintenance walkway, the coffered concourse-slab
//     soffit (the lid), and the D&C underpinning-slab soffit over the west section.
// Everything is merged per material; nothing here animates. Clearance of the
// steelwork from slabs, escalators, the stair and the lift is checked against the
// plan handed in by jubileeBox.js so a layout change re-threads the structure.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { LEVELS, JUBILEE, PALETTE } from '../core/layout.js';
import { Bucket, tubeGeo, boxGeo, plainBox, xzQuad, xyQuad, yzQuad, polyQuad, bandGeo, rectPoly, inRect, R } from './boxKit.js';

const BOX = JUBILEE.box;
export const GRILLAGE = { buttressW: 2.5, buttressD: 2.5, ribW: 1.4, ribD: 1.6, walingH: 1.4, walingD: 1.4 };
export const STRUT_R = 0.33;

/**
 * plan = {
 *   slabs: [{ y, rect }],                 // walkable slab tops (for headroom checks)
 *   solids: [{ rect, yMin, yMax }],       // volumes steel must avoid (stair zone, lift shaft …)
 *   banks: [escalatorFrame],              // the escalator runs
 *   passages: [{ x, width, levels: [y] }],
 *   cutting: rect, alcove: rect,          // bank (a) cutting through the east wall; bank (c) alcove in the west wall
 *   stairZone: rect, liftRect: rect,
 *   undercroft: { y, rect, holes: [poly] },   // D&C underpinning soffit over the west section
 *   lidHoles: [rect],
 * }
 */
export function buildStructure(ctx, parent, K, plan) {
  const { T } = ctx; const { mats } = K;
  const B = new Bucket();
  const g = new THREE.Group(); g.name = 'boxStructure'; parent.add(g);
  const Y0 = BOX.floor, Y1 = BOX.top;
  const primaryX = JUBILEE.columns.x.slice();
  const secondaryX = []; for (let i = 0; i < primaryX.length - 1; i++) { const mx = (primaryX[i] + primaryX[i + 1]) / 2; if (mx > JUBILEE.voidX.min - 0.5 && mx < JUBILEE.voidX.max + 0.5) secondaryX.push(mx); }
  const ribX = []; for (let i = 0; i < primaryX.length - 1; i++) ribX.push((primaryX[i] + primaryX[i + 1]) / 2);
  const colZ = JUBILEE.columns.z; const colR = JUBILEE.columns.diameter / 2, secR = JUBILEE.columns.secondaryDiameter / 2;
  const nFace = BOX.zMin, sFace = BOX.zMax;            // inside faces of the long walls
  const nButt = nFace + GRILLAGE.buttressD, sButt = sFace - GRILLAGE.buttressD;   // buttress faces the struts bear on
  const levels = JUBILEE.strutLevels.slice().sort((a, b) => b - a);

  // ---- clearance helpers ------------------------------------------------------------------------------------------
  const slabHeadroom = 2.75;
  const pointClear = (x, y, z, { below = 1.4, above = 2.7 } = {}) => {
    for (const s of plan.slabs) if (inRect(s.rect, x, z) && y > s.y - 0.35 && y < s.y + slabHeadroom) return false;
    for (const s of plan.solids) if (inRect(s.rect, x, z) && y > s.yMin && y < s.yMax) return false;
    for (const f of plan.banks) if (f.clashes(x, y, z, { below, above })) return false;
    return true;
  };
  const segmentClear = (a, b, step = 0.5, opts) => { const n = Math.max(1, Math.ceil(a.distanceTo(b) / step)); const p = new THREE.Vector3(); for (let i = 0; i <= n; i++) { p.lerpVectors(a, b, i / n); if (!pointClear(p.x, p.y, p.z, opts)) return false; } return true; };
  const slabAt = (x, z, yMax) => { let best = null; for (const s of plan.slabs) if (inRect(s.rect, x, z) && s.y <= yMax + 0.01 && (best == null || s.y > best)) best = s.y; return best; };

  // ---- 1. wall faces (diaphragm concrete) with openings --------------------------------------------------------------
  const wallFaces = [];
  // north face z = zMin (facing +z/south), full; south face with the passages and the west-section arcade; end walls with the cutting / alcove
  wallFaces.push(verticalPoly('xy', nFace, [BOX.xMin, Y0, BOX.xMax, Y1], plan.dcHoleN ? [[plan.dcHoleN.xMin, plan.dcHoleN.yMin, plan.dcHoleN.xMax, plan.dcHoleN.yMax]] : [], 'south'));   // pierced at District level where Platform 2 crosses
  {
    const holes = [];
    for (const p of plan.passages) for (const y of p.levels) holes.push([p.x - p.width / 2, y - 0.05, p.x + p.width / 2, y + 3.0]);
    if (plan.arcade) holes.push([plan.arcade.xMin, plan.arcade.yMin, plan.arcade.xMax, plan.arcade.yMax]);
    if (plan.dcHoleS) holes.push([plan.dcHoleS.xMin, plan.dcHoleS.yMin, plan.dcHoleS.xMax, plan.dcHoleS.yMax]);   // pierced at District level where Platform 1 crosses
    wallFaces.push(verticalPoly('xy', sFace, [BOX.xMin, Y0, BOX.xMax, Y1], holes, 'north'));
  }
  wallFaces.push(verticalPoly('zy', BOX.xMax, [BOX.zMin, Y0, BOX.zMax, Y1], plan.cutting ? [[plan.cutting.zMin, plan.cutting.yMin, plan.cutting.zMax, plan.cutting.yMax]] : [], 'west'));
  wallFaces.push(verticalPoly('zy', BOX.xMin, [BOX.zMin, Y0, BOX.zMax, Y1], [...(plan.alcove ? [[plan.alcove.zMin, plan.alcove.yMin, plan.alcove.zMax, plan.alcove.yMax]] : []), ...(plan.dcHoleW ? [[plan.dcHoleW.zMin, plan.dcHoleW.yMin, plan.dcHoleW.zMax, plan.dcHoleW.yMax]] : [])], 'east'));
  for (const w of wallFaces) B.add(w, mats.diaphragm);
  // passage reveals (jambs + soffit) through the 1.2 m wall, in the smooth concrete
  for (const p of plan.passages) for (const y of p.levels) { const x0 = p.x - p.width / 2, x1 = p.x + p.width / 2; B.add(yzQuad(x0, y - 0.05, y + 3.0, sFace - 0.05, sFace + BOX.wallThickness, 'east'), mats.grillage); B.add(yzQuad(x1, y - 0.05, y + 3.0, sFace - 0.05, sFace + BOX.wallThickness, 'west'), mats.grillage); B.add(xzQuad(y + 3.0, x0, x1, sFace - 0.05, sFace + BOX.wallThickness, 'down'), mats.grillage); }
  // bank (a) cutting through the east wall: walls, soffit under the concourse slab, end wall
  if (plan.cutting) { const c = plan.cutting; B.add(xyQuad(c.zMin, BOX.xMax - 0.05, c.xMax, c.yMin, c.yMax + 1.0, 'south'), mats.grillage); B.add(xyQuad(c.zMax, BOX.xMax - 0.05, c.xMax, c.yMin, c.yMax + 1.0, 'north'), mats.grillage); B.add(yzQuad(c.xMax, c.yMin, c.yMax + 1.0, c.zMin, c.zMax, 'west'), mats.grillage); if (c.soffit) B.add(polyQuad(c.soffit.y, rectPoly(R(BOX.xMax - 0.05, c.xMax, c.zMin, c.zMax)), c.soffit.holes || [], 'down'), mats.precast); }
  // bank (c) alcove in the west wall
  if (plan.alcove) { const a = plan.alcove; B.add(yzQuad(a.xMin, a.yMin, a.yMax, a.zMin, a.zMax, 'east'), mats.diaphragm); B.add(xyQuad(a.zMin, a.xMin, BOX.xMin + 0.05, a.yMin, a.yMax, 'south'), mats.grillage); B.add(xyQuad(a.zMax, a.xMin, BOX.xMin + 0.05, a.yMin, a.yMax, 'north'), mats.grillage); B.add(xzQuad(a.yMax, a.xMin, BOX.xMin + 0.05, a.zMin, a.zMax, 'down'), mats.precast); }

  // ---- 2. grillage: buttresses (primary column lines), ribs (secondary lines), walings ---------------------------------
  // Where the District & Circle platforms cross the box (plan.dcHoleN on the north wall, plan.dcHoleS on the south), the grillage is
  // interrupted through the platform band: buttresses are split above/below it and walings in the band are omitted.
  const cutFor = (side) => (side < 0 ? plan.dcHoleN : plan.dcHoleS) || null;
  const inCutX = (cut, x, w) => cut && x + w / 2 > cut.xMin && x - w / 2 < cut.xMax;
  const butt = (x, w, d, side) => {
    const z0 = side < 0 ? nFace : sFace - d, z1 = side < 0 ? nFace + d : sFace; const zc = (z0 + z1) / 2; const cut = cutFor(side);
    if (!inCutX(cut, x, w)) return [boxGeo(T, w, Y1 - Y0, d, { x, y: (Y0 + Y1) / 2, z: zc })];
    const parts = [];
    if (cut.yMin > Y0 + 0.1) parts.push(boxGeo(T, w, cut.yMin - Y0, d, { x, y: (Y0 + cut.yMin) / 2, z: zc }));
    if (cut.yMax < Y1 - 0.1) parts.push(boxGeo(T, w, Y1 - cut.yMax, d, { x, y: (cut.yMax + Y1) / 2, z: zc }));
    return parts;
  };
  for (const side of [-1, 1]) {
    for (const x of primaryX) for (const g of butt(x, GRILLAGE.buttressW, GRILLAGE.buttressD, side)) B.add(g, mats.grillage);
    for (const x of ribX) for (const g of butt(x, GRILLAGE.ribW, GRILLAGE.ribD, side)) B.add(g, mats.grillage);
    // walings between the verticals at each strut level (+ a top waling under the lid), skipped where a slab sits within head height
    const verts = [...primaryX.map(x => ({ x, w: GRILLAGE.buttressW })), ...ribX.map(x => ({ x, w: GRILLAGE.ribW }))].sort((a, b) => a.x - b.x);
    const walingLevels = [...levels, Y1 - 3.2];
    for (const L of walingLevels) for (let i = 0; i < verts.length - 1; i++) {
      const x0 = verts[i].x + verts[i].w / 2, x1 = verts[i + 1].x - verts[i + 1].w / 2; const xm = (x0 + x1) / 2;
      const zc = side < 0 ? nFace + GRILLAGE.walingD / 2 : sFace - GRILLAGE.walingD / 2;
      const s = slabAt(xm, zc + side * -1.2, L + 0.5); if (s != null && L - s < slabHeadroom && L - s > -0.9) continue;    // would be a ledge at head height
      if (plan.arcade && side > 0 && xm > plan.arcade.xMin && xm < plan.arcade.xMax && L > plan.arcade.yMin - 1 && L < plan.arcade.yMax + 0.5) continue;
      { const cut = cutFor(side); if (cut && xm > cut.xMin - 1 && xm < cut.xMax + 1 && L > cut.yMin - GRILLAGE.walingH && L < cut.yMax + GRILLAGE.walingH) continue; }   // platform band
      B.add(boxGeo(T, x1 - x0 + 0.02, GRILLAGE.walingH, GRILLAGE.walingD, { x: xm, y: L, z: zc }), mats.grillage);
    }
    // corner returns at the end walls: a slimmer pilaster
    for (const x of [BOX.xMin + 0.5, BOX.xMax - 0.5]) for (const g of butt(x, 1.0, GRILLAGE.ribD, side)) B.add(g, mats.grillage);
  }
  // end-wall pilasters (the underpinning beams of Portcullis House's end walls come down as flat ribs), clear of the cutting / alcove
  for (const x of [BOX.xMin, BOX.xMax]) for (const z of [BOX.zMin + 6.5, colZ, BOX.zMax - 6.5]) {
    const sx = x < 0 ? 1 : -1; const op = x < 0 ? plan.alcove : plan.cutting; if (op && z > op.zMin - 1.3 && z < op.zMax + 1.3) continue;
    B.add(boxGeo(T, 0.9, Y1 - Y0, 2.2, { x: x + sx * 0.45, y: (Y0 + Y1) / 2, z }), mats.grillage);
  }

  // ---- 3. columns -----------------------------------------------------------------------------------------------------
  const colGeo = (x, r, y0, y1, seg = 36) => { const c = new THREE.CylinderGeometry(r, r, y1 - y0, seg, 1, true); c.translate(x, (y0 + y1) / 2, colZ); const uv = c.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * r, uv.getY(i) * (y1 - y0)); return c; };
  const columns = [...primaryX.map(x => ({ x, r: colR, primary: true })), ...secondaryX.map(x => ({ x, r: secR, primary: false }))];
  const strutsKept = [];   // { x, L }
  for (const c of columns) {
    B.add(colGeo(c.x, c.r, Y0, Y1), mats.grillage);
    // floors this column passes through → mosaic band 1.1–1.4 m above each
    const floors = new Set([Y0]); for (const s of plan.slabs) if (inRect(s.rect, c.x, colZ) && !(s.holes || []).some(h => inRect(h, c.x, colZ))) floors.add(s.y);
    for (const fy of floors) { const band = new THREE.CylinderGeometry(c.r + 0.012, c.r + 0.012, 0.3, 36, 1, true); band.translate(c.x, fy + 1.25, colZ); const uv = band.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * c.r, uv.getY(i) * 0.3); B.add(band, mats.mosaic); }
    // uplighter / spot ring brackets: 3.4 m above each floor (and mid-void for the columns in the open section)
    const ringYs = [...floors].map(fy => fy + 3.4); if (!c.primary || (c.x > JUBILEE.voidX.min - 6 && c.x < JUBILEE.voidX.max + 6)) ringYs.push(-20.5, -29.5);
    for (const ry of ringYs) { if (ry > Y1 - 1.5) continue; if (!pointClear(c.x, ry, colZ + c.r + 0.4, { below: 0.3, above: 0.3 })) continue; addLightRing(B, T, mats, c.x, ry, colZ, c.r); }
    // column number plate near each floor
  }

  // ---- 4. struts: solid 660 mm forged steel, buttress to buttress through the column collars --------------------------
  const strutX = [...primaryX, ...secondaryX];
  for (const x of strutX) for (const L of levels) {
    const a = new THREE.Vector3(x, L, nButt - 0.6), b = new THREE.Vector3(x, L, sButt + 0.6);
    if (!segmentClear(a, b, 0.5)) continue;
    strutsKept.push({ x, L });
    B.add(tubeGeo(a, b, STRUT_R, 20), mats.steel);
    // forged end tapers + bearing plates on the buttress faces; the strut passes through a cast concrete collar on the column
    for (const [z, sgn] of [[nButt, 1], [sButt, -1]]) { B.add(tubeGeo([x, L, z + sgn * 0.02], [x, L, z + sgn * 0.75], STRUT_R + 0.08, 20, STRUT_R + 0.02), mats.steel); B.add(plainBox(1.6, 1.6, 0.12, { x, y: L, z: z + sgn * 0.06 }), mats.steelDark); for (const [dx, dy] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) B.add(tubeGeo([x + dx, L + dy, z + sgn * 0.12], [x + dx, L + dy, z + sgn * 0.22], 0.06, 8), mats.steelDark); }
    const col = columns.find(c => Math.abs(c.x - x) < 0.01);
    if (col) { const collar = new THREE.CylinderGeometry(col.r + 0.3, col.r + 0.3, 1.1, 36, 1, false); collar.translate(x, L, colZ); const uv = collar.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * (col.r + 0.3), uv.getY(i) * 1.1); B.add(collar, mats.grillage); for (const sgn of [-1, 1]) B.add(tubeGeo([x, L, colZ + sgn * (col.r + 0.3)], [x, L, colZ + sgn * (col.r + 0.75)], STRUT_R + 0.06, 20), mats.steelDark); }
    // splice rings (the struts were installed in lengths)
    for (const z of [colZ - 6.2, colZ + 6.2]) B.add(tubeGeo([x, L, z - 0.12], [x, L, z + 0.12], STRUT_R + 0.05, 20), mats.steelDark);
  }

  // ---- 5. diagonal braces from the struts up to the walings (forked clevis ends), only where they thread clear ---------
  const brace = (a, b, r = 0.16) => {
    if (!segmentClear(a, b, 0.4, { below: 1.2, above: 2.4 })) return false;
    B.add(tubeGeo(a, b, r, 14), mats.steel);
    const d = b.clone().sub(a).normalize();
    for (const [p, s] of [[a, 1], [b, -1]]) { const e1 = p.clone().addScaledVector(d, s * 0.15), e2 = p.clone().addScaledVector(d, s * 0.75); B.add(tubeGeo(e1, e2, r + 0.09, 12), mats.steelDark); const side = new THREE.Vector3(1, 0, 0); if (Math.abs(d.x) > 0.9) side.set(0, 0, 1); const pin = e1.clone().addScaledVector(d, s * 0.12); B.add(tubeGeo(pin.clone().addScaledVector(side, -0.42), pin.clone().addScaledVector(side, 0.42), 0.07, 8), mats.steelDark); B.add(plainBox(0.5, 0.9, 0.5, { x: p.x, y: p.y, z: p.z, ry: 0 }), mats.steelDark); }
    return true;
  };
  for (const s of strutsKept) {
    const above = levels.filter(l => l > s.L).sort((a, b) => a - b)[0] ?? (Y1 - 3.2);
    if (above - s.L > 8) continue;
    for (const side of [-1, 1]) {
      const zWall = side < 0 ? nButt : sButt; const zFoot = colZ + side * 4.2;
      brace(new THREE.Vector3(s.x, s.L + STRUT_R + 0.05, zFoot), new THREE.Vector3(s.x, above - 0.75, zWall - side * 0.1));
    }
  }
  // knee braces from the column collars down to the strut quarter points (the 'flying' composition seen in the photos)
  for (const s of strutsKept) { const below = levels.filter(l => l < s.L).sort((a, b) => b - a)[0]; if (below == null) continue; const col = columns.find(c => Math.abs(c.x - s.x) < 0.01); if (!col) continue; for (const side of [-1, 1]) brace(new THREE.Vector3(s.x, below + STRUT_R + 0.1, colZ + side * (col.r + 0.9)), new THREE.Vector3(s.x, s.L - STRUT_R - 0.05, colZ + side * 6.4), 0.13); }

  // ---- 6. escalator support structures: transverse beams under the trusses between the columns and the grillage ----------
  const supportsAt = [];
  for (const f of plan.banks) {
    if (f.noSupports) continue;
    const alongAxisX = Math.abs(f.dir.x) > 0.9;
    const positions = alongAxisX ? [...primaryX, ...ribX].filter(x => { const l = f.local(x, f.top.z); return l.along > 1.6 && l.along < f.plan - 1.6; }).map(x => f.local(x, f.top.z).along) : [];
    if (!alongAxisX) { for (let al = 3; al < f.plan - 2; al += 4) positions.push(al); }
    for (const al of positions) {
      const c = f.world(al, f.centreLane); const ySurf = f.yAt(al); const yBeam = ySurf - 1.45;
      const halfW = f.halfWidth + 0.55; const across0 = f.centreLane - halfW, across1 = f.centreLane + halfW;
      const slabY = slabAt(c.x, c.z, yBeam);
      if (slabY != null && yBeam - slabY < 2.5) {
        // low over a slab: the truss sits on stub posts at the truss edges
        for (const ac of [across0 + 0.15, across1 - 0.15]) { const p = f.world(al, ac); if (yBeam - slabY < 0.25) continue; B.add(plainBox(0.28, yBeam + 0.35 - slabY, 0.28, { x: p.x, y: (yBeam + 0.35 + slabY) / 2, z: p.z }), mats.steel); B.add(plainBox(0.5, 0.04, 0.5, { x: p.x, y: slabY + 0.02, z: p.z }), mats.steelDark); }
        continue;
      }
      if (!alongAxisX) {   // banks on the railway grid (c, d): a cross-beam under the truss on two posts down to the slab (or the base)
        const p0 = f.world(al, across0), p1 = f.world(al, across1); B.add(beamGeo(p0.clone().setY(yBeam), p1.clone().setY(yBeam), 0.32, 0.6), mats.steel);
        const floorY = slabY != null ? slabY : Y0; if (yBeam - floorY < 9) for (const p of [p0, p1]) { B.add(plainBox(0.26, yBeam - floorY, 0.26, { x: p.x, y: (yBeam + floorY) / 2, z: p.z }), mats.steel); B.add(plainBox(0.5, 0.04, 0.5, { x: p.x, y: floorY + 0.02, z: p.z }), mats.steelDark); }
        continue;
      }
      // beam across z from the column face to the buttress face on the escalator's side
      const side = c.z < colZ ? -1 : 1; const col = columns.find(k => Math.abs(k.x - c.x) < 0.01); const zCol = colZ + side * ((col ? col.r : 0) + 0.05); const zWall = side < 0 ? nButt : sButt;
      const p0 = new THREE.Vector3(c.x, yBeam, zCol), p1 = new THREE.Vector3(c.x, yBeam, zWall);
      if (!segmentClear(p0, p1, 0.5, { below: 0.9, above: 0.2 })) continue;
      B.add(beamGeo(p0, p1, 0.36, 0.7), mats.steel);
      supportsAt.push({ f, al, x: c.x, y: yBeam, side });
      // seating stubs up to the truss soffit at the truss edges; a bearing plate on the buttress; a bracket on the column
      for (const ac of [across0 + 0.2, across1 - 0.2]) { const p = f.world(al, ac); B.add(plainBox(0.3, 0.42, 0.3, { x: p.x, y: yBeam + 0.35 + 0.21, z: p.z }), mats.steelDark); }
      B.add(plainBox(1.2, 1.2, 0.1, { x: c.x, y: yBeam, z: zWall - side * 0.05 }), mats.steelDark);
      if (col) B.add(plainBox(1.0, 1.0, 0.5, { x: c.x, y: yBeam, z: zCol + side * 0.2 }), mats.steelDark);
      // hanger / brace from the beam's outer third up to the waling above, and a tie down to the strut below (if any)
      const above = levels.filter(l => l > yBeam + 1.5).sort((a, b) => a - b)[0] ?? (Y1 - 3.2);
      if (above - yBeam < 9) brace(new THREE.Vector3(c.x, yBeam + 0.4, zWall - side * 3.2), new THREE.Vector3(c.x, above - 0.75, zWall - side * 0.1), 0.14);
      const belowL = levels.filter(l => l < yBeam - 1.2).sort((a, b) => b - a)[0];
      if (belowL != null && yBeam - belowL < 8) brace(new THREE.Vector3(c.x, belowL + STRUT_R + 0.05, colZ + side * 5.2), new THREE.Vector3(c.x, yBeam - 0.4, zCol + side * 1.6), 0.14);
      // thin stainless tie rods from the beam ends up to the truss sides
      for (const [ac, zEnd] of [[across0 - 0.05, zWall], [across1 + 0.05, zCol]]) { const p = f.world(al, ac); const top = new THREE.Vector3(p.x, ySurf - 0.5, p.z); const foot = new THREE.Vector3(c.x, yBeam + 0.3, zEnd - side * 0.6); if (foot.distanceTo(top) > 0.8) B.add(tubeGeo(foot, top, 0.02, 6), mats.tieRod); }
    }
  }

  // ---- 7. base slab (-39) with the maintenance walkway, drains and cable trays ----------------------------------------
  B.add(xzQuad(Y0, BOX.xMin, BOX.xMax, BOX.zMin, BOX.zMax, 'up'), mats.baseSlab);
  {
    const wz0 = plan.baseWalkway ? plan.baseWalkway.zMin : -12.8, wz1 = plan.baseWalkway ? plan.baseWalkway.zMax : -11.2;
    // raised chequer walkway on short legs along the box, with galvanised handrails and kick plates; a spur to the stair foot
    B.add(boxGeo(T, BOX.xMax - BOX.xMin - 3, 0.06, wz1 - wz0, { x: 0, y: Y0 + 0.2, z: (wz0 + wz1) / 2 }), mats.chequer);
    for (let x = BOX.xMin + 2; x <= BOX.xMax - 2; x += 2) for (const z of [wz0 + 0.15, wz1 - 0.15]) B.add(plainBox(0.06, 0.2, 0.06, { x, y: Y0 + 0.1, z }), mats.galv);
    for (const z of [wz0, wz1]) { B.add(tubeGeo([BOX.xMin + 1.5, Y0 + 1.25, z], [BOX.xMax - 1.5, Y0 + 1.25, z], 0.024, 8), mats.galv); B.add(tubeGeo([BOX.xMin + 1.5, Y0 + 0.75, z], [BOX.xMax - 1.5, Y0 + 0.75, z], 0.018, 8), mats.galv); B.add(plainBox(BOX.xMax - BOX.xMin - 3, 0.12, 0.02, { x: 0, y: Y0 + 0.3, z }), mats.galv); for (let x = BOX.xMin + 1.5; x <= BOX.xMax - 1.5; x += 3) B.add(tubeGeo([x, Y0 + 0.23, z], [x, Y0 + 1.25, z], 0.02, 8), mats.galv); }
    if (plan.baseSpur) { const s = plan.baseSpur; B.add(boxGeo(T, s.xMax - s.xMin, 0.06, s.zMax - s.zMin, { x: (s.xMin + s.xMax) / 2, y: Y0 + 0.2, z: (s.zMin + s.zMax) / 2 }), mats.chequer); for (const x of [s.xMin, s.xMax]) { B.add(tubeGeo([x, Y0 + 1.25, s.zMin], [x, Y0 + 1.25, s.zMax], 0.024, 8), mats.galv); for (let z = s.zMin; z <= s.zMax; z += 3) B.add(tubeGeo([x, Y0 + 0.23, z], [x, Y0 + 1.25, z], 0.02, 8), mats.galv); } }
    // drainage: a channel with grating along the south side, sumps at the quarter points, floor falls drawn as darker patches
    B.add(boxGeo(T, BOX.xMax - BOX.xMin - 2, 0.02, 0.4, { x: 0, y: Y0 + 0.011, z: sButt - 0.6 }), mats.darkGrey);
    for (let x = BOX.xMin + 1; x < BOX.xMax - 1; x += 1) B.add(plainBox(0.9, 0.03, 0.36, { x: x + 0.5, y: Y0 + 0.03, z: sButt - 0.6 }), mats.galv);
    for (const x of [-30, -10, 10, 30]) { B.add(plainBox(1.2, 0.05, 1.2, { x, y: Y0 + 0.025, z: colZ - 3.5 }), mats.galv); B.add(plainBox(1.0, 0.02, 1.0, { x, y: Y0 + 0.052, z: colZ - 3.5 }), mats.black); }
    // sump pump cabinet and a grey services kiosk at the west end; cable trays along the wall bases; sprinkler main
    B.add(plainBox(1.4, 1.6, 0.8, { x: BOX.xMin + 4.5, y: Y0 + 0.8, z: nButt + 1.2 }), mats.galv);
    B.add(plainBox(0.8, 2.0, 0.6, { x: BOX.xMax - 3.5, y: Y0 + 1.0, z: nButt + 1.0 }), mats.galv);
    for (const z of [nButt + 0.35, sButt - 0.35]) { B.add(plainBox(BOX.xMax - BOX.xMin - 4, 0.08, 0.3, { x: 0, y: Y0 + 2.6, z }), mats.galv); B.add(plainBox(BOX.xMax - BOX.xMin - 4, 0.06, 0.24, { x: 0, y: Y0 + 2.62, z }), mats.cable); }
    B.add(tubeGeo([BOX.xMin + 2, Y0 + 3.0, sButt - 0.9], [BOX.xMax - 2, Y0 + 3.0, sButt - 0.9], 0.08, 10), mats.pipeRed);
  }

  // ---- 8. the lid: coffered soffit of the concourse slab (beams down to concourseBeamSoffit - offset) ----------------
  {
    const lidY = Y1 - 0.05; const holes = (plan.lidHoles || []).map(rectPoly);
    B.add(polyQuad(lidY, rectPoly(R(BOX.xMin, BOX.xMax, BOX.zMin, BOX.zMax)), holes, 'down'), mats.precast);
    const beamD = 0.9, beamW = 0.45; const bx = [...primaryX, ...ribX].sort((a, b) => a - b);
    const hidden = plan.undercroft ? plan.undercroft.rect : null;
    const zs = []; for (let z = BOX.zMin + 3.25; z < BOX.zMax - 1; z += 3.25) zs.push(z);
    for (const x of bx) for (let i = 0; i <= zs.length; i++) { const z0 = i === 0 ? BOX.zMin : zs[i - 1], z1 = i === zs.length ? BOX.zMax : zs[i]; const zm = (z0 + z1) / 2; if (hidden && inRect(hidden, x, zm)) continue; if (holes.some(h => inRect(boundsOf(h), x, zm))) continue; B.add(boxGeo(T, beamW, beamD, z1 - z0, { x, y: lidY - beamD / 2, z: zm }), mats.precast); }
    for (const z of zs) for (let i = 0; i <= bx.length; i++) { const x0 = i === 0 ? BOX.xMin : bx[i - 1], x1 = i === bx.length ? BOX.xMax : bx[i]; const xm = (x0 + x1) / 2; if (hidden && inRect(hidden, xm, z)) continue; if (holes.some(h => inRect(boundsOf(h), xm, z))) continue; B.add(boxGeo(T, x1 - x0, beamD, beamW, { x: xm, y: lidY - beamD / 2, z }), mats.precast); }
    // sprinkler main and cable trays along the lid, saucer-light stalks are the ticket hall's; here: linear battens under the beams over the east section
  }

  // ---- 9. D&C underpinning slab soffit over the west section, with its downstand beams and the enclosure of the extension
  if (plan.undercroft) {
    const u = plan.undercroft; const holes = (u.holes || []);
    B.add(polyQuad(u.y, rectPoly(u.rect), holes, 'down'), mats.precast);
    for (let z = u.rect.zMin + 2.2; z < u.rect.zMax - 1; z += 4.4) { for (const [x0, x1] of splitByHoles(u.rect.xMin, u.rect.xMax, z, holes)) if (x1 - x0 > 0.8) B.add(boxGeo(T, x1 - x0, 0.8, 0.5, { x: (x0 + x1) / 2, y: u.y - 0.4, z }), mats.precast); }
    // enclosure walls of the part south of the box (under Bridge Street): east, south, west
    const ext = u.ext; if (ext) { B.add(yzQuad(ext.xMax, ext.yMin, u.y, ext.zMin, ext.zMax, 'west'), mats.grillage); B.add(xyQuad(ext.zMax, ext.xMin, ext.xMax, ext.yMin, u.y, 'north'), mats.grillage); B.add(yzQuad(ext.xMin, ext.yMin, u.y, ext.zMin, ext.zMax, 'east'), mats.grillage); for (let x = ext.xMin + 4; x < ext.xMax - 1; x += 5.9) B.add(boxGeo(T, 0.8, u.y - ext.yMin, 0.8, { x, y: (u.y + ext.yMin) / 2, z: ext.zMax - 0.4 }), mats.grillage); }
    // hole rims (edge beams) so the openings read as cast slab edges
    for (const h of holes) B.add(bandGeo(h, u.y - 0.9, u.y + 0.02, true, 'inward'), mats.precast);
  }

  const meshes = B.flush(g, { name: 'structure' });
  return { group: g, strutsKept, supportsAt, meshes, columns, secondaryX, primaryX, ribX, nButt, sButt };
}

// ---------------------------------------------------------------------------
function addLightRing(B, T, mats, x, y, z, r) {
  const ring = new THREE.TorusGeometry(r + 0.32, 0.045, 8, 40); ring.rotateX(Math.PI / 2); ring.translate(x, y, z); B.add(ring, mats.steel);
  const ring2 = new THREE.TorusGeometry(r + 0.32, 0.045, 8, 40); ring2.rotateX(Math.PI / 2); ring2.translate(x, y - 0.35, z); B.add(ring2, mats.steel);
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4; const px = x + Math.cos(a) * (r + 0.42), pz = z + Math.sin(a) * (r + 0.42);
    B.add(plainBox(0.12, 0.35, 0.12, { x: px, y: y - 0.175, z: pz }), mats.steelDark);
    // uplighter head (emissive top) and a downward spot (emissive bottom)
    const up = new THREE.CylinderGeometry(0.09, 0.11, 0.26, 12); up.translate(px, y + 0.15, pz); B.add(up, mats.steelDark);
    const upFace = new THREE.CircleGeometry(0.085, 12); upFace.rotateX(-Math.PI / 2); upFace.translate(px, y + 0.285, pz); B.add(upFace, mats.lumCool);
    const dn = new THREE.CylinderGeometry(0.075, 0.06, 0.2, 12); dn.translate(px, y - 0.48, pz); B.add(dn, mats.steelDark);
    const dnFace = new THREE.CircleGeometry(0.05, 12); dnFace.rotateX(Math.PI / 2); dnFace.translate(px, y - 0.585, pz); B.add(dnFace, mats.lumWarm);
  }
}

/** Rectangular steel beam (I-section approximated by a box with slimmer web) between two points. */
export function beamGeo(a, b, w, h) {
  const len = a.distanceTo(b); const g = new THREE.BoxGeometry(w, h, len); const web = new THREE.BoxGeometry(w * 0.5, h - 0.14, len);
  const merged = mergeBoxes([g, web]); const dir = b.clone().sub(a).normalize(); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); merged.applyQuaternion(q); merged.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); return merged;
}
function mergeBoxes(list) { const parts = list.map(g => g.toNonIndexed()); let total = 0; parts.forEach(p => total += p.attributes.position.count); const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3), uv = new Float32Array(total * 2); let o = 0; for (const p of parts) { pos.set(p.attributes.position.array, o * 3); nrm.set(p.attributes.normal.array, o * 3); uv.set(p.attributes.uv.array, o * 2); o += p.attributes.position.count; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g; }

/** Vertical wall face with rectangular holes. plane 'xy' (wall along x at z = coord) or 'zy' (wall along z at x = coord). rect = [u0, v0, u1, v1], holes likewise. */
export function verticalPoly(plane, coord, rect, holes, facing) {
  const [u0, v0, u1, v1] = rect;
  const shape = new THREE.Shape(); shape.moveTo(u0, v0); shape.lineTo(u1, v0); shape.lineTo(u1, v1); shape.lineTo(u0, v1); shape.closePath();
  for (const h of holes) { const [a, b, c, d] = h; const hu0 = Math.max(u0 + 0.01, Math.min(a, c)), hu1 = Math.min(u1 - 0.01, Math.max(a, c)), hv0 = Math.max(v0 + 0.01, Math.min(b, d)), hv1 = Math.min(v1 - 0.01, Math.max(b, d)); if (hu1 - hu0 < 0.05 || hv1 - hv0 < 0.05) continue; const p = new THREE.Path(); p.moveTo(hu0, hv0); p.lineTo(hu1, hv0); p.lineTo(hu1, hv1); p.lineTo(hu0, hv1); p.closePath(); shape.holes.push(p); }
  // rotateY(π) (north) and rotateY(+π/2) (east) mirror the shape's u axis — pre-mirror so the holes land where asked
  const mirror = (plane === 'xy' && facing === 'north') || (plane === 'zy' && facing === 'east');
  if (mirror) { const flipX = (pth) => { for (const c of pth.curves) { c.v1.x = -c.v1.x; c.v2.x = -c.v2.x; } }; flipX(shape); for (const h of shape.holes) flipX(h); }
  const g = new THREE.ShapeGeometry(shape, 2);   // in (u, v, 0) facing +Z
  if (plane === 'xy') { if (facing === 'north') g.rotateY(Math.PI); g.translate(0, 0, coord); }
  else { g.rotateY(facing === 'east' ? Math.PI / 2 : -Math.PI / 2); g.translate(coord, 0, 0); }
  const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, plane === 'xy' ? p.getX(i) : p.getZ(i), p.getY(i));
  return g;
}
function boundsOf(poly) { return { xMin: Math.min(...poly.map(p => p.x)), xMax: Math.max(...poly.map(p => p.x)), zMin: Math.min(...poly.map(p => p.z)), zMax: Math.max(...poly.map(p => p.z)) }; }
/** Split the x-range [x0,x1] at height line z by the AABBs of the given polygons → list of [xa, xb] clear spans. */
function splitByHoles(x0, x1, z, holes) {
  const cuts = holes.map(boundsOf).filter(b => z > b.zMin - 0.3 && z < b.zMax + 0.3).sort((a, b) => a.xMin - b.xMin); const out = []; let cur = x0;
  for (const b of cuts) { if (b.xMin > cur) out.push([cur, Math.min(b.xMin, x1)]); cur = Math.max(cur, b.xMax); }
  if (cur < x1) out.push([cur, x1]); return out;
}
