// ---------------------------------------------------------------------------
// ticketHallKit.js — helpers shared by the ticket hall module and its entities:
//   Merger      batches static geometry per material into one mesh each
//   signs (S)   every TfL sign texture used in the concourse (exact wordings from the dossier)
//   fixtures    help point, CCTV dome, extinguisher pair, PA speaker, litter bin, wall clock,
//               poster frame, Tensa barrier, payphone, cash machine, lift shaft, stairs, handrails
// Everything is procedural; textures come from T (canvas), materials from M.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE } from '../core/layout.js';

const BLUE = '#1a2f8c', YELLOW = '#ffd300', WHITE = '#ffffff', BLACK = '#111111';
const FONT = "'Johnston', 'Johnston100', 'Gill Sans', 'Gill Sans MT', 'Hammersmith One', 'Helvetica Neue', Helvetica, Arial, 'DejaVu Sans', sans-serif";

// ======================================================================= Merger
/** Collects geometries per material and emits one merged Mesh per material (static things only). */
export class Merger {
  constructor(parent) { this.parent = parent; this.batches = new Map(); this.count = 0; }
  /** Add a geometry (consumed) at a pose. Rotation: rx, ry, rz in radians (applied Y, then X, then Z). */
  add(mat, geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
    if (!geo) return;
    if (rx || ry || rz) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')));
    if (x || y || z) geo.translate(x, y, z);
    { const a = geo.attributes.position.array; for (let q = 0; q < a.length; q++) if (!Number.isFinite(a[q])) { console.warn('[ticketHall merger] NaN geometry skipped:', geo.type, 'pose', x, y, z, rx, ry, rz, new Error().stack.split('\n').slice(2, 6).join(' | ')); return; } }
    let b = this.batches.get(mat); if (!b) { b = []; this.batches.set(mat, b); }
    b.push(geo.index ? geo.toNonIndexed() : geo); this.count++;
  }
  box(mat, w, h, d, pose = {}, metric = true) { this.add(mat, metric ? boxMetric(w, h, d) : new THREE.BoxGeometry(w, h, d), pose); }
  cyl(mat, rTop, rBot, h, seg, pose = {}, open = false) { this.add(mat, new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open), pose); }
  /** Straight tube from a to b (THREE.Vector3), radius r. */
  tube(mat, a, b, r, seg = 8) {
    const d = new THREE.Vector3().subVectors(b, a); const len = d.length(); if (len < 1e-4) return;
    const g = new THREE.CylinderGeometry(r, r, len, seg); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    g.applyQuaternion(q); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); this.add(mat, g);
  }
  /** Vertical quad w × h whose centre is at (x,y,z), facing `facing` ('north'|'south'|'east'|'west') or yaw `ry`. UVs metric if `metric`. */
  quad(mat, w, h, { x = 0, y = 0, z = 0, facing = 'south', ry = null, metric = false } = {}) {
    const g = new THREE.PlaneGeometry(w, h); if (metric) scaleUV(g, w, h);
    const rot = ry != null ? ry : ({ south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }[facing] ?? 0);
    this.add(mat, g, { x, y, z, ry: rot });
  }
  /** Horizontal quad (w along x, d along z) facing up (or down if `down`). */
  flat(mat, w, d, { x = 0, y = 0, z = 0, down = false, metric = true } = {}) {
    const g = new THREE.PlaneGeometry(w, d); if (metric) scaleUV(g, w, d); g.rotateX(down ? Math.PI / 2 : -Math.PI / 2); this.add(mat, g, { x, y, z });
  }
  /** Emit meshes. */
  flush({ castShadow = true, receiveShadow = true, name = 'merged' } = {}) {
    const out = [];
    for (const [mat, list] of this.batches) {
      let g = null; try { g = mergeGeometries(list, false); } catch (e) { console.warn('[ticketHallKit] merge failed', e); }
      if (!g) continue; const m = new THREE.Mesh(g, mat); m.castShadow = castShadow; m.receiveShadow = receiveShadow; m.name = name; this.parent.add(m); out.push(m);
    }
    this.batches.clear(); return out;
  }
}

/** BoxGeometry with UVs in metres on every face (same as T.boxGeometryMetric, local copy so the kit has no T dependency). */
export function boxMetric(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv, pos = g.attributes.position, nrm = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) { const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)); const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); if (nx > 0.5) uv.setXY(i, z, y); else if (ny > 0.5) uv.setXY(i, x, z); else uv.setXY(i, x, y); }
  uv.needsUpdate = true; return g;
}
export function scaleUV(g, sx, sy) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); uv.needsUpdate = true; return g; }

/** Clone a factory material with a faint emissive term (fake bounce light in an interior lit by few real lights). */
export function bounce(mat, intensity = 0.08, color = 0xffffff) {
  const m = mat.clone(); m.emissive = new THREE.Color(color); if (m.map) m.emissiveMap = m.map; m.emissiveIntensity = intensity; m.userData.metres = mat.userData.metres; return m;
}

// ======================================================================= signs
/** Builds the sign texture set. `T` = ctx.T. Each function returns a THREE.Texture (cached inside T.sign by spec). */
export function makeSigns(T) {
  const badge = (ctx, x, y, s, n) => { ctx.fillStyle = BLACK; ctx.fillRect(x, y - s / 2, s, s); ctx.fillStyle = WHITE; ctx.font = `bold ${s * 0.78}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), x + s / 2, y + s * 0.04); };
  const S = {
    /** Blue directional: text (+optional sub) with an arrow; pills = [{name,color,textColor}] drawn before the text. */
    dir(text, arrow = 'left', { sub = null, pills = [], w = 1024, h = 256 } = {}) {
      return drawn(T, `dir:${text}:${arrow}:${sub}:${pills.map(p => p.name).join()}:${w}x${h}`, w, h, ctx => {
        ctx.fillStyle = BLUE; ctx.fillRect(0, 0, w, h); const s = h * 0.55; let x = w * 0.04;
        if (arrow && arrow !== 'right' && arrow !== 'downright' && arrow !== 'upright') { T.drawArrow(ctx, x + s * 0.5, h / 2, s, arrow, WHITE); x += s * 1.25; }
        const ph = h * 0.34; for (const p of pills) { x += T.drawLinePill(ctx, x, h / 2 - ph / 2, ph, p.name, p.color, { textColor: p.textColor || WHITE }) + h * 0.08; }
        ctx.fillStyle = WHITE; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        if (sub) { ctx.font = `bold ${h * 0.36}px ${FONT}`; ctx.fillText(text, x, h * 0.36); ctx.font = `normal ${h * 0.24}px ${FONT}`; ctx.fillText(sub, x, h * 0.72); }
        else { ctx.font = `bold ${h * 0.4}px ${FONT}`; ctx.fillText(text, x, h * 0.52); }
        if (arrow === 'right' || arrow === 'downright' || arrow === 'upright') T.drawArrow(ctx, w - s * 0.7, h / 2, s, arrow, WHITE);
      });
    },
    /** 'Way out' (yellow) + black exit-number badge + destinations, arrow in yellow. Height grows with the exit list (faces keep their aspect). */
    wayOut(arrow, exits, { w = 1024 } = {}) {
      const n = exits.length; const h = n <= 1 ? 256 : 150 + 84 * n;
      return drawn(T, `wayout:${arrow}:${JSON.stringify(exits)}:${w}x${h}`, w, h, ctx => {
        ctx.fillStyle = BLUE; ctx.fillRect(0, 0, w, h); const s = 140; const right = arrow === 'right' || arrow === 'upright' || arrow === 'downright'; let x = 40;
        if (!right) { T.drawArrow(ctx, x + s * 0.5, h / 2, s, arrow, YELLOW); x += s * 1.2; }
        const x1 = right ? w - s * 1.3 : w - 30;
        ctx.fillStyle = YELLOW; ctx.font = `bold 104px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const fit = (text, size, maxW) => { let fs = size; ctx.font = `normal ${fs}px ${FONT}`; while (ctx.measureText(text).width > maxW && fs > 20) { fs -= 2; ctx.font = `normal ${fs}px ${FONT}`; } return fs; };
        if (n <= 1) { const e = exits[0]; ctx.fillText('Way out', x, 92); const tw = ctx.measureText('Way out').width; let bx = x + tw + 34; if (e && e.n != null) { badge(ctx, bx, 92, 84, e.n); } if (e) { ctx.fillStyle = WHITE; fit(e.text, 62, x1 - x); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(e.text, x, 196); } }
        else { ctx.fillText('Way out', x, 84); let yy = 170; for (const e of exits) { if (e.n != null) badge(ctx, x, yy, 62, e.n); ctx.fillStyle = WHITE; fit(e.text, 58, x1 - x - 80); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(e.text, x + 80, yy); yy += 84; } }
        if (right) T.drawArrow(ctx, w - s * 0.7, h / 2, s, arrow, YELLOW);
      });
    },
    /** The photographed subway panel: '← Exit 1 Westminster Pier / ← Exit 2 Victoria Embankment / Exit 3 → Houses of Parliament'. rows = [{arrow, n, text}] */
    exitRows(rows, { w = 1024, h = 512 } = {}) {
      return drawn(T, `exitrows:${JSON.stringify(rows)}:${w}x${h}`, w, h, ctx => {
        ctx.fillStyle = BLUE; ctx.fillRect(0, 0, w, h); const rh = h / rows.length; const s = rh * 0.62;
        rows.forEach((r, i) => {
          const y = rh * (i + 0.5); let x = w * 0.04; const right = r.arrow === 'right';
          if (!right) { T.drawArrow(ctx, x + s * 0.5, y, s, r.arrow, WHITE); x += s * 1.3; }
          ctx.fillStyle = WHITE; ctx.font = `bold ${rh * 0.42}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Exit', x, y); x += ctx.measureText('Exit ').width;
          badge(ctx, x, y, rh * 0.5, r.n); x += rh * 0.66; ctx.fillStyle = WHITE; ctx.font = `bold ${rh * 0.42}px ${FONT}`; ctx.fillText(r.text, x, y);
          if (right) T.drawArrow(ctx, w - s * 0.7, y, s, 'right', WHITE);
        });
      });
    },
    /** Line sign: pills (line names) + text + arrow; e.g. Jubilee line ↓ / District and Circle lines ↓ Platforms 1 & 2. */
    lineSign(pills, text, arrow, { sub = null, w = 1024, h = 320 } = {}) {
      return drawn(T, `linesign:${pills.map(p => p.name).join()}:${text}:${arrow}:${sub}:${w}x${h}`, w, h, ctx => {
        ctx.fillStyle = BLUE; ctx.fillRect(0, 0, w, h); const s = h * 0.5; let x = w * 0.04; const right = arrow === 'right' || arrow === 'downright';
        if (arrow && !right) { T.drawArrow(ctx, x + s * 0.5, h / 2, s, arrow, WHITE); x += s * 1.25; }
        const ph = h * 0.3; let px = x; for (const p of pills) { px += T.drawLinePill(ctx, px, h * 0.16, ph, p.name, p.color, { textColor: p.textColor || WHITE }) + h * 0.06; }
        ctx.fillStyle = WHITE; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `bold ${h * 0.3}px ${FONT}`; ctx.fillText(text, x, h * 0.7);
        if (sub) { ctx.font = `normal ${h * 0.18}px ${FONT}`; ctx.fillText(sub, x + ctx.measureText(text).width * 1.0 + h * 0.25, h * 0.7); }
        if (right) T.drawArrow(ctx, w - s * 0.7, h / 2, s, arrow, WHITE);
      });
    },
    /** White panel with a line-colour band on top (the photographed Westminster platform-entrance style). */
    whitePanel(bands, lines, { w = 1024, h = 384, arrow = null } = {}) {
      return drawn(T, `whitepanel:${bands.join()}:${lines.map(l => l.text).join('|')}:${arrow}:${w}x${h}`, w, h, ctx => {
        ctx.fillStyle = WHITE; ctx.fillRect(0, 0, w, h); const bh = h * 0.1; bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * w / bands.length, 0, w / bands.length, bh); });
        let y = bh + h * 0.12; let x = w * 0.05; if (arrow) { T.drawArrow(ctx, x + h * 0.2, h * 0.58, h * 0.4, arrow, BLACK); x += h * 0.55; }
        for (const l of lines) { ctx.fillStyle = l.color || BLACK; ctx.font = `${l.weight || 'bold'} ${h * (l.size || 0.22)}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(l.text, x, y); y += h * (l.size || 0.22) * 1.3; }
      });
    },
    /** Blue 'Tickets' header with a roundel (top of a ticket machine). */
    ticketsHeader() { return T.sign({ width: 1024, height: 192, bg: BLUE, lines: [{ text: 'Tickets', x: 40, y: 135, size: 120, color: WHITE }], roundels: [{ x: 900, y: 96, r: 70, text: '' }] }); },
    /** Ticket-machine touch screen. */
    machineScreen() {
      return drawn(T, 'machineScreen', 640, 480, ctx => {
        ctx.fillStyle = '#0a1e6e'; ctx.fillRect(0, 0, 640, 480); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 640, 70); T.drawRoundel(ctx, 50, 35, 26, { text: '' });
        ctx.fillStyle = BLACK; ctx.font = `bold 34px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Tickets and Oyster', 95, 36);
        ctx.fillStyle = WHITE; ctx.font = `bold 40px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('Touch the screen to start', 320, 150);
        const btn = (x, y, t, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 280, 80); ctx.fillStyle = WHITE; ctx.font = `bold 28px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(t, x + 140, y + 40); };
        btn(30, 220, 'Top up Oyster', '#0f8f3a'); btn(330, 220, 'Buy tickets', '#0d6fb8'); btn(30, 320, 'Travelcards', '#b8621b'); btn(330, 320, 'Check balance', '#5c3e93');
        ctx.fillStyle = YELLOW; ctx.font = `normal 22px ${FONT}`; ctx.fillText('Contactless payment cards are accepted at the gates — no ticket needed', 320, 440);
      });
    },
    /** Small yellow reader label. */
    touchHere() { return T.sign({ width: 512, height: 160, bg: YELLOW, lines: [{ text: 'Touch your Oyster card here', x: 256, y: 70, size: 34, color: BLACK, align: 'center' }, { text: 'to top up or check your balance', x: 256, y: 120, size: 28, color: BLACK, align: 'center', weight: 'normal' }] }); },
    cardSlot() { return T.sign({ width: 256, height: 96, bg: '#2a2a2a', lines: [{ text: 'Insert card', x: 128, y: 40, size: 30, color: WHITE, align: 'center', weight: 'normal' }, { text: 'chip and PIN', x: 128, y: 78, size: 24, color: '#bbbbbb', align: 'center', weight: 'normal' }] }); },
    coinsNotes() { return T.sign({ width: 256, height: 96, bg: '#2a2a2a', lines: [{ text: 'Coins', x: 64, y: 58, size: 34, color: WHITE, align: 'center', weight: 'normal' }, { text: 'Notes', x: 192, y: 58, size: 34, color: WHITE, align: 'center', weight: 'normal' }] }); },
    /** Cash machine fascia. */
    cashFascia() { return T.sign({ width: 512, height: 160, bg: '#0b3d91', lines: [{ text: 'Cash', x: 30, y: 105, size: 96, color: WHITE }, { text: 'Free withdrawals  ·  £ / €', x: 260, y: 100, size: 30, color: WHITE, weight: 'normal' }] }); },
    cashScreen() { return T.sign({ width: 512, height: 384, bg: '#0d2a5e', lines: [{ text: 'Insert your card', x: 256, y: 140, size: 44, color: WHITE, align: 'center' }, { text: 'Cash withdrawal  ·  Balance', x: 256, y: 210, size: 30, color: '#dfe6ff', align: 'center', weight: 'normal' }, { text: 'Euro withdrawals available', x: 256, y: 270, size: 30, color: YELLOW, align: 'center', weight: 'normal' }] }); },
    /** Help point face (dossier §12.9): blue, white 'Help point', green Information / red Emergency buttons, grille, loop symbol. */
    helpPoint() {
      return drawn(T, 'helpPoint', 448, 576, ctx => {
        ctx.fillStyle = BLUE; ctx.fillRect(0, 0, 448, 576); ctx.fillStyle = WHITE; ctx.font = `bold 62px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Help point', 224, 60);
        for (let r = 0; r < 6; r++) for (let c = 0; c < 14; c++) { ctx.fillStyle = '#c9cfe6'; ctx.beginPath(); ctx.arc(70 + c * 24, 130 + r * 22, 5, 0, Math.PI * 2); ctx.fill(); }
        const button = (y, color, label) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(120, y, 62, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(108, y - 12, 34, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = WHITE; ctx.font = `bold 40px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(label, 205, y); };
        button(330, '#12a54a', 'Information'); button(470, '#d7261e', 'Emergency');
        ctx.strokeStyle = WHITE; ctx.lineWidth = 4; ctx.strokeRect(370, 40, 50, 40); ctx.font = `bold 24px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('T', 395, 60);
        ctx.font = `normal 20px ${FONT}`; ctx.fillText('Press and speak', 224, 545);
      });
    },
    noSmoking() {
      return drawn(T, 'noSmoking', 512, 384, ctx => {
        ctx.fillStyle = WHITE; ctx.fillRect(0, 0, 512, 384); ctx.strokeStyle = '#d7261e'; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(100, 110, 70, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = BLACK; ctx.fillRect(55, 100, 90, 18); ctx.fillStyle = '#d7261e'; ctx.fillRect(135, 100, 12, 18); ctx.save(); ctx.translate(100, 110); ctx.rotate(-Math.PI / 4); ctx.fillStyle = '#d7261e'; ctx.fillRect(-80, -8, 160, 16); ctx.restore();
        ctx.fillStyle = BLACK; ctx.font = `bold 54px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('No smoking', 195, 110);
        ctx.font = `normal 30px ${FONT}`; ctx.fillText('It is against the law to smoke', 30, 250); ctx.fillText('in these premises', 30, 295);
      });
    },
    cctv() {
      return drawn(T, 'cctv', 512, 320, ctx => {
        ctx.fillStyle = WHITE; ctx.fillRect(0, 0, 512, 320); ctx.fillStyle = BLACK; ctx.fillRect(40, 60, 120, 60); ctx.beginPath(); ctx.moveTo(160, 70); ctx.lineTo(210, 50); ctx.lineTo(210, 130); ctx.lineTo(160, 110); ctx.fill(); ctx.fillRect(90, 120, 16, 50);
        ctx.font = `bold 54px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('CCTV', 240, 90);
        ctx.font = `normal 27px ${FONT}`; ctx.fillText('Cameras are in operation on this station', 30, 210); ctx.fillText('for your safety and security', 30, 250);
      });
    },
    ticketReady() { return T.sign({ width: 1024, height: 256, bg: BLUE, lines: [{ text: 'Please have your ticket', x: 512, y: 105, size: 84, color: WHITE, align: 'center' }, { text: 'or contactless card ready', x: 512, y: 200, size: 84, color: WHITE, align: 'center' }] }); },
    wifi() { return drawn(T, 'wifi', 512, 384, ctx => { ctx.fillStyle = WHITE; ctx.fillRect(0, 0, 512, 384); ctx.strokeStyle = '#0019a8'; ctx.lineWidth = 18; for (const r of [60, 110, 160]) { ctx.beginPath(); ctx.arc(256, 190, r, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); } ctx.fillStyle = '#0019a8'; ctx.beginPath(); ctx.arc(256, 190, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = BLACK; ctx.font = `bold 50px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('WiFi', 256, 270); ctx.font = `normal 26px ${FONT}`; ctx.fillText('Free WiFi on the Underground', 256, 330); }); },
    visitMachines() { return T.sign({ width: 1024, height: 320, bg: WHITE, lines: [{ text: 'Ticket office closed', x: 512, y: 110, size: 90, color: BLACK, align: 'center' }, { text: 'Visit the ticket machines', x: 512, y: 210, size: 70, color: BLACK, align: 'center', weight: 'normal' }, { text: 'Staff are available to help at the gateline', x: 512, y: 280, size: 40, color: '#444', align: 'center', weight: 'normal' }], fills: [{ x: 0, y: 0, w: 1024, h: 24, color: '#0019a8' }] }); },
    gatelineAssist() { return T.sign({ width: 768, height: 192, bg: BLUE, lines: [{ text: 'Gateline assistance', x: 384, y: 120, size: 70, color: WHITE, align: 'center' }] }); },
    lift(text, arrow = 'up') { return drawn(T, `lift:${text}:${arrow}`, 768, 256, ctx => { ctx.fillStyle = BLUE; ctx.fillRect(0, 0, 768, 256); T.drawArrow(ctx, 70, 128, 120, arrow, WHITE); wheelchair(ctx, 190, 128, 46, WHITE); ctx.fillStyle = WHITE; ctx.font = `bold 80px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Lift', 270, 95); ctx.font = `normal 44px ${FONT}`; ctx.fillText(text, 270, 180); }); },
    liftDoorLabel(text) { return T.sign({ width: 512, height: 128, bg: '#222', lines: [{ text, x: 256, y: 82, size: 54, color: WHITE, align: 'center', weight: 'normal' }] }); },
    passHolders() { return drawn(T, 'passHolders', 768, 512, ctx => { ctx.fillStyle = WHITE; ctx.fillRect(0, 0, 768, 512); ctx.fillStyle = '#0b3d2e'; ctx.fillRect(0, 0, 768, 110); ctx.fillStyle = WHITE; ctx.font = `bold 60px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Houses of Parliament', 384, 55); ctx.fillStyle = BLACK; ctx.font = `bold 52px ${FONT}`; ctx.fillText('Members and pass holders only', 384, 220); ctx.font = `normal 36px ${FONT}`; ctx.fillText('No public access — please use Exit 3', 384, 320); ctx.fillText('for the Houses of Parliament visitor entrance', 384, 370); ctx.strokeStyle = '#d7261e'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(384, 455, 34, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#d7261e'; ctx.fillRect(360, 449, 48, 12); }); },
    toilets() { return drawn(T, 'toilets', 768, 256, ctx => { ctx.fillStyle = BLUE; ctx.fillRect(0, 0, 768, 256); figure(ctx, 70, 128, 44, WHITE, false); figure(ctx, 150, 128, 44, WHITE, true); ctx.fillStyle = WHITE; ctx.font = `bold 78px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Toilets', 230, 100); ctx.font = `normal 40px ${FONT}`; ctx.fillText('50p  ·  Parent and baby room', 230, 180); T.drawArrow(ctx, 700, 128, 110, 'right', WHITE); }); },
    cyclists() { return T.sign({ width: 512, height: 192, bg: WHITE, lines: [{ text: 'Cyclists dismount', x: 256, y: 110, size: 56, color: BLACK, align: 'center' }], border: { color: '#d7261e', width: 14 } }); },
    publicSubway() { return T.sign({ width: 1024, height: 160, bg: BLUE, lines: [{ text: 'Public subway', x: 512, y: 110, size: 96, color: WHITE, align: 'center' }] }); },
    stationFascia() { return T.sign({ width: 2048, height: 192, bg: BLUE, lines: [{ text: 'WESTMINSTER STATION', x: 1100, y: 135, size: 120, color: WHITE, align: 'center', letterSpacing: '6px' }], roundels: [{ x: 160, y: 96, r: 78, text: '' }] }); },
    clockFace() { return drawn(T, 'clockFace', 512, 512, ctx => { ctx.fillStyle = '#f4f3ef'; ctx.fillRect(0, 0, 512, 512); ctx.fillStyle = BLACK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; const big = i % 5 === 0; ctx.save(); ctx.translate(256 + Math.sin(a) * 225, 256 - Math.cos(a) * 225); ctx.rotate(a); ctx.fillRect(-(big ? 5 : 2), -(big ? 22 : 10), big ? 10 : 4, big ? 44 : 20); ctx.restore(); } ctx.font = `bold 52px ${FONT}`; for (let n = 1; n <= 12; n++) { const a = n / 12 * Math.PI * 2; ctx.fillText(String(n), 256 + Math.sin(a) * 165, 256 - Math.cos(a) * 165 + 4); } T.drawRoundel(ctx, 256, 350, 26, { text: '' }); }); },
    greenArrow() { return drawn(T, 'gateGreen', 128, 128, ctx => { ctx.fillStyle = '#062a0a'; ctx.fillRect(0, 0, 128, 128); T.drawArrow(ctx, 64, 64, 96, 'up', '#3cff5a'); }); },
    redCross() { return drawn(T, 'gateRed', 128, 128, ctx => { ctx.fillStyle = '#2a0606'; ctx.fillRect(0, 0, 128, 128); ctx.strokeStyle = '#ff2a2a'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(30, 30); ctx.lineTo(98, 98); ctx.moveTo(98, 30); ctx.lineTo(30, 98); ctx.stroke(); }); },
    readerLCD(text = 'ENTER') { return T.sign({ width: 256, height: 192, bg: '#0a2a80', lines: [{ text, x: 128, y: 80, size: 54, color: WHITE, align: 'center' }, { text: 'Touch in', x: 128, y: 150, size: 34, color: '#cfd8ff', align: 'center', weight: 'normal' }] }); },
    /** Oyster reader disc: yellow with a dark-blue roundel outline (transparent corners). */
    oysterDisc() { return drawn(T, 'oysterDisc', 256, 256, ctx => { ctx.clearRect(0, 0, 256, 256); ctx.fillStyle = '#ffd200'; ctx.beginPath(); ctx.arc(128, 128, 126, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f0c400'; ctx.beginPath(); ctx.arc(128, 128, 96, 0, Math.PI * 2); ctx.fill(); T.drawRoundel(ctx, 128, 128, 60, { text: '', ringColor: '#0019a8', barColor: '#0019a8' }); }, true); },
    /** Service status board: every line 'Good service'. */
    serviceStatus(now) {
      const lines = [['Bakerloo', PALETTE.bakerloo], ['Central', PALETTE.central], ['Circle', PALETTE.circle], ['District', PALETTE.district], ['Hammersmith & City', PALETTE.hammersmith], ['Jubilee', PALETTE.jubilee], ['Metropolitan', PALETTE.metropolitan], ['Northern', PALETTE.northern], ['Piccadilly', PALETTE.piccadilly], ['Victoria', PALETTE.victoria], ['Waterloo & City', PALETTE.waterlooCity], ['Elizabeth line', PALETTE.elizabeth], ['DLR', PALETTE.dlr], ['London Overground', PALETTE.overground]];
      return drawn(T, 'serviceStatus', 768, 1024, ctx => {
        ctx.fillStyle = WHITE; ctx.fillRect(0, 0, 768, 1024); ctx.fillStyle = '#0019a8'; ctx.fillRect(0, 0, 768, 96); T.drawRoundel(ctx, 60, 48, 36, { text: '' });
        ctx.fillStyle = WHITE; ctx.font = `bold 44px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Service update', 120, 48);
        ctx.font = `normal 24px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText(now || '', 740, 48);
        lines.forEach(([name, color], i) => {
          const y = 130 + i * 62; ctx.fillStyle = '#' + color.toString(16).padStart(6, '0'); ctx.fillRect(24, y, 330, 46); ctx.fillStyle = (name === 'Circle' || name === 'Hammersmith & City' || name === 'Waterloo & City') ? '#0019a8' : WHITE; ctx.font = `bold 27px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(name, 40, y + 23);
          ctx.fillStyle = '#e8f3e8'; ctx.fillRect(370, y, 374, 46); ctx.fillStyle = '#0a6b2b'; ctx.font = `normal 27px ${FONT}`; ctx.fillText('Good service', 390, y + 23);
        });
        ctx.fillStyle = '#444'; ctx.font = `normal 22px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('For live updates visit tfl.gov.uk or ask a member of staff', 24, 1000);
      });
    },
    /** Station map board (schematic of this station). */
    stationMap() {
      return drawn(T, 'stationMapBoard', 1024, 768, ctx => {
        ctx.fillStyle = WHITE; ctx.fillRect(0, 0, 1024, 768); ctx.fillStyle = '#0019a8'; ctx.fillRect(0, 0, 1024, 90); T.drawRoundel(ctx, 60, 45, 34, { text: '' }); ctx.fillStyle = WHITE; ctx.font = `bold 48px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Westminster — station map', 115, 45);
        ctx.fillStyle = '#e9e9e4'; ctx.fillRect(140, 200, 620, 300); ctx.fillStyle = '#d0d0c8'; ctx.fillRect(140, 500, 760, 60); ctx.fillStyle = '#c4c4bb'; ctx.fillRect(760, 300, 200, 60);
        ctx.strokeStyle = '#333'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(240, 220); ctx.lineTo(560, 400); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = '#' + PALETTE.district.toString(16).padStart(6, '0'); ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(100, 620); ctx.lineTo(900, 160); ctx.stroke();
        ctx.strokeStyle = '#' + PALETTE.circle.toString(16).padStart(6, '0'); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(100, 620); ctx.lineTo(900, 160); ctx.stroke();
        ctx.strokeStyle = '#' + PALETTE.jubilee.toString(16).padStart(6, '0'); ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(100, 560); ctx.lineTo(1000, 560); ctx.stroke();
        ctx.fillStyle = BLACK; ctx.font = `bold 24px ${FONT}`; ctx.textAlign = 'left';
        const lab = (x, y, t) => { ctx.fillStyle = BLACK; ctx.fillRect(x - 8, y - 18, 36, 36); ctx.fillStyle = WHITE; ctx.textAlign = 'center'; ctx.fillText(t[0], x + 10, y); ctx.fillStyle = BLACK; ctx.textAlign = 'left'; ctx.font = `normal 24px ${FONT}`; ctx.fillText(t.slice(2), x + 40, y); ctx.font = `bold 24px ${FONT}`; };
        lab(770, 330, '1 Westminster Pier / River Bus'); lab(770, 370, '2 Victoria Embankment'); lab(880, 640, '3 Houses of Parliament'); lab(430, 530, '4 Bridge Street'); lab(60, 330, '5 Whitehall'); lab(60, 380, '6 Parliament Street / Whitehall');
        ctx.fillStyle = '#333'; ctx.font = `normal 24px ${FONT}`; ctx.fillText('Ticket hall', 380, 260); ctx.fillText('Gateline', 330, 350); ctx.fillText('Jubilee line  ↓', 600, 470); ctx.fillText('District and Circle lines', 560, 130);
        ctx.font = `normal 20px ${FONT}`; ctx.fillText('You are here', 500, 300); ctx.fillStyle = '#d7261e'; ctx.beginPath(); ctx.arc(480, 292, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#555'; ctx.font = `normal 20px ${FONT}`; ctx.fillText('Step-free access: lift from Bridge Street to the ticket hall and to Platforms 1, 2, 3 and 4', 40, 730);
      });
    },
    /** Tube map poster (stylised — a decorative approximation of the diagram). */
    tubeMap() {
      return drawn(T, 'tubeMapPoster', 768, 1024, ctx => {
        ctx.fillStyle = WHITE; ctx.fillRect(0, 0, 768, 1024); ctx.fillStyle = '#0019a8'; ctx.fillRect(0, 0, 768, 80); T.drawRoundel(ctx, 50, 40, 30, { text: '' }); ctx.fillStyle = WHITE; ctx.font = `bold 44px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Tube map', 100, 40);
        ctx.fillStyle = '#f1f1ee'; ctx.fillRect(60, 130, 648, 800); ctx.fillStyle = '#e4e4e0'; ctx.fillRect(160, 300, 440, 340);
        const L = [[PALETTE.central, [[40, 470], [200, 470], [330, 400], [560, 400], [740, 330]]], [PALETTE.piccadilly, [[80, 900], [250, 700], [340, 540], [420, 470], [640, 300]]], [PALETTE.northern, [[380, 130], [380, 470], [400, 700], [420, 950]]], [PALETTE.victoria, [[130, 250], [300, 520], [340, 660], [520, 850]]], [PALETTE.jubilee, [[120, 220], [230, 480], [330, 620], [520, 640], [700, 560]]], [PALETTE.district, [[60, 680], [300, 620], [500, 560], [720, 470]]], [PALETTE.circle, [[300, 620], [500, 560], [520, 390], [330, 400], [240, 520], [300, 620]]], [PALETTE.metropolitan, [[70, 200], [300, 380], [520, 390]]], [PALETTE.bakerloo, [[150, 160], [330, 470], [360, 640]]], [PALETTE.elizabeth, [[40, 430], [300, 440], [560, 430], [740, 420]]], [PALETTE.hammersmith, [[40, 400], [240, 380], [520, 380]]]];
        for (const [c, pts] of L) { ctx.strokeStyle = '#' + c.toString(16).padStart(6, '0'); ctx.lineWidth = 9; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); }
        for (const [x, y] of [[330, 400], [520, 390], [300, 620], [500, 560], [380, 470], [330, 620], [420, 470], [240, 520]]) { ctx.fillStyle = WHITE; ctx.strokeStyle = BLACK; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        ctx.fillStyle = '#d7261e'; ctx.beginPath(); ctx.arc(330, 620, 12, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = BLACK; ctx.font = `bold 18px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('Westminster', 345, 640);
        ctx.font = `normal 14px ${FONT}`; ctx.fillStyle = '#333'; ['Waterloo', 'Green Park', 'Embankment', "St. James's Park", 'Oxford Circus', 'Bank', 'King\'s Cross St. Pancras', 'Victoria'].forEach((n, i) => ctx.fillText(n, 100 + (i % 4) * 160, 960 + Math.floor(i / 4) * 24));
        ctx.fillStyle = '#555'; ctx.font = `normal 18px ${FONT}`; ctx.fillText('Key: interchange stations ○   step-free access ♿   ', 70, 1005);
      });
    },
    /** Landscape billboard (48-sheet ratio) — abstract layout, no real brands. */
    billboard(seed, headline, sub) {
      return drawn(T, `billboard:${seed}:${headline}:${sub}`, 1024, 512, ctx => {
        const rnd = T.mulberry32(seed + 900); const hue = Math.floor(rnd() * 360);
        const g = ctx.createLinearGradient(0, 0, 1024, 512); g.addColorStop(0, `hsl(${hue},55%,42%)`); g.addColorStop(1, `hsl(${(hue + 50) % 360},50%,22%)`); ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 512);
        for (let i = 0; i < 7; i++) { ctx.fillStyle = `hsla(${(hue + 160 + i * 25) % 360},65%,60%,0.35)`; ctx.beginPath(); ctx.arc(rnd() * 1024, rnd() * 512, rnd() * 220 + 40, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 330, 1024, 182);
        ctx.fillStyle = WHITE; ctx.font = `bold 84px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(headline, 50, 420);
        ctx.font = `normal 38px ${FONT}`; ctx.fillText(sub, 50, 475);
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `normal 22px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText('tfl.gov.uk', 990, 480);
      });
    },
    /** Mark Wallinger 'Labyrinth' enamel panel (2013): black unicursal labyrinth on white, red X at the entrance. Stylised. */
    labyrinth() {
      return drawn(T, 'labyrinth', 512, 512, ctx => {
        ctx.fillStyle = '#f4f4f2'; ctx.fillRect(0, 0, 512, 512); ctx.strokeStyle = BLACK; ctx.lineWidth = 9; ctx.lineCap = 'round';
        for (let r = 40; r <= 220; r += 30) { const gap = (r / 30) % 4; ctx.beginPath(); ctx.arc(256, 256, r, Math.PI / 2 + gap * 0.5 + 0.35, Math.PI / 2 + gap * 0.5 + Math.PI * 2 - 0.35); ctx.stroke(); }
        for (let k = 0; k < 6; k++) { const a = Math.PI / 2 + k * 1.05; const r0 = 40 + k * 30, r1 = r0 + 30; ctx.beginPath(); ctx.moveTo(256 + Math.cos(a) * r0, 256 + Math.sin(a) * r0); ctx.lineTo(256 + Math.cos(a) * r1, 256 + Math.sin(a) * r1); ctx.stroke(); }
        ctx.strokeStyle = '#d7261e'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(240, 468); ctx.lineTo(272, 500); ctx.moveTo(272, 468); ctx.lineTo(240, 500); ctx.stroke();
        ctx.fillStyle = '#333'; ctx.font = `normal 18px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('Labyrinth #131 / 270', 12, 505); ctx.textAlign = 'right'; ctx.fillText('Mark Wallinger, 2013', 500, 24);
      });
    },
    /** 'HMS Westminster is proud to be associated with London Underground' plaque with the 32 m below mean sea level text (dossier §12.5). */
    hmsPlaque() {
      return drawn(T, 'hmsPlaque', 640, 480, ctx => {
        ctx.fillStyle = '#2b2f6b'; ctx.fillRect(0, 0, 640, 480); ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 8; ctx.strokeRect(14, 14, 612, 452);
        ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.arc(320, 96, 46, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#2b2f6b'; ctx.beginPath(); ctx.arc(320, 96, 36, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.moveTo(320, 68); ctx.lineTo(332, 100); ctx.lineTo(320, 124); ctx.lineTo(308, 100); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f2e6bf'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold 34px ${FONT}`; ctx.fillText('HMS WESTMINSTER', 320, 176);
        ctx.font = `normal 26px ${FONT}`; ['is proud to be associated with', 'London Underground', '', 'Westminster station: at its lowest point', 'the station is 32 m below mean sea level,', 'deeper than any other location', 'on the Tube network'].forEach((l, i) => ctx.fillText(l, 320, 222 + i * 34));
      });
    },
    seeItSayIt() { return T.sign({ width: 512, height: 768, bg: '#0019a8', lines: [{ text: 'See it.', x: 40, y: 220, size: 100, color: WHITE }, { text: 'Say it.', x: 40, y: 340, size: 100, color: WHITE }, { text: 'Sorted.', x: 40, y: 460, size: 100, color: YELLOW }, { text: 'If you see something that doesn\'t look right,', x: 40, y: 580, size: 26, color: WHITE, weight: 'normal' }, { text: 'speak to staff or text the British Transport', x: 40, y: 620, size: 26, color: WHITE, weight: 'normal' }, { text: 'Police on 61016.', x: 40, y: 660, size: 26, color: WHITE, weight: 'normal' }] }); },
    holdHandrail() { return T.sign({ width: 512, height: 640, bg: BLUE, lines: [{ text: 'Please hold', x: 256, y: 300, size: 60, color: WHITE, align: 'center' }, { text: 'the handrail', x: 256, y: 380, size: 60, color: WHITE, align: 'center' }, { text: 'Keep hold of children', x: 256, y: 560, size: 36, color: WHITE, align: 'center', weight: 'normal' }] }); },
    fireExit(dir = 'right') { return drawn(T, 'fireExit:' + dir, 512, 256, ctx => { ctx.fillStyle = '#009639'; ctx.fillRect(0, 0, 512, 256); runningMan(ctx, dir === 'left' ? 400 : 110, 128, 90, WHITE, dir === 'left'); ctx.fillStyle = WHITE; ctx.font = `bold 62px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Fire exit', dir === 'left' ? 40 : 200, 128); T.drawArrow(ctx, dir === 'left' ? 470 : 42, 200, 50, dir, WHITE); }); },
    fireAction() { return T.sign({ width: 512, height: 640, bg: '#0a5fb4', lines: [{ text: 'Fire action', x: 256, y: 80, size: 60, color: WHITE, align: 'center' }, { text: 'If you discover a fire:', x: 30, y: 180, size: 32, color: WHITE }, { text: '1. Raise the alarm', x: 30, y: 240, size: 30, color: WHITE, weight: 'normal' }, { text: '2. Leave by the nearest exit', x: 30, y: 290, size: 30, color: WHITE, weight: 'normal' }, { text: '3. Do not use the lifts', x: 30, y: 340, size: 30, color: WHITE, weight: 'normal' }, { text: 'On hearing the alarm', x: 30, y: 430, size: 32, color: WHITE }, { text: 'leave the station immediately', x: 30, y: 480, size: 30, color: WHITE, weight: 'normal' }, { text: 'Assembly point: Bridge Street', x: 30, y: 570, size: 30, color: YELLOW, weight: 'normal' }] }); },
    breakGlass() { return T.sign({ width: 128, height: 128, bg: '#d7261e', lines: [{ text: 'FIRE', x: 64, y: 55, size: 34, color: WHITE, align: 'center' }, { text: 'break glass', x: 64, y: 95, size: 18, color: WHITE, align: 'center', weight: 'normal' }] }); },
    payphone() { return T.sign({ width: 512, height: 128, bg: '#1b1b1b', lines: [{ text: 'Phone', x: 256, y: 90, size: 84, color: WHITE, align: 'center' }] }); },
    /** Stair-head panel: roundel + 'Exit [n]' badge + destination (blue). */
    exitNumberPlate(n, text) {
      return drawn(T, `exitPlate:${n}:${text}`, 1024, 320, ctx => {
        ctx.fillStyle = BLUE; ctx.fillRect(0, 0, 1024, 320); T.drawRoundel(ctx, 900, 160, 100, { text: '' });
        ctx.fillStyle = WHITE; ctx.font = `bold 110px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Exit', 40, 120); badge(ctx, 290, 120, 130, n);
        ctx.fillStyle = WHITE; ctx.font = `normal 64px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, 40, 250);
      });
    },
    exitBadgeOnly(n) { return T.sign({ width: 128, height: 128, bg: BLACK, lines: [{ text: String(n), x: 64, y: 108, size: 110, color: WHITE, align: 'center' }] }); },
    keepLeft() { return T.sign({ width: 512, height: 256, bg: BLUE, lines: [{ text: 'Keep left', x: 300, y: 150, size: 70, color: WHITE, align: 'center' }], arrows: [{ dir: 'left', x: 70, y: 128, size: 100 }] }); },
    stairsAhead() { return T.sign({ width: 768, height: 192, bg: BLUE, lines: [{ text: 'Mind the step', x: 384, y: 120, size: 70, color: WHITE, align: 'center' }] }); },
    priorityNotice() { return T.sign({ width: 512, height: 384, bg: WHITE, lines: [{ text: 'Baby on board?', x: 256, y: 90, size: 46, color: BLACK, align: 'center' }, { text: 'Please offer your seat', x: 256, y: 160, size: 34, color: '#333', align: 'center', weight: 'normal' }, { text: 'to those who need it more', x: 256, y: 205, size: 34, color: '#333', align: 'center', weight: 'normal' }, { text: 'Free badges from the ticket office', x: 256, y: 330, size: 24, color: '#666', align: 'center', weight: 'normal' }], fills: [{ x: 0, y: 0, w: 512, h: 20, color: '#0019a8' }] }); },
    stepFreeNotice() { return T.sign({ width: 768, height: 256, bg: BLUE, lines: [{ text: 'Step-free access to all platforms', x: 40, y: 110, size: 52, color: WHITE }, { text: 'Lifts to Platforms 1, 2, 3 and 4', x: 40, y: 190, size: 44, color: WHITE, weight: 'normal' }] }); },
    lineDiagramDC() { return T.lineDiagram({ line: 'District and Circle', color: '#00782a', stations: ['Ealing Broadway', 'Earl\'s Court', 'Victoria', "St. James's Park", 'Westminster', 'Embankment', 'Monument', 'Tower Hill', 'Upminster'], current: 'Westminster' }); },
  };
  return S;
}

/** Cache-aware custom-drawn texture: draw(ctx) on a fresh canvas; transparent = keep alpha. */
const drawnCache = new Map();
function drawn(T, key, w, h, draw, transparent = false) {
  if (drawnCache.has(key)) return drawnCache.get(key);
  const c = T.canvas(w, h); const ctx = c.getContext('2d'); draw(ctx);
  const t = T.toTexture(c, { wrap: THREE.ClampToEdgeWrapping }); t.userData = { transparent }; drawnCache.set(key, t); return t;
}
function wheelchair(ctx, x, y, r, color) { ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = r * 0.22; ctx.beginPath(); ctx.arc(x, y + r * 0.35, r * 0.65, Math.PI * 0.75, Math.PI * 2.55); ctx.stroke(); ctx.beginPath(); ctx.arc(x + r * 0.05, y - r * 0.85, r * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + r * 0.05, y - r * 0.55); ctx.lineTo(x + r * 0.05, y + r * 0.1); ctx.lineTo(x + r * 0.7, y + r * 0.1); ctx.lineTo(x + r * 0.95, y + r * 0.7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + r * 0.05, y - r * 0.25); ctx.lineTo(x + r * 0.6, y - r * 0.25); ctx.stroke(); ctx.restore(); }
function figure(ctx, x, y, r, color, female) { ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y - r * 1.4, r * 0.3, 0, Math.PI * 2); ctx.fill(); if (female) { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x - r * 0.6, y + r * 0.5); ctx.lineTo(x + r * 0.6, y + r * 0.5); ctx.closePath(); ctx.fill(); } else ctx.fillRect(x - r * 0.3, y - r, r * 0.6, r * 1.5); ctx.fillRect(x - r * 0.28, y + r * 0.5, r * 0.22, r * 1.1); ctx.fillRect(x + r * 0.06, y + r * 0.5, r * 0.22, r * 1.1); ctx.restore(); }
function runningMan(ctx, x, y, s, color, flip) { ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(s * 0.15, -s * 0.42, s * 0.12, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(s * 0.05, -s * 0.25); ctx.lineTo(-s * 0.1, s * 0.05); ctx.lineTo(-s * 0.35, s * 0.35); ctx.moveTo(-s * 0.1, s * 0.05); ctx.lineTo(s * 0.2, s * 0.15); ctx.lineTo(s * 0.15, s * 0.45); ctx.moveTo(s * 0.05, -s * 0.25); ctx.lineTo(s * 0.35, -s * 0.15); ctx.lineTo(s * 0.5, -s * 0.35); ctx.moveTo(s * 0.05, -s * 0.25); ctx.lineTo(-s * 0.25, -s * 0.2); ctx.stroke(); ctx.restore(); }

// ======================================================================= fixtures
/** Sign material factory with per-texture cache (emissive so it reads under the dim hall light). */
export function signMatFactory(M) {
  const cache = new Map();
  return (tex, { emissive = 0.55, transparent = false, doubleSided = false } = {}) => {
    const key = tex.uuid + ':' + emissive + ':' + transparent + ':' + doubleSided; if (cache.has(key)) return cache.get(key);
    const m = M.signMaterial(tex, { emissive, transparent: transparent || !!(tex.userData && tex.userData.transparent), side: doubleSided ? THREE.DoubleSide : THREE.FrontSide }); cache.set(key, m); return m;
  };
}

/**
 * Suspended double-sided sign box (front faces `facing`), hung from the beam soffit on two rods.
 * merger: Merger; mats: { box, rod }; front/back: sign materials; w,h in metres; yBottom = underside height.
 */
/** Face size that fits a w × h panel while keeping the sign texture's aspect ratio. */
function faceFit(mat, w, h) { const img = mat && mat.map && mat.map.image; const a = img && img.width && img.height ? img.width / img.height : w / h; let fw = w, fh = fw / a; if (fh > h) { fh = h; fw = fh * a; } return [fw, fh]; }

export function hangSign(merger, mats, front, back, w, h, { x, z, yBottom, yRodTop, facing = 'south', ry = null, depth = 0.1 } = {}) {
  const yc = yBottom + h / 2; const rot = ry != null ? ry : ({ south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }[facing] ?? 0);
  merger.box(mats.box, w, h, depth, { x, y: yc, z, ry: rot }, false);
  const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot); const side = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
  const [fw, fh] = faceFit(front, w - 0.02, h - 0.02); merger.quad(front, fw, fh, { x: x + fwd.x * (depth / 2 + 0.003), y: yc, z: z + fwd.z * (depth / 2 + 0.003), ry: rot });
  if (back) { const [bw, bh] = faceFit(back, w - 0.02, h - 0.02); merger.quad(back, bw, bh, { x: x - fwd.x * (depth / 2 + 0.003), y: yc, z: z - fwd.z * (depth / 2 + 0.003), ry: rot + Math.PI }); }
  if (yRodTop != null && yRodTop > yBottom + h) for (const s of [-1, 1]) { const rx = x + side.x * (w / 2 - 0.15) * s, rz = z + side.z * (w / 2 - 0.15) * s; merger.tube(mats.rod, new THREE.Vector3(rx, yBottom + h, rz), new THREE.Vector3(rx, yRodTop, rz), 0.012, 6); }
}

/** Flat wall-mounted sign plate (thin box + face), `facing` = direction the face points. */
export function wallSign(merger, mats, face, w, h, { x, y, z, facing = 'south', ry = null, depth = 0.02 } = {}) {
  const rot = ry != null ? ry : ({ south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }[facing] ?? 0);
  const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
  if (depth > 0.004) merger.box(mats.box, w, h, depth, { x: x - fwd.x * depth / 2, y, z: z - fwd.z * depth / 2, ry: rot }, false);
  const [fw, fh] = faceFit(face, w - 0.01, h - 0.01); merger.quad(face, fw, fh, { x: x + fwd.x * 0.003, y, z: z + fwd.z * 0.003, ry: rot });
}

/** Poster frame (4-sheet 1016 × 1524 portrait, 150 mm border) with a poster inside. */
export function posterFrame(merger, mats, posterMat, { x, y, z, facing = 'south', ry = null, w = 1.016, h = 1.524, border = 0.075 } = {}) {
  const rot = ry != null ? ry : ({ south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }[facing] ?? 0);
  const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
  merger.box(mats.frame, w + border * 2, h + border * 2, 0.03, { x: x - fwd.x * 0.015, y, z: z - fwd.z * 0.015, ry: rot }, false);
  merger.quad(posterMat, w, h, { x: x + fwd.x * 0.004, y, z: z + fwd.z * 0.004, ry: rot });
}

/** Help point: stainless surround, blue face, at 1.2 m centre. Registers nothing (wall-mounted). */
export function helpPoint(merger, mats, faceMat, { x, y, z, facing }) {
  const rot = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }[facing] ?? 0; const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
  merger.box(mats.stainless, 0.42, 0.54, 0.08, { x: x + fwd.x * 0.04, y, z: z + fwd.z * 0.04, ry: rot }, false);
  merger.quad(faceMat, 0.35, 0.45, { x: x + fwd.x * 0.083, y, z: z + fwd.z * 0.083, ry: rot });
}

/** Extinguisher pair (water red + CO2 red with black horn) on a stainless bracket. */
export function extinguishers(merger, mats, { x, y, z, facing }) {
  const rot = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }[facing] ?? 0; const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot); const side = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
  merger.box(mats.stainless, 0.6, 0.9, 0.03, { x: x + fwd.x * 0.015, y: y + 0.45, z: z + fwd.z * 0.015, ry: rot }, false);
  for (const s of [-0.14, 0.14]) { const cx = x + fwd.x * 0.14 + side.x * s, cz = z + fwd.z * 0.14 + side.z * s; merger.cyl(mats.red, 0.075, 0.075, 0.55, 12, { x: cx, y: y + 0.28, z: cz }); merger.cyl(mats.black, 0.02, 0.02, 0.12, 8, { x: cx, y: y + 0.6, z: cz }); if (s > 0) merger.cyl(mats.black, 0.05, 0.02, 0.14, 8, { x: cx + side.x * 0.09, y: y + 0.52, z: cz + side.z * 0.09, rz: 0.5 }); }
}

/** Stainless PA speaker (JLE cylindrical enclosure) hung under a beam. Returns its world position. */
export function speaker(merger, mats, { x, y, z, ry = 0 }) {
  merger.cyl(mats.stainless, 0.09, 0.09, 0.32, 12, { x, y, z, rx: Math.PI / 2, ry });
  merger.cyl(mats.grille, 0.075, 0.075, 0.01, 12, { x: x - Math.sin(ry) * 0.165, y, z: z - Math.cos(ry) * 0.165, rx: Math.PI / 2, ry });
  merger.box(mats.stainless, 0.03, 0.1, 0.03, { x, y: y + 0.13, z }, false);
  return { x, y, z };
}

/** LU clear-bag litter bin on a black ring stand (dossier: 'clear-bag bins on black ring stands only near the gateline'). */
export function ringBin(merger, mats, { x, y, z }) {
  merger.cyl(mats.black, 0.02, 0.02, 0.9, 8, { x, y: y + 0.45, z });
  merger.cyl(mats.black, 0.22, 0.22, 0.02, 20, { x, y: y + 0.02, z });
  merger.cyl(mats.black, 0.24, 0.24, 0.03, 20, { x, y: y + 0.9, z }, true);
  merger.cyl(mats.bag, 0.2, 0.15, 0.7, 14, { x, y: y + 0.5, z });
}

/** Wall clock: stainless bezel + face; returns { hour, minute } meshes for animation (added to `parent`). */
export function wallClock(parent, mats, faceMat, { x, y, z, facing }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }[facing] ?? 0;
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 32), mats.stainless); bezel.rotation.x = Math.PI / 2; g.add(bezel);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.165, 32), faceMat); face.position.z = 0.026; g.add(face);
  const hour = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.1, 0.004), mats.black); hour.geometry.translate(0, 0.04, 0); hour.position.z = 0.03; g.add(hour);
  const minute = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.15, 0.004), mats.black); minute.geometry.translate(0, 0.065, 0); minute.position.z = 0.034; g.add(minute);
  const second = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.15, 0.003), mats.red); second.geometry.translate(0, 0.06, 0); second.position.z = 0.037; g.add(second);
  parent.add(g); return { group: g, hour, minute, second };
}

/** Tensa retractable barrier run: posts every ~2 m with a black/yellow webbing tape at 0.9 m. Registers a low blocker. */
export function tensaRun(merger, mats, collision, pts, y, tag = 'tensa') {
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]; merger.cyl(mats.stainless, 0.035, 0.035, 0.95, 10, { x: p.x, y: y + 0.475, z: p.z }); merger.cyl(mats.stainless, 0.17, 0.17, 0.02, 16, { x: p.x, y: y + 0.01, z: p.z }); merger.cyl(mats.black, 0.045, 0.045, 0.08, 10, { x: p.x, y: y + 0.95, z: p.z });
    if (i > 0) { const q = pts[i - 1]; const a = new THREE.Vector3(q.x, y + 0.9, q.z), b = new THREE.Vector3(p.x, y + 0.9, p.z); const d = b.clone().sub(a); const len = d.length(); const g = new THREE.BoxGeometry(len, 0.05, 0.004); g.rotateY(-Math.atan2(d.z, d.x)); g.translate((a.x + b.x) / 2, y + 0.9, (a.z + b.z) / 2); merger.add(mats.tape, g); collision.addBlocker({ xMin: Math.min(a.x, b.x) - 0.05, xMax: Math.max(a.x, b.x) + 0.05, yMin: y, yMax: y + 1.0, zMin: Math.min(a.z, b.z) - 0.05, zMax: Math.max(a.z, b.z) + 0.05 }, tag); }
  }
}

/** Glazed screen (paid-area fence / balustrade): stainless posts, glass panel, top rail, optional blue band. Registers a blocker. */
export function glassScreen(merger, mats, collision, a, b, y, { height = 1.8, band = false, post = 2.4, tag = 'screen', kick = true } = {}) {
  const d = new THREE.Vector3(b.x - a.x, 0, b.z - a.z); const len = d.length(); if (len < 0.05) return; const dir = d.clone().normalize(); const yaw = -Math.atan2(dir.z, dir.x);
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  merger.box(mats.glass, len, height - 0.12, 0.012, { x: mid.x, y: y + 0.06 + (height - 0.12) / 2, z: mid.z, ry: yaw }, false);
  merger.box(mats.stainless, len, 0.05, 0.05, { x: mid.x, y: y + height - 0.025, z: mid.z, ry: yaw }, false);
  if (kick) merger.box(mats.stainless, len, 0.06, 0.04, { x: mid.x, y: y + 0.03, z: mid.z, ry: yaw }, false);
  if (band) merger.box(mats.mosaic, len, 0.12, 0.016, { x: mid.x, y: y + 1.1, z: mid.z, ry: yaw }, false);
  const n = Math.max(1, Math.round(len / post)); for (let i = 0; i <= n; i++) { const t = i / n; merger.box(mats.stainless, 0.05, height, 0.05, { x: a.x + (b.x - a.x) * t, y: y + height / 2, z: a.z + (b.z - a.z) * t, ry: yaw }, false); }
  { // collision: segmented along the screen so a diagonal screen's boxes hug the glass instead of one huge AABB
    const len = Math.hypot(b.x - a.x, b.z - a.z); const n = Math.max(1, Math.ceil(len / 0.5));
    for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n; const x0 = a.x + (b.x - a.x) * t0, x1 = a.x + (b.x - a.x) * t1, z0 = a.z + (b.z - a.z) * t0, z1 = a.z + (b.z - a.z) * t1;
      collision.addBlocker({ xMin: Math.min(x0, x1) - 0.06, xMax: Math.max(x0, x1) + 0.06, yMin: y, yMax: y + height, zMin: Math.min(z0, z1) - 0.06, zMax: Math.max(z0, z1) + 0.06 }, tag); }
  }
}

/** Stainless tubular handrail from a to b (world Vector3, at hand height already) with 300 mm returns and wall brackets every 1.5 m. */
export function handrail(merger, mats, a, b, { r = 0.021, wall = null, returns = true } = {}) {
  merger.tube(mats.stainless, a, b, r, 10);
  if (returns) { const d = new THREE.Vector3().subVectors(b, a).normalize(); const ea = a.clone().sub(d.clone().multiplyScalar(0.3)).setY(a.y); const eb = b.clone().add(d.clone().multiplyScalar(0.3)).setY(b.y); merger.tube(mats.stainless, ea, a, r, 8); merger.tube(mats.stainless, b, eb, r, 8); }
  if (wall) { const n = Math.max(1, Math.floor(a.distanceTo(b) / 1.5)); for (let i = 0; i <= n; i++) { const p = a.clone().lerp(b, i / n); merger.tube(mats.stainless, p, p.clone().add(wall.clone().multiplyScalar(0.08)), 0.012, 6); } }
}

/**
 * A flight of stairs. from = bottom centre {x,y,z}, to = top centre; width; steps; landings = [{after, len}];
 * builds treads/risers (mats.tread), nosings (mats.nosing), corduroy tactiles at both ends (mats.tactile),
 * registers ramps (sound 'stairs') + landing floors. dirName = plan direction ('north'|'south'|'east'|'west').
 */
export function stairFlight(merger, mats, collision, { from, to, width, steps, landings = [], tag = 'stairs', tactile = true, handrails = 'both', centreRail = false, nosing = true }) {
  const dx = to.x - from.x, dz = to.z - from.z; const plan = Math.hypot(dx, dz); const ux = dx / plan, uz = dz / plan; const px = -uz, pz = ux;   // p = to the left when climbing
  const rise = to.y - from.y; const landLen = landings.reduce((s, l) => s + l.len, 0); const run = plan - landLen; const going = run / steps, riser = rise / steps;
  const yaw = Math.atan2(ux, uz);   // rotation.y that maps local +z to (ux,uz)
  let s = 0, y = from.y, i = 0; const placed = new Set();
  const world = (along, up, across = 0) => new THREE.Vector3(from.x + ux * along + px * across, up, from.z + uz * along + pz * across);
  while (i < steps) {
    const land = landings.find(l => l.after === i && !placed.has(l));
    if (land) { placed.add(land); const f0 = s, f1 = s + land.len; const c = world((f0 + f1) / 2, y); merger.box(mats.tread, width, 0.06, land.len, { x: c.x, y: y - 0.03, z: c.z, ry: yaw }); collision.addRamp(world(f0, y), world(f1, y), width, { tag: tag + ':landing', sound: 'hard' }); s = f1; continue; }
    const c = world(s + going / 2, y + riser); merger.box(mats.tread, width, riser, going, { x: c.x, y: y + riser / 2, z: c.z, ry: yaw });
    if (nosing) { const n = world(s + going - 0.03, y + riser); merger.box(mats.nosing, width - 0.02, 0.006, 0.055, { x: n.x, y: y + riser + 0.003, z: n.z, ry: yaw }, false); }
    s += going; y += riser; i++;
  }
  // ramps for each stepped run (between landings)
  let runStart = 0, yStart = from.y;
  const flightEnds = [...landings.map(l => l.after), steps];
  let stepsDone = 0, along = 0;
  for (const end of flightEnds) {
    const n = end - stepsDone; if (n > 0) { const a = world(along, yStart), b = world(along + n * going, yStart + n * riser); collision.addRamp(a, b, width, { tag, sound: 'stairs', stepPitch: going }); along += n * going; yStart += n * riser; stepsDone = end; }
    const land = landings.find(l => l.after === end); if (land) along += land.len;
  }
  // corduroy tactiles at the top and bottom (400 mm deep)
  if (tactile) { const b = world(-0.2, from.y), t = world(plan + 0.2, to.y); merger.box(mats.tactile, width, 0.012, 0.4, { x: b.x, y: from.y + 0.006, z: b.z, ry: yaw }); merger.box(mats.tactile, width, 0.012, 0.4, { x: t.x, y: to.y + 0.006, z: t.z, ry: yaw }); }
  // handrails (1.0 m above the nosing line, following the slope, with landing sections)
  const railY = 0.95; const sides = handrails === 'both' ? [-1, 1] : handrails === 'left' ? [1] : handrails === 'right' ? [-1] : [];
  if (centreRail) sides.push(0);
  for (const sd of sides) { const across = sd === 0 ? 0 : sd * (width / 2 - 0.08); let a0 = 0, y0 = from.y; let done = 0; const pts = [world(-0.3, y0 + railY, across)];
    for (const end of flightEnds) { const n = end - done; if (n > 0) { a0 += n * going; y0 += n * riser; pts.push(world(a0, y0 + railY, across)); done = end; } const land = landings.find(l => l.after === end); if (land) { a0 += land.len; pts.push(world(a0, y0 + railY, across)); } }
    pts.push(world(plan + 0.3, to.y + railY, across));
    for (let k = 1; k < pts.length; k++) merger.tube(mats.stainless, pts[k - 1], pts[k], 0.021, 10);
    for (let k = 0; k < pts.length; k += 1) { if (k === 0 || k === pts.length - 1) continue; merger.tube(mats.stainless, pts[k], pts[k].clone().setY(pts[k].y - 0.9), 0.016, 6); }
    if (sd === 0) { for (let k = 0; k < pts.length; k++) if (k === 0 || k === pts.length - 1) merger.tube(mats.stainless, pts[k], pts[k].clone().setY(pts[k].y - 0.92), 0.016, 6); }
  }
  return { going, riser, plan, yaw, top: world(plan, to.y), bottom: world(0, from.y), world };
}

/** Lift shaft with closed centre-opening doors, call button, 'Lift' sign; door on face `facing`. Registers a blocker. */
export function liftShaft(merger, mats, collision, signMat, labelMat, { x, z, y0, y1, w = 2.6, d = 2.6, facing, tag = 'lift', glazed = true, band = true }) {
  const rot = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }[facing] ?? 0; const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot); const side = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
  const h = y1 - y0; const yc = (y0 + y1) / 2;
  // shell: stainless frame with glass panels (JLE lifts are glazed) or concrete
  if (glazed) { merger.box(mats.glass, w - 0.1, h, d - 0.1, { x, y: yc, z, ry: rot }, false); for (const s of [-1, 1]) { merger.box(mats.stainless, 0.12, h, 0.12, { x: x + side.x * s * (w / 2 - 0.06) + fwd.x * (d / 2 - 0.06), y: yc, z: z + side.z * s * (w / 2 - 0.06) + fwd.z * (d / 2 - 0.06), ry: rot }, false); merger.box(mats.stainless, 0.12, h, 0.12, { x: x + side.x * s * (w / 2 - 0.06) - fwd.x * (d / 2 - 0.06), y: yc, z: z + side.z * s * (w / 2 - 0.06) - fwd.z * (d / 2 - 0.06), ry: rot }, false); } merger.box(mats.stainless, w, 0.25, d, { x, y: y1 - 0.125, z, ry: rot }, false); merger.box(mats.stainless, w, 0.3, d, { x, y: y0 + 0.15, z, ry: rot }, false); if (band) merger.box(mats.mosaic, w + 0.01, 0.3, d + 0.01, { x, y: y0 + 1.2, z, ry: rot }, false); }
  else merger.box(mats.concrete, w, h, d, { x, y: yc, z, ry: rot });
  // door: stainless frame, two leaves, threshold, indicator, call button
  const fx = x + fwd.x * (d / 2), fz = z + fwd.z * (d / 2);
  merger.box(mats.stainless, 1.5, 2.3, 0.08, { x: fx + fwd.x * 0.04, y: y0 + 1.15, z: fz + fwd.z * 0.04, ry: rot }, false);
  for (const s of [-1, 1]) merger.box(mats.door, 0.55, 2.1, 0.03, { x: fx + fwd.x * 0.09 + side.x * s * 0.29, y: y0 + 1.05, z: fz + fwd.z * 0.09 + side.z * s * 0.29, ry: rot }, false);
  merger.box(mats.black, 0.02, 2.1, 0.035, { x: fx + fwd.x * 0.09, y: y0 + 1.05, z: fz + fwd.z * 0.09, ry: rot }, false);
  merger.box(mats.stainless, 0.12, 0.12, 0.05, { x: fx + fwd.x * 0.06 + side.x * 0.9, y: y0 + 1.0, z: fz + fwd.z * 0.06 + side.z * 0.9, ry: rot }, false);
  merger.cyl(mats.yellowLED, 0.02, 0.02, 0.01, 10, { x: fx + fwd.x * 0.09 + side.x * 0.9, y: y0 + 1.0, z: fz + fwd.z * 0.09 + side.z * 0.9, rx: Math.PI / 2, ry: rot });
  merger.quad(labelMat, 0.6, 0.15, { x: fx + fwd.x * 0.085, y: y0 + 2.42, z: fz + fwd.z * 0.085, ry: rot });
  if (signMat) merger.quad(signMat, 1.2, 0.4, { x: fx + fwd.x * 0.01, y: y1 - 0.45, z: fz + fwd.z * 0.01, ry: rot });
  const hw = Math.abs(side.x) * w / 2 + Math.abs(fwd.x) * d / 2, hd = Math.abs(side.z) * w / 2 + Math.abs(fwd.z) * d / 2;
  collision.addBlocker({ xMin: x - hw - 0.05, xMax: x + hw + 0.05, yMin: y0, yMax: y1, zMin: z - hd - 0.05, zMax: z + hd + 0.05 }, tag);
}
