// ---------------------------------------------------------------------------
// jubileePlatformKit.js — helpers private to the Jubilee platform module:
// procedural textures for the JLE platform-tunnel finishes (perforated aluminium
// wall panels on a rib grid, dark bolted trackside panels, grey ceiling panels,
// enamel passage panels, bored-tunnel segmental lining) and geometry builders
// for curved tunnel surfaces with METRIC UVs (u = metres along x, v = metres
// along the arc) so the materials tile correctly.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { PALETTE } from '../core/layout.js';

const texCache = new Map();
function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }
function shade(c, k) { const r = Math.min(255, Math.max(0, ((c >> 16) & 255) * k)), g = Math.min(255, Math.max(0, ((c >> 8) & 255) * k)), b = Math.min(255, Math.max(0, (c & 255) * k)); return `rgb(${r | 0},${g | 0},${b | 0})`; }

/** A cached MeshStandardMaterial from a canvas-drawn tile of `metres` metres (square). Options: normal (height Float32Array), rough canvas, emissive. */
function tiledMaterial(T, key, metres, draw, { roughness = 0.6, metalness = 0.25, normalStrength = 2, emissive = 0, side = THREE.FrontSide, size = 1024 } = {}) {
  if (texCache.has(key)) return texCache.get(key);
  const c = T.canvas(size, size); const g = c.getContext('2d');
  const height = new Float32Array(size * size);
  const rc = T.canvas(size, size); const rg = rc.getContext('2d');
  draw(g, size, height, rg);
  const map = T.toTexture(c); map.repeat.set(1 / metres, 1 / metres);
  const nrm = T.toTexture(T.normalMapFromHeight(height, size, normalStrength), { srgb: false }); nrm.repeat.set(1 / metres, 1 / metres);
  const rough = T.toTexture(rc, { srgb: false }); rough.repeat.set(1 / metres, 1 / metres);
  const m = new THREE.MeshStandardMaterial({ map, normalMap: nrm, roughnessMap: rough, roughness, metalness, side, normalScale: new THREE.Vector2(0.7, 0.7) });
  if (emissive) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = map; m.emissiveIntensity = emissive; }
  m.userData.metres = metres;
  texCache.set(key, m); return m;
}

/** Fill a rectangle of the height field. */
function hRect(height, size, x0, y0, w, h, v) { const X0 = Math.max(0, x0 | 0), Y0 = Math.max(0, y0 | 0), X1 = Math.min(size, (x0 + w) | 0), Y1 = Math.min(size, (y0 + h) | 0); for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) height[y * size + x] = v; }
function hDisc(height, size, cx, cy, r, v) { for (let y = Math.max(0, (cy - r) | 0); y <= Math.min(size - 1, (cy + r) | 0); y++) for (let x = Math.max(0, (cx - r) | 0); x <= Math.min(size - 1, (cx + r) | 0); x++) { const d = Math.hypot(x - cx, y - cy) / r; if (d < 1) height[y * size + x] = v * Math.sqrt(1 - d * d); } }

/**
 * Light-grey perforated aluminium panels (c. 1 × 0.5 m) in a darker rib/frame grid following the tunnel ring joints
 * (dossier §6.2: panel #b8bbbe, rib #6e7174). Tile = 2 m × 2 m: 2 panels across (ring width 1 m) × 4 panels up.
 */
export function jubileeWallMaterial(T, { panel = PALETTE.jubileePanel, rib = PALETTE.jubileeRib, emissive = 0 } = {}) {
  return tiledMaterial(T, 'jubWall:' + panel + ':' + rib + ':' + emissive, 2, (g, size, height, rg) => {
    const px = size / 2;   // pixels per metre
    g.fillStyle = hex(rib); g.fillRect(0, 0, size, size);
    rg.fillStyle = '#7a7a7a'; rg.fillRect(0, 0, size, size);
    const ribW = 0.06 * px, hRibW = 0.04 * px;
    // panels: 1.0 wide × 0.5 high, inset by the rib width; slightly bevelled edges and a very fine perforation pattern
    for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) {
      const x0 = i * px + ribW / 2, y0 = j * (px / 2) + hRibW / 2, w = px - ribW, h = px / 2 - hRibW;
      // panel body with a soft vertical gradient (brushed anodised look)
      const grad = g.createLinearGradient(x0, y0, x0, y0 + h); grad.addColorStop(0, shade(panel, 1.04)); grad.addColorStop(0.5, hex(panel)); grad.addColorStop(1, shade(panel, 0.94));
      g.fillStyle = grad; g.fillRect(x0, y0, w, h);
      // perforation: 3 mm holes on a 10 mm pitch → at 512 px/m that is 5 px pitch; draw as a dot grid with low alpha
      g.fillStyle = 'rgba(40,42,45,0.55)';
      const pitch = 0.012 * px, hole = 0.0045 * px;
      for (let y = y0 + 0.03 * px; y < y0 + h - 0.03 * px; y += pitch) for (let x = x0 + 0.03 * px; x < x0 + w - 0.03 * px; x += pitch) { g.beginPath(); g.arc(x, y, hole / 2, 0, Math.PI * 2); g.fill(); }
      // bevel highlight top/left, shadow bottom/right
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(x0, y0, w, 3); g.fillRect(x0, y0, 3, h);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x0, y0 + h - 3, w, 3); g.fillRect(x0 + w - 3, y0, 3, h);
      hRect(height, size, x0, y0, w, h, 1);
      rg.fillStyle = '#6a6a6a'; rg.fillRect(x0, y0, w, h);
      // fixing screws in the corners
      g.fillStyle = '#e4e6e8'; for (const [sx, sy] of [[x0 + 0.03 * px, y0 + 0.03 * px], [x0 + w - 0.03 * px, y0 + 0.03 * px], [x0 + 0.03 * px, y0 + h - 0.03 * px], [x0 + w - 0.03 * px, y0 + h - 0.03 * px]]) { g.beginPath(); g.arc(sx, sy, 0.006 * px, 0, Math.PI * 2); g.fill(); }
    }
    // rib highlights: the ring joint ribs (vertical, 1 m) are more pronounced than the horizontal ones
    g.fillStyle = 'rgba(255,255,255,0.10)'; for (let i = 0; i <= 2; i++) g.fillRect(i * px - ribW / 2, 0, 2, size);
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 0; i <= 2; i++) g.fillRect(i * px + ribW / 2 - 2, 0, 2, size);
    // faint grime at panel bottoms
    g.fillStyle = 'rgba(30,30,30,0.06)'; for (let j = 0; j < 4; j++) g.fillRect(0, j * (px / 2) + px / 2 - 0.06 * px, size, 0.05 * px);
  }, { roughness: 0.55, metalness: 0.35, normalStrength: 2.5, emissive });
}

/** Dark grey bolted panels behind the track (seen through the PED glass): segmental panels 1 m wide × 0.75 m with bolt heads. Tile 2 × 2 m. */
export function tracksidePanelMaterial(T, { base = 0x4f5255, emissive = 0 } = {}) {
  return tiledMaterial(T, 'jubTrackside:' + base + ':' + emissive, 2, (g, size, height, rg) => {
    const px = size / 2;
    g.fillStyle = shade(base, 0.6); g.fillRect(0, 0, size, size);
    rg.fillStyle = '#8a8a8a'; rg.fillRect(0, 0, size, size);
    const jw = 0.035 * px;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
      const x0 = i * px + jw / 2, y0 = j * (size / 3) + jw / 2, w = px - jw, h = size / 3 - jw;
      const grad = g.createLinearGradient(x0, y0, x0 + w, y0 + h); grad.addColorStop(0, shade(base, 1.06)); grad.addColorStop(1, shade(base, 0.9));
      g.fillStyle = grad; g.fillRect(x0, y0, w, h); hRect(height, size, x0, y0, w, h, 0.8);
      // flange lips: a lighter rim
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 3; g.strokeRect(x0 + 2, y0 + 2, w - 4, h - 4);
      // bolt heads along the vertical joints (4 per panel edge) and a pair on the horizontal ones
      g.fillStyle = shade(base, 1.25);
      for (let k = 0; k < 4; k++) { const by = y0 + h * (k + 0.5) / 4; for (const bx of [x0 + 0.05 * px, x0 + w - 0.05 * px]) { g.beginPath(); g.arc(bx, by, 0.014 * px, 0, Math.PI * 2); g.fill(); hDisc(height, size, bx, by, 0.014 * px, 1); } }
      for (const bx of [x0 + w * 0.3, x0 + w * 0.7]) for (const by of [y0 + 0.05 * px, y0 + h - 0.05 * px]) { g.beginPath(); g.arc(bx, by, 0.012 * px, 0, Math.PI * 2); g.fill(); hDisc(height, size, bx, by, 0.012 * px, 1); }
      // dust / brake-dust streaks (darker, vertical)
      for (let s = 0; s < 6; s++) { g.fillStyle = `rgba(0,0,0,${0.05 + (s % 3) * 0.03})`; g.fillRect(x0 + w * ((s * 37) % 100) / 100, y0, 0.01 * px * (1 + s % 3), h); }
    }
  }, { roughness: 0.7, metalness: 0.3, normalStrength: 2.0, emissive });
}

/** Grey suspended-ceiling panels (1.2 × 0.6 m) with fine seams and the odd access hatch. Tile 2.4 × 2.4 m. */
export function ceilingPanelMaterial(T, { base = 0x9da0a3, emissive = 0 } = {}) {
  return tiledMaterial(T, 'jubCeiling:' + base + ':' + emissive, 2.4, (g, size, height, rg) => {
    const px = size / 2.4;
    g.fillStyle = shade(base, 0.55); g.fillRect(0, 0, size, size);
    rg.fillStyle = '#8c8c8c'; rg.fillRect(0, 0, size, size);
    const seam = 0.012 * px;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) {
      const x0 = i * 1.2 * px + seam / 2, y0 = j * 0.6 * px + seam / 2, w = 1.2 * px - seam, h = 0.6 * px - seam;
      g.fillStyle = shade(base, 0.97 + ((i * 7 + j * 3) % 5) * 0.012); g.fillRect(x0, y0, w, h); hRect(height, size, x0, y0, w, h, 1);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x0, y0, w, 2); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x0, y0 + h - 2, w, 2);
    }
    // one panel with a perforated ventilation field
    g.fillStyle = 'rgba(30,30,32,0.5)'; for (let y = 0.65 * px; y < 1.15 * px; y += 0.02 * px) for (let x = 1.3 * px; x < 2.3 * px; x += 0.02 * px) { g.beginPath(); g.arc(x, y, 0.005 * px, 0, Math.PI * 2); g.fill(); }
  }, { roughness: 0.75, metalness: 0.15, normalStrength: 1.5, emissive });
}

/** Pale-grey vitreous-enamel infill panels (JLE cross-passages), 0.9 × 0.6 m with hairline joints. Tile 1.8 × 1.8 m. */
export function enamelPanelMaterial(T, { base = 0xd3d5d4, emissive = 0 } = {}) {
  return tiledMaterial(T, 'jubEnamel:' + base + ':' + emissive, 1.8, (g, size, height, rg) => {
    const px = size / 1.8;
    g.fillStyle = shade(base, 0.6); g.fillRect(0, 0, size, size);
    rg.fillStyle = '#4e4e4e'; rg.fillRect(0, 0, size, size);
    const seam = 0.006 * px;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
      const x0 = i * 0.9 * px + seam / 2, y0 = j * 0.6 * px + seam / 2, w = 0.9 * px - seam, h = 0.6 * px - seam;
      const grad = g.createLinearGradient(x0, y0, x0 + w * 0.3, y0 + h); grad.addColorStop(0, shade(base, 1.03)); grad.addColorStop(1, shade(base, 0.97));
      g.fillStyle = grad; g.fillRect(x0, y0, w, h); hRect(height, size, x0, y0, w, h, 1);
      g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(x0, y0, w, 2);
    }
  }, { roughness: 0.28, metalness: 0.1, normalStrength: 1.2, emissive });
}

/** Bored running-tunnel lining: cast/concrete segments with ring joints every 1 m, dusty. Tile 2 × 2 m. */
export function runningTunnelMaterial(T, { base = 0x4a4b4a } = {}) {
  return tiledMaterial(T, 'jubRunning:' + base, 2, (g, size, height, rg) => {
    const px = size / 2;
    g.fillStyle = hex(base); g.fillRect(0, 0, size, size);
    rg.fillStyle = '#9a9a9a'; rg.fillRect(0, 0, size, size);
    // segments ~ 1 m × 0.8 m staggered, with dusty noise
    for (let j = 0; j < 5; j++) for (let i = -1; i < 3; i++) {
      const x0 = (i + (j % 2) * 0.5) * px, y0 = j * size / 5, w = px, h = size / 5;
      g.fillStyle = shade(base, 0.9 + ((i * 5 + j * 11) % 7) * 0.03); g.fillRect(x0 + 3, y0 + 3, w - 6, h - 6); hRect(height, size, x0 + 3, y0 + 3, w - 6, h - 6, 1);
      // bolt pockets
      g.fillStyle = shade(base, 0.55); for (const [bx, by] of [[x0 + 0.12 * px, y0 + h / 2], [x0 + w - 0.12 * px, y0 + h / 2]]) { g.beginPath(); g.arc(bx, by, 0.02 * px, 0, Math.PI * 2); g.fill(); hDisc(height, size, bx, by, 0.02 * px, 0); }
    }
    // soot streaks
    for (let s = 0; s < 40; s++) { g.fillStyle = `rgba(0,0,0,${0.04 + (s % 4) * 0.02})`; g.fillRect(((s * 97) % size), 0, 2 + (s % 5) * 3, size); }
  }, { roughness: 0.95, metalness: 0.05, normalStrength: 2.5 });
}

/** Stair-flight concrete with a subtle board texture; reuse M.concrete but lighter. */
export function stairConcrete(M) { return M.concrete({ base: 0xa8a6a1, dark: 0x7a7874, seed: 23, stain: 0.18, boardMarks: false, tieHoles: false }); }

// ---------------------------------------------------------------------------
// Curved geometry with metric UVs.
// Tunnel angle convention: φ measured around the tunnel axis (which runs along x):
//   point(φ) = ( z = axisZ - R·cosφ,  y = axisY + R·sinφ )
//   φ = 0 → north side at axis height, +90° → crown, 180° → south side, -90° → invert.
// Surfaces are built with normals pointing INWARD (towards the axis) so they are seen from inside the tunnel.
// ---------------------------------------------------------------------------
export const D2R = Math.PI / 180;

export function arcPoint(phi, R, axisY, axisZ, out = new THREE.Vector3()) { return out.set(0, axisY + R * Math.sin(phi), axisZ - R * Math.cos(phi)); }
/** φ (radians) at which the circle of radius R about (axisY, axisZ) passes height y on the NORTH side (cos φ > 0) or SOUTH side. */
export function phiAtY(y, R, axisY, side = 'north') { const s = Math.max(-1, Math.min(1, (y - axisY) / R)); const p = Math.asin(s); return side === 'north' ? p : Math.PI - p; }
/** z of the lining at height y on the given side. */
export function liningZ(y, R, axisY, axisZ, side = 'north') { const dy = y - axisY; const dz = Math.sqrt(Math.max(0, R * R - dy * dy)); return side === 'north' ? axisZ - dz : axisZ + dz; }

/**
 * A band of the tunnel lining from x0..x1 (along the axis) between angles phi0..phi1 (radians, increasing = towards the
 * crown from the north side). Metric UVs: u = x, v = R·(φ − vOrigin). Optional `radial` function radial(x, phi) → radius
 * multiplier for gentle irregularity. Returns a BufferGeometry (inward normals).
 */
export function liningBand(x0, x1, phi0, phi1, R, axisY, axisZ, { segX = null, segA = null, vOrigin = null } = {}) {
  const nx = segX ?? Math.max(1, Math.round((x1 - x0) / 1.0));
  const na = segA ?? Math.max(2, Math.round(Math.abs(phi1 - phi0) * R / 0.25));
  const v0 = vOrigin ?? phi0;
  const pos = [], nrm = [], uv = [], idx = [];
  for (let i = 0; i <= nx; i++) {
    const x = x0 + (x1 - x0) * i / nx;
    for (let j = 0; j <= na; j++) {
      const phi = phi0 + (phi1 - phi0) * j / na; const s = Math.sin(phi), c = Math.cos(phi);
      pos.push(x, axisY + R * s, axisZ - R * c); nrm.push(0, -s, c); uv.push(x, R * (phi - v0));
    }
  }
  const row = na + 1; const flip = phi1 < phi0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < na; j++) {
    const a = i * row + j, b = (i + 1) * row + j, c = a + 1, d = b + 1;
    if (!flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

/** Full ring (tube interior) from x0..x1, radius R — the running tunnels. Inward normals, metric UVs. */
export function tunnelTube(x0, x1, R, axisY, axisZ, segA = 28) { return liningBand(x0, x1, -Math.PI / 2, Math.PI * 1.5, R, axisY, axisZ, { segA, segX: Math.max(1, Math.round((x1 - x0) / 2)) }); }

/**
 * A flat quad in the YZ plane at x, spanning (y0..y1) × (z0..z1), facing +x (facing='east') or -x ('west'). Metric UVs.
 */
export function yzQuad(x, y0, y1, z0, z1, facing = 'west') {
  const g = new THREE.PlaneGeometry(z1 - z0, y1 - y0); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (z1 - z0), uv.getY(i) * (y1 - y0));
  g.rotateY(facing === 'west' ? -Math.PI / 2 : Math.PI / 2); g.translate(x, (y0 + y1) / 2, (z0 + z1) / 2); return g;
}
/** A flat quad in the XY plane at z, spanning x0..x1 × y0..y1, facing +z ('south') or -z ('north'). Metric UVs. */
export function xyQuad(z, x0, x1, y0, y1, facing = 'south') {
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0), uv.getY(i) * (y1 - y0));
  if (facing === 'north') g.rotateY(Math.PI); g.translate((x0 + x1) / 2, (y0 + y1) / 2, z); return g;
}
/** A flat quad in the XZ plane at y, spanning x0..x1 × z0..z1, facing up ('up') or down ('down'). Metric UVs. */
export function xzQuad(y, x0, x1, z0, z1, facing = 'down') {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0), uv.getY(i) * (z1 - z0));
  g.rotateX(facing === 'up' ? -Math.PI / 2 : Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2); return g;
}

/**
 * Headwall: a disc of radius R about (axisY, axisZ) at x, with a circular portal hole (radius r about (holeY, holeZ)).
 * facing 'west' (normal -x; seen from the platform tunnel to its west) or 'east'.
 */
export function headwallGeometry(x, R, axisY, axisZ, r, holeY, holeZ, facing = 'west') {
  const shape = new THREE.Shape(); shape.absarc(0, 0, R, 0, Math.PI * 2, false);
  const mirror = facing === 'west' ? 1 : -1;   // rotateY(+90°) maps shape x → world −z, so mirror the hole for an east-facing wall
  const hole = new THREE.Path(); hole.absarc(mirror * (holeZ - axisZ), holeY - axisY, r, 0, Math.PI * 2, true); shape.holes.push(hole);
  const g = new THREE.ShapeGeometry(shape, 40);
  // shape x → world z, shape y → world y; rotateY(-90°) maps (x,y,0)→(0,y,x) with normal -x
  g.rotateY(facing === 'west' ? -Math.PI / 2 : Math.PI / 2);
  g.translate(x, axisY, axisZ);
  const uv = g.attributes.uv; const p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getZ(i), p.getY(i));
  return g;
}

/** Merge a list of geometries (non-indexed) into one, dropping extra attributes. Returns null on failure. */
export function mergeAll(THREEmerge, geos) {
  const parts = [];
  for (const g of geos) { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); if (!n.attributes.normal) n.computeVertexNormals(); if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); n.clearGroups(); parts.push(n); }
  if (!parts.length) return null;
  try { return THREEmerge(parts, false); } catch (e) { console.warn('[jubileePlatforms] merge failed', e); return null; }
}
