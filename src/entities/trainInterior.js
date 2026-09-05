// ---------------------------------------------------------------------------
// trainInterior.js — saloon layout + interior geometry for 1996 TS and S7 cars.
//
// carLayout(spec, carIndex) describes ONE car in "geometry space": car centre at
// the origin, rail head y = 0, the driving cab (if any) at the -z end. The rear
// DM is the same geometry turned through 180°, so it shares this layout.
// Both the mesh builder (buildInterior) and the player's interior collision
// (trains.js → resolveInterior) read the SAME layout, so what you see is what
// you bump into: seat fronts, poles, draught screens, cab partition, gangways.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import * as T from '../core/textures.js';
import { carDoorways } from './trainSpec.js';
import { xAt, topOf, profileStrip, profileRibbon, profileTube, profileCap, boxAt, cylAt, sphereAt, planeAt, seatGeometry, bellowsGeometry, mergeGeometries } from './trainParts.js';

const SEAT_PITCH = 0.47, SEAT_W = 0.44, SCREEN_DEPTH = 0.56, POLE_R = 0.019;

/** Angle (radians) of the profile from vertical at height y; positive = leaning towards the centreline going up. */
export function leanAt(profile, y) {
  for (let i = 1; i < profile.length; i++) { if (y <= profile[i][1]) { const [x0, y0] = profile[i - 1], [x1, y1] = profile[i]; return Math.atan2(x0 - x1, Math.max(1e-6, y1 - y0)); } }
  return Math.PI / 2;
}
/** Ceiling height of an interior profile above lateral position x. */
export function ceilAt(profile, x) {
  x = Math.abs(x);
  for (let i = profile.length - 1; i > 0; i--) { const [x1, y1] = profile[i], [x0, y0] = profile[i - 1]; if (x >= x1 && x <= x0 && y0 <= y1) { const t = (x - x1) / Math.max(1e-6, x0 - x1); return y1 + (y0 - y1) * t; } }
  return profile[0][1];
}
/** Matrix placing a +z-facing plane flat onto the interior surface at (y, z) on `side`, `proud` metres off the surface, text readable from inside. */
export function surfaceMatrix(profile, y, z, side, proud = 0.006) {
  const th = leanAt(profile, y); const x = side * (xAt(profile, y) - proud);
  const m = new THREE.Matrix4().makeTranslation(x, y, z);
  m.multiply(new THREE.Matrix4().makeRotationZ(side * th));
  m.multiply(new THREE.Matrix4().makeRotationY(side > 0 ? -Math.PI / 2 : Math.PI / 2));
  return m;
}

/** Layout of one car (see header). */
export function carLayout(spec, carIndex) {
  const len = spec.carLength[carIndex], half = len / 2; const cars = spec.cars;
  const isDM = carIndex === 0 || carIndex === cars - 1; const flip = carIndex === cars - 1;
  const P = spec.interior; const floorY = spec.floorHeight; const ceilY = topOf(P); const halfInt = xAt(P, floorY + 1.0);
  const doorSrc = carDoorways(spec, isDM ? 0 : carIndex);
  const doorways = doorSrc.map(d => ({ z: -d.offset, width: d.width, leaves: d.leaves, zMin: -d.offset - d.width / 2, zMax: -d.offset + d.width / 2 })).sort((a, b) => a.z - b.z);
  const doorTop = spec.doorSill + spec.doorHeight;
  const cabZ = isDM ? -half + spec.cabDepth : null; const endWall = spec.gangway ? 0.06 : 0.14;
  const saloonMin = isDM ? cabZ : -half + endWall, saloonMax = half - endWall;
  // bays between doorways
  const edges = [saloonMin]; for (const d of doorways) edges.push(d.zMin, d.zMax); edges.push(saloonMax);
  const bays = []; const seats = [], poles = [], screens = [], displays = [], panels = [], decals = [], rails = [];
  const isS7 = !!spec.gangway; const wheelchairCar = isS7 && (carIndex === 1 || carIndex === 5);
  for (let i = 0; i < edges.length - 1; i += 2) {
    const zMin = edges[i], zMax = edges[i + 1]; const L = zMax - zMin; if (L < 0.5) continue;
    const doorAtMin = i > 0, doorAtMax = i + 1 < edges.length - 1;
    for (const side of [-1, 1]) {
      let kind = 'long';
      if (!isS7 && zMin < 0 && zMax > 0 && doorAtMin && doorAtMax) kind = 'transverse';
      if (wheelchairCar && side === 1 && zMin < 0 && zMax > 0) kind = 'wheelchair';
      const bay = { zMin, zMax, side, kind, seats: [], doorAtMin, doorAtMax };
      if (kind === 'long') {
        const mMin = (isS7 && doorAtMin && doorAtMax) ? 1.15 : 0.13, mMax = mMin;
        const avail = L - mMin - mMax; const n = Math.max(0, Math.floor(avail / SEAT_PITCH)); const start = zMin + mMin + (avail - n * SEAT_PITCH) / 2;
        for (let k = 0; k < n; k++) {
          const z = start + SEAT_PITCH * (k + 0.5);
          const seat = { x: side * (halfInt - 0.30), z, side, kind: 'long', facing: -side, priority: (k === 0 && doorAtMin) || (k === n - 1 && doorAtMax), bay };
          seats.push(seat); bay.seats.push(seat);
        }
        bay.seatSpan = n ? [start, start + n * SEAT_PITCH] : null;
      } else if (kind === 'transverse') {
        // two facing pairs at the ends of the bay (2 + 2 across, aisle in the middle of the car)
        const pairs = [[zMin + 0.16, +1], [zMax - 0.16, -1]];
        bay.pairs = [];
        for (const [zBack, facing] of pairs) {
          const zc = zBack + facing * 0.30; bay.pairs.push({ zBack, zc, facing });
          for (const k of [0, 1]) seats.push({ x: side * (halfInt - 0.26 - k * SEAT_W), z: zc, side, kind: 'transverse', facing, priority: false, bay });
          poles.push({ x: side * (halfInt - 0.95), z: zBack + facing * 0.02, kind: 'seat' });
        }
      } else if (kind === 'wheelchair') {
        bay.tipUps = [zMin + 0.45, zMax - 0.45];
        decals.push({ name: 'wheelchair', y: spec.windowBottom + 0.35, z: (zMin + zMax) / 2, side, w: 0.22, h: 0.22, onGlass: true });
      }
      bays.push(bay);
      // line diagram / poster above the windows of this bay
      if (L >= 2.0) panels.push({ kind: 'diagram', z: (zMin + zMax) / 2, side, w: Math.min(L - 0.4, 2.7), h: 0.17 });
      else panels.push({ kind: 'poster', z: (zMin + zMax) / 2, side, w: 0.6, h: 0.3 });
      if (L >= 4.5) { panels.push({ kind: 'poster', z: zMin + 0.55, side, w: 0.6, h: 0.3 }); panels.push({ kind: 'poster', z: zMax - 0.55, side, w: 0.6, h: 0.3 }); }
    }
  }
  // draught screens + vertical poles at every doorway edge, both sides
  for (const d of doorways) for (const side of [-1, 1]) {
    for (const [edge, dir] of [[d.zMin, -1], [d.zMax, 1]]) {
      const z = edge + dir * 0.03; if (z < saloonMin + 0.2 || z > saloonMax - 0.2) continue;
      screens.push({ z, side, xIn: side * (halfInt - SCREEN_DEPTH) });
      poles.push({ x: side * (halfInt - SCREEN_DEPTH - 0.01), z, kind: 'screen' });
    }
    if (isS7 || d.leaves === 2) displays.push({ z: d.z, side, w: isS7 ? 1.0 : 0.72 });
    decals.push({ name: 'mindGap', z: d.z, side, floor: true, w: 0.7, h: 0.11 });
    decals.push({ name: 'alarm', y: floorY + 1.45, z: d.zMax + 0.075, side, w: 0.10, h: 0.10 });
    decals.push({ name: 'cctv', y: spec.windowTop + 0.02, z: d.zMin - 0.30, side, w: 0.14, h: 0.14, onGlass: true });
  }
  // ceiling rails: over each vestibule (1996 with springballs) or continuous (S7)
  if (isS7) { for (const side of [-1, 1]) rails.push({ x: side * 0.62, z0: saloonMin + 0.35, z1: saloonMax - 0.35, drops: 0.9, straps: 0 }); }
  else for (const d of doorways) for (const side of [-1, 1]) rails.push({ x: side * 0.50, z0: d.zMin - 0.45, z1: d.zMax + 0.45, drops: 0, straps: 0.36 });
  // priority-seat stickers on the glass above the priority seats
  for (const s of seats) if (s.priority) decals.push({ name: 'priority', y: spec.windowBottom + 0.28, z: s.z, side: s.side, w: 0.18, h: 0.18, onGlass: true });
  decals.push({ name: 'noSmoking', y: spec.windowBottom + 0.30, z: saloonMax - 0.55, side: -1, w: 0.14, h: 0.14, onGlass: true });
  // 3–4 sittable seats per car, spread along it
  const longSeats = seats.filter(s => s.kind === 'long'); const n = longSeats.length; const picks = Math.min(4, n);
  for (let k = 0; k < picks; k++) longSeats[Math.floor(n * (k + 0.5) / picks)].interactive = true;
  return { carIndex, len, half, isDM, flip, floorY, ceilY, halfInt, doorways, doorTop, cabZ, saloonMin, saloonMax, bays, seats, poles, screens, displays, panels, decals, rails, isS7 };
}

/** Build all interior geometry of a car into the collector (keys = material names in trainParts.trainMaterials). */
export function buildInterior(spec, lay, col, atlas) {
  const P = spec.interior, PE = spec.profile; const { floorY, ceilY, halfInt, half, doorways, doorTop, saloonMin, saloonMax, isDM, cabZ, isS7 } = lay;
  const wb = spec.windowBottom, wt = spec.windowTop; const sill = spec.doorSill;
  const gap = spec.gap;
  // ---- floor
  { const z0 = isDM ? cabZ : -half - (isS7 ? gap / 2 : 0), z1 = half + (isS7 ? gap / 2 : 0);
    const g = T.planeGeometryMetric(halfInt * 2, z1 - z0); g.rotateX(-Math.PI / 2); g.translate(0, floorY, (z0 + z1) / 2); col.add('floor', g);
    for (const d of doorways) for (const side of [-1, 1]) col.add('yellow', boxAt(0.10, 0.006, d.width, side * (halfInt - 0.06), floorY + 0.003, d.z));
  }
  // ---- side lining in bands, both sides, outside doorways (pockets are lining too)
  const zSpans = spansOutsideDoors(lay);
  for (const side of [-1, 1]) {
    for (const [z0, z1] of zSpans) {
      col.add('lining', profileStrip(P, floorY, wb, z0, z1, { side, flip: true }));
      col.add('lining', profileStrip(P, wt, doorTop, z0, z1, { side, flip: true }));
      // window pillars inside (match the exterior pane split)
      for (const [pz0, pz1] of pillarSpans(z0, z1)) col.add('lining', profileStrip(P, wb, wt, pz0, pz1, { side, flip: true }));
      // window inner surround (rubber lip)
      col.add('rubber', profileStrip(P, wb - 0.03, wb, z0, z1, { side, inset: -0.012, flip: true }));
    }
    // cove + ceiling: continuous from the door head over the top
    const cz0 = isDM ? cabZ : -half, cz1 = half;
    col.add('lining', profileStrip(P, doorTop, ceilY, cz0, cz1, { side, flip: true, steps: 8 }));
    // light strips
    if (!isS7) { col.add('lamp', profileStrip(P, wt + 0.10, wt + 0.22, cz0 + 0.1, cz1 - 0.1, { side, inset: -0.012, flip: true })); col.add('lampHousing', profileStrip(P, wt + 0.22, wt + 0.25, cz0 + 0.1, cz1 - 0.1, { side, inset: -0.02, flip: true })); }
    else { col.add('lamp', boxAt(0.10, 0.02, cz1 - cz0 - 0.4, side * 0.55, ceilAt(P, 0.55) - 0.012, (cz0 + cz1) / 2)); col.add('lampHousing', boxAt(0.16, 0.012, cz1 - cz0 - 0.4, side * 0.55, ceilAt(P, 0.55) - 0.004, (cz0 + cz1) / 2)); }
    // handrail over the seats (1996: yellow rail on the cove)
    if (!isS7) for (const bay of lay.bays) if (bay.side === side && bay.kind === 'long' && bay.seatSpan) {
      const y = wt + 0.30; const x = side * (xAt(P, y) - 0.06); const [s0, s1] = bay.seatSpan;
      col.add('yellow', cylAt(0.016, s1 - s0, x, y, (s0 + s1) / 2, { axis: 'z', seg: 8 }));
      for (const z of [s0 + 0.05, s1 - 0.05, (s0 + s1) / 2]) col.add('steel', cylAt(0.012, 0.06, side * (xAt(P, y) - 0.03), y, z, { axis: 'x', seg: 6 }));
    }
  }
  // ceiling ventilation grilles
  if (!isS7) col.add('perforated', boxAt(0.42, 0.012, (isDM ? half - cabZ : 2 * half) - 0.5, 0, ceilY - 0.006, isDM ? (cabZ + half) / 2 : 0));
  else for (const x of [-1.0, 0, 1.0]) col.add('perforated', boxAt(0.28, 0.012, 2 * half - 0.6, x, ceilAt(P, x) - 0.006, 0));
  // ---- doorway reveals, pillars, head, threshold
  for (const d of doorways) for (const side of [-1, 1]) {
    for (const [edge, dir] of [[d.zMin, -1], [d.zMax, 1]]) {
      col.add('liningGrey', profileRibbon(PE, sill, doorTop, edge, 0.005, 0.105, { side, dir: -dir }));
      col.add('liningGrey', profileStrip(P, floorY, doorTop, edge + dir * 0.0, edge + dir * 0.12, { side, inset: -0.015, flip: true }));
    }
    col.add('liningGrey', boxAt(0.10, 0.025, d.width + 0.02, side * (xAt(PE, doorTop) - 0.055), doorTop + 0.012, d.z));
    col.add('steel', boxAt(0.16, 0.02, d.width + 0.02, side * (xAt(PE, sill) - 0.08), sill + 0.002, d.z));
  }
  // ---- seats
  for (const s of lay.seats) {
    if (s.kind === 'long') {
      const sg = seatGeometry(spec, { width: SEAT_W, xBack: halfInt, floorY, side: s.side, base: !isS7 });
      sg.moquette.translate(0, 0, s.z); sg.base.translate(0, 0, s.z); col.add('moquette', sg.moquette); col.add(isS7 ? 'steel' : 'dark', sg.base);
    }
  }
  for (const bay of lay.bays) {
    const side = bay.side;
    if (bay.kind === 'long' && bay.seatSpan) {
      const [s0, s1] = bay.seatSpan; const n = bay.seats.length; const y = floorY + 0.64;
      const armZ = [s0, s1]; for (let k = 2; k < n; k += (isS7 ? 2 : 3)) armZ.push(s0 + k * SEAT_PITCH);
      for (const z of armZ) { col.add('steel', cylAt(0.014, 0.34, side * (halfInt - 0.27), y, z, { axis: 'x', seg: 8 })); col.add('steel', cylAt(0.014, 0.22, side * (halfInt - 0.42), y - 0.11, z, { axis: 'y', seg: 8 })); }
    } else if (bay.kind === 'transverse') {
      for (const pr of bay.pairs) {
        const xc = side * (halfInt - 0.48); const cush = spec.seatCushion;
        const c = T.boxGeometryMetric(0.86, 0.10, 0.42); c.translate(xc, floorY + cush - 0.05, pr.zc); col.add('moquette', c);
        const b = T.boxGeometryMetric(0.86, 0.56, 0.09); b.rotateX(pr.facing * 0.2); b.translate(xc, floorY + cush + 0.30, pr.zBack + pr.facing * 0.05); col.add('moquette', b);
        col.add('dark', boxAt(0.84, cush - 0.03, 0.38, xc, floorY + (cush - 0.03) / 2, pr.zc));
        col.add('steel', cylAt(0.014, 0.36, side * (halfInt - 0.93), floorY + 0.64, pr.zc, { axis: 'z', seg: 8 }));
        // window-side armrest ledge and the aisle-side pole is in lay.poles
      }
    } else if (bay.kind === 'wheelchair') {
      const zc = (bay.zMin + bay.zMax) / 2;
      const pad = T.boxGeometryMetric(0.07, 0.42, 1.5); pad.translate(side * (halfInt - 0.05), floorY + 1.02, zc); col.add('moquette', pad);
      for (const z of bay.tipUps) { const tu = T.boxGeometryMetric(0.09, 0.44, SEAT_W); tu.translate(side * (halfInt - 0.07), floorY + 0.62, z); col.add('moquette', tu); col.add('steel', boxAt(0.05, 0.04, SEAT_W + 0.04, side * (halfInt - 0.05), floorY + 0.42, z)); }
      col.add('yellow', cylAt(0.016, 1.5, side * (halfInt - 0.11), floorY + 0.80, zc, { axis: 'z', seg: 8 }));
    }
  }
  // ---- poles (floor to ceiling) with flanges
  for (const p of lay.poles) {
    const yc = ceilAt(P, p.x); col.add('yellow', cylAt(POLE_R, yc - floorY, p.x, (yc + floorY) / 2, p.z, { seg: 10 }));
    col.add('steel', cylAt(0.045, 0.02, p.x, floorY + 0.01, p.z, { seg: 10 })); col.add('steel', cylAt(0.045, 0.02, p.x, yc - 0.01, p.z, { seg: 10 }));
  }
  // ---- draught screens: glass panel + stainless top/bottom rails + kick panel
  for (const s of lay.screens) {
    const xc = s.side * (halfInt - SCREEN_DEPTH / 2 + 0.03); const hGlass = 1.55; const yG = floorY + 0.40 + hGlass / 2;
    col.add('clearGlass', boxAt(SCREEN_DEPTH - 0.08, hGlass, 0.010, xc, yG, s.z));
    col.add('steel', boxAt(SCREEN_DEPTH - 0.02, 0.03, 0.035, xc, floorY + 0.40, s.z)); col.add('steel', boxAt(SCREEN_DEPTH - 0.02, 0.03, 0.035, xc, floorY + 0.40 + hGlass, s.z));
    col.add('liningDark', boxAt(SCREEN_DEPTH - 0.02, 0.36, 0.03, xc, floorY + 0.20, s.z));
  }
  // ---- ceiling rails with drops / springball straps
  for (const r of lay.rails) {
    const y = ceilAt(P, r.x) - 0.10; const L = r.z1 - r.z0; if (L <= 0) continue;
    col.add('yellow', cylAt(0.016, L, r.x, y, (r.z0 + r.z1) / 2, { axis: 'z', seg: 8 }));
    for (let z = r.z0 + 0.1; z <= r.z1 - 0.05; z += 0.9) col.add('yellow', cylAt(0.013, 0.10, r.x, y + 0.05, z, { seg: 6 }));
    if (r.straps) for (let z = r.z0 + 0.25; z < r.z1 - 0.2; z += r.straps) { col.add('steel', cylAt(0.011, 0.09, r.x, y - 0.06, z, { seg: 6 })); col.add('rubber', sphereAt(0.033, r.x, y - 0.135, z, 10)); }
    else if (r.drops) for (let z = r.z0 + 0.45; z < r.z1 - 0.4; z += r.drops) { col.add('yellow', cylAt(0.014, 0.36, r.x, y - 0.19, z, { seg: 6 })); col.add('yellow', cylAt(0.014, 0.16, r.x, y - 0.37, z, { axis: 'x', seg: 6 })); }
  }
  // ---- LED display housings above the doors (the screen itself is instanced per train)
  for (const d of lay.displays) {
    const y = doorTop + 0.10; const m = surfaceMatrix(P, y, d.z, d.side, -0.045);
    const box = new THREE.BoxGeometry(d.w + 0.08, 0.15, 0.06); box.applyMatrix4(m); col.add('liningDark', box);
  }
  // ---- decals
  if (atlas && col) for (const dc of lay.decals) {
    const rect = atlas.rect(dc.name); if (!rect) continue;
    let g;
    if (dc.floor) { g = planeAt(dc.w, dc.h, dc.side * (halfInt - 0.13), floorY + 0.004, dc.z, { rx: -Math.PI / 2, ry: Math.PI / 2, uvRect: rect }); }
    else { const proud = dc.onGlass ? 0.02 : 0.008; g = new THREE.PlaneGeometry(dc.w, dc.h); remapUV(g, rect); g.applyMatrix4(surfaceMatrix(P, dc.y, dc.z, dc.side, proud)); }
    col.add('decal', g);
  }
  // ---- car ends
  if (isDM) {
    // cab partition with the cab door + window, "DO NOT OBSTRUCT"
    col.add('liningDark', profileCap(P, cabZ, floorY, { dir: 1, holes: [{ x0: -0.30, x1: 0.30, y0: floorY + 1.45, y1: floorY + 1.85 }] }));
    col.add('liningGrey', boxAt(0.64, 1.94, 0.04, 0, floorY + 0.97, cabZ + 0.025));
    col.add('glass', planeAt(0.5, 0.36, 0, floorY + 1.65, cabZ + 0.05));
    col.add('yellow', cylAt(0.012, 0.22, 0.24, floorY + 1.02, cabZ + 0.06, { seg: 6 }));
    if (atlas) { const g = planeAt(0.26, 0.26, 0, floorY + 1.18, cabZ + 0.052, { uvRect: atlas.rect('doNotObstruct') }); col.add('decal', g); }
    if (atlas) { const g = planeAt(0.34, 0.34, -0.85, floorY + 1.4, cabZ + 0.012, { uvRect: atlas.rect('carNo') }); col.add('decal', g); }
    // cab interior (seen through the cab windows): desk, seat, dark walls
    col.add('cabDark', boxAt(halfInt * 2 - 0.1, 0.75, 0.55, 0, floorY + 0.375, -half + 0.55));
    col.add('cabDark', boxAt(0.5, 0.5, 0.5, -0.5, floorY + 0.55, -half + 1.25)); col.add('cabDark', boxAt(0.5, 0.6, 0.08, -0.5, floorY + 1.1, -half + 1.5));
    col.add('cabDark', profileCap(P, cabZ - 0.05, floorY, { dir: -1 }));
    const cg = T.planeGeometryMetric(halfInt * 2, spec.cabDepth); cg.rotateX(-Math.PI / 2); cg.translate(0, floorY, -half + spec.cabDepth / 2); col.add('cabDark', cg);
  }
  for (const [zEnd, dir] of isDM ? [[half, -1]] : [[-half, 1], [half, -1]]) {
    if (!isS7) {
      // closed end: wall with the inter-car door (small window) and warning sticker
      const zw = zEnd + dir * 0.14;
      col.add('liningGrey', profileCap(P, zw, floorY, { dir, holes: [{ x0: -0.17, x1: 0.17, y0: floorY + 1.30, y1: floorY + 1.85 }] }));
      col.add('liningDark', boxAt(0.70, 0.05, 0.10, 0, floorY + 1.95, zw + dir * 0.02));
      col.add('glass', planeAt(0.30, 0.52, 0, floorY + 1.575, zw + dir * 0.002, { ry: dir > 0 ? 0 : Math.PI }));
      col.add('steel', boxAt(0.66, 1.92, 0.012, 0, floorY + 0.96, zw + dir * 0.03));
      col.add('yellow', cylAt(0.012, 0.24, 0.26, floorY + 1.0, zw + dir * 0.05, { seg: 6 }));
      if (atlas) col.add('decal', planeAt(0.30, 0.30, 0, floorY + 0.95, zw + dir * 0.045, { ry: dir > 0 ? 0 : Math.PI, uvRect: atlas.rect('endDoor') }));
      if (atlas) col.add('decal', planeAt(0.30, 0.30, -0.75, floorY + 1.45, zw + dir * 0.012, { ry: dir > 0 ? 0 : Math.PI, uvRect: atlas.rect('carNo') }));
    } else {
      // open gangway: end wall with the opening, corridor lining into the gap, floor plate, grab rails, exterior bellows
      const gw = spec.gangway.width, gh = spec.gangway.height; const zw = zEnd + dir * 0.03;
      col.add('lining', profileCap(P, zw, floorY, { dir, holes: [{ x0: -gw / 2, x1: gw / 2, y0: floorY - 0.01, y1: floorY + gh }] }));
      const zc = zEnd - dir * gap / 4; const L = gap / 2 + 0.06;
      for (const x of [-1, 1]) col.add('liningGrey', boxAt(0.04, gh, L, x * (gw / 2 + 0.02), floorY + gh / 2, zc));
      col.add('liningGrey', boxAt(gw + 0.08, 0.04, L, 0, floorY + gh + 0.02, zc));
      col.add('steel', boxAt(gw - 0.02, 0.02, L, 0, floorY - 0.008, zc));
      for (const x of [-1, 1]) col.add('yellow', cylAt(0.015, 0.9, x * (gw / 2 - 0.05), floorY + 1.35, zw - dir * 0.04, { seg: 6 }));
      col.add('bellows', bellowsGeometry(gw + 0.5, gh + 0.42, floorY - 0.30, zEnd, zEnd - dir * gap / 2, { pleats: 5, depth: 0.08 }));
      if (atlas) col.add('decal', planeAt(0.26, 0.26, -0.98, floorY + 1.55, zw - dir * 0.012, { ry: dir > 0 ? 0 : Math.PI, uvRect: atlas.rect('carNo') }));
    }
  }
}

/** z spans of the bodyside outside the doorways (and outside the cab for a DM). */
export function spansOutsideDoors(lay) {
  const out = []; let cursor = lay.isDM ? lay.cabZ : -lay.half;
  for (const d of lay.doorways) { if (d.zMin > cursor + 0.01) out.push([cursor, d.zMin]); cursor = d.zMax; }
  if (lay.half > cursor + 0.01) out.push([cursor, lay.half]);
  return out;
}
/** Window pillar spans within a bodyside span: panes ≈ 1.45 m wide separated by 0.11 m pillars, pillars at both ends. */
export function pillarSpans(z0, z1, pillar = 0.11) {
  const L = z1 - z0; const n = Math.max(1, Math.round((L - pillar) / 1.5)); const pane = (L - pillar * (n + 1)) / n; const out = [];
  for (let k = 0; k <= n; k++) { const a = z0 + k * (pane + pillar); out.push([a, a + pillar]); }
  return out;
}
export function paneSpans(z0, z1, pillar = 0.11) {
  const L = z1 - z0; const n = Math.max(1, Math.round((L - pillar) / 1.5)); const pane = (L - pillar * (n + 1)) / n; const out = [];
  for (let k = 0; k < n; k++) { const a = z0 + pillar + k * (pane + pillar); out.push([a, a + pane]); }
  return out;
}
export function remapUV(g, rect) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, rect.u0 + (rect.u1 - rect.u0) * uv.getX(i), rect.v0 + (rect.v1 - rect.v0) * uv.getY(i)); }

/** Interior collision model for a car, derived from the layout (geometry space). */
export function collisionModel(spec, lay) {
  const boxes = []; const { halfInt, floorY } = lay;
  for (const bay of lay.bays) {
    const s = bay.side; const xw = s * halfInt;
    if (bay.kind === 'long' && bay.seatSpan) { const [z0, z1] = bay.seatSpan; boxes.push(box(xw, s * (halfInt - spec.seatDepth), z0 - 0.02, z1 + 0.02, 'seat')); }
    else if (bay.kind === 'transverse') for (const pr of bay.pairs) boxes.push(box(xw, s * (halfInt - 0.95), Math.min(pr.zBack, pr.zc + pr.facing * 0.22), Math.max(pr.zBack, pr.zc + pr.facing * 0.22), 'seat'));
    else if (bay.kind === 'wheelchair') for (const z of bay.tipUps) boxes.push(box(xw, s * (halfInt - 0.14), z - 0.25, z + 0.25, 'seat'));
  }
  for (const sc of lay.screens) boxes.push(box(sc.side * halfInt, sc.xIn, sc.z - 0.03, sc.z + 0.03, 'screen'));
  const poles = lay.poles.map(p => ({ x: p.x, z: p.z, r: POLE_R }));
  return { boxes, poles, halfInt, floorY };
  function box(xa, xb, z0, z1, tag) { return { xMin: Math.min(xa, xb), xMax: Math.max(xa, xb), zMin: z0, zMax: z1, tag }; }
}
