// ---------------------------------------------------------------------------
// street/portcullisHouse.js — Portcullis House (Hopkins, 2001) over the station: the ground-floor
// colonnade of granite-and-gritstone piers along Bridge Street and the Embankment, Tesco Express (west)
// and Caffè Nero (east) behind the arcade, the 12 m station entrance recess at the origin (the ticket hall
// module builds the passage and stairs inside it), the six upper storeys of sandstone piers flanked by
// bronze duct strips with the deep-set bay windows, the bronze cornice, the steep aluminium-bronze
// mansard with its dormers and the 14 black ventilation chimneys, the roundel totem at the kerb,
// the Cannon Row gate, and the arcade lighting. Dossier §11.2.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { Merger, Instancer, makeMaterials, COL, signMat, bluePanel, nameplate, scaleUV, hex, FONT } from './kit.js';

export function buildPortcullisHouse(ctx, group, plan, state) {
  const { layout, collision, T } = ctx; const mats = makeMaterials(ctx); const S = layout.STREET; const PH = S.portcullisHouse;
  const M = new Merger(group, 'ph'); const I = new Instancer(group);
  const X0 = PH.xMin, X1 = PH.xMax, Z0 = PH.zMin, Z1 = PH.zMax;
  const ARC = 6.5, F1 = 7.5, TOP = PH.height, ROOF = TOP + PH.roofHeight, DEPTH = PH.colonnadeDepth, INSET = 7;
  const STOREYS = PH.storeys - 1, STOREY_H = (TOP - F1) / STOREYS;     // 6 storeys of 4.4 m over the colonnade
  const BAY = (X1 - X0) / 20;                                            // 3.85 m
  const blk = (r, tag) => collision.addBlocker(r, tag);
  const floors = [];

  // ================================================================ ground floor: the colonnade
  const pierW = 1.6, pierD = 1.6;
  const pier = (x, z) => {
    M.chunk('ph-ground');
    M.boxUp(mats.phGranite, pierW, 1.2, pierD, { x, y: 0, z }); M.boxUp(mats.phStone, pierW - 0.08, ARC - 1.2, pierD - 0.08, { x, y: 1.2, z, uvWorld: true });
    M.box(mats.bronze, pierW + 0.15, 0.25, pierD + 0.15, { x, y: ARC - 0.13, z });
    blk({ xMin: x - pierW / 2, xMax: x + pierW / 2, yMin: -0.5, yMax: ARC, zMin: z - pierD / 2, zMax: z + pierD / 2 }, 'ph:pier');
  };
  const southPiers = [-37.7, -30, -22.3, -14.6, -6.8, 6.8, 14.6, 22.3, 30, 37.7];
  for (const x of southPiers) pier(x, Z1 - pierD / 2);
  const eastPiers = [-11.5, -19.2, -26.9, -34.6, -42.3, -50.2];
  for (const z of eastPiers) pier(X1 - pierW / 2, z);
  // arcade soffit slab (ARC..F1) with a bronze fascia, and the east colonnade soffit
  M.chunk('ph-ground');
  M.box(mats.concrete, X1 - X0, F1 - ARC, DEPTH + 0.5, { x: (X0 + X1) / 2, y: (ARC + F1) / 2, z: Z1 - DEPTH / 2 - 0.25 });
  M.box(mats.concrete, DEPTH + 0.5, F1 - ARC, Z1 - Z0, { x: X1 - DEPTH / 2 - 0.25, y: (ARC + F1) / 2, z: (Z0 + Z1) / 2 });
  M.box(mats.bronze, X1 - X0 + 0.6, F1 - ARC, 0.35, { x: (X0 + X1) / 2, y: (ARC + F1) / 2, z: Z1 - 0.1 });
  M.box(mats.bronze, 0.35, F1 - ARC, Z1 - Z0 + 0.6, { x: X1 - 0.1, y: (ARC + F1) / 2, z: (Z0 + Z1) / 2 });
  // arcade floors (honed grey granite) — the ticket hall owns the entrance passage (x -6..6) and the lift lobby (x -6.7..-4.5)
  const arcW = { xMin: X0, xMax: -6.9, zMin: Z1 - DEPTH, zMax: Z1 }, arcE = { xMin: 6.1, xMax: X1, zMin: Z1 - DEPTH, zMax: Z1 }, arcN = { xMin: X1 - DEPTH, xMax: X1, zMin: Z0, zMax: Z1 - DEPTH };
  for (const r of [arcW, arcE, arcN]) { M.rect(mats.granite, r, 0.002); floors.push(collision.addFloor({ ...r, y: 0, sound: 'granite', tag: 'ph:arcade' })); }
  // downlights in the soffit (emissive) + two real lights by the entrance
  const dl = I.set(new THREE.CircleGeometry(0.16, 12).rotateX(Math.PI / 2), mats.lumWarm, { castShadow: false, name: 'ph-downlights' });
  for (let i = 0; i < 20; i++) dl.add(X0 + (i + 0.5) * BAY, ARC - 0.02, Z1 - DEPTH / 2);
  for (let k = 0; k < 12; k++) dl.add(X1 - DEPTH / 2, ARC - 0.02, Z1 - DEPTH - 2 - k * 3.85);
  ctx.lights.point(group, { x: -8, y: ARC - 0.6, z: -5.5, color: 0xfff0d8, intensity: 10, distance: 14 }); ctx.lights.point(group, { x: 8, y: ARC - 0.6, z: -5.5, color: 0xfff0d8, intensity: 10, distance: 14 });

  // ================================================================ shops behind the arcade
  const shopZ = Z1 - DEPTH; const shelves = shelvesTexture(T);
  const shop = (xMin, xMax, fasciaTex, fasciaMat, interiorTint) => {
    M.chunk('ph-shops');
    // interior box (floor, lit ceiling, back wall with shelves) 6 m deep
    const d = 6; M.rect(mats.granite, { xMin, xMax, zMin: shopZ - d, zMax: shopZ }, 0.01);
    M.flat(mats.lumWhite, xMax - xMin, d, { x: (xMin + xMax) / 2, y: 3.4, z: shopZ - d / 2, down: true });
    M.quad(shelves, xMax - xMin, 3.4, { x: (xMin + xMax) / 2, y: 1.7, z: shopZ - d + 0.05, facing: 'south', metric: true });
    for (const x of [xMin, xMax]) M.quad(interiorTint, d, 3.4, { x, y: 1.7, z: shopZ - d / 2, facing: x === xMin ? 'east' : 'west' });
    // glazing, mullions, stallriser, fascia
    M.quad(mats.glass, xMax - xMin, 3.2 - 0.5, { x: (xMin + xMax) / 2, y: 0.5 + (3.2 - 0.5) / 2, z: shopZ, facing: 'south' });
    M.box(mats.phGranite, xMax - xMin, 0.5, 0.25, { x: (xMin + xMax) / 2, y: 0.25, z: shopZ });
    for (let x = xMin; x <= xMax + 0.01; x += 2.4) M.box(mats.bronze, 0.09, 2.7, 0.14, { x, y: 1.85, z: shopZ });
    M.box(mats.bronze, xMax - xMin + 0.2, 0.9, 0.3, { x: (xMin + xMax) / 2, y: 3.65, z: shopZ - 0.05 });
    M.quad(fasciaMat, Math.min(6, xMax - xMin - 1), 0.7, { x: (xMin + xMax) / 2, y: 3.65, z: shopZ + 0.11, facing: 'south' });
    // door (glass with a bronze frame) near the middle
    const dx = (xMin + xMax) / 2 + 3; M.box(mats.bronze, 1.9, 0.08, 0.16, { x: dx, y: 2.3, z: shopZ + 0.02 }); M.box(mats.bronze, 0.08, 2.3, 0.16, { x: dx - 0.95, y: 1.15, z: shopZ + 0.02 }); M.box(mats.bronze, 0.08, 2.3, 0.16, { x: dx + 0.95, y: 1.15, z: shopZ + 0.02 });
    M.box(mats.chrome, 0.04, 0.9, 0.04, { x: dx - 0.3, y: 1.1, z: shopZ + 0.12 });
    blk({ xMin, xMax, yMin: -0.5, yMax: 4.2, zMin: shopZ - 0.2, zMax: shopZ + 0.15 }, 'ph:shopfront');
    void fasciaTex;
  };
  const tescoTex = T.sign({ width: 1024, height: 128, bg: '#ffffff', lines: [{ text: 'TESCO', x: 380, y: 96, size: 88, align: 'center', color: '#00539f', weight: 'bold' }, { text: 'express', x: 720, y: 96, size: 60, align: 'center', color: '#00539f', weight: 'normal' }], fills: [{ color: '#ee1c2e', x: 240, y: 104, w: 280, h: 8 }] });
  const neroTex = T.sign({ width: 1024, height: 128, bg: '#14213d', lines: [{ text: 'CAFFÈ NERO', x: 512, y: 92, size: 74, align: 'center', color: '#ffffff', weight: 'bold' }] });
  shop(-37, -9.6, tescoTex, signMat(ctx, tescoTex, { emissive: 0.5 }), mats.plastic);
  shop(6.2, 37, neroTex, signMat(ctx, neroTex, { emissive: 0.5 }), mats.dark);
  // east colonnade inner wall (glazed screen with a bronze door: the Portcullis House security entrance)
  M.chunk('ph-shops'); const ex = X1 - DEPTH;
  M.quad(mats.glassDark, Z1 - DEPTH - Z0, ARC, { x: ex, y: ARC / 2, z: (Z0 + Z1 - DEPTH) / 2, facing: 'east' }); M.box(mats.bronze, 0.3, 0.6, Z1 - DEPTH - Z0, { x: ex - 0.1, y: 0.3, z: (Z0 + Z1 - DEPTH) / 2 });
  for (let z = Z0 + 1; z < Z1 - DEPTH; z += 2.4) M.box(mats.bronze, 0.16, ARC, 0.1, { x: ex, y: ARC / 2, z });
  M.box(mats.bronze, 0.2, 3.2, 3.2, { x: ex + 0.02, y: 1.6, z: -30 }); M.quad(signMat(ctx, bluePanel(T, ['PORTCULLIS HOUSE', 'Members and pass holders only'], { bg: '#2b2b2b' }), { emissive: 0.4 }), 2.4, 0.6, { x: ex + 0.13, y: 3.7, z: -30, facing: 'east' });
  blk({ xMin: ex - 0.3, xMax: ex + 0.1, yMin: -0.5, yMax: ARC, zMin: Z0, zMax: Z1 - DEPTH }, 'ph:eastScreen');
  // the arcade's inner returns beside the entrance passage (ticket hall walls end at ±6; close the gap to the piers)
  M.box(mats.phStone, 0.9, ARC, 0.5, { x: -6.45, y: ARC / 2, z: Z1 - 0.25 }); M.box(mats.phStone, 0.9, ARC, 0.5, { x: 6.45, y: ARC / 2, z: Z1 - 0.25 });
  blk({ xMin: -6.9, xMax: -6.0, yMin: -0.5, yMax: ARC, zMin: Z1 - 0.5, zMax: Z1 }, 'ph:return'); blk({ xMin: 6.0, xMax: 6.9, yMin: -0.5, yMax: ARC, zMin: Z1 - 0.5, zMax: Z1 }, 'ph:return');
  // the lift lobby / passage flank walls of the ticket hall stop at 3.6 m: fill above them to the arcade soffit
  M.box(mats.concrete, 13.4, ARC - 3.6, DEPTH + 1.6, { x: -0.3, y: (ARC + 3.6) / 2, z: Z1 - DEPTH / 2 - 0.8 });
  // west (Cannon Row) and north (Norman Shaw gap) ground-floor walls: sandstone with service doors
  M.chunk('ph-ground'); M.box(mats.phGranite, 0.6, 1.2, Z1 - Z0, { x: X0 + 0.3, y: 0.6, z: (Z0 + Z1) / 2 }); M.box(mats.phStone, 0.6, ARC - 1.2, Z1 - Z0, { x: X0 + 0.3, y: 1.2 + (ARC - 1.2) / 2, z: (Z0 + Z1) / 2, uvWorld: true });
  M.box(mats.phGranite, X1 - X0, 1.2, 0.6, { x: (X0 + X1) / 2, y: 0.6, z: Z0 + 0.3 }); M.box(mats.phStone, X1 - X0, ARC - 1.2, 0.6, { x: (X0 + X1) / 2, y: 1.2 + (ARC - 1.2) / 2, z: Z0 + 0.3, uvWorld: true });
  for (const z of [-20, -36]) M.box(mats.bronze, 0.1, 3.0, 2.4, { x: X0 - 0.02, y: 1.5, z });
  blk({ xMin: X0 - 0.2, xMax: X0 + 0.6, yMin: -0.5, yMax: TOP, zMin: Z0, zMax: Z1 }, 'ph:west'); blk({ xMin: X0, xMax: X1, yMin: -0.5, yMax: TOP, zMin: Z0 - 0.2, zMax: Z0 + 0.6 }, 'ph:north');

  // ================================================================ the station entrance (Exit 4)
  M.chunk('ph-entrance');
  const EW = S.entranceMain.width;   // 12
  M.box(mats.phStone, EW + 1.8, ARC - 3.6, 0.7, { x: 0, y: (ARC + 3.6) / 2, z: Z1 - 0.35, uvWorld: true });       // lintel / fascia over the passage ceiling
  const fascia = bluePanel(T, ['Westminster station'], { width: 1536, height: 256, roundel: true }); M.box(mats.bronze, 7.4, 1.3, 0.08, { x: 0, y: 4.9, z: Z1 + 0.02 });
  M.quad(signMat(ctx, fascia, { emissive: 0.7 }), 7.2, 1.2, { x: 0, y: 4.9, z: Z1 + 0.065, facing: 'south' });
  const rnd = T.roundel({ text: 'UNDERGROUND' }); const rndMat = signMat(ctx, rnd, { emissive: 0.75, transparent: true });
  for (const x of [-6.8, 6.8]) M.quad(rndMat, 1.25, 1.25, { x, y: 4.3, z: Z1 + 0.02, facing: 'south' });
  // glass canopy on stainless rods
  M.box(mats.glass, EW + 2, 0.05, 3.6, { x: 0, y: 5.75, z: Z1 + 1.8 }); M.box(mats.bronze, EW + 2.1, 0.12, 0.08, { x: 0, y: 5.72, z: Z1 + 3.6 }); M.box(mats.bronze, EW + 2.1, 0.12, 0.08, { x: 0, y: 5.72, z: Z1 + 0.04 });
  for (const x of [-6, -3, 0, 3, 6]) { M.tube(mats.chrome, { x, y: 5.8, z: Z1 + 3.5 }, { x, y: ARC - 0.2, z: Z1 - 0.2 }, 0.025, 6); M.box(mats.bronze, 0.1, 0.08, 3.6, { x, y: 5.7, z: Z1 + 1.8 }); }
  // 'Way in' / exit number and a step-free notice on the return walls
  M.quad(signMat(ctx, bluePanel(T, ['Exit 4', 'Bridge Street'], { width: 1024, height: 384 }), { emissive: 0.6 }), 1.4, 0.55, { x: -6.0 + 0.02, y: 2.6, z: Z1 - 0.25, facing: 'east' });
  M.quad(signMat(ctx, bluePanel(T, ['Step-free access', 'lift to ticket hall'], { width: 1024, height: 384 }), { emissive: 0.6 }), 1.4, 0.55, { x: 6.0 - 0.02, y: 2.6, z: Z1 - 0.25, facing: 'west' });
  // street nameplates on the corner piers
  M.quad(signMat(ctx, nameplate(T, 'BRIDGE STREET'), { emissive: 0.35 }), 1.3, 0.4, { x: -37.7, y: 3.2, z: Z1 + 0.02, facing: 'south' });
  M.quad(signMat(ctx, nameplate(T, 'VICTORIA EMBANKMENT'), { emissive: 0.35 }), 1.3, 0.4, { x: X1 + 0.02, y: 3.2, z: -11.5, facing: 'east' });

  // ================================================================ the roundel totem at the kerb
  { const t = S.totem; M.chunk('ph-entrance'); M.cyl(mats.signGrey, 0.09, 0.11, 3.3, 12, { x: t.x, y: 1.65, z: t.z }); M.cyl(mats.signGrey, 0.22, 0.26, 0.08, 12, { x: t.x, y: 0.04, z: t.z });
    const bar = T.sign({ width: 1024, height: 200, bg: '#0019a8', lines: [{ text: 'UNDERGROUND', x: 512, y: 150, size: 132, align: 'center', color: '#ffffff' }] }); const barMat = signMat(ctx, bar, { emissive: 0.9 });
    const ring = new THREE.TorusGeometry(0.44, 0.1, 10, 40); ring.translate(t.x, 4.0, t.z); M.add(new THREE.MeshStandardMaterial({ color: 0xdc241f, emissive: 0xdc241f, emissiveIntensity: 0.5, roughness: 0.5 }), ring);
    M.box(mats.blue, 1.2, 0.26, 0.24, { x: t.x, y: 4.0, z: t.z }); M.quad(barMat, 1.2, 0.24, { x: t.x, y: 4.0, z: t.z + 0.125, facing: 'south' }); M.quad(barMat, 1.2, 0.24, { x: t.x, y: 4.0, z: t.z - 0.125, facing: 'north' });
    blk({ xMin: t.x - 0.25, xMax: t.x + 0.25, yMin: -0.5, yMax: 3, zMin: t.z - 0.25, zMax: t.z + 0.25 }, 'ph:totem'); }

  // ================================================================ upper storeys: stone piers, bronze ducts, bay windows on all four faces
  const H = TOP - F1;
  const pierSet = I.set(boxUpGeo(1.2, H, 0.9), mats.phStone, { name: 'ph-piers' });
  const ductSet = I.set(boxUpGeo(0.34, H, 0.34), mats.bronze, { name: 'ph-ducts' });
  const winGeo = new THREE.PlaneGeometry(2.0, STOREY_H); scaleUV(winGeo, 2.0, STOREY_H); const winSet = I.set(winGeo, mats.phWindow, { castShadow: false, name: 'ph-windows' });
  const dormerSet = I.set(boxUpGeo(1.4, 2.0, 1.6), mats.bronze, { name: 'ph-dormers' }); const dormerWin = I.set(new THREE.PlaneGeometry(1.1, 1.5).translate(0, 1.1, 0.81), mats.glassDark, { castShadow: false, name: 'ph-dormer-glass' });
  // face(along-axis start, end, fixed coordinate of the building line, outward normal yaw, horizontal?, outward sign):
  // `out` offsets are measured along the outward normal (negative = inside the building line)
  const face = (u0, u1, c, ry, horizontal, sign) => {
    const n = Math.round((u1 - u0) / BAY); const bw = (u1 - u0) / n;
    const place = (set, u, out, y, extra = {}) => { const [x, z] = horizontal ? [u, c + sign * out] : [c + sign * out, u]; set.add(x, y, z, { ry, ...extra }); };
    for (let i = 0; i <= n; i++) place(pierSet, u0 + i * bw, -0.45, F1);
    for (let i = 0; i < n; i++) {
      const ua = u0 + i * bw, ub = ua + bw, um = (ua + ub) / 2;
      place(ductSet, ua + 0.6 + 0.17, -0.27, F1); place(ductSet, ub - 0.6 - 0.17, -0.27, F1);
      for (let s = 0; s < STOREYS; s++) place(winSet, um, -0.48, F1 + (s + 0.5) * STOREY_H);
      place(dormerSet, um, -1.6, TOP + 0.6); place(dormerWin, um, -1.6, TOP + 0.6);
    }
    // the recessed backing wall (bronze) and the cornice
    M.chunk('ph-upper'); const len = u1 - u0; const [bx, bz] = horizontal ? [(u0 + u1) / 2, c - sign * 0.62] : [c - sign * 0.62, (u0 + u1) / 2];
    M.box(mats.bronze, horizontal ? len : 0.3, H, horizontal ? 0.3 : len, { x: bx, y: F1 + H / 2, z: bz });
    const [cx, cz] = horizontal ? [(u0 + u1) / 2, c + sign * 0.1] : [c + sign * 0.1, (u0 + u1) / 2];
    M.box(mats.bronze, horizontal ? len + 1.4 : 0.9, 0.8, horizontal ? 0.9 : len + 1.4, { x: cx, y: TOP - 0.4, z: cz });
  };
  face(X0, X1, Z1, 0, true, 1);                    // south: along x, outward +z
  face(Z0, Z1, X1, Math.PI / 2, false, 1);         // east: along z, outward +x  (ry = +90° turns local +z to +x)
  face(X0, X1, Z0, Math.PI, true, -1);             // north: outward -z
  face(Z0, Z1, X0, -Math.PI / 2, false, -1);       // west: outward -x
  // first-floor slab band (bronze) all round, and the solid corners
  M.chunk('ph-upper'); M.box(mats.bronze, X1 - X0 + 0.4, 1.0, Z1 - Z0 + 0.4, { x: (X0 + X1) / 2, y: F1 - 0.5, z: (Z0 + Z1) / 2 });
  blk({ xMin: X0 - 0.5, xMax: X1 + 0.5, yMin: F1 - 1, yMax: ROOF + 8, zMin: Z0 - 0.5, zMax: Z1 + 0.5 }, 'ph:upper');

  // ================================================================ roof: bronze mansard frustum, ridge platform, chimneys
  M.chunk('ph-roof');
  M.add(mats.bronzeRoof, frustumRoof(X0 - 0.4, X1 + 0.4, Z0 - 0.4, Z1 + 0.4, TOP, ROOF, INSET));
  M.box(mats.chimney, X1 - X0 - 2 * INSET + 0.8, 0.3, Z1 - Z0 - 2 * INSET + 0.8, { x: (X0 + X1) / 2, y: ROOF - 0.15, z: (Z0 + Z1) / 2 });
  M.box(mats.glassDark, X1 - X0 - 2 * INSET - 6, 0.2, Z1 - Z0 - 2 * INSET - 6, { x: (X0 + X1) / 2, y: ROOF - 0.5, z: (Z0 + Z1) / 2 });   // the glazed courtyard roof (barely visible)
  const chim = I.set(chimneyGeometry(), mats.chimney, { name: 'ph-chimneys' });
  const xs = [-30, -15, 0, 15, 30];
  for (const x of xs) { chim.add(x, ROOF - 1.2, Z1 - INSET - 0.2); chim.add(x, ROOF - 1.2, Z0 + INSET + 0.2); }
  for (const z of [-21, -35]) { chim.add(X1 - INSET - 0.2, ROOF - 1.2, z, { ry: Math.PI / 2 }); chim.add(X0 + INSET + 0.2, ROOF - 1.2, z, { ry: Math.PI / 2 }); }

  // ================================================================ Cannon Row gate (west of PH): black railings gate with stone piers and a police cabin
  { const CR = S.cannonRow; M.chunk('ph-ground');
    for (const x of [CR.xMin + 0.35, CR.xMax - 0.35]) M.boxUp(mats.portland, 0.7, 3.2, 0.7, { x, y: 0, z: Z1 - 0.35 });
    const gateBars = I.set(new THREE.BoxGeometry(0.035, 2.4, 0.035), mats.ironBlack, { name: 'cannon-gate' });
    for (let x = CR.xMin + 0.85; x < CR.xMax - 0.7; x += 0.15) gateBars.add(x, 1.2, Z1 - 0.35);
    M.box(mats.ironBlack, CR.xMax - CR.xMin - 1.4, 0.06, 0.06, { x: (CR.xMin + CR.xMax) / 2, y: 2.3, z: Z1 - 0.35 }); M.box(mats.ironBlack, CR.xMax - CR.xMin - 1.4, 0.06, 0.06, { x: (CR.xMin + CR.xMax) / 2, y: 0.25, z: Z1 - 0.35 });
    M.quad(signMat(ctx, nameplate(T, 'CANNON ROW'), { emissive: 0.35 }), 1.0, 0.3, { x: CR.xMin + 0.35, y: 2.6, z: Z1 + 0.02, facing: 'south' });
    M.boxUp(mats.steelGrey, 2.4, 2.7, 2.2, { x: (CR.xMin + CR.xMax) / 2, y: 0, z: Z1 - 4 }); M.quad(mats.glassDark, 2.2, 1.0, { x: (CR.xMin + CR.xMax) / 2, y: 1.6, z: Z1 - 4 + 1.11, facing: 'south' });
    blk({ xMin: CR.xMin, xMax: CR.xMax, yMin: -0.5, yMax: 3.2, zMin: Z1 - 0.7, zMax: Z1 }, 'cannonRow:gate'); }

  M.flush(); I.flush();
  return { floors };

  // ---- helpers
  function boxUpGeo(w, h, d) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return g; }
}

/** Four sloped roof faces from the rectangle (x0..x1, z0..z1) at y0 up to an inset rectangle at y1. */
function frustumRoof(x0, x1, z0, z1, y0, y1, inset) {
  const a = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]; const b = [[x0 + inset, y1, z0 + inset], [x1 - inset, y1, z0 + inset], [x1 - inset, y1, z1 - inset], [x0 + inset, y1, z1 - inset]];
  const pos = [], uv = [];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; const q = [a[i], a[j], b[j], b[i]]; const tri = [q[0], q[1], q[2], q[0], q[2], q[3]]; for (const p of tri) pos.push(...p); uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  // faces wind outward? check the first face normal against the outward direction and flip if needed
  const n = g.attributes.normal; if (n.getZ(0) > 0) { const p = g.attributes.position; for (let i = 0; i < p.count; i += 3) { const x = p.getX(i + 1), y = p.getY(i + 1), z = p.getZ(i + 1); p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)); p.setXYZ(i + 2, x, y, z); } g.computeVertexNormals(); }
  return g;
}
/** One tapering rectangular ventilation stack with a flared louvred head (14 of these on the roof). */
function chimneyGeometry() {
  const shaft = new THREE.BoxGeometry(1.5, 7.5, 2.0); const p = shaft.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setXYZ(i, p.getX(i) * 0.8, p.getY(i), p.getZ(i) * 0.8); shaft.translate(0, 3.75, 0); shaft.computeVertexNormals();
  const head = new THREE.BoxGeometry(1.9, 1.3, 2.5); head.translate(0, 8.0, 0);
  const cap = new THREE.BoxGeometry(2.1, 0.15, 2.7); cap.translate(0, 8.7, 0);
  const g = new THREE.BufferGeometry(); const parts = [shaft, head, cap].map(x => x.toNonIndexed());
  let total = 0; parts.forEach(q => total += q.attributes.position.count); const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3), uv = new Float32Array(total * 2); let o = 0;
  for (const q of parts) { pos.set(q.attributes.position.array, o * 3); nrm.set(q.attributes.normal.array, o * 3); uv.set(q.attributes.uv.array, o * 2); o += q.attributes.position.count; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}
/** Shop interior back wall: shelving with colourful product blocks (no brands). */
function shelvesTexture(T) {
  const w = 1024, h = 512; const c = T.canvas(w, h); const ctx = c.getContext('2d'); ctx.fillStyle = '#e9e7e2'; ctx.fillRect(0, 0, w, h);
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let row = 0; row < 5; row++) { const y = 60 + row * 90; ctx.fillStyle = '#b9b6ae'; ctx.fillRect(0, y + 60, w, 8); for (let x = 8; x < w; x += 22) { const hue = [18, 40, 110, 205, 350, 30][Math.floor(rnd() * 6)]; ctx.fillStyle = `hsl(${hue},${25 + rnd() * 30}%,${35 + rnd() * 25}%)`; ctx.fillRect(x, y + 8 + rnd() * 10, 18, 50 - rnd() * 12); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x + 3, y + 14, 4, 30); } }
  ctx.fillStyle = '#c9c6bf'; ctx.fillRect(0, h - 40, w, 40);
  const t = T.toTexture(c); t.repeat.set(1 / 6, 1 / 3.4); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.25 });
}
void COL; void hex; void FONT;
