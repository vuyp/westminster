// ---------------------------------------------------------------------------
// trainParts.js — geometry + material helpers shared by the rolling-stock models.
//
//  * profile strips: bodyside panels / glass / door leaves that follow the car's
//    cross-section (tube stock tumbles home above the waist, S stock is slab-sided)
//  * Collector: gathers many small geometries per material key and merges them
//    into ONE mesh per material (draw calls ≈ materials, not parts)
//  * decal atlas: every sticker / roundel / number on a train on ONE canvas
//  * shared materials per stock (cached, so every train reuses them)
//  * wheel + door-leaf geometries (instanced per train)
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from '../core/textures.js';
import { M } from '../core/materials.js';

// ---------- profiles ----------

/** Half-width of a body profile at height y (piecewise-linear through [x,y] points sorted by y). */
export function xAt(profile, y) {
  if (y <= profile[0][1]) return profile[0][0];
  for (let i = 1; i < profile.length; i++) {
    const [x1, y1] = profile[i]; if (y <= y1) { const [x0, y0] = profile[i - 1]; const t = (y - y0) / Math.max(1e-6, y1 - y0); return x0 + (x1 - x0) * t; }
  }
  return profile[profile.length - 1][0];
}

/** Top of a profile (roof centre height). */
export function topOf(profile) { return profile[profile.length - 1][1]; }

/**
 * A surface strip following `profile` between heights y0..y1 and along z0..z1, on the +x (side=1) or -x (side=-1) side,
 * moved `inset` metres towards the centreline. Normals point outward (away from the centreline) unless `flip`.
 * UVs are metric (u = z, v = y). Indexed geometry with position/normal/uv, so it merges with box/cylinder geometries.
 */
export function profileStrip(profile, y0, y1, z0, z1, { inset = 0, side = 1, steps = 0, flip = false } = {}) {
  if (!steps) steps = Math.max(1, Math.min(10, Math.round((y1 - y0) / 0.12)));
  const pos = [], uv = [], idx = [];
  for (let k = 0; k <= steps; k++) {
    const y = y0 + (y1 - y0) * k / steps; const x = side * Math.max(0, xAt(profile, y) - inset);
    pos.push(x, y, z0, x, y, z1); uv.push(z0, y, z1, y);
  }
  for (let k = 0; k < steps; k++) {
    const a = k * 2, b = a + 1, c = a + 2, d = a + 3;
    if ((side > 0) !== flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A narrow ribbon across the thickness of a panel: at z, from insetA to insetB following the profile (closes the edges of leaves/pillars). Normal faces ±z by `dir`. */
export function profileRibbon(profile, y0, y1, z, insetA, insetB, { side = 1, dir = 1, steps = 0 } = {}) {
  if (!steps) steps = Math.max(1, Math.min(10, Math.round((y1 - y0) / 0.12)));
  const pos = [], uv = [], idx = [];
  for (let k = 0; k <= steps; k++) {
    const y = y0 + (y1 - y0) * k / steps; const xa = side * (xAt(profile, y) - insetA), xb = side * (xAt(profile, y) - insetB);
    pos.push(xa, y, z, xb, y, z); uv.push(0, y, insetB - insetA, y);
  }
  for (let k = 0; k < steps; k++) { const a = k * 2, b = a + 1, c = a + 2, d = a + 3; if ((dir > 0) === (side > 0)) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A tube (grab rail / pole) that follows the profile at lateral inset, between y0 and y1 at longitudinal z. */
export function profileTube(profile, y0, y1, z, inset, radius, { side = 1, segments = 6, radial = 8 } = {}) {
  const pts = []; for (let k = 0; k <= segments; k++) { const y = y0 + (y1 - y0) * k / segments; pts.push(new THREE.Vector3(side * (xAt(profile, y) - inset), y, z)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2), segments * 2, radius, radial, false);
}

/**
 * A flat end cap in the plane z = const, filling the profile outline from yMin to the roof (both sides).
 * `dir` = +1 → normal +z, -1 → normal -z. `holes` = [{x0,x1,y0,y1}] rectangular cut-outs (windows, gangway).
 */
export function profileCap(profile, z, yMin, { dir = 1, holes = [], inset = 0 } = {}) {
  const shape = new THREE.Shape();
  const pts = profile.filter(p => p[1] >= yMin - 1e-6); if (pts.length === 0 || pts[0][1] > yMin) pts.unshift([xAt(profile, yMin), yMin]);
  const right = pts.map(([x, y]) => [Math.max(0, x - inset), y]);
  shape.moveTo(right[0][0], right[0][1]);
  for (let i = 1; i < right.length; i++) shape.lineTo(right[i][0], right[i][1]);
  for (let i = right.length - 1; i >= 0; i--) shape.lineTo(-right[i][0], right[i][1]);
  shape.closePath();
  for (const h of holes) { const p = new THREE.Path(); p.moveTo(h.x0, h.y0); p.lineTo(h.x1, h.y0); p.lineTo(h.x1, h.y1); p.lineTo(h.x0, h.y1); p.closePath(); shape.holes.push(p); }
  const g = new THREE.ShapeGeometry(shape, 6);
  if (dir < 0) g.rotateY(Math.PI);
  g.translate(0, 0, z);
  return g;
}

/**
 * Concertina bellows around a rounded opening (walk-through gangway): a loft of rounded-rectangle rings whose
 * size alternates so the surface pleats. Origin at the centre of the opening; extends z0 → z1.
 */
export function bellowsGeometry(w, h, yBase, z0, z1, { pleats = 5, depth = 0.09, radius = 0.35 } = {}) {
  const ring = []; const n = 28;
  // rounded rectangle path around (0, yBase + h/2), width w, height h
  const rw = w / 2, rh = h / 2; const cy = yBase + rh; const r = Math.min(radius, rw, rh);
  for (let i = 0; i < n; i++) {
    const t = i / n * Math.PI * 2; const cx = Math.cos(t), sy = Math.sin(t);
    const x = Math.sign(cx) * (rw - r) + r * cx, y = cy + Math.sign(sy) * (rh - r) + r * sy; ring.push([x, y]);
  }
  const pos = [], uv = [], idx = []; const rows = pleats * 2;
  for (let k = 0; k <= rows; k++) {
    const z = z0 + (z1 - z0) * k / rows; const s = (k % 2) ? 1 + depth : 1;
    for (let i = 0; i < n; i++) { const [x, y] = ring[i]; pos.push(x * s, cy + (y - cy) * s, z); uv.push(i / n * 4, k / rows); }
  }
  for (let k = 0; k < rows; k++) for (let i = 0; i < n; i++) { const a = k * n + i, b = k * n + (i + 1) % n, c = a + n, d = b + n; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ---------- small geometry helpers (all indexed, position/normal/uv) ----------

export function boxAt(w, h, d, x, y, z, { metric = false, ry = 0, rz = 0, rx = 0 } = {}) {
  const g = metric ? T.boxGeometryMetric(w, h, d) : new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry);
  g.translate(x, y, z); return g;
}
export function cylAt(r, len, x, y, z, { axis = 'y', seg = 10, r2 = null } = {}) {
  const g = new THREE.CylinderGeometry(r, r2 ?? r, len, seg);
  if (axis === 'x') g.rotateZ(Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(x, y, z); return g;
}
/** Cylinder between two points. */
export function tubeBetween(a, b, r, seg = 8) {
  const d = new THREE.Vector3().subVectors(b, a); const len = d.length(); const g = new THREE.CylinderGeometry(r, r, len, seg);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  g.applyQuaternion(q); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); return g;
}
export function sphereAt(r, x, y, z, seg = 8) { const g = new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2)); g.translate(x, y, z); return g; }
/** A plane (w × h) facing +z, rotated by (rx, ry, rz) [applied in that order] then translated. */
export function planeAt(w, h, x, y, z, { rx = 0, ry = 0, rz = 0, uvRect = null } = {}) {
  const g = new THREE.PlaneGeometry(w, h);
  if (uvRect) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uvRect.u0 + (uvRect.u1 - uvRect.u0) * uv.getX(i), uvRect.v0 + (uvRect.v1 - uvRect.v0) * uv.getY(i)); }
  if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry);
  g.translate(x, y, z); return g;
}

/** Gathers geometries per material key and merges them into one geometry per key. */
export class Collector {
  constructor() { this.map = new Map(); }
  add(key, geo) { if (!geo) return; let l = this.map.get(key); if (!l) { l = []; this.map.set(key, l); } l.push(geo); return geo; }
  /** → { key: mergedGeometry } */
  merged() {
    const out = {};
    for (const [k, list] of this.map) {
      const ok = list.filter(g => g && g.attributes.position && g.attributes.normal && g.attributes.uv && g.index);
      if (ok.length !== list.length) console.warn('[trainParts] dropped', list.length - ok.length, 'non-mergeable geometries for', k);
      if (!ok.length) continue;
      const m = ok.length === 1 ? ok[0] : mergeGeometries(ok, false);
      if (!m) { console.warn('[trainParts] merge failed for', k); continue; }
      m.computeBoundingSphere(); out[k] = m;
    }
    return out;
  }
}

// ---------- decal atlas ----------

const atlasCache = new Map();
const FONT = T.SIGN_FONT;

/**
 * One 1024² transparent canvas with every sticker/decal a train carries. Returns { texture, rect(name) → {u0,v0,u1,v1, aspect} }.
 * Cells are 256 px; some entries span two cells.
 */
export function decalAtlas(spec, { unitNumber = spec.unitNumbers[0], lineName = spec.line === 'jubilee' ? 'Jubilee line' : 'District line', lineColor = spec.line === 'jubilee' ? '#a0a5a9' : '#00782a' } = {}) {
  const key = spec.code + ':' + unitNumber + ':' + lineName;
  if (atlasCache.has(key)) return atlasCache.get(key);
  const S = 1024, C = 256; const c = T.canvas(S, S); const ctx = c.getContext('2d');
  const cells = {}; const rects = {};
  const cell = (name, col, row, wc = 1, hc = 1) => { cells[name] = { x: col * C, y: row * C, w: wc * C, h: hc * C }; rects[name] = { u0: col * C / S + 0.004, u1: (col + wc) * C / S - 0.004, v0: 1 - (row + hc) * C / S + 0.004, v1: 1 - row * C / S - 0.004, aspect: wc / hc }; return cells[name]; };
  const text = (str, x, y, size, { color = '#000', weight = 'bold', align = 'center', font = FONT, maxW = null } = {}) => {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; let fs = size; ctx.font = `${weight} ${fs}px ${font}`;
    if (maxW) while (ctx.measureText(str).width > maxW && fs > 6) { fs -= 1; ctx.font = `${weight} ${fs}px ${font}`; }
    ctx.fillText(str, x, y);
  };
  const rrect = (x, y, w, h, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };

  // roundel (transparent background)
  { const r = cell('roundel', 0, 0); T.drawRoundel(ctx, r.x + C / 2, r.y + C / 2, C * 0.46, { text: 'UNDERGROUND' }); }
  // line name label with the line-colour bar (exterior, beside the roundel)
  { const r = cell('lineName', 1, 0, 2, 1); ctx.fillStyle = lineColor; ctx.fillRect(r.x + 16, r.y + 150, r.w - 32, 22); text(lineName, r.x + r.w / 2, r.y + 92, 84, { color: '#1c1c1c', maxW: r.w - 40 }); }
  // unit number (exterior, under the cab window and on the car ends)
  { const r = cell('unitNo', 3, 0); text(unitNumber, r.x + C / 2, r.y + C / 2, 92, { color: '#1c1c1c', weight: '600' }); }
  // Priority seat sticker (blue, white text + figures)
  { const r = cell('priority', 0, 1); rrect(r.x + 8, r.y + 8, C - 16, C - 16, 14, '#113b92'); text('Priority', r.x + C / 2, r.y + 52, 42, { color: '#fff' }); text('seat', r.x + C / 2, r.y + 94, 42, { color: '#fff' });
    text('Please offer this seat to', r.x + C / 2, r.y + 150, 19, { color: '#fff', weight: 'normal' }); text('someone who needs it more', r.x + C / 2, r.y + 172, 19, { color: '#fff', weight: 'normal' });
    ctx.fillStyle = '#fff'; [[64, 'stick'], [108, 'cane'], [152, 'preg'], [196, 'child']].forEach(([px]) => { ctx.beginPath(); ctx.arc(r.x + px, r.y + 204, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(r.x + px - 4, r.y + 212, 8, 24); }); }
  // door sticker: "Please stand clear of the doors" — white, black text, red header (interior of every doorway)
  { const r = cell('standClear', 1, 1, 2, 1); rrect(r.x + 8, r.y + 24, r.w - 16, r.h - 48, 10, '#f4f4f4'); ctx.fillStyle = '#dc241f'; ctx.fillRect(r.x + 8, r.y + 24, r.w - 16, 44);
    text('Obstructing the doors', r.x + r.w / 2, r.y + 46, 28, { color: '#fff' }); text('can be dangerous', r.x + r.w / 2, r.y + 100, 40, { color: '#111' }); text('Please stand clear of the doors', r.x + r.w / 2, r.y + 150, 34, { color: '#111', maxW: r.w - 40 }); text('Doors close automatically', r.x + r.w / 2, r.y + 200, 24, { color: '#444', weight: 'normal' }); }
  // Emergency alarm (red)
  { const r = cell('alarm', 3, 1); rrect(r.x + 8, r.y + 8, C - 16, C - 16, 10, '#c8102e'); text('EMERGENCY', r.x + C / 2, r.y + 50, 34, { color: '#fff' }); text('ALARM', r.x + C / 2, r.y + 90, 34, { color: '#fff' });
    ctx.fillStyle = '#ffd300'; ctx.fillRect(r.x + 100, r.y + 120, 56, 90); ctx.fillStyle = '#111'; ctx.fillRect(r.x + 116, r.y + 128, 24, 40); text('Pull handle down', r.x + C / 2, r.y + 228, 18, { color: '#fff', weight: 'normal' }); }
  // cab door: DO NOT OBSTRUCT
  { const r = cell('doNotObstruct', 0, 2); rrect(r.x + 8, r.y + 40, C - 16, C - 80, 8, '#f4f4f4'); text('DRIVER', r.x + C / 2, r.y + 84, 30, { color: '#111' }); text('DO NOT', r.x + C / 2, r.y + 124, 34, { color: '#c8102e' }); text('OBSTRUCT', r.x + C / 2, r.y + 164, 34, { color: '#c8102e' }); }
  // wheelchair space (blue square, white pictogram)
  { const r = cell('wheelchair', 1, 2); rrect(r.x + 8, r.y + 8, C - 16, C - 16, 14, '#113b92'); ctx.strokeStyle = '#fff'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(r.x + 128, r.y + 150, 44, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r.x + 118, r.y + 62, 16, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(r.x + 108, r.y + 78, 18, 60); ctx.fillRect(r.x + 108, r.y + 122, 60, 14); ctx.fillRect(r.x + 158, r.y + 122, 14, 44); text('Wheelchair space', r.x + C / 2, r.y + 228, 20, { color: '#fff', weight: 'normal' }); }
  // No smoking
  { const r = cell('noSmoking', 2, 2); rrect(r.x + 8, r.y + 8, C - 16, C - 16, 14, '#f4f4f4'); ctx.strokeStyle = '#dc241f'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(r.x + 128, r.y + 110, 66, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#333'; ctx.fillRect(r.x + 82, r.y + 104, 92, 14); ctx.strokeStyle = '#dc241f'; ctx.beginPath(); ctx.moveTo(r.x + 80, r.y + 62); ctx.lineTo(r.x + 176, r.y + 158); ctx.stroke(); text('No smoking', r.x + C / 2, r.y + 212, 26, { color: '#111' }); }
  // CCTV
  { const r = cell('cctv', 3, 2); rrect(r.x + 8, r.y + 60, C - 16, C - 120, 8, '#ffd300'); text('CCTV', r.x + C / 2, r.y + 108, 44, { color: '#111' }); text('in operation on this train', r.x + C / 2, r.y + 156, 20, { color: '#111', weight: 'normal' }); }
  // MIND THE GAP (door threshold)
  { const r = cell('mindGap', 0, 3, 2, 1); ctx.fillStyle = '#ffd300'; ctx.fillRect(r.x, r.y + 96, r.w, 64); text('MIND THE GAP', r.x + r.w / 2, r.y + 128, 46, { color: '#111' }); }
  // class label / small unit code (interior end)
  { const r = cell('carNo', 2, 3); text(unitNumber, r.x + C / 2, r.y + 100, 60, { color: '#222' }); text(spec.code === 'S7' ? 'S7 Stock' : '1996 Tube Stock', r.x + C / 2, r.y + 160, 24, { color: '#444', weight: 'normal' }); }
  // door open/close indicator lamp label + "Push" for end door
  { const r = cell('endDoor', 3, 3); rrect(r.x + 8, r.y + 60, C - 16, C - 120, 8, '#f4f4f4'); text('Emergency use only', r.x + C / 2, r.y + 100, 22, { color: '#c8102e' }); text('Do not lean on the door', r.x + C / 2, r.y + 140, 20, { color: '#111', weight: 'normal' }); }

  const texture = T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping }); texture.anisotropy = 8;
  const out = { texture, rect: n => rects[n], rects };
  atlasCache.set(key, out); return out;
}

// ---------- materials ----------

const matCache = new Map();
function lit(color, e, { roughness = 0.75, metalness = 0 } = {}) { return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: e, roughness, metalness }); }
function litMap(tex, metres, e, { roughness = 0.8, metalness = 0 } = {}) {
  const map = tex.clone(); map.repeat.set(1 / metres, 1 / metres); map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ color: 0xffffff, map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: e, roughness, metalness });
}

/** All materials for a stock; cached so every train of that stock shares them (fewer state changes). */
export function trainMaterials(spec) {
  const key = spec.code;
  if (matCache.has(key)) return matCache.get(key);
  const L = spec.livery; const is96 = spec.code === '1996';
  const floorTex = T.granite({ base: 0x3d3f43, light: 0x6d6f73, dark: 0x1e1f21, joints: false, seed: 23 });
  const mats = {
    body: is96 ? M.aluminium() : M.paint(L.body, { roughness: 0.42, metalness: 0.25 }),
    blue: M.paint(L.skirt, { roughness: 0.5, metalness: 0.2 }),
    red: M.paint(L.doors, { roughness: 0.4, metalness: 0.2 }),
    roof: M.paint(L.roof, { roughness: 0.7, metalness: 0.35 }),
    glass: M.glass({ tint: L.windowTint, opacity: 0.62, roughness: 0.06 }),
    clearGlass: M.glass({ color: 0xe4edf2, opacity: 0.22, roughness: 0.04 }),
    rubber: M.rubber(0x141414),
    bellows: new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
    dark: M.paint(0x35373b, { roughness: 0.8, metalness: 0.4 }),
    steel: M.stainless(),
    yellow: M.paint(0xf2c200, { roughness: 0.45, metalness: 0.1 }),
    lining: lit(0xe9e8e3, 0.30),
    liningGrey: lit(0xb9bcc0, 0.20, { roughness: 0.6, metalness: 0.2 }),
    liningDark: lit(0x474a50, 0.12, { roughness: 0.7, metalness: 0.2 }),
    floor: litMap(floorTex.map, floorTex.metres, 0.24, { roughness: 0.55 }),
    moquette: litMap(T.moquette({ style: 'barman' }).map, 0.5, 0.20, { roughness: 0.95 }),
    lamp: M.luminaire(0xfff3e0, 1.7),
    lampHousing: M.paint(0xf4f4f0, { roughness: 0.5, metalness: 0.1 }),
    perforated: (() => { const p = T.perforated({ color: 0xe2e3e5 }); return litMap(p.map, p.metres, 0.15, { roughness: 0.5, metalness: 0.3 }); })(),
    headOn: M.luminaire(0xffffff, 3.2), headOff: M.paint(0xcfd5da, { roughness: 0.25, metalness: 0.6 }),
    tailOn: M.luminaire(0xff2a1a, 2.6), tailOff: M.paint(0x6e1410, { roughness: 0.3, metalness: 0.4 }),
    cabDark: M.paint(0x25272b, { roughness: 0.85, metalness: 0.2 }),
    wheel: M.paint(0x4c4e52, { roughness: 0.45, metalness: 0.75 }),
    indicator: M.luminaire(0xff8a1a, 0.9),
  };
  matCache.set(key, mats); return mats;
}

/** Transparent sticker material over a decal atlas (cached per atlas). */
export function decalMaterial(atlas) {
  const key = 'decal:' + atlas.texture.uuid; if (matCache.has(key)) return matCache.get(key);
  const m = M.signMaterial(atlas.texture, { emissive: 0.35, side: THREE.DoubleSide, transparent: true });
  m.alphaTest = 0.15; m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1;
  matCache.set(key, m); return m;
}

// ---------- reusable geometries ----------

const geoCache = new Map();

/** Solid wheel with a flange, axis along X, centred at the origin. */
export function wheelGeometry(diameter) {
  const key = 'wheel:' + diameter; if (geoCache.has(key)) return geoCache.get(key);
  const r = diameter / 2;
  const tread = new THREE.CylinderGeometry(r, r, 0.135, 22); tread.rotateZ(Math.PI / 2);
  const flange = new THREE.CylinderGeometry(r + 0.03, r + 0.03, 0.03, 22); flange.rotateZ(Math.PI / 2); flange.translate(0.055, 0, 0);
  const hub = new THREE.CylinderGeometry(r * 0.35, r * 0.35, 0.16, 12); hub.rotateZ(Math.PI / 2);
  const g = mergeGeometries([tread, flange, hub], false); g.computeBoundingSphere();
  geoCache.set(key, g); return g;
}

/**
 * A door leaf for the +x bodyside, centred on z = 0, hanging on the car profile with the outer face 50 mm behind the skin
 * (the leaf slides in the pocket between the outer skin and the interior lining). `lead` = +1 → leading edge at +z.
 * Geometry groups (in order): red panel, glass, rubber gasket/seal, yellow stripe + grab handle.
 */
export function leafGeometry(spec, width, lead) {
  const key = `leaf:${spec.code}:${width}:${lead}`; if (geoCache.has(key)) return geoCache.get(key);
  const P = spec.profile; const sill = spec.doorSill + 0.015, top = spec.doorSill + spec.doorHeight - 0.02; const [wb, wt] = spec.doorWindow;
  const w = width, hw = w / 2, e = 0.09; const out = 0.05, inn = 0.10;
  const red = [], glass = [], rubber = [], yellow = [];
  // outer face (4 pieces around the window) + inner face (flipped)
  for (const [ins, flip] of [[out, false], [inn, true]]) {
    red.push(profileStrip(P, sill, wb, -hw, hw, { inset: ins, flip }));
    red.push(profileStrip(P, wt, top, -hw, hw, { inset: ins, flip }));
    red.push(profileStrip(P, wb, wt, -hw, -hw + e, { inset: ins, flip }));
    red.push(profileStrip(P, wb, wt, hw - e, hw, { inset: ins, flip }));
  }
  // edge closures
  red.push(profileRibbon(P, sill, top, -hw, out, inn, { dir: -1 })); red.push(profileRibbon(P, sill, top, hw, out, inn, { dir: 1 }));
  // window: glass in the middle of the leaf thickness, gasket frame around it on the outer face
  glass.push(profileStrip(P, wb, wt, -hw + e, hw - e, { inset: 0.075 }));
  glass.push(profileStrip(P, wb, wt, -hw + e, hw - e, { inset: 0.076, flip: true }));
  const gk = 0.028;
  rubber.push(profileStrip(P, wb - gk, wb + 0.004, -hw + e - gk, hw - e + gk, { inset: out - 0.004 }));
  rubber.push(profileStrip(P, wt - 0.004, wt + gk, -hw + e - gk, hw - e + gk, { inset: out - 0.004 }));
  rubber.push(profileStrip(P, wb, wt, -hw + e - gk, -hw + e + 0.004, { inset: out - 0.004 }));
  rubber.push(profileStrip(P, wb, wt, hw - e - 0.004, hw - e + gk, { inset: out - 0.004 }));
  // leading-edge rubber seal
  rubber.push(profileRibbon(P, sill, top, lead * hw + lead * 0.012, out - 0.01, inn + 0.01, { dir: lead }));
  // yellow leading-edge stripe (outer face) + interior vertical grab handle near the leading edge
  yellow.push(profileStrip(P, sill + 0.02, top - 0.02, lead > 0 ? hw - 0.06 : -hw, lead > 0 ? hw : -hw + 0.06, { inset: out - 0.003 }));
  const hz = lead * (hw - 0.14);
  yellow.push(profileTube(P, sill + 0.75, sill + 1.55, hz, inn + 0.045, 0.016));
  for (const y of [sill + 0.78, sill + 1.52]) yellow.push(boxAt(0.045, 0.03, 0.03, xAt(P, y) - inn - 0.022, y, hz));
  const parts = [red, glass, rubber, yellow].map(list => mergeGeometries(list, false));
  const g = mergeGeometries(parts, true); g.computeBoundingSphere();
  geoCache.set(key, g); return g;
}

/** A simple longitudinal seat (cushion + back) for the +x side, back against x = xBack, centred on z = 0. Returns { moquette, base } geometries. */
export function seatGeometry(spec, { width = 0.44, xBack = 1.0, floorY = 0, side = 1, base = true, backLean = 0.2 } = {}) {
  const cush = spec.seatCushion, depth = spec.seatDepth; const y0 = floorY;
  const mq = [];
  const cushion = T.boxGeometryMetric(depth - 0.10, 0.10, width - 0.02); cushion.translate(side * (xBack - 0.10 - (depth - 0.10) / 2), y0 + cush - 0.05, 0); mq.push(cushion);
  const back = T.boxGeometryMetric(0.09, 0.56, width - 0.02); back.rotateZ(-side * backLean); back.translate(side * (xBack - 0.07), y0 + cush + 0.30, 0); mq.push(back);
  const out = { moquette: mergeGeometries(mq, false) };
  if (base) { out.base = boxAt(depth - 0.16, cush - 0.03, width - 0.01, side * (xBack - 0.08 - (depth - 0.16) / 2), y0 + (cush - 0.03) / 2, 0); }
  else { out.base = boxAt(0.06, 0.05, width - 0.06, side * (xBack - depth + 0.10), y0 + cush - 0.13, 0); }
  return out;
}

export { mergeGeometries };
