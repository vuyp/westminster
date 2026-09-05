// ---------------------------------------------------------------------------
// boxKit.js — helpers private to the Jubilee box modules (jubileeBox.js and
// boxStructure.js): the box's own materials (Suregrip chequer plate, the two
// concrete tints, the blue mosaic band, satin-grey steel, aluminium cladding,
// perforated stainless), the JLE dark-family sign faces with the dossier's
// exact wordings, an escalator geometry "frame" (so the structure can be kept
// clear of the flying banks), and merged-geometry builders (tubes, boxes,
// profile ribbons) with metric UVs so the shared materials tile in metres.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE, JUBILEE } from '../core/layout.js';

const matCache = new Map();
function cached(key, make) { if (!matCache.has(key)) matCache.set(key, make()); return matCache.get(key); }
export function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }
function shade(c, k) { const r = Math.min(255, ((c >> 16) & 255) * k), g = Math.min(255, ((c >> 8) & 255) * k), b = Math.min(255, (c & 255) * k); return `rgb(${r | 0},${g | 0},${b | 0})`; }

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
export function makeMaterials(ctx) {
  const { M, T } = ctx;
  return {
    /** Recessed diaphragm-wall cell backs: earth-cast, pitted, browner (dossier #7f7c76). */
    diaphragm: cached('box:diaphragm', () => diaphragmConcrete(T)),
    /** The buttress / waling grillage, columns and collars: smoother pale warm grey with water-stain streaks (#9c9b96). */
    grillage: cached('box:grillage', () => grillageConcrete(T)),
    /** Slab soffits, downstand beams, stair flights. */
    precast: M.precast({ base: 0xa9a7a2 }),
    baseSlab: M.concrete({ base: 0x8f8d88, dark: 0x5f5d59, seed: 31, stain: 0.5, boardMarks: false, tieHoles: false }),
    /** All box steelwork: satin mid-grey, slightly bluer than the concrete (#8a8d8f). */
    steel: M.paint(PALETTE.steelGrey, { roughness: 0.42, metalness: 0.55 }),
    steelDark: M.paint(0x6f7274, { roughness: 0.5, metalness: 0.5 }),
    /** Escalator soffit / side cladding: light-grey aluminium panels (#b9bbb9); double-sided so thin ribbons read from any angle. */
    clad: cached('box:clad', () => new THREE.MeshStandardMaterial({ color: PALETTE.escalatorClad, roughness: 0.5, metalness: 0.35, side: THREE.DoubleSide })),
    cladRib: M.paint(0x7d8082, { roughness: 0.5, metalness: 0.5 }),
    stainless: M.stainless(),
    stainlessV: M.stainless({ vertical: true }),
    tieRod: M.paint(0xd2d4d6, { roughness: 0.3, metalness: 0.9 }),
    /** Suregrip electropolished chequer plate — interchange and walkway floors. */
    chequer: cached('box:chequer', () => chequerPlate(T)),
    /** Light-grey terrazzo (well landings, stair lobbies). */
    terrazzo: cached('box:terrazzo', () => terrazzo(T)),
    /** 300 mm dark-blue mosaic band on the columns, balustrade stripe, bin band. */
    mosaic: cached('box:mosaic', () => M.tiles({ color: PALETTE.blueMosaic, grout: 0x0e1c45, tileW: 0.025, tileH: 0.025, seed: 5 })),
    blueBand: M.paint(PALETTE.blueMosaic, { roughness: 0.4, metalness: 0.1 }),
    /** Perforated stainless balustrade sheet (round holes). */
    perfPanel: cached('box:perf', () => { const tex = T.perforated({ size: 256, pitch: 12, hole: 5, color: 0xc6c8ca }); const m = new THREE.MeshStandardMaterial({ map: tex.map.clone(), color: 0xffffff, roughness: 0.42, metalness: 0.7, side: THREE.DoubleSide }); m.map.repeat.set(1 / tex.metres, 1 / tex.metres); m.map.needsUpdate = true; m.userData.metres = tex.metres; return m; }),
    glass: M.glass({ color: 0xd8e2ea, opacity: 0.22, roughness: 0.04 }),
    glassLift: M.glass({ color: 0xcfdde8, opacity: 0.3, roughness: 0.03 }),
    lum: M.luminaire(0xf4f3ec, 2.3),
    lumCool: M.luminaire(0xe9f0ff, 2.6),
    lumWarm: M.luminaire(0xfff0d6, 1.8),
    lumStrip: M.luminaire(0xf6f4ea, 1.7),
    black: M.paint(0x141517, { roughness: 0.6, metalness: 0.2 }),
    darkGrey: M.paint(0x3a3c3f, { roughness: 0.7, metalness: 0.2 }),
    white: M.paint(0xe9e9e6, { roughness: 0.5 }),
    red: M.paint(0xc8102e, { roughness: 0.4, metalness: 0.2 }),
    green: M.paint(0x009639, { roughness: 0.5 }),
    yellow: M.paint(0xf2c500, { roughness: 0.6 }),
    rubber: M.rubber(0x1a1a1a),
    cable: M.paint(0x2c2d2f, { roughness: 0.85 }),
    pipeRed: M.paint(0xb3261e, { roughness: 0.45, metalness: 0.3 }),
    galv: M.paint(0x9da3a6, { roughness: 0.55, metalness: 0.6 }),
    nosing: M.paint(0xd8d9d5, { roughness: 0.5, metalness: 0.3 }),
    grime: cached('box:grime', () => { const m = new THREE.MeshStandardMaterial({ color: 0x141210, transparent: true, opacity: 0.1, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }); return m; }),
  };
}

/** Rough, pock-marked diaphragm-wall face: value noise + thousands of pits + horizontal pour lines. 1 tile = 4 m. */
function diaphragmConcrete(T) {
  const size = 1024, metres = 4; const c = T.canvas(size, size); const g = c.getContext('2d');
  const n = T.noiseField(size, { octaves: 6, seed: 41, baseFreq: 3 }); const n2 = T.noiseField(size, { octaves: 3, seed: 52, baseFreq: 18, gain: 0.6 });
  const img = g.createImageData(size, size); const d = img.data; const height = new Float32Array(size * size);
  const base = PALETTE.concreteDark, dark = 0x56534e;
  const br = (base >> 16) & 255, bg = (base >> 8) & 255, bb = base & 255, dr = (dark >> 16) & 255, dg = (dark >> 8) & 255, db = dark & 255;
  for (let i = 0; i < size * size; i++) { let v = 0.55 + (n[i] - 0.5) * 0.9 + (n2[i] - 0.5) * 0.35; v = Math.min(1, Math.max(0, v)); d[i * 4] = dr + (br - dr) * v; d[i * 4 + 1] = dg + (bg - dg) * v; d[i * 4 + 2] = db + (bb - db) * v; d[i * 4 + 3] = 255; height[i] = v * 0.5 + (n2[i] - 0.5) * 0.5; }
  g.putImageData(img, 0, 0);
  const rnd = T.mulberry32(77);
  // pits and bleed marks from the slurry trench, plus a few horizontal pour joints
  for (let i = 0; i < 2600; i++) { const x = rnd() * size, y = rnd() * size, r = 1.5 + rnd() * 7; g.fillStyle = `rgba(35,32,28,${0.25 + rnd() * 0.5})`; g.beginPath(); g.ellipse(x, y, r, r * (0.5 + rnd() * 0.6), rnd() * Math.PI, 0, Math.PI * 2); g.fill(); for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) { const dd = Math.hypot(xx - x, yy - y) / r; if (dd < 1 && xx >= 0 && yy >= 0 && xx < size && yy < size) height[yy * size + xx] -= (1 - dd) * 0.8; } }
  for (let i = 0; i < 4; i++) { const y = (i + 0.5) * size / 4 + (rnd() - 0.5) * 40; g.fillStyle = 'rgba(30,28,25,0.35)'; g.fillRect(0, y, size, 3 + rnd() * 3); g.fillStyle = 'rgba(200,196,188,0.12)'; g.fillRect(0, y + 5, size, 2); for (let x = 0; x < size; x++) height[Math.floor(y) * size + x] -= 0.6; }
  // rust-brown bleed streaks
  for (let i = 0; i < 60; i++) { const x = rnd() * size, y = rnd() * size, h = 40 + rnd() * 260; const grad = g.createLinearGradient(0, y, 0, y + h); grad.addColorStop(0, `rgba(90,60,40,${0.18 + rnd() * 0.2})`); grad.addColorStop(1, 'rgba(90,60,40,0)'); g.fillStyle = grad; g.fillRect(x, y, 2 + rnd() * 6, h); }
  const map = T.toTexture(c); const nrm = T.toTexture(T.normalMapFromHeight(height, size, 3.2), { srgb: false });
  map.repeat.set(1 / metres, 1 / metres); nrm.repeat.set(1 / metres, 1 / metres);
  const m = new THREE.MeshStandardMaterial({ map, normalMap: nrm, roughness: 0.98, metalness: 0, normalScale: new THREE.Vector2(0.9, 0.9) }); m.userData.metres = metres; return m;
}

/** Smooth, glittery fair-faced grillage concrete with mottling, tie holes and dark water-stain streaks. 1 tile = 4 m. */
function grillageConcrete(T) {
  const size = 1024, metres = 4; const c = T.canvas(size, size); const g = c.getContext('2d');
  const n = T.noiseField(size, { octaves: 5, seed: 7, baseFreq: 3 }); const n2 = T.noiseField(size, { octaves: 3, seed: 18, baseFreq: 12, gain: 0.55 });
  const img = g.createImageData(size, size); const d = img.data; const height = new Float32Array(size * size); const rough = new Float32Array(size * size);
  const base = PALETTE.concrete, dark = 0x6e6c67;
  const br = (base >> 16) & 255, bg = (base >> 8) & 255, bb = base & 255, dr = (dark >> 16) & 255, dg = (dark >> 8) & 255, db = dark & 255;
  const rnd = T.mulberry32(9);
  for (let i = 0; i < size * size; i++) { let v = 0.66 + (n[i] - 0.5) * 0.4 + (n2[i] - 0.5) * 0.14; v = Math.min(1, Math.max(0, v)); d[i * 4] = dr + (br - dr) * v; d[i * 4 + 1] = dg + (bg - dg) * v; d[i * 4 + 2] = db + (bb - db) * v; d[i * 4 + 3] = 255; height[i] = v * 0.3; rough[i] = 0.7 + (1 - v) * 0.2; }
  g.putImageData(img, 0, 0);
  // mica glitter: tiny bright specks
  for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(255,255,250,${0.15 + rnd() * 0.35})`; g.fillRect(rnd() * size, rnd() * size, 1, 1); }
  // formwork tie holes on a 1 m grid with dark run-off streaks beneath (water staining)
  const pitch = size / metres;
  for (let gy = 0.5; gy < metres; gy += 1) for (let gx = 0.5; gx < metres; gx += 1) {
    const cx = gx * pitch + (rnd() - 0.5) * 6, cy = gy * pitch + (rnd() - 0.5) * 6, rad = pitch * 0.026;
    const grd = g.createRadialGradient(cx, cy, rad * 0.2, cx, cy, rad); grd.addColorStop(0, 'rgba(38,36,34,0.95)'); grd.addColorStop(0.75, 'rgba(70,68,64,0.8)'); grd.addColorStop(1, 'rgba(120,118,112,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.fill();
    for (let yy = Math.floor(cy - rad); yy <= cy + rad; yy++) for (let xx = Math.floor(cx - rad); xx <= cx + rad; xx++) { const dd = Math.hypot(xx - cx, yy - cy) / rad; if (dd < 1 && xx >= 0 && yy >= 0 && xx < size && yy < size) height[yy * size + xx] -= (1 - dd) * 1.0; }
    const len = pitch * (0.6 + rnd() * 1.6); const sg = g.createLinearGradient(0, cy, 0, cy + len); sg.addColorStop(0, `rgba(50,48,45,${0.25 + rnd() * 0.2})`); sg.addColorStop(1, 'rgba(50,48,45,0)');
    g.fillStyle = sg; g.fillRect(cx - rad * 0.5, cy, rad, len);
  }
  // broad dark streaks running down from random points (leaching from the walings above)
  for (let i = 0; i < 26; i++) { const x = rnd() * size, y = rnd() * size * 0.6, h = 120 + rnd() * 500, w = 6 + rnd() * 26; const sg = g.createLinearGradient(0, y, 0, y + h); sg.addColorStop(0, `rgba(45,44,42,${0.1 + rnd() * 0.22})`); sg.addColorStop(1, 'rgba(45,44,42,0)'); g.fillStyle = sg; g.fillRect(x, y, w, h); }
  // pale efflorescence patches
  for (let i = 0; i < 14; i++) { const x = rnd() * size, y = rnd() * size, r = 20 + rnd() * 60; const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(230,228,220,0.16)'); rg.addColorStop(1, 'rgba(230,228,220,0)'); g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  const rc = T.canvas(size, size); const rctx = rc.getContext('2d'); const rimg = rctx.createImageData(size, size);
  for (let i = 0; i < rough.length; i++) { const v = Math.min(255, Math.max(0, rough[i] * 255)) | 0; rimg.data[i * 4] = v; rimg.data[i * 4 + 1] = v; rimg.data[i * 4 + 2] = v; rimg.data[i * 4 + 3] = 255; }
  rctx.putImageData(rimg, 0, 0);
  const map = T.toTexture(c); const nrm = T.toTexture(T.normalMapFromHeight(height, size, 1.8), { srgb: false }); const roughT = T.toTexture(rc, { srgb: false });
  for (const t of [map, nrm, roughT]) t.repeat.set(1 / metres, 1 / metres);
  const m = new THREE.MeshStandardMaterial({ map, normalMap: nrm, roughnessMap: roughT, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.55, 0.55) }); m.userData.metres = metres; return m;
}

/** Electropolished stainless Suregrip chequer plate: raised tear-drop treads on a 5-bar pattern + a few laser-cut slots. 1 tile = 0.5 m. */
function chequerPlate(T) {
  const size = 512, metres = 0.5; const c = T.canvas(size, size); const g = c.getContext('2d');
  const height = new Float32Array(size * size);
  g.fillStyle = '#b9bcbe'; g.fillRect(0, 0, size, size);
  const rnd = T.mulberry32(3);
  // brushed grain
  for (let i = 0; i < 1400; i++) { const y = rnd() * size; g.strokeStyle = rnd() < 0.5 ? `rgba(255,255,255,${rnd() * 0.12})` : `rgba(0,0,0,${rnd() * 0.12})`; g.lineWidth = 1; g.beginPath(); const x = rnd() * size; g.moveTo(x, y); g.lineTo(x + rnd() * 200, y); g.stroke(); }
  // tear-drop treads: 5 bars per 28 mm cell, alternating 0/90° every cell (classic 5-bar Durbar/Suregrip look)
  const cell = size / (metres / 0.028) * 1; // px per 28 mm cell ≈ 28.7 px
  const cells = Math.round(size / cell);
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
    const x0 = i * cell, y0 = j * cell; const vert = (i + j) % 2 === 0;
    for (let k = 0; k < 5; k++) {
      const off = (k + 0.5) * cell / 5; const len = cell * 0.62, w = cell * 0.09;
      const cx = vert ? x0 + off : x0 + cell / 2, cy = vert ? y0 + cell / 2 : y0 + off;
      g.save(); g.translate(cx, cy); if (!vert) g.rotate(Math.PI / 2);
      const grad = g.createLinearGradient(-w, 0, w, 0); grad.addColorStop(0, '#e6e8ea'); grad.addColorStop(0.5, '#cfd2d4'); grad.addColorStop(1, '#7d8184');
      g.fillStyle = grad; g.beginPath(); g.ellipse(0, 0, w, len / 2, 0, 0, Math.PI * 2); g.fill(); g.restore();
      for (let yy = Math.floor(cy - len / 2); yy <= cy + len / 2; yy++) for (let xx = Math.floor(cx - len / 2); xx <= cx + len / 2; xx++) {
        const dx = vert ? (xx - cx) / w : (yy - cy) / w, dy = vert ? (yy - cy) / (len / 2) : (xx - cx) / (len / 2); const dd = dx * dx + dy * dy;
        if (dd < 1 && xx >= 0 && yy >= 0 && xx < size && yy < size) height[yy * size + xx] = Math.max(height[yy * size + xx], Math.sqrt(1 - dd));
      }
    }
  }
  // panel joints every 0.5 m (tile edge) and countersunk fixings at the corners
  g.strokeStyle = 'rgba(40,42,44,0.7)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, size - 3, size - 3);
  for (let y = 0; y < size; y++) { height[y * size] = -0.6; height[y * size + size - 1] = -0.6; } for (let x = 0; x < size; x++) { height[x] = -0.6; height[(size - 1) * size + x] = -0.6; }
  for (const [x, y] of [[18, 18], [size - 18, 18], [18, size - 18], [size - 18, size - 18]]) { g.fillStyle = '#6d7073'; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = '#a4a7a9'; g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill(); }
  // scuffs / grime in the tread valleys
  for (let i = 0; i < 240; i++) { g.fillStyle = `rgba(30,30,28,${rnd() * 0.18})`; g.beginPath(); g.ellipse(rnd() * size, rnd() * size, 1 + rnd() * 5, 1 + rnd() * 2, rnd() * Math.PI, 0, Math.PI * 2); g.fill(); }
  const map = T.toTexture(c); const nrm = T.toTexture(T.normalMapFromHeight(height, size, 3.5), { srgb: false });
  map.repeat.set(1 / metres, 1 / metres); nrm.repeat.set(1 / metres, 1 / metres);
  const m = new THREE.MeshStandardMaterial({ map, normalMap: nrm, roughness: 0.4, metalness: 0.82, envMapIntensity: 1.1, normalScale: new THREE.Vector2(0.8, 0.8) }); m.userData.metres = metres; return m;
}

/** Light-grey speckled terrazzo (#c8c8c3) with 600 mm joints. 1 tile = 2.4 m. */
function terrazzo(T) {
  const size = 1024, metres = 2.4; const c = T.canvas(size, size); const g = c.getContext('2d');
  const rnd = T.mulberry32(11); const n = T.noiseField(size, { octaves: 4, seed: 14, baseFreq: 5 });
  const img = g.createImageData(size, size); const d = img.data; const base = 0xbdbdb8; const br = (base >> 16) & 255, bg = (base >> 8) & 255, bb = base & 255;
  for (let i = 0; i < size * size; i++) { const v = (n[i] - 0.5) * 16; d[i * 4] = br + v; d[i * 4 + 1] = bg + v; d[i * 4 + 2] = bb + v; d[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 14000; i++) { const s = rnd(); g.fillStyle = s < 0.1 ? '#e9e9e4' : s < 0.3 ? '#6f7173' : s < 0.55 ? '#95979a' : s < 0.7 ? '#55575a' : '#aaaba8'; g.globalAlpha = 0.35 + rnd() * 0.45; g.beginPath(); g.ellipse(rnd() * size, rnd() * size, 0.8 + rnd() * 2.2, 0.8 + rnd() * 1.6, rnd() * Math.PI, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1; const px = size / 4; g.strokeStyle = 'rgba(40,40,38,0.35)'; g.lineWidth = 2;
  for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * px, 0); g.lineTo(k * px, size); g.stroke(); g.beginPath(); g.moveTo(0, k * px); g.lineTo(size, k * px); g.stroke(); }
  const rc = T.canvas(size, size); const rg = rc.getContext('2d'); rg.fillStyle = '#6e6e6e'; rg.fillRect(0, 0, size, size);
  for (let i = 0; i < 1200; i++) { rg.fillStyle = `rgba(${rnd() < 0.5 ? 40 : 150},${rnd() < 0.5 ? 40 : 150},${rnd() < 0.5 ? 40 : 150},0.14)`; rg.beginPath(); rg.arc(rnd() * size, rnd() * size, 2 + rnd() * 34, 0, Math.PI * 2); rg.fill(); }
  const map = T.toTexture(c); const rough = T.toTexture(rc, { srgb: false }); map.repeat.set(1 / metres, 1 / metres); rough.repeat.set(1 / metres, 1 / metres);
  const m = new THREE.MeshStandardMaterial({ map, roughnessMap: rough, roughness: 0.72, metalness: 0.02 }); m.userData.metres = metres; return m;
}

// ---------------------------------------------------------------------------
// Sign faces — the JLE dark family (black panels, white Johnston, yellow 'Way out'), dossier §12.4/§12.5/§12.7.
// ---------------------------------------------------------------------------
const BLACK = '#101113', GREY = '#a0a5a9', YELLOW = '#ffd300', GREEN = '#00782a', WHITE = '#ffffff';
export function makeSigns(ctx) {
  const T = ctx.T;
  const upper = JUBILEE.upper, lower = JUBILEE.lower;
  const towards = (p) => p.towards.join(', ');
  /** 'Jubilee line ↑ Eastbound platform 3 — Waterloo, London Bridge, Canary Wharf, Stratford' (grey pill). arrow: any drawArrow dir. */
  const jubileeDir = (which, arrow = 'up', { width = 2048, height = 512 } = {}) => {
    const p = which === 'upper' ? upper : lower; const dirName = p.direction === 'eastbound' ? 'Eastbound' : 'Westbound';
    const ax = 190; const tx = 340;
    return T.sign({ width, height, bg: BLACK, pills: [{ name: 'Jubilee line', color: GREY, x: tx, y: 58, h: 88 }],
      arrows: [{ dir: arrow, x: ax, y: height * 0.42, size: 220, color: WHITE }],
      lines: [{ text: `${dirName} platform ${p.number}`, x: tx, y: 300, size: 132, color: WHITE }, { text: towards(p), x: tx, y: 430, size: 72, color: '#e6e8ea', weight: 'normal' }] });
  };
  /** Both Jubilee platforms on one panel (used at the head of the void: ↓ platform 3 / ↓ platform 4). */
  const jubileeBoth = (arrow = 'down', { width = 2048, height = 640 } = {}) => T.sign({ width, height, bg: BLACK,
    pills: [{ name: 'Jubilee line', color: GREY, x: 340, y: 50, h: 88 }], arrows: [{ dir: arrow, x: 190, y: 330, size: 240, color: WHITE }],
    lines: [{ text: `Eastbound platform ${upper.number}`, x: 340, y: 260, size: 110, color: WHITE }, { text: towards(upper), x: 340, y: 340, size: 56, color: '#e6e8ea', weight: 'normal' },
      { text: `Westbound platform ${lower.number}`, x: 340, y: 470, size: 110, color: WHITE }, { text: towards(lower), x: 340, y: 550, size: 56, color: '#e6e8ea', weight: 'normal' }] });
  /** 'Way out' in yellow with a yellow arrow; optional second line (e.g. 'District and Circle lines'). */
  const wayOut = (arrow = 'up', extra = null, { width = 1024, height = 288 } = {}) => {
    const s = 150; const ax = arrow === 'right' ? width - 110 : 110; const tx = arrow === 'right' ? 40 : 220;
    const lines = [{ text: 'Way out', x: tx, y: extra ? 128 : 190, size: extra ? 112 : 150, color: YELLOW }];
    if (extra) lines.push({ text: extra, x: tx, y: 236, size: 64, color: WHITE });
    return T.sign({ width, height, bg: BLACK, arrows: [{ dir: arrow, x: ax, y: height / 2, size: s, color: YELLOW }], lines });
  };
  /** 'District and Circle lines' with the green and yellow pills and an arrow. */
  const districtCircle = (arrow = 'up', { width = 1536, height = 320 } = {}) => {
    const ax = arrow === 'right' ? width - 110 : 110; const tx = arrow === 'right' ? 40 : 230;
    return T.sign({ width, height, bg: BLACK, arrows: [{ dir: arrow, x: ax, y: height / 2, size: 170, color: WHITE }],
      pills: [{ name: 'District', color: GREEN, x: tx, y: 40, h: 76 }, { name: 'Circle', color: YELLOW, textColor: '#0019a8', x: tx + 300, y: 40, h: 76 }],
      lines: [{ text: 'District and Circle lines', x: tx, y: 250, size: 104, color: WHITE }] });
  };
  /** Blue square escalator notice: 'Stand on the right' with the standing-figure pictogram. */
  const standRight = () => { const key = 'box:standRight'; return cachedTex(key, () => { const W = 256, H = 358; const c = T.canvas(W, H); const g = c.getContext('2d'); g.fillStyle = '#0019a8'; g.fillRect(0, 0, W, H);
    // pictogram: stair edge + two figures, the right one standing (white), the left lane clear
    g.fillStyle = '#ffffff'; g.fillRect(28, 150, 200, 8); g.fillRect(28, 158, 8, 60);
    const fig = (x, y, sc) => { g.beginPath(); g.arc(x, y, 12 * sc, 0, Math.PI * 2); g.fill(); g.fillRect(x - 9 * sc, y + 12 * sc, 18 * sc, 44 * sc); g.fillRect(x - 12 * sc, y + 56 * sc, 9 * sc, 40 * sc); g.fillRect(x + 3 * sc, y + 56 * sc, 9 * sc, 40 * sc); };
    fig(168, 50, 1.0); fig(196, 75, 0.8);
    g.font = `bold 40px ${T.SIGN_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Stand on', W / 2, 262); g.fillText('the right', W / 2, 310);
    return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping }); }); };
  const notice = (l1, l2, { bg = '#0019a8', fg = WHITE, width = 512, height = 360 } = {}) => T.sign({ width, height, bg, lines: [{ text: l1, x: width / 2, y: height * 0.42, size: height * 0.19, align: 'center', color: fg }, { text: l2, x: width / 2, y: height * 0.68, size: height * 0.19, align: 'center', color: fg }] });
  const holdHandrail = () => notice('Please hold', 'the handrail');
  const dogsCarried = () => notice('Dogs must', 'be carried');
  const keepChildren = () => notice('Keep hold', 'of children');
  const wetWeather = () => notice('Take extra care', 'in wet weather', { height: 300 });
  const feetAway = () => T.sign({ width: 512, height: 160, bg: '#ffd300', lines: [{ text: 'Keep feet away from the sides', x: 256, y: 100, size: 46, align: 'center', color: '#111' }] });
  const emergencyStop = () => T.sign({ width: 320, height: 200, bg: '#111111', fills: [{ x: 0, y: 0, w: 320, h: 200, color: '#111' }], lines: [{ text: 'EMERGENCY', x: 160, y: 80, size: 44, align: 'center', color: '#ff2a2a' }, { text: 'STOP', x: 160, y: 150, size: 60, align: 'center', color: '#ff2a2a' }] });
  const platformTab = (n) => T.sign({ width: 512, height: 128, bg: '#000000', lines: [{ text: `Platform ${n}`, x: 256, y: 92, size: 80, align: 'center' }] });
  const lift = (extra = 'to District and Circle lines') => { return cachedTex('box:liftSign:' + extra, () => { const W = 1024, H = 320; const c = T.canvas(W, H); const g = c.getContext('2d'); g.fillStyle = BLACK; g.fillRect(0, 0, W, H);
    T.drawArrow(g, 90, 130, 130, 'up', WHITE); wheelchair(g, 250, 130, 1.0);
    g.fillStyle = WHITE; g.font = `bold 120px ${T.SIGN_FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('Lift', 350, 128);
    g.font = `normal 54px ${T.SIGN_FONT}`; g.fillStyle = '#e6e8ea'; g.fillText(extra, 60, 262);
    return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping }); }); };
  /** Stainless call panel with the three buttons 'DC / JE / JW'. */
  const liftButtons = (litIndex = -1) => { const W = 256, H = 512; const c = T.canvas(W, H); const g = c.getContext('2d'); g.fillStyle = '#c4c7c9'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 200; i++) { g.strokeStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},0.08)`; g.beginPath(); const y = Math.random() * H; g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const btn = (y, label, sub, lit) => { g.fillStyle = '#2b2d30'; g.beginPath(); g.arc(W / 2, y, 44, 0, Math.PI * 2); g.fill(); g.fillStyle = lit ? '#ffb347' : '#d9dbdd'; g.beginPath(); g.arc(W / 2, y, 36, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; g.font = `bold 34px ${T.SIGN_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, W / 2, y); g.font = `normal 20px ${T.SIGN_FONT}`; g.fillStyle = '#1c1c1c'; g.fillText(sub, W / 2, y + 66); };
    const names = JUBILEE.deepLift.buttons; const subs = ['District & Circle', `Jubilee eastbound ${upper.number}`, `Jubilee westbound ${lower.number}`];
    names.forEach((n, i) => btn(90 + i * 140, n, subs[i] || '', litIndex === i));
    g.fillStyle = '#111'; g.font = `bold 22px ${T.SIGN_FONT}`; g.textAlign = 'center'; g.fillText('Lift', W / 2, 30);
    return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping }); };
  const liftFloorPlate = (text) => T.sign({ width: 512, height: 160, bg: '#c4c7c9', lines: [{ text, x: 256, y: 100, size: 64, align: 'center', color: '#111' }] });
  const cctv = () => T.sign({ width: 512, height: 256, bg: '#1c2e8c', lines: [{ text: 'CCTV in operation', x: 256, y: 110, size: 54, align: 'center' }, { text: 'Cameras are in operation on this', x: 256, y: 170, size: 30, align: 'center', weight: 'normal' }, { text: 'station for your safety and security', x: 256, y: 210, size: 30, align: 'center', weight: 'normal' }] });
  const noSmoking = () => T.sign({ width: 400, height: 300, bg: '#ffffff', fills: [{ x: 60, y: 30, w: 280, h: 10, color: '#dc241f' }], roundels: [], lines: [{ text: 'No smoking', x: 200, y: 200, size: 46, align: 'center', color: '#111' }, { text: 'It is against the law to smoke', x: 200, y: 245, size: 22, align: 'center', color: '#111', weight: 'normal' }, { text: 'in these premises', x: 200, y: 275, size: 22, align: 'center', color: '#111', weight: 'normal' }], border: { color: '#dc241f', width: 8 } });
  const levelBoard = (title, sub) => T.sign({ width: 1024, height: 512, bg: BLACK, fills: [{ x: 0, y: 0, w: 1024, h: 60, color: GREY }], lines: [{ text: 'Jubilee line', x: 30, y: 46, size: 42, color: WHITE }, { text: title, x: 512, y: 250, size: 140, align: 'center' }, { text: sub, x: 512, y: 400, size: 80, align: 'center', weight: 'normal' }] });
  const emergencyStairs = (to) => T.sign({ width: 512, height: 512, bg: '#009639', lines: [{ text: 'Emergency', x: 256, y: 150, size: 70, align: 'center' }, { text: 'stairs', x: 256, y: 230, size: 70, align: 'center' }, { text: to, x: 256, y: 330, size: 50, align: 'center', weight: 'normal' }, { text: 'Emergency use only', x: 256, y: 440, size: 40, align: 'center', weight: 'normal' }] });
  const fireAction = () => T.sign({ width: 512, height: 640, bg: '#0019a8', fills: [{ x: 0, y: 0, w: 512, h: 100, color: '#dc241f' }], lines: [{ text: 'FIRE ACTION', x: 256, y: 70, size: 60, align: 'center' }, { text: 'If you discover a fire', x: 30, y: 180, size: 34 }, { text: '1. Operate the nearest fire alarm', x: 30, y: 240, size: 26, weight: 'normal' }, { text: '2. Tell a member of staff', x: 30, y: 285, size: 26, weight: 'normal' }, { text: 'On hearing the alarm', x: 30, y: 370, size: 34 }, { text: 'Leave by the nearest exit', x: 30, y: 430, size: 26, weight: 'normal' }, { text: 'Do not use the lifts', x: 30, y: 475, size: 26, weight: 'normal' }, { text: 'Do not stop to collect belongings', x: 30, y: 520, size: 26, weight: 'normal' }, { text: 'Assemble outside on Bridge Street', x: 30, y: 590, size: 26, weight: 'normal' }] });
  const plaque = () => T.sign({ width: 1024, height: 640, bg: '#4a3f2f', border: { color: '#b08d57', width: 10 }, lines: [{ text: 'HMS WESTMINSTER', x: 512, y: 120, size: 78, align: 'center', color: '#e8d9b5' }, { text: 'is proud to be associated with', x: 512, y: 200, size: 44, align: 'center', color: '#e8d9b5', weight: 'normal' }, { text: 'LONDON UNDERGROUND', x: 512, y: 280, size: 66, align: 'center', color: '#e8d9b5' }, { text: 'At its lowest point the station is 32 m below', x: 512, y: 400, size: 38, align: 'center', color: '#e8d9b5', weight: 'normal' }, { text: 'mean sea level, deeper than any other', x: 512, y: 455, size: 38, align: 'center', color: '#e8d9b5', weight: 'normal' }, { text: 'location on the Tube network', x: 512, y: 510, size: 38, align: 'center', color: '#e8d9b5', weight: 'normal' }, { text: 'Opened 22 December 1999', x: 512, y: 590, size: 34, align: 'center', color: '#e8d9b5', weight: 'normal' }] });
  const maintenance = () => T.sign({ width: 512, height: 256, bg: '#ffd300', lines: [{ text: 'STAFF ONLY', x: 256, y: 100, size: 64, align: 'center', color: '#111' }, { text: 'Authorised persons beyond this point', x: 256, y: 190, size: 30, align: 'center', color: '#111', weight: 'normal' }] });
  const columnNumber = (n) => T.sign({ width: 256, height: 256, bg: '#f1f1ee', lines: [{ text: String(n), x: 128, y: 170, size: 130, align: 'center', color: '#111' }] });
  const seeItSayIt = () => T.sign({ width: 1024, height: 512, bg: '#0019a8', lines: [{ text: 'See it. Say it. Sorted.', x: 512, y: 200, size: 90, align: 'center' }, { text: 'Report anything unusual to staff', x: 512, y: 320, size: 52, align: 'center', weight: 'normal' }, { text: 'or text 61016', x: 512, y: 420, size: 60, align: 'center' }] });
  return { jubileeDir, jubileeBoth, wayOut, districtCircle, standRight, holdHandrail, dogsCarried, keepChildren, wetWeather, feetAway, emergencyStop, platformTab, lift, liftButtons, liftFloorPlate, cctv, noSmoking, levelBoard, emergencyStairs, fireAction, plaque, maintenance, columnNumber, seeItSayIt };
}
const texCache = new Map();
function cachedTex(key, make) { if (!texCache.has(key)) texCache.set(key, make()); return texCache.get(key); }
function wheelchair(g, cx, cy, sc) {
  g.save(); g.translate(cx, cy); g.scale(sc, sc); g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff'; g.lineWidth = 14; g.lineCap = 'round';
  g.beginPath(); g.arc(-8, -70, 16, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(-8, -50); g.lineTo(-8, 10); g.lineTo(40, 10); g.lineTo(56, 50); g.stroke();
  g.beginPath(); g.moveTo(-8, -25); g.lineTo(30, -25); g.stroke();
  g.beginPath(); g.arc(-8, 40, 42, -Math.PI * 0.85, Math.PI * 0.55); g.stroke();
  g.restore();
}

// ---------------------------------------------------------------------------
// Escalator frame: geometry of a layout.ESCALATORS run, mirroring entities/escalator.js so the structure can be kept
// clear of the flying banks. `surfaceAt(x, z)` gives the step-surface height at a plan point inside the footprint.
// ---------------------------------------------------------------------------
export const TREAD = 0.4;
export function profileY(s, plan, rise) {
  const flat = 1.2;
  if (s <= flat) return 0; if (s >= plan - flat) return -rise;
  const t = (s - flat) / (plan - 2 * flat); const k = 0.08;
  let v; if (t < k) v = (t * t) / (2 * k) * (1 / (1 - k)); else if (t > 1 - k) { const u = 1 - t; v = 1 - (u * u) / (2 * k) * (1 / (1 - k)); } else v = (t - k / 2) / (1 - k);
  return -rise * v;
}
export function escalatorFrame(e, { landing = 2.6, stairLane = null } = {}) {
  const top = new THREE.Vector3(e.top.x, e.top.y, e.top.z), bottom = new THREE.Vector3(e.bottom.x, e.bottom.y, e.bottom.z);
  const dxz = new THREE.Vector2(bottom.x - top.x, bottom.z - top.z); const plan = dxz.length(); const rise = top.y - bottom.y;
  const dir = dxz.clone().normalize(); const perp = new THREE.Vector2(-dir.y, dir.x);   // perp = to the LEFT looking downhill (escalator.js convention)
  const incline = Math.atan2(rise, plan); const yaw = Math.atan2(dir.x, dir.y);
  const lanes = e.lanes || [0]; const laneMin = Math.min(...lanes), laneMax = Math.max(...lanes);
  const f = {
    name: e.name, def: e, top, bottom, dir, perp, plan, rise, incline, yaw, lanes, landing, stairLane, tag: e.name,
    laneMin, laneMax, halfWidth: (laneMax - laneMin) / 2 + 0.65,          // steps 1.0 + balustrade 0.15 each side
    centreLane: (laneMin + laneMax) / 2,
    /** plan coords: along (0 at the top comb, +downhill), across (+ = perp direction). */
    local(x, z) { const px = x - top.x, pz = z - top.z; return { along: px * dir.x + pz * dir.y, across: px * perp.x + pz * perp.y }; },
    world(along, across, y = 0) { return new THREE.Vector3(top.x + dir.x * along + perp.x * across, top.y + y, top.z + dir.y * along + perp.y * across); },
    /** Step-surface height at plan distance `along` (clamped to the flat landings). */
    yAt(along) { return top.y + profileY(Math.min(plan, Math.max(0, along)), plan, rise); },
    /** Surface height at a plan point, or null when outside the (widened) footprint. */
    surfaceAt(x, z, margin = 0.6, extra = 0) { const l = f.local(x, z); const acrossMin = laneMin - 0.65 - margin - extra, acrossMax = laneMax + 0.65 + margin + extra; if (l.along < -landing - 0.6 || l.along > plan + landing + 0.6 || l.across < acrossMin || l.across > acrossMax) return null; return f.yAt(l.along); },
    /** true when the point is inside the envelope: from the truss underside (1.3 m below the steps) to 2.6 m headroom. */
    clashes(x, y, z, { below = 1.4, above = 2.7, margin = 0.6 } = {}) { const s = f.surfaceAt(x, z, margin); if (s == null) return false; return y > s - below && y < s + above; },
    /** Axis-aligned world rect of the plan footprint (with margins). */
    aabb(margin = 0.6, alongMargin = null) { const am = alongMargin ?? landing + 0.6; const pts = []; for (const al of [-am, plan + am]) for (const ac of [laneMin - 0.65 - margin, laneMax + 0.65 + margin]) pts.push(f.world(al, ac)); return { xMin: Math.min(...pts.map(p => p.x)), xMax: Math.max(...pts.map(p => p.x)), zMin: Math.min(...pts.map(p => p.z)), zMax: Math.max(...pts.map(p => p.z)) }; },
    /** Polygon (array of {x,z}) of the footprint from along a0..a1 and across c0..c1. */
    poly(a0, a1, c0, c1) { return [f.world(a0, c0), f.world(a1, c0), f.world(a1, c1), f.world(a0, c1)].map(p => ({ x: p.x, z: p.z })); },
  };
  return f;
}

// ---------------------------------------------------------------------------
// Geometry helpers (all return BufferGeometry in world coordinates, with metric UVs where it matters)
// ---------------------------------------------------------------------------
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
/** Cylinder from point a to point b (arrays or Vector3), radius r. */
export function tubeGeo(a, b, r, seg = 12, r2 = null) {
  _a.set(a.x ?? a[0], a.y ?? a[1], a.z ?? a[2]); _b.set(b.x ?? b[0], b.y ?? b[1], b.z ?? b[2]);
  const len = _a.distanceTo(_b); const g = new THREE.CylinderGeometry(r2 ?? r, r, len, seg, 1, false);
  const dir = _b.clone().sub(_a).normalize(); _q.setFromUnitVectors(_up, dir); g.applyQuaternion(_q); g.translate((_a.x + _b.x) / 2, (_a.y + _b.y) / 2, (_a.z + _b.z) / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * r, uv.getY(i) * len);
  return g;
}
/** Metric-UV box at (x,y,z) centre with optional rotations (radians). */
export function boxGeo(T, w, h, d, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  const g = T.boxGeometryMetric(w, h, d); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); g.translate(x, y, z); return g;
}
/** Plain box (unit UVs) — for painted things where tiling does not matter. */
export function plainBox(w, h, d, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); g.translate(x, y, z); return g;
}
/** Axis-aligned quad in the XZ plane at height y (facing up or down), metric UVs. */
export function xzQuad(y, x0, x1, z0, z1, facing = 'up') {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(facing === 'up' ? -Math.PI / 2 : Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), p.getZ(i)); return g;
}
/** Vertical quad in the XY plane at z (facing 'south' = +z or 'north'), metric UVs. */
export function xyQuad(z, x0, x1, y0, y1, facing = 'south') {
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0); if (facing === 'north') g.rotateY(Math.PI); g.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
  const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), p.getY(i)); return g;
}
/** Vertical quad in the YZ plane at x (facing 'east' = +x or 'west'), metric UVs. */
export function yzQuad(x, y0, y1, z0, z1, facing = 'east') {
  const g = new THREE.PlaneGeometry(z1 - z0, y1 - y0); g.rotateY(facing === 'east' ? Math.PI / 2 : -Math.PI / 2); g.translate(x, (y0 + y1) / 2, (z0 + z1) / 2);
  const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getZ(i), p.getY(i)); return g;
}
/** Horizontal polygon (array of {x,z}, CCW seen from above) with optional holes, at height y; metric UVs. */
export function polyQuad(y, outer, holes = [], facing = 'up') {
  const shape = new THREE.Shape(outer.map(p => new THREE.Vector2(p.x, -p.z)));
  for (const h of holes) { const path = new THREE.Path(h.map(p => new THREE.Vector2(p.x, -p.z))); shape.holes.push(path); }
  const g = new THREE.ShapeGeometry(shape, 2); g.rotateX(-Math.PI / 2);    // shape (x, -z) → after rotateX(-90°): (x, 0, z)
  if (facing === 'down') { const idx = g.index; if (idx) { for (let i = 0; i < idx.count; i += 3) { const t = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, t); } } g.computeVertexNormals(); }
  g.translate(0, y, 0);
  const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), p.getZ(i)); return g;
}
/** Signed area of a {x,z} polygon (positive when the interior is on the RIGHT of travel, seen from above with +z south). */
export function signedArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.z - q.x * p.z; } return a / 2; }
/**
 * Vertical band (between y0 and y1) along a closed or open polyline of {x,z} points. `side` = 'outward' (normals away
 * from the polygon interior — slab edges) or 'inward' (normals into the interior — hole rims); the polygon's winding is
 * detected so callers need not care about it.
 */
export function bandGeo(pts, y0, y1, closed = true, side = 'outward') {
  const pos = [], uv = [], idx = []; const n = pts.length; let dist = 0;
  const segs = closed ? n : n - 1;
  const interiorRight = signedArea(pts) > 0;                 // non-flipped normals point to the RIGHT of travel
  const flip = side === 'outward' ? interiorRight : !interiorRight;
  for (let i = 0; i <= segs; i++) {
    const p = pts[i % n]; if (i > 0) { const q = pts[(i - 1) % n]; dist += Math.hypot(p.x - q.x, p.z - q.z); }
    pos.push(p.x, y0, p.z, p.x, y1, p.z); uv.push(dist, 0, dist, y1 - y0);
    if (i > 0) { const b = (i - 1) * 2; if (!flip) idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); else idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/** A linear luminaire batten (emissive tube + white housing) as merged geometry. axis 'x' or 'z'. */
export function battenGeos(x, y, z, axis, length, radius = 0.03) {
  const tube = new THREE.CylinderGeometry(radius, radius, length, 10); tube.rotateZ(Math.PI / 2); if (axis === 'z') tube.rotateY(Math.PI / 2); tube.translate(x, y, z);
  const housing = new THREE.BoxGeometry(axis === 'x' ? length + 0.1 : radius * 4, radius * 2, axis === 'z' ? length + 0.1 : radius * 4); housing.translate(x, y + radius * 1.2, z);
  return { tube, housing };
}
/** Ribbon following an escalator frame: a vertical panel at lateral `across`, from h0 to h0+h above the step surface, between along a0..a1.
 * Non-flipped normals: vertical ribbons face +perp (the LEFT looking downhill); horizontal ribbons face DOWN. */
export function frameRibbon(f, across, h0, h, a0, a1, { horizontal = false, width = 0, flip = false, n = 36 } = {}) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const al = a0 + (a1 - a0) * i / n; const y = f.yAt(al);
    if (!horizontal) { const p = f.world(al, across); pos.push(p.x, y + h0, p.z, p.x, y + h0 + h, p.z); uv.push(al, 0, al, h); }
    else { const p1 = f.world(al, across - width / 2), p2 = f.world(al, across + width / 2); pos.push(p1.x, y + h0, p1.z, p2.x, y + h0, p2.z); uv.push(0, al, width, al); }
    if (i > 0) { const b = (i - 1) * 2; if (!flip) idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); else idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

/** Per-material merge bucket → one mesh per material. */
export class Bucket {
  constructor() { this.map = new Map(); }
  add(geometry, material) { if (!geometry) return; let g = geometry.index ? geometry.toNonIndexed() : geometry; if (!g.attributes.normal) g.computeVertexNormals(); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); g.clearGroups(); if (!this.map.has(material)) this.map.set(material, []); this.map.get(material).push(g); }
  flush(parent, { name = 'merged', castShadow = false, receiveShadow = true, frustumCulled = true } = {}) {
    const out = [];
    for (const [mat, geos] of this.map) {
      let merged = null; try { merged = mergeGeometries(geos, false); } catch (e) { merged = null; }
      if (!merged) { console.warn('[boxKit] merge failed; adding separately'); for (const g of geos) { const m = new THREE.Mesh(g, mat); parent.add(m); out.push(m); } continue; }
      merged.computeBoundingSphere(); merged.computeBoundingBox(); const mesh = new THREE.Mesh(merged, mat); mesh.name = name + ':' + (mat.name || ''); mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow; mesh.frustumCulled = frustumCulled; parent.add(mesh); out.push(mesh);
    }
    this.map.clear(); return out;
  }
}

/** Rectangle helpers. */
export const R = (xMin, xMax, zMin, zMax) => ({ xMin, xMax, zMin, zMax });
export const rectPoly = (r) => [{ x: r.xMin, z: r.zMin }, { x: r.xMax, z: r.zMin }, { x: r.xMax, z: r.zMax }, { x: r.xMin, z: r.zMax }];
export const inRect = (r, x, z) => x >= r.xMin && x <= r.xMax && z >= r.zMin && z <= r.zMax;
export const rectsOverlap = (a, b) => a.xMin < b.xMax && a.xMax > b.xMin && a.zMin < b.zMax && a.zMax > b.zMin;
/** Point-in-polygon ({x,z} list). */
export function inPoly(poly, x, z) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside; } return inside; }
/** Signed area (positive = CCW seen from above, i.e. in the x/−z shape space). */
export function ensureCCW(poly) { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p.x * (-q.z) - q.x * (-p.z); } return a < 0 ? poly.slice().reverse() : poly; }
export function ensureCW(poly) { return ensureCCW(poly).slice().reverse(); }
