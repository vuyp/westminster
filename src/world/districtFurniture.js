// ---------------------------------------------------------------------------
// districtFurniture.js — private helpers for the District & Circle platforms
// (src/world/districtPlatforms.js). Everything here is built in the caller's
// LOCAL frame (the District group: local +z = +s along the line towards the
// north-east, local +x = -t, i.e. towards the north-west / Platform 2 side).
//
//   Merger                 — accumulates transformed geometry per material and flushes ONE mesh per material
//   signs(T)               — memoised TfL sign textures used on these platforms (wordings from the dossier §12)
//   makeBenches / makeHelpPoints / makeFirePoints / makeCCTV / makeSpeakers   — InstancedMesh sets
//   makeDMI                — ceiling-hung amber dot-matrix next-train indicator (returns { set(lines) })
//   makeSuspendedSign      — double-sided blue sign box hung on two rods
//   makeWallSign           — framed sign / poster / diagram on a wall
//   makeRoundelBoards      — 'WESTMINSTER' roundels on grey enamel panels (instanced)
//   makeLift               — non-functional lift front (closed stainless doors, call plate, sign)
//   makeStair              — two flights + mid landing with handrails, corduroy tactiles, mosaic band; registers ramps
//   makeSignal             — LU two-aspect colour-light signal head
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE } from '../core/layout.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();

/** Compose a Matrix4 from position + Euler (YXZ) + optional scale. */
export function mat4(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

// ============================================================================ Merger
export class Merger {
  constructor(parent) { this.parent = parent; this.buckets = new Map(); this.meshes = []; }
  /** Add a geometry (cloned, transformed by `matrix`) to the bucket of `material`. `chunk` splits buckets for frustum culling. */
  add(material, geometry, matrix = null, chunk = '') {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const key = material.uuid + '|' + chunk; let b = this.buckets.get(key);
    if (!b) { b = { material, geos: [] }; this.buckets.set(key, b); }
    b.geos.push(g);
  }
  /** Metric box (UVs in metres) at position with yaw/pitch/roll. */
  box(material, w, h, d, { x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, chunk = '' } = {}, T = null) {
    const g = T ? T.boxGeometryMetric(w, h, d) : new THREE.BoxGeometry(w, h, d);
    this.add(material, g, mat4(x, y, z, ry, rx, rz), chunk); g.dispose();
  }
  /** Metric horizontal plane facing +y (w along local x, d along local z). */
  floor(material, w, d, { x = 0, y = 0, z = 0, ry = 0, chunk = '', flip = false } = {}, T = null) {
    const g = T ? T.planeGeometryMetric(w, d) : new THREE.PlaneGeometry(w, d);
    g.rotateX(flip ? Math.PI / 2 : -Math.PI / 2);
    this.add(material, g, mat4(x, y, z, ry), chunk); g.dispose();
  }
  /** Vertical metric plane (w wide, h high) facing local +z, then yawed by ry. */
  wall(material, w, h, { x = 0, y = 0, z = 0, ry = 0, chunk = '' } = {}, T = null) {
    const g = T ? T.planeGeometryMetric(w, h) : new THREE.PlaneGeometry(w, h);
    this.add(material, g, mat4(x, y, z, ry), chunk); g.dispose();
  }
  /** Cylinder segment between two points (local frame). */
  tube(material, a, b, radius, segments = 8, chunk = '') {
    const d = new THREE.Vector3().subVectors(b, a); const len = d.length(); if (len < 1e-4) return;
    const g = new THREE.CylinderGeometry(radius, radius, len, segments, 1, false);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    this.add(material, g, m, chunk); g.dispose();
  }
  flush({ castShadow = false, receiveShadow = true } = {}) {
    for (const b of this.buckets.values()) {
      if (!b.geos.length) continue;
      let merged = null;
      try { merged = mergeGeometries(b.geos, false); } catch (e) { console.warn('[districtFurniture] merge failed', e); }
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, b.material); mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow;
      this.parent.add(mesh); this.meshes.push(mesh);
      for (const g of b.geos) g.dispose();
      b.geos = [];
    }
    this.buckets.clear();
    return this.meshes;
  }
}

// ============================================================================ sign textures
const texCache = new Map();
function memo(key, make) { if (!texCache.has(key)) texCache.set(key, make()); return texCache.get(key); }
const BLUE = '#0019a8', YELLOW = '#ffd300', JUBILEE = '#a0a5a9', DISTRICT = '#00782a', CIRCLE = '#ffd300';

export function signs(T) {
  const F = T.SIGN_FONT;
  const S = {
    /** 'Way out' (yellow on blue) with an arrow; optional second line. */
    wayOut: (arrow = 'left', extra = null) => T.wayOutSign({ arrow, extra, width: 1024, height: 256 }),
    /** Blue sign with the grey 'Jubilee line' pill and an arrow. */
    jubilee: (arrow = 'left') => memo('dc:jub:' + arrow, () => {
      const w = 1024, h = 256, s = h * 0.55; const ax = arrow === 'right' ? w - s * 0.7 : s * 0.7; const px = arrow === 'right' ? w * 0.05 : s * 1.35;
      return T.sign({ width: w, height: h, bg: BLUE, pills: [{ name: 'Jubilee line', color: JUBILEE, x: px, y: h * 0.27, h: h * 0.46 }], arrows: [{ dir: arrow, x: ax, y: h / 2, size: s }], lines: [] });
    }),
    /** Combined 'Way out' + 'Jubilee line' two-row sign. */
    wayOutJubilee: (arrowOut = 'left', arrowJub = 'left') => memo(`dc:woj:${arrowOut}:${arrowJub}`, () => {
      const w = 1024, h = 512, s = 200;
      const ax = d => (d === 'right' ? w - s * 0.7 : s * 0.7); const tx = d => (d === 'right' ? w * 0.05 : s * 1.35);
      return T.sign({ width: w, height: h, bg: BLUE, lines: [{ text: 'Way out', x: tx(arrowOut), y: 175, size: 120, color: YELLOW }],
        pills: [{ name: 'Jubilee line', color: JUBILEE, x: tx(arrowJub), y: 300, h: 118 }],
        arrows: [{ dir: arrowOut, x: ax(arrowOut), y: 135, size: s, color: YELLOW }, { dir: arrowJub, x: ax(arrowJub), y: 360, size: s }],
        fills: [{ color: 'rgba(255,255,255,0.35)', x: 40, y: 254, w: w - 80, h: 3 }] });
    }),
    /** Black-tab platform identity: 'Westbound' / 'Platform 1' with the line pills. */
    platformId: (number, direction) => memo('dc:pid:' + number, () => {
      const w = 1024, h = 256;
      return T.sign({ width: w, height: h, bg: BLUE, fills: [{ color: '#000000', x: w - 380, y: 40, w: 340, h: 176 }],
        lines: [{ text: direction, x: 40, y: 118, size: 92 }, { text: 'Platform ' + number, x: w - 360, y: 165, size: 92, align: 'left' }],
        pills: [{ name: 'District', color: DISTRICT, x: 40, y: 150, h: 64 }, { name: 'Circle', color: CIRCLE, textColor: BLUE, x: 40 + 250, y: 150, h: 64 }], padding: 0 });
    }),
    /** White entrance panel: green/yellow band, 'District and Circle lines', arrow, 'Westbound platform 1'. */
    entrancePanel: (number, direction, arrow = 'right') => memo(`dc:ent:${number}:${arrow}`, () => {
      const w = 1024, h = 400;
      const ax = arrow === 'right' ? w - 90 : 90; const tx = arrow === 'right' ? 40 : 170;
      return T.sign({ width: w, height: h, bg: '#ffffff', fills: [{ color: DISTRICT, x: 0, y: 0, w, h: 34 }, { color: CIRCLE, x: 0, y: 34, w, h: 34 }],
        lines: [{ text: 'District and Circle lines', x: tx, y: 170, size: 80, color: '#000000' }, { text: `${direction} platform ${number}`, x: tx, y: 300, size: 96, color: '#000000' }],
        arrows: [{ dir: arrow, x: ax, y: 250, size: 150, color: '#000000' }] });
    }),
    /** Exit list with black number badges (D&C platforms → all six exits are via the ticket hall). */
    exitList: (arrow = 'up') => memo('dc:exits:' + arrow, () => {
      const w = 1024, h = 512; const fills = [], lines = [{ text: 'Way out', x: 170, y: 118, size: 104, color: YELLOW }];
      const rows = [['1', 'Westminster Pier'], ['2', 'Victoria Embankment'], ['3', 'Houses of Parliament'], ['4', 'Bridge Street'], ['5', 'Whitehall'], ['6', 'Parliament Street']];
      rows.forEach(([n, name], i) => { const col = i % 2, row = Math.floor(i / 2); const x = 60 + col * 500, y = 190 + row * 100;
        fills.push({ color: '#000000', x, y, w: 64, h: 64 }); lines.push({ text: n, x: x + 32, y: y + 52, size: 54, align: 'center' }); lines.push({ text: name, x: x + 84, y: y + 50, size: 50, weight: 'normal' }); });
      return T.sign({ width: w, height: h, bg: BLUE, fills, lines, arrows: [{ dir: arrow, x: 80, y: 85, size: 130, color: YELLOW }] });
    }),
    /** 'Lift' sign with wheelchair symbol and a destination line. */
    lift: (to = 'to ticket hall', arrow = null) => memo(`dc:lift:${to}:${arrow}`, () => {
      const w = 1024, h = 256; const c = T.canvas(w, h); const ctx = c.getContext('2d');
      ctx.fillStyle = BLUE; ctx.fillRect(0, 0, w, h);
      // wheelchair pictogram (white)
      ctx.save(); ctx.translate(95, 128); ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 14; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(-4, 22, 40, Math.PI * 0.2, Math.PI * 1.75); ctx.stroke();
      ctx.beginPath(); ctx.arc(-10, -60, 16, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-10, -36); ctx.lineTo(-6, 10); ctx.lineTo(40, 10); ctx.lineTo(58, 58); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-8, -14); ctx.lineTo(30, -14); ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = `bold 96px ${F}`; ctx.textBaseline = 'alphabetic'; ctx.fillText('Lift', 190, 120);
      ctx.font = `normal 60px ${F}`; ctx.fillText(to, 190, 200);
      if (arrow) T.drawArrow(ctx, w - 110, 128, 150, arrow, '#fff');
      return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
    }),
    /** The deep lift: grey Jubilee pill + 'Lift to platforms 3 and 4'. */
    deepLift: () => memo('dc:deeplift', () => T.sign({ width: 1024, height: 320, bg: BLUE, pills: [{ name: 'Jubilee line', color: JUBILEE, x: 40, y: 40, h: 110 }], lines: [{ text: 'Lift to platforms 3 and 4', x: 40, y: 265, size: 76 }] })),
    /** Blue help point face: header, green Information + red Emergency buttons, grille. */
    helpPoint: () => memo('dc:help', () => {
      const w = 350, h = 450; const c = T.canvas(w, h); const ctx = c.getContext('2d');
      ctx.fillStyle = BLUE; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff'; ctx.font = `bold 44px ${F}`; ctx.textBaseline = 'alphabetic'; ctx.fillText('Help point', 26, 62);
      T.drawRoundel(ctx, w - 44, 46, 26, { text: '' });
      // grille
      ctx.fillStyle = '#0f1a5c'; for (let y = 100; y < 190; y += 10) for (let x = 40; x < w - 40; x += 10) { ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill(); }
      const btn = (cx, cy, col, label) => { ctx.fillStyle = '#c8cacc'; ctx.beginPath(); ctx.arc(cx, cy, 58, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, 48, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `bold 30px ${F}`; ctx.textAlign = 'center'; ctx.fillText(label, cx, cy + 108); ctx.textAlign = 'left'; };
      btn(100, 280, '#007a33', 'Information'); btn(250, 280, '#dc241f', 'Emergency');
      // induction loop symbol
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(w - 70, h - 50, 40, 32); ctx.font = `bold 22px ${F}`; ctx.fillText('T', w - 58, h - 26);
      return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
    }),
    /** White 'MIND THE GAP' on a transparent ground (laid on the dark tactile band). */
    mindTheGap: () => memo('dc:mtg', () => {
      const w = 1024, h = 128; const c = T.canvas(w, h); const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = 'rgba(245,245,240,0.92)'; ctx.font = `bold 104px ${F}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.letterSpacing = '10px'; ctx.fillText('MIND THE GAP', w / 2, h / 2 + 4); ctx.letterSpacing = '0px';
      const t = T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping }); return t;
    }),
    /** Red 'No entry' disc on white (platform ends). */
    noEntry: () => memo('dc:noentry', () => {
      const w = 256, h = 320; const c = T.canvas(w, h); const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#dc241f'; ctx.beginPath(); ctx.arc(w / 2, 110, 92, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(w / 2 - 66, 96, 132, 28);
      ctx.fillStyle = '#000'; ctx.font = `bold 34px ${F}`; ctx.textAlign = 'center'; ctx.fillText('No entry', w / 2, 250); ctx.font = `normal 22px ${F}`; ctx.fillText('Authorised staff only', w / 2, 290);
      return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
    }),
    /** Small white notices: CCTV / no smoking / fire action. */
    cctvNotice: () => memo('dc:cctv', () => T.sign({ width: 512, height: 256, bg: '#ffffff', border: { color: '#0019a8', width: 10 }, lines: [{ text: 'CCTV', x: 40, y: 100, size: 76, color: BLUE }, { text: 'Cameras are in operation on this', x: 40, y: 165, size: 34, color: '#000', weight: 'normal' }, { text: 'station for your safety and security', x: 40, y: 210, size: 34, color: '#000', weight: 'normal' }] })),
    noSmoking: () => memo('dc:nosmoke', () => {
      const w = 400, h = 300; const c = T.canvas(w, h); const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#dc241f'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(w / 2, 110, 74, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#222'; ctx.fillRect(w / 2 - 50, 100, 90, 18); ctx.fillStyle = '#dc241f'; ctx.fillRect(w / 2 + 40, 100, 14, 18);
      ctx.strokeStyle = '#dc241f'; ctx.beginPath(); ctx.moveTo(w / 2 - 54, 56); ctx.lineTo(w / 2 + 54, 164); ctx.stroke();
      ctx.fillStyle = '#000'; ctx.font = `bold 36px ${F}`; ctx.textAlign = 'center'; ctx.fillText('No smoking', w / 2, 232); ctx.font = `normal 20px ${F}`; ctx.fillText('It is against the law to smoke in these premises', w / 2, 270);
      return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
    }),
    fireAction: () => memo('dc:fire', () => T.sign({ width: 512, height: 384, bg: '#0055b8', lines: [{ text: 'Fire action', x: 30, y: 80, size: 60 }, { text: 'If you discover a fire:', x: 30, y: 150, size: 34, weight: 'normal' }, { text: '1. Operate the nearest alarm', x: 30, y: 200, size: 30, weight: 'normal' }, { text: '2. Tell a member of staff', x: 30, y: 245, size: 30, weight: 'normal' }, { text: '3. Leave by the nearest exit', x: 30, y: 290, size: 30, weight: 'normal' }, { text: 'Do not use the lifts', x: 30, y: 350, size: 34 }] })),
    /** Green running-man exit sign. */
    exitGreen: (arrow = 'left') => memo('dc:exitgreen:' + arrow, () => {
      const w = 512, h = 256; const c = T.canvas(w, h); const ctx = c.getContext('2d');
      ctx.fillStyle = '#009639'; ctx.fillRect(0, 0, w, h);
      // door + running man pictogram
      ctx.fillStyle = '#fff'; ctx.fillRect(40, 40, 90, 176); ctx.fillStyle = '#009639'; ctx.fillRect(52, 52, 66, 152);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(200, 70, 18, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 16; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(200, 95); ctx.lineTo(180, 150); ctx.lineTo(150, 200); ctx.moveTo(180, 150); ctx.lineTo(230, 170); ctx.lineTo(240, 215); ctx.moveTo(200, 95); ctx.lineTo(160, 120); ctx.moveTo(200, 100); ctx.lineTo(245, 125); ctx.stroke();
      ctx.font = `bold 62px ${F}`; ctx.fillText('Exit', 290, 150);
      T.drawArrow(ctx, 440, 190, 70, arrow, '#fff');
      return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
    }),
    /** Danger notice at the platform-end steps. */
    dangerEnd: () => memo('dc:danger', () => T.sign({ width: 512, height: 256, bg: '#ffd300', lines: [{ text: 'DANGER', x: 30, y: 90, size: 70, color: '#000' }, { text: 'Do not pass this point', x: 30, y: 160, size: 40, color: '#000' }, { text: 'Live rails — 630 V', x: 30, y: 215, size: 36, color: '#000', weight: 'normal' }], border: { color: '#000', width: 12 } })),
    /** Name roundel 'WESTMINSTER' on a transparent ground (bar 3.4 r long). */
    nameRoundel: () => memo('dc:roundel', () => {
      const w = 1024, h = 512; const c = T.canvas(w, h); const ctx = c.getContext('2d'); ctx.clearRect(0, 0, w, h);
      T.drawRoundel(ctx, w / 2, h / 2, h * 0.46, { text: 'WESTMINSTER', barWidthFactor: 3.4, ringColor: '#d42a25', barColor: '#1c2e8c' });
      return T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping });
    }),
    /** Trueform-style black DMI housing label strip 'Next train' (small). */
    dmiLabel: (platform) => memo('dc:dmilabel:' + platform, () => T.sign({ width: 512, height: 64, bg: '#111111', lines: [{ text: 'Platform ' + platform, x: 14, y: 46, size: 36 }] })),
    /** Small grey 'Emergency stop' / 'Stand on the right'. Not used here but handy for the escalator surrounds. */
    standRight: () => memo('dc:standright', () => T.sign({ width: 256, height: 356, bg: BLUE, lines: [{ text: 'Stand on', x: 20, y: 250, size: 44 }, { text: 'the right', x: 20, y: 305, size: 44 }] })),
  };
  return S;
}

// ============================================================================ instanced fittings
function instanced(parent, geometry, material, placements, { castShadow = false, receiveShadow = true, name = '' } = {}) {
  const im = new THREE.InstancedMesh(geometry, material, placements.length);
  placements.forEach((p, i) => im.setMatrixAt(i, p.matrix || mat4(p.x, p.y, p.z, p.ry || 0, p.rx || 0, p.rz || 0, p.sx || 1, p.sy || 1, p.sz || 1)));
  im.instanceMatrix.needsUpdate = true; im.castShadow = castShadow; im.receiveShadow = receiveShadow; im.name = name; im.frustumCulled = false;
  parent.add(im); return im;
}

/**
 * Stainless perforated three-seat benches (1.5 m) with tubular legs, back to a wall. placements: [{x,y,z,ry}] — y = floor,
 * the bench faces local +z before ry.
 */
export function makeBenches(ctx, parent, placements) {
  if (!placements.length) return;
  const { M, T } = ctx;
  const perf = M.perforated();
  const frame = M.stainless();
  const seatGeo = T.boxGeometryMetric(1.5, 0.04, 0.44); seatGeo.translate(0, 0.45, 0);
  const backGeo = T.boxGeometryMetric(1.5, 0.30, 0.03); backGeo.translate(0, 0.78, -0.22);
  // legs: two U-frames of 40 mm tube + a rear rail
  const legGeos = [];
  for (const sx of [-0.62, 0.62]) {
    for (const sz of [-0.18, 0.16]) { const l = new THREE.CylinderGeometry(0.02, 0.02, 0.44, 8); l.translate(sx, 0.22, sz); legGeos.push(l); }
    const b = new THREE.CylinderGeometry(0.02, 0.02, 0.38, 8); b.rotateX(Math.PI / 2); b.translate(sx, 0.43, -0.01); legGeos.push(b);
    const up = new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8); up.translate(sx, 0.7, -0.24); legGeos.push(up);
  }
  const rail = new THREE.CylinderGeometry(0.018, 0.018, 1.24, 8); rail.rotateZ(Math.PI / 2); rail.translate(0, 0.95, -0.24); legGeos.push(rail);
  const legGeo = mergeGeometries(legGeos, false); legGeos.forEach(g => g.dispose());
  // seat divider armrests (three seats)
  const armGeos = []; for (const sx of [-0.25, 0.25]) { const a = new THREE.BoxGeometry(0.02, 0.10, 0.36); a.translate(sx, 0.53, 0); armGeos.push(a); }
  const armGeo = mergeGeometries(armGeos, false);
  instanced(parent, seatGeo, perf, placements, { name: 'bench-seat' });
  instanced(parent, backGeo, perf, placements, { name: 'bench-back' });
  instanced(parent, legGeo, frame, placements, { name: 'bench-frame' });
  instanced(parent, armGeo, frame, placements, { name: 'bench-arms' });
}

/** Help points: blue box 0.35 × 0.45 × 0.12 at 1.2 m centre, faces local +z before ry. placements: [{x,y(floor),z,ry}] */
export function makeHelpPoints(ctx, parent, placements, S) {
  if (!placements.length) return;
  const { M } = ctx;
  const body = new THREE.BoxGeometry(0.35, 0.45, 0.12); body.translate(0, 1.2, -0.06);
  const face = new THREE.PlaneGeometry(0.33, 0.43); face.translate(0, 1.2, 0.002);
  instanced(parent, body, M.paint(0x0a1f8f, { roughness: 0.4, metalness: 0.3 }), placements, { name: 'helppoint' });
  instanced(parent, face, M.signMaterial(S.helpPoint(), { emissive: 0.35 }), placements, { name: 'helppoint-face' });
}

/** Fire points: red water + black-horn CO2 extinguishers on a stainless bracket with a small 'Fire point' plate. */
export function makeFirePoints(ctx, parent, placements) {
  if (!placements.length) return;
  const { M } = ctx;
  const red = M.paint(0xc8102e, { roughness: 0.35, metalness: 0.3 });
  const geos = [];
  const w = new THREE.CylinderGeometry(0.085, 0.085, 0.55, 12); w.translate(-0.15, 0.6 + 0.275, -0.12); geos.push(w);
  const c = new THREE.CylinderGeometry(0.075, 0.075, 0.6, 12); c.translate(0.15, 0.6 + 0.3, -0.12); geos.push(c);
  const bodyGeo = mergeGeometries(geos, false);
  const blackGeos = [];
  const horn = new THREE.ConeGeometry(0.06, 0.16, 10); horn.rotateX(Math.PI / 2); horn.translate(0.15, 1.05, 0.0); blackGeos.push(horn);
  for (const sx of [-0.15, 0.15]) { const top = new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8); top.translate(sx, 1.2, -0.12); blackGeos.push(top); const handle = new THREE.BoxGeometry(0.025, 0.02, 0.16); handle.translate(sx, 1.25, -0.06); blackGeos.push(handle); }
  const blackGeo = mergeGeometries(blackGeos, false);
  const bracket = new THREE.BoxGeometry(0.6, 0.9, 0.02); bracket.translate(0, 0.95, -0.24);
  instanced(parent, bodyGeo, red, placements, { name: 'extinguisher' });
  instanced(parent, blackGeo, M.rubber(0x161616), placements, { name: 'extinguisher-black' });
  instanced(parent, bracket, M.stainless(), placements, { name: 'fire-bracket' });
}

/** CCTV domes (white hemisphere + dark lens) hung from a soffit/beam: placements y = the soffit. */
export function makeCCTV(ctx, parent, placements) {
  if (!placements.length) return;
  const { M } = ctx;
  const dome = new THREE.SphereGeometry(0.08, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); dome.translate(0, -0.03, 0);
  const base = new THREE.CylinderGeometry(0.09, 0.09, 0.03, 14); base.translate(0, -0.015, 0);
  const lens = new THREE.SphereGeometry(0.075, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); lens.translate(0, -0.03, 0);
  instanced(parent, mergeGeometries([dome, base], false), M.paint(0xf0f0ee, { roughness: 0.5 }), placements, { name: 'cctv' });
  instanced(parent, lens, M.glass({ color: 0x0b0d10, opacity: 0.75, roughness: 0.15 }), placements, { name: 'cctv-lens' });
}

/** Horn PA speakers on beam brackets (white/grey), pointing along local -y/+z before ry. placements y = soffit. */
export function makeSpeakers(ctx, parent, placements) {
  if (!placements.length) return;
  const { M } = ctx;
  const horn = new THREE.CylinderGeometry(0.11, 0.05, 0.28, 12, 1, true); horn.rotateX(Math.PI / 2); horn.rotateX(-0.35); horn.translate(0, -0.22, 0.05);
  const back = new THREE.CylinderGeometry(0.05, 0.035, 0.12, 12); back.rotateX(Math.PI / 2); back.rotateX(-0.35); back.translate(0, -0.15, -0.13);
  const bracket = new THREE.BoxGeometry(0.04, 0.16, 0.04); bracket.translate(0, -0.08, -0.05);
  const mat = M.paint(0xe8e8e4, { roughness: 0.55, metalness: 0.2 }); mat.side = THREE.DoubleSide;
  instanced(parent, mergeGeometries([horn, back], false), mat, placements, { name: 'speaker' });
  instanced(parent, bracket, M.paint(0x8a8d8f, { roughness: 0.6, metalness: 0.5 }), placements, { name: 'speaker-bracket' });
}

/**
 * Ceiling-hung dot-matrix indicator: black housing 1.2 × 0.4 × 0.18 with the LED face on one side (local +z before ry),
 * hung on two rods from `soffitY`. Returns { group, set(lines), display }.
 */
export function makeDMI(ctx, parent, { x, y, z, ry = 0, soffitY, display, faces = 1, platform = 1 }, S) {
  const { M, T } = ctx;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  const housing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.42, 0.18), M.paint(0x151617, { roughness: 0.6, metalness: 0.3 })); g.add(housing);
  const dmi = display || T.dotMatrix({ cols: 150, rows: 3, dot: 6, gap: 2, color: '#ffb300', dim: '#221400' });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.2), M.screen(dmi.texture, 1.5)); face.position.set(0, 0.03, 0.092); g.add(face);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.07), M.signMaterial(S.dmiLabel(platform), { emissive: 0.3 })); label.position.set(-0.3, -0.15, 0.092); g.add(label);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 0.38), M.glass({ color: 0x1a1c20, opacity: 0.25, roughness: 0.05 })); glass.position.set(0, 0, 0.096); g.add(glass);
  if (faces === 2) { const f2 = face.clone(); f2.rotation.y = Math.PI; f2.position.z = -0.092; g.add(f2); const l2 = label.clone(); l2.rotation.y = Math.PI; l2.position.set(0.3, -0.15, -0.092); g.add(l2); }
  const rodLen = Math.max(0.05, soffitY - (y + 0.21));
  for (const sx of [-0.45, 0.45]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, rodLen, 6), M.stainless()); rod.position.set(sx, 0.21 + rodLen / 2, 0); g.add(rod); }
  return { group: g, display: dmi, set: lines => dmi.set(lines) };
}

/**
 * Double-sided suspended sign box: `front` texture faces local +z (before ry); `back` faces -z. w × h metres; the sign's
 * underside is at yBottom; rods to soffitY. Returns the group.
 */
export function makeSuspendedSign(ctx, parent, { x, z, yBottom, soffitY, w, h, front, back = null, ry = 0, depth = 0.1 }) {
  const { M } = ctx;
  const g = new THREE.Group(); g.position.set(x, yBottom + h / 2, z); g.rotation.y = ry; parent.add(g);
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), M.paint(0x0c1c6e, { roughness: 0.5, metalness: 0.2 })); g.add(box);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.02, h - 0.02), M.signMaterial(front, { emissive: 0.6 })); f.position.z = depth / 2 + 0.002; g.add(f);
  if (back) { const b = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.02, h - 0.02), M.signMaterial(back, { emissive: 0.6 })); b.position.z = -depth / 2 - 0.002; b.rotation.y = Math.PI; g.add(b); }
  const rodLen = Math.max(0.05, soffitY - (yBottom + h));
  for (const sx of [-w * 0.35, w * 0.35]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, rodLen, 6), M.stainless()); rod.position.set(sx, h / 2 + rodLen / 2, 0); g.add(rod); }
  return g;
}

/** A framed sign / poster / diagram mounted on a wall: plane faces local +z before ry; frame optional (stainless or black). */
export function makeWallSign(ctx, parent, texture, w, h, { x, y, z, ry = 0, frame = null, frameW = 0.04, emissive = 0.5, standoff = 0.02, screen = false, transparent = false }) {
  const { M } = ctx;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  if (frame) {
    const fm = frame === 'black' ? M.paint(0x1a1a1a, { roughness: 0.5, metalness: 0.3 }) : frame === 'grey' ? M.paint(0x8a8d8f, { roughness: 0.5, metalness: 0.4 }) : M.stainless();
    const box = new THREE.Mesh(new THREE.BoxGeometry(w + frameW * 2, h + frameW * 2, standoff), fm); box.position.z = standoff / 2; g.add(box);
  }
  const mat = screen ? M.screen(texture, 1.2) : M.signMaterial(texture, { emissive, transparent });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); plane.position.z = standoff + 0.002; g.add(plane);
  return g;
}

/** 'WESTMINSTER' name roundels on light-grey enamel panels. placements: [{x,y(bar centre),z,ry}] facing local +z before ry. */
export function makeRoundelBoards(ctx, parent, placements, S) {
  if (!placements.length) return;
  const { M } = ctx;
  const panel = new THREE.BoxGeometry(1.7, 0.95, 0.03); panel.translate(0, 0, 0.015);
  const disc = new THREE.PlaneGeometry(1.6, 0.8); disc.translate(0, 0, 0.034);
  instanced(parent, panel, M.paint(0xd8dad9, { roughness: 0.45, metalness: 0.3 }), placements, { name: 'roundel-panel' });
  instanced(parent, disc, M.signMaterial(S.nameRoundel(), { emissive: 0.5, transparent: true }), placements, { name: 'roundel' });
}

/**
 * Non-functional lift front: stainless door pair in a portal, floor indicator, call plate, blue sign above.
 * Local frame: the doors face +z before ry; x/z = centre of the door line at floor y.
 */
export function makeLift(ctx, parent, { x, y, z, ry = 0, sign, width = 1.1, height = 2.1, portalW = 2.2, portalH = 2.5, deep = false }, S) {
  const { M } = ctx;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  const st = M.stainless({ vertical: true });
  // portal surround (stainless) proud of the wall
  const surroundGeos = [];
  const lintel = new THREE.BoxGeometry(portalW, portalH - height, 0.12); lintel.translate(0, height + (portalH - height) / 2, 0.06); surroundGeos.push(lintel);
  for (const sx of [-1, 1]) { const jamb = new THREE.BoxGeometry((portalW - width) / 2, height, 0.12); jamb.translate(sx * (width / 2 + (portalW - width) / 4), height / 2, 0.06); surroundGeos.push(jamb); }
  g.add(new THREE.Mesh(mergeGeometries(surroundGeos, false), st));
  // doors (closed) with a centre gap line
  for (const sx of [-1, 1]) { const leaf = new THREE.Mesh(new THREE.BoxGeometry(width / 2 - 0.006, height - 0.02, 0.04), M.stainless()); leaf.position.set(sx * width / 4, height / 2, 0.02); g.add(leaf); }
  const gap = new THREE.Mesh(new THREE.BoxGeometry(0.012, height - 0.02, 0.05), M.rubber(0x0a0a0a)); gap.position.set(0, height / 2, 0.02); g.add(gap);
  if (deep) { // glazed vision panels in the deep lift's doors
    for (const sx of [-1, 1]) { const win = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.9), M.glass({ color: 0x9fb4c4, opacity: 0.55, roughness: 0.05 })); win.position.set(sx * width / 4, 1.45, 0.043); g.add(win); }
  }
  // floor indicator (small amber display) in the lintel
  const ind = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.09), M.luminaire(0xffa000, 1.4)); ind.position.set(0, height + 0.16, 0.125); g.add(ind);
  // call plate with a lit button
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.02), M.stainless()); plate.position.set(width / 2 + 0.24, 1.05, 0.13); g.add(plate);
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 12), M.luminaire(0xffffff, 0.8)); btn.rotation.x = Math.PI / 2; btn.position.set(width / 2 + 0.24, 1.05, 0.145); g.add(btn);
  // sign above
  if (sign) { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.325), M.signMaterial(sign, { emissive: 0.55 })); s.position.set(0, portalH + 0.28, 0.02); g.add(s); }
  return g;
}

/**
 * Concourse stair: two straight flights along local +z (descending towards +z) with a mid landing.
 *   zTop (top nosing), zBottom (foot), yTop, yBottom, xMin/xMax (the well), steps (total), landingLen.
 * Builds treads, risers, nosings, handrails, corduroy tactiles at head/foot, side walls up to yWallTop with the mosaic
 * band, a lintel over the foot and the soffit. Registers ramps (sound 'stairs'), the landing floor and wall blockers.
 * `toWorld(v3)` converts local → world for the collision registrations.
 */
export function makeStair(ctx, parent, merger, { zTop, zBottom, yTop, yBottom, xMin, xMax, steps = 28, landingLen = 1.5, yWallTop, toWorld, tag = 'dcStair', mosaic = null, wallMat = null, treadMat = null }, S) {
  const { M, T, collision } = ctx;
  const width = xMax - xMin, xc = (xMin + xMax) / 2;
  const rise = yTop - yBottom; const riser = rise / steps;
  const plan = zBottom - zTop; const flightPlan = (plan - landingLen) / 2; const perFlight = steps / 2; const going = flightPlan / perFlight;
  const yLanding = yTop - riser * perFlight;
  const stone = treadMat || M.granite({ base: 0x8d8c88, slab: 0.3, joints: false, seed: 5 });
  const nosing = M.paint(0xe9e3c8, { roughness: 0.7, metalness: 0 });
  const concrete = wallMat || M.concrete({ base: PALETTE.precast, seed: 12 });
  const steel = M.stainless();
  const band = M.paint(mosaic ?? PALETTE.blueMosaic, { roughness: 0.35, metalness: 0.1 });
  const g = new THREE.Group(); parent.add(g);
  // ---- treads & risers as instanced boxes (each step = a solid block from the tread down to the next tread level → no gaps)
  const treadGeo = T.boxGeometryMetric(width - 0.02, riser, going);
  const nosingGeo = new THREE.BoxGeometry(width - 0.02, 0.008, 0.055);
  const place = [], nplace = [];
  const flights = [[zTop, yTop], [zTop + flightPlan + landingLen, yLanding]];
  for (const [z0, y0] of flights) for (let i = 0; i < perFlight; i++) {
    const zn = z0 + i * going;               // nosing line of step i
    const yt = y0 - riser * i;               // tread level of step i (the top tread is one riser below the landing above)
    // block: tread top at yt - riser? No: step i has its tread at (y0 - riser*(i+1)); the block spans from that tread down one riser.
    const treadY = y0 - riser * (i + 1);
    place.push({ x: xc, y: treadY - riser / 2, z: zn + going / 2 });
    nplace.push({ x: xc, y: treadY + 0.004, z: zn + 0.03 });
    void yt;
  }
  instanced(g, treadGeo, stone, place, { name: tag + ':treads', receiveShadow: true });
  instanced(g, nosingGeo, nosing, nplace, { name: tag + ':nosings' });
  // ---- landing slab + the foot/head thresholds
  const zL0 = zTop + flightPlan, zL1 = zL0 + landingLen;
  merger.box(stone, width - 0.02, 0.25, landingLen, { x: xc, y: yLanding - 0.125, z: (zL0 + zL1) / 2 }, T);
  // solid mass under the flights (so nothing is see-through from the side), sloped soffit
  const soffit = M.concrete({ base: 0x8d8b86, seed: 4, boardMarks: false });
  for (const [z0, y0] of flights) {
    const len = Math.hypot(flightPlan, riser * perFlight); const ang = Math.atan2(riser * perFlight, flightPlan);
    merger.box(soffit, width - 0.02, 0.28, len, { x: xc, y: y0 - riser * perFlight / 2 - riser / 2 - 0.16, z: z0 + flightPlan / 2, rx: ang }, T);
  }
  // ---- corduroy tactile strips at the head (on the upper floor) and the foot
  const cord = M.tactile('corduroy', 0x6a6a68);
  merger.floor(cord, width - 0.02, 0.4, { x: xc, y: yTop + 0.004, z: zTop - 0.55 }, T);
  merger.floor(cord, width - 0.02, 0.4, { x: xc, y: yBottom + 0.004, z: zBottom + 0.55 }, T);
  // ---- handrails: wall rails both sides + a centre rail on posts, 0.9 m above the nosing line, with horizontal returns
  const railY = 0.9; const r = 0.022;
  const xs = [xMin + 0.08, xMax - 0.08, xc];
  for (const xr of xs) {
    const pts = [];
    pts.push(new THREE.Vector3(xr, yTop + railY, zTop - 0.35)); pts.push(new THREE.Vector3(xr, yTop + railY, zTop));
    pts.push(new THREE.Vector3(xr, yLanding + railY, zL0)); pts.push(new THREE.Vector3(xr, yLanding + railY, zL1));
    pts.push(new THREE.Vector3(xr, yBottom + railY, zBottom)); pts.push(new THREE.Vector3(xr, yBottom + railY, zBottom + 0.35));
    for (let i = 1; i < pts.length; i++) merger.tube(steel, pts[i - 1], pts[i], r, 10);
    for (const p of pts) { const sph = new THREE.SphereGeometry(r, 8, 6); merger.add(steel, sph, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)); sph.dispose(); }
    // brackets / posts
    const isCentre = xr === xc;
    for (const [z0, y0] of [[zTop + 0.6, yTop - riser * (0.6 / going)], [zTop + flightPlan - 0.6, yLanding + riser * (0.6 / going)], [zL0 + landingLen / 2, yLanding], [zL1 + 0.6, yLanding - riser * (0.6 / going)], [zBottom - 0.6, yBottom + riser * (0.6 / going)]]) {
      if (isCentre) merger.tube(steel, new THREE.Vector3(xr, y0 + 0.02, z0), new THREE.Vector3(xr, y0 + railY - r, z0), 0.02, 8);
      else { const sx = xr < xc ? -1 : 1; merger.tube(steel, new THREE.Vector3(xr + sx * 0.08, y0 + railY - 0.08, z0), new THREE.Vector3(xr, y0 + railY - r, z0), 0.014, 6); }
    }
  }
  // ---- side walls (full height from the foot level to the upper floor), mosaic band following the flights at 1.2 m
  const wallH = yWallTop - yBottom;
  for (const [xw, side] of [[xMin - 0.15, -1], [xMax + 0.15, 1]]) {
    merger.box(concrete, 0.3, wallH, zBottom - zTop + 0.3, { x: xw, y: yBottom + wallH / 2, z: (zTop + zBottom) / 2 }, T);
    // mosaic band 300 mm high, 1.1–1.4 m above the pitch line, on the inner face (3 mm proud)
    const xb = xw - side * 0.152;
    for (const [z0, y0] of flights) {
      const len = Math.hypot(flightPlan, riser * perFlight); const ang = Math.atan2(riser * perFlight, flightPlan);
      merger.box(band, 0.006, 0.3, len, { x: xb, y: y0 - riser * perFlight / 2 + 1.25, z: z0 + flightPlan / 2, rx: ang });
    }
    merger.box(band, 0.006, 0.3, landingLen, { x: xb, y: yLanding + 1.25, z: (zL0 + zL1) / 2 });
    // stair-well battens (emissive) on the wall at 2.2 m over each flight
    for (const [z0, y0] of flights) {
      const lum = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 1.2), M.luminaire(0xf4f1e8, 2.2)); lum.position.set(xb - side * 0.03, y0 - riser * perFlight / 2 + 2.25, z0 + flightPlan / 2); g.add(lum);
    }
  }
  // end wall under the top of the stair (closes the void beneath the upper flight)
  merger.box(concrete, width + 0.6, wallH, 0.3, { x: xc, y: yBottom + wallH / 2, z: zTop - 0.15 }, T);
  // ---- collision: two ramps + the landing + walls
  const W = v => toWorld(v.clone());
  const a1 = W(new THREE.Vector3(xc, yTop, zTop - 0.05)), b1 = W(new THREE.Vector3(xc, yLanding, zL0));
  const a2 = W(new THREE.Vector3(xc, yLanding, zL1)), b2 = W(new THREE.Vector3(xc, yBottom, zBottom + 0.05));
  collision.addRamp(a1, b1, width, { tag: tag + ':upper', sound: 'stairs', stepPitch: going });
  collision.addRamp(a2, b2, width, { tag: tag + ':lower', sound: 'stairs', stepPitch: going });
  const l0 = W(new THREE.Vector3(xc, yLanding, zL0 - 0.05)), l1 = W(new THREE.Vector3(xc, yLanding, zL1 + 0.05));
  collision.addRamp(l0, l1, width, { tag: tag + ':landing', sound: 'stairs' });
  for (const xw of [xMin - 0.15, xMax + 0.15]) wallBlockers(collision, toWorld, xw - 0.15, xw + 0.15, yBottom, yWallTop, zTop - 0.3, zBottom + 0.3, tag + ':wall');
  wallBlockers(collision, toWorld, xMin - 0.3, xMax + 0.3, yBottom, yWallTop, zTop - 0.3, zTop, tag + ':endwall');
  // centre handrail as a thin blocker chain (so people don't walk through it)
  wallBlockers(collision, toWorld, xc - 0.03, xc + 0.03, yBottom, yTop + 1.0, zTop, zBottom, tag + ':centreRail', 1.0);
  return { group: g, yLanding, zL0, zL1, going, riser };
}

/** Register a rotated wall (local-frame box) as a chain of world AABBs. */
export function wallBlockers(collision, toWorld, xMin, xMax, yMin, yMax, zMin, zMax, tag, step = 0.8) {
  const lenX = xMax - xMin, lenZ = zMax - zMin;
  const alongZ = lenZ >= lenX; const n = Math.max(1, Math.ceil((alongZ ? lenZ : lenX) / step));
  const b = new THREE.Box3(); const c = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a0 = (alongZ ? zMin : xMin) + (alongZ ? lenZ : lenX) * i / n, a1 = (alongZ ? zMin : xMin) + (alongZ ? lenZ : lenX) * (i + 1) / n;
    b.makeEmpty();
    for (const y of [yMin, yMax]) for (const u of [a0, a1]) for (const v of alongZ ? [xMin, xMax] : [zMin, zMax]) {
      c.set(alongZ ? v : u, y, alongZ ? u : v); toWorld(c); b.expandByPoint(c);
    }
    collision.addBlocker(b.clone(), tag);
  }
}

/** LU two-aspect colour-light signal on a short post; faces local +z before ry. `aspect`: 'red' | 'green'. */
export function makeSignal(ctx, parent, { x, y, z, ry = 0, aspect = 'red', id = 'WA12' }, S) {
  const { M, T } = ctx;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8), M.paint(0x3a3a3a, { roughness: 0.7, metalness: 0.5 })); post.position.y = 0.7; g.add(post);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.62, 0.18), M.paint(0x111111, { roughness: 0.6, metalness: 0.3 })); head.position.set(0, 1.7, 0); g.add(head);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.72), M.paint(0xf2f2ee, { roughness: 0.7 })); plate.position.set(0, 1.7, -0.091); plate.rotation.y = Math.PI; g.add(plate);
  const red = new THREE.Mesh(new THREE.CircleGeometry(0.085, 16), M.luminaire(0xff2a1a, aspect === 'red' ? 3 : 0.05)); red.position.set(0, 1.86, 0.092); g.add(red);
  const green = new THREE.Mesh(new THREE.CircleGeometry(0.085, 16), M.luminaire(0x38ff70, aspect === 'green' ? 3 : 0.05)); green.position.set(0, 1.55, 0.092); g.add(green);
  for (const yy of [1.86, 1.55]) { const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 12, 1, true, 0, Math.PI), M.paint(0x111111, { roughness: 0.6 })); hood.rotation.x = Math.PI / 2; hood.rotation.z = Math.PI; hood.position.set(0, yy + 0.02, 0.15); hood.material.side = THREE.DoubleSide; g.add(hood); }
  const idTex = T.sign({ width: 256, height: 96, bg: '#ffffff', lines: [{ text: id, x: 128, y: 70, size: 60, color: '#000', align: 'center' }] });
  const idPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.11), M.signMaterial(idTex, { emissive: 0.2 })); idPlate.position.set(0, 1.3, 0.05); g.add(idPlate);
  return g;
}
