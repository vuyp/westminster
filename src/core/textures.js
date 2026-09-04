// ---------------------------------------------------------------------------
// textures.js — procedural <canvas> texture generators.
// Everything visual in the station that isn't geometry comes from here.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import * as DOT from './dotfont.js';

const cache = new Map();

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Wrap a canvas in a THREE texture with sensible defaults. */
export function toTexture(c, { repeat = [1, 1], srgb = true, anisotropy = 8, wrap = THREE.RepeatWrapping, filter = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = wrap;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = anisotropy;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (!filter) { t.magFilter = THREE.NearestFilter; }
  t.needsUpdate = true;
  return t;
}

// ---------- small deterministic PRNG + value noise ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable value-noise field, returns Float32Array(size*size) in [0,1]. */
export function noiseField(size, { octaves = 5, seed = 1, lacunarity = 2, gain = 0.5, baseFreq = 4 } = {}) {
  const rnd = mulberry32(seed);
  const out = new Float32Array(size * size);
  let amp = 1, freq = baseFreq, norm = 0;
  for (let o = 0; o < octaves; o++) {
    const g = Math.max(1, Math.round(freq));
    const grid = new Float32Array(g * g);
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * g; const y0 = Math.floor(fy); const ty = fy - y0; const sy = ty * ty * (3 - 2 * ty);
      const y1 = (y0 + 1) % g;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * g; const x0 = Math.floor(fx); const tx = fx - x0; const sx = tx * tx * (3 - 2 * tx);
        const x1 = (x0 + 1) % g;
        const a = grid[y0 * g + x0], b = grid[y0 * g + x1], c = grid[y1 * g + x0], d = grid[y1 * g + x1];
        const v = (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
        out[y * size + x] += v * amp;
      }
    }
    norm += amp; amp *= gain; freq *= lacunarity;
  }
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

/** Height field (Float32Array) → normal map canvas. strength ~ 1..8 */
export function normalMapFromHeight(height, size, strength = 2) {
  const c = canvas(size, size); const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size); const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = height[y * size + ((x - 1 + size) % size)], r = height[y * size + ((x + 1) % size)];
      const u = height[((y - 1 + size) % size) * size + x], dn = height[((y + 1) % size) * size + x];
      let nx = (l - r) * strength, ny = (u - dn) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function hex(n) { return '#' + n.toString(16).padStart(6, '0'); }
function mix(a, b, t) { return a + (b - a) * t; }
function rgbMix(c1, c2, t) {
  const r = mix((c1 >> 16) & 255, (c2 >> 16) & 255, t), g = mix((c1 >> 8) & 255, (c2 >> 8) & 255, t), b = mix(c1 & 255, c2 & 255, t);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// ---------- SURFACES ----------

/**
 * Fair-faced in-situ concrete, as used throughout the Hopkins station: board-marked (horizontal shutter boards),
 * with a grid of formwork tie holes and mottled grey tone. 1 tile ≈ 4 m × 4 m.
 * Returns { map, roughnessMap, normalMap } textures.
 */
export function concrete({ size = 1024, seed = 7, base = 0x9a9893, dark = 0x6f6d69, boardMarks = true, tieHoles = true, metres = 4, stain = 0.35 } = {}) {
  const key = `concrete:${size}:${seed}:${base}:${boardMarks}:${tieHoles}:${metres}:${stain}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size, size); const ctx = c.getContext('2d');
  const n = noiseField(size, { octaves: 6, seed, baseFreq: 3 });
  const n2 = noiseField(size, { octaves: 3, seed: seed + 11, baseFreq: 14, gain: 0.6 });
  const img = ctx.createImageData(size, size); const d = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const boardH = size / (metres / 0.15);          // 150 mm boards
  const rnd = mulberry32(seed * 3 + 1);
  const boardOffsets = []; for (let i = 0; i < 400; i++) boardOffsets.push(rnd());
  for (let y = 0; y < size; y++) {
    const board = Math.floor(y / boardH);
    const inBoard = (y % boardH) / boardH;
    const boardTone = boardMarks ? (boardOffsets[board % 400] - 0.5) * 0.10 : 0;
    const edge = boardMarks ? (inBoard < 0.05 ? -0.12 : inBoard > 0.97 ? -0.06 : 0) : 0;
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      let v = 0.62 + (n[i] - 0.5) * 0.5 * stain + (n2[i] - 0.5) * 0.18 + boardTone + edge;
      v = Math.min(1, Math.max(0, v));
      const col = rgbMix(dark, base, v);
      const p = i * 4; const [r, g, b] = col.match(/\d+/g).map(Number);
      d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = 255;
      height[i] = v * 0.6 + (edge < 0 ? -0.5 : 0) + (n2[i] - 0.5) * 0.2;
      rough[i] = 0.72 + (1 - v) * 0.2 + (n2[i] - 0.5) * 0.1;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (tieHoles) {
    const pitch = size / (metres / 1.0);           // 1 m grid of tie holes (real ~ 0.9–1.2 m)
    for (let gy = 0.5; gy < metres; gy += 1) for (let gx = 0.5; gx < metres; gx += 1) {
      const cx = gx * pitch, cy = gy * pitch;
      const rad = size / metres * 0.028;
      const grd = ctx.createRadialGradient(cx, cy, rad * 0.2, cx, cy, rad);
      grd.addColorStop(0, 'rgba(40,38,36,0.95)'); grd.addColorStop(0.7, 'rgba(70,68,64,0.85)'); grd.addColorStop(1, 'rgba(120,118,112,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
      // subtle dark run-off streak beneath each tie hole
      ctx.fillStyle = 'rgba(60,58,55,0.08)'; ctx.fillRect(cx - rad * 0.4, cy, rad * 0.8, rad * 4);
      for (let k = 0; k < size; k++) { /* no-op keeps height in sync visually; holes not in normal map for cost */ break; }
    }
  }
  const roughC = canvas(size, size); const rctx = roughC.getContext('2d'); const rimg = rctx.createImageData(size, size);
  for (let i = 0; i < rough.length; i++) { const v = Math.min(255, Math.max(0, rough[i] * 255)) | 0; rimg.data[i * 4] = v; rimg.data[i * 4 + 1] = v; rimg.data[i * 4 + 2] = v; rimg.data[i * 4 + 3] = 255; }
  rctx.putImageData(rimg, 0, 0);
  const out = {
    map: toTexture(c), roughnessMap: toTexture(roughC, { srgb: false }), normalMap: toTexture(normalMapFromHeight(height, size, 1.6), { srgb: false }),
    metres,
  };
  cache.set(key, out); return out;
}

/** Dark grey granite / terrazzo floor with speckle and faint slab joints. 1 tile = 2 m. */
export function granite({ size = 1024, seed = 3, base = 0x55575a, light = 0x8a8c8e, dark = 0x2e2f31, joints = true, slab = 1.0, metres = 2 } = {}) {
  const key = `granite:${size}:${seed}:${base}:${joints}:${slab}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size, size); const ctx = c.getContext('2d');
  const n = noiseField(size, { octaves: 4, seed, baseFreq: 6 });
  const img = ctx.createImageData(size, size); const d = img.data;
  const rnd = mulberry32(seed);
  const rough = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const s = rnd();
    let t = 0.5 + (n[i] - 0.5) * 0.35;
    let col = base;
    if (s < 0.06) col = light; else if (s < 0.11) col = dark;
    const [r, g, b] = rgbMix(dark, col, 0.55 + t * 0.45).match(/\d+/g).map(Number);
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
    rough[i] = 0.35 + (n[i] - 0.5) * 0.15;
  }
  ctx.putImageData(img, 0, 0);
  if (joints) {
    const px = size / metres * slab;
    ctx.strokeStyle = 'rgba(25,25,26,0.55)'; ctx.lineWidth = Math.max(1, size / 512);
    for (let k = 0; k <= metres / slab; k++) { ctx.beginPath(); ctx.moveTo(k * px, 0); ctx.lineTo(k * px, size); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, k * px); ctx.lineTo(size, k * px); ctx.stroke(); }
  }
  const roughC = canvas(size, size); const rctx = roughC.getContext('2d'); const rimg = rctx.createImageData(size, size);
  for (let i = 0; i < rough.length; i++) { const v = (rough[i] * 255) | 0; rimg.data[i * 4] = v; rimg.data[i * 4 + 1] = v; rimg.data[i * 4 + 2] = v; rimg.data[i * 4 + 3] = 255; }
  rctx.putImageData(rimg, 0, 0);
  const out = { map: toTexture(c), roughnessMap: toTexture(roughC, { srgb: false }), metres };
  cache.set(key, out); return out;
}

/** Tactile paving: 'blister' (platform edge, 400mm tiles with domes) or 'corduroy' (top/bottom of stairs, ribs). 1 tile = 0.4 m. */
export function tactile({ type = 'blister', size = 256, color = 0x8f9194, colorHi = 0xb5b7ba, colorLo = 0x5c5e61 } = {}) {
  const key = `tactile:${type}:${size}:${color}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size, size); const ctx = c.getContext('2d');
  ctx.fillStyle = hex(color); ctx.fillRect(0, 0, size, size);
  const height = new Float32Array(size * size).fill(0);
  if (type === 'blister') {
    const n = 6; const pitch = size / n; const r = pitch * 0.32;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * pitch, cy = (j + 0.5) * pitch;
      const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      g.addColorStop(0, hex(colorHi)); g.addColorStop(0.8, hex(color)); g.addColorStop(1, hex(colorLo));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const dd = Math.hypot(x - cx, y - cy) / r; if (dd < 1 && x >= 0 && y >= 0 && x < size && y < size) height[y * size + x] = Math.sqrt(1 - dd * dd);
      }
    }
  } else {
    const n = 6; const pitch = size / n;
    for (let i = 0; i < n; i++) {
      const y0 = i * pitch + pitch * 0.25, h = pitch * 0.5;
      const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
      g.addColorStop(0, hex(colorLo)); g.addColorStop(0.35, hex(colorHi)); g.addColorStop(1, hex(colorLo));
      ctx.fillStyle = g; ctx.fillRect(0, y0, size, h);
      for (let y = Math.floor(y0); y < y0 + h; y++) { const t = (y - y0) / h; const v = Math.sin(t * Math.PI); for (let x = 0; x < size; x++) height[y * size + x] = v; }
    }
  }
  // grout lines
  ctx.strokeStyle = 'rgba(40,40,42,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, size - 2, size - 2);
  const out = { map: toTexture(c), normalMap: toTexture(normalMapFromHeight(height, size, 3), { srgb: false }), metres: 0.4 };
  cache.set(key, out); return out;
}

/** Brushed stainless steel — fine directional streaks. Use with high metalness. 1 tile = 1 m. */
export function brushedMetal({ size = 512, seed = 5, base = 0xc8cacc, vertical = false } = {}) {
  const key = `brushed:${size}:${seed}:${base}:${vertical}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size, size); const ctx = c.getContext('2d');
  ctx.fillStyle = hex(base); ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(seed);
  for (let i = 0; i < size * 6; i++) {
    const p = rnd() * size; const a = rnd() * 0.18; const l = rnd() * size * 0.6;
    ctx.strokeStyle = rnd() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.lineWidth = 1; ctx.beginPath();
    const s = rnd() * size;
    if (vertical) { ctx.moveTo(p, s); ctx.lineTo(p, s + l); } else { ctx.moveTo(s, p); ctx.lineTo(s + l, p); }
    ctx.stroke();
  }
  const roughC = canvas(size, size); const rctx = roughC.getContext('2d');
  rctx.fillStyle = '#5a5a5a'; rctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 3; i++) { const p = rnd() * size; rctx.strokeStyle = `rgba(${rnd() < 0.5 ? 255 : 0},${rnd() < 0.5 ? 255 : 0},${rnd() < 0.5 ? 255 : 0},${rnd() * 0.12})`; rctx.beginPath(); if (vertical) { rctx.moveTo(p, 0); rctx.lineTo(p, size); } else { rctx.moveTo(0, p); rctx.lineTo(size, p); } rctx.stroke(); }
  const out = { map: toTexture(c), roughnessMap: toTexture(roughC, { srgb: false }), metres: 1 };
  cache.set(key, out); return out;
}

/** Rectangular tiles (e.g. platform wall tiles). 1 tile = `metres` m. */
export function tiles({ size = 1024, tileW = 0.3, tileH = 0.15, metres = 1.2, color = 0xe8e6e0, grout = 0x9a9892, variation = 0.06, seed = 9, bond = 'stretcher' } = {}) {
  const key = `tiles:${size}:${tileW}:${tileH}:${metres}:${color}:${grout}:${bond}:${seed}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size, size); const ctx = c.getContext('2d');
  ctx.fillStyle = hex(grout); ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(seed);
  const pw = size * tileW / metres, ph = size * tileH / metres; const gap = Math.max(1.5, size / 400);
  const rows = Math.ceil(metres / tileH), cols = Math.ceil(metres / tileW) + 1;
  const height = new Float32Array(size * size).fill(1);
  for (let r = 0; r < rows; r++) {
    const off = bond === 'stretcher' && r % 2 ? -pw / 2 : 0;
    for (let cI = 0; cI < cols; cI++) {
      const x = cI * pw + off, y = r * ph; const v = (rnd() - 0.5) * variation;
      const [cr, cg, cb] = [(color >> 16) & 255, (color >> 8) & 255, color & 255].map(ch => Math.max(0, Math.min(255, ch * (1 + v))) | 0);
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.fillRect(x + gap / 2, y + gap / 2, pw - gap, ph - gap);
      // glaze highlight
      const g = ctx.createLinearGradient(x, y, x, y + ph); g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.06)');
      ctx.fillStyle = g; ctx.fillRect(x + gap / 2, y + gap / 2, pw - gap, ph - gap);
      for (let yy = Math.floor(y); yy < y + gap; yy++) for (let xx = 0; xx < size; xx++) if (yy >= 0 && yy < size) height[yy * size + xx] = 0;
      for (let yy = Math.floor(y); yy < y + ph; yy++) for (let xx = Math.floor(x); xx < x + gap; xx++) if (yy >= 0 && yy < size && xx >= 0 && xx < size) height[yy * size + xx] = 0;
    }
  }
  const out = { map: toTexture(c), normalMap: toTexture(normalMapFromHeight(height, size, 1.2), { srgb: false }), metres };
  cache.set(key, out); return out;
}

/** Street paving slabs (600×900 York-stone-ish). 1 tile = 3.6 m. */
export function pavingSlabs({ size = 1024, seed = 21, color = 0xa4a19b, metres = 3.6 } = {}) {
  const key = `paving:${size}:${seed}:${color}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size, size); const ctx = c.getContext('2d');
  const n = noiseField(size, { octaves: 5, seed, baseFreq: 5 });
  const img = ctx.createImageData(size, size); const d = img.data;
  for (let i = 0; i < size * size; i++) { const v = 0.75 + (n[i] - 0.5) * 0.5; const [r, g, b] = rgbMix(0x4a4844, color, v).match(/\d+/g).map(Number); d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  const rnd = mulberry32(seed);
  const sw = size * 0.6 / metres, sh = size * 0.9 / metres;
  ctx.strokeStyle = 'rgba(30,30,28,0.7)'; ctx.lineWidth = Math.max(1.5, size / 400);
  for (let r = 0; r * sh < size; r++) { ctx.beginPath(); ctx.moveTo(0, r * sh); ctx.lineTo(size, r * sh); ctx.stroke(); const off = (r % 2) * sw / 2; for (let k = 0; k * sw + off < size + sw; k++) { const x = k * sw + off; ctx.beginPath(); ctx.moveTo(x, r * sh); ctx.lineTo(x, (r + 1) * sh); ctx.stroke(); } }
  // grime and gum spots
  for (let i = 0; i < 200; i++) { ctx.fillStyle = `rgba(20,20,20,${rnd() * 0.35})`; ctx.beginPath(); ctx.arc(rnd() * size, rnd() * size, rnd() * 4 + 1, 0, Math.PI * 2); ctx.fill(); }
  const out = { map: toTexture(c), metres };
  cache.set(key, out); return out;
}

/** Tarmac road surface. 1 tile = 4 m. Optional lane markings drawn separately by the street module. */
export function tarmac({ size = 1024, seed = 33, color = 0x3b3b3c, metres = 4 } = {}) {
  const key = `tarmac:${size}:${seed}:${color}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size, size); const ctx = c.getContext('2d');
  const n = noiseField(size, { octaves: 5, seed, baseFreq: 4 });
  const img = ctx.createImageData(size, size); const d = img.data; const rnd = mulberry32(seed);
  const rough = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) { const v = 0.55 + (n[i] - 0.5) * 0.6 + (rnd() - 0.5) * 0.25; const [r, g, b] = rgbMix(0x1c1c1d, color, Math.max(0, Math.min(1, v))).match(/\d+/g).map(Number); d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; rough[i] = 0.8 + (n[i] - 0.5) * 0.2; }
  ctx.putImageData(img, 0, 0);
  const roughC = canvas(size, size); const rctx = roughC.getContext('2d'); const rimg = rctx.createImageData(size, size);
  for (let i = 0; i < rough.length; i++) { const v = (rough[i] * 255) | 0; rimg.data[i * 4] = v; rimg.data[i * 4 + 1] = v; rimg.data[i * 4 + 2] = v; rimg.data[i * 4 + 3] = 255; }
  rctx.putImageData(rimg, 0, 0);
  const out = { map: toTexture(c), roughnessMap: toTexture(roughC, { srgb: false }), metres };
  cache.set(key, out); return out;
}

/** Portland stone ashlar (Palace of Westminster / Elizabeth Tower). 1 tile = 4 m. */
export function ashlar({ size = 1024, seed = 41, color = 0xd9d2c1, dark = 0x8c8577, courseH = 0.45, blockW = 0.9, metres = 4, weathering = 0.5 } = {}) {
  const key = `ashlar:${size}:${seed}:${color}:${courseH}:${blockW}:${weathering}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size, size); const ctx = c.getContext('2d');
  const n = noiseField(size, { octaves: 5, seed, baseFreq: 3 });
  const img = ctx.createImageData(size, size); const d = img.data;
  for (let i = 0; i < size * size; i++) { const v = 0.85 - (n[i]) * 0.5 * weathering; const [r, g, b] = rgbMix(dark, color, Math.max(0, Math.min(1, v))).match(/\d+/g).map(Number); d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  const ch = size * courseH / metres, bw = size * blockW / metres; const height = new Float32Array(size * size).fill(1);
  ctx.strokeStyle = 'rgba(60,55,48,0.55)'; ctx.lineWidth = Math.max(1.5, size / 512);
  for (let r = 0; r * ch < size; r++) { ctx.beginPath(); ctx.moveTo(0, r * ch); ctx.lineTo(size, r * ch); ctx.stroke(); for (let x = 0; x < size; x++) height[Math.floor(r * ch) * size + x] = 0.2; const off = (r % 2) * bw / 2; for (let k = 0; k * bw + off < size + bw; k++) { const x = k * bw + off; ctx.beginPath(); ctx.moveTo(x, r * ch); ctx.lineTo(x, (r + 1) * ch); ctx.stroke(); } }
  const out = { map: toTexture(c), normalMap: toTexture(normalMapFromHeight(height, size, 1.0), { srgb: false }), metres };
  cache.set(key, out); return out;
}

/** Perforated / ribbed metal cladding (train interior ceiling, PED panels). */
export function perforated({ size = 256, pitch = 12, hole = 4, color = 0xdadcde } = {}) {
  const key = `perf:${size}:${pitch}:${hole}:${color}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size, size); const ctx = c.getContext('2d');
  ctx.fillStyle = hex(color); ctx.fillRect(0, 0, size, size); ctx.fillStyle = '#2a2b2d';
  for (let y = pitch / 2; y < size; y += pitch) for (let x = pitch / 2; x < size; x += pitch) { ctx.beginPath(); ctx.arc(x, y, hole / 2, 0, Math.PI * 2); ctx.fill(); }
  const out = { map: toTexture(c), metres: 0.25 };
  cache.set(key, out); return out;
}

/**
 * Seat moquette. 'barman' = the TfL Barman design (2010s) in the Jubilee / S-stock colourway:
 * charcoal/blue ground with red, blue, grey landmark motifs. Approximation.
 */
export function moquette({ size = 512, style = 'barman', seed = 77 } = {}) {
  const key = `moquette:${style}:${size}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size, size); const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  if (style === 'barman') {
    ctx.fillStyle = '#2f3a52'; ctx.fillRect(0, 0, size, size);
    const cols = ['#c8102e', '#8a94a6', '#3a5aa8', '#f2f2f2', '#1f2638', '#6d7b95'];
    const cell = size / 8;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const x = i * cell, y = j * cell;
      const r = rnd();
      ctx.fillStyle = cols[(i * 3 + j * 5) % cols.length];
      if (r < 0.35) ctx.fillRect(x + cell * 0.1, y + cell * 0.1, cell * 0.8, cell * 0.25);
      else if (r < 0.6) { ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, cell * 0.28, 0, Math.PI * 2); ctx.fill(); }
      else if (r < 0.8) ctx.fillRect(x + cell * 0.35, y + cell * 0.1, cell * 0.3, cell * 0.8);
      else { ctx.fillRect(x + cell * 0.1, y + cell * 0.4, cell * 0.8, cell * 0.2); ctx.fillStyle = cols[(i + j) % cols.length]; ctx.fillRect(x + cell * 0.3, y + cell * 0.15, cell * 0.4, cell * 0.7); }
    }
  } else { // 'jubilee1996' original blue/grey with pale flecks
    ctx.fillStyle = '#3c4b6e'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 3000; i++) { ctx.fillStyle = rnd() < 0.5 ? 'rgba(200,205,215,0.5)' : 'rgba(150,40,50,0.5)'; ctx.fillRect(rnd() * size, rnd() * size, 3, 3); }
  }
  // fabric weave overlay
  for (let y = 0; y < size; y += 2) { ctx.fillStyle = y % 4 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.06)'; ctx.fillRect(0, y, size, 1); }
  const out = { map: toTexture(c), metres: 0.5 };
  cache.set(key, out); return out;
}

// ---------- SIGNAGE ----------

export const SIGN_FONT = "'Johnston', 'Johnston100', 'Gill Sans', 'Gill Sans MT', 'Hammersmith One', 'Helvetica Neue', Helvetica, Arial, 'DejaVu Sans', sans-serif";

/** Draw a London Underground roundel into a canvas context, centred at (cx,cy), ring outer radius r. Bar text optional. */
export function drawRoundel(ctx, cx, cy, r, { text = 'UNDERGROUND', ringColor = '#dc241f', barColor = '#0019a8', textColor = '#ffffff', barWidthFactor = 2.1, ringWidthFactor = 0.32 } = {}) {
  const ringW = r * ringWidthFactor;
  ctx.save();
  ctx.lineWidth = ringW; ctx.strokeStyle = ringColor;
  ctx.beginPath(); ctx.arc(cx, cy, r - ringW / 2, 0, Math.PI * 2); ctx.stroke();
  const barH = r * 0.5, barW = r * barWidthFactor;
  ctx.fillStyle = barColor; ctx.fillRect(cx - barW / 2, cy - barH / 2, barW, barH);
  if (text) {
    ctx.fillStyle = textColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fs = barH * 0.66; ctx.font = `bold ${fs}px ${SIGN_FONT}`;
    while (ctx.measureText(text).width > barW * 0.92 && fs > 4) { fs -= 1; ctx.font = `bold ${fs}px ${SIGN_FONT}`; }
    ctx.fillText(text, cx, cy + fs * 0.05);
  }
  ctx.restore();
}

/** A stand-alone roundel texture (transparent background). */
export function roundel({ size = 512, text = 'UNDERGROUND', ringColor, barColor, textColor, background = null } = {}) {
  const key = `roundel:${size}:${text}:${ringColor}:${barColor}:${background}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size, size); const ctx = c.getContext('2d');
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, size, size); }
  drawRoundel(ctx, size / 2, size / 2, size * 0.46, { text, ringColor, barColor, textColor });
  const t = toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
  cache.set(key, t); return t;
}

/** Draw a left/right/up/down arrow (TfL style thick arrow) into ctx. dir: 'left'|'right'|'up'|'down'|'upleft'|'upright'|'downleft'|'downright' */
export function drawArrow(ctx, cx, cy, s, dir = 'left', color = '#fff') {
  const angles = { right: 0, downright: 45, down: 90, downleft: 135, left: 180, upleft: 225, up: 270, upright: 315 };
  ctx.save(); ctx.translate(cx, cy); ctx.rotate((angles[dir] || 0) * Math.PI / 180);
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(s * 0.5, 0); ctx.lineTo(s * 0.05, -s * 0.45); ctx.lineTo(s * 0.05, -s * 0.16); ctx.lineTo(-s * 0.5, -s * 0.16); ctx.lineTo(-s * 0.5, s * 0.16); ctx.lineTo(s * 0.05, s * 0.16); ctx.lineTo(s * 0.05, s * 0.45); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** Draw a coloured line "pill" (e.g. [District] with name) used on directional signs. Returns width used. */
export function drawLinePill(ctx, x, y, h, name, color, { textColor = '#fff', font = SIGN_FONT } = {}) {
  ctx.save();
  ctx.font = `bold ${h * 0.62}px ${font}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const tw = ctx.measureText(name).width; const w = tw + h * 0.6;
  ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = textColor; ctx.fillText(name, x + h * 0.3, y + h / 2 + h * 0.03);
  ctx.restore();
  return w;
}

/**
 * Generic TfL sign generator.
 * spec: { width, height (px), bg, lines: [ { text, color, size, weight, align, x, y, font } ... ],
 *         arrows: [ {dir, x, y, size, color} ], pills: [ {name, color, x, y, h} ], roundels: [ {x,y,r,text} ], border }
 * Coordinates are in px; convenience: omit x/y in lines to auto-stack.
 */
export function sign(spec) {
  const { width = 1024, height = 256, bg = '#113b92', border = null } = spec;
  const key = 'sign:' + JSON.stringify(spec);
  if (cache.has(key)) return cache.get(key);
  const c = canvas(width, height); const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  if (border) { ctx.strokeStyle = border.color || '#fff'; ctx.lineWidth = border.width || 6; ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth); }
  (spec.fills || []).forEach(f => { ctx.fillStyle = f.color; ctx.fillRect(f.x, f.y, f.w, f.h); });
  (spec.roundels || []).forEach(r => drawRoundel(ctx, r.x, r.y, r.r, r));
  (spec.pills || []).forEach(p => drawLinePill(ctx, p.x, p.y, p.h, p.name, p.color, p));
  (spec.arrows || []).forEach(a => drawArrow(ctx, a.x, a.y, a.size, a.dir, a.color || '#fff'));
  const lines = spec.lines || [];
  let cursorY = spec.padding ?? height * 0.15;
  lines.forEach(l => {
    const size = l.size || height * 0.35; const weight = l.weight || 'bold';
    ctx.font = `${weight} ${size}px ${l.font || SIGN_FONT}`; ctx.fillStyle = l.color || '#ffffff';
    ctx.textAlign = l.align || 'left'; ctx.textBaseline = 'alphabetic';
    const x = l.x ?? (l.align === 'center' ? width / 2 : l.align === 'right' ? width - (spec.paddingX ?? width * 0.04) : (spec.paddingX ?? width * 0.04));
    const y = l.y ?? (cursorY + size * 0.85);
    if (l.letterSpacing) ctx.letterSpacing = l.letterSpacing;
    ctx.fillText(l.text, x, y);
    ctx.letterSpacing = '0px';
    if (l.y == null) cursorY += size * (l.lineHeight || 1.25);
  });
  const t = toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
  cache.set(key, t); return t;
}

/** Quick helper: a blue directional sign with an arrow and text lines. */
export function directionSign({ text, sub = null, arrow = 'left', width = 1024, height = 256, bg = '#113b92', pills = [] }) {
  const s = height * 0.55; const ax = arrow === 'right' ? width - s * 0.7 : s * 0.7;
  const tx = arrow === 'right' ? width * 0.05 : s * 1.35;
  const lines = [{ text, x: tx, y: sub ? height * 0.45 : height * 0.63, size: sub ? height * 0.36 : height * 0.42 }];
  if (sub) lines.push({ text: sub, x: tx, y: height * 0.82, size: height * 0.26, weight: 'normal' });
  return sign({ width, height, bg, lines, arrows: [{ dir: arrow, x: ax, y: height / 2, size: s }], pills });
}

/** Yellow-on-black? No: LU 'Way out' signs are white text on blue with the words in yellow. */
export function wayOutSign({ arrow = 'left', width = 1024, height = 256, extra = null } = {}) {
  const s = height * 0.55; const ax = arrow === 'right' ? width - s * 0.7 : s * 0.7; const tx = arrow === 'right' ? width * 0.05 : s * 1.35;
  const lines = [{ text: 'Way out', x: tx, y: extra ? height * 0.5 : height * 0.66, size: extra ? height * 0.4 : height * 0.5, color: '#ffd300' }];
  if (extra) lines.push({ text: extra, x: tx, y: height * 0.85, size: height * 0.24, weight: 'normal' });
  return sign({ width, height, bg: '#113b92', lines, arrows: [{ dir: arrow, x: ax, y: height / 2, size: s, color: '#ffd300' }] });
}

/** The white platform name board: roundel with the station name in the bar, on a plain background. */
export function stationNameBoard({ name = 'WESTMINSTER', width = 1024, height = 512, bg = '#ffffff' } = {}) {
  return sign({ width, height, bg, roundels: [{ x: width / 2, y: height / 2, r: height * 0.42, text: name, barWidthFactor: 3.4 }], lines: [] });
}

/**
 * Updatable dot-matrix display (orange LEDs on black) using an authentic 5x7 LED font, e.g. platform next-train indicators.
 * cols = LED columns, rows = text rows. set(lines) where a line is a string or {left, right} (right-aligned second part, e.g. "2 min").
 * Returns { texture, canvas, set(lines, {scroll}), width, height, aspect, cols }.
 */
export function dotMatrix({ cols = 120, rows = 3, dot = 6, gap = 2, color = '#ff8a00', dim = '#241200', lineGap = 3 } = {}) {
  const pitch = dot + gap; const ledRows = rows * (DOT.GLYPH_H + lineGap) - lineGap;
  const width = cols * pitch + gap, height = ledRows * pitch + gap;
  const c = canvas(width, height); const ctx = c.getContext('2d');
  const tex = toTexture(c, { wrap: THREE.ClampToEdgeWrapping }); tex.minFilter = THREE.LinearFilter;
  function set(lines, { scroll = 0 } = {}) {
    ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, width, height);
    const grids = [];
    for (let i = 0; i < rows; i++) {
      const ln = lines[i]; if (ln == null) { grids.push(null); continue; }
      if (typeof ln === 'string') grids.push(DOT.rasterise(ln, cols, DOT.GLYPH_H, { offsetX: -Math.round(scroll) }).grid);
      else { const g = DOT.rasterise(ln.left || '', cols).grid; if (ln.right) { const rw = DOT.textWidth(ln.right); const rg = DOT.rasterise(ln.right, cols, DOT.GLYPH_H, { offsetX: cols - rw }).grid; for (let k = 0; k < g.length; k++) if (rg[k]) g[k] = 1; } grids.push(g); }
    }
    for (let row = 0; row < rows; row++) {
      const g = grids[row]; const y0 = row * (DOT.GLYPH_H + lineGap);
      for (let r = 0; r < DOT.GLYPH_H; r++) for (let x = 0; x < cols; x++) {
        const on = g && g[r * cols + x]; ctx.fillStyle = on ? color : dim;
        const px = gap + x * pitch + dot / 2, py = gap + (y0 + r) * pitch + dot / 2;
        ctx.beginPath(); ctx.arc(px, py, dot / 2 * (on ? 1 : 0.8), 0, Math.PI * 2); ctx.fill();
        if (on) { ctx.fillStyle = 'rgba(255,200,120,0.35)'; ctx.beginPath(); ctx.arc(px, py, dot * 0.28, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    tex.needsUpdate = true;
  }
  set([]);
  return { texture: tex, canvas: c, set, width, height, aspect: width / height, cols, rows };
}

/**
 * Updatable LCD/LED strip display used inside trains ("This is Westminster"). White/orange text on black.
 */
export function ledStrip({ width = 1024, height = 96, color = '#ff9a1e', font = SIGN_FONT } = {}) {
  const c = canvas(width, height); const ctx = c.getContext('2d');
  const tex = toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
  function set(text, { align = 'center' } = {}) {
    ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = color; ctx.font = `bold ${height * 0.62}px ${font}`; ctx.textBaseline = 'middle'; ctx.textAlign = align;
    ctx.fillText(text, align === 'center' ? width / 2 : 16, height / 2 + 2);
    tex.needsUpdate = true;
  }
  set('');
  return { texture: tex, canvas: c, set };
}

/** Simple horizontal line diagram (as above train windows): coloured line with station ticks & names. */
export function lineDiagram({ line = 'District', color = '#00782a', stations = [], current = 'Westminster', width = 2048, height = 256, bg = '#ffffff' } = {}) {
  const key = `linediag:${line}:${stations.join('|')}:${current}:${width}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(width, height); const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  const y = height * 0.68; const x0 = width * 0.04, x1 = width * 0.96; const n = Math.max(1, stations.length - 1);
  ctx.strokeStyle = color; ctx.lineWidth = height * 0.09; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  ctx.font = `bold ${height * 0.12}px ${SIGN_FONT}`; ctx.fillStyle = '#000';
  stations.forEach((s, i) => {
    const x = x0 + (x1 - x0) * i / n;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = color; ctx.lineWidth = height * 0.035; ctx.beginPath(); ctx.arc(x, y, height * 0.06, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (s === current) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, height * 0.035, 0, Math.PI * 2); ctx.fill(); }
    ctx.save(); ctx.translate(x, y - height * 0.11); ctx.rotate(-Math.PI / 4); ctx.fillStyle = '#000'; ctx.textAlign = 'left'; ctx.font = `${s === current ? 'bold' : 'normal'} ${height * 0.11}px ${SIGN_FONT}`; ctx.fillText(s, 0, 0); ctx.restore();
  });
  ctx.fillStyle = color; ctx.fillRect(0, height * 0.9, width, height * 0.1);
  ctx.fillStyle = '#fff'; ctx.font = `bold ${height * 0.075}px ${SIGN_FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(`${line} line`, width * 0.02, height * 0.95);
  const t = toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
  cache.set(key, t); return t;
}

/** Advertising poster placeholder: coloured abstract layout with a headline (no real brands). */
export function poster({ width = 512, height = 768, seed = 1, headline = 'London', sub = 'See more of it', hue = null } = {}) {
  const key = `poster:${seed}:${headline}:${sub}:${hue}`;
  if (cache.has(key)) return cache.get(key);
  const rnd = mulberry32(seed + 100);
  const c = canvas(width, height); const ctx = c.getContext('2d');
  const h = hue ?? Math.floor(rnd() * 360);
  const g = ctx.createLinearGradient(0, 0, width, height); g.addColorStop(0, `hsl(${h},60%,45%)`); g.addColorStop(1, `hsl(${(h + 40) % 360},55%,25%)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 6; i++) { ctx.fillStyle = `hsla(${(h + 180 + i * 20) % 360},70%,60%,0.35)`; ctx.beginPath(); ctx.arc(rnd() * width, rnd() * height, rnd() * width * 0.4 + 40, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#fff'; ctx.font = `bold ${width * 0.13}px ${SIGN_FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(headline, width * 0.08, height * 0.78);
  ctx.font = `normal ${width * 0.06}px ${SIGN_FONT}`; ctx.fillText(sub, width * 0.08, height * 0.86);
  const t = toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
  cache.set(key, t); return t;
}

/** Scale a geometry's UVs so that a texture with `metres` metres-per-tile tiles correctly over a face of given world size. */
export function scaleUVs(geometry, sx, sy) {
  const uv = geometry.attributes.uv; if (!uv) return geometry;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  uv.needsUpdate = true; return geometry;
}

/** Box geometry whose UVs are in world metres (so materials with `metres` tile correctly on every face). */
export function boxGeometryMetric(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv; const pos = g.attributes.position; const nrm = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (nx > 0.5) uv.setXY(i, z, y); else if (ny > 0.5) uv.setXY(i, x, z); else uv.setXY(i, x, y);
  }
  uv.needsUpdate = true; return g;
}

/** Plane geometry with metric UVs (width w along x, height h along y). */
export function planeGeometryMetric(w, h) {
  const g = new THREE.PlaneGeometry(w, h);
  return scaleUVs(g, w, h);
}
