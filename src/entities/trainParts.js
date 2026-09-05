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
  constructor(aliases = {}) { this.map = new Map(); this.aliases = aliases; }
  add(key, geo) { if (!geo) return; key = this.aliases[key] || key; let l = this.map.get(key); if (!l) { l = []; this.map.set(key, l); } l.push(geo); return geo; }
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
 * One 1024² transparent canvas with every sticker/decal a train carries (sizes from dossier §8). Returns
 * { texture, rect(name) → {u0,v0,u1,v1, aspect} }. Cells are 256 px; some entries span two cells.
 */
export function decalAtlas(spec, { unitNumber = spec.unitNumbers[0], lineName = spec.line === 'jubilee' ? 'Jubilee line' : 'District line', lineColor = spec.line === 'jubilee' ? '#a0a5a9' : '#00782a' } = {}) {
  const key = spec.code + ':' + unitNumber + ':' + lineName;
  if (atlasCache.has(key)) return atlasCache.get(key);
  const S = 1024, SH = 1152, C = 256; const c = T.canvas(S, SH); const ctx = c.getContext('2d');   // 4 × 4 cells + a 128 px strip of small labels
  const cells = {}; const rects = {};
  const cell = (name, col, row, wc = 1, hc = 1) => { cells[name] = { x: col * C, y: row * C, w: wc * C, h: hc * C }; rects[name] = { u0: col * C / S + 0.004, u1: (col + wc) * C / S - 0.004, v0: 1 - (row + hc) * C / SH + 0.003, v1: 1 - row * C / SH - 0.003, aspect: wc / hc }; return cells[name]; };
  const text = (str, x, y, size, { color = '#000', weight = 'bold', align = 'center', font = FONT, maxW = null } = {}) => {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; let fs = size; ctx.font = `${weight} ${fs}px ${font}`;
    if (maxW) while (ctx.measureText(str).width > maxW && fs > 6) { fs -= 1; ctx.font = `${weight} ${fs}px ${font}`; }
    ctx.fillText(str, x, y);
  };
  const rrect = (x, y, w, h, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
  const hazard = (x, y, w, h, vertical) => { // yellow/black 'shark teeth' hazard strip
    ctx.fillStyle = '#ffcd00'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#111';
    if (vertical) for (let yy = y; yy < y + h; yy += 28) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy + 14); ctx.lineTo(x, yy + 28); ctx.closePath(); ctx.fill(); }
    else for (let xx = x; xx < x + w; xx += 28) { ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx + 14, y + h); ctx.lineTo(xx + 28, y); ctx.closePath(); ctx.fill(); }
  };
  const is96 = spec.code === '1996';

  // row 0: roundel (440 mm), line name label, car number (blue 80 mm caps on the bodyside), car number in white (cab front)
  { const r = cell('roundel', 0, 0); T.drawRoundel(ctx, r.x + C / 2, r.y + C / 2, C * 0.46, { text: 'UNDERGROUND' }); }
  { const r = cell('lineName', 1, 0, 2, 1); ctx.fillStyle = lineColor; ctx.fillRect(r.x + 16, r.y + 150, r.w - 32, 22); text(lineName, r.x + r.w / 2, r.y + 92, 84, { color: '#1c1c1c', maxW: r.w - 40 }); }
  { const r = cell('unitNo', 3, 0); text(unitNumber, r.x + C / 2, r.y + C / 2, 92, { color: '#0019a8', weight: '600' }); }
  // row 1: priority seat (100 × 140), door notice above the door windows (500 × 50, blue/yellow), emergency alarm / door release
  { const r = cell('priority', 0, 1); rrect(r.x + 40, r.y + 8, C - 80, C - 16, 10, '#005eb8'); text('Priority', r.x + C / 2, r.y + 56, 34, { color: '#fff' }); text('seat', r.x + C / 2, r.y + 92, 34, { color: '#fff' });
    text('Please offer this', r.x + C / 2, r.y + 138, 15, { color: '#fff', weight: 'normal' }); text('seat to someone', r.x + C / 2, r.y + 156, 15, { color: '#fff', weight: 'normal' }); text('who needs it more', r.x + C / 2, r.y + 174, 15, { color: '#fff', weight: 'normal' });
    ctx.fillStyle = '#fff'; [88, 116, 144, 172].forEach(px => { ctx.beginPath(); ctx.arc(r.x + px, r.y + 204, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(r.x + px - 3.5, r.y + 211, 7, 22); }); }
  { const r = cell('standClear', 1, 1, 2, 1); ctx.fillStyle = '#0019a8'; ctx.fillRect(r.x, r.y + 100, r.w, 52); ctx.fillStyle = '#ffcd00'; ctx.fillRect(r.x, r.y + 152, r.w, 4);
    text('Obstructing the doors can be dangerous', r.x + r.w / 2, r.y + 120, 24, { color: '#fff', maxW: r.w - 16 }); text('and causes delays   ·   Penalty fare £50', r.x + r.w / 2, r.y + 141, 15, { color: '#ffcd00', weight: 'normal', maxW: r.w - 16 }); }
  { const r = cell('alarm', 3, 1); if (is96) { rrect(r.x + 8, r.y + 8, C - 16, C - 16, 10, '#c8102e'); text('EMERGENCY', r.x + C / 2, r.y + 50, 34, { color: '#fff' }); text('ALARM', r.x + C / 2, r.y + 90, 34, { color: '#fff' });
      ctx.fillStyle = '#ffd300'; ctx.fillRect(r.x + 100, r.y + 120, 56, 90); ctx.fillStyle = '#111'; ctx.fillRect(r.x + 116, r.y + 128, 24, 40); text('Pull handle down', r.x + C / 2, r.y + 228, 18, { color: '#fff', weight: 'normal' }); }
    else { rrect(r.x + 8, r.y + 8, C - 16, C / 2 - 8, 8, '#c8102e'); rrect(r.x + 8, r.y + C / 2, C - 16, C / 2 - 8, 8, '#007a33'); text('Emergency', r.x + C / 2, r.y + 46, 30, { color: '#fff' }); text('door release', r.x + C / 2, r.y + 84, 30, { color: '#fff' }); text('Lift flap · pull handle', r.x + C / 2, r.y + 160, 20, { color: '#fff', weight: 'normal' }); text('Wait for the train to stop', r.x + C / 2, r.y + 200, 18, { color: '#fff', weight: 'normal' }); } }
  // row 2: cab door, wheelchair, no smoking, CCTV
  { const r = cell('doNotObstruct', 0, 2); rrect(r.x + 8, r.y + 40, C - 16, C - 80, 8, '#f4f4f4'); text('DRIVER', r.x + C / 2, r.y + 84, 30, { color: '#111' }); text('DO NOT', r.x + C / 2, r.y + 124, 34, { color: '#c8102e' }); text('OBSTRUCT', r.x + C / 2, r.y + 164, 34, { color: '#c8102e' }); }
  { const r = cell('wheelchair', 1, 2); rrect(r.x + 18, r.y + 8, C - 36, C - 16, 14, '#005eb8'); ctx.strokeStyle = '#fff'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(r.x + 128, r.y + 150, 44, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r.x + 118, r.y + 62, 16, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(r.x + 108, r.y + 78, 18, 60); ctx.fillRect(r.x + 108, r.y + 122, 60, 14); ctx.fillRect(r.x + 158, r.y + 122, 14, 44); text('Priority area', r.x + C / 2, r.y + 228, 20, { color: '#fff', weight: 'normal' }); }
  { const r = cell('noSmoking', 2, 2); rrect(r.x + 8, r.y + 8, C - 16, C - 16, 14, '#f4f4f4'); ctx.strokeStyle = '#dc241f'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(r.x + 128, r.y + 110, 66, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#333'; ctx.fillRect(r.x + 82, r.y + 104, 92, 14); ctx.strokeStyle = '#dc241f'; ctx.beginPath(); ctx.moveTo(r.x + 80, r.y + 62); ctx.lineTo(r.x + 176, r.y + 158); ctx.stroke(); text('No smoking', r.x + C / 2, r.y + 212, 26, { color: '#111' }); }
  { const r = cell('cctv', 3, 2); rrect(r.x + 8, r.y + 60, C - 16, C - 120, 8, '#ffd300'); text('CCTV', r.x + C / 2, r.y + 108, 44, { color: '#111' }); text('in operation on this train', r.x + C / 2, r.y + 156, 20, { color: '#111', weight: 'normal' }); }
  // row 3: floor threshold, car number plate (interior), cab-end door label, leaf labels
  { const r = cell('mindGap', 0, 3, 2, 1); ctx.fillStyle = '#ffd300'; ctx.fillRect(r.x, r.y + 96, r.w, 64); text('MIND THE GAP', r.x + r.w / 2, r.y + 128, 46, { color: '#111' }); }
  { const r = cell('carNo', 2, 3); text(unitNumber, r.x + C / 2, r.y + 100, 60, { color: '#0019a8' }); text(is96 ? '1996 Tube Stock' : 'S7 Stock', r.x + C / 2, r.y + 160, 24, { color: '#444', weight: 'normal' }); }
  { const r = cell('endDoor', 3, 3); if (is96) { rrect(r.x + 8, r.y + 60, C - 16, C - 120, 8, '#c8102e'); text('This door', r.x + C / 2, r.y + 100, 28, { color: '#fff' }); text('is alarmed', r.x + C / 2, r.y + 136, 28, { color: '#fff' }); }
    else { rrect(r.x + 8, r.y + 60, C - 16, C - 120, 8, '#f4f4f4'); text('Please keep', r.x + C / 2, r.y + 100, 24, { color: '#111' }); text('the gangway clear', r.x + C / 2, r.y + 136, 24, { color: '#111' }); } }
  // door-leaf labels in the free corner of the last cell: 'Caution – Sliding doors' 130 × 52 (yellow/black), leading-edge hazard strip (vertical), interior 'Items trapped in the doors cause delays' yellow strip (vertical), white cab-front number
  const sub = (name, x, y, w, h) => { rects[name] = { u0: x / S + 0.002, u1: (x + w) / S - 0.002, v0: 1 - (y + h) / SH + 0.002, v1: 1 - y / SH - 0.002, aspect: w / h }; return { x, y, w, h }; };
  { const r = sub('slidingDoors', 8, 1040, 236, 96); ctx.fillStyle = '#ffcd00'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#111'; ctx.fillRect(r.x, r.y, 26, r.h); text('CAUTION', r.x + 30 + (r.w - 30) / 2, r.y + 30, 26, { color: '#111' }); text('Sliding doors', r.x + 30 + (r.w - 30) / 2, r.y + 66, 24, { color: '#111', weight: 'normal' }); }
  { const r = sub('hazard', 260, 1032, 60, 112); hazard(r.x, r.y, r.w, r.h, true); }
  { const r = sub('itemsTrapped', 330, 1032, 60, 112); ctx.fillStyle = '#ffcd00'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.rotate(-Math.PI / 2); text(is96 ? 'Items trapped in the doors cause delays' : 'Mind the gap · items trapped in doors', 0, 0, 13, { color: '#111', maxW: r.h - 8 }); ctx.restore(); }
  { const r = sub('unitNoWhite', 400, 1040, 120, 60); text(unitNumber, r.x + r.w / 2, r.y + r.h / 2, 36, { color: '#fff', weight: '600' }); }
  { const r = sub('deicing', 540, 1036, 64, 64); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r.x + 32, r.y + 32, 27, 0, Math.PI * 2); ctx.fill(); }
  // door reference letter (white 17 mm caps) and the 1996 blue 'This is a 7-car train' style unit plate are too small to read; a plain white 'A'
  { const r = sub('doorLetter', 620, 1036, 48, 64); text('A', r.x + 24, r.y + 32, 44, { color: '#fff' }); }

  const texture = T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping }); texture.anisotropy = 8;
  const out = { texture, rect: n => rects[n], rects };
  atlasCache.set(key, out); return out;
}

// ---------- materials ----------

const matCache = new Map();
/** Satin aluminium bodyside: brushed-metal map (metric, 1 m tiles) with a roughness map so the panels catch the light unevenly. */
function brushedBody(color, metalness, roughness, seed, strength = 0.45) {
  const tex = T.brushedMetal({ base: color, seed, vertical: false });
  // soften the brush: composite the streaks over the flat colour at reduced alpha, and add faint horizontal panel seams
  const src = tex.map.image; const c = T.canvas(src.width, src.height); const ctx = c.getContext('2d');
  ctx.fillStyle = '#' + color.toString(16).padStart(6, '0'); ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalAlpha = strength; ctx.drawImage(src, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(0, Math.floor(c.height * 0.5) - 1, c.width, 2);
  const map = T.toTexture(c); map.repeat.set(1 / tex.metres, 1 / tex.metres); map.needsUpdate = true;
  const rough = tex.roughnessMap.clone(); rough.repeat.set(1 / tex.metres, 1 / tex.metres); rough.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ color: 0xffffff, map, roughnessMap: rough, roughness, metalness });
}
function lit(color, e, { roughness = 0.75, metalness = 0 } = {}) { return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: e, roughness, metalness }); }
function litMap(tex, metres, e, { roughness = 0.8, metalness = 0 } = {}) {
  const map = tex.clone(); map.repeat.set(1 / metres, 1 / metres); map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ color: 0xffffff, map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: e, roughness, metalness });
}

/**
 * Per-stock aliases: parts that happen to be the same colour on this stock share ONE merged mesh (Collector keys are
 * rewritten through this table), which is what keeps a 7-car train under ~180 draw calls.
 */
export function materialAliases(spec) {
  const is96 = spec.code === '1996';
  return is96
    ? { ledHousing: 'dark', lampHousing: 'lining', strap: 'dark', rubber: 'dark', steel: 'pole', cabDark: 'dark', cabFace: 'blue', cabDoor: 'blue', mDoor: 'red' }
    : { ledHousing: 'dark', lampHousing: 'lining', strap: 'pole', armrest: 'pole', rubber: 'dark', roof: 'body', cabDark: 'dark', cabFace: 'red', cabDoor: 'body', valance: 'blue', mDoor: 'red' };
}

/** All materials for a stock; cached so every train of that stock shares them (fewer state changes). */
export function trainMaterials(spec) {
  const key = spec.code;
  if (matCache.has(key)) return matCache.get(key);
  const L = spec.livery; const is96 = spec.code === '1996';
  const floorTex = T.granite({ base: L.floor, light: L.floorGroove, dark: is96 ? 0x1e1f21 : 0x3a3d40, joints: false, seed: is96 ? 23 : 29 });
  const mats = {
    body: brushedBody(L.body, is96 ? 0.78 : 0.5, is96 ? 0.40 : 0.36, is96 ? 5 : 6, is96 ? 0.30 : 0.20),
    lowerBody: brushedBody(L.lowerBody, is96 ? 0.72 : 0.5, 0.48, 5, is96 ? 0.32 : 0.20),
    blue: M.paint(0x0019a8, { roughness: 0.5, metalness: 0.2 }),
    red: M.paint(L.doors, { roughness: 0.4, metalness: 0.2 }),
    cabFace: M.paint(L.cabFace, { roughness: 0.45, metalness: 0.2 }),
    valance: M.paint(L.valance, { roughness: 0.6, metalness: 0.3 }),
    cabDoor: M.paint(L.cabDoors, { roughness: 0.45, metalness: is96 ? 0.2 : 0.55 }),
    roof: M.paint(L.roof, { roughness: 0.7, metalness: 0.35 }),
    windowFrame: M.paint(L.windowFrame, { roughness: 0.55, metalness: 0.3 }),
    glass: M.glass({ tint: L.windowTint, opacity: 0.42, roughness: 0.06 }),   // light tint: you can see the platform from a seat
    clearGlass: M.glass({ color: 0xe4edf2, opacity: 0.22, roughness: 0.04 }),
    rubber: M.rubber(0x141414),
    bellows: new THREE.MeshStandardMaterial({ color: is96 ? 0x1b1b1b : 0x4a4c4f, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
    dark: M.paint(0x35373b, { roughness: 0.8, metalness: 0.4 }),
    steel: M.stainless(),
    yellow: M.paint(0xffcd00, { roughness: 0.45, metalness: 0.1 }),
    pole: L.poleMetal ? M.paint(L.pole, { roughness: 0.35, metalness: 0.85 }) : M.paint(L.pole, { roughness: 0.4, metalness: 0.15 }),
    armrest: M.paint(L.armrest, { roughness: 0.5, metalness: 0.2 }),
    strap: M.paint(L.strap, { roughness: 0.85, metalness: 0 }),
    lining: lit(L.lining, 0.30),
    liningGrey: lit(0xb9bcc0, 0.20, { roughness: 0.6, metalness: 0.2 }),
    liningDark: lit(0x474a50, 0.12, { roughness: 0.7, metalness: 0.2 }),
    floor: litMap(floorTex.map, floorTex.metres, 0.24, { roughness: 0.55 }),
    moquette: litMap(T.moquette({ style: 'barman' }).map, 0.5, 0.20, { roughness: 0.95 }),
    lamp: M.luminaire(0xfff3e0, 1.7),
    lampHousing: M.paint(0xf4f4f0, { roughness: 0.5, metalness: 0.1 }),
    perforated: (() => { const p = T.perforated({ color: 0xe2e3e5 }); return litMap(p.map, p.metres, 0.15, { roughness: 0.5, metalness: 0.3 }); })(),
    headOn: M.luminaire(is96 ? 0xfff1d6 : 0xffffff, 3.2), headOff: M.paint(0xcfd5da, { roughness: 0.25, metalness: 0.6 }),
    tailOn: M.luminaire(0xff0a06, 1.6), tailOff: M.paint(0x6e1410, { roughness: 0.3, metalness: 0.4 }),
    cabDark: M.paint(0x25272b, { roughness: 0.85, metalness: 0.2 }),
    wheel: M.paint(0x6a6d72, { roughness: 0.45, metalness: 0.7 }),
    indicator: M.luminaire(0xff8a1a, 0.9),
    ledHousing: M.paint(0x1e1f22, { roughness: 0.6, metalness: 0.3 }),
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
 * A door leaf for the +x bodyside, centred on z = 0, hanging on the car profile OUTSIDE the skin (externally hung, as on
 * both the 1996 TS and the S7: the open leaves sit over the bodyside beside the doorway). `lead` = +1 → leading edge at +z.
 * Geometry groups (in order): red panel, glass, rubber gasket/seal, pole-coloured interior grab handle, decals (labels
 * from the atlas, including the opaque yellow/black leading-edge hazard strip).
 */
export function leafGeometry(spec, width, lead, atlas) {
  const key = `leaf:${spec.code}:${width}:${lead}:${atlas ? atlas.texture.uuid : ''}`; if (geoCache.has(key)) return geoCache.get(key);
  const P = spec.profile; const sill = spec.doorSill + 0.015, top = spec.doorSill + spec.doorHeight - 0.02; const [wb, wt] = spec.doorWindow;
  // Both stocks hang their leaves OUTSIDE the bodyside (dossier §8.1 'externally-hung'): outer face 42 mm proud of the
  // skin, inner face just inside the skin plane, so an open leaf slides over the adjacent window from the outside.
  const w = width, hw = w / 2, e = 0.09; const out = -0.042, inn = 0.004; const is96 = spec.code === '1996';
  const red = [], glass = [], rubber = [], pole = [], decal = [];
  for (const [ins, flip] of [[out, false], [inn, true]]) {
    red.push(profileStrip(P, sill, wb, -hw, hw, { inset: ins, flip }));
    red.push(profileStrip(P, wt, top, -hw, hw, { inset: ins, flip }));
    red.push(profileStrip(P, wb, wt, -hw, -hw + e, { inset: ins, flip }));
    red.push(profileStrip(P, wb, wt, hw - e, hw, { inset: ins, flip }));
  }
  red.push(profileRibbon(P, sill, top, -hw, out, inn, { dir: -1 })); red.push(profileRibbon(P, sill, top, hw, out, inn, { dir: 1 }));
  glass.push(profileStrip(P, wb, wt, -hw + e, hw - e, { inset: 0.075 }));
  glass.push(profileStrip(P, wb, wt, -hw + e, hw - e, { inset: 0.076, flip: true }));
  const gk = 0.028;
  rubber.push(profileStrip(P, wb - gk, wb + 0.004, -hw + e - gk, hw - e + gk, { inset: out - 0.004 }));
  rubber.push(profileStrip(P, wt - 0.004, wt + gk, -hw + e - gk, hw - e + gk, { inset: out - 0.004 }));
  rubber.push(profileStrip(P, wb, wt, -hw + e - gk, -hw + e + 0.004, { inset: out - 0.004 }));
  rubber.push(profileStrip(P, wb, wt, hw - e - 0.004, hw - e + gk, { inset: out - 0.004 }));
  rubber.push(profileRibbon(P, sill, top, lead * hw + lead * 0.012, out - 0.01, inn + 0.01, { dir: lead }));
  // leading-edge hazard strip (exterior): 1996 70 × 606 mm at c. 1.0–1.6 m above the floor; S7 80 × 304 mm, top aligned with the window tops
  const hz0 = is96 ? sill + 0.95 : wt - 0.30, hz1 = is96 ? sill + 1.56 : wt; const hzw = is96 ? 0.07 : 0.08;
  const edgeZ0 = lead > 0 ? hw - hzw : -hw, edgeZ1 = lead > 0 ? hw : -hw + hzw;
  // interior grab handle near the leading edge
  const hzc = lead * (hw - 0.14);
  pole.push(profileTube(P, sill + 0.75, sill + 1.55, hzc, inn + 0.045, 0.016));
  for (const y of [sill + 0.78, sill + 1.52]) pole.push(boxAt(0.045, 0.03, 0.03, xAt(P, y) - inn - 0.022, y, hzc));
  if (atlas) {
    const put = (name, y0, y1, z0, z1, inset, flip) => { const g = profileStrip(P, y0, y1, z0, z1, { inset, flip, steps: 2 }); const r = atlas.rect(name); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) { const u = (uv.getX(i) - z0) / (z1 - z0), v = (uv.getY(i) - y0) / (y1 - y0); uv.setXY(i, r.u0 + (r.u1 - r.u0) * (flip ? 1 - u : u), r.v0 + (r.v1 - r.v0) * v); } decal.push(g); };
    // exterior: hazard chevrons on the strip, 'Caution – Sliding doors' 130 × 52 on the lower panel
    put('hazard', hz0, hz1, edgeZ0, edgeZ1, out - 0.008, false);
    put('slidingDoors', sill + 0.62, sill + 0.672, -0.065, 0.065, out - 0.006, false);
    // interior: 'Items trapped in the doors cause delays' yellow strip on the opening edge (74 × 265 / 80 × 419)
    const itZ = lead > 0 ? [hw - 0.15, hw - 0.075] : [-hw + 0.075, -hw + 0.15];
    put('itemsTrapped', sill + 0.95, sill + (is96 ? 1.215 : 1.37), itZ[0], itZ[1], inn + 0.006, true);
    put('standClear', wt + 0.02, wt + 0.07, -hw + 0.1, hw - 0.1, inn + 0.006, true);
    // door reference letter: 17 mm white caps, 20 mm down from the top of the leaf and 20 mm in from the edge
    const lz = lead > 0 ? [hw - 0.045, hw - 0.02] : [-hw + 0.02, -hw + 0.045]; put('doorLetter', top - 0.045, top - 0.02, lz[0], lz[1], out - 0.006, false);
  }
  const parts = [red, glass, rubber, pole, decal].map(list => list.length ? mergeGeometries(list, false) : new THREE.PlaneGeometry(0.001, 0.001));
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

// ---------- LED dot-matrix text (proportional font sampled onto an LED grid) ----------

/**
 * An updatable orange LED matrix that renders proportional text (as the real destination and saloon displays do),
 * so any aspect ratio can be matched by choosing cols/rows. Text wider than the grid is shrunk down to `minScale`;
 * beyond that it is clipped, so use paginate() for long messages.
 *   ledMatrixText({ cols, rows, dot, gap, color }) → { texture, set(text, {align}), paginate(text), aspect, width, height }
 */
export function ledMatrixText({ cols = 128, rows = 16, dot = 4, gap = 1, color = '#ff9e1b', dim = '#1a1208', bg = '#050505', weight = 'bold', minScale = 0.74, condense = 0.86, font = T.SIGN_FONT } = {}) {
  const pitch = dot + gap; const width = cols * pitch + gap, height = rows * pitch + gap;
  const c = T.canvas(width, height); const ctx = c.getContext('2d');
  const SS = 4; const off = T.canvas(cols * SS, rows * SS); const octx = off.getContext('2d', { willReadFrequently: true });
  const tex = T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping }); tex.minFilter = THREE.LinearFilter;
  const basePx = rows * SS * 0.82;
  function measure(text, px = basePx) { octx.font = `${weight} ${px}px ${font}`; return octx.measureText(text).width * condense / SS; }
  function set(text, { align = 'center' } = {}) {
    text = String(text ?? '');
    let px = basePx; const maxW = (cols - 2) * SS;
    octx.font = `${weight} ${px}px ${font}`; let w = octx.measureText(text).width * condense;
    if (w > maxW) { px = Math.max(basePx * minScale, px * maxW / w); octx.font = `${weight} ${px}px ${font}`; }
    octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, off.width, off.height); octx.fillStyle = '#fff'; octx.textBaseline = 'middle'; octx.textAlign = align;
    octx.setTransform(condense, 0, 0, 1, align === 'center' ? off.width * (1 - condense) / 2 : 0, 0);   // condensed glyphs, like the real LED fonts
    octx.fillText(text, align === 'center' ? off.width / 2 : SS, off.height / 2 + SS * 0.4);
    octx.setTransform(1, 0, 0, 1, 0, 0);
    const data = octx.getImageData(0, 0, off.width, off.height).data;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    for (let r = 0; r < rows; r++) for (let x = 0; x < cols; x++) {
      let cov = 0; for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) cov += data[((r * SS + j) * off.width + (x * SS + i)) * 4 + 3];
      const on = cov > 255 * SS * SS * 0.30;
      ctx.fillStyle = on ? color : dim; const px0 = gap + x * pitch + dot / 2, py0 = gap + r * pitch + dot / 2;
      ctx.beginPath(); ctx.arc(px0, py0, dot / 2 * (on ? 1 : 0.7), 0, Math.PI * 2); ctx.fill();
      if (on) { ctx.fillStyle = 'rgba(255,210,140,0.45)'; ctx.beginPath(); ctx.arc(px0, py0, dot * 0.22, 0, Math.PI * 2); ctx.fill(); }
    }
    tex.needsUpdate = true;
  }
  /** Split a sentence into pages that fit the grid at full size (breaks at spaces; sentences first). */
  function paginate(text) {
    text = String(text ?? '').trim(); if (!text) return [''];
    const maxW = (cols - 2) / minScale; const pages = [];   // a page may use the shrink; beyond that it is split
    const chunks = text.split(/(?<=[.!?])\s+/);
    for (const chunk of chunks) {
      if (measure(chunk) <= maxW) { pages.push(chunk); continue; }
      let cur = '';
      for (const wd of chunk.split(/\s+/)) { const trial = cur ? cur + ' ' + wd : wd; if (measure(trial) <= maxW || !cur) cur = trial; else { pages.push(cur); cur = wd; } }
      if (cur) pages.push(cur);
    }
    return pages.length ? pages : [''];
  }
  set('');
  return { texture: tex, canvas: c, set, paginate, measure, width, height, aspect: width / height, cols, rows };
}

// ---------- Central London Tube map (the 723 × 265 / 750 × 200 mm card in the centre ad panel) ----------

let _tubeMap = null;
/** A schematic, deterministic 'Tube map' poster texture: coloured lines on white with interchange rings and a roundel. No real map data. */
export function tubeMapTexture({ width = 896, height = 256 } = {}) {
  if (_tubeMap) return _tubeMap;
  const c = T.canvas(width, height); const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
  // Thames (pale blue band) and the zone-1 grey
  ctx.fillStyle = '#f0f0f0'; ctx.fillRect(width * 0.16, height * 0.12, width * 0.66, height * 0.78);
  ctx.strokeStyle = '#a9d7f0'; ctx.lineWidth = height * 0.06; ctx.beginPath(); ctx.moveTo(width * 0.05, height * 0.66); ctx.lineTo(width * 0.30, height * 0.66); ctx.lineTo(width * 0.42, height * 0.78); ctx.lineTo(width * 0.62, height * 0.78); ctx.lineTo(width * 0.75, height * 0.62); ctx.lineTo(width * 0.95, height * 0.62); ctx.stroke();
  const W = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = W;
  const line = (col, pts) => { ctx.strokeStyle = col; ctx.beginPath(); pts.forEach(([x, y], i) => { const px = width * x, py = height * y; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke(); };
  line('#e32017', [[0.06, 0.34], [0.30, 0.34], [0.44, 0.34], [0.66, 0.34], [0.94, 0.30]]);                              // Central
  line('#00782a', [[0.06, 0.72], [0.30, 0.72], [0.50, 0.72], [0.66, 0.60], [0.94, 0.60]]);                              // District
  line('#ffd300', [[0.30, 0.22], [0.62, 0.22], [0.66, 0.26], [0.66, 0.60], [0.50, 0.72], [0.30, 0.72], [0.26, 0.68], [0.26, 0.26], [0.30, 0.22]]);   // Circle
  line('#000000', [[0.40, 0.06], [0.40, 0.34], [0.40, 0.72], [0.44, 0.94]]); line('#000000', [[0.52, 0.06], [0.52, 0.34], [0.55, 0.60], [0.55, 0.94]]);   // Northern (two branches)
  line('#003688', [[0.06, 0.52], [0.30, 0.52], [0.44, 0.34], [0.52, 0.34], [0.60, 0.16], [0.94, 0.12]]);              // Piccadilly
  line('#0098d4', [[0.20, 0.94], [0.30, 0.72], [0.36, 0.48], [0.52, 0.16], [0.94, 0.08]]);                             // Victoria
  line('#a0a5a9', [[0.12, 0.10], [0.26, 0.26], [0.36, 0.48], [0.40, 0.72], [0.60, 0.80], [0.94, 0.72]]);              // Jubilee
  line('#b36305', [[0.20, 0.06], [0.30, 0.34], [0.36, 0.48], [0.40, 0.72], [0.44, 0.94]]);                             // Bakerloo
  line('#9b0056', [[0.06, 0.14], [0.30, 0.22], [0.62, 0.22]]);                                                         // Metropolitan
  line('#6950a1', [[0.06, 0.28], [0.26, 0.26], [0.62, 0.22], [0.94, 0.20]]);                                           // Elizabeth
  const inter = [[0.30, 0.34], [0.44, 0.34], [0.66, 0.34], [0.30, 0.72], [0.50, 0.72], [0.66, 0.60], [0.40, 0.72], [0.36, 0.48], [0.52, 0.16], [0.26, 0.26], [0.62, 0.22], [0.30, 0.22], [0.52, 0.34], [0.60, 0.80]];
  for (const [x, y] of inter) { ctx.beginPath(); ctx.arc(width * x, height * y, W * 1.3, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#000'; ctx.stroke(); }
  ctx.lineWidth = W;
  const label = (t, x, y, bold = false) => { ctx.fillStyle = '#000'; ctx.font = `${bold ? 'bold' : 'normal'} ${height * 0.055}px ${T.SIGN_FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, width * x, height * y); };
  label('Westminster', 0.405, 0.78, true); label('Waterloo', 0.60, 0.86); label('Green Park', 0.365, 0.43); label('Oxford Circus', 0.365, 0.29); label('Bank', 0.665, 0.29); label("King's Cross", 0.485, 0.11); label('Embankment', 0.505, 0.66); label('Baker Street', 0.20, 0.20); label('Victoria', 0.24, 0.79); label('Paddington', 0.06, 0.22); label('Liverpool St', 0.625, 0.17); label('London Bridge', 0.605, 0.75); label('Tower Hill', 0.665, 0.55);
  // title block with a roundel
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width * 0.15, height * 0.16);
  T.drawRoundel(ctx, width * 0.035, height * 0.085, height * 0.06, { text: 'UNDERGROUND' });
  ctx.fillStyle = '#0019a8'; ctx.font = `bold ${height * 0.075}px ${T.SIGN_FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Tube map', width * 0.075, height * 0.085);
  ctx.fillStyle = '#0019a8'; ctx.fillRect(0, height - 6, width, 6);
  ctx.fillStyle = '#444'; ctx.font = `normal ${height * 0.045}px ${T.SIGN_FONT}`; ctx.textAlign = 'right'; ctx.fillText('Central London', width * 0.98, height * 0.93);
  const tex = T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
  _tubeMap = tex; return tex;
}

export { mergeGeometries };
