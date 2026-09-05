// ---------------------------------------------------------------------------
// platformEdgeDoors.js — the Westinghouse (1999) Jubilee Line Extension platform
// screen: a full-height stainless-framed toughened-glass wall along the platform
// edge with bi-parting sliding glass leaves at every train doorway, a dark
// header band carrying the drives and an amber/green status lamp per door,
// fixed glazed panels between doors with 200 mm mullions, grey emergency-release
// boxes with red flaps on every fixed panel, the yellow band with black chevrons
// on the leaves, 'Stand clear of the doors' / 'Danger — do not obstruct the
// doors' stickers, per-door labels on the header, and the two hinged end
// egress doors. Open above the header to the tunnel crown for airflow.
//
//   createPlatformEdgeDoors(ctx, {
//     name, platformNumber, xMin, xMax, y (platform surface), zLine (screen line),
//     doorways: [{ x, width, leaves, car }],   // world x of each train doorway centre (already mapped for direction)
//     endDoors: [x, x],                        // hinged emergency egress doors at the screen ends
//     labelPrefix: 'E' | 'W', levelBoarding: [doorway indices],
//     soundPositions: [Vector3...]             // where 'pedMove' plays when the doors move
//   }) → { group, setOpen(bool), isOpen, openness, doorPositions, doorPositionsX, doorPositionsZ, blockers }
//
// Geometry: the screen runs along X at z = zLine; the platform is on the -z side (north), the track on +z.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE } from '../core/layout.js';

const GLASS_BOTTOM = 0.05;      // leaf bottom above the platform
const LEAF_TOP = 2.2;           // header underside (glass leaves 2.15 m high)
const HEADER_TOP = 2.5;         // top of the dark header band
const PLINTH_H = 0.15;          // stainless kick plate under fixed panels
const MULLION_W = 0.2;          // door-post mullions
const MID_MULLION_W = 0.08;     // intermediate mullions between fixed panels
const FRAME_D = 0.12;           // depth of the screen framing
const OPEN_TIME = 1.8, CLOSE_TIME = 2.8;   // dossier §6.4

export function createPlatformEdgeDoors(ctx, opts) {
  const { M, T, collision, audio } = ctx;
  const { name = 'peds', platformNumber = 3, xMin, xMax, y, zLine, doorways, endDoors = [], labelPrefix = 'E', levelBoarding = [], soundPositions = [], lineColor = PALETTE.jubilee } = opts;
  const group = new THREE.Group(); group.name = name;

  // ---- materials (shared across both platforms via the M cache / module cache)
  const stainless = M.stainless(); const stainlessV = M.stainless({ vertical: true });
  const leafFrameMat = M.stainless({ base: 0xc2c4c6, vertical: true });
  const glass = M.glass({ opacity: 0.22, color: 0xdde7ee });
  const headerMat = M.paint(0x2b2d30, { roughness: 0.55, metalness: 0.35 });
  const darkMat = M.paint(0x1e1f21, { roughness: 0.7, metalness: 0.2 });
  const greyBoxMat = M.paint(0x8e9194, { roughness: 0.6, metalness: 0.3 });
  const redMat = M.paint(0xd42a25, { roughness: 0.5 });
  const amberLamp = M.luminaire(0xffa000, 1.8), greenLamp = M.luminaire(0x2eff6a, 1.4);
  const sealMat = M.rubber(0x111111);

  // ---- layout along x: door units (opening + posts) sorted, fixed runs between them
  const doors = doorways.map((d, i) => { const clear = d.width + 0.14; return { ...d, index: i, clear, leafW: clear / 2 + 0.04, xa: d.x - clear / 2 - MULLION_W, xb: d.x + clear / 2 + MULLION_W }; }).sort((a, b) => a.x - b.x);
  const runs = []; // fixed glazing spans between door units (and to the screen ends)
  let cursor = xMin + MULLION_W;
  for (const d of doors) { if (d.xa - cursor > 0.05) runs.push({ xa: cursor, xb: d.xa }); cursor = d.xb; }
  if (xMax - MULLION_W - cursor > 0.05) runs.push({ xa: cursor, xb: xMax - MULLION_W });

  // geometry accumulators (merged per material)
  const acc = new Map(); const put = (geo, mat, x, y0, z, sx = 1, sy = 1, sz = 1, ry = 0) => { const g = geo.index ? geo.toNonIndexed() : geo.clone(); const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz)); g.applyMatrix4(m); g.clearGroups(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!acc.has(mat)) acc.set(mat, []); acc.get(mat).push(g); };
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitPlane = new THREE.PlaneGeometry(1, 1);
  const glassH = LEAF_TOP - PLINTH_H;

  // mullion instances (door posts + intermediates + end posts)
  const mullionMatrices = [];
  const pushMullion = (x, w, d = FRAME_D) => mullionMatrices.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y + LEAF_TOP / 2, zLine), new THREE.Quaternion(), new THREE.Vector3(w, LEAF_TOP, d)));
  pushMullion(xMin + MULLION_W / 2, MULLION_W); pushMullion(xMax - MULLION_W / 2, MULLION_W);
  for (const d of doors) { pushMullion(d.xa + MULLION_W / 2, MULLION_W); pushMullion(d.xb - MULLION_W / 2, MULLION_W); }

  // fixed runs: glass panels + intermediate mullions + plinth + top rail + release boxes + manifestation band
  const releaseBoxes = []; const manifestation = [];
  const endDoorSet = new Set(endDoors.map(x => Math.round(x * 100)));
  for (const r of runs) {
    // split the run around any end door that lies inside it
    const segs = []; let sa = r.xa;
    const inside = endDoors.filter(x => x > r.xa + 0.5 && x < r.xb - 0.5).sort((a, b) => a - b);
    for (const ex of inside) { segs.push([sa, ex - 0.5]); segs.push([ex - 0.5, ex + 0.5, 'endDoor', ex]); sa = ex + 0.5; }
    segs.push([sa, r.xb]);
    for (const [xa, xb, kind, ex] of segs) {
      const span = xb - xa; if (span < 0.05) continue;
      if (kind === 'endDoor') {
        // hinged single-leaf emergency egress door: stainless frame, glass, push bar, red 'Emergency exit' plate
        put(unitBox, stainlessV, xa + 0.04, y + LEAF_TOP / 2, zLine, 0.08, LEAF_TOP, FRAME_D); put(unitBox, stainlessV, xb - 0.04, y + LEAF_TOP / 2, zLine, 0.08, LEAF_TOP, FRAME_D);
        put(unitBox, leafFrameMat, ex, y + GLASS_BOTTOM + 0.06, zLine, 0.84, 0.12, 0.05); put(unitBox, leafFrameMat, ex, y + LEAF_TOP - 0.04, zLine, 0.84, 0.08, 0.05);
        put(unitPlane, glass, ex, y + (GLASS_BOTTOM + LEAF_TOP) / 2 + 0.03, zLine, 0.76, LEAF_TOP - GLASS_BOTTOM - 0.2, 1);
        put(unitBox, stainless, ex, y + 1.0, zLine - 0.05, 0.7, 0.04, 0.04); // push bar (platform side)
        put(unitBox, redMat, ex, y + 1.6, zLine - 0.03, 0.3, 0.12, 0.01);
        collision.addWall(xa, zLine, xb, zLine, y, y + 2.6, 0.3, name + ':endDoor');
        continue;
      }
      const n = Math.max(1, Math.round(span / 1.45)); const pw = (span - (n - 1) * MID_MULLION_W) / n;
      for (let i = 0; i < n; i++) {
        const px = xa + i * (pw + MID_MULLION_W) + pw / 2;
        put(unitPlane, glass, px, y + PLINTH_H + glassH / 2, zLine, pw, glassH, 1);
        manifestation.push(px, pw);
        if (i < n - 1) pushMullion(xa + (i + 1) * (pw + MID_MULLION_W) - MID_MULLION_W / 2, MID_MULLION_W, FRAME_D * 0.8);
      }
      // plinth (kick plate) and a slim top rail under the header
      put(unitBox, stainless, (xa + xb) / 2, y + PLINTH_H / 2, zLine, span, PLINTH_H, FRAME_D + 0.02);
      put(unitBox, stainless, (xa + xb) / 2, y + LEAF_TOP - 0.03, zLine, span, 0.06, FRAME_D);
      // emergency release box on the fixed panel nearest each door post (platform side)
      releaseBoxes.push(xa + 0.22, xb - 0.22);
      collision.addWall(xa - MULLION_W, zLine, xb + MULLION_W, zLine, y, y + 2.6, 0.3, name + ':fixed');
    }
  }
  // end walls of the screen (solid stainless panel beyond the last posts, closing to the platform end)
  // header band: full length, with a stainless capping and a continuous black underside rail; per-door drive housings as slight bumps
  put(unitBox, headerMat, (xMin + xMax) / 2, y + (LEAF_TOP + HEADER_TOP) / 2, zLine, xMax - xMin, HEADER_TOP - LEAF_TOP, 0.36);
  put(unitBox, stainless, (xMin + xMax) / 2, y + HEADER_TOP + 0.015, zLine, xMax - xMin, 0.03, 0.4);
  put(unitBox, darkMat, (xMin + xMax) / 2, y + LEAF_TOP - 0.01, zLine + 0.19, xMax - xMin, 0.02, 0.06);
  for (const d of doors) put(unitBox, darkMat, d.x, y + HEADER_TOP - 0.1, zLine - 0.2, d.clear + 0.3, 0.16, 0.05);
  // door thresholds (stainless plates in the floor at each opening) and the pocket floor guides
  for (const d of doors) put(unitBox, stainless, d.x, y + 0.008, zLine, d.clear + 2 * MULLION_W, 0.016, 0.34);

  // ---- release boxes + status lamps + labels (instanced / merged)
  const boxGeo = new THREE.BoxGeometry(0.1, 0.14, 0.05); const flapGeo = new THREE.BoxGeometry(0.07, 0.05, 0.012);
  const relBox = new THREE.InstancedMesh(boxGeo, greyBoxMat, releaseBoxes.length); const relFlap = new THREE.InstancedMesh(flapGeo, redMat, releaseBoxes.length);
  releaseBoxes.forEach((x, i) => { const m = new THREE.Matrix4().makeTranslation(x, y + 1.25, zLine - FRAME_D / 2 - 0.025); relBox.setMatrixAt(i, m); relFlap.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y + 1.24, zLine - FRAME_D / 2 - 0.056)); });
  relBox.instanceMatrix.needsUpdate = true; relFlap.instanceMatrix.needsUpdate = true; relBox.computeBoundingSphere(); relFlap.computeBoundingSphere(); group.add(relBox, relFlap);
  const lampGeo = new THREE.BoxGeometry(0.06, 0.035, 0.02);
  const lampsA = new THREE.InstancedMesh(lampGeo, amberLamp, doors.length), lampsG = new THREE.InstancedMesh(lampGeo, greenLamp, doors.length);
  doors.forEach((d, i) => { const m = new THREE.Matrix4().makeTranslation(d.x - 0.12, y + LEAF_TOP + 0.08, zLine - 0.185); lampsA.setMatrixAt(i, m); lampsG.setMatrixAt(i, new THREE.Matrix4().makeTranslation(d.x + 0.12, y + LEAF_TOP + 0.08, zLine - 0.185)); });
  lampsA.instanceMatrix.needsUpdate = true; lampsG.instanceMatrix.needsUpdate = true; lampsA.computeBoundingSphere(); lampsG.computeBoundingSphere(); group.add(lampsA, lampsG);
  // labels atlas ('E 12' white on black) on the header face above each door (platform side)
  try {
    const cols = 8, rows = Math.ceil(doors.length / cols); const cw = 128, ch = 64; const c = T.canvas(cols * cw, rows * ch); const g2 = c.getContext('2d');
    g2.fillStyle = '#0a0a0a'; g2.fillRect(0, 0, c.width, c.height); g2.fillStyle = '#fff'; g2.font = `bold 40px ${T.SIGN_FONT}`; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    doors.forEach((d, i) => { const cx = (i % cols) * cw + cw / 2, cy = Math.floor(i / cols) * ch + ch / 2; g2.fillText(`${labelPrefix} ${i + 1}`, cx, cy + 2); });
    const tex = T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping }); const labMat = M.signMaterial(tex, { emissive: 0.5 });
    const geos = doors.map((d, i) => { const g = new THREE.PlaneGeometry(0.16, 0.08); const uv = g.attributes.uv; const u0 = (i % cols) / cols, u1 = u0 + 1 / cols, v1 = 1 - Math.floor(i / cols) / rows, v0 = v1 - 1 / rows; for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0)); g.rotateY(Math.PI); g.translate(d.x + d.clear / 2 + 0.02, y + HEADER_TOP - 0.09, zLine - 0.232); return g; });   // proud of the drive housings
    const merged = mergeGeometries(geos, false); if (merged) group.add(new THREE.Mesh(merged, labMat));
  } catch (e) { console.warn('[peds] labels failed', e); }
  // manifestation band on the fixed glass (row of grey dots at 1.4 m) — one merged mesh with a small tiling texture
  try {
    const mc = T.canvas(64, 16); const mg = mc.getContext('2d'); mg.clearRect(0, 0, 64, 16); mg.fillStyle = 'rgba(200,204,208,0.85)'; for (let k = 0; k < 4; k++) { mg.beginPath(); mg.arc(8 + k * 16, 8, 3.2, 0, Math.PI * 2); mg.fill(); }
    const mtex = T.toTexture(mc); const mm = new THREE.MeshStandardMaterial({ map: mtex, transparent: true, alphaTest: 0.2, roughness: 0.5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
    const geos = [];
    for (let i = 0; i < manifestation.length; i += 2) { const px = manifestation[i], pw = manifestation[i + 1]; const g = new THREE.PlaneGeometry(pw - 0.1, 0.06); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * (pw - 0.1) / 0.16); g.translate(px, y + 1.4, zLine - 0.004); geos.push(g); }
    const merged = geos.length ? mergeGeometries(geos, false) : null; if (merged) group.add(new THREE.Mesh(merged, mm));
  } catch (e) { console.warn('[peds] manifestation failed', e); }

  // ---- merged static meshes
  for (const [mat, geos] of acc) { let merged = null; try { merged = mergeGeometries(geos, false); } catch (e) { merged = null; } if (!merged) { for (const g of geos) group.add(new THREE.Mesh(g, mat)); continue; } const mesh = new THREE.Mesh(merged, mat); mesh.receiveShadow = true; mesh.castShadow = false; mesh.renderOrder = mat === glass ? 10 : 0; group.add(mesh); }
  const mullionGeo = new THREE.BoxGeometry(1, 1, 1);
  const mullions = new THREE.InstancedMesh(mullionGeo, stainlessV, mullionMatrices.length); mullionMatrices.forEach((m, i) => mullions.setMatrixAt(i, m)); mullions.instanceMatrix.needsUpdate = true; mullions.computeBoundingSphere(); mullions.receiveShadow = true; group.add(mullions);

  // ---- door leaves: 4 variants (double/single × left/right), each = frame + glass + decal instanced meshes
  const variants = {};
  const leafH = LEAF_TOP - GLASS_BOTTOM;
  function leafGeometries(lw, side) {
    // frame: bottom rail 0.12, top rail 0.06, stiles 0.05, meeting-edge seal; extends from x=0 (meeting edge) outward by lw in +x (right) or -x (left)
    const s = side === 'right' ? 1 : -1; const parts = [];
    const add = (w, h, d, x, yy, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(s * x, yy, z); parts.push(g); };
    add(lw, 0.12, 0.045, lw / 2, 0.06, 0); add(lw, 0.06, 0.045, lw / 2, leafH - 0.03, 0); add(0.05, leafH, 0.045, lw - 0.025, leafH / 2, 0); add(0.05, leafH, 0.045, 0.025, leafH / 2, 0);
    add(lw, 0.02, 0.05, lw / 2, 0.95 + 0.0, 0); // slim mid rail carrying the yellow band
    const frame = mergeGeometries(parts.map(p => p.toNonIndexed()), false);
    const gl = new THREE.PlaneGeometry(lw - 0.1, leafH - 0.18); gl.translate(s * lw / 2, leafH / 2 + 0.03, 0);
    const dec = new THREE.PlaneGeometry(lw, leafH); dec.rotateY(Math.PI); dec.translate(s * lw / 2, leafH / 2, -0.024);
    const seal = new THREE.BoxGeometry(0.02, leafH, 0.05); seal.translate(s * 0.01, leafH / 2, 0);
    return { frame, glass: gl, decal: dec, seal };
  }
  function leafDecalTexture(lw, side) {
    const key = `${lw.toFixed(2)}:${side}`;
    const W = 512, H = Math.round(512 * leafH / lw); const c = T.canvas(W, H); const g = c.getContext('2d'); const px = W / lw; // px per metre
    const X = (mx) => side === 'right' ? mx * px : W - mx * px;   // mx = metres from the meeting edge
    const Y = (my) => H - my * px;                                 // my = metres above the leaf bottom
    g.clearRect(0, 0, W, H);
    // yellow band 100 mm at 0.95–1.05 (platform 1.0–1.1 m) with black chevrons in the 0.3 m nearest the meeting edge
    g.fillStyle = '#f5c400'; g.fillRect(0, Y(1.05), W, 0.1 * px);
    g.fillStyle = '#111';
    for (let k = 0; k < 4; k++) { const x0 = 0.03 + k * 0.075; g.beginPath(); g.moveTo(X(x0), Y(1.05)); g.lineTo(X(x0 + 0.035), Y(1.05)); g.lineTo(X(x0 + 0.075), Y(1.0)); g.lineTo(X(x0 + 0.035), Y(0.95)); g.lineTo(X(x0), Y(0.95)); g.lineTo(X(x0 + 0.04), Y(1.0)); g.closePath(); g.fill(); }
    // 'Stand clear of the doors' sticker (yellow with black text) 150 × 150 mm at 1.45 m near the meeting edge
    const sticker = (mx, my, w, h, bg, fg, lines, fs) => { const x0 = Math.min(X(mx), X(mx + w)), y0 = Y(my + h); g.fillStyle = bg; g.fillRect(x0, y0, w * px, h * px); g.strokeStyle = fg; g.lineWidth = 2; g.strokeRect(x0 + 2, y0 + 2, w * px - 4, h * px - 4); g.fillStyle = fg; g.font = `bold ${fs * px}px ${T.SIGN_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; lines.forEach((t, i) => g.fillText(t, x0 + w * px / 2, y0 + h * px * (i + 1) / (lines.length + 1))); };
    sticker(0.03, 1.45, 0.15, 0.15, '#f5c400', '#111', ['Stand clear', 'of the', 'doors'], 0.028);
    sticker(0.03, 0.72, 0.15, 0.1, '#111', '#f5c400', ['DANGER', 'Do not obstruct', 'the doors'], 0.02);
    // 'Do not lean on the doors' pictogram (white on blue, red bar) at 1.7 m
    { const x0 = Math.min(X(0.03), X(0.15)), y0 = Y(1.82); g.fillStyle = '#1c2e8c'; g.fillRect(x0, y0, 0.12 * px, 0.12 * px); g.fillStyle = '#fff'; g.beginPath(); g.arc(x0 + 0.06 * px, y0 + 0.035 * px, 0.014 * px, 0, Math.PI * 2); g.fill(); g.fillRect(x0 + 0.045 * px, y0 + 0.05 * px, 0.03 * px, 0.055 * px); g.strokeStyle = '#dc241f'; g.lineWidth = 0.012 * px; g.beginPath(); g.moveTo(x0 + 0.015 * px, y0 + 0.015 * px); g.lineTo(x0 + 0.105 * px, y0 + 0.105 * px); g.stroke(); }
    // door-edge grey dot manifestation at 1.4 m (small dots across the leaf)
    g.fillStyle = 'rgba(200,204,208,0.85)'; for (let mx = 0.04; mx < lw - 0.04; mx += 0.04) { g.beginPath(); g.arc(X(mx), Y(1.35), 0.006 * px, 0, Math.PI * 2); g.fill(); }
    // 'Caution — sliding doors' small yellow label near the bottom rail
    sticker(0.05, 0.17, 0.13, 0.05, '#f5c400', '#111', ['Caution  Sliding doors'], 0.014);
    const tex = T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping }); tex.anisotropy = 8; return tex;
  }
  const leafSets = { double: doors.filter(d => d.leaves === 2), single: doors.filter(d => d.leaves !== 2) };
  const leafInstances = []; // { mesh, doorsList, side, geoOffset }
  for (const [kind, list] of Object.entries(leafSets)) {
    if (!list.length) continue; const lw = list[0].leafW;
    for (const side of ['left', 'right']) {
      const geos = leafGeometries(lw, side);
      const decalMat = new THREE.MeshStandardMaterial({ map: leafDecalTexture(lw, side), transparent: true, alphaTest: 0.05, roughness: 0.55, metalness: 0, emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      decalMat.emissiveMap = decalMat.map; decalMat.emissiveIntensity = 0.25;
      const frameMat = leafFrameMat;
      const meshes = [new THREE.InstancedMesh(geos.frame, frameMat, list.length), new THREE.InstancedMesh(geos.glass, glass, list.length), new THREE.InstancedMesh(geos.decal, decalMat, list.length), new THREE.InstancedMesh(geos.seal, sealMat, list.length)];
      meshes[1].renderOrder = 11; meshes[2].renderOrder = 12;
      for (const m of meshes) { m.frustumCulled = true; group.add(m); }
      leafInstances.push({ meshes, list, side });
    }
  }
  const tmpM = new THREE.Matrix4();
  function placeLeaves(t) {
    for (const li of leafInstances) {
      const s = li.side === 'right' ? 1 : -1;
      // leaves run on the TRACK side of the fixed glazing (they slide behind the fixed panels when open), so offset them in z
      li.list.forEach((d, i) => { const off = s * (d.clear / 2) * t; tmpM.makeTranslation(d.x + off, y + GLASS_BOTTOM, zLine + 0.045); for (const m of li.meshes) m.setMatrixAt(i, tmpM); });
      for (const m of li.meshes) { m.instanceMatrix.needsUpdate = true; }
    }
  }
  placeLeaves(0); for (const li of leafInstances) for (const m of li.meshes) m.computeBoundingSphere();

  // ---- level-boarding positions: stainless mini ramp plate on the platform side + blue wheelchair floor marking + door-glass pictogram
  try {
    const wcTex = T.sign({ width: 256, height: 256, bg: '#1c2e8c', lines: [], fills: [], roundels: [] });
    const g2 = wcTex.image.getContext('2d'); g2.fillStyle = '#fff'; g2.beginPath(); g2.arc(120, 70, 18, 0, Math.PI * 2); g2.fill(); g2.fillRect(108, 90, 26, 60); g2.fillRect(108, 130, 70, 16); g2.lineWidth = 14; g2.strokeStyle = '#fff'; g2.beginPath(); g2.arc(118, 168, 46, Math.PI * 0.05, Math.PI * 1.55); g2.stroke(); g2.beginPath(); g2.moveTo(178, 146); g2.lineTo(200, 200); g2.lineTo(224, 196); g2.stroke(); wcTex.needsUpdate = true;
    const wcMat = M.signMaterial(wcTex, { emissive: 0.4 });
    for (const idx of levelBoarding) { const d = doors[idx]; if (!d) continue;
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(d.clear + 0.2, 0.025, 0.5), stainless); ramp.position.set(d.x, y + 0.012, zLine - 0.27); group.add(ramp);
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), wcMat); mark.rotation.x = -Math.PI / 2; mark.position.set(d.x, y + 0.03, zLine - 0.9); group.add(mark);
      const pict = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), wcMat); pict.rotation.y = Math.PI; pict.position.set(d.x - d.clear / 2 - MULLION_W - 0.25, y + 1.7, zLine - FRAME_D / 2 - 0.01); group.add(pict);
    }
  } catch (e) { console.warn('[peds] level boarding details failed', e); }

  // ---- collision: removable blockers per doorway (closed state)
  const doorBlockers = doors.map(d => ({ door: d, box: null }));
  function setDoorBlockers(on) { for (const b of doorBlockers) { if (on && !b.box) b.box = collision.addBlocker({ xMin: b.door.x - b.door.clear / 2, xMax: b.door.x + b.door.clear / 2, yMin: y, yMax: y + 2.6, zMin: zLine - 0.15, zMax: zLine + 0.15 }, name + ':door'); else if (!on && b.box) { collision.remove(b.box); b.box = null; } } }
  setDoorBlockers(true);

  // ---- state & animation
  const state = { target: 0, t: 0, open: false, moving: false, blocked: true };
  lampsA.visible = false; lampsG.visible = true;
  function playMove(seconds) { if (!audio || !audio.ready) return; for (const p of soundPositions) { try { audio.play('pedMove', { position: p, params: { seconds }, gain: 0.45, refDistance: 3, maxDistance: 40 }); } catch (e) {} } }
  function setOpen(open) { open = !!open; if (state.open === open && !state.moving) return; state.open = open; state.target = open ? 1 : 0; state.moving = true; lampsA.visible = true; lampsG.visible = false; playMove(open ? OPEN_TIME : CLOSE_TIME); }
  ctx.onUpdate(dt => {
    if (!state.moving) return;
    const rate = state.target > state.t ? 1 / OPEN_TIME : 1 / CLOSE_TIME;
    const prev = state.t; state.t += Math.sign(state.target - state.t) * rate * dt;
    if ((rate > 0 && state.target >= prev && state.t >= state.target) || (state.target <= prev && state.t <= state.target)) { state.t = state.target; state.moving = false; if (state.target === 0) { lampsA.visible = false; lampsG.visible = true; } }
    // ease: fast start, cushioned stop
    const e = state.target === 1 ? 1 - Math.pow(1 - state.t, 2.2) : 1 - Math.pow(1 - state.t, 1.6);
    placeLeaves(Math.min(1, Math.max(0, e)));
    const shouldBlock = state.t < 0.3; if (shouldBlock !== state.blocked) { state.blocked = shouldBlock; setDoorBlockers(shouldBlock); }
  });

  const doorPositions = doors.map(d => ({ x: d.x, z: zLine, width: d.clear, leaves: d.leaves, car: d.car, index: d.index }));
  const api = {
    group, setOpen, get isOpen() { return state.open; }, get openness() { return state.t; }, get moving() { return state.moving; },
    doorPositions, doorPositionsX: doorPositions.map(d => d.x), doorPositionsZ: doorPositions.map(d => d.x),   // along-platform coordinate (world x on the Jubilee)
    doorPositionsAlong: doorPositions.map(d => d.x), zLine, y, platformNumber, name,
  };
  return api;
}
