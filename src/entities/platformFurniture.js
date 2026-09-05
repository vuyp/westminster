// ---------------------------------------------------------------------------
// platformFurniture.js — reusable platform "set dressing" for the Jubilee AND
// District/Circle platform modules: benches, help points, CCTV, PA speakers,
// fire points, poster frames, roundel boards, station name panels, line
// diagrams, suspended/wall signs, next-train dot-matrix indicators, the
// platform-edge tactile strip + yellow line, a clock, emergency-exit boxes.
//
// Conventions (docs/ARCHITECTURE.md): metres, +X east, +Z south. Every helper
// takes (ctx, parent, opts) and builds in the PARENT's local frame — the
// District module can hand a rotated group and place things in its s/t frame.
// `facing` = the direction the front of the item points: 'south' (+z), 'north'
// (-z), 'east' (+x), 'west' (-x) or a yaw in radians. Positions are the anchor
// described per helper (usually the wall point behind the item, or the floor
// point under it).
//
// Draw calls: pass `batch: createBatcher()` in opts to bake static geometry
// into one merged mesh per material (call batch.flush(parent) afterwards).
// Animated parts (dot-matrix faces, clock hands) are never batched.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE } from '../core/layout.js';

const FACING_YAW = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 };
/** Yaw (rotation.y) for a facing keyword or number. A local +z-facing object rotated by this faces `facing`. */
export function facingYaw(facing) { return typeof facing === 'number' ? facing : (FACING_YAW[facing] ?? 0); }

// ---------------------------------------------------------------------------
// Batcher — merges static geometry per material into a single mesh.
// ---------------------------------------------------------------------------
export function createBatcher() {
  const buckets = new Map();
  const api = {
    /** Queue a geometry (cloned) under `material`, transformed by `matrix` (Matrix4, optional). */
    add(geometry, material, matrix = null) {
      let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      if (matrix) g.applyMatrix4(matrix);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) { g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
      // drop any extra attributes (uv1, color…) so all geometries under a material merge cleanly
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      g.clearGroups();
      if (!buckets.has(material)) buckets.set(material, []);
      buckets.get(material).push(g);
    },
    /** Bake a built Group (children with local transforms) into the batch relative to `parent`. Meshes flagged userData.noBatch stay live and are re-parented under `parent`. */
    bakeGroup(parent, group) {
      parent.add(group); parent.updateWorldMatrix(true, false); group.updateWorldMatrix(false, true);
      const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
      const keep = [];
      group.traverse(o => { if (o.isMesh) { if (o.userData.noBatch || o.isInstancedMesh) keep.push(o); else api.add(o.geometry, o.material, new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); } });
      parent.remove(group);
      for (const m of keep) { const wm = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld); m.removeFromParent(); wm.decompose(m.position, m.quaternion, m.scale); parent.add(m); }
    },
    /** Create one merged mesh per material under `parent`. Returns the meshes. */
    flush(parent, { castShadow = false, receiveShadow = true, name = 'batch' } = {}) {
      const out = [];
      for (const [mat, geos] of buckets) {
        let merged = null;
        try { merged = mergeGeometries(geos, false); } catch (e) { merged = null; }
        if (!merged) { console.warn('[platformFurniture] merge failed for a material; adding separately'); for (const g of geos) { const m = new THREE.Mesh(g, mat); parent.add(m); out.push(m); } continue; }
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow; mesh.name = name;
        parent.add(mesh); out.push(mesh);
      }
      buckets.clear();
      return out;
    },
    get size() { return buckets.size; },
  };
  return api;
}

/** Either bake `g` into opts.batch (relative to parent) or add it as a live group. */
function finish(parent, g, opts) {
  if (opts && opts.batch) opts.batch.bakeGroup(parent, g); else parent.add(g);
  return g;
}

function placed(x, y, z, facing) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = facingYaw(facing); return g; }

// ---------------------------------------------------------------------------
// Materials & textures shared by both platform modules (cached).
// ---------------------------------------------------------------------------
const matCache = new Map();
function cachedMat(key, make) { if (!matCache.has(key)) matCache.set(key, make()); return matCache.get(key); }
const signMatCache = new Map();
/** A cached sign material for a texture (so many planes with the same texture merge into one draw call). */
export function signMaterial(ctx, texture, { emissive = 0.55, doubleSided = false, transparent = false } = {}) {
  const key = texture.uuid + ':' + emissive + ':' + doubleSided + ':' + transparent;
  if (!signMatCache.has(key)) signMatCache.set(key, ctx.M.signMaterial(texture, { emissive, side: doubleSided ? THREE.DoubleSide : THREE.FrontSide, transparent }));
  return signMatCache.get(key);
}

function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }

/** Light-grey speckled terrazzo (dossier §6.2: #c8c8c3) — 1 tile = 2 m. */
export function terrazzoMaterial(ctx, { base = PALETTE.terrazzoLight, seed = 5, joints = 0 } = {}) {
  return cachedMat('terrazzo:' + base + ':' + seed + ':' + joints, () => {
    const T = ctx.T; const size = 1024; const c = T.canvas(size, size); const g = c.getContext('2d');
    const rnd = T.mulberry32(seed); const n = T.noiseField(size, { octaves: 4, seed: seed + 3, baseFreq: 5 });
    const img = g.createImageData(size, size); const d = img.data;
    const br = (base >> 16) & 255, bg = (base >> 8) & 255, bb = base & 255;
    for (let i = 0; i < size * size; i++) { const v = (n[i] - 0.5) * 22; d[i * 4] = br + v; d[i * 4 + 1] = bg + v; d[i * 4 + 2] = bb + v; d[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
    // marble/glass chips: mostly darker greys, a few white and near-black
    for (let i = 0; i < 9000; i++) {
      const s = rnd(); const col = s < 0.12 ? '#f2f2ee' : s < 0.3 ? '#5c5e5f' : s < 0.55 ? '#8d8f8e' : s < 0.7 ? '#3a3b3c' : '#a9aaa6';
      g.fillStyle = col; g.globalAlpha = 0.55 + rnd() * 0.45; g.beginPath(); g.ellipse(rnd() * size, rnd() * size, 1 + rnd() * 3.5, 1 + rnd() * 2.5, rnd() * Math.PI, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // grime: faint darker wash along a random band (foot traffic) — subtle
    const grad = g.createLinearGradient(0, 0, 0, size); grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(0.5, 'rgba(20,20,18,0.08)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, size, size);
    if (joints) { const px = size / 2 * joints; g.strokeStyle = 'rgba(30,30,30,0.35)'; g.lineWidth = 2; for (let k = 0; k <= 2 / joints; k++) { g.beginPath(); g.moveTo(k * px, 0); g.lineTo(k * px, size); g.stroke(); g.beginPath(); g.moveTo(0, k * px); g.lineTo(size, k * px); g.stroke(); } }
    const rc = T.canvas(size, size); const rg = rc.getContext('2d'); rg.fillStyle = '#6a6a6a'; rg.fillRect(0, 0, size, size);
    for (let i = 0; i < 1500; i++) { rg.fillStyle = `rgba(${rnd() < 0.5 ? 40 : 140},${rnd() < 0.5 ? 40 : 140},${rnd() < 0.5 ? 40 : 140},0.15)`; rg.beginPath(); rg.arc(rnd() * size, rnd() * size, 2 + rnd() * 30, 0, Math.PI * 2); rg.fill(); }
    const map = T.toTexture(c); const rough = T.toTexture(rc, { srgb: false });
    map.repeat.set(0.5, 0.5); rough.repeat.set(0.5, 0.5);
    const m = new THREE.MeshStandardMaterial({ map, roughnessMap: rough, roughness: 0.75, metalness: 0.02 }); m.userData.metres = 2; return m;
  });
}

/** Worn safety-yellow paint line — 1 tile = 1 m along the line. */
export function wornYellowMaterial(ctx, { color = 0xf2c500, wear = 0.45, seed = 9 } = {}) {
  return cachedMat('wornYellow:' + color + wear, () => {
    const T = ctx.T; const c = T.canvas(512, 64); const g = c.getContext('2d'); const rnd = T.mulberry32(seed);
    g.fillStyle = hex(color); g.fillRect(0, 0, 512, 64);
    for (let i = 0; i < 260 * wear; i++) { g.fillStyle = `rgba(150,150,145,${0.25 + rnd() * 0.5})`; g.beginPath(); g.ellipse(rnd() * 512, rnd() * 64, 2 + rnd() * 14, 1 + rnd() * 4, rnd() * 0.4, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(60,60,55,${rnd() * 0.25})`; g.fillRect(rnd() * 512, rnd() * 64, 1 + rnd() * 6, 1 + rnd() * 2); }
    const map = T.toTexture(c); const m = new THREE.MeshStandardMaterial({ map, roughness: 0.7, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }); m.userData.metres = 1; return m;
  });
}

/** Dark blister tactile (Jubilee/D&C platform edge) — wraps ctx.M.tactile with the dossier colour. */
export function tactileMaterial(ctx, { type = 'blister', color = PALETTE.tactileDark } = {}) {
  const m = ctx.M.tactile(type, color); m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1; return m;
}

// ---------- canvas faces ----------
function helpPointTexture(ctx) {
  const T = ctx.T; const key = 'helpPointFace';
  return cachedMat(key, () => {
    const c = T.canvas(256, 384); const g = c.getContext('2d');
    g.fillStyle = '#1c2e8c'; g.fillRect(0, 0, 256, 384);
    g.fillStyle = '#fff'; g.font = `bold 34px ${T.SIGN_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Help point', 128, 34);
    g.fillStyle = '#dfe3ea'; g.fillRect(16, 60, 224, 3);
    // speaker grille
    for (let r = 0; r < 6; r++) for (let k = 0; k < 14; k++) { g.fillStyle = '#0b1657'; g.beginPath(); g.arc(30 + k * 15, 84 + r * 14, 3.6, 0, Math.PI * 2); g.fill(); }
    // buttons
    const btn = (cx, cy, col, label) => { g.fillStyle = '#cfd3d8'; g.beginPath(); g.arc(cx, cy, 36, 0, Math.PI * 2); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(cx, cy, 30, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.arc(cx - 8, cy - 8, 12, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.font = `bold 20px ${T.SIGN_FONT}`; g.fillText(label, cx, cy + 62); };
    btn(72, 230, '#007a33', 'Information'); btn(184, 230, '#dc241f', 'Emergency');
    // induction loop symbol + text
    g.fillStyle = '#fff'; g.font = `bold 16px ${T.SIGN_FONT}`; g.fillText('Press and wait for an answer', 128, 330);
    g.font = `bold 30px ${T.SIGN_FONT}`; g.fillText('T', 226, 356); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(210, 356, 12, Math.PI * 0.5, Math.PI * 1.5); g.stroke();
    return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
  });
}

function firePointTexture(ctx) {
  const T = ctx.T; return cachedMat('firePointFace', () => {
    const c = T.canvas(256, 256); const g = c.getContext('2d');
    g.fillStyle = '#c8102e'; g.fillRect(0, 0, 256, 256);
    // ISO 7010 F001 extinguisher pictogram (white)
    g.fillStyle = '#fff'; g.fillRect(96, 60, 44, 120); g.fillRect(108, 40, 20, 24); g.fillRect(84, 44, 18, 8); g.fillRect(60, 60, 8, 70);
    g.beginPath(); g.moveTo(68, 60); g.lineTo(96, 52); g.lineTo(96, 66); g.lineTo(68, 72); g.fill();
    g.font = `bold 30px ${T.SIGN_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Fire point', 128, 216);
    return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
  });
}

/** Green 'Emergency exit' running-man box face (BS 5499 / ISO 7010). arrow: 'left'|'right'|'up'|'down'|null */
export function emergencyExitTexture(ctx, { arrow = 'up', text = 'Emergency exit' } = {}) {
  const T = ctx.T; return cachedMat('exit:' + arrow + text, () => {
    const c = T.canvas(512, 256); const g = c.getContext('2d');
    g.fillStyle = '#009639'; g.fillRect(0, 0, 512, 256);
    // door + running man
    g.fillStyle = '#fff'; g.fillRect(40, 48, 70, 160); g.fillStyle = '#009639'; g.fillRect(52, 60, 46, 136);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(160, 78, 16, 0, Math.PI * 2); g.fill();
    g.lineWidth = 16; g.strokeStyle = '#fff'; g.lineCap = 'round';
    g.beginPath(); g.moveTo(150, 100); g.lineTo(190, 130); g.lineTo(178, 176); g.stroke();
    g.beginPath(); g.moveTo(190, 130); g.lineTo(230, 118); g.stroke();
    g.beginPath(); g.moveTo(178, 176); g.lineTo(210, 210); g.stroke();
    g.beginPath(); g.moveTo(165, 112); g.lineTo(135, 140); g.stroke();
    g.beginPath(); g.moveTo(178, 176); g.lineTo(140, 200); g.stroke();
    if (arrow) T.drawArrow(g, 440, 128, 110, arrow, '#fff');
    g.fillStyle = '#fff'; g.font = `bold 44px ${T.SIGN_FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(text, 250, 128);
    return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
  });
}

/** White station name panel: 'WESTMINSTER' in dark blue caps with a line-colour band (the JLE discrete name panels). */
export function namePanelTexture(ctx, { name = 'WESTMINSTER', lineColor = '#a0a5a9', lineName = 'Jubilee line' } = {}) {
  const T = ctx.T;
  return T.sign({ width: 1024, height: 256, bg: '#f4f4f1', fills: [{ x: 0, y: 214, w: 1024, h: 42, color: lineColor }],
    lines: [{ text: name, x: 512, y: 150, size: 132, align: 'center', color: '#1c2e8c', letterSpacing: '6px' }, { text: lineName, x: 24, y: 246, size: 30, color: '#fff', weight: 'bold' }] });
}

/** Clock face (static drawing of hour/minute hands for a given Date). */
function drawClockFace(g, size, date) {
  const cx = size / 2, cy = size / 2, r = size * 0.47;
  g.clearRect(0, 0, size, size);
  g.fillStyle = '#f7f7f4'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#c9cbcd'; g.lineWidth = size * 0.03; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#111'; g.font = `bold ${size * 0.11}px 'Johnston', 'Gill Sans', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let h = 1; h <= 12; h++) { const a = h / 12 * Math.PI * 2; g.fillText(String(h), cx + Math.sin(a) * r * 0.78, cy - Math.cos(a) * r * 0.78 + size * 0.005); }
  for (let m = 0; m < 60; m++) { const a = m / 60 * Math.PI * 2; const l = m % 5 === 0 ? 0.08 : 0.035; g.strokeStyle = '#111'; g.lineWidth = m % 5 === 0 ? size * 0.012 : size * 0.006; g.beginPath(); g.moveTo(cx + Math.sin(a) * r * 0.93, cy - Math.cos(a) * r * 0.93); g.lineTo(cx + Math.sin(a) * r * (0.93 - l), cy - Math.cos(a) * r * (0.93 - l)); g.stroke(); }
  const hr = (date.getHours() % 12 + date.getMinutes() / 60) / 12 * Math.PI * 2, mn = (date.getMinutes() + date.getSeconds() / 60) / 60 * Math.PI * 2;
  g.strokeStyle = '#111'; g.lineCap = 'round';
  g.lineWidth = size * 0.04; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(hr) * r * 0.5, cy - Math.cos(hr) * r * 0.5); g.stroke();
  g.lineWidth = size * 0.03; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(mn) * r * 0.78, cy - Math.cos(mn) * r * 0.78); g.stroke();
  const sc = date.getSeconds() / 60 * Math.PI * 2; g.strokeStyle = '#dc241f'; g.lineWidth = size * 0.012; g.beginPath(); g.moveTo(cx - Math.sin(sc) * r * 0.15, cy + Math.cos(sc) * r * 0.15); g.lineTo(cx + Math.sin(sc) * r * 0.82, cy - Math.cos(sc) * r * 0.82); g.stroke();
  g.fillStyle = '#111'; g.beginPath(); g.arc(cx, cy, size * 0.03, 0, Math.PI * 2); g.fill();
}

// ---------------------------------------------------------------------------
// Furniture
// ---------------------------------------------------------------------------

/**
 * Stainless perforated 3-seat bench (JLE type, c. 1.5 m, seat 450 mm). Anchor = floor point under the bench centre;
 * `facing` = direction the sitters look. Registers a blocker. opts: { x,y,z, facing, seats=3, batch, blocker=true }
 */
export function addBench(ctx, parent, { x, y, z, facing = 'south', seats = 3, batch = null, blocker = true } = {}) {
  const { M } = ctx; const g = placed(x, y, z, facing);
  const w = seats * 0.5, seatH = 0.45, depth = 0.46;
  const stainless = M.stainless(); const perf = M.perforated();
  const pan = new THREE.Mesh(ctx.T.boxGeometryMetric(w, 0.035, depth), perf); pan.position.set(0, seatH, 0); g.add(pan);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.03), stainless); lip.position.set(0, seatH - 0.02, depth / 2); g.add(lip);
  const back = new THREE.Mesh(ctx.T.boxGeometryMetric(w, 0.32, 0.03), perf); back.position.set(0, seatH + 0.32, -depth / 2 + 0.06); back.rotation.x = -0.12; g.add(back);
  for (const sx of [-w / 2 + 0.18, w / 2 - 0.18]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, seatH - 0.02, depth * 0.7), stainless); leg.position.set(sx, (seatH - 0.02) / 2, 0); g.add(leg);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.36, 8), stainless); post.position.set(sx, seatH + 0.18, -depth / 2 + 0.04); post.rotation.x = -0.12; g.add(post);
  }
  for (let i = 1; i < seats; i++) { const div = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, depth * 0.8), stainless); div.position.set(-w / 2 + i * 0.5, seatH + 0.07, 0); g.add(div); }
  const foot = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.02, 0.12), stainless); foot.position.set(0, 0.01, 0); g.add(foot);
  if (blocker) { const yaw = facingYaw(facing); const hw = Math.abs(Math.cos(yaw)) * w / 2 + Math.abs(Math.sin(yaw)) * depth / 2, hd = Math.abs(Math.sin(yaw)) * w / 2 + Math.abs(Math.cos(yaw)) * depth / 2; const p = parent.localToWorld(new THREE.Vector3(x, y, z)); ctx.collision.addBlocker({ xMin: p.x - hw, xMax: p.x + hw, yMin: p.y, yMax: p.y + 0.95, zMin: p.z - hd, zMax: p.z + hd }, 'bench'); }
  return finish(parent, g, { batch });
}

/** Help point: stainless wall panel with the blue face (green 'Information' / red 'Emergency'). Anchor = wall point; centre 1.2 m up. */
export function addHelpPoint(ctx, parent, { x, y, z, facing = 'south', batch = null, height = 1.2 } = {}) {
  const { M } = ctx; const g = placed(x, y, z, facing);
  const panel = new THREE.Mesh(ctx.T.boxGeometryMetric(0.5, 0.72, 0.06), M.stainless()); panel.position.set(0, height, 0.03); g.add(panel);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.62), signMaterial(ctx, helpPointTexture(ctx), { emissive: 0.35 })); face.position.set(0, height, 0.062); g.add(face);
  return finish(parent, g, { batch });
}

/** CCTV dome camera. mount 'ceiling' (anchor = ceiling point, dome hangs below) or 'wall' (bracket out from the wall, facing). */
export function addCCTV(ctx, parent, { x, y, z, facing = 'south', mount = 'ceiling', batch = null } = {}) {
  const { M } = ctx; const g = placed(x, y, z, facing);
  const white = M.paint(0xf1f1ee, { roughness: 0.5 }); const dome = M.paint(0x14171c, { roughness: 0.12, metalness: 0.4 });
  let base;
  if (mount === 'ceiling') { base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.035, 20), white); base.position.set(0, -0.018, 0); g.add(base); const d = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), dome); d.position.set(0, -0.035, 0); g.add(d); }
  else { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.3), white); arm.position.set(0, 0, 0.15); g.add(arm); base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.035, 20), white); base.position.set(0, -0.03, 0.3); g.add(base); const d = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), dome); d.position.set(0, -0.047, 0.3); g.add(d); }
  return finish(parent, g, { batch });
}

/** PA speaker: slim cylindrical stainless enclosure (c. 300 mm) on a bracket. Anchor = mounting point (beam/wall). Returns {group, position(world)} */
export function addSpeaker(ctx, parent, { x, y, z, facing = 'south', mount = 'ceiling', batch = null } = {}) {
  const { M } = ctx; const g = placed(x, y, z, facing);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 14), M.stainless()); body.rotation.x = Math.PI / 2;
  const grille = new THREE.Mesh(new THREE.CircleGeometry(0.052, 14), M.paint(0x2a2c2e, { roughness: 0.9 }));
  if (mount === 'ceiling') { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), M.stainless()); rod.position.set(0, -0.09, 0); g.add(rod); body.position.set(0, -0.2, 0); body.rotation.z = 0; body.rotation.x = Math.PI / 2 - 0.35; grille.position.set(0, -0.2 - Math.sin(0.35) * 0.151, Math.cos(0.35) * 0.151); grille.rotation.x = -0.35; }
  else { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.12), M.stainless()); arm.position.set(0, 0, 0.06); g.add(arm); body.position.set(0, 0, 0.12 + 0.06); body.rotation.x = 0; body.rotation.z = Math.PI / 2; body.rotation.y = Math.PI / 2; grille.position.set(0, 0, 0.12 + 0.06 + 0.151); }
  g.add(body, grille);
  const position = parent.localToWorld(new THREE.Vector3(x, y - (mount === 'ceiling' ? 0.2 : 0), z));
  finish(parent, g, { batch });
  return { group: g, position };
}

/** Fire point: water + CO2 extinguishers on a stainless bracket with the red 'Fire point' sign above. Anchor = wall point at floor level. */
export function addFireEquipment(ctx, parent, { x, y, z, facing = 'south', batch = null, sign = true } = {}) {
  const { M } = ctx; const g = placed(x, y, z, facing);
  const red = M.paint(0xc8102e, { roughness: 0.35, metalness: 0.2 }); const black = M.rubber(0x151515); const stainless = M.stainless();
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.04), stainless); bracket.position.set(0, 1.1, 0.02); g.add(bracket);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.22), stainless); shelf.position.set(0, 0.42, 0.11); g.add(shelf);
  for (const [sx, h, r, co2] of [[-0.16, 0.6, 0.085, false], [0.16, 0.55, 0.065, true]]) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), red); body.position.set(sx, 0.435 + h / 2, 0.12); g.add(body);
    const top = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), red); top.position.set(sx, 0.435 + h, 0.12); g.add(top);
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), black); valve.position.set(sx, 0.435 + h + r + 0.05, 0.12); g.add(valve);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.16), black); handle.position.set(sx, 0.435 + h + r + 0.11, 0.16); g.add(handle);
    if (co2) { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 10), black); horn.position.set(sx + 0.1, 0.435 + h * 0.75, 0.18); horn.rotation.z = -Math.PI / 2; g.add(horn); }
    const label = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.6, h * 0.45), M.paint(co2 ? 0x111111 : 0xdedede, { roughness: 0.6 })); label.position.set(sx, 0.435 + h * 0.55, 0.12 + r + 0.002); g.add(label);
  }
  if (sign) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), signMaterial(ctx, firePointTexture(ctx), { emissive: 0.4 })); s.position.set(0, 1.75, 0.012); g.add(s); }
  const p = parent.localToWorld(new THREE.Vector3(x, y, z)); ctx.collision.addBlocker({ xMin: p.x - 0.35, xMax: p.x + 0.35, yMin: p.y, yMax: p.y + 1.3, zMin: p.z - 0.35, zMax: p.z + 0.35 }, 'firepoint');
  return finish(parent, g, { batch });
}

/**
 * Poster frame: 4-sheet portrait (1016 × 1524 mm) by default in a stainless frame with a 50 mm border, bottom 0.9 m above
 * the floor; or landscape (w,h). Anchor = wall point at floor level. opts: { seed, headline, sub, w, h, bottom, texture }
 */
export function addPosterFrame(ctx, parent, { x, y, z, facing = 'south', w = 1.016, h = 1.524, bottom = 0.9, seed = 1, headline, sub, hue = null, texture = null, batch = null, border = 0.05 } = {}) {
  const { M, T } = ctx; const g = placed(x, y, z, facing);
  const tex = texture || T.poster({ width: w > h ? 1024 : 512, height: w > h ? Math.round(1024 * h / w) : 768, seed, headline: headline ?? POSTER_COPY[seed % POSTER_COPY.length][0], sub: sub ?? POSTER_COPY[seed % POSTER_COPY.length][1], hue });
  const frame = new THREE.Mesh(T.boxGeometryMetric(w + border * 2, h + border * 2, 0.035), M.stainless()); frame.position.set(0, bottom + h / 2, 0.0175); g.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMaterial(ctx, tex, { emissive: 0.3 })); face.position.set(0, bottom + h / 2, 0.037); g.add(face);
  return finish(parent, g, { batch });
}
const POSTER_COPY = [['London', 'See more of it'], ['Theatre', 'Book by Tube'], ['Art', 'Free galleries'], ['Museums', 'Late nights'], ['Parks', 'A breath of air'], ['Music', 'Every night'], ['River', 'Take the boat'], ['Markets', 'Every weekend']];

/** Platform name roundel (ring outer c. 0.9–1.0 m, 'WESTMINSTER' in the bar, bar centre 1.6–1.7 m). Anchor = wall point at floor level. */
export function addRoundelBoard(ctx, parent, { x, y, z, facing = 'south', name = 'WESTMINSTER', size = 1.05, centre = 1.65, frame = false, batch = null } = {}) {
  const { M, T } = ctx; const g = placed(x, y, z, facing);
  const tex = T.roundel({ size: 512, text: name, ringColor: '#d42a25', barColor: '#1c2e8c' });
  if (frame) { const back = new THREE.Mesh(T.boxGeometryMetric(size * 1.2, size * 1.05, 0.03), M.stainless()); back.position.set(0, centre, 0.015); g.add(back); }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(size, size), signMaterial(ctx, tex, { emissive: 0.5, transparent: true })); face.position.set(0, centre, frame ? 0.032 : 0.01); g.add(face);
  return finish(parent, g, { batch });
}

/** White 'WESTMINSTER' name panel with the line-colour band (JLE discrete name panels). Anchor = wall point at floor level; panel centre at `centre`. */
export function addNamePanel(ctx, parent, { x, y, z, facing = 'south', name = 'WESTMINSTER', lineColor = '#a0a5a9', lineName = 'Jubilee line', w = 2.4, centre = 2.15, batch = null } = {}) {
  const g = placed(x, y, z, facing);
  const h = w / 4; const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMaterial(ctx, namePanelTexture(ctx, { name, lineColor, lineName }), { emissive: 0.45 })); face.position.set(0, centre, 0.02); g.add(face);
  const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, h + 0.04, 0.02), ctx.M.paint(0x8c9094, { roughness: 0.5, metalness: 0.5 })); back.position.set(0, centre, 0.008); g.add(back);
  return finish(parent, g, { batch });
}

/** Line diagram panel (c. 1.6 × 0.5 m) at 1.55 m. Anchor = wall point at floor level. */
export function addLineDiagram(ctx, parent, { x, y, z, facing = 'south', line = 'Jubilee', color = '#a0a5a9', stations = [], current = 'Westminster', w = 1.6, centre = 1.55, batch = null } = {}) {
  const { M, T } = ctx; const g = placed(x, y, z, facing);
  const h = w * 0.3; const tex = T.lineDiagram({ line, color, stations, current, width: 2048, height: 620 });
  const frame = new THREE.Mesh(T.boxGeometryMetric(w + 0.06, h + 0.06, 0.03), M.stainless()); frame.position.set(0, centre, 0.015); g.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMaterial(ctx, tex, { emissive: 0.4 })); face.position.set(0, centre, 0.032); g.add(face);
  return finish(parent, g, { batch });
}

/** Flat sign fixed to a wall. Anchor = wall point at the sign CENTRE. */
export function addWallSign(ctx, parent, { x, y, z, facing = 'south', texture, w = 1, h = 0.25, depth = 0.03, emissive = 0.55, transparent = false, batch = null, backColor = 0x1c2e8c } = {}) {
  const g = placed(x, y, z, facing);
  if (depth > 0) { const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), ctx.M.paint(backColor, { roughness: 0.5 })); box.position.set(0, 0, depth / 2); g.add(box); }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMaterial(ctx, texture, { emissive, transparent })); face.position.set(0, 0, depth + 0.002); g.add(face);
  return finish(parent, g, { batch });
}

/**
 * Suspended sign box hung on two stainless rods. Anchor = point on the ceiling/beam it hangs from (x,y,z); `drop` = rod
 * length; the sign's underside is at y - drop - h. `texture` (front) and optional `backTexture` (defaults to the same);
 * `facing` = direction the FRONT faces.
 */
export function addSuspendedSign(ctx, parent, { x, y, z, facing = 'south', texture, backTexture = null, w = 1.2, h = 0.35, depth = 0.1, drop = 0.6, emissive = 0.6, batch = null, boxColor = 0x1c2e8c } = {}) {
  const { M } = ctx; const g = placed(x, y, z, facing);
  const yc = -drop - h / 2;
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), M.paint(boxColor, { roughness: 0.55 })); box.position.set(0, yc, 0); g.add(box);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMaterial(ctx, texture, { emissive })); front.position.set(0, yc, depth / 2 + 0.002); g.add(front);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMaterial(ctx, backTexture || texture, { emissive })); back.position.set(0, yc, -depth / 2 - 0.002); back.rotation.y = Math.PI; g.add(back);
  for (const sx of [-w / 2 + 0.12, w / 2 - 0.12]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, drop, 6), M.stainless()); rod.position.set(sx, -drop / 2, 0); g.add(rod); }
  return finish(parent, g, { batch });
}

/** Illuminated green 'Emergency exit' box (c. 0.5 × 0.25) — anchor = wall point at the box centre (or hang it with addSuspendedSign). */
export function addEmergencyExitSign(ctx, parent, { x, y, z, facing = 'south', arrow = 'up', text = 'Emergency exit', w = 0.5, batch = null } = {}) {
  return addWallSign(ctx, parent, { x, y, z, facing, texture: emergencyExitTexture(ctx, { arrow, text }), w, h: w / 2, depth: 0.06, emissive: 1.1, batch, backColor: 0xe8ebe8 });
}

// ---------------------------------------------------------------------------
// Next-train indicator (dot-matrix). One shared display per platform number; every board on that platform shows it.
// Registers ctx.register('indicator:<platformNumber>', { set(lines), display }) once (train service contract).
// ---------------------------------------------------------------------------
const displays = new Map();
function displayFor(ctx, platformNumber, cols, rows, initial) {
  const key = platformNumber;
  if (displays.has(key)) return displays.get(key);
  const T = ctx.T; const dm = T.dotMatrix({ cols, rows, dot: 6, gap: 2, color: '#ffa21a', dim: '#1d1204', lineGap: 3 });
  const mat = ctx.M.screen(dm.texture, 1.7);
  const rec = { display: dm, material: mat, platformNumber, set(lines, o) { try { dm.set(lines, o); } catch (e) { console.warn('[indicator] set failed', e); } } };
  if (initial) rec.set(initial);
  displays.set(key, rec);
  if (!ctx.get('indicator:' + platformNumber)) ctx.register('indicator:' + platformNumber, { set: (lines, o) => rec.set(lines, o), display: dm, platformNumber });
  return rec;
}
/** Default demo content until the train service takes over. */
export function defaultIndicatorLines(platformNumber) {
  const now = new Date(); const clock = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const table = {
    3: [{ left: '1  Stratford', right: '2 min' }, { left: '2  North Greenwich', right: '5 min' }, { left: 'Please stand behind the yellow line', right: clock }],
    4: [{ left: '1  Stanmore', right: '1 min' }, { left: '2  Wembley Park', right: '4 min' }, { left: 'Please stand behind the yellow line', right: clock }],
    2: [{ left: '1  Upminster', right: '3 min' }, { left: '2  Circle via Tower Hill', right: '5 min' }, { left: 'Mind the gap between the train and the platform', right: clock }],
    1: [{ left: '1  Wimbledon', right: '2 min' }, { left: '2  Edgware Rd via Victoria', right: '6 min' }, { left: 'Mind the gap between the train and the platform', right: clock }],
  };
  return table[platformNumber] || [{ left: '1  Next train', right: '2 min' }];
}
/**
 * Slim black double-sided dot-matrix indicator (JLE type, c. 1.3 × 0.36 m housing) hung from a ceiling/beam point.
 * Anchor = the point it hangs from; underside at y - drop - housingH. facing = direction the "front" faces (both faces
 * show the same display). Returns { group, display, material }.
 */
export function addNextTrainIndicator(ctx, parent, { x, y, z, facing = 'east', platformNumber = 3, cols = 160, rows = 3, drop = 0.5, doubleSided = true, batch = null, initial = null, mount = 'ceiling' } = {}) {
  const { M } = ctx; const g = placed(x, y, z, facing);
  const rec = displayFor(ctx, platformNumber, cols, rows, initial || defaultIndicatorLines(platformNumber));
  const dm = rec.display; const hw = 1.3, hh = 0.36, hd = 0.16; const yc = mount === 'ceiling' ? -drop - hh / 2 : 0;
  const housing = new THREE.Mesh(new THREE.BoxGeometry(hw, hh, hd), M.paint(0x141517, { roughness: 0.45, metalness: 0.3 })); housing.position.set(0, yc, 0); g.add(housing);
  const fw = 1.2, fh = fw / dm.aspect;
  const sides = doubleSided ? [1, -1] : [1];
  for (const s of sides) { const face = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), rec.material); face.position.set(0, yc + 0.01, s * (hd / 2 + 0.002)); face.rotation.y = s > 0 ? 0 : Math.PI; face.userData.noBatch = true; g.add(face); const glass = new THREE.Mesh(new THREE.PlaneGeometry(hw - 0.06, hh - 0.06), M.glass({ opacity: 0.12 })); glass.position.set(0, yc, s * (hd / 2 + 0.006)); glass.rotation.y = s > 0 ? 0 : Math.PI; glass.userData.noBatch = true; g.add(glass); }
  if (mount === 'ceiling') for (const sx of [-hw / 2 + 0.15, hw / 2 - 0.15]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, drop, 6), M.stainless()); rod.position.set(sx, -drop / 2, 0); g.add(rod); }
  // small platform number tab on the housing top edge
  const tab = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.09), signMaterial(ctx, ctx.T.sign({ width: 512, height: 116, bg: '#000', lines: [{ text: 'Platform ' + platformNumber, x: 256, y: 84, size: 70, align: 'center' }] }), { emissive: 0.5 }));
  tab.position.set(0, yc + hh / 2 + 0.045, 0.0); tab.userData.noBatch = false; g.add(tab);
  finish(parent, g, { batch });
  return { group: g, display: dm, material: rec.material, set: rec.set };
}

/**
 * Platform-edge kit along local +x from xMin to xMax at the edge line z = zEdge, the platform extending towards
 * `inward` (+1 = +z, -1 = -z). Builds the dark blister tactile strip (`tactileDepth`, set back `tactileSetback` from the
 * edge), the worn yellow line (100 mm, outer edge `yellowSetback` from the edge), optional white 'MIND THE GAP' text at
 * `gapSpacing` intervals (D&C), and an optional pale coping strip at the very edge. Heights: y = floor level.
 */
export function addYellowLineAndTactiles(ctx, parent, { xMin, xMax, y, zEdge, inward = -1, tactile = true, tactileDepth = 0.4, tactileSetback = 0.0, yellow = true, yellowSetback = 0.6, yellowWidth = 0.1, wear = 0.45, mindTheGap = false, gapSpacing = 4.9, gapOffset = 0, coping = 0, batch = null } = {}) {
  const { T } = ctx; const g = new THREE.Group(); const len = xMax - xMin, xc = (xMin + xMax) / 2;
  if (coping > 0) { const cop = ctx.floorPlane(len, coping, ctx.M.precast({ base: 0xbdbbb5 }), { x: xc, y: y + 0.003, z: zEdge + inward * coping / 2 }); g.add(cop); }
  if (tactile) { const tm = tactileMaterial(ctx); const zc = zEdge + inward * (tactileSetback + tactileDepth / 2); const strip = ctx.floorPlane(len, tactileDepth, tm, { x: xc, y: y + 0.004, z: zc }); g.add(strip); }
  if (yellow) { const ym = wornYellowMaterial(ctx, { wear }); const zc = zEdge + inward * (yellowSetback - yellowWidth / 2); const line = ctx.floorPlane(len, yellowWidth, ym, { x: xc, y: y + 0.005, z: zc }); g.add(line); }
  if (mindTheGap) {
    const tex = T.sign({ width: 1024, height: 160, bg: '#5a5a58', lines: [{ text: 'MIND THE GAP', x: 512, y: 122, size: 120, align: 'center', color: '#f4f4f0', letterSpacing: '8px' }] });
    const m = signMaterial(ctx, tex, { emissive: 0.2 }); m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
    for (let x = xMin + gapOffset + gapSpacing / 2; x < xMax; x += gapSpacing) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.23), m); p.rotation.x = -Math.PI / 2; if (inward > 0) p.rotation.z = Math.PI; p.position.set(x, y + 0.006, zEdge + inward * (tactileSetback + tactileDepth / 2)); g.add(p); }
  }
  return finish(parent, g, { batch });
}

/** Round stainless clock (c. 300 mm) with black Johnston numerals; hands follow ctx.stationTime() (or Date). Anchor = wall point at the clock centre. */
export function addClock(ctx, parent, { x, y, z, facing = 'south', size = 0.32 } = {}) {
  const { M, T } = ctx; const g = placed(x, y, z, facing);
  const c = T.canvas(256, 256); const g2 = c.getContext('2d'); const tex = T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
  const timeFn = () => (ctx.stationTime ? ctx.stationTime() : new Date());
  drawClockFace(g2, 256, timeFn());
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(size / 2 + 0.02, size / 2 + 0.02, 0.06, 32), M.stainless()); rim.rotation.x = Math.PI / 2; rim.position.set(0, 0, 0.03); g.add(rim);
  const face = new THREE.Mesh(new THREE.CircleGeometry(size / 2, 32), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.6, transparent: true })); face.position.set(0, 0, 0.062); face.userData.noBatch = true; g.add(face);
  let acc = 0; ctx.onUpdate(dt => { acc += dt; if (acc < 1) return; acc = 0; drawClockFace(g2, 256, timeFn()); tex.needsUpdate = true; });
  parent.add(g); return g;
}

/** Corduroy hazard strip at a stair head/foot: 400 mm deep across `width`, centred at (x,z), running along local x. */
export function addCorduroy(ctx, parent, { x, y, z, width, depth = 0.4, batch = null, color = 0x6a6a68 } = {}) {
  const m = ctx.M.tactile('corduroy', color); m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1;
  const g = new THREE.Group(); const p = ctx.floorPlane(width, depth, m, { x, y: y + 0.004, z }); g.add(p); return finish(parent, g, { batch });
}
