// ---------------------------------------------------------------------------
// trains.js — 1996 Tube Stock (Jubilee) and S7 Stock (District & Circle) trains.
//
//   import { createTrain, Train1996, TrainS7 } from './entities/trains.js';
//   const train = createTrain(ctx, { stock: '1996'|'S7', track, direction, destination, line });
//   scene.add(train.group); train.placeAlong(track, s); train.setDoors(true, { side: 'left' }); …
//
// Implements the Player ⇄ Train contract in docs/ARCHITECTURE.md exactly:
//   group, stock, floorY, interiorContains, resolveInterior, doorsOpen, setDoors, sway,
//   setDisplay, exteriorBoxes, placeAlong, update, setSpeed, setDestination, setLights, dispose.
//
// Coordinates: the train group's local frame has -Z FORWARD (increasing s), +X to the right of
// travel, +Y up, origin at rail-head height at the train's centre. Each car is a child group set to
// its own track frame by placeAlong(), so the train bends round curves. Inside a car, geometry is
// built in "geometry space" (cab at -z for a driving car); the rear DM is the same geometry turned
// through 180° in its `body` group. Dimensions, liveries and fittings follow docs/WESTMINSTER_REFERENCE.md §8.
//
// Draw-call budget: one merged mesh per material per car (~17 for a trailer, ~21 for a DM) plus a
// handful of InstancedMeshes per train (wheels, door leaves, LED displays, line diagrams, posters)
// → about 140–160 draw calls for a 7-car train. Lights: none — the saloon is lit by emissive panels.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { STOCK_1996, STOCK_S7, trainLength, carOffsets } from './trainSpec.js';
import { xAt, topOf, profileStrip, profileCap, boxAt, cylAt, planeAt, Collector, decalAtlas, trainMaterials, decalMaterial, wheelGeometry, leafGeometry } from './trainParts.js';
import { carLayout, buildInterior, collisionModel, spansOutsideDoors, pillarSpans, paneSpans, surfaceMatrix, leanAt, remapUV } from './trainInterior.js';

const GAUGE = 1.435;
const assemblyCache = new Map();
let unitCounter = 0;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const _frame = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), tangent: new THREE.Vector3() };

/** Matrix placing a +z-facing plane onto the EXTERIOR skin at (y, z) on `side`, `proud` metres outside it, text readable from outside. */
function exteriorMatrix(profile, y, z, side, proud = 0.006) {
  const th = leanAt(profile, y); const x = side * (xAt(profile, y) + proud);
  const m = new THREE.Matrix4().makeTranslation(x, y, z);
  m.multiply(new THREE.Matrix4().makeRotationZ(side * th));
  m.multiply(new THREE.Matrix4().makeRotationY(side > 0 ? Math.PI / 2 : -Math.PI / 2));
  return m;
}
function decalOn(rect, w, h, matrix) { const g = new THREE.PlaneGeometry(w, h); remapUV(g, rect); g.applyMatrix4(matrix); return g; }

// ---------------------------------------------------------------------------
// Exterior geometry of one car (geometry space)
// ---------------------------------------------------------------------------
function buildExterior(spec, lay, col, atlas) {
  const P = spec.profile; const { b0, b1, half, isDM, cabZ, doorways, doorTop, isS7 } = lay; const len = b1 - b0;
  const bb = spec.bodyBottom, sill = spec.doorSill, wb = spec.windowBottom, wt = spec.windowTop, top = topOf(P);
  const cantRail = isS7 ? 3.25 : 2.72;
  const pillarMat = isS7 ? 'windowFrame' : 'body';        // S stock: continuous black window band
  for (const side of [-1, 1]) {
    // band A: below the door sill, full length — S7 corporate-blue band; 1996 slightly darker lower body (no skirt band)
    col.add(isS7 ? 'blue' : 'lowerBody', profileStrip(P, bb, sill, b0, b1, { side }));
    // bands B–D outside doorways: body below/above the windows, pillars + glass in the window band
    for (const [z0, z1] of spansOutsideDoors(lay)) {
      col.add('body', profileStrip(P, sill, wb, z0, z1, { side }));
      col.add('body', profileStrip(P, wt, doorTop, z0, z1, { side }));
      for (const [pz0, pz1] of pillarSpans(z0, z1)) col.add(pillarMat, profileStrip(P, wb, wt, pz0, pz1, { side, inset: isS7 ? 0.006 : 0 }));
      for (const [gz0, gz1] of paneSpans(z0, z1)) {
        col.add('glass', profileStrip(P, wb, wt, gz0, gz1, { side, inset: 0.012 }));
        col.add('glass', profileStrip(P, wb, wt, gz0, gz1, { side, inset: 0.013, flip: true }));
        const gk = 0.03;
        col.add('windowFrame', profileStrip(P, wb - gk, wb + 0.004, gz0 - gk, gz1 + gk, { side, inset: 0.004 }));
        col.add('windowFrame', profileStrip(P, wt - 0.004, wt + gk, gz0 - gk, gz1 + gk, { side, inset: 0.004 }));
        col.add('windowFrame', profileStrip(P, wb, wt, gz0 - gk, gz0 + 0.004, { side, inset: 0.004 }));
        col.add('windowFrame', profileStrip(P, wb, wt, gz1 - 0.004, gz1 + gk, { side, inset: 0.004 }));
      }
    }
    // doorway jambs (dark edge seals), head strip, stainless sill plate outside, S7 door indicator lamp
    for (const d of doorways) {
      for (const edge of [d.zMin, d.zMax]) col.add('dark', profileStrip(P, sill, doorTop, edge - 0.012, edge + 0.012, { side, inset: 0.002 }));
      col.add('dark', profileStrip(P, doorTop, doorTop + 0.025, d.zMin - 0.012, d.zMax + 0.012, { side, inset: 0.002 }));
      col.add('steel', profileStrip(P, sill - 0.03, sill + 0.005, d.zMin - 0.012, d.zMax + 0.012, { side, inset: -0.004 }));
      if (isS7) col.add('indicator', boxAt(0.05, 0.05, 0.16, side * (xAt(P, doorTop + 0.09) + 0.01), doorTop + 0.09, d.z));
    }
    // band E: cant rail (body) then the roof, with a rain strip moulding
    col.add('body', profileStrip(P, doorTop, cantRail, b0, b1, { side, steps: 2 }));
    col.add('roof', profileStrip(P, cantRail, top, b0, b1, { side, steps: 6 }));
    col.add('dark', profileStrip(P, cantRail - 0.015, cantRail + 0.015, b0 + 0.05, b1 - 0.05, { side, inset: -0.008, steps: 1 }));
    // cab sides (DM): cab door with window, driver's window
    if (isDM) {
      const dz0 = b0 + 0.22, dz1 = b0 + 0.90; const wz0 = b0 + 1.02, wz1 = cabZ - 0.14;
      col.add('cabDoor', profileStrip(P, sill, doorTop, dz0, dz1, { side, inset: 0.018 }));
      col.add('dark', profileStrip(P, sill, doorTop, dz0 - 0.012, dz0, { side })); col.add('dark', profileStrip(P, sill, doorTop, dz1, dz1 + 0.012, { side }));
      col.add('dark', profileStrip(P, doorTop, doorTop + 0.012, dz0 - 0.012, dz1 + 0.012, { side }));
      col.add('glass', profileStrip(P, wb + 0.05, wt - 0.06, dz0 + 0.09, dz1 - 0.09, { side, inset: 0.03 }));
      col.add('windowFrame', profileStrip(P, wb + 0.02, wb + 0.05, dz0 + 0.06, dz1 - 0.06, { side, inset: 0.016 })); col.add('windowFrame', profileStrip(P, wt - 0.06, wt - 0.03, dz0 + 0.06, dz1 - 0.06, { side, inset: 0.016 }));
      col.add('steel', profileStrip(P, sill + 0.85, sill + 0.95, dz1 - 0.16, dz1 - 0.05, { side, inset: -0.02 }));
      col.add('body', profileStrip(P, sill, wb, wz0 - 0.12, wz1 + 0.12, { side })); col.add('body', profileStrip(P, wt, doorTop, wz0 - 0.12, wz1 + 0.12, { side }));
      col.add('glass', profileStrip(P, wb, wt, wz0, wz1, { side, inset: 0.012 }));
      col.add('windowFrame', profileStrip(P, wb - 0.03, wb, wz0 - 0.03, wz1 + 0.03, { side, inset: 0.004 })); col.add('windowFrame', profileStrip(P, wt, wt + 0.03, wz0 - 0.03, wz1 + 0.03, { side, inset: 0.004 }));
      col.add('windowFrame', profileStrip(P, wb, wt, wz0 - 0.03, wz0, { side, inset: 0.004 })); col.add('windowFrame', profileStrip(P, wb, wt, wz1, wz1 + 0.03, { side, inset: 0.004 }));
      col.add('body', profileStrip(P, sill, doorTop, b0, dz0 - 0.012, { side })); col.add('body', profileStrip(P, sill, doorTop, dz1 + 0.012, wz0 - 0.12, { side })); col.add('body', profileStrip(P, sill, doorTop, wz1 + 0.12, cabZ, { side }));
      col.add('body', profileStrip(P, wb, wt, wz1 + 0.12, cabZ, { side }));
    }
    // decals: 440 mm roundel + line name near one end, blue 80 mm car numbers near both ends (centred between the window bottom and the band)
    if (atlas) {
      const yB = (sill + wb) / 2 + 0.02; const zr = isDM ? cabZ + 0.55 : b0 + 0.75;
      col.add('decal', decalOn(atlas.rect('roundel'), 0.44, 0.44, exteriorMatrix(P, yB, zr, side)));
      col.add('decal', decalOn(atlas.rect('lineName'), 0.56, 0.28, exteriorMatrix(P, yB, zr + 0.56, side)));
      for (const zn of [b1 - 0.6, isDM ? b0 + 1.02 + 0.45 : b0 + 0.75 + 1.15]) col.add('decal', decalOn(atlas.rect('unitNo'), 0.26, 0.26, exteriorMatrix(P, sill + 0.30, zn, side)));
    }
    // inter-car barrier (1996 closed ends): black rubber panel bridging half the gap at the corner
    if (!isS7) for (const [zEnd, dir] of isDM ? [[b1, 1]] : [[b0, -1], [b1, 1]]) col.add('rubber', boxAt(0.025, 1.7, spec.endInset.closed + 0.02, side * (xAt(P, 1.5) - 0.10), 1.55, zEnd + dir * spec.endInset.closed / 2));
    // solebar / step strip along the bottom edge
    col.add('dark', boxAt(0.05, 0.14, len - 0.3, side * (xAt(P, bb) - 0.04), bb - 0.06, (b0 + b1) / 2));
  }
  // underside closure, equipment cases, couplers
  const zc = (b0 + b1) / 2;
  col.add('dark', boxAt(2 * xAt(P, bb) - 0.06, 0.05, len - 0.05, 0, bb - 0.02, zc));
  const zb = lay.len * spec.bogieSpacing / 2;
  const cases = isS7 ? [[-2.6, 1.4, 0.5, 1.2, 0.25], [-0.6, 1.9, 0.45, 1.3, -0.2], [1.6, 1.2, 0.5, 1.0, 0.3], [3.2, 0.8, 0.35, 0.8, -0.35]] : [[-2.7, 1.5, 0.42, 1.2, 0.2], [-0.4, 1.7, 0.4, 1.4, -0.15], [1.9, 1.1, 0.45, 1.0, 0.25]];
  for (const [z, w, h, d, x] of cases) if (Math.abs(z) < zb - 1.5) col.add('dark', boxAt(w, h, d, x, bb - 0.05 - h / 2, z));
  for (const [zEnd, dir] of [[-half, -1], [half, 1]]) {
    if (isDM && dir < 0) { col.add('dark', boxAt(0.36, 0.28, 0.5, 0, 0.72, b0 - 0.1)); col.add('dark', cylAt(0.06, 0.6, 0, 0.72, b0 - 0.12, { axis: 'z', seg: 8 })); }
    else { const bz = dir < 0 ? b0 : b1; col.add('dark', cylAt(0.07, Math.abs(zEnd - bz) + 0.3, 0, 0.72, (zEnd + bz) / 2 - dir * 0.1, { axis: 'z', seg: 8 })); col.add('dark', boxAt(0.5, 0.3, 0.35, 0, 0.72, bz + dir * 0.02)); }
  }
  // bogies (wheels are instanced per train)
  const wr = spec.wheelDiameter / 2; const wbase = isS7 ? 2.1 : 1.9;
  for (const z of [-zb, zb]) {
    for (const x of [-1, 1]) { col.add('dark', boxAt(0.14, 0.34, 2.9, x * 1.02, wr + 0.12, z)); col.add('dark', boxAt(0.14, 0.16, 1.4, x * 1.02, wr + 0.40, z)); }
    col.add('dark', boxAt(2.1, 0.22, 0.24, 0, wr + 0.18, z - wbase / 2 - 0.35)); col.add('dark', boxAt(2.1, 0.22, 0.24, 0, wr + 0.18, z + wbase / 2 + 0.35));
    col.add('dark', boxAt(1.7, 0.28, 0.5, 0, wr + 0.34, z)); col.add('dark', boxAt(0.6, 0.42, 0.7, 0, wr, z));
    for (const dz of [-wbase / 2, wbase / 2]) { col.add('dark', cylAt(0.06, 1.62, 0, wr, z + dz, { axis: 'x', seg: 8 })); for (const x of [-1, 1]) { col.add('dark', boxAt(0.12, 0.28, 0.16, x * 0.72, wr, z + dz + 0.30)); col.add('dark', boxAt(0.20, 0.30, 0.18, x * 0.95, wr - 0.02, z + dz)); } }
    // current-collector shoes: negative rail outside on the left, positive rail in the centre (LU four-rail)
    col.add('dark', boxAt(0.28, 0.05, 0.34, -1.12, 0.30, z - wbase / 2 + 0.55)); col.add('dark', boxAt(0.10, 0.10, 0.12, -1.12, 0.38, z - wbase / 2 + 0.55));
    col.add('dark', boxAt(0.30, 0.05, 0.34, 0, 0.14, z + wbase / 2 + 0.55));
  }
  // roof equipment: S7 two air-conditioning packs per car; 1996 ventilation cowls
  if (isS7) {
    for (const z of [b0 + 3.4, b1 - 3.4]) { col.add('roof', boxAt(2.0, 0.26, 1.7, 0, top + 0.08, z)); for (const x of [-1, 1]) col.add('dark', boxAt(0.02, 0.16, 1.5, x * 1.01, top + 0.09, z)); col.add('dark', boxAt(1.7, 0.02, 0.4, 0, top + 0.215, z + 0.5)); }
    col.add('roof', boxAt(1.2, 0.12, Math.max(1, len - 9), 0, top + 0.02, zc));
  } else {
    for (const z of [b0 + 2.4, zc, b1 - 2.4]) col.add('dark', boxAt(0.55, 0.11, 1.1, 0.30, top - 0.03, z));
    col.add('roof', boxAt(0.9, 0.05, Math.max(1, len - 3), 0, top + 0.01, zc));
  }
  // ---- car ends
  for (const [zEnd, dir] of [[b0, -1], [b1, 1]]) {
    if (isDM && dir < 0) continue;      // cab front is built below
    if (isS7) {
      col.add('body', profileCap(P, zEnd, bb, { dir, holes: [{ x0: -0.95, x1: 0.95, y0: spec.floorHeight - 0.32, y1: spec.floorHeight + spec.gangway.height + 0.45 }] }));
    } else {
      col.add('body', profileCap(P, zEnd, bb, { dir }));
      // inter-car end door outline + end windows (you can see into the next car)
      col.add('dark', boxAt(0.70, 0.02, 0.02, 0, spec.floorHeight + 1.93, zEnd + dir * 0.01)); for (const x of [-0.34, 0.34]) col.add('dark', boxAt(0.02, 1.9, 0.02, x, spec.floorHeight + 0.97, zEnd + dir * 0.01));
      for (const [x0, x1, y0, y1] of [[-0.17, 0.17, spec.floorHeight + 1.30, spec.floorHeight + 1.85], [-0.95, -0.45, spec.floorHeight + 1.05, spec.floorHeight + 1.85], [0.45, 0.95, spec.floorHeight + 1.05, spec.floorHeight + 1.85]]) {
        col.add('glass', planeAt(x1 - x0, y1 - y0, (x0 + x1) / 2, (y0 + y1) / 2, zEnd + dir * 0.012, { ry: dir > 0 ? 0 : Math.PI }));
        col.add('windowFrame', planeAt(x1 - x0 + 0.06, y1 - y0 + 0.06, (x0 + x1) / 2, (y0 + y1) / 2, zEnd + dir * 0.006, { ry: dir > 0 ? 0 : Math.PI }));
      }
    }
  }
  if (isDM) buildCabFront(spec, lay, col, atlas);
}

/** Cab front of a DM at z = b0: coloured face, black windscreen surrounds, M-door, destination display housing, lamp bezels, wipers, coupler. */
function buildCabFront(spec, lay, col, atlas) {
  const P = spec.profile; const { b0, isS7 } = lay; const z = b0; const bb = spec.bodyBottom;
  const y0 = isS7 ? 1.95 : 1.62, y1 = isS7 ? 2.95 : 2.36;   // cab window band
  // 1996: blue face up to the windscreen top, aluminium above, grey lower valance; S7: red face, black windscreen mask, blue band below
  col.add('cabFace', profileCap(P, z, bb, { dir: -1 }));
  if (!isS7) col.add('roof', planeAt(2 * xAt(P, y1 + 0.1) - 0.1, 0.55, 0, y1 + 0.28, z - 0.004, { ry: Math.PI }));
  col.add('valance', planeAt(2 * xAt(P, 0.6) - 0.04, isS7 ? 0.5 : 0.46, 0, isS7 ? 0.72 : bb + 0.23, z - 0.006, { ry: Math.PI }));
  // windscreens (two-piece) with black surrounds; S7 has a full-width black mask
  if (isS7) col.add('windowFrame', planeAt(2.62, y1 - y0 + 0.18, 0, (y0 + y1) / 2, z - 0.006, { ry: Math.PI }));
  const win = isS7 ? [[-1.2, -0.36], [0.36, 1.2]] : [[-1.06, -0.36], [0.36, 1.06]];
  for (const [x0, x1] of win) { col.add('glass', planeAt(x1 - x0, y1 - y0, (x0 + x1) / 2, (y0 + y1) / 2, z - 0.014, { ry: Math.PI })); col.add('windowFrame', planeAt(x1 - x0 + 0.08, y1 - y0 + 0.08, (x0 + x1) / 2, (y0 + y1) / 2, z - 0.009, { ry: Math.PI })); }
  // M door (centre, red) with its window, outline and handle — bottom-hinged detrainment door
  const dTop = spec.doorSill + spec.doorHeight - 0.05;
  col.add('red', boxAt(0.62, dTop - spec.doorSill, 0.02, 0, (dTop + spec.doorSill) / 2, z - 0.012));
  col.add('dark', boxAt(0.66, 0.02, 0.03, 0, dTop + 0.01, z - 0.015)); for (const x of [-0.32, 0.32]) col.add('dark', boxAt(0.02, dTop - spec.doorSill + 0.02, 0.03, x, (dTop + spec.doorSill) / 2, z - 0.015));
  col.add('glass', planeAt(0.42, y1 - y0 - 0.1, 0, (y0 + y1) / 2, z - 0.026, { ry: Math.PI })); col.add('windowFrame', planeAt(0.48, y1 - y0 - 0.04, 0, (y0 + y1) / 2, z - 0.021, { ry: Math.PI }));
  col.add('steel', boxAt(0.03, 0.22, 0.04, 0.24, spec.floorHeight + 1.0, z - 0.03));
  // destination display housing (screen mesh added per train): orange LEDs above the M door / in the black band
  const dy = isS7 ? 3.18 : 2.56, dw = isS7 ? 1.5 : 1.16, dh = isS7 ? 0.24 : 0.22;
  col.add('windowFrame', boxAt(isS7 ? 2.6 : dw + 0.08, dh + 0.06, 0.05, 0, dy, z - 0.02));
  // lamp clusters at the lower outer corners: bezels (lamps are separate switchable meshes)
  const ly = isS7 ? 1.18 : 0.98;
  for (const x of [-1, 1]) col.add('dark', boxAt(0.36, 0.20, 0.03, x * 0.96, ly, z - 0.012));
  // wipers
  for (const x of [-0.70, 0.70]) col.add('rubber', boxAt(0.018, 0.62, 0.014, x, (y0 + y1) / 2 - 0.05, z - 0.03, { rz: x < 0 ? 0.45 : -0.45 }));
  // train number: 1996 white 120 mm on the left-hand grey valance panel + de-icing circle; S7 white 45 mm between the M door and the display
  if (atlas) {
    if (isS7) col.add('decal', planeAt(0.22, 0.14, 0, dTop + 0.14, z - 0.016, { ry: Math.PI, uvRect: atlas.rect('unitNoWhite') }));
    else { col.add('decal', planeAt(0.42, 0.26, 0.72, bb + 0.24, z - 0.012, { ry: Math.PI, uvRect: atlas.rect('unitNoWhite') })); col.add('decal', planeAt(0.09, 0.09, 1.02, bb + 0.24, z - 0.012, { ry: Math.PI, uvRect: atlas.rect('deicing') })); }
  }
  // anti-climber / buffer beam and the brow over the display
  col.add('dark', boxAt(2 * xAt(P, bb) - 0.2, 0.12, 0.10, 0, bb + 0.06, z - 0.05));
  col.add(isS7 ? 'cabFace' : 'roof', boxAt(dw + 0.5, 0.06, 0.12, 0, dy + dh / 2 + 0.06, z - 0.05));
  lay.lamps = [[-1, 'head', -0.96 - 0.08, ly], [-1, 'tail', -0.96 + 0.09, ly], [1, 'head', 0.96 + 0.08, ly], [1, 'tail', 0.96 - 0.09, ly]].map(([s, kind, x, y]) => ({ kind, x, y, z: z - 0.03 }));
  lay.destDisplay = { x: 0, y: dy, z: z - 0.048, w: dw, h: dh };
}

/** Everything for one car type: merged geometries per material + layout + collision model. Cached per stock/type/atlas. */
function carAssembly(spec, carIndex, atlas) {
  const isDM = carIndex === 0 || carIndex === spec.cars - 1;
  const wc = (spec.wheelchairCars || []).includes(carIndex);
  const key = `${spec.code}:${isDM ? 'DM' : 'M' + (wc ? 'W' : '')}:${atlas.texture.uuid}`;
  if (assemblyCache.has(key)) return assemblyCache.get(key);
  const lay = carLayout(spec, carIndex); const col = new Collector();
  buildExterior(spec, lay, col, atlas);
  buildInterior(spec, lay, col, atlas);
  const geos = col.merged();
  const asm = { lay, geos, coll: collisionModel(spec, lay) };
  assemblyCache.set(key, asm); return asm;
}

// ---------------------------------------------------------------------------
// The train
// ---------------------------------------------------------------------------
export class Train {
  constructor(ctx, { stock = '1996', track = null, direction = 'eastbound', destination = null, line = null, unitNumber = null } = {}) {
    this.ctx = ctx; const spec = this.spec = stock === 'S7' ? STOCK_S7 : STOCK_1996; this.stock = spec.code;
    this.track = track; this.direction = direction; this.line = line || spec.line; this.destination = destination;
    this.group = new THREE.Group(); this.group.name = `train-${spec.code}`; this.group.userData.train = this;
    this.floorY = spec.floorHeight; this.doorsOpen = false; this.sway = 0; this.speed = 0; this.accel = 0; this.length = trainLength(spec);
    this.doorAmount = { left: 0, right: 0 }; this.doorTarget = { left: 0, right: 0 }; this.doorPhase = { left: 0, right: 0 };
    this.cars = []; this.leaves = []; this.instanced = []; this.lamps = []; this.seatProxies = []; this.time = 0; this.wheelAngle = 0; this.forward = true;
    this.unitNumber = unitNumber || spec.unitNumbers[(unitCounter++) % spec.unitNumbers.length];
    this._s = null; this._near = true; this._frameCounter = 0; this._lastSpeed = 0; this._seated = null; this._dirty = false;
    try { this._build(); } catch (e) { console.error('[trains] build failed', e); }
    try { this._buildAudio(); } catch (e) { console.warn('[trains] audio setup failed', e); }
    if (destination) this.setDestination(destination);
    this.setDisplay(this.line === 'circle' ? 'Circle line' : this.line === 'jubilee' ? 'Jubilee line' : 'District line');
    this.setLights(true);
  }

  // ---------------- construction ----------------
  _build() {
    const { ctx, spec } = this; const { T, M } = ctx;
    const lineName = this.line === 'circle' ? 'Circle line' : (spec.line === 'jubilee' ? 'Jubilee line' : 'District line');
    const lineColor = this.line === 'circle' ? '#ffd300' : (spec.line === 'jubilee' ? '#a0a5a9' : '#00782a');
    const atlas = this.atlas = decalAtlas(spec, { unitNumber: this.unitNumber, lineName, lineColor });
    const mats = this.mats = trainMaterials(spec); const decalMat = decalMaterial(atlas);
    const offsets = carOffsets(spec);
    const castKeys = new Set(['body', 'lowerBody', 'roof', 'blue', 'red', 'dark', 'cabFace']);
    // per-train dynamic textures
    this.led = T.ledStrip({ width: 1024, height: 96, color: '#ff9e1b' });
    this.ledMat = M.screen(this.led.texture, 1.5);
    this.dest = T.dotMatrix({ cols: 90, rows: 1, dot: 6, gap: 2, color: '#ff8a00' });
    this.destMat = M.screen(this.dest.texture, 1.8);
    const diagramTex = T.lineDiagram({ line: this.line === 'circle' ? 'Circle' : (spec.line === 'jubilee' ? 'Jubilee' : 'District'), color: lineColor, stations: this.line === 'circle' && spec.circleDiagram ? spec.circleDiagram : spec.lineDiagram, current: 'Westminster', width: 4096, height: 256 });
    const diagramMat = M.signMaterial(diagramTex, { emissive: 0.45 });
    const posterMats = [M.signMaterial(T.poster({ headline: 'Mind the gap', sub: 'Please take care when boarding', seed: 11, hue: 210 }), { emissive: 0.4 }), M.signMaterial(T.poster({ headline: 'Keep hold of your bag', sub: 'Please keep belongings with you', seed: 12, hue: 30 }), { emissive: 0.4 }), M.signMaterial(T.poster({ headline: 'Plan ahead', sub: 'Check before you travel', seed: 13, hue: 300 }), { emissive: 0.4 })];
    const invisible = new THREE.MeshBasicMaterial({ visible: false });
    const leafGroups = new Map(); const wheelSlots = [], displaySlots = [], diagramSlots = [], posterSlots = [[], [], []];
    for (const c of offsets) {
      const asm = carAssembly(spec, c.car, atlas); const lay = asm.lay;
      const carG = new THREE.Group(); carG.name = `car-${c.car}`; carG.position.set(0, 0, -c.offset);
      const body = new THREE.Group(); body.name = 'body'; if (lay.flip) body.rotation.y = Math.PI; carG.add(body);
      for (const [key, geo] of Object.entries(asm.geos)) {
        const mat = key === 'decal' ? decalMat : mats[key]; if (!mat) { console.warn('[trains] no material for', key); continue; }
        const mesh = new THREE.Mesh(geo, mat); mesh.name = key; mesh.castShadow = castKeys.has(key); mesh.receiveShadow = true;
        if (key === 'glass' || key === 'clearGlass') mesh.renderOrder = 2; if (key === 'decal') mesh.renderOrder = 1;
        body.add(mesh);
      }
      const car = { index: c.car, offset: c.offset, len: c.length, half: c.length / 2, group: carG, body, lay, coll: asm.coll, flip: lay.flip, mat: new THREE.Matrix4(), inv: new THREE.Matrix4(), phase: Math.random() * 6.28 };
      this.cars.push(car); this.group.add(carG);
      // door leaves (geometry space: +x side built, -x side turned through 180°).
      // lead = +1 → leading edge at +z: the leaf in the -z half of a doorway leads towards the centre; a single leaf leads towards the car centre.
      for (const d of lay.doorways) for (const gside of [-1, 1]) {
        const leaves = d.leaves === 2 ? [[1, d.z - d.width / 4, d.width / 2], [-1, d.z + d.width / 4, d.width / 2]] : [[d.z > 0 ? -1 : 1, d.z, d.width]];
        for (const [lead, zc, w] of leaves) {
          const geomLead = gside > 0 ? lead : -lead; const gkey = `${w.toFixed(3)}:${geomLead}`;
          let lg = leafGroups.get(gkey); if (!lg) { lg = { width: w, lead: geomLead, items: [] }; leafGroups.set(gkey, lg); }
          const leaf = { car, doorway: d, gside, lead, zc, width: w, openDir: -lead, side: (lay.flip ? -gside : gside) > 0 ? 'right' : 'left', group: lg, id: lg.items.length };
          lg.items.push(leaf); this.leaves.push(leaf);
        }
      }
      // wheels
      const zb = c.length * spec.bogieSpacing / 2; const wbase = spec.code === 'S7' ? 2.1 : 1.9; const wr = spec.wheelDiameter / 2;
      for (const z of [-zb, zb]) for (const dz of [-wbase / 2, wbase / 2]) for (const x of [-1, 1]) wheelSlots.push({ car, x: x * (GAUGE / 2 + 0.03), y: wr, z: z + dz, flip: x });
      // LED displays, line diagrams, posters (matrices in geometry space)
      for (const d of lay.displays) displaySlots.push({ car, m: d.m.clone().multiply(new THREE.Matrix4().makeScale(d.w, d.h, 1)) });
      let pk = c.car % 3;
      for (const p of lay.panels) {
        const y = spec.windowTop + 0.14 + (spec.code === 'S7' ? 0.04 : 0); const m = surfaceMatrix(spec.interior, y, p.z, p.side, 0.010).multiply(new THREE.Matrix4().makeScale(p.w, p.h, 1));
        if (p.kind === 'diagram') diagramSlots.push({ car, m }); else { posterSlots[pk % 3].push({ car, m }); pk++; }
      }
      // lamps + destination display (DM)
      if (lay.lamps) {
        for (const l of lay.lamps) { const g = new THREE.CircleGeometry(l.kind === 'head' ? 0.062 : 0.045, 16); g.rotateY(Math.PI); g.translate(l.x, l.y, l.z); const mesh = new THREE.Mesh(g, l.kind === 'head' ? mats.headOff : mats.tailOff); body.add(mesh); this.lamps.push({ mesh, kind: l.kind, car: c.car }); }
        const dd = lay.destDisplay; const dg = new THREE.PlaneGeometry(dd.w, dd.h); dg.rotateY(Math.PI); dg.translate(dd.x, dd.y, dd.z); body.add(new THREE.Mesh(dg, this.destMat));
      }
      // sittable seats
      for (const s of lay.seats) if (s.interactive) {
        const proxy = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.42), invisible); proxy.position.set(s.x, spec.floorHeight + spec.seatCushion + 0.1, s.z); proxy.name = 'seat'; body.add(proxy);
        const rec = { proxy, car, seat: s }; this.seatProxies.push(rec);
        if (ctx.interactive) ctx.interactive(proxy, { prompt: 'E — sit down', distance: 2.2, onInteract: () => this._sit(rec) });
      }
    }
    // build the InstancedMeshes
    const mk = (geo, mat, slots, name) => { const im = new THREE.InstancedMesh(geo, mat, Math.max(1, slots.length)); im.count = slots.length; im.name = name; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(im); this.instanced.push({ mesh: im, slots }); return im; };
    for (const lg of leafGroups.values()) {
      const geo = leafGeometry(spec, lg.width, lg.lead, atlas);
      const im = mk(geo, [mats.red, mats.glass, mats.rubber, mats.yellow, mats.pole, decalMat], lg.items, 'leaves'); im.castShadow = true; lg.mesh = im;
      for (const leaf of lg.items) leaf.mesh = im;
    }
    this.wheelMesh = mk(wheelGeometry(spec.wheelDiameter), mats.wheel, wheelSlots, 'wheels'); this.wheelSlots = wheelSlots;
    if (displaySlots.length) mk(new THREE.PlaneGeometry(1, 1), this.ledMat, displaySlots, 'led');
    if (diagramSlots.length) mk(new THREE.PlaneGeometry(1, 1), diagramMat, diagramSlots, 'diagrams');
    posterSlots.forEach((slots, i) => { if (slots.length) mk(new THREE.PlaneGeometry(1, 1), posterMats[i], slots, 'posters'); });
    this._ownMaterials = [this.ledMat, this.destMat, diagramMat, ...posterMats, invisible];
    this._refreshCarMatrices(); this._updateInstances(); this._dirty = false;
  }

  _buildAudio() {
    const { audio } = this.ctx; if (!audio) return;
    if (!audio.synths.has('train:saloon')) audio.registerSynth('train:saloon', (c, { stock = '1996' } = {}) => {
      // in-car ambience: ventilation / air-conditioning fan (broadband) + static-converter whine
      const out = c.createGain(); out.gain.value = 0.6; const len = c.sampleRate * 2; const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0); let seed = 7, lp = 0;
      for (let i = 0; i < len; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; const w = (seed / 4294967296) * 2 - 1; lp = lp * 0.96 + w * 0.04; d[i] = lp * 3; }
      const n = c.createBufferSource(); n.buffer = b; n.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = stock === 'S7' ? 900 : 600; const ng = c.createGain(); ng.gain.value = 0.35;
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = stock === 'S7' ? 100 : 1000; const og = c.createGain(); og.gain.value = stock === 'S7' ? 0.08 : 0.025;
      n.connect(f); f.connect(ng); ng.connect(out); o.connect(og); og.connect(out);
      return { output: out, start() { n.start(); o.start(); }, stop() { try { n.stop(); o.stop(); } catch (e) {} } };
    });
    if (!audio.synths.has('train:s7open')) audio.registerSynth('train:s7open', (c) => {
      // S stock door-opening motif: two soft notes (dossier §10.6 verdict)
      const out = c.createGain(); out.gain.value = 0.5; const t0 = c.currentTime;
      [[1046.5, 0], [1318.5, 0.16]].forEach(([f, dt]) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0 + dt); g.gain.exponentialRampToValueAtTime(0.5, t0 + dt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.35); o.connect(g); g.connect(out); o.start(t0 + dt); o.stop(t0 + dt + 0.4); });
      return { output: out, duration: 0.7, start() {}, stop() {} };
    });
    this.runEmitter = audio.emitter({ object: this.group, synth: 'trainRun', params: { stock: this.stock }, gain: 1.0, refDistance: 9, maxDistance: 260, rolloff: 1.1 });
    this.saloonEmitter = audio.emitter({ object: this.group, synth: 'train:saloon', params: { stock: this.stock }, gain: 0.32, refDistance: 3, maxDistance: 26 });
  }

  // ---------------- placement ----------------
  /** Position the group at the frame of the train centre and every car at its own frame, so the train follows curves. */
  placeAlong(track, s) {
    if (!track) return; if (track === this.track && s === this._s) return; this.track = track;
    const g = this.group; track.frameAt(s, _frame); g.position.copy(_frame.position); g.quaternion.copy(_frame.quaternion); g.updateMatrix();
    const qInv = _q.copy(g.quaternion).invert();
    // remember the car the player rides in so we can carry them with it round curves
    const player = this.ctx.player; const riding = player && player.train === this && player.local;
    if (riding) this._carrySetup(player);
    for (const car of this.cars) {
      track.frameAt(s + car.offset, _frame);
      car.group.position.copy(_frame.position).sub(g.position).applyQuaternion(qInv);
      car.group.quaternion.copy(qInv).multiply(_frame.quaternion);
    }
    this._refreshCarMatrices();
    if (riding) this._carryApply(player);
    this._s = s; g.updateMatrixWorld(true);
    // instanced parts hang off the car frames: refresh now if standing, else let update() do it after the sway pass
    if (Math.abs(this.speed) < 0.01) { this._updateInstances(); this._dirty = false; } else this._dirty = true;
  }
  _refreshCarMatrices() {
    for (const car of this.cars) { car.group.updateMatrix(); car.body.updateMatrix(); car.mat.multiplyMatrices(car.group.matrix, car.body.matrix); car.inv.copy(car.mat).invert(); }
  }
  _carrySetup(player) {
    const car = this._carFor(player.local); this._carryCar = car; this._carryLocal = _v.copy(player.local).applyMatrix4(car.inv).clone(); this._carryYaw = yawOf(car.mat);
  }
  _carryApply(player) {
    const car = this._carryCar; if (!car) return;
    player.local.copy(this._carryLocal).applyMatrix4(car.mat); player.local.y = this.floorY;
    const dy = yawOf(car.mat) - this._carryYaw; if (Math.abs(dy) < 1 && typeof player.localYaw === 'number') player.localYaw += dy;
  }
  /** The car whose centre is nearest a group-local point. */
  _carFor(p) { let best = this.cars[0], bd = Infinity; for (const c of this.cars) { const d = Math.abs(p.z - c.group.position.z) + Math.abs(p.x - c.group.position.x) * 0.3; if (d < bd) { bd = d; best = c; } } return best; }

  // ---------------- contract: interior ----------------
  interiorContains(p) {
    const car = this._carFor(p); const g = _v.copy(p).applyMatrix4(car.inv); const lay = car.lay; const spec = this.spec;
    if (g.y < this.floorY - 0.7 || g.y > this.floorY + 2.4) return false;
    if (g.z > car.half + 0.05 || g.z < -car.half - 0.05) return false;
    if (lay.isDM && g.z < lay.cabZ) return false;
    if (Math.abs(g.x) < lay.halfInt + 0.05) return true;
    // in the threshold of an open doorway on that side (so the player is caught as soon as they step off the platform)
    if (Math.abs(g.x) < spec.width / 2 + 0.36) { const gside = Math.sign(g.x); const amt = this._amountFor(car, gside); if (amt > 0.5) for (const d of lay.doorways) if (g.z > d.zMin - 0.05 && g.z < d.zMax + 0.05) return true; }
    return false;
  }
  _amountFor(car, gside) { const side = (car.flip ? -gside : gside) > 0 ? 'right' : 'left'; return this.doorAmount[side]; }

  resolveInterior(p, r = 0.33, height = 1.78, stepUp = 0.42) {
    const car = this._carFor(p); const lay = car.lay; const coll = car.coll; const spec = this.spec; let exited = false;
    const g = _v.copy(p).applyMatrix4(car.inv); const halfInt = lay.halfInt; const bodyHalf = spec.width / 2;
    // lateral: walls, or an open doorway
    const ax = Math.abs(g.x);
    if (ax > halfInt - r) {
      const gside = Math.sign(g.x) || 1; let door = null;
      for (const d of lay.doorways) if (g.z > d.zMin + r - 0.06 && g.z < d.zMax - r + 0.06) { door = d; break; }
      const open = door && this._amountFor(car, gside) > 0.6;
      if (open) {
        g.z = Math.min(door.zMax - r + 0.06, Math.max(door.zMin + r - 0.06, g.z));
        if (ax > bodyHalf + 0.42) exited = true;
      } else g.x = gside * (halfInt - r);
    }
    // seats / screens (axis-aligned boxes in geometry space); never push towards the bodyside
    if (Math.abs(g.x) < halfInt) for (const b of coll.boxes) {
      if (g.x < b.xMin - r || g.x > b.xMax + r || g.z < b.zMin - r || g.z > b.zMax + r) continue;
      const pen = [[g.x - (b.xMin - r), -1, 0], [(b.xMax + r) - g.x, 1, 0], [g.z - (b.zMin - r), 0, -1], [(b.zMax + r) - g.z, 0, 1]];
      const usable = pen.filter(e => !(e[1] !== 0 && Math.sign(e[1]) === Math.sign(b.xMin + b.xMax))).sort((a, c) => a[0] - c[0]);
      const best = usable[0] || pen.sort((a, c) => a[0] - c[0])[0]; g.x += best[1] * best[0]; g.z += best[2] * best[0];
    }
    for (const pole of coll.poles) { const dx = g.x - pole.x, dz = g.z - pole.z; const d2 = dx * dx + dz * dz; const rr = r + pole.r; if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2); g.x += dx / d * (rr - d); g.z += dz / d * (rr - d); } }
    // longitudinal: cab partition, closed ends, gangway funnel
    if (lay.isDM && g.z < lay.cabZ + r) g.z = lay.cabZ + r;
    if (!spec.gangway) { const lim = lay.b1 - 0.14 - r; if (g.z > lim) g.z = lim; const lim0 = lay.b0 + 0.14 + r; if (!lay.isDM && g.z < lim0) g.z = lim0; }
    else {
      const gw = spec.gangway.width / 2 - r; const nearEnd = g.z > lay.b1 - 0.5 || (!lay.isDM && g.z < lay.b0 + 0.5);
      if (nearEnd && Math.abs(g.x) > gw) g.x = Math.sign(g.x) * gw;
    }
    p.copy(g.applyMatrix4(car.mat));
    return { exited };
  }

  /** World-space boxes for the car bodies (minus open doorways on the open side) — platform-side collision while stopped. */
  exteriorBoxes() {
    const spec = this.spec; const out = []; const hw = spec.width / 2; const y0 = 0.05, y1 = spec.height;
    this.group.updateMatrixWorld(true);
    for (const car of this.cars) {
      car.body.updateWorldMatrix(true, false); const wm = car.body.matrixWorld; const { b0, b1 } = car.lay;
      const segs = []; // [zMin, zMax, xMin, xMax] in geometry space
      const openSides = [-1, 1].filter(gs => this._amountFor(car, gs) > 0.3);
      if (!openSides.length) segs.push([b0, b1, -hw, hw]);
      else {
        let cursor = b0;
        for (const d of car.lay.doorways) {
          if (d.zMin > cursor) segs.push([cursor, d.zMin, -hw, hw]);
          for (const gs of [-1, 1]) if (!openSides.includes(gs)) segs.push([d.zMin, d.zMax, gs < 0 ? -hw : hw - 0.25, gs < 0 ? -hw + 0.25 : hw]);
          cursor = d.zMax;
        }
        if (b1 > cursor) segs.push([cursor, b1, -hw, hw]);
      }
      // couplings / gangways between bodies
      if (!car.lay.isDM) segs.push([-car.half, b0, -0.95, 0.95]);
      segs.push([b1, car.half, -0.95, 0.95]);
      for (const [z0, z1, x0, x1] of segs) {
        if (z1 - z0 < 0.01) continue; const b = new THREE.Box3();
        for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) b.expandByPoint(_v.set(x, y, z).applyMatrix4(wm));
        out.push(b);
      }
    }
    return out;
  }

  // ---------------- contract: doors ----------------
  setDoors(open, { side = null, silent = false, immediate = false } = {}) {
    const sides = side ? [side] : ['left', 'right'];
    for (const s of sides) this.doorTarget[s] = open ? 1 : 0;
    if (!open) { this.doorTarget.left = 0; this.doorTarget.right = 0; }
    if (immediate) for (const s of ['left', 'right']) { this.doorPhase[s] = this.doorTarget[s]; this.doorAmount[s] = this.doorTarget[s]; }
    this.doorsOpen = !!open;
    if (!silent) this._doorSounds(open, sides);
    if (immediate) this._updateInstances(true);
  }
  _doorSounds(open, sides) {
    const audio = this.ctx.audio; if (!audio || !audio.ready) return;
    const spec = this.spec; const L = audio.listenerPos || _v2.set(0, 0, 0);
    const doors = [];
    for (const car of this.cars) for (const d of car.lay.doorways) for (const gs of [-1, 1]) {
      const side = (car.flip ? -gs : gs) > 0 ? 'right' : 'left'; if (!sides.includes(side)) continue;
      const wp = _v.set(gs * spec.width / 2, spec.doorSill + 1.0, d.z).applyMatrix4(car.mat); this.group.localToWorld(wp);
      doors.push({ p: wp.clone(), d2: wp.distanceToSquared(L) });
    }
    doors.sort((a, b) => a.d2 - b.d2);
    // air/relay click then the leaves run (S7 opening also gets its two-note motif); closing keeps the pillar alarm going until the leaves meet
    doors.slice(0, 4).forEach((d, i) => setTimeout(() => { try { audio.play('doorMove', { position: d.p, gain: 0.55 - i * 0.08, params: { seconds: spec.doorTime * 0.85, closing: !open }, refDistance: 3, maxDistance: 45 }); } catch (e) {} }, i * 90));
    if (open && spec.openChime) doors.slice(0, 1).forEach(d => { try { audio.play(spec.openChime, { position: d.p, gain: 0.4, refDistance: 4, maxDistance: 40 }); } catch (e) {} });
    if (!open) doors.slice(0, 2).forEach((d, i) => { try { audio.play(spec.chime, { position: d.p, gain: 0.35 - i * 0.1, params: { seconds: spec.doorTime + 0.3 }, refDistance: 4, maxDistance: 40 }); } catch (e) {} });
  }

  // ---------------- contract: displays, speed, lights ----------------
  setDisplay(text) {
    this.displayText = text || ''; this.displayPages = paginate(this.displayText, 1024 - 40, 96 * 0.62); this.displayPage = 0; this.displayTimer = 0;
    this.led.set(this.displayPages[0] || '');
  }
  setDestination(text) {
    this.destText = String(text || '').toUpperCase(); this.destCols = this.destText.length * 6 - 1; this.destScroll = 0; this.destTimer = 0;
    this.dest.set([this.destText], { scroll: this.destCols > 90 ? -90 : -Math.floor((90 - this.destCols) / 2) });
  }
  setSpeed(v, accel = 0) {
    const was = this._lastSpeed; this.speed = v; this.accel = accel; this._lastSpeed = v;
    const av = Math.abs(v);
    if (this.runEmitter) { this.runEmitter.set('speed', av); this.runEmitter.set('accel', accel); }
    this.sway = Math.min(1, av / 15);
    if (v < -0.05 && this.forward) this.setLights(false); else if (v > 0.05 && !this.forward) this.setLights(true);
    if (was > 0.8 && av < 0.05) this._airRelease();   // brake-release hiss as we come to a stand
  }
  _airRelease() {
    const audio = this.ctx.audio; if (!audio || !audio.ready) return;
    const car = this._nearestCarTo(audio.listenerPos); const p = _v.set(0, 0.4, 0).applyMatrix4(car.mat); this.group.localToWorld(p);
    try { audio.play('airRelease', { position: p.clone(), gain: 0.45, params: { seconds: 1.4 }, refDistance: 4, maxDistance: 50 }); } catch (e) {}
  }
  _nearestCarTo(worldP) { let best = this.cars[0], bd = Infinity; for (const c of this.cars) { const d = c.group.getWorldPosition(_v2).distanceToSquared(worldP); if (d < bd) { bd = d; best = c; } } return best; }
  /** Head/tail lights follow the direction of travel: white pair at the leading cab, red pair at the trailing cab. */
  setLights(forward = true) {
    this.forward = forward; const m = this.mats; if (!m) return;
    for (const l of this.lamps) {
      const leading = (l.car === 0) === forward;
      l.mesh.material = l.kind === 'head' ? (leading ? m.headOn : m.headOff) : (leading ? m.tailOff : m.tailOn);
    }
  }

  // ---------------- per frame ----------------
  update(dt) {
    this.time += dt; const spec = this.spec;
    let doorsMoving = false;
    for (const s of ['left', 'right']) {
      const t = this.doorTarget[s]; let ph = this.doorPhase[s];
      if (ph !== t) { ph += Math.sign(t - ph) * dt / spec.doorTime; ph = Math.min(1, Math.max(0, ph)); this.doorPhase[s] = ph; this.doorAmount[s] = ph * ph * (3 - 2 * ph); doorsMoving = true; }
    }
    const listener = this.ctx.audio && this.ctx.audio.listenerPos ? this.ctx.audio.listenerPos : (this.ctx.player && this.ctx.player.pos) || null;
    const dist = listener ? this.group.position.distanceTo(listener) : 0; this._near = dist < 320;
    const moving = Math.abs(this.speed) > 0.01;
    if (moving) {
      this.wheelAngle = (this.wheelAngle + this.speed / (spec.wheelDiameter / 2) * dt) % (Math.PI * 2);
      const k = Math.min(1, Math.abs(this.speed) / 12);
      for (const car of this.cars) { const b = car.body; b.rotation.z = Math.sin(this.time * 1.7 + car.phase) * 0.0035 * k + Math.sin(this.time * 4.3 + car.phase * 2) * 0.0012 * k; b.position.y = Math.sin(this.time * 2.9 + car.phase) * 0.006 * k; b.position.x = Math.sin(this.time * 1.1 + car.phase * 3) * 0.004 * k; }
      this._refreshCarMatrices();
    }
    this._frameCounter++;
    if (this._dirty || doorsMoving || (moving && (this._near || this._frameCounter % 4 === 0))) { this._updateInstances(doorsMoving && !moving && !this._dirty); this._dirty = false; }
    if (this.displayPages && this.displayPages.length > 1) { this.displayTimer += dt; if (this.displayTimer > 3.2) { this.displayTimer = 0; this.displayPage = (this.displayPage + 1) % this.displayPages.length; this.led.set(this.displayPages[this.displayPage]); } }
    if (this.destCols > 90) { this.destTimer += dt; if (this.destTimer > 0.09) { this.destTimer = 0; this.destScroll += 1; if (this.destScroll > this.destCols) this.destScroll = -90; this.dest.set([this.destText], { scroll: this.destScroll }); } }
    if (this._seated) this._followSeat();
  }
  /** Recompute every instance matrix from the car frames. `leavesOnly` = doors are animating on a standing train. */
  _updateInstances(leavesOnly = false) {
    for (const rec of this.instanced) {
      const im = rec.mesh; const isLeaves = im.name === 'leaves', isWheels = im.name === 'wheels';
      if (leavesOnly && !isLeaves) continue;
      rec.slots.forEach((slot, i) => {
        if (isLeaves) {
          const amt = this.doorAmount[slot.side]; const dz = slot.zc + slot.openDir * amt * (slot.width + 0.025);
          _m.makeTranslation(0, 0, dz); if (slot.gside < 0) _m.multiply(_m2.makeRotationY(Math.PI));
          _m.premultiply(slot.car.mat);
        } else if (isWheels) {
          _m.makeRotationX(this.wheelAngle); if (slot.flip < 0) _m.premultiply(_m2.makeRotationY(Math.PI));
          _m.setPosition(slot.x, slot.y, slot.z); _m.premultiply(slot.car.mat);
        } else _m.copy(slot.m).premultiply(slot.car.mat);
        im.setMatrixAt(i, _m);
      });
      im.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------------- seats ----------------
  _sit(rec) {
    const player = this.ctx.player; if (!player || !player.sit) return;
    const s = rec.seat; const car = rec.car;
    const wp = rec.proxy.getWorldPosition(new THREE.Vector3()); wp.y = this.group.getWorldPosition(_v2).y + this.floorY + this.spec.seatCushion - 0.02;
    const dirG = s.kind === 'transverse' ? new THREE.Vector3(0, 0, s.facing) : new THREE.Vector3(-s.side, 0, 0);
    const dirW = dirG.applyQuaternion(car.body.getWorldQuaternion(_q)).normalize();
    const yaw = Math.atan2(-dirW.x, -dirW.z);
    const seat = { position: wp, yaw, train: this };
    this._seated = { rec, seat, lastYaw: yawOf(car.mat), player };
    if (this.ctx.audio && this.ctx.audio.ready) try { this.ctx.audio.play('footstep', { gain: 0.25, params: { surface: 'carpet' } }); } catch (e) {}
    player.yaw = yaw; if (typeof player.pitch === 'number') player.pitch = Math.min(player.pitch, 0.2);
    if (player.train === this && typeof player.localYaw === 'number') { const e = new THREE.Euler().setFromQuaternion(this.group.getWorldQuaternion(_q), 'YXZ'); player.localYaw = yaw - e.y; }
    player.sit(seat);
  }
  _followSeat() {
    const st = this._seated; const player = st.player;
    if (!player || player.seated !== st.seat) { this._seated = null; return; }
    st.rec.proxy.getWorldPosition(st.seat.position); st.seat.position.y = this.group.getWorldPosition(_v2).y + this.floorY + this.spec.seatCushion - 0.02;
    const y = yawOf(st.rec.car.mat); const dy = y - st.lastYaw; st.lastYaw = y; if (Math.abs(dy) < 1) player.yaw += dy;
  }

  dispose() {
    const { ctx } = this;
    try { for (const em of [this.runEmitter, this.saloonEmitter]) if (em) { em.stop(); const i = ctx.audio.emitters.indexOf(em); if (i >= 0) ctx.audio.emitters.splice(i, 1); } } catch (e) {}
    for (const rec of this.seatProxies) { const i = ctx.interactables ? ctx.interactables.indexOf(rec.proxy) : -1; if (i >= 0) ctx.interactables.splice(i, 1); }
    for (const m of this._ownMaterials || []) { try { m.dispose(); } catch (e) {} }
    try { this.led.texture.dispose(); this.dest.texture.dispose(); } catch (e) {}
    for (const rec of this.instanced) rec.mesh.dispose();
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}

export class Train1996 extends Train { constructor(ctx, opts = {}) { super(ctx, { ...opts, stock: '1996' }); } }
export class TrainS7 extends Train { constructor(ctx, opts = {}) { super(ctx, { ...opts, stock: 'S7' }); } }
export function createTrain(ctx, opts = {}) { return opts.stock === 'S7' ? new TrainS7(ctx, opts) : new Train1996(ctx, opts); }

// ---------------- helpers ----------------
function yawOf(m) { const e = m.elements; return Math.atan2(e[8], e[10]); }   // rotation about Y of a (rotation-only) matrix

let _measureCtx = null;
/** Split text into pages that fit the LED strip at the given px font size. */
function paginate(text, maxPx, fontPx) {
  if (!text) return [''];
  if (!_measureCtx) { try { _measureCtx = document.createElement('canvas').getContext('2d'); } catch (e) { return [text]; } }
  const c = _measureCtx; c.font = `bold ${fontPx}px Johnston, 'Gill Sans', Helvetica, Arial, sans-serif`;
  if (c.measureText(text).width <= maxPx) return [text];
  const words = text.split(/\s+/); const pages = []; let cur = '';
  for (const w of words) { const trial = cur ? cur + ' ' + w : w; if (c.measureText(trial).width <= maxPx || !cur) cur = trial; else { pages.push(cur); cur = w; } }
  if (cur) pages.push(cur);
  return pages;
}
