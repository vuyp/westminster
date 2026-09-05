// ---------------------------------------------------------------------------
// street/kit.js — helpers shared by the street sub-modules:
//   Merger      batches static geometry per (chunk, material) into one mesh each
//   Instancer   collects instance matrices per (geometry, material) → InstancedMesh
//   makeMaterials(ctx)  every shared street material (from ctx.M + a few tiled facade maps)
//   canvas textures: facades (Portland baroque / Victorian / Gothic bay / brick-and-bands),
//   PH window units, pierced Gothic parapet (alpha), clock dial, Union flag, grates, grass, water normals
//   geometry: lathe profiles, segmental arch spandrels, trees, figures, lamp posts, bollards
// Everything is procedural (no assets). Units are metres, +x east, +z south.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE } from '../../core/layout.js';

export const FONT = "'Johnston', 'Johnston100', 'Gill Sans', 'Gill Sans MT', 'Hammersmith One', 'Helvetica Neue', Helvetica, Arial, 'DejaVu Sans', sans-serif";
export const DEG = Math.PI / 180;

/** Street colour palette (dossier §11 / §12.10). */
export const COL = {
  phSand: 0xc4a48a, phSandDark: 0x8e7560, phBronze: 0x4a3a2c, phBronzeWeathered: 0x5b5548, phGranite: 0x8c8481, phGlass: 0x25313a, phChimney: 0x2c2a26,
  anston: 0xd9cba8, anstonRecess: 0x8f8672, prussian: 0x003153, gilt: 0xc9a227,
  bridgeGreen: 0x2f5f3f, bridgeGreenFlat: 0x3e6b4a, bridgeGreenShadow: 0x1f3f2b,
  boadiceaBronze: 0x3e4a3a, graniteGrey: 0x7d7a76, dolphinBlack: 0x1a1a1a, globe: 0xf0f0ea, grate: 0x4a4c4e,
  countyHall: 0xd6d2c4, coade: 0xd9d3bf, eyeWhite: 0xe6e6e4, brickRed: 0x8e3b2e, portlandBand: 0xd8d4c6,
  york: 0xa89f87, yorkWet: 0x6e675a, kerb: 0x7f7f7a, asphalt: 0x3b3b3b, asphaltWorn: 0x5a5a58,
  busRed: 0xda291c, cab: 0x0b0b0b, water: 0x6b6e62, waterReflect: 0x9aa0a0, skyZenith: 0xdde1e4, skyHorizon: 0xeef0f0,
  treasuryStone: 0xd4cfc0, copper: 0x5f8b73, grass: 0x4f7a33, leaf: 0x3f6b2a, leafLight: 0x6a9a3c, bark: 0x4b3f33,
};

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
export { hex };

// ======================================================================= Merger
/** Collects geometries per (chunk, material) and emits one merged Mesh per pair. Static geometry only. */
export class Merger {
  constructor(parent, name = 'street') { this.parent = parent; this.name = name; this.batches = new Map(); this.chunkKey = ''; this.count = 0; }
  /** Set the current chunk (separate meshes per chunk keep frustum culling effective). */
  chunk(key) { this.chunkKey = key || ''; return this; }
  /** Add a geometry (consumed) at a pose. Rotation rx, ry, rz in radians (Euler YXZ), uniform/non-uniform scale. `uvWorld` recomputes metric UVs from final positions. */
  add(mat, geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, uvWorld = false } = {}) {
    if (!geo || !mat) return;
    if (sx !== 1 || sy !== 1 || sz !== 1) geo.scale(sx, sy, sz);
    if (rx || ry || rz) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')));
    if (x || y || z) geo.translate(x, y, z);
    if (uvWorld) metricUVsWorld(geo);
    let byMat = this.batches.get(this.chunkKey); if (!byMat) { byMat = new Map(); this.batches.set(this.chunkKey, byMat); }
    let list = byMat.get(mat); if (!list) { list = []; byMat.set(mat, list); }
    list.push(geo.index ? geo.toNonIndexed() : geo); this.count++;
  }
  /** Box w×h×d centred at the pose (metric UVs). */
  box(mat, w, h, d, pose = {}) { this.add(mat, boxMetric(w, h, d), pose); }
  /** Box whose BOTTOM-centre is at the pose (buildings, posts). */
  boxUp(mat, w, h, d, pose = {}) { const g = boxMetric(w, h, d); g.translate(0, h / 2, 0); this.add(mat, g, pose); }
  cyl(mat, rTop, rBot, h, seg, pose = {}, open = false) { this.add(mat, new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open), pose); }
  sphere(mat, r, pose = {}, ws = 10, hs = 8) { this.add(mat, new THREE.SphereGeometry(r, ws, hs), pose); }
  cone(mat, r, h, seg, pose = {}) { this.add(mat, new THREE.ConeGeometry(r, h, seg), pose); }
  torus(mat, r, tube, rs, ts, pose = {}, arc = Math.PI * 2) { this.add(mat, new THREE.TorusGeometry(r, tube, rs, ts, arc), pose); }
  /** Straight tube from a to b (Vector3 or {x,y,z}), radius r. */
  tube(mat, a, b, r, seg = 8) {
    const A = new THREE.Vector3(a.x, a.y, a.z), B = new THREE.Vector3(b.x, b.y, b.z); const d = B.clone().sub(A); const len = d.length(); if (len < 1e-4) return;
    const g = new THREE.CylinderGeometry(r, r, len, seg); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); this.add(mat, g);
  }
  /** Vertical quad w×h centred at (x,y,z) facing `facing` or yaw `ry`. Metric UVs optional. */
  quad(mat, w, h, { x = 0, y = 0, z = 0, facing = 'south', ry = null, metric = false, uvWorld = false } = {}) {
    const g = new THREE.PlaneGeometry(w, h); if (metric) scaleUV(g, w, h);
    const rot = ry != null ? ry : ({ south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }[facing] ?? 0);
    this.add(mat, g, { x, y, z, ry: rot, uvWorld });
  }
  /** Horizontal quad (w along x, d along z) facing up (or down). */
  flat(mat, w, d, { x = 0, y = 0, z = 0, down = false, metric = true, ry = 0 } = {}) {
    const g = new THREE.PlaneGeometry(w, d); if (metric) scaleUV(g, w, d); g.rotateX(down ? Math.PI / 2 : -Math.PI / 2); this.add(mat, g, { x, y, z, ry });
  }
  /** Horizontal rectangle given by bounds. */
  rect(mat, { xMin, xMax, zMin, zMax }, y, opts = {}) { this.flat(mat, xMax - xMin, zMax - zMin, { x: (xMin + xMax) / 2, y, z: (zMin + zMax) / 2, ...opts }); }
  /** Lathe: profile = [[r, y], ...] revolved about +y. */
  lathe(mat, profile, seg = 12, pose = {}) { this.add(mat, latheGeo(profile, seg), pose); }
  /** Emit meshes. Returns them. */
  flush({ castShadow = true, receiveShadow = true } = {}) {
    const out = [];
    for (const [chunk, byMat] of this.batches) for (const [mat, list] of byMat) {
      let g = null; try { g = mergeGeometries(list, false); } catch (e) { console.warn('[street] merge failed', this.name, chunk, e); }
      if (!g) continue; g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat); m.castShadow = castShadow; m.receiveShadow = receiveShadow; m.name = `${this.name}:${chunk}`; this.parent.add(m); out.push(m);
    }
    this.batches.clear(); return out;
  }
}

// ======================================================================= Instancer
export class Instancer {
  constructor(parent) { this.parent = parent; this.sets = []; }
  /** A set of instances of one geometry + material. Returns { add(x,y,z,{ry,rx,rz,s,sx,sy,sz}), addMatrix(m), mesh }. */
  set(geo, mat, { castShadow = true, receiveShadow = true, name = 'inst' } = {}) {
    const s = { geo, mat, mats: [], castShadow, receiveShadow, name, mesh: null,
      add(x, y, z, { ry = 0, rx = 0, rz = 0, s: sc = 1, sx, sy, sz } = {}) { const m = new THREE.Matrix4(); m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx ?? sc, sy ?? sc, sz ?? sc)); this.mats.push(m); return this; },
      addMatrix(m) { this.mats.push(m.clone()); return this; } };
    this.sets.push(s); return s;
  }
  flush() {
    const out = [];
    for (const s of this.sets) {
      if (!s.mats.length || s.mesh) continue;
      const im = new THREE.InstancedMesh(s.geo, s.mat, s.mats.length); s.mats.forEach((m, i) => im.setMatrixAt(i, m)); im.instanceMatrix.needsUpdate = true;
      im.castShadow = s.castShadow; im.receiveShadow = s.receiveShadow; im.name = s.name; im.computeBoundingSphere(); im.computeBoundingBox(); this.parent.add(im); s.mesh = im; out.push(im);
    }
    return out;
  }
}

// ======================================================================= geometry helpers
/** BoxGeometry with UVs in metres on every face (local coordinates). */
export function boxMetric(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d); metricUVsWorld(g); return g;
}
/** Recompute metric UVs from the geometry's CURRENT positions (call after translating for world-continuous tiling). */
export function metricUVsWorld(g) {
  const uv = g.attributes.uv, pos = g.attributes.position, nrm = g.attributes.normal; if (!uv || !nrm) return g;
  for (let i = 0; i < uv.count; i++) { const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)); const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); if (nx > 0.5) uv.setXY(i, z, y); else if (ny > 0.5) uv.setXY(i, x, z); else uv.setXY(i, x, y); }
  uv.needsUpdate = true; return g;
}
export function scaleUV(g, sx, sy) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); uv.needsUpdate = true; return g; }
export function latheGeo(profile, seg = 12) { const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), seg); return g; }

/** Segmental arch parameters for chord `span` and rise `rise`: { R, cy (centre y relative to the springing line), alpha (half angle) }. */
export function segmentalArch(span, rise) { const R = (span * span / 4 + rise * rise) / (2 * rise); return { R, cy: rise - R, alpha: Math.asin(Math.min(1, span / 2 / R)) }; }
/**
 * Spandrel wall above a segmental arch: a flat face `height` above the springing line, its underside following the arch,
 * extruded `depth` along +z (starting at z = 0). x centred on the span; y = 0 at the springing line.
 */
export function spandrelGeometry(span, rise, height, depth, { pierHalf = 0 } = {}) {
  const { R, cy, alpha } = segmentalArch(span, rise); const sh = new THREE.Shape(); const n = 28;
  const xl = -span / 2 - pierHalf, xr = span / 2 + pierHalf;
  sh.moveTo(xl, 0); sh.lineTo(-span / 2, 0);
  for (let i = 0; i <= n; i++) { const a = -alpha + (2 * alpha) * i / n; sh.lineTo(R * Math.sin(a), cy + R * Math.cos(a)); }
  sh.lineTo(xr, 0); sh.lineTo(xr, height); sh.lineTo(xl, height); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 4 }); return g;
}
/** The arch rib itself: an annular band `thick` deep under the intrados, extruded `depth`. */
export function archRibGeometry(span, rise, thick, depth) {
  const { R, cy, alpha } = segmentalArch(span, rise); const sh = new THREE.Shape(); const n = 28;
  for (let i = 0; i <= n; i++) { const a = -alpha + (2 * alpha) * i / n; const x = R * Math.sin(a), y = cy + R * Math.cos(a); if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y); }
  for (let i = n; i >= 0; i--) { const a = -alpha + (2 * alpha) * i / n; sh.lineTo((R - thick) * Math.sin(a), cy + (R - thick) * Math.cos(a)); }
  sh.closePath(); return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 4 });
}
/** A pointed (Gothic) arch opening shape for extrusion: width w, height to the springing hs, total height h. */
export function pointedArchShape(w, hs, h) {
  const sh = new THREE.Shape(); const r = w; // two-centred arch with centres at the opposite springing points
  sh.moveTo(-w / 2, 0); sh.lineTo(-w / 2, hs);
  const n = 12; for (let i = 0; i <= n; i++) { const a = Math.PI - (Math.PI / 3) * i / n; const x = w / 2 + r * Math.cos(a), y = hs + r * Math.sin(a); sh.lineTo(Math.max(-w / 2, x), Math.min(h, y)); }
  for (let i = n; i >= 0; i--) { const a = (Math.PI / 3) * i / n; const x = -w / 2 + r * Math.cos(a), y = hs + r * Math.sin(a); sh.lineTo(Math.min(w / 2, x), Math.min(h, y)); }
  sh.lineTo(w / 2, 0); sh.closePath(); return sh;
}

/** A gabled ridge roof: triangular cross-section (width w, rise) extruded `len` along z (or x if !alongZ), centred, base at y=0. */
export function ridgeRoofGeometry(w, len, rise, alongZ = true) {
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, rise); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2); if (!alongZ) g.rotateY(Math.PI / 2);
  scaleUV(g, 0.25, 0.25); return g;
}
/** A lumpy tree canopy (union of offset spheres), radius ~1 before scaling. */
export function canopyGeometry(seed = 1) {
  const rnd = mulberry(seed); const parts = [];
  for (let i = 0; i < 7; i++) { const r = 0.45 + rnd() * 0.35; const g = new THREE.SphereGeometry(r, 9, 7); g.translate((rnd() - 0.5) * 1.0, (rnd() - 0.5) * 0.8 + 0.1, (rnd() - 0.5) * 1.0); parts.push(g.toNonIndexed()); }
  let g = mergeGeometries(parts, false); const pos = g.attributes.position; // jitter for a leafy silhouette
  for (let i = 0; i < pos.count; i++) { const k = 0.96 + (rnd() - 0.5) * 0.12; pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k); }
  g = mergeVertices(g, 1e-3); g.computeVertexNormals(); return g;
}
/** A standing human figure (statue / pedestrian silhouette), ~1.8 m tall, feet at y=0. */
export function figureGeometry({ coat = true } = {}) {
  const parts = [];
  const body = new THREE.CapsuleGeometry(0.22, 0.75, 4, 10); body.translate(0, 1.15, 0); parts.push(body);
  const head = new THREE.SphereGeometry(0.13, 10, 8); head.translate(0, 1.66, 0); parts.push(head);
  for (const s of [-1, 1]) { const leg = new THREE.CylinderGeometry(0.09, 0.08, 0.85, 8); leg.translate(s * 0.12, 0.43, 0); parts.push(leg); const arm = new THREE.CylinderGeometry(0.06, 0.05, 0.7, 8); arm.rotateZ(s * 0.18); arm.translate(s * 0.32, 1.1, 0); parts.push(arm); }
  if (coat) { const c = new THREE.CylinderGeometry(0.28, 0.34, 0.6, 12); c.translate(0, 0.85, 0); parts.push(c); }
  const g = mergeGeometries(parts.map(p => p.toNonIndexed()), false); g.computeVertexNormals(); return g;
}
/** A pigeon, ~0.3 m long, standing, facing +z. */
export function pigeonGeometry() {
  const parts = [];
  const body = new THREE.SphereGeometry(0.09, 8, 6); body.scale(1, 0.8, 1.5); body.translate(0, 0.11, 0); parts.push(body);
  const head = new THREE.SphereGeometry(0.045, 7, 5); head.translate(0, 0.2, 0.12); parts.push(head);
  const tail = new THREE.BoxGeometry(0.07, 0.015, 0.12); tail.translate(0, 0.1, -0.16); parts.push(tail);
  const beak = new THREE.ConeGeometry(0.012, 0.03, 5); beak.rotateX(Math.PI / 2); beak.translate(0, 0.19, 0.17); parts.push(beak);
  for (const s of [-1, 1]) { const leg = new THREE.CylinderGeometry(0.006, 0.006, 0.06, 4); leg.translate(s * 0.025, 0.03, 0.02); parts.push(leg); }
  const g = mergeGeometries(parts.map(p => p.toNonIndexed()), false); g.computeVertexNormals(); return g;
}

/** Westminster 'Windsor' heritage lamp column (black, ~8 m) + lantern. Returns { post, lantern } geometries (feet at y=0). */
export function heritageLampGeometry(h = 8) {
  const post = latheGeo([[0.42, 0], [0.42, 0.12], [0.3, 0.14], [0.3, 0.9], [0.2, 1.0], [0.16, 1.6], [0.13, 1.7], [0.11, h - 1.4], [0.15, h - 1.3], [0.1, h - 1.2], [0.08, h - 0.5], [0.1, h - 0.4], [0.06, h]], 10);
  const lantern = mergeGeometries([
    new THREE.CylinderGeometry(0.3, 0.42, 0.9, 6).translate(0, h + 0.45, 0),          // glazed body (hexagonal)
    new THREE.ConeGeometry(0.5, 0.45, 6).translate(0, h + 1.12, 0),                    // roof
    new THREE.CylinderGeometry(0.06, 0.06, 0.25, 6).translate(0, h + 1.45, 0),
  ].map(g => g.toNonIndexed()), false);
  return { post, lantern };
}
/** Modern grey street-lighting column with an outreach arm and a flat LED luminaire. */
export function modernLampGeometry(h = 10, arm = 1.6) {
  const g = mergeGeometries([
    new THREE.CylinderGeometry(0.07, 0.11, h, 8).translate(0, h / 2, 0),
    new THREE.CylinderGeometry(0.05, 0.05, arm, 6).rotateZ(Math.PI / 2).translate(arm / 2, h - 0.05, 0),
    new THREE.BoxGeometry(0.7, 0.12, 0.28).translate(arm, h - 0.02, 0),
  ].map(g => g.toNonIndexed()), false); return g;
}
/** Black steel bollard (1 m, domed). */
export function bollardGeometry(h = 1.0, r = 0.11) { return latheGeo([[r * 1.3, 0], [r * 1.3, 0.05], [r, 0.08], [r, h - 0.08], [r * 0.7, h - 0.02], [0.001, h]], 10); }

export function mulberry(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ======================================================================= textures
/** Wrap a canvas as a tiling texture. */
function tex(T, c, { srgb = true } = {}) { const t = T.toTexture(c, { srgb }); t.anisotropy = 8; return t; }
/** A material whose map tiles every `w` × `h` metres on metric UVs (facade textures etc.). */
export function tiledMaterial(map, w, h, { roughness = 0.85, metalness = 0, color = 0xffffff, emissive = null, emissiveIntensity = 0.5, side = THREE.FrontSide, transparent = false, alphaTest = 0, normalMap = null } = {}) {
  map.repeat.set(1 / w, 1 / h); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ map, color, roughness, metalness, side, transparent, alphaTest });
  if (emissive) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = map; m.emissiveIntensity = emissiveIntensity; }
  if (normalMap) { normalMap.repeat.copy(map.repeat); m.normalMap = normalMap; m.normalScale = new THREE.Vector2(0.5, 0.5); }
  m.userData.metres = w; return m;
}
function stoneBase(ctx, w, h, stone, dark, seed, { courseH = 0.5, blockW = 1.0, ppm } = {}) {
  ctx.fillStyle = stone; ctx.fillRect(0, 0, w, h); const rnd = mulberry(seed);
  const ch = courseH * ppm, bw = blockW * ppm;
  for (let r = 0; r * ch < h; r++) { const off = (r % 2) * bw / 2; for (let k = -1; k * bw + off < w; k++) { const v = (rnd() - 0.5) * 0.09; ctx.fillStyle = `rgba(0,0,0,${Math.max(0, -v)})`; ctx.fillRect(k * bw + off, r * ch, bw, ch); ctx.fillStyle = `rgba(255,255,255,${Math.max(0, v) * 0.7})`; ctx.fillRect(k * bw + off, r * ch, bw, ch); } }
  ctx.strokeStyle = 'rgba(60,55,48,0.35)'; ctx.lineWidth = Math.max(1, ppm * 0.02);
  for (let r = 0; r * ch < h; r++) { ctx.beginPath(); ctx.moveTo(0, r * ch); ctx.lineTo(w, r * ch); ctx.stroke(); const off = (r % 2) * bw / 2; for (let k = 0; k * bw + off < w + bw; k++) { ctx.beginPath(); ctx.moveTo(k * bw + off, r * ch); ctx.lineTo(k * bw + off, (r + 1) * ch); ctx.stroke(); } }
  // soot grading towards the bottom + random staining
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,35,30,0.18)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(30,28,25,${rnd() * 0.08})`; const x = rnd() * w, y = rnd() * h; ctx.fillRect(x, y, ppm * (0.3 + rnd()), ppm * (1 + rnd() * 4)); }
  void dark;
}
function windowGlass(ctx, x, y, w, h, glass = '#1f262b') {
  const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, '#5a6b78'); g.addColorStop(0.35, glass); g.addColorStop(1, '#141a1e'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x + w * 0.1, y + h * 0.05, w * 0.25, h * 0.9);
}
function sashBars(ctx, x, y, w, h, cols = 2, rows = 3, color = '#e8e4da', lw = 2) { ctx.strokeStyle = color; ctx.lineWidth = lw; for (let c = 1; c < cols; c++) { ctx.beginPath(); ctx.moveTo(x + w * c / cols, y); ctx.lineTo(x + w * c / cols, y + h); ctx.stroke(); } for (let r = 1; r < rows; r++) { ctx.beginPath(); ctx.moveTo(x, y + h * r / rows); ctx.lineTo(x + w, y + h * r / rows); ctx.stroke(); } }

/**
 * Portland-stone classical facade: one bay wide, full height (ground floor + storeys + cornice). Returns { tex, w, h }.
 * style: 'baroque' (Edwardian: rusticated base, pedimented first-floor windows, deep cornice), 'victorian' (arched heads, string courses),
 *        'modern' (flat stone, ribbon windows), 'brick' (red brick with Portland bands and stone-dressed windows — Norman Shaw).
 */
export function facadeTexture(T, { bayW = 6, storeys = 5, storeyH = 4.4, ground = 6, stone = '#d9d2c1', dark = '#8c8577', glass = '#1f262b', style = 'baroque', seed = 5, ppm = 32, brick = '#8e3b2e', band = '#d8d4c6' } = {}) {
  const H = ground + storeys * storeyH + 1.2; const W = bayW; const w = Math.round(W * ppm), h = Math.round(H * ppm);
  const c = T.canvas(w, h); const ctx = c.getContext('2d'); const rnd = mulberry(seed);
  if (style === 'brick') {
    ctx.fillStyle = brick; ctx.fillRect(0, 0, w, h); const bh = 0.075 * ppm, bw = 0.225 * ppm;
    for (let r = 0; r * bh < h; r++) { const off = (r % 2) * bw / 2; for (let k = -1; k * bw + off < w; k++) { ctx.fillStyle = `rgba(${rnd() < 0.5 ? 0 : 255},${rnd() < 0.5 ? 40 : 200},${rnd() < 0.5 ? 20 : 160},${rnd() * 0.12})`; ctx.fillRect(k * bw + off, r * bh, bw - 1, bh - 1); } }
    ctx.strokeStyle = 'rgba(230,220,210,0.35)'; ctx.lineWidth = 1; for (let r = 0; r * bh < h; r++) { ctx.beginPath(); ctx.moveTo(0, r * bh); ctx.lineTo(w, r * bh); ctx.stroke(); }
    // Portland bands: every 4th course in the lower two storeys, string courses at each floor
    for (let y = h - ground * ppm; y < h; y += 0.6 * ppm) { ctx.fillStyle = band; ctx.fillRect(0, y, w, 0.22 * ppm); }
    for (let s = 0; s <= storeys; s++) { const y = h - (ground + s * storeyH) * ppm; ctx.fillStyle = band; ctx.fillRect(0, y - 0.25 * ppm, w, 0.35 * ppm); }
    // granite base
    ctx.fillStyle = '#6a6a66'; ctx.fillRect(0, h - 1.2 * ppm, w, 1.2 * ppm);
  } else {
    stoneBase(ctx, w, h, stone, dark, seed, { courseH: style === 'modern' ? 1.2 : 0.55, blockW: style === 'modern' ? 2.4 : 1.1, ppm });
    if (style !== 'modern') { // rusticated ground floor: deep horizontal channels
      const y0 = h - ground * ppm; ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(0, y0, w, ground * ppm);
      for (let y = y0 + 0.7 * ppm; y < h; y += 0.7 * ppm) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, y, w, ppm * 0.06); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, y + ppm * 0.06, w, ppm * 0.03); }
    }
  }
  // windows
  const winW = W * (style === 'modern' ? 0.7 : 0.42), winX = (W - winW) / 2 * ppm;
  for (let s = 0; s < storeys; s++) {
    const yTop = h - (ground + (s + 1) * storeyH) * ppm; const wh = storeyH * (s === 0 && style === 'baroque' ? 0.66 : 0.56) * ppm; const wy = yTop + (storeyH * ppm - wh) * 0.45;
    // surround / sill
    ctx.fillStyle = style === 'brick' ? band : 'rgba(255,255,255,0.18)'; ctx.fillRect(winX - 0.18 * ppm, wy - 0.18 * ppm, winW * ppm + 0.36 * ppm, wh + 0.3 * ppm);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(winX - 0.1 * ppm, wy + wh + 0.05 * ppm, winW * ppm + 0.2 * ppm, 0.12 * ppm);
    windowGlass(ctx, winX, wy, winW * ppm, wh, glass);
    if (style === 'modern') sashBars(ctx, winX, wy, winW * ppm, wh, 4, 1, '#3a3f44', 3); else sashBars(ctx, winX, wy, winW * ppm, wh, 2, 3, '#e8e4da', Math.max(1, ppm * 0.05));
    if (style === 'baroque' && s === 0) { // pediment over the piano nobile window
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.moveTo(winX - 0.4 * ppm, wy - 0.2 * ppm); ctx.lineTo(winX + winW * ppm / 2, wy - 1.1 * ppm); ctx.lineTo(winX + winW * ppm + 0.4 * ppm, wy - 0.2 * ppm); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.moveTo(winX - 0.45 * ppm, wy - 0.3 * ppm); ctx.lineTo(winX + winW * ppm / 2, wy - 1.2 * ppm); ctx.lineTo(winX + winW * ppm + 0.45 * ppm, wy - 0.3 * ppm); ctx.lineTo(winX + winW * ppm + 0.4 * ppm, wy - 0.2 * ppm); ctx.lineTo(winX + winW * ppm / 2, wy - 1.05 * ppm); ctx.lineTo(winX - 0.4 * ppm, wy - 0.2 * ppm); ctx.closePath(); ctx.fill();
    }
    if (style === 'victorian') { // round-headed windows on the first floor
      if (s === 0) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(winX + winW * ppm / 2, wy + 0.1 * ppm, winW * ppm / 2 + 0.15 * ppm, Math.PI, 0); ctx.fill(); windowGlass(ctx, winX, wy - 0.05 * ppm, winW * ppm, wh + 0.05 * ppm, glass); ctx.fillStyle = glass; ctx.beginPath(); ctx.arc(winX + winW * ppm / 2, wy, winW * ppm / 2, Math.PI, 0); ctx.fill(); }
    }
    // string course between floors
    if (style !== 'modern') { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(0, yTop + storeyH * ppm - 0.08 * ppm, w, 0.1 * ppm); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, yTop + storeyH * ppm - 0.2 * ppm, w, 0.12 * ppm); }
  }
  // ground floor: a tall window / doorway in every bay
  { const gw = W * 0.4 * ppm, gx = (w - gw) / 2, gy = h - (ground - 0.8) * ppm, gh = (ground - 1.6) * ppm; ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(gx - 0.2 * ppm, gy - 0.4 * ppm, gw + 0.4 * ppm, gh + 0.4 * ppm); windowGlass(ctx, gx, gy, gw, gh, glass); sashBars(ctx, gx, gy, gw, gh, 2, 4, '#dedad0', 2); if (style !== 'modern') { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(gx + gw / 2, gy, gw / 2 + 0.2 * ppm, Math.PI, 0); ctx.fill(); ctx.fillStyle = glass; ctx.beginPath(); ctx.arc(gx + gw / 2, gy, gw / 2, Math.PI, 0); ctx.fill(); } }
  // cornice + parapet at the top (1.2 m)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0.9 * ppm, w, 0.3 * ppm); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, 0.55 * ppm, w, 0.35 * ppm); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, 0, w, 0.5 * ppm);
  return { tex: tex(T, c), w: W, h: H };
}

/** Perpendicular-Gothic Palace bay (Barry/Pugin): buttress strip, blind-tracery panels, two tiers of mullioned windows, crenellated parapet. */
export function gothicBayTexture(T, { bayW = 6.1, H = 24, stone = '#d9cba8', recess = '#8f8672', glass = '#1c2226', seed = 11, ppm = 40, tiers = [[4.5, 9.5], [11.5, 16.5], [18.5, 21.2]] } = {}) {
  const w = Math.round(bayW * ppm), h = Math.round(H * ppm); const c = T.canvas(w, h); const ctx = c.getContext('2d');
  stoneBase(ctx, w, h, stone, recess, seed, { courseH: 0.42, blockW: 0.9, ppm });
  const Y = (m) => h - m * ppm;   // metres above ground → canvas y
  // buttress strip on the left edge (projecting: light face + shadow line) and blind panelling either side of the windows
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, 0, 0.8 * ppm, h); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0.8 * ppm, 0, 0.12 * ppm, h);
  const panel = (x, y0, y1, pw) => { ctx.fillStyle = recess; ctx.fillRect(x, Y(y1), pw, (y1 - y0) * ppm); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, Y(y1), pw, 0.08 * ppm); ctx.fillStyle = stone; ctx.beginPath(); ctx.arc(x + pw / 2, Y(y1) + 0.1 * ppm, pw / 2 * 0.9, 0, Math.PI); ctx.fill(); /* cusped head */ ctx.fillStyle = recess; ctx.beginPath(); ctx.moveTo(x + pw * 0.1, Y(y1) + pw * 0.55); ctx.lineTo(x + pw / 2, Y(y1) + 0.06 * ppm); ctx.lineTo(x + pw * 0.9, Y(y1) + pw * 0.55); ctx.closePath(); ctx.fill(); };
  const winX = 1.6 * ppm, winW = bayW * ppm - 2.4 * ppm;
  for (const [y0, y1] of tiers) {
    // blind tracery panels beside the window
    panel(1.0 * ppm, y0, y1, 0.45 * ppm); panel(bayW * ppm - 1.25 * ppm, y0, y1, 0.45 * ppm);
    // window: four-centred arch head, 3 lights with a transom
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(winX - 0.15 * ppm, Y(y1) - 0.15 * ppm, winW + 0.3 * ppm, (y1 - y0) * ppm + 0.3 * ppm);
    windowGlass(ctx, winX, Y(y1), winW, (y1 - y0) * ppm, glass);
    ctx.fillStyle = stone; ctx.beginPath(); ctx.moveTo(winX, Y(y1)); ctx.lineTo(winX, Y(y1) + 0.5 * ppm); ctx.quadraticCurveTo(winX + winW * 0.15, Y(y1) + 0.05 * ppm, winX + winW / 2, Y(y1) - 0.1 * ppm); ctx.quadraticCurveTo(winX + winW * 0.85, Y(y1) + 0.05 * ppm, winX + winW, Y(y1) + 0.5 * ppm); ctx.lineTo(winX + winW, Y(y1)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = stone; for (let k = 1; k < 3; k++) ctx.fillRect(winX + winW * k / 3 - 0.07 * ppm, Y(y1), 0.14 * ppm, (y1 - y0) * ppm); ctx.fillRect(winX, Y(y1) + (y1 - y0) * ppm * 0.5 - 0.06 * ppm, winW, 0.12 * ppm);
    // sill / string course
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(0.9 * ppm, Y(y0) + 0.05 * ppm, w - 0.9 * ppm, 0.22 * ppm); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0.9 * ppm, Y(y0) + 0.27 * ppm, w - 0.9 * ppm, 0.1 * ppm);
  }
  // crenellated parapet with a pierced band (top 1.8 m) and the cornice
  ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fillRect(0, Y(H - 1.9), w, 0.18 * ppm);
  const merlonW = 0.6 * ppm; for (let x = 0.9 * ppm; x < w; x += merlonW * 2) { ctx.fillStyle = 'rgba(10,20,30,0.85)'; ctx.fillRect(x + merlonW, 0, merlonW, 0.7 * ppm); }
  for (let x = 1.0 * ppm; x < w - 0.3 * ppm; x += 0.5 * ppm) { ctx.fillStyle = recess; ctx.fillRect(x, Y(H - 1.7), 0.28 * ppm, 0.7 * ppm); }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, Y(4.0), w, 0.15 * ppm); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0.9 * ppm, Y(3.85), w, 3.85 * ppm);  // plinth storey
  return { tex: tex(T, c), w: bayW, h: H };
}

/** Elizabeth Tower shaft face between the corner buttresses: three stages of tall blind lancets with cusped heads, string courses. w × h metres. */
export function towerFaceTexture(T, { w = 7.8, h = 50, stone = '#d9cba8', recess = '#8f8672', seed = 21, ppm = 28 } = {}) {
  const pw = Math.round(w * ppm), ph = Math.round(h * ppm); const c = T.canvas(pw, ph); const ctx = c.getContext('2d');
  stoneBase(ctx, pw, ph, stone, recess, seed, { courseH: 0.45, blockW: 0.9, ppm });
  const Y = (m) => ph - m * ppm;
  const lancet = (x, y0, y1, lw) => { ctx.fillStyle = recess; ctx.fillRect(x, Y(y1) + lw * 0.5, lw, (y1 - y0) * ppm - lw * 0.5); ctx.beginPath(); ctx.arc(x + lw / 2, Y(y1) + lw * 0.5, lw / 2, Math.PI, 0); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, Y(y1) + lw * 0.5, lw * 0.18, (y1 - y0) * ppm - lw * 0.5); ctx.fillStyle = stone; ctx.fillRect(x + lw * 0.47, Y(y1) + lw * 0.9, lw * 0.06, (y1 - y0) * ppm * 0.6); };
  const stages = [[2.5, 12], [14.5, 25], [27.5, 38.5], [41, 49]];
  for (const [y0, y1] of stages) {
    const n = 3, lw = 1.25 * ppm, gap = (pw - n * lw) / (n + 1);
    for (let i = 0; i < n; i++) lancet(gap + i * (lw + gap), y0, y1, lw);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(0, Y(y1 + 1.2), pw, 0.3 * ppm); ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fillRect(0, Y(y1 + 0.9), pw, 0.12 * ppm);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(0, Y(y0), pw, 0.12 * ppm); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, Y(y0 + 0.35), pw, 0.25 * ppm);
  }
  return { tex: tex(T, c), w, h };
}

/** Portcullis House bay window unit: dark tinted glazing behind bronze mullions with a bronze spandrel panel. w × h metres. */
export function phWindowTexture(T, { w = 2.0, h = 4.4, ppm = 60 } = {}) {
  const pw = Math.round(w * ppm), ph = Math.round(h * ppm); const c = T.canvas(pw, ph); const ctx = c.getContext('2d');
  ctx.fillStyle = hex(COL.phBronze); ctx.fillRect(0, 0, pw, ph);
  const g = ctx.createLinearGradient(0, 0, 0, ph); g.addColorStop(0, '#6d8394'); g.addColorStop(0.45, '#35434d'); g.addColorStop(1, '#1b2126'); ctx.fillStyle = g; ctx.fillRect(0.12 * ppm, 0.12 * ppm, pw - 0.24 * ppm, ph - 1.1 * ppm);
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0.3 * ppm, 0.2 * ppm, 0.5 * ppm, ph - 1.3 * ppm);
  ctx.fillStyle = hex(COL.phBronze); ctx.fillRect(pw / 2 - 0.06 * ppm, 0, 0.12 * ppm, ph); ctx.fillRect(0, ph * 0.42, pw, 0.1 * ppm);
  ctx.fillStyle = '#6e5f4d'; ctx.fillRect(0.1 * ppm, ph - 0.98 * ppm, pw - 0.2 * ppm, 0.8 * ppm); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(0.1 * ppm, ph - 0.98 * ppm, pw - 0.2 * ppm, 0.06 * ppm);
  return { tex: tex(T, c), w, h };
}

/** Pierced Gothic bridge parapet panel: trefoil/quatrefoil cut-outs (alpha). One tile = `w` × `h` m. */
export function parapetTexture(T, { w = 3.6, h = 1.2, color = '#3e6b4a', ppm = 80 } = {}) {
  const pw = Math.round(w * ppm), ph = Math.round(h * ppm); const c = T.canvas(pw, ph); const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, pw, ph); ctx.fillStyle = color; ctx.fillRect(0, 0, pw, ph);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, 0, pw, 0.12 * ppm); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, ph - 0.1 * ppm, pw, 0.1 * ppm);
  ctx.globalCompositeOperation = 'destination-out';
  const n = 4, cell = pw / n;
  for (let i = 0; i < n; i++) { const cx = (i + 0.5) * cell, cy = ph * 0.52, r = cell * 0.17; // quatrefoil: 4 lobes + centre
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.arc(cx + dx * r * 0.9, cy + dy * r * 0.9, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.05, 0, Math.PI * 2); ctx.fill();
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * cell * 0.5 - s * cell * 0.06, cy - ph * 0.2); ctx.lineTo(cx + s * cell * 0.5 - s * cell * 0.06, cy + ph * 0.2); ctx.lineTo(cx + s * cell * 0.5 - s * cell * 0.14, cy); ctx.closePath(); ctx.fill(); }  // small triangular piercings between the quatrefoils
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = color; for (let i = 0; i <= n; i++) ctx.fillRect(i * cell - 0.05 * ppm, 0, 0.1 * ppm, ph);
  const t = tex(T, c); return { tex: t, w, h };
}

/** Big Ben dial: 6.9 m opal glass face with black Roman numerals, minute ring, Prussian-blue frame and gilt ornament. */
export function clockDialTexture(T, { size = 1024 } = {}) {
  const c = T.canvas(size, size); const ctx = c.getContext('2d'); const cx = size / 2, cy = size / 2;
  ctx.clearRect(0, 0, size, size);
  // outer gilt + blue frame ring
  ctx.fillStyle = hex(COL.gilt); ctx.beginPath(); ctx.arc(cx, cy, size * 0.495, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hex(COL.prussian); ctx.beginPath(); ctx.arc(cx, cy, size * 0.47, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hex(COL.gilt); ctx.beginPath(); ctx.arc(cx, cy, size * 0.425, 0, Math.PI * 2); ctx.fill();
  // opal dial (324 pieces of glass — a faint lattice)
  const g = ctx.createRadialGradient(cx, cy, size * 0.05, cx, cy, size * 0.42); g.addColorStop(0, '#fbfaf3'); g.addColorStop(1, '#ebe9df'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, size * 0.41, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 1.5; for (let r = size * 0.08; r < size * 0.41; r += size * 0.055) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
  for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * size * 0.08, cy + Math.sin(a) * size * 0.08); ctx.lineTo(cx + Math.cos(a) * size * 0.41, cy + Math.sin(a) * size * 0.41); ctx.stroke(); }
  // minute ring + numerals
  ctx.fillStyle = '#111'; for (let i = 0; i < 60; i++) { const a = i * Math.PI / 30 - Math.PI / 2; const long = i % 5 === 0; ctx.save(); ctx.translate(cx + Math.cos(a) * size * 0.385, cy + Math.sin(a) * size * 0.385); ctx.rotate(a + Math.PI / 2); ctx.fillRect(-(long ? 4 : 2), 0, long ? 8 : 4, long ? size * 0.03 : size * 0.016); ctx.restore(); }
  ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, size * 0.385, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, size * 0.345, 0, Math.PI * 2); ctx.stroke();
  const num = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  ctx.fillStyle = '#111'; ctx.font = `bold ${size * 0.075}px 'Times New Roman', 'DejaVu Serif', Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 - Math.PI / 2; ctx.save(); ctx.translate(cx + Math.cos(a) * size * 0.3, cy + Math.sin(a) * size * 0.3); ctx.rotate(a + Math.PI / 2); ctx.fillText(num[i], 0, 0); ctx.restore(); }
  // gilt ornament in the corner spandrels is on the surround; centre boss
  ctx.fillStyle = hex(COL.prussian); ctx.beginPath(); ctx.arc(cx, cy, size * 0.03, 0, Math.PI * 2); ctx.fill();
  const t = T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping }); return t;
}

/** Square surround of a dial: Anston stone with gilt ornament and the four shields; the dial is drawn separately. `size` px for `m` metres. */
export function dialSurroundTexture(T, { size = 1024, m = 11 } = {}) {
  const c = T.canvas(size, size); const ctx = c.getContext('2d'); const ppm = size / m;
  stoneBase(ctx, size, size, hex(COL.anston), hex(COL.anstonRecess), 31, { courseH: 0.45, blockW: 0.9, ppm });
  // gilt diaper ornament in the spandrels around the circle (cut-out drawn as gold lattice)
  ctx.strokeStyle = 'rgba(201,162,39,0.85)'; ctx.lineWidth = Math.max(2, ppm * 0.05);
  const cx = size / 2, cy = size / 2, R = size * 0.34;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, size, size); ctx.arc(cx, cy, R, 0, Math.PI * 2, true); ctx.clip();
  for (let k = -size; k < size * 2; k += ppm * 0.7) { ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + size, size); ctx.stroke(); ctx.beginPath(); ctx.moveTo(k, size); ctx.lineTo(k + size, 0); ctx.stroke(); }
  ctx.restore();
  // shields (St George's cross) in the four corners
  for (const [sx, sy] of [[0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]]) { const x = sx * size, y = sy * size, s = size * 0.06; ctx.fillStyle = '#f4f2ec'; ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y - s); ctx.lineTo(x + s, y + s * 0.4); ctx.quadraticCurveTo(x, y + s * 1.5, x - s, y + s * 0.4); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#c8102e'; ctx.fillRect(x - s * 0.22, y - s, s * 0.44, s * 2.2); ctx.fillRect(x - s, y - s * 0.3, s * 2, s * 0.44); }
  // gilt ring hugging the dial
  ctx.strokeStyle = hex(COL.gilt); ctx.lineWidth = ppm * 0.18; ctx.beginPath(); ctx.arc(cx, cy, R + ppm * 0.1, 0, Math.PI * 2); ctx.stroke();
  const t = T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping }); return t;
}

/** Union flag (approximation) for the Victoria Tower. */
export function unionFlagTexture(T, { w = 512, h = 256 } = {}) {
  const c = T.canvas(w, h); const ctx = c.getContext('2d');
  ctx.fillStyle = '#012169'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = h * 0.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.moveTo(w, 0); ctx.lineTo(0, h); ctx.stroke();
  ctx.strokeStyle = '#c8102e'; ctx.lineWidth = h * 0.07; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.moveTo(w, 0); ctx.lineTo(0, h); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(w / 2 - h * 0.165, 0, h * 0.33, h); ctx.fillRect(0, h / 2 - h * 0.165, w, h * 0.33);
  ctx.fillStyle = '#c8102e'; ctx.fillRect(w / 2 - h * 0.1, 0, h * 0.2, h); ctx.fillRect(0, h / 2 - h * 0.1, w, h * 0.2);
  return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
}
/** JLE vent grate: dark steel with louvred slots. 1 tile = 1 m. */
export function grateTexture(T, { size = 256 } = {}) {
  const c = T.canvas(size, size); const ctx = c.getContext('2d'); ctx.fillStyle = hex(COL.grate); ctx.fillRect(0, 0, size, size);
  for (let y = 4; y < size; y += 12) { ctx.fillStyle = '#141516'; ctx.fillRect(4, y, size - 8, 6); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(4, y - 1, size - 8, 1); }
  return { map: tex(T, c), metres: 1 };
}
/** Grass (lawns). 1 tile = 4 m. */
export function grassTexture(T, { size = 512, seed = 61 } = {}) {
  const c = T.canvas(size, size); const ctx = c.getContext('2d'); const n = T.noiseField(size, { octaves: 5, seed, baseFreq: 6 }); const img = ctx.createImageData(size, size); const d = img.data; const rnd = mulberry(seed);
  for (let i = 0; i < size * size; i++) { const v = n[i] + (rnd() - 0.5) * 0.25; const r = 60 + v * 50, g = 105 + v * 60, b = 35 + v * 30; d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0); return { map: tex(T, c), metres: 4 };
}
/** Tileable water normal map from layered noise (for the Thames). */
export function waterNormalTexture(T, { size = 512, seed = 71 } = {}) {
  const a = T.noiseField(size, { octaves: 4, seed, baseFreq: 6, gain: 0.55 }); const b = T.noiseField(size, { octaves: 3, seed: seed + 5, baseFreq: 14, gain: 0.5 });
  const hgt = new Float32Array(size * size); for (let i = 0; i < hgt.length; i++) hgt[i] = a[i] * 0.7 + b[i] * 0.3;
  const t = T.toTexture(T.normalMapFromHeight(hgt, size, 2.2), { srgb: false }); return t;
}
/** Black-and-white striped Belisha pole texture. */
export function stripeTexture(T, { size = 64, stripes = 8, a = '#111111', b = '#f2f2f2' } = {}) {
  const c = T.canvas(size, size * 4); const ctx = c.getContext('2d'); const sh = (size * 4) / stripes; for (let i = 0; i < stripes; i++) { ctx.fillStyle = i % 2 ? a : b; ctx.fillRect(0, i * sh, size, sh); } return tex(T, c);
}
/** Route number / destination blind for a bus (amber LED on black). */
export function blindTexture(T, text, { w = 512, h = 128 } = {}) {
  return T.sign({ width: w, height: h, bg: '#0a0a0a', lines: [{ text, x: w / 2, y: h * 0.72, size: h * 0.62, align: 'center', color: '#ffb300' }] });
}

// ======================================================================= materials
/** Every shared street material. Cached on ctx so all sub-modules share the same instances. */
export function makeMaterials(ctx) {
  if (ctx._streetMats) return ctx._streetMats;
  const { M, T } = ctx; const paint = (c, r = 0.6, m = 0.1) => M.paint(c, { roughness: r, metalness: m });
  const grass = grassTexture(T); const grassMat = new THREE.MeshStandardMaterial({ map: grass.map, roughness: 1 }); grassMat.map.repeat.set(1 / grass.metres, 1 / grass.metres); grassMat.userData.metres = grass.metres;
  const grate = grateTexture(T); const grateMat = new THREE.MeshStandardMaterial({ map: grate.map, roughness: 0.6, metalness: 0.7 }); grateMat.map.repeat.set(1, 1);
  const mats = {
    paving: M.paving(), tarmac: M.tarmac(),
    kerb: M.granite({ base: COL.kerb, slab: 0.9, seed: 5 }), granite: M.granite({ base: COL.graniteGrey, slab: 1.5, seed: 8 }), graniteDark: M.granite({ base: 0x4f5054, slab: 2.0, seed: 9 }),
    anston: M.portland({ color: COL.anston, courseH: 0.45, blockW: 0.9, weathering: 0.5 }), anstonDark: M.portland({ color: 0xbdb094, courseH: 0.45, blockW: 0.9, weathering: 0.8 }),
    portland: M.portland(), phStone: M.portland({ color: COL.phSand, courseH: 0.6, blockW: 1.2, weathering: 0.3 }), phGranite: M.granite({ base: COL.phGranite, slab: 1.2, seed: 12 }),
    bronze: M.bronze(COL.phBronze), bronzeRoof: M.bronze(0x4d4640), chimney: paint(COL.phChimney, 0.7, 0.4), glassDark: paint(COL.phGlass, 0.12, 0.75), glass: M.glass(), glassGreen: M.glass({ color: 0xcfe0e6, opacity: 0.35 }),
    ironGreen: paint(COL.bridgeGreenFlat, 0.55, 0.45), ironGreenDark: paint(COL.bridgeGreenShadow, 0.6, 0.4), ironBlack: paint(COL.dolphinBlack, 0.55, 0.5), steelGrey: paint(0x6e7276, 0.5, 0.6), barrierGrey: paint(0x4d5054, 0.7, 0.3),
    gilt: paint(COL.gilt, 0.28, 0.9), prussian: paint(COL.prussian, 0.4, 0.3), spireIron: paint(0x4b514c, 0.6, 0.5),
    white: paint(0xf2f2ee, 0.6, 0), whiteLine: paint(0xf4f4f0, 0.5, 0), yellowLine: paint(0xe9c53a, 0.55, 0), redRoute: paint(0xc9302c, 0.6, 0), busLaneRed: paint(0x6b3b34, 0.98, 0), greenCycle: paint(0x3f8a5a, 0.9, 0),
    red: paint(COL.busRed, 0.4, 0.15), busBlack: paint(0x151515, 0.35, 0.3), cabBlack: paint(COL.cab, 0.3, 0.4), tyre: paint(0x141414, 0.9, 0), chrome: M.stainless(), signGrey: paint(0x8a8d90, 0.5, 0.3),
    bronzeStatue: paint(COL.boadiceaBronze, 0.55, 0.6), coade: M.portland({ color: COL.coade, courseH: 0.3, blockW: 0.6, weathering: 0.3 }), copper: paint(COL.copper, 0.7, 0.3), eyeWhite: paint(COL.eyeWhite, 0.4, 0.3), eyeGlass: paint(0x9fb6c4, 0.15, 0.6),
    grass: grassMat, leaf: paint(0x3b5a2c, 0.95, 0), leafLight: paint(0x527539, 0.95, 0), bark: paint(COL.bark, 0.95, 0), grate: grateMat, concrete: M.precast(), mud: paint(0x5c5546, 0.95, 0),
    lumWarm: M.luminaire(0xfff0d0, 1.6), lumWhite: M.luminaire(0xffffff, 1.2), lumDial: M.luminaire(0xfff6e0, 0.35), lumOrange: M.luminaire(0xffa020, 2.5), lumRed: M.luminaire(0xff2010, 2.5), lumGreen: M.luminaire(0x20ff60, 2.5), lumAmber: M.luminaire(0xffb300, 2.5), lumOff: paint(0x2a2a2a, 0.5, 0.2),
    ledGlobe: M.luminaire(COL.globe, 0.5), dark: paint(0x1e1f21, 0.8, 0.1), blue: paint(0x0019a8, 0.6, 0), tfLBlue: paint(0x113b92, 0.6, 0), plastic: paint(0xdcdcd6, 0.6, 0), kioskRed: paint(0xb0201c, 0.5, 0.1),
  };
  // facade materials (metric UVs, tile = one bay × full height)
  const fx = (spec, opts = {}) => { const f = facadeTexture(T, spec); return tiledMaterial(f.tex, f.w, f.h, { roughness: 0.9, ...opts }); };
  mats.facadeBaroque = fx({ style: 'baroque', storeys: 5, storeyH: 4.6, ground: 6.5, stone: hex(COL.treasuryStone), seed: 5 });
  mats.facadeCountyHall = fx({ style: 'baroque', storeys: 5, storeyH: 5.0, ground: 8, stone: hex(COL.countyHall), seed: 6 });
  mats.facadeVictorian = fx({ style: 'victorian', storeys: 4, storeyH: 4.4, ground: 5.5, stone: '#d2c9b6', seed: 7, bayW: 5.4 });
  mats.facadeVictorianDark = fx({ style: 'victorian', storeys: 4, storeyH: 4.0, ground: 5.0, stone: '#b9a98f', seed: 8, bayW: 5.0 });
  mats.facadeModern = fx({ style: 'modern', storeys: 8, storeyH: 3.6, ground: 4.5, stone: '#cfd0cc', seed: 9, bayW: 7.2 });
  mats.facadeModernDark = fx({ style: 'modern', storeys: 10, storeyH: 3.4, ground: 4.0, stone: '#9a9c9a', glass: '#2b3a44', seed: 10, bayW: 6.0 });
  mats.facadeBrick = fx({ style: 'brick', storeys: 5, storeyH: 4.6, ground: 5.5, seed: 11, bayW: 5.0 });
  const gb = gothicBayTexture(T); mats.palace = tiledMaterial(gb.tex, gb.w, gb.h, { roughness: 0.9 });
  const tf = towerFaceTexture(T); mats.towerFace = tiledMaterial(tf.tex, tf.w, tf.h, { roughness: 0.9 });
  const pw = phWindowTexture(T); mats.phWindow = tiledMaterial(pw.tex, pw.w, pw.h, { roughness: 0.25, metalness: 0.5 });
  const pp = parapetTexture(T); mats.parapet = tiledMaterial(pp.tex, pp.w, pp.h, { roughness: 0.55, metalness: 0.45, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 });
  mats.stripe = new THREE.MeshStandardMaterial({ map: stripeTexture(T), roughness: 0.5 });
  ctx._streetMats = mats; return mats;
}

/** A sign plane material (emissive so it reads in shadow). */
export function signMat(ctx, texture, { emissive = 0.5, doubleSided = false, transparent = false } = {}) { return ctx.M.signMaterial(texture, { emissive, side: doubleSided ? THREE.DoubleSide : THREE.FrontSide, transparent }); }

/** Blue TfL panel with stacked white lines (and optional roundel at the left). */
export function bluePanel(T, lines, { width = 1024, height = 256, roundel = false, bg = '#113b92', sizes = null } = {}) {
  const rx = roundel ? height * 0.42 : 0; const ls = lines.map((t, i) => ({ text: t, x: roundel ? height * 0.95 : width * 0.05, y: height * (lines.length === 1 ? 0.65 : 0.42 + i * 0.36), size: sizes ? sizes[i] : height * (lines.length === 1 ? 0.5 : 0.3), weight: i === 0 ? 'bold' : 'normal' }));
  return T.sign({ width, height, bg, lines: ls, roundels: roundel ? [{ x: height * 0.5, y: height / 2, r: rx, text: '' }] : [] });
}
/** White enamel street nameplate: 'BRIDGE STREET' with a red 'CITY OF WESTMINSTER' header and 'SW1'. */
export function nameplate(T, name, { width = 1024, height = 300 } = {}) {
  return T.sign({ width, height, bg: '#f6f4ee', border: { color: '#111', width: 8 }, lines: [{ text: 'CITY OF WESTMINSTER', x: width / 2, y: height * 0.27, size: height * 0.18, align: 'center', color: '#c8102e' }, { text: name, x: width / 2, y: height * 0.7, size: height * 0.36, align: 'center', color: '#111' }, { text: 'SW1', x: width * 0.94, y: height * 0.93, size: height * 0.14, align: 'right', color: '#111' }] });
}

// ======================================================================= extra textures (furniture, vehicles, sky)
/** A layer of broken stratocumulus: white with alpha, tileable. */
export function cloudTexture(T, { size = 1024, seed = 91, cover = 0.55 } = {}) {
  const a = T.noiseField(size, { octaves: 6, seed, baseFreq: 3, gain: 0.55 }); const b = T.noiseField(size, { octaves: 4, seed: seed + 3, baseFreq: 9, gain: 0.5 });
  const c = T.canvas(size, size); const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size); const d = img.data;
  for (let i = 0; i < size * size; i++) { const v = a[i] * 0.75 + b[i] * 0.25; const t = Math.max(0, Math.min(1, (v - (1 - cover) * 0.75) / 0.28)); const al = t * t * (3 - 2 * t); const shade = 235 + (b[i] - 0.5) * 30; d[i * 4] = shade; d[i * 4 + 1] = shade; d[i * 4 + 2] = shade + 6; d[i * 4 + 3] = al * 255; }
  ctx.putImageData(img, 0, 0); const t = T.toTexture(c); return t;
}
/** K6 telephone box side: red frame, three columns of small panes, black 'TELEPHONE' band. 0.92 × 2.4 m. */
export function k6Texture(T, { ppm = 160 } = {}) {
  const w = Math.round(0.92 * ppm), h = Math.round(2.4 * ppm); const c = T.canvas(w, h); const ctx = c.getContext('2d');
  ctx.fillStyle = '#b3181c'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#111'; ctx.fillRect(0.06 * ppm, 0.12 * ppm, w - 0.12 * ppm, 0.28 * ppm); ctx.fillStyle = '#f4f4f0'; ctx.font = `bold ${0.115 * ppm}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TELEPHONE', w / 2, 0.26 * ppm);
  const cols = 3, rows = 6, x0 = 0.09 * ppm, y0 = 0.5 * ppm, gw = (w - 2 * x0) / cols, gh = (h - y0 - 0.35 * ppm) / rows;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { const x = x0 + k * gw, y = y0 + r * gh; const g = ctx.createLinearGradient(x, y, x, y + gh); g.addColorStop(0, '#6c7c86'); g.addColorStop(1, '#2d383f'); ctx.fillStyle = g; ctx.fillRect(x + 0.02 * ppm, y + 0.02 * ppm, gw - 0.04 * ppm, gh - 0.04 * ppm); }
  ctx.fillStyle = '#8f1216'; ctx.fillRect(0, h - 0.3 * ppm, w, 0.3 * ppm);
  return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
}
/** TfL bus stop flag: white, red roundel, stop letter, name and routes. 0.45 × 0.6 m. */
export function busFlagTexture(T, { letter = 'H', name = 'Westminster Station', sub = 'Westminster Pier', routes = ['11'], towards = 'towards Waterloo' } = {}) {
  const w = 384, h = 512; const c = T.canvas(w, h); const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
  T.drawRoundel(ctx, 110, 110, 88, { text: '', ringColor: '#dc241f', barColor: '#dc241f' });
  ctx.fillStyle = '#111'; ctx.font = `bold 120px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(letter, 300, 110);
  ctx.fillStyle = '#dc241f'; ctx.fillRect(0, 210, w, 8);
  ctx.fillStyle = '#111'; ctx.textAlign = 'left'; ctx.font = `bold 44px ${FONT}`; ctx.fillText(name, 20, 262); ctx.font = `normal 36px ${FONT}`; ctx.fillText(sub, 20, 312);
  ctx.fillStyle = '#dc241f'; ctx.fillRect(0, 350, w, 6);
  ctx.fillStyle = '#111'; ctx.font = `bold 64px ${FONT}`; ctx.fillText(routes.join('  '), 20, 410); ctx.font = `normal 28px ${FONT}`; ctx.fillText(towards, 20, 470);
  return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
}
/** Legible London wayfinding monolith face: dark blue with the yellow 'Walk' band and a stylised map. 0.5 × 2.2 m. */
export function legibleLondonTexture(T, { here = 'Westminster', seed = 3 } = {}) {
  const w = 256, h = 1024; const c = T.canvas(w, h); const ctx = c.getContext('2d'); const rnd = mulberry(seed);
  ctx.fillStyle = '#0d1b3d'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffd200'; ctx.fillRect(0, 0, w, 70); ctx.fillStyle = '#0d1b3d'; ctx.font = `bold 40px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Walk', 14, 36);
  ctx.fillStyle = '#ffffff'; ctx.font = `bold 34px ${FONT}`; ctx.fillText(here, 14, 110); ctx.font = `normal 22px ${FONT}`; ctx.fillStyle = '#c9d2e6'; ctx.fillText('5 minute walk', 14, 146);
  // map: cream ground, streets, blue river, landmarks
  ctx.fillStyle = '#e9e4d6'; ctx.fillRect(14, 180, w - 28, 520); ctx.fillStyle = '#9ec2d9'; ctx.fillRect(170, 180, 72, 520);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 9; for (let i = 0; i < 6; i++) { ctx.beginPath(); const y = 200 + rnd() * 480; ctx.moveTo(14, y); ctx.lineTo(170, y + (rnd() - 0.5) * 60); ctx.stroke(); } for (let i = 0; i < 3; i++) { ctx.beginPath(); const x = 30 + rnd() * 130; ctx.moveTo(x, 180); ctx.lineTo(x + (rnd() - 0.5) * 40, 700); ctx.stroke(); }
  ctx.fillStyle = '#b9ad8f'; for (let i = 0; i < 14; i++) ctx.fillRect(20 + rnd() * 130, 190 + rnd() * 480, 10 + rnd() * 22, 8 + rnd() * 18);
  ctx.fillStyle = '#dc241f'; ctx.beginPath(); ctx.arc(96, 440, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#0d1b3d'; ctx.font = `bold 18px ${FONT}`; ctx.fillText('You are here', 60, 470);
  ctx.fillStyle = '#ffffff'; ctx.font = `normal 20px ${FONT}`; ['Houses of Parliament', 'Westminster Abbey', 'Whitehall', 'Westminster Pier', 'London Eye'].forEach((t, i) => ctx.fillText('• ' + t, 14, 740 + i * 34));
  T.drawRoundel(ctx, 40, 960, 26, { text: '' }); ctx.fillStyle = '#ffffff'; ctx.font = `bold 22px ${FONT}`; ctx.fillText('Westminster', 76, 960);
  return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
}
/** 'City of Westminster · Westminster Station · Public Subway (· Toilets)' cast-iron arch sign: black with cream lettering. w × h metres. */
export function subwayArchTexture(T, { toilets = true, w = 4.2, h = 0.7, ppm = 220 } = {}) {
  const pw = Math.round(w * ppm), ph = Math.round(h * ppm); const c = T.canvas(pw, ph); const ctx = c.getContext('2d');
  ctx.fillStyle = '#17171a'; ctx.fillRect(0, 0, pw, ph); ctx.strokeStyle = '#c9a227'; ctx.lineWidth = ppm * 0.02; ctx.strokeRect(ppm * 0.03, ppm * 0.03, pw - ppm * 0.06, ph - ppm * 0.06);
  ctx.fillStyle = '#e9dfc0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `normal ${0.14 * ppm}px ${FONT}`; ctx.fillText('CITY OF WESTMINSTER', pw / 2, 0.17 * ppm);
  ctx.font = `bold ${0.24 * ppm}px ${FONT}`; ctx.fillText('WESTMINSTER STATION', pw / 2, 0.38 * ppm);
  ctx.font = `normal ${0.14 * ppm}px ${FONT}`; ctx.fillText(toilets ? 'PUBLIC SUBWAY  ·  TOILETS' : 'PUBLIC SUBWAY', pw / 2, 0.57 * ppm);
  return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
}
/** Traffic-signal head face (three lenses) — the lit state is done with separate emissive discs; this is the black housing with hoods. */
export function signalHousingTexture(T) {
  const w = 128, h = 384; const c = T.canvas(w, h); const ctx = c.getContext('2d'); ctx.fillStyle = '#1a1a1c'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 3; i++) { ctx.fillStyle = '#0a0a0b'; ctx.beginPath(); ctx.arc(64, 64 + i * 128, 44, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(10, 14 + i * 128, 108, 8); }
  return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
}

// ---- vehicles: bus (New Routemaster-ish), black cab, generic car. Every texture is drawn for one face of a BoxGeometry body.
function glassGrad(ctx, x, y, w, h, top = '#5c6f7c', bottom = '#1a2126') { const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, top); g.addColorStop(0.5, '#2f3c45'); g.addColorStop(1, bottom); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x + w * 0.08, y + h * 0.1, w * 0.18, h * 0.8); }
/** Bus side. `nearside` = doors, front at the LEFT of the texture; offside: front at the RIGHT. 11.2 × 4.4 m. */
export function busSideTexture(T, { nearside = true, route = '11', ppm = 92, red = '#c8231c' } = {}) {
  const L = 11.2, H = 4.4; const w = Math.round(L * ppm), h = Math.round(H * ppm); const c = T.canvas(w, h); const ctx = c.getContext('2d');
  const X = (m) => nearside ? m * ppm : w - m * ppm;   // metres from the FRONT → px
  const rect = (m0, m1, y0, y1, fill) => { const a = X(m0), b = X(m1); ctx.fillStyle = fill; ctx.fillRect(Math.min(a, b), h - y1 * ppm, Math.abs(b - a), (y1 - y0) * ppm); };
  const glass = (m0, m1, y0, y1) => { const a = X(m0), b = X(m1); glassGrad(ctx, Math.min(a, b), h - y1 * ppm, Math.abs(b - a), (y1 - y0) * ppm); };
  ctx.fillStyle = red; ctx.fillRect(0, 0, w, h);
  rect(0, L, 0, 0.45, '#2a2a2a');                                                   // skirt shadow
  rect(0, L, 4.1, 4.4, '#a81a15');                                                  // roof edge
  // lower deck windows (the NBfL sweeping glazing), doors on the nearside
  const lowY0 = 1.35, lowY1 = 2.55, upY0 = 2.85, upY1 = 3.95;
  if (nearside) { glass(0.55, 2.35, lowY0, upY1 - 0.05); rect(0.55, 2.35, 2.55, 2.85, red); rect(2.4, 3.6, 0.45, 2.7, '#1d1d1f'); glass(2.55, 3.45, 1.0, 2.55); rect(3.0, 3.03, 0.5, 2.7, '#3a3a3c'); }   // front door
  else glass(0.55, 2.35, lowY0, upY1 - 0.05);
  const segs = nearside ? [[3.75, 5.6], [5.75, 7.2], [8.6, 10.5]] : [[2.5, 4.4], [4.55, 6.4], [6.55, 8.4], [8.55, 10.5]];
  for (const [a, b] of segs) glass(a, b, lowY0, lowY1);
  if (nearside) { rect(7.3, 8.5, 0.45, 2.7, '#1d1d1f'); glass(7.45, 8.35, 1.0, 2.55); rect(7.9, 7.93, 0.5, 2.7, '#3a3a3c'); }   // middle door
  for (const [a, b] of [[0.55, 2.35], [2.5, 4.4], [4.55, 6.4], [6.55, 8.4], [8.55, 10.5]]) glass(a, b, upY0, upY1);
  // the NBfL's diagonal rear-stair glazing band
  { const a = X(8.6), b = X(10.8); ctx.save(); ctx.beginPath(); ctx.moveTo(a, h - upY0 * ppm); ctx.lineTo(b, h - lowY0 * ppm); ctx.lineTo(b, h - upY1 * ppm); ctx.lineTo(a, h - upY1 * ppm); ctx.closePath(); ctx.clip(); glassGrad(ctx, Math.min(a, b), h - upY1 * ppm, Math.abs(b - a), (upY1 - lowY0) * ppm); ctx.restore(); }
  // wheel arches (black) — front axle 2.9 m from the front, rear axle 8.4 m
  for (const m of [2.9, 8.4]) { ctx.fillStyle = '#141414'; ctx.beginPath(); ctx.arc(X(m), h - 0.5 * ppm, 0.62 * ppm, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#0c0c0c'; ctx.fillRect(X(m) - 0.62 * ppm, h - 0.5 * ppm, 1.24 * ppm, 0.5 * ppm); }
  // roundel, fleet name, route number box, 'Buses' branding
  T.drawRoundel(ctx, X(nearside ? 5.0 : 6.4), h - 0.95 * ppm, 0.28 * ppm, { text: '', ringColor: '#ffffff', barColor: '#ffffff' });
  ctx.fillStyle = '#ffffff'; ctx.font = `bold ${0.3 * ppm}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(route, X(nearside ? 6.2 : 5.2), h - 0.95 * ppm);
  ctx.fillStyle = '#ffd200'; ctx.fillRect(X(0.1), h - 3.0 * ppm, nearside ? 0.14 * ppm : -0.14 * ppm, 0.6 * ppm);   // yellow grab-pole glimpse at the front
  return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
}
/** Bus front (2.5 × 4.4): two-deck windscreen, blind box, headlights, number plate. */
export function busFrontTexture(T, { ppm = 200, red = '#c8231c' } = {}) {
  const W = 2.5, H = 4.4; const w = Math.round(W * ppm), h = Math.round(H * ppm); const c = T.canvas(w, h); const ctx = c.getContext('2d');
  ctx.fillStyle = red; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#2a2a2a'; ctx.fillRect(0, h - 0.45 * ppm, w, 0.45 * ppm);
  glassGrad(ctx, 0.12 * ppm, h - 2.55 * ppm, w - 0.24 * ppm, 1.35 * ppm);                       // lower windscreen
  glassGrad(ctx, 0.12 * ppm, h - 4.05 * ppm, w - 0.24 * ppm, 0.95 * ppm, '#4d5d69', '#1a2126'); // upper windscreen
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0.15 * ppm, h - 3.05 * ppm, w - 0.3 * ppm, 0.5 * ppm);   // blind box (the amber blind plane sits in front of it)
  for (const x of [0.42, W - 0.42]) { ctx.fillStyle = '#f0f0e8'; ctx.beginPath(); ctx.ellipse(x * ppm, h - 0.85 * ppm, 0.17 * ppm, 0.11 * ppm, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffb000'; ctx.beginPath(); ctx.arc(x * ppm + (x < 1 ? -0.16 : 0.16) * ppm, h - 0.85 * ppm, 0.05 * ppm, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#f4f4f0'; ctx.fillRect(w / 2 - 0.26 * ppm, h - 0.72 * ppm, 0.52 * ppm, 0.12 * ppm); ctx.fillStyle = '#111'; ctx.font = `bold ${0.09 * ppm}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('LTZ 1011', w / 2, h - 0.66 * ppm);
  ctx.fillStyle = '#111'; ctx.fillRect(0.2 * ppm, h - 1.18 * ppm, w - 0.4 * ppm, 0.06 * ppm);
  return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
}
/** Bus rear (2.5 × 4.4): rear glazing, lights, route number, the NBfL rounded rear look. */
export function busRearTexture(T, { ppm = 200, red = '#c8231c', route = '11' } = {}) {
  const W = 2.5, H = 4.4; const w = Math.round(W * ppm), h = Math.round(H * ppm); const c = T.canvas(w, h); const ctx = c.getContext('2d');
  ctx.fillStyle = red; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#2a2a2a'; ctx.fillRect(0, h - 0.45 * ppm, w, 0.45 * ppm);
  glassGrad(ctx, 0.3 * ppm, h - 4.0 * ppm, w - 0.6 * ppm, 1.1 * ppm); glassGrad(ctx, 0.5 * ppm, h - 2.5 * ppm, w - 1.0 * ppm, 1.0 * ppm);
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0.35 * ppm, h - 3.05 * ppm, w - 0.7 * ppm, 0.42 * ppm); ctx.fillStyle = '#ffb300'; ctx.font = `bold ${0.32 * ppm}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(route, w / 2, h - 2.84 * ppm);
  for (const x of [0.3, W - 0.3]) { ctx.fillStyle = '#d0141a'; ctx.fillRect(x * ppm - 0.1 * ppm, h - 1.5 * ppm, 0.2 * ppm, 0.7 * ppm); ctx.fillStyle = '#ffb000'; ctx.fillRect(x * ppm - 0.1 * ppm, h - 1.5 * ppm, 0.2 * ppm, 0.2 * ppm); ctx.fillStyle = '#f0f0f0'; ctx.fillRect(x * ppm - 0.1 * ppm, h - 1.0 * ppm, 0.2 * ppm, 0.15 * ppm); }
  ctx.fillStyle = '#ffd200'; ctx.fillRect(w / 2 - 0.26 * ppm, h - 0.75 * ppm, 0.52 * ppm, 0.12 * ppm);
  return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
}
/** Black cab side (4.85 × 1.85, body from y = 0.35): tall glazed cabin, 'TAXI' door lettering, wheel arches. */
export function cabSideTexture(T, { nearside = true, ppm = 200, paint = '#0e0e10' } = {}) {
  const L = 4.85, H = 1.85; const w = Math.round(L * ppm), h = Math.round(H * ppm); const c = T.canvas(w, h); const ctx = c.getContext('2d');
  const X = (m) => nearside ? m * ppm : w - m * ppm;
  ctx.fillStyle = paint; ctx.fillRect(0, 0, w, h);
  const glass = (m0, m1, y0, y1) => { const a = X(m0), b = X(m1); glassGrad(ctx, Math.min(a, b), h - y1 * ppm, Math.abs(b - a), (y1 - y0) * ppm, '#4c5a64', '#161b1f'); };
  glass(0.95, 1.7, 1.05, 1.7); glass(1.8, 2.8, 1.05, 1.72); glass(2.9, 3.9, 1.05, 1.72); glass(4.0, 4.7, 1.05, 1.62);
  ctx.fillStyle = '#1a1a1c'; for (const m of [1.75, 2.85, 3.95]) ctx.fillRect(X(m) - 0.02 * ppm, h - 1.72 * ppm, 0.04 * ppm, 0.7 * ppm);
  ctx.fillStyle = '#c9c9c4'; ctx.fillRect(X(1.85), h - 0.62 * ppm, nearside ? 0.15 * ppm : -0.15 * ppm, 0.04 * ppm);   // door handle
  ctx.fillStyle = '#e8e8e2'; ctx.font = `bold ${0.16 * ppm}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TAXI', X(3.4), h - 0.55 * ppm);
  for (const m of [0.85, 3.95]) { ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.arc(X(m), h - 0.35 * ppm, 0.45 * ppm, Math.PI, 0); ctx.fill(); ctx.fillRect(X(m) - 0.45 * ppm, h - 0.35 * ppm, 0.9 * ppm, 0.35 * ppm); }
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, h - 1.0 * ppm, w, 0.02 * ppm);
  return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
}
/** Cab front / rear (1.85 wide × 1.85): rear = true draws the back. */
export function cabEndTexture(T, { rear = false, ppm = 200, paint = '#0e0e10', plate = 'LX19 CAB' } = {}) {
  const W = 1.85, H = 1.85; const w = Math.round(W * ppm), h = Math.round(H * ppm); const c = T.canvas(w, h); const ctx = c.getContext('2d');
  ctx.fillStyle = paint; ctx.fillRect(0, 0, w, h);
  if (!rear) { glassGrad(ctx, 0.12 * ppm, h - 1.7 * ppm, w - 0.24 * ppm, 0.62 * ppm, '#55636d', '#1b2126'); ctx.fillStyle = '#26262a'; ctx.fillRect(0.2 * ppm, h - 0.95 * ppm, w - 0.4 * ppm, 0.5 * ppm); ctx.fillStyle = '#5a5a5e'; ctx.fillRect(0.22 * ppm, h - 0.75 * ppm, w - 0.44 * ppm, 0.04 * ppm); ctx.fillRect(0.22 * ppm, h - 0.65 * ppm, w - 0.44 * ppm, 0.04 * ppm);
    for (const x of [0.3, W - 0.3]) { ctx.fillStyle = '#eeeee6'; ctx.beginPath(); ctx.arc(x * ppm, h - 0.85 * ppm, 0.13 * ppm, 0, Math.PI * 2); ctx.fill(); } }
  else { glassGrad(ctx, 0.2 * ppm, h - 1.68 * ppm, w - 0.4 * ppm, 0.55 * ppm, '#4c5a64', '#161b1f'); for (const x of [0.22, W - 0.22]) { ctx.fillStyle = '#c8121a'; ctx.fillRect(x * ppm - 0.08 * ppm, h - 1.05 * ppm, 0.16 * ppm, 0.45 * ppm); ctx.fillStyle = '#ffb000'; ctx.fillRect(x * ppm - 0.08 * ppm, h - 0.75 * ppm, 0.16 * ppm, 0.12 * ppm); } }
  ctx.fillStyle = rear ? '#ffd200' : '#f4f4f0'; ctx.fillRect(w / 2 - 0.26 * ppm, h - 0.5 * ppm, 0.52 * ppm, 0.11 * ppm); ctx.fillStyle = '#111'; ctx.font = `bold ${0.08 * ppm}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(plate, w / 2, h - 0.445 * ppm);
  return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
}
/** Generic hatchback side / ends in a given paint. */
export function carSideTexture(T, { paint = '#c8c9cc', ppm = 200, nearside = true } = {}) {
  const L = 4.3, H = 1.1; const w = Math.round(L * ppm), h = Math.round(H * ppm); const c = T.canvas(w, h); const ctx = c.getContext('2d');
  const X = (m) => nearside ? m * ppm : w - m * ppm;
  ctx.fillStyle = paint; ctx.fillRect(0, 0, w, h); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, h - 0.2 * ppm, w, 0.2 * ppm);
  ctx.fillStyle = '#3a3a3e'; for (const m of [1.85, 2.95]) ctx.fillRect(X(m) - 0.015 * ppm, 0, 0.03 * ppm, h);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(X(1.95), h - 0.62 * ppm, nearside ? 0.14 * ppm : -0.14 * ppm, 0.035 * ppm); ctx.fillRect(X(3.05), h - 0.62 * ppm, nearside ? 0.14 * ppm : -0.14 * ppm, 0.035 * ppm);
  for (const m of [0.75, 3.5]) { ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.arc(X(m), h - 0.28 * ppm, 0.4 * ppm, Math.PI, 0); ctx.fill(); ctx.fillRect(X(m) - 0.4 * ppm, h - 0.28 * ppm, 0.8 * ppm, 0.28 * ppm); }
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, h - 0.95 * ppm, w, 0.02 * ppm);
  return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
}
export function carEndTexture(T, { paint = '#c8c9cc', rear = false, ppm = 200 } = {}) {
  const W = 1.8, H = 1.1; const w = Math.round(W * ppm), h = Math.round(H * ppm); const c = T.canvas(w, h); const ctx = c.getContext('2d');
  ctx.fillStyle = paint; ctx.fillRect(0, 0, w, h); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, h - 0.2 * ppm, w, 0.2 * ppm);
  if (!rear) { ctx.fillStyle = '#1f1f22'; ctx.fillRect(0.25 * ppm, h - 0.75 * ppm, w - 0.5 * ppm, 0.3 * ppm); for (const x of [0.32, W - 0.32]) { ctx.fillStyle = '#eeeee6'; ctx.fillRect(x * ppm - 0.18 * ppm, h - 0.85 * ppm, 0.36 * ppm, 0.16 * ppm); } }
  else for (const x of [0.28, W - 0.28]) { ctx.fillStyle = '#c8121a'; ctx.fillRect(x * ppm - 0.16 * ppm, h - 0.85 * ppm, 0.32 * ppm, 0.2 * ppm); }
  ctx.fillStyle = rear ? '#ffd200' : '#f4f4f0'; ctx.fillRect(w / 2 - 0.26 * ppm, h - 0.45 * ppm, 0.52 * ppm, 0.11 * ppm);
  return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
}
/** Glazed cabin band for a car (top box): dark glass all round with pillars. */
export function carCabinTexture(T, { ppm = 200, w = 2.2, h = 0.55 } = {}) {
  const pw = Math.round(w * ppm), ph = Math.round(h * ppm); const c = T.canvas(pw, ph); const ctx = c.getContext('2d');
  glassGrad(ctx, 0, 0, pw, ph, '#4a5862', '#171c20'); ctx.fillStyle = '#1e1e21'; ctx.fillRect(0, 0, 0.04 * ppm, ph); ctx.fillRect(pw - 0.04 * ppm, 0, 0.04 * ppm, ph); ctx.fillRect(pw * 0.48, 0, 0.04 * ppm, ph);
  return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
}
