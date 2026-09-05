// ---------------------------------------------------------------------------
// districtPlatforms.js — the sub-surface District & Circle line platforms at
// Westminster (rebuilt 1999 under the Jubilee works; dossier §7).
//
// Two SIDE platforms on a diagonal alignment just below the concourse:
//   Platform 1 (westbound, t 3.7..8.7, the SOUTH-EAST / Bridge Street side)
//   Platform 2 (eastbound, t -8.7..-3.7, north-west side)
// Everything is built in the District local frame (s along the line towards
// the north-east, t across towards the south-east) inside one group rotated by
// layout.DC_YAW: LOCAL x = -t, LOCAL z = s, y = world y. Collision entries are
// converted to world space with dcToWorld. Floors are registered as zero-slope
// ramps (exact rotated rectangles); walls as chains of world AABBs.
//
// Registers: 'indicator:1', 'indicator:2' (via platformFurniture), 'speakers:district',
// 'nav:district', 'spawn:district', 'district'.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { LEVELS, DISTRICT, JUBILEE, ESCALATORS, TRACKS, PALETTE, dcToWorld, worldToDc, DC_YAW } from '../core/layout.js';
import { Track, buildTrackMesh } from '../core/track.js';
import { STOCK_S7, doorPositions } from '../entities/trainSpec.js';
import * as PF from '../entities/platformFurniture.js';
import { Merger, signs as makeSigns, mat4, instanced, makeStair, makeLift, makeSignal, makeBenches, makeHelpPoints, makeFirePoints, makeCCTV, makeSpeakers, wallBlockers } from './districtFurniture.js';

export function build(ctx) {
  const { M, T, collision, audio } = ctx;
  const Y = LEVELS.dcPlatform, RAIL = LEVELS.dcRail, BED = RAIL - 0.2, CEIL = LEVELS.dcCeiling, SLAB = CEIL + 0.8, CONC = LEVELS.concourse;
  const S0 = DISTRICT.sMin, S1 = DISTRICT.sMax, BOX0 = DISTRICT.box.sMin, BOX1 = DISTRICT.box.sMax, TB = DISTRICT.box.tMax;
  const TUN = 40;                       // metres of 1868 brick tunnel modelled beyond each headwall (the track curves away after that)
  const HALF_TUN = 4.1, SPRING = RAIL + 2.6, ARCH_RISE = 1.8;

  // ---- frame & helpers ------------------------------------------------------------------------
  const group = new THREE.Group(); group.name = 'districtPlatforms';
  const dc = new THREE.Group(); dc.name = 'dcFrame';
  dc.position.set(DISTRICT.frame.origin.x, 0, DISTRICT.frame.origin.z); dc.rotation.y = DC_YAW; group.add(dc); dc.updateWorldMatrix(true, false);
  const P = (s, t, y = Y) => new THREE.Vector3(-t, y, s);                                        // (s,t) → local
  const toW = v => { const w = dcToWorld(v.z, -v.x); v.x = w.x; v.z = w.z; return v; };         // local → world (mutating)
  const W = (s, t, y = Y) => toW(P(s, t, y));
  const merger = new Merger(dc);
  const batch = PF.createBatcher();
  const S = makeSigns(T);
  const R = (sMin, sMax, tMin, tMax) => ({ sMin: Math.min(sMin, sMax), sMax: Math.max(sMin, sMax), tMin: Math.min(tMin, tMax), tMax: Math.max(tMin, tMax) });
  const overlaps = (a, b) => !(b.sMax <= a.sMin || b.sMin >= a.sMax || b.tMax <= a.tMin || b.tMin >= a.tMax);
  function subtract(rects, h) {
    const out = [];
    for (const r of rects) {
      if (!overlaps(r, h)) { out.push(r); continue; }
      if (h.sMin > r.sMin) out.push(R(r.sMin, h.sMin, r.tMin, r.tMax));
      if (h.sMax < r.sMax) out.push(R(h.sMax, r.sMax, r.tMin, r.tMax));
      const s0 = Math.max(r.sMin, h.sMin), s1 = Math.min(r.sMax, h.sMax);
      if (h.tMin > r.tMin) out.push(R(s0, s1, r.tMin, h.tMin));
      if (h.tMax < r.tMax) out.push(R(s0, s1, h.tMax, r.tMax));
    }
    return out;
  }
  const cut = (rect, holes) => { let rs = [rect]; for (const h of holes) rs = subtract(rs, h); return rs.filter(r => r.sMax - r.sMin > 0.02 && r.tMax - r.tMin > 0.02); };
  /** Flat walkable rect (s/t) registered as a zero-slope ramp = exact rotated rectangle. */
  function flat(r, y, tag, sound = 'hard') { const tc = (r.tMin + r.tMax) / 2; collision.addRamp(W(r.sMin, tc, y), W(r.sMax, tc, y), r.tMax - r.tMin, { tag, sound }); }
  /** Solid (s/t/y) box as chained world AABB blockers. */
  function solid(r, yMin, yMax, tag, step = 0.6) { wallBlockers(collision, toW, -r.tMax, -r.tMin, yMin, yMax, r.sMin, r.sMax, tag, step); }
  const screenMats = new Map(); const screenMat = tex => { if (!screenMats.has(tex)) screenMats.set(tex, M.screen(tex, 1.1)); return screenMats.get(tex); };
  const signMat = (tex, o = {}) => PF.signMaterial(ctx, tex, o);

  // ---- materials ------------------------------------------------------------------------------
  const brickTex = T.ashlar({ color: 0x8a6a5a, dark: 0x3d302a, courseH: 0.075, blockW: 0.23, weathering: 0.7, seed: 61, metres: 3 });
  const brick = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, normalScale: new THREE.Vector2(0.5, 0.5), side: THREE.DoubleSide });
  for (const k of ['map', 'normalMap']) if (brickTex[k]) { const t = brickTex[k].clone(); t.repeat.set(1 / brickTex.metres, 1 / brickTex.metres); t.needsUpdate = true; brick[k] = t; }
  brick.userData.metres = brickTex.metres; brick.name = 'brick1868';
  const perfTex = T.perforated({ color: 0xb4b7ba, pitch: 12, hole: 4 });
  const perfGrey = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.2 }); { const t = perfTex.map.clone(); t.repeat.set(1 / perfTex.metres, 1 / perfTex.metres); t.needsUpdate = true; perfGrey.map = t; perfGrey.userData.metres = perfTex.metres; }
  const mat = {
    floor: PF.terrazzoMaterial(ctx, { base: PALETTE.dcFloor, seed: 11, joints: 0.5 }),
    coping: M.precast({ base: 0xbfbcb5 }),
    nosing: M.paint(0x2c2c2a, { roughness: 0.85, metalness: 0 }),
    tactile: PF.tactileMaterial(ctx),
    yellow: PF.wornYellowMaterial(ctx, { color: 0xf2c500, wear: 0.5 }),
    wall: M.concrete({ base: PALETTE.precast, dark: 0x77756f, seed: 21, stain: 0.25, boardMarks: false, tieHoles: true }),
    beam: M.concrete({ base: PALETTE.concrete, seed: 7 }),
    soffit: M.concrete({ base: 0x8f8d88, seed: 9, boardMarks: false, tieHoles: false, stain: 0.3 }),
    face: M.precast({ base: 0x9a9893 }),
    slab: (() => { const m = M.concrete({ base: 0x3d3a37, dark: 0x1f1d1b, seed: 5, boardMarks: false, tieHoles: false, stain: 0.5 }); m.side = THREE.DoubleSide; return m; })(),
    trough: M.precast({ base: 0x6f6d69 }),
    brick,
    grey: M.paint(PALETTE.steelGrey, { roughness: 0.55, metalness: 0.45 }),
    clad: M.paint(0xc3c6c8, { roughness: 0.45, metalness: 0.35 }),
    enamel: M.paint(0xd3d6d6, { roughness: 0.4, metalness: 0.3 }),
    mosaic: M.paint(PALETTE.blueMosaic, { roughness: 0.35, metalness: 0.1 }),
    stainless: M.stainless(),
    perf: M.perforated(),
    perfGrey,
    dark: M.paint(0x1c1c1c, { roughness: 0.6, metalness: 0.3 }),
    black: M.matte(0x030303),
    signBox: M.paint(0x0c1c6e, { roughness: 0.5, metalness: 0.2 }),
    lum: M.luminaire(0xf6f3ea, 2.2),
    lumStrip: M.luminaire(0xfff1dc, 1.6),
    rail: M.paint(0x4d4744, { roughness: 0.7, metalness: 0.6 }),
    joint: M.paint(0x3a3a38, { roughness: 0.9, metalness: 0 }),
    skirt: M.paint(0x74726d, { roughness: 1, metalness: 0 }),
    cable: M.paint(0x6f7375, { roughness: 0.6, metalness: 0.5 }),
    insulator: M.paint(0xb9b4a6, { roughness: 0.7, metalness: 0 }),
    grime: (() => { const m = new THREE.MeshStandardMaterial({ color: 0x1a1814, transparent: true, opacity: 0.09, roughness: 1, depthWrite: false }); m.name = 'grime'; return m; })(),
    yellowCap: M.paint(0xf2c500, { roughness: 0.6, metalness: 0 }),
    cabinet: M.paint(0x8e9194, { roughness: 0.5, metalness: 0.4 }),
    glass: M.glass({ color: 0x1a1c20, opacity: 0.22, roughness: 0.05 }),
  };

  // ---- platform descriptors -------------------------------------------------------------------
  // inX = local-x direction from the back wall towards the platform edge; face = yaw of a wall item facing the track
  const plats = [1, 2].map(n => {
    const p = DISTRICT.platforms[n]; const sgn = p.edgeT > 0 ? 1 : -1; const tBack = sgn > 0 ? p.tMax : p.tMin;
    return { n, p, sgn, tEdge: p.edgeT, tBack, xEdge: -p.edgeT, xBack: -tBack, inX: sgn > 0 ? 1 : -1, face: sgn * Math.PI / 2, dir: p.direction, trackT: DISTRICT.tracks[p.direction].t, dirName: n === 1 ? 'Westbound' : 'Eastbound' };
  });
  const [p1, p2] = plats;
  const wide = p1.p.wideWestEnd, rec = p2.p.recesses;
  const st1 = DISTRICT.stairs.find(s => s.platform === 1), st2 = DISTRICT.stairs.find(s => s.platform === 2);
  const stairBox = st => R(st.sTop - 0.3, st.sBottom, st.tMin - 0.3, st.tMax + 0.3);     // enclosure footprint incl. walls
  const stairInnerT = st => (st.tMin > 0 ? st.tMin - 0.3 : st.tMax + 0.3);               // platform-side wall face of a stair enclosure

  /** Escalator well: where the platform floor is open over the top of a bank (until the steps clear the slab by 2.1 m). */
  function wellFor(name) {
    const e = ESCALATORS.find(x => x.name === name); if (!e) return null;
    const top = worldToDc(e.top.x, e.top.z), bot = worldToDc(e.bottom.x, e.bottom.z);
    const dirS = Math.sign(bot.s - top.s) || -1; const rise = e.top.y - e.bottom.y, plan = Math.hypot(bot.s - top.s, bot.t - top.t);
    const open = Math.min(plan, 2.4 / (rise / plan) + 0.4);
    const lanesT = [...(e.lanes || [0]), ...(e.stair && e.stairLane != null ? [e.stairLane] : [])].map(l => top.t + l * dirS);   // fixed stair alongside shares the pit
    return { name, top, dirS, rect: R(top.s, top.s + dirS * open, Math.min(...lanesT) - 0.65, Math.max(...lanesT) + 0.65), lanesT, e };
  }
  const wellC = wellFor('c'), wellD = wellFor('d');
  const liftDef = n => DISTRICT.lifts.find(l => l.platform === n) || { platform: n, s: -33, t: n === 1 ? 11 : -11 };
  const lift1 = liftDef(1), lift2 = liftDef(2);
  const shaft1 = R(lift1.s - 1.3, lift1.s + 1.3, lift1.t - 1.25, lift1.t + 1.25);         // free-standing shaft on the wide west end
  const alcove2 = R(lift2.s - 1.0, lift2.s + 1.0, -9.9, p2.tBack);                          // door alcove in P2's back wall
  const stairFill1 = R(st1.sTop - 0.3, st1.sBottom + 0.3, st1.tMax + 0.15, wide.tMax);     // solid between the P1 stair and the wide end's back wall
  // the deep Jubilee lift (JUBILEE.deepLift) is modelled by the box module; its D&C-level lobby is in the SW corner of the wide west end
  const deepDc = worldToDc(JUBILEE.deepLift.x, JUBILEE.deepLift.z);
  const deepInWide = deepDc.s > wide.sMin && deepDc.s < wide.sMax && deepDc.t > p1.tBack && deepDc.t < wide.tMax;
  const deepLift = deepInWide ? { s: deepDc.s, t: deepDc.t, faceS: 1 } : { s: wide.sMin, t: 11, faceS: 1 };
  if (!deepInWide) console.warn('[districtPlatforms] JUBILEE.deepLift lands at D&C (s,t) = (' + deepDc.s.toFixed(1) + ',' + deepDc.t.toFixed(1) + ') which is not in Platform 1\'s wide west end; lobby built at s=' + wide.sMin + ', t=11 instead (see coreChangesNeeded).');

  // ---- floors (visual + collision) --------------------------------------------------------------
  const floorRects = { 1: [], 2: [] };
  floorRects[1].push(R(S0, S1, p1.tEdge, p1.tBack));
  floorRects[1].push(...cut(R(wide.sMin, wide.sMax, p1.tBack, wide.tMax), [wellD.rect, stairBox(st1), shaft1, stairFill1]));
  floorRects[2].push(R(S0, S1, p2.tBack, p2.tEdge));
  floorRects[2].push(...cut(R(rec[0].sMin, rec[0].sMax, rec[0].tMin, p2.tBack), [stairBox(st2)]));
  floorRects[2].push(...cut(R(rec[1].sMin, rec[1].sMax, rec[1].tMin, p2.tBack), [wellC.rect]));
  floorRects[2].push(alcove2);
  for (const pl of plats) for (const r of floorRects[pl.n]) {
    merger.floor(mat.floor, r.tMax - r.tMin, r.sMax - r.sMin, { x: -(r.tMin + r.tMax) / 2, y: Y, z: (r.sMin + r.sMax) / 2 }, T);
    flat(r, Y, 'dcPlatform' + pl.n);
  }
  // platform faces towards the track (from the track bed up to the coping) + coping / nosing / tactile / yellow line
  const LEN = S1 - S0;
  for (const pl of plats) {
    const { xEdge, inX } = pl;
    merger.box(mat.face, 0.25, Y - BED, LEN, { x: xEdge - inX * 0.125, y: (Y + BED) / 2, z: 0 }, T);
    merger.floor(mat.coping, 0.65, LEN, { x: xEdge - inX * 0.325, y: Y + 0.003, z: 0 }, T);
    merger.box(mat.nosing, 0.06, 0.012, LEN, { x: xEdge - inX * 0.03, y: Y + 0.006, z: 0 });
    merger.floor(mat.tactile, 0.4, LEN, { x: xEdge - inX * 0.3, y: Y + 0.006, z: 0 }, T);
    merger.floor(mat.yellow, 0.1, LEN, { x: xEdge - inX * 0.65, y: Y + 0.007, z: 0 }, T);
    // cable trough at track level against the platform face, and a drainage channel down the middle of the track bed
    merger.box(mat.trough, 0.25, 0.25, LEN + 10, { x: xEdge + inX * 0.125, y: BED + 0.125, z: 0 }, T);
    // platform face blocker: keeps a player on the track bed from walking into the face (top just below the platform surface)
    solid(R(S0 - 0.5, S1 + 0.5, Math.min(pl.tEdge, pl.tEdge + pl.sgn * 0.3), Math.max(pl.tEdge, pl.tEdge + pl.sgn * 0.3)), BED - 0.1, Y - 0.06, 'dcPlatformFace' + pl.n);
  }
  // 'MIND THE GAP' opposite every door position, and the level-boarding hump over the MS car (dossier §7.2)
  const doors = doorPositions(STOCK_S7);
  const mtg = signMat(S.mindTheGap(), { emissive: 0.25, transparent: true }); mtg.polygonOffset = true; mtg.polygonOffsetFactor = -2; mtg.polygonOffsetUnits = -2;
  const wheel = signMat(S.wheelchair(), { emissive: 0.3 }); wheel.polygonOffset = true; wheel.polygonOffsetFactor = -2; wheel.polygonOffsetUnits = -2;
  for (const pl of plats) {
    const travel = pl.dir === 'eastbound' ? 1 : -1; const ry = -pl.inX * Math.PI / 2;
    for (const d of doors) merger.floor(mtg, 1.5, 0.235, { x: pl.xEdge - pl.inX * 0.3, y: Y + 0.009, z: travel * d.s, ry });
    const ms = doors.filter(d => d.car === (STOCK_S7.wheelchairCars || [3])[0]).map(d => travel * d.s);
    const h0 = Math.min(...ms) - 1.8, h1 = Math.max(...ms) + 1.8; const humpH = STOCK_S7.floorHeight - (Y - RAIL);   // ≈ 75 mm
    if (humpH > 0.02) {
      const hw = 3.0; const xc = pl.xEdge - pl.inX * hw / 2;
      merger.box(mat.floor, hw, humpH, h1 - h0 - 2 * 1.2, { x: xc, y: Y + humpH / 2, z: (h0 + h1) / 2 }, T);
      for (const [z0, sgn] of [[h0, 1], [h1, -1]]) { const len = Math.hypot(1.2, humpH); merger.box(mat.floor, hw, 0.02, len, { x: xc, y: Y + humpH / 2 - 0.01, z: z0 + sgn * 0.6, rx: -sgn * Math.atan2(humpH, 1.2) }, T); }
      const rampT = Math.hypot(0.9, humpH); merger.box(mat.floor, rampT, 0.02, h1 - h0 - 2.4, { x: pl.xEdge - pl.inX * (hw + 0.45), y: Y + humpH / 2 - 0.01, z: (h0 + h1) / 2, rz: pl.inX * Math.atan2(humpH, 0.9) }, T);
      merger.box(mat.nosing, 0.06, 0.012, h1 - h0, { x: pl.xEdge - pl.inX * 0.03, y: Y + humpH + 0.006, z: (h0 + h1) / 2 });
      merger.floor(mat.tactile, 0.4, h1 - h0, { x: pl.xEdge - pl.inX * 0.3, y: Y + humpH + 0.006, z: (h0 + h1) / 2 }, T);
      merger.floor(mat.yellow, 0.1, h1 - h0 - 2.4, { x: pl.xEdge - pl.inX * 0.65, y: Y + humpH + 0.007, z: (h0 + h1) / 2 }, T);
      for (const z of [ms[0], ms[ms.length - 1]]) merger.floor(wheel, 0.5, 0.5, { x: pl.xEdge - pl.inX * 1.3, y: Y + humpH + 0.008, z, ry });
      for (const d of doors) if (travel * d.s > h0 && travel * d.s < h1) merger.floor(mtg, 1.5, 0.235, { x: pl.xEdge - pl.inX * 0.3, y: Y + humpH + 0.009, z: travel * d.s, ry });
      collision.addRamp(W(h0, pl.tEdge + pl.sgn * hw / 2, Y), W(h0 + 1.2, pl.tEdge + pl.sgn * hw / 2, Y + humpH), hw, { tag: 'hump' });
      collision.addRamp(W(h1 - 1.2, pl.tEdge + pl.sgn * hw / 2, Y + humpH), W(h1, pl.tEdge + pl.sgn * hw / 2, Y), hw, { tag: 'hump' });
      flat(R(h0 + 1.2, h1 - 1.2, pl.tEdge, pl.tEdge + pl.sgn * hw), Y + humpH, 'hump');
    }
  }
  // expansion joints, floor drains, wall-base grime skirting
  for (const pl of plats) {
    const w = Math.abs(pl.tBack - pl.tEdge); const xc = (pl.xBack + pl.xEdge) / 2;
    for (let s = -60; s <= 60; s += 20) merger.box(mat.joint, w - 0.7, 0.004, 0.02, { x: xc - pl.inX * 0.35 + pl.inX * 0.35, y: Y + 0.004, z: s });
    for (let s = -50; s <= 60; s += 20) merger.box(mat.dark, 0.3, 0.006, 0.3, { x: pl.xBack + pl.inX * 0.55, y: Y + 0.004, z: s });
  }

  // ---- walls ------------------------------------------------------------------------------------
  /** Back wall segment: face at t = tFace, 1 m thick behind it (towards `away` = -inX), from Y to SLAB; s range. */
  function backWall(pl, sMin, sMax, tFace = pl.tBack, thick = 1.0, yTop = SLAB, tag = 'dcBackWall') {
    const x = -tFace; const len = sMax - sMin; if (len <= 0.01) return;
    merger.box(mat.wall, thick, yTop - Y - 0.02, len, { x: x - pl.inX * thick / 2, y: (Y + yTop - 0.02) / 2, z: (sMin + sMax) / 2 }, T);
    merger.box(mat.skirt, 0.012, 0.16, len, { x: x + pl.inX * 0.006, y: Y + 0.08, z: (sMin + sMax) / 2 });
    solid(R(sMin, sMax, tFace, tFace - pl.sgn * thick), Y - 0.5, yTop, tag);
  }
  /** Return wall across the platform direction at s = sAt, between tA and tB (faces ±s). */
  function crossWall(sAt, tA, tB, { thick = 0.3, yTop = SLAB, yBot = Y, tag = 'dcCrossWall' } = {}) {
    const tMin = Math.min(tA, tB), tMax = Math.max(tA, tB);
    merger.box(mat.wall, tMax - tMin, yTop - yBot - 0.02, thick, { x: -(tMin + tMax) / 2, y: (yBot + yTop - 0.02) / 2, z: sAt }, T);
    solid(R(sAt - thick / 2, sAt + thick / 2, tMin, tMax), yBot - 0.5, yTop, tag);
  }
  // Platform 1: back wall at 8.7 except across the wide west end, whose back wall is at t = 14 with returns
  backWall(p1, S0 - 5, wide.sMin); backWall(p1, wide.sMax, BOX1);
  backWall(p1, wide.sMin, st1.sTop - 0.3, wide.tMax); backWall(p1, st1.sBottom + 0.3, wide.sMax, wide.tMax);
  crossWall(wide.sMin - 0.15, p1.tBack, wide.tMax); crossWall(wide.sMax + 0.15, p1.tBack, wide.tMax);
  merger.box(mat.wall, wide.tMax - stairFill1.tMin, SLAB - Y - 0.02, stairFill1.sMax - stairFill1.sMin, { x: -(stairFill1.tMin + stairFill1.tMax) / 2, y: (Y + SLAB) / 2, z: (stairFill1.sMin + stairFill1.sMax) / 2 }, T);
  solid(stairFill1, Y, SLAB, 'dcStairFill');
  // Platform 2: back wall at -8.7 with the two recesses (back walls at -12), the lift alcove and the stair enclosure
  backWall(p2, S0 - 5, rec[0].sMin); backWall(p2, alcove2.sMax, rec[1].sMin); backWall(p2, rec[1].sMax, BOX1);
  backWall(p2, st2.sBottom + 0.3, rec[0].sMax, rec[0].tMin, 0.6);                 // recess 1 back wall (the stair enclosure covers the rest)
  backWall(p2, rec[1].sMin, rec[1].sMax, rec[1].tMin, 0.6);                        // recess 2 back wall
  crossWall(rec[0].sMin - 0.15, p2.tBack, stairInnerT(st2), { thick: 0.3 });     // stub beside the stair enclosure
  crossWall(rec[0].sMax + 0.15, p2.tBack, rec[0].tMin);                            // recess 1 east return (also the lift alcove's west jamb)
  crossWall(alcove2.sMax + 0.15, p2.tBack, alcove2.tMin);                          // alcove east jamb
  merger.box(mat.wall, 2.0, SLAB - Y - 0.02, alcove2.sMax - alcove2.sMin + 0.3, { x: -(alcove2.tMin - 1.0), y: (Y + SLAB) / 2, z: (alcove2.sMin + alcove2.sMax + 0.3) / 2 }, T);   // shaft mass behind the alcove (flush with the recess return wall)
  crossWall(rec[1].sMin - 0.15, p2.tBack, rec[1].tMin); crossWall(rec[1].sMax + 0.15, p2.tBack, rec[1].tMin);
  // box side walls beyond the platforms (s 65..70) at t = ±8.7 continue in backWall above; the wide/recess back walls are 0.6–1 m thick

  // ---- the concourse floor slab: downstand beams across the platforms, slab soffit, perforated infill ------------------
  const holesCeil = [stairBox(st1), stairBox(st2), shaft1];
  const beamS = []; for (let s = -67.5; s <= 67.5; s += 4.5) beamS.push(s);
  for (const sb of beamS) {
    const tMin = (sb > st2.sTop - 1 && sb < rec[1].sMax) ? rec[0].tMin - 0.5 : -TB; const tMax = (sb > wide.sMin - 0.5 && sb < wide.sMax + 0.5) ? wide.tMax : TB;
    for (const r of cut(R(sb - 0.3, sb + 0.3, tMin, tMax), holesCeil)) merger.box(mat.beam, r.tMax - r.tMin, SLAB - CEIL, 0.6, { x: -(r.tMin + r.tMax) / 2, y: (CEIL + SLAB) / 2, z: sb }, T);
  }
  const soffitRects = [R(BOX0, BOX1, -TB, TB), R(wide.sMin, wide.sMax, TB, wide.tMax), R(st2.sTop - 1, rec[1].sMax, rec[0].tMin - 0.5, -TB)];
  for (const sr of soffitRects) for (const r of cut(sr, holesCeil)) merger.floor(mat.soffit, r.tMax - r.tMin, r.sMax - r.sMin, { x: -(r.tMin + r.tMax) / 2, y: SLAB, z: (r.sMin + r.sMax) / 2, flip: true }, T);
  // grey perforated-metal infill in every third bay over each platform, with a slim grey trim
  for (let i = 1; i < beamS.length - 1; i += 3) {
    const s0 = beamS[i] + 0.3, s1 = beamS[i + 1] - 0.3;
    for (const pl of plats) {
      const t0 = pl.tEdge + pl.sgn * 0.5, t1 = pl.tBack - pl.sgn * 0.3; const tMin = Math.min(t0, t1), tMax = Math.max(t0, t1);
      merger.floor(mat.perf, tMax - tMin, s1 - s0, { x: -(tMin + tMax) / 2, y: CEIL + 0.3, z: (s0 + s1) / 2, flip: true }, T);
      for (const tt of [tMin, tMax]) merger.box(mat.grey, 0.06, 0.06, s1 - s0, { x: -tt, y: CEIL + 0.3, z: (s0 + s1) / 2 });
    }
  }
  // canopy eave along the track side with its continuous luminaire strip; cable tray along each back wall
  for (const pl of plats) {
    merger.box(mat.grey, 0.4, 0.35, LEN + 4, { x: pl.xEdge - pl.inX * 0.2, y: CEIL - 0.175, z: 0 });
    merger.box(mat.lumStrip, 0.1, 0.025, LEN + 4, { x: pl.xEdge - pl.inX * 0.2, y: CEIL - 0.36, z: 0 });
    merger.box(mat.cable, 0.3, 0.08, LEN + 4, { x: pl.xBack + pl.inX * 0.2, y: CEIL - 0.15, z: 0 });
    for (let s = -60; s <= 60; s += 15) merger.box(mat.cable, 0.04, CEIL - 0.15 - (Y + 1.5), 0.04, { x: pl.xBack + pl.inX * 0.03, y: (CEIL - 0.15 + Y + 1.5) / 2, z: s + 0.9 });
  }

  // ---- columns & piers ------------------------------------------------------------------------------
  const colList = []; const cx = JUBILEE.columns.x;
  for (let i = 0; i < cx.length; i++) { colList.push({ x: cx[i], r: JUBILEE.columns.diameter / 2 }); if (i < cx.length - 1) colList.push({ x: (cx[i] + cx[i + 1]) / 2, r: JUBILEE.columns.secondaryDiameter / 2 }); }
  const columns = [];
  for (const c of colList) {
    const d = worldToDc(c.x, JUBILEE.columns.z);
    for (const pl of plats) {
      const edgeClear = pl.sgn * (d.t - pl.tEdge), backClear = pl.sgn * (pl.tBack - d.t);
      if (d.s > S0 + 2 && d.s < S1 - 2 && edgeClear >= c.r + 0.9 && backClear >= c.r - 0.35) columns.push({ s: d.s, t: d.t, r: c.r, pl });
    }
  }
  for (const c of columns) {
    merger.cylinder(mat.clad, c.r, Y, SLAB, -c.t, c.s, 36);
    merger.cylinder(mat.mosaic, c.r + 0.008, Y + 1.1, Y + 1.4, -c.t, c.s, 36);
    merger.cylinder(mat.dark, c.r + 0.02, Y, Y + 0.12, -c.t, c.s, 36);
    solid(R(c.s - c.r * 0.9, c.s + c.r * 0.9, c.t - c.r * 0.9, c.t + c.r * 0.9), Y, SLAB, 'dcColumn', 0.5);
  }
  // square fair-faced piers (0.9 m) proud of the back walls where nothing else wants the wall
  const wallItems = { 1: [], 2: [] };    // s ranges taken on each back wall
  const claim = (pl, s, half) => { for (const [a, b] of wallItems[pl.n]) if (s + half > a && s - half < b) return false; wallItems[pl.n].push([s - half, s + half]); return true; };
  /** Which wall face a wall item at s sees on this platform (t of the face), or null where there is an opening. */
  function backT(pl, s) {
    if (pl.n === 1) { if (s >= st1.sTop - 0.3 && s <= st1.sBottom) return stairInnerT(st1); if (s > wide.sMin && s < wide.sMax) return wide.tMax; return pl.tBack; }
    if (s >= st2.sTop - 0.3 && s <= st2.sBottom) return stairInnerT(st2);
    if (s > alcove2.sMin - 0.2 && s < alcove2.sMax + 0.2) return null;
    for (const rc of rec) if (s > rc.sMin && s < rc.sMax) return rc.tMin;
    return pl.tBack;
  }
  const isPlainWall = (pl, s) => backT(pl, s) === pl.tBack;
  for (const st of DISTRICT.stairs) { const pl = st.platform === 1 ? p1 : p2; claim(pl, st.sBottom - 3.2, 0.5); claim(pl, st.sBottom - 2.2, 0.35); claim(pl, st.sBottom - 1.0, 0.4); }

  // ---- stairs from the concourse (28 steps in two flights, along the platform) -------------------------------------
  const stairs = {};
  for (const st of DISTRICT.stairs) {
    try {
      stairs[st.platform] = makeStair(ctx, dc, merger, { zTop: st.sTop, zBottom: st.sBottom, yTop: CONC, yBottom: Y, xMin: -st.tMax, xMax: -st.tMin, steps: 28, landingLen: 1.5, yWallTop: CONC, toWorld: toW, tag: 'dcStair' + st.platform, wallMat: mat.wall }, S);
      // concourse-level guarding around the stairwell (three sides; the head is open towards -s)
      const tIn = Math.min(st.tMin, st.tMax) - 0.3, tOut = Math.max(st.tMin, st.tMax) + 0.3;
      for (const tt of [tIn + 0.15, tOut - 0.15]) { merger.box(mat.clad, 0.12, 1.1, st.sBottom - st.sTop + 0.9, { x: -tt, y: CONC + 0.55, z: (st.sTop + st.sBottom) / 2 + 0.15 }); merger.box(mat.mosaic, 0.13, 0.12, st.sBottom - st.sTop + 0.9, { x: -tt, y: CONC + 0.9, z: (st.sTop + st.sBottom) / 2 + 0.15 }); merger.tube(mat.stainless, P(st.sTop - 0.3, tt, CONC + 1.12), P(st.sBottom + 0.6, tt, CONC + 1.12), 0.024, 10); solid(R(st.sTop - 0.3, st.sBottom + 0.6, tt - 0.06, tt + 0.06), CONC, CONC + 1.2, 'dcStairGuard'); }
      merger.box(mat.clad, tOut - tIn, 1.1, 0.12, { x: -(tIn + tOut) / 2, y: CONC + 0.55, z: st.sBottom + 0.6 }); merger.tube(mat.stainless, P(st.sBottom + 0.6, tIn, CONC + 1.12), P(st.sBottom + 0.6, tOut, CONC + 1.12), 0.024, 10);
      solid(R(st.sBottom + 0.54, st.sBottom + 0.66, tIn, tOut), CONC, CONC + 1.2, 'dcStairGuard');
    } catch (e) { console.warn('[districtPlatforms] stair failed', e); }
  }

  // ---- lifts (non-functional, doors closed) ------------------------------------------------------------------------
  try {
    // Platform 2: door in an alcove off the back wall between the two recesses, facing the platform (+t = local -x)
    makeLift(ctx, merger, { x: -alcove2.tMin, y: Y, z: lift2.s, ry: -Math.PI / 2, sign: S.lift('to ticket hall'), signMat: signMat(S.lift('to ticket hall')), portalW: alcove2.sMax - alcove2.sMin - 0.1 });
    solid(R(alcove2.sMin, alcove2.sMax, alcove2.tMin - 0.2, alcove2.tMin + 0.06), Y, Y + 2.6, 'dcLift2');
    // Platform 1: free-standing shaft on the wide west end, door facing the platform (-t = local +x)
    merger.box(mat.wall, shaft1.tMax - shaft1.tMin, SLAB - Y, shaft1.sMax - shaft1.sMin, { x: -(shaft1.tMin + shaft1.tMax) / 2, y: (Y + SLAB) / 2, z: (shaft1.sMin + shaft1.sMax) / 2 }, T);
    merger.box(mat.mosaic, shaft1.tMax - shaft1.tMin + 0.012, 0.3, shaft1.sMax - shaft1.sMin + 0.012, { x: -(shaft1.tMin + shaft1.tMax) / 2, y: Y + 1.25, z: (shaft1.sMin + shaft1.sMax) / 2 });
    makeLift(ctx, merger, { x: -shaft1.tMin, y: Y, z: lift1.s, ry: Math.PI / 2, sign: S.lift('to ticket hall'), signMat: signMat(S.lift('to ticket hall')) });
    solid(shaft1, Y, SLAB, 'dcLift1');
    // the deep Jubilee lift (DC / JE / JW) in its 3 × 3 m lobby: glass-panelled doors in the wide end's west wall
    makeLift(ctx, merger, { x: -deepLift.t, y: Y, z: deepLift.s + 0.15, ry: 0, sign: S.deepLift(), signMat: signMat(S.deepLift()), deep: true, portalW: 2.4 });
  } catch (e) { console.warn('[districtPlatforms] lifts failed', e); }

  // ---- escalator wells (banks c and d are built by the box module; we leave the openings and guard their far ends) ---
  for (const well of [wellC, wellD]) {
    const r = well.rect; const sEnd = well.dirS < 0 ? r.sMin : r.sMax; const sg = well.dirS < 0 ? -1 : 1;
    // solid upstand across the far end of the well + a stainless rail, mosaic stripe; short returns along the sides beyond the balustrades
    const wEnd = R(sEnd + sg * 0.05, sEnd + sg * 0.25, r.tMin - 0.2, r.tMax + 0.2);
    merger.box(mat.clad, wEnd.tMax - wEnd.tMin, 1.1, 0.2, { x: -(wEnd.tMin + wEnd.tMax) / 2, y: Y + 0.55, z: (wEnd.sMin + wEnd.sMax) / 2 });
    merger.box(mat.mosaic, wEnd.tMax - wEnd.tMin + 0.01, 0.12, 0.21, { x: -(wEnd.tMin + wEnd.tMax) / 2, y: Y + 0.9, z: (wEnd.sMin + wEnd.sMax) / 2 });
    merger.tube(mat.stainless, P((wEnd.sMin + wEnd.sMax) / 2, wEnd.tMin, Y + 1.12), P((wEnd.sMin + wEnd.sMax) / 2, wEnd.tMax, Y + 1.12), 0.024, 10);
    solid(wEnd, Y, Y + 1.2, 'dcWellEnd');
    // 'Stand on the right' + emergency-stop plate on the newel side wall of the well end
    merger.wall(signMat(S.standRight()), 0.25, 0.35, { x: -(r.tMax + 0.1), y: Y + 1.55, z: well.top.s + sg * 1.0, ry: (well.name === 'c' ? -1 : 1) * Math.PI / 2 });
    // the well itself: a dark pit below the platform slab so the opening reads as a void until the box module fills it
    merger.floor(mat.slab, r.tMax - r.tMin, r.sMax - r.sMin, { x: -(r.tMin + r.tMax) / 2, y: Y - 5.6, z: (r.sMin + r.sMax) / 2 }, T);
    for (const tt of [r.tMin, r.tMax]) merger.wall(mat.slab, r.sMax - r.sMin, 5.6, { x: -tt, y: Y - 2.8, z: (r.sMin + r.sMax) / 2, ry: Math.PI / 2 }, T);
    merger.wall(mat.slab, r.tMax - r.tMin, 5.6, { x: -(r.tMin + r.tMax) / 2, y: Y - 2.8, z: sEnd, ry: 0 }, T);
  }

  // ---- platform ends: steps down to track level, DANGER gates, the 1868 tunnels with brick headwalls, signals -----------
  for (const end of [-1, 1]) {
    const sEnd = end > 0 ? S1 : S0;
    for (const pl of plats) {
      const w = 1.3; const tA = pl.tEdge, tB = pl.tEdge + pl.sgn * w; const tMin = Math.min(tA, tB), tMax = Math.max(tA, tB);
      const n = 6, rise = (Y - BED) / n, going = 0.5;
      for (let i = 0; i < n; i++) { const yTop = Y - rise * (i + 1); merger.box(mat.face, w, rise, going, { x: -(tMin + tMax) / 2, y: yTop - rise / 2 + 0.0, z: sEnd + end * (i * going + going / 2) }, T); merger.box(mat.nosing, w, 0.008, 0.05, { x: -(tMin + tMax) / 2, y: yTop + rise + 0.004, z: sEnd + end * (i * going + 0.03) }); }
      collision.addRamp(W(sEnd, (tMin + tMax) / 2, Y), W(sEnd + end * n * going, (tMin + tMax) / 2, BED), w, { tag: 'dcEndSteps', sound: 'stairs', stepPitch: going });
      // end face of the platform slab beyond the steps, handrail on the wall side, chevron gate + DANGER at the top
      const tRest0 = tB, tRest1 = pl.tBack; merger.box(mat.face, Math.abs(tRest1 - tRest0), Y - BED, 0.3, { x: -(tRest0 + tRest1) / 2, y: (Y + BED) / 2, z: sEnd + end * 0.15 }, T);
      solid(R(sEnd, sEnd + end * 0.3, tRest0, tRest1), BED, Y, 'dcPlatformEnd');
      merger.tube(mat.stainless, P(sEnd, tB, Y + 0.95), P(sEnd + end * n * going, tB, BED + 0.95), 0.022, 8);
      for (const k of [0, 1]) merger.tube(mat.stainless, P(sEnd + end * (k ? n * going : 0.1), tB, k ? BED : Y), P(sEnd + end * (k ? n * going : 0.1), tB, (k ? BED : Y) + 0.95), 0.02, 8);
      merger.box(signMat(S.chevrons()), 0.05, 0.08, w, { x: -(tMin + tMax) / 2, y: Y + 0.95, z: sEnd - end * 0.2, ry: Math.PI / 2 });
      for (const tt of [tMin + 0.05, tMax - 0.05]) merger.tube(mat.dark, P(sEnd - end * 0.2, tt, Y), P(sEnd - end * 0.2, tt, Y + 1.0), 0.02, 8);
      solid(R(sEnd - end * 0.25, sEnd - end * 0.15, tMin, tMax), Y, Y + 1.0, 'dcEndGate');
      merger.wall(signMat(S.dangerEnd()), 0.5, 0.25, { x: -(tMin + tMax) / 2, y: Y + 1.25, z: sEnd - end * 0.27, ry: end > 0 ? Math.PI : 0 });
      merger.wall(signMat(S.noEntry()), 0.24, 0.3, { x: -(tRest0 + tRest1) / 2, y: Y + 1.6, z: sEnd - end * 0.02, ry: end > 0 ? Math.PI : 0 });
      // signal for trains leaving this end (starter) or a repeater at the entry end, on the platform-side of the track
      const leaving = (pl.dir === 'eastbound') === (end > 0);
      makeSignal(ctx, dc, merger, { x: -(pl.tEdge + pl.sgn * 0.6), y: BED, z: sEnd + end * 4.0, ry: end > 0 ? Math.PI : 0, aspect: leaving ? 'red' : 'green', id: (pl.n === 1 ? 'WD' : 'WA') + (end > 0 ? '2' : '1') + pl.n });
      // relay cabinet, signal post telephone and the driver's car-stop board ('7 CAR') at the stopping end
      merger.box(mat.cabinet, 0.6, 1.4, 0.9, { x: -(pl.tBack - pl.sgn * 0.5), y: BED + 0.7, z: sEnd + end * 2.5 });
      merger.box(mat.dark, 0.12, 0.3, 0.25, { x: -(pl.tBack - pl.sgn * 0.06), y: BED + 1.5, z: sEnd + end * 3.4 });
      merger.wall(signMat(S.spt()), 0.24, 0.12, { x: -(pl.tBack - pl.sgn * 0.125), y: BED + 1.5, z: sEnd + end * 3.4, ry: pl.face });
      if (leaving) { const sStop = end * (doors[doors.length - 1].s + 1.6); merger.box(mat.grey, 0.06, 1.2, 0.06, { x: -(pl.tBack - pl.sgn * 0.3), y: Y + 0.6, z: sStop }); merger.wall(signMat(S.stopBoard(), { emissive: 0.5 }), 0.3, 0.375, { x: -(pl.tBack - pl.sgn * 0.3), y: Y + 1.35, z: sStop - end * 0.04, ry: end > 0 ? Math.PI : 0 }); }
    }
    // the end area between the platforms' ends and the headwall is at track level (staff walkway)
    flat(R(Math.min(sEnd, sEnd + end * (BOX1 - S1)), Math.max(sEnd, sEnd + end * (BOX1 - S1)), -TB, TB), BED, 'dcEndArea', 'pavement');
    merger.floor(mat.slab, 2 * TB, BOX1 - S1, { x: 0, y: BED, z: sEnd + end * (BOX1 - S1) / 2 }, T);
    // headwall with the arched opening for both tracks; the 1868 brick tunnel beyond (walls + elliptical arch), a black end cap
    const sHead = end * BOX1, sFar = end * (BOX1 + TUN);
    try {
      const shape = new THREE.Shape(); shape.moveTo(-TB, BED - 0.2); shape.lineTo(TB, BED - 0.2); shape.lineTo(TB, SLAB); shape.lineTo(-TB, SLAB); shape.closePath();
      const hole = new THREE.Path(); hole.moveTo(-HALF_TUN, BED - 0.2); hole.lineTo(-HALF_TUN, SPRING); hole.absellipse(0, SPRING, HALF_TUN, ARCH_RISE, Math.PI, 0, true); hole.lineTo(HALF_TUN, BED - 0.2); hole.closePath();
      shape.holes.push(hole);
      const hg = new THREE.ShapeGeometry(shape, 24); merger.add(mat.brick, hg, mat4(0, 0, sHead, end > 0 ? Math.PI : 0)); hg.dispose();
      merger.box(mat.brick, 2 * TB, SLAB - BED + 0.2, 0.5, { x: 0, y: (BED - 0.2 + SLAB) / 2, z: sHead + end * 0.26 }, T);   // solid thickness behind the face (hides the beam ends)
    } catch (e) { console.warn('[districtPlatforms] headwall failed', e); }
    solid(R(Math.min(sHead, sHead + end * 0.5), Math.max(sHead, sHead + end * 0.5), HALF_TUN, TB), BED - 0.5, SLAB, 'dcHeadwall');
    solid(R(Math.min(sHead, sHead + end * 0.5), Math.max(sHead, sHead + end * 0.5), -TB, -HALF_TUN), BED - 0.5, SLAB, 'dcHeadwall');
    for (const side of [-1, 1]) { merger.box(mat.brick, 0.5, SPRING - BED + 0.2, TUN, { x: side * (HALF_TUN + 0.25), y: (SPRING + BED - 0.2) / 2, z: (sHead + sFar) / 2 }, T); solid(R(Math.min(sHead, sFar), Math.max(sHead, sFar), side * HALF_TUN, side * (HALF_TUN + 0.5)), BED - 0.5, SPRING + 2, 'dcTunnelWall'); }
    merger.add(mat.brick, archGeometry(Math.min(sHead, sFar), Math.max(sHead, sFar), HALF_TUN, SPRING, ARCH_RISE));
    merger.floor(mat.slab, 2 * HALF_TUN + 0.6, TUN, { x: 0, y: BED - 0.02, z: (sHead + sFar) / 2 }, T);
    flat(R(Math.min(sHead, sFar), Math.max(sHead, sFar), -HALF_TUN, HALF_TUN), BED, 'dcTunnelBed', 'pavement');
    merger.wall(mat.black, 2 * HALF_TUN + 2, SPRING + ARCH_RISE - BED + 2, { x: 0, y: (BED + SPRING + ARCH_RISE) / 2, z: sFar + end * 0.05, ry: end > 0 ? Math.PI : 0 });
    solid(R(Math.min(sFar, sFar - end * 0.4), Math.max(sFar, sFar - end * 0.4), -HALF_TUN, HALF_TUN), BED - 0.5, SLAB, 'dcTunnelEnd');
    // tunnel cable run on one wall and bulkhead lamps (emissive, no real light) every 10 m so the arch reads
    merger.box(mat.cable, 0.08, 0.08, TUN - 2, { x: HALF_TUN - 0.1, y: SPRING - 0.3, z: (sHead + sFar) / 2 });
    for (let k = 4; k < TUN; k += 10) { const sl = sHead + end * k; merger.box(mat.dark, 0.14, 0.14, 0.26, { x: -(HALF_TUN - 0.12), y: SPRING - 0.1, z: sl }); merger.box(M.luminaire(0xfff0c8, 1.6), 0.09, 0.09, 0.2, { x: -(HALF_TUN - 0.2), y: SPRING - 0.1, z: sl }); }
  }
  // track bed between the platforms (dark concrete slab track, central drainage channel)
  merger.floor(mat.slab, 2 * HALF_TUN + 0.2, S1 - S0 + 1, { x: 0, y: BED - 0.01, z: 0 }, T);
  merger.box(mat.black, 0.5, 0.02, 2 * (BOX1 + TUN), { x: 0, y: BED + 0.004, z: 0 });
  for (const r of [R(S0 - 0.5, -20, -3.9, 3.9), R(-20, 20, -3.9, 3.9), R(20, S1 + 0.5, -3.9, 3.9)]) flat(r, BED, 'dcTrackBed', 'pavement');

  // ---- tracks (world space, following the layout curves) -----------------------------------------------------------
  const tracks = {};
  try {
    for (const [key, def] of [['eb', TRACKS.districtEB], ['wb', TRACKS.districtWB]]) {
      const track = new Track(def); tracks[key] = track;
      const sA = track.stopS - (BOX1 + TUN + 5), sB = track.stopS + (BOX1 + TUN + 5);
      const mesh = buildTrackMesh(track, { sMin: sA, sMax: sB, railMaterial: mat.rail, sleeperMaterial: null, sleepers: false, thirdFourthRail: true, step: 0.6 });
      mesh.name = 'dcTrack:' + key; group.add(mesh);
      // yellow-capped insulator pots under the conductor rails every 3 m (dossier §7.3)
      const n = Math.floor((sB - sA) / 3); const pot = new THREE.CylinderGeometry(0.045, 0.06, 0.12, 8); pot.translate(0, 0.06, 0); const cap = new THREE.CylinderGeometry(0.042, 0.042, 0.025, 8); cap.translate(0, 0.13, 0);
      const pots = new THREE.InstancedMesh(pot, mat.insulator, n * 2), caps = new THREE.InstancedMesh(cap, mat.yellowCap, n * 2);
      const f = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), tangent: new THREE.Vector3() }; const side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
      for (let i = 0; i < n; i++) {
        track.frameAt(sA + i * 3 + 1.5, f); side.crossVectors(up, f.tangent).normalize();
        const pNeg = f.position.clone().addScaledVector(side, -DISTRICT.trackGauge / 2 - 0.4), pPos = f.position.clone();
        m.compose(pNeg, f.quaternion, one); pots.setMatrixAt(i * 2, m); caps.setMatrixAt(i * 2, m);
        m.compose(pPos, f.quaternion, one); pots.setMatrixAt(i * 2 + 1, m); caps.setMatrixAt(i * 2 + 1, m);
      }
      pots.instanceMatrix.needsUpdate = true; caps.instanceMatrix.needsUpdate = true; pots.frustumCulled = caps.frustumCulled = false; group.add(pots, caps);
    }
  } catch (e) { console.warn('[districtPlatforms] track build failed', e); }

  // ---- lighting: twin-tube battens (instanced), the eave strips (above), 8 real point lights ---------------------------
  {
    const hang = 0.32; const battens = [];
    for (const pl of plats) { const t = pl.tBack - pl.sgn * 2.5; for (let s = -63; s <= 63; s += 3) battens.push({ x: -t, y: CEIL - hang, z: s }); }
    for (const s of [-48, -45, -42, -39, -33, -27, -24]) battens.push({ x: -11.6, y: CEIL - hang, z: s });          // wide west end second row
    for (const s of [-36, -28, -22]) battens.push({ x: 10.6, y: CEIL - hang, z: s });                                  // P2 recesses
    const housing = new THREE.BoxGeometry(0.2, 0.06, 1.5); housing.translate(0, 0.045, 0);
    const tubes = []; for (const dx of [-0.045, 0.045]) { const c = new THREE.CylinderGeometry(0.016, 0.016, 1.45, 8); c.rotateX(Math.PI / 2); c.translate(dx, 0, 0); tubes.push(c); }
    const tubeGeo = tubes[0].clone(); tubeGeo.dispose(); const merged = mergeTwo(tubes[0], tubes[1]);
    const rods = []; for (const dz of [-0.6, 0.6]) { const r = new THREE.CylinderGeometry(0.008, 0.008, hang, 5); r.translate(0, hang / 2 + 0.07, dz); rods.push(r); }
    instanced(dc, housing, M.paint(0xe4e4e0, { roughness: 0.6, metalness: 0.2 }), battens, { name: 'battens' });
    instanced(dc, merged, mat.lum, battens, { name: 'batten-tubes' });
    instanced(dc, mergeTwo(rods[0], rods[1]), mat.stainless, battens, { name: 'batten-rods' });
    for (const pl of plats) for (const s of [-45, -15, 15, 45]) ctx.lights.point(dc, { x: -(pl.tBack - pl.sgn * 2.4), y: CEIL - 0.6, z: s, color: 0xfff3e2, intensity: 9, distance: 30, decay: 1.25 });
  }

  // ---- signage, adverts, furniture along the back walls --------------------------------------------------------------
  const posters = [['London', 'See more of it', 210], ['Theatre', 'Book by Tube', 340], ['Museums', 'Late nights', 20], ['River', 'Take the boat', 190], ['Markets', 'Every weekend', 30], ['Parks', 'A breath of air', 120]].map(([h, sub, hue], i) => T.poster({ seed: 30 + i, headline: h, sub, hue }));
  const bigPosters = [T.poster({ width: 1024, height: 512, seed: 91, headline: 'Westminster', sub: 'Change here for the river', hue: 205 }), T.poster({ width: 1024, height: 512, seed: 92, headline: 'See it. Say it. Sorted.', sub: 'Text 61016', hue: 350 })];
  const digital = [T.poster({ seed: 71, headline: 'Travel off-peak', sub: 'Cheaper fares', hue: 275 }), T.poster({ seed: 72, headline: 'Hopper fare', sub: 'Unlimited bus and tram journeys in one hour', hue: 15 })];
  const lineDiag = { District: T.lineDiagram({ line: 'District', color: '#00782a', stations: STOCK_S7.lineDiagram, current: 'Westminster', width: 4096, height: 512 }), Circle: T.lineDiagram({ line: 'Circle', color: '#ffd300', stations: STOCK_S7.circleDiagram, current: 'Westminster', width: 4096, height: 512 }) };
  /** Item on the back wall of a platform at s (or on the wall face `tFace`), facing the track. */
  function onWall(pl, s, kind, opts = {}) {
    const tFace = opts.tFace ?? backT(pl, s); if (tFace == null) return false;
    const x = -tFace, ry = pl.face, inX = pl.inX;
    if (kind === 'roundel') {
      merger.box(mat.enamel, 1.75, 1.0, 0.03, { x: x + inX * 0.015, y: Y + 1.65, z: s, ry });
      merger.wall(signMat(S.nameRoundel(), { emissive: 0.5, transparent: true }), 1.6, 0.8, { x: x + inX * 0.033, y: Y + 1.65, z: s, ry });
    } else if (kind === 'poster') {
      merger.box(mat.stainless, 1.116, 1.624, 0.035, { x: x + inX * 0.0175, y: Y + 0.9 + 0.762, z: s, ry });
      merger.wall(signMat(opts.tex, { emissive: 0.3 }), 1.016, 1.524, { x: x + inX * 0.037, y: Y + 0.9 + 0.762, z: s, ry });
    } else if (kind === 'poster48') {
      merger.box(mat.stainless, 6.2, 3.15, 0.05, { x: x + inX * 0.025, y: Y + 0.5 + 1.524, z: s, ry });
      merger.wall(signMat(opts.tex, { emissive: 0.3 }), 6.096, 3.048, { x: x + inX * 0.053, y: Y + 0.5 + 1.524, z: s, ry });
    } else if (kind === 'digital') {
      merger.box(mat.dark, 1.2, 2.0, 0.09, { x: x + inX * 0.045, y: Y + 0.75 + 0.95, z: s, ry });
      merger.wall(screenMat(opts.tex), 1.08, 1.86, { x: x + inX * 0.093, y: Y + 0.75 + 0.95, z: s, ry });
      merger.wall(mat.glass, 1.12, 1.9, { x: x + inX * 0.097, y: Y + 0.75 + 0.95, z: s, ry });
    } else if (kind === 'lineDiagram') {
      merger.box(mat.stainless, 3.26, 0.48, 0.03, { x: x + inX * 0.015, y: Y + 1.55, z: s, ry });
      merger.wall(signMat(opts.tex, { emissive: 0.4 }), 3.2, 0.4, { x: x + inX * 0.032, y: Y + 1.55, z: s, ry });
    } else if (kind === 'sign') {
      const { tex, w, h, yc = Y + 2.0, depth = 0.03, emissive = 0.55, transparent = false } = opts;
      if (depth > 0) merger.box(opts.boxMat || mat.signBox, w, h, depth, { x: x + inX * depth / 2, y: yc, z: s, ry });
      merger.wall(signMat(tex, { emissive, transparent }), w, h, { x: x + inX * (depth + 0.003), y: yc, z: s, ry });
    } else if (kind === 'panel') {   // grey perforated aluminium / vitreous-enamel wall panelling band
      const { w, h = 2.4, yc = Y + 0.9 + 1.2 } = opts;
      merger.box(mat.perfGrey, w, h, 0.04, { x: x + inX * 0.02, y: yc, z: s, ry }, T);
      for (let k = -w / 2 + 1.0; k < w / 2; k += 1.0) merger.box(mat.grey, 0.02, h, 0.045, { x: x + inX * 0.02, y: yc, z: s + k, ry });
      for (let k = -h / 2 + 0.5; k < h / 2; k += 0.5) merger.box(mat.grey, w, 0.02, 0.045, { x: x + inX * 0.02, y: yc + k, z: s, ry });
    }
    return true;
  }
  const benches = [], helps = [], fires = [], cctv = [], spk = [], speakerList = [];
  const trackSideCCTV = (pl, s) => cctv.push({ x: -(pl.tEdge + pl.sgn * 3.6), y: CEIL, z: s });
  for (const pl of plats) {
    const n = pl.n;
    // fixed items first: entrance/exit signs by the stairs and escalators, lifts, help points, fire points, line diagrams, benches
    for (const s of [-27.5, 27.5]) if (isPlainWall(pl, s) && claim(pl, s, 0.4)) helps.push({ x: pl.xBack + pl.inX * 0.0, y: Y, z: s, ry: pl.face, pl });
    for (const s of [-57.5, 2.5, 57.5]) if (isPlainWall(pl, s) && claim(pl, s, 0.45)) fires.push({ x: pl.xBack, y: Y, z: s, ry: pl.face, pl });
    for (const [s, line] of [[-8, 'District'], [-4, 'Circle'], [36, 'District'], [40, 'Circle']]) if (isPlainWall(pl, s) && claim(pl, s, 1.7)) onWall(pl, s, 'lineDiagram', { tex: lineDiag[line] });
    for (const s of [-16, 30]) if (isPlainWall(pl, s) && claim(pl, s, 0.7)) onWall(pl, s, 'digital', { tex: digital[(s + n) & 1] });
    const s48 = n === 1 ? 50 : -55; if (claim(pl, s48, 3.2)) onWall(pl, s48, 'poster48', { tex: bigPosters[n - 1] });
    for (const s of [-52, -10, 20, 46]) if (isPlainWall(pl, s)) benches.push({ x: pl.xBack + pl.inX * 0.35, y: Y, z: s, ry: pl.face, pl });
    // roundels every 15 m, then 4-sheet frames in the remaining 5 m slots, square piers between
    for (let s = -60; s <= 60; s += 15) if (backT(pl, s) != null && claim(pl, s, 0.95)) onWall(pl, s, 'roundel');
    let pk = 0;
    for (let s = -60; s <= 60; s += 5) if (backT(pl, s) != null && claim(pl, s, 0.62)) onWall(pl, s, 'poster', { tex: posters[(pk++ + n * 2) % posters.length] });
    for (let s = -57.5; s <= 57.5; s += 10) if (isPlainWall(pl, s) && claim(pl, s, 0.5)) { merger.box(mat.beam, 0.45, SLAB - Y, 0.9, { x: pl.xBack + pl.inX * 0.225, y: (Y + SLAB) / 2, z: s }, T); solid(R(s - 0.45, s + 0.45, pl.tBack, pl.tBack + pl.sgn * 0.45), Y, SLAB, 'dcPier'); }
    // CCTV domes and horn speakers on the beams
    for (let i = 1; i < beamS.length; i += 4) trackSideCCTV(pl, beamS[i] + 0.4);
    for (let i = 2; i < beamS.length; i += 3) { const sp = { x: -(pl.tEdge + pl.sgn * 2.0), y: CEIL + 0.02, z: beamS[i] + 0.36, ry: (i & 1) ? 0 : Math.PI }; spk.push(sp); const w = W(sp.z, pl.tEdge + pl.sgn * 2.0, CEIL - 0.25); speakerList.push({ x: w.x, y: w.y, z: w.z, platform: n }); }
    // small notices
    if (isPlainWall(pl, 12.5) && claim(pl, 12.5, 0.3)) onWall(pl, 12.5, 'sign', { tex: S.cctvNotice(), w: 0.4, h: 0.2, yc: Y + 2.3, depth: 0.01, boxMat: mat.enamel, emissive: 0.4 });
    if (isPlainWall(pl, -62.5) && claim(pl, -62.5, 0.3)) onWall(pl, -62.5, 'sign', { tex: S.noSmoking(), w: 0.27, h: 0.2, yc: Y + 2.0, depth: 0.01, boxMat: mat.enamel, emissive: 0.4 });
    if (isPlainWall(pl, 62.5) && claim(pl, 62.5, 0.3)) onWall(pl, 62.5, 'sign', { tex: S.cctvNotice(), w: 0.4, h: 0.2, yc: Y + 2.3, depth: 0.01, boxMat: mat.enamel, emissive: 0.4 });
    // wheelchair boarding-point plates at the hump
    const travel = pl.dir === 'eastbound' ? 1 : -1; const msDoors = doors.filter(d => d.car === (STOCK_S7.wheelchairCars || [3])[0]).map(d => travel * d.s);
    for (const s of [Math.min(...msDoors), Math.max(...msDoors)]) if (backT(pl, s) != null) onWall(pl, s, 'sign', { tex: S.boarding(), w: 0.5, h: 0.25, yc: Y + 2.55, depth: 0.02 });
  }
  // faint grime band at hand height along the plain back walls (a wash, not a stripe)
  for (const pl of plats) for (const [a, b] of pl.n === 1 ? [[S0, wide.sMin - 0.2], [wide.sMax + 0.2, S1]] : [[S0, rec[0].sMin - 0.2], [rec[1].sMax + 0.2, S1]]) merger.wall(mat.grime, b - a, 0.7, { x: pl.xBack + pl.inX * 0.004, y: Y + 1.05, z: (a + b) / 2, ry: pl.face });
  // green running-man signs on the pier faces at the exits, read along the platform (walking towards -s)
  merger.wall(signMat(S.exitGreen('right'), { emissive: 0.9 }), 0.44, 0.22, { x: -(p2.tBack - 0.5), y: Y + 2.45, z: rec[0].sMax + 0.31, ry: 0 });
  merger.wall(signMat(S.exitGreen('left'), { emissive: 0.9 }), 0.44, 0.22, { x: -(p1.tBack + 0.5), y: Y + 2.45, z: wide.sMax + 0.31, ry: 0 });
  // grey perforated / enamel wall panelling in the recesses and on the wide west end (between the concrete)
  onWall(p2, (rec[1].sMin + rec[1].sMax) / 2, 'panel', { w: rec[1].sMax - rec[1].sMin - 0.6, tFace: rec[1].tMin });
  onWall(p2, (st2.sBottom + rec[0].sMax) / 2, 'panel', { w: rec[0].sMax - st2.sBottom - 0.7, tFace: rec[0].tMin });
  onWall(p1, (wide.sMin + st1.sTop - 0.3) / 2, 'panel', { w: st1.sTop - 0.3 - wide.sMin - 0.6, tFace: wide.tMax });
  onWall(p1, (st1.sBottom + 0.3 + wide.sMax) / 2, 'panel', { w: wide.sMax - st1.sBottom - 0.9, tFace: wide.tMax });
  // platform-entrance panels (photographed wording) facing the foot of each stair, exit lists + 'Way out' over the feet,
  // 'Jubilee line ↓' over the escalator wells, platform number tabs, green emergency-exit signs, clocks
  merger.wall(signMat(S.entrancePanel(2, 'Eastbound', 'right'), { emissive: 0.5 }), 1.6, 0.62, { x: -(rec[0].tMin + p2.tBack) / 2, y: Y + 1.75, z: rec[0].sMax - 0.02, ry: Math.PI });
  merger.wall(signMat(S.entrancePanel(1, 'Westbound', 'left'), { emissive: 0.5 }), 1.6, 0.62, { x: -(shaft1.tMin + shaft1.tMax) / 2, y: Y + 1.75, z: shaft1.sMin - 0.02, ry: Math.PI });
  for (const st of DISTRICT.stairs) {
    const tc = (st.tMin + st.tMax) / 2; const pl = st.platform === 1 ? p1 : p2;
    hang(st.sBottom + 1.2, tc, 1.2, 0.6, S.exitList('up'), S.platformId(pl.n, pl.dirName));
    merger.wall(signMat(S.platformTab(pl.n)), 0.5, 0.16, { x: -stairInnerT(st) + pl.inX * 0.012, y: Y + 2.3, z: st.sBottom - 1.0, ry: pl.face });
    merger.wall(signMat(S.exitGreen('up'), { emissive: 0.9 }), 0.4, 0.2, { x: -tc, y: CONC - 0.25, z: st.sTop + 0.4, ry: Math.PI });   // over the head, seen from the stair
    PF.addClock(ctx, dc, { x: -stairInnerT(st) + pl.inX * 0.02, y: Y + 2.75, z: st.sBottom - 2.2, facing: pl.face, size: 0.32 });
    cctv.push({ x: -tc, y: CONC - 0.3, z: st.sBottom + 1.5 });
    helps.push({ x: -stairInnerT(st), y: Y, z: st.sBottom - 3.2, ry: pl.face, pl });
  }
  for (const well of [wellC, wellD]) { const tc = (well.rect.tMin + well.rect.tMax) / 2; hang(well.top.s + 2.6, tc, 1.2, 0.3, S.jubilee('down'), S.platformId(well.name === 'c' ? 2 : 1, well.name === 'c' ? 'Eastbound' : 'Westbound')); cctv.push({ x: -tc, y: CEIL, z: well.top.s + 1.5 }); }
  // suspended wayfinding along the platforms: towards the west end (−s) for both the way out and the Jubilee line
  for (const pl of plats) {
    const tc = pl.tBack - pl.sgn * 2.6; const jubSide = pl.n === 2 ? 'right' : 'left';   // facing −s: P2's recesses are to the right, P1's wide end to the left
    for (const s of [58, 38, 18, -2]) hang(s, tc, 1.2, 0.6, S.wayOutJubilee('up', 'up'), S.platformId(pl.n, pl.dirName));
    hang(-15, tc, 1.2, 0.6, S.wayOutJubilee('up', jubSide), S.platformId(pl.n, pl.dirName));
    hang(pl.n === 2 ? -31 : -35, tc, 1.2, 0.3, S.wayOut(jubSide), S.platformId(pl.n, pl.dirName));
    hang(-55, tc, 1.2, 0.3, S.platformId(pl.n, pl.dirName), S.wayOut('up'));   // beyond the exits: 'Way out ↑' faces people walking back east
    // fire-action and lift notices by the lifts
    const lf = pl.n === 1 ? lift1 : lift2; onWall(pl, lf.s + (pl.n === 1 ? 0 : 2.4), 'sign', { tex: S.fireAction(), w: 0.3, h: 0.225, yc: Y + 1.5, depth: 0.01, boxMat: mat.enamel, emissive: 0.4, tFace: pl.n === 1 ? null : pl.tBack });
  }
  // lift call-side wayfinding: '↑ Lift' arrows on the walls near each lift
  onWall(p2, alcove2.sMax + 1.2, 'sign', { tex: S.lift('to ticket hall', 'left'), w: 0.9, h: 0.225, yc: Y + 2.2, tFace: p2.tBack });
  merger.wall(signMat(S.lift('to ticket hall', 'right')), 0.9, 0.225, { x: -(shaft1.tMin + shaft1.tMax) / 2, y: Y + 2.4, z: shaft1.sMax + 0.02, ry: 0 });
  // instanced furniture sets
  try {
    makeBenches(ctx, dc, benches); for (const b of benches) solid(R(b.z - 0.8, b.z + 0.8, -b.x - b.pl.inX * 0.05, -b.x + b.pl.inX * 0.55), Y, Y + 1.0, 'dcBench');
    makeHelpPoints(ctx, dc, helps, S); makeFirePoints(ctx, dc, fires); for (const f of fires) solid(R(f.z - 0.35, f.z + 0.35, -f.x, -f.x + f.pl.inX * 0.4), Y, Y + 1.4, 'dcFirePoint');
    makeCCTV(ctx, dc, cctv); makeSpeakers(ctx, dc, spk);
  } catch (e) { console.warn('[districtPlatforms] furniture failed', e); }

  // ---- next-train indicators (amber dot-matrix, ceiling hung, double-sided) — register 'indicator:1' / 'indicator:2' ----
  const indicators = {};
  try {
    for (const pl of plats) for (const s of [-33, 24]) { const r = PF.addNextTrainIndicator(ctx, dc, { x: -(pl.tBack - pl.sgn * 2.6), y: CEIL, z: s, facing: 0, platformNumber: pl.n, drop: 0.55, batch }); indicators[pl.n] = r; }
  } catch (e) { console.warn('[districtPlatforms] indicators failed', e); }

  // ---- flush merged geometry ----------------------------------------------------------------------------------------
  merger.flush({ castShadow: false, receiveShadow: true });
  batch.flush(dc, { name: 'dcBatch' });

  // ---- audio ----------------------------------------------------------------------------------------------------------
  const emitters = [];
  try {
    if (audio && audio.registerSynth && !audio.synths.has('district:drip')) audio.registerSynth('district:drip', (c, { rate = 1 } = {}) => {
      const out = c.createGain(); out.gain.value = 0.6; let timer = null, alive = true;
      const drip = () => { if (!alive) return; const t0 = c.currentTime; const o = c.createOscillator(); o.type = 'sine'; const f = 1300 + Math.random() * 1800; o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * 0.5, t0 + 0.14);
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
        o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 0.22); timer = setTimeout(drip, (900 + Math.random() * 5000) / rate); };
      return { output: out, start() { timer = setTimeout(drip, 400 + Math.random() * 2000); }, stop() { alive = false; clearTimeout(timer); } };
    });
    if (audio && audio.emitter) {
      for (const pl of plats) for (const s of [-40, 40]) emitters.push(audio.emitter({ position: W(s, pl.tBack - pl.sgn * 2.5, CEIL - 0.4), synth: 'hum', params: { freq: 100, level: 0.12 }, gain: 0.3, refDistance: 4, maxDistance: 28 }));
      for (const end of [-1, 1]) for (const t of [-1.9, 1.9]) emitters.push(audio.emitter({ position: W(end * (BOX1 + 2), t, RAIL + 2), synth: 'tunnelAir', params: { level: 0.35 }, gain: 0.55, refDistance: 8, maxDistance: 70 }));
      for (const end of [-1, 1]) emitters.push(audio.emitter({ position: W(end * (BOX1 + 20), end * 3.5, SPRING), synth: 'district:drip', params: { rate: 1 }, gain: 0.35, refDistance: 5, maxDistance: 40 }));
    }
  } catch (e) { console.warn('[districtPlatforms] audio failed', e); }

  // ---- registrations: speakers, NPC nav graph + spawn points, the module itself ------------------------------------------
  ctx.register('speakers:district', speakerList);
  try {
    const nodes = [], edges = []; const add = (s, t, y, tags) => { const w = dcToWorld(s, t); nodes.push({ id: nodes.length, x: w.x, y, z: w.z, tags }); return nodes.length - 1; };
    for (const pl of plats) {
      const tWalk = pl.tEdge + pl.sgn * 2.9; let prev = null;
      for (let s = -60; s <= 60; s += 10) { const id = add(s, tWalk, Y, ['platform' + pl.n, 'dcPlatform']); if (prev != null) edges.push([prev, id]); prev = id; }
    }
    const near = (s, t) => { let best = -1, bd = 1e9; nodes.forEach((n, i) => { const d = worldToDc(n.x, n.z); const dd = Math.hypot(d.s - s, d.t - t); if (n.tags.includes('dcPlatform') && dd < bd) { bd = dd; best = i; } }); return best; };
    const link = (id, s, t) => { const j = near(s, t); if (j >= 0) edges.push([id, j]); return id; };
    // Platform 2: stair foot → recess lobby → platform; lift front; recess 2 & escalator top area
    const f2 = add(st2.sBottom + 1.2, (st2.tMin + st2.tMax) / 2, Y, ['platform2', 'dcStairBottom']); const l2 = add(rec[0].sMax - 1.6, -10.2, Y, ['platform2', 'dcRecess']); edges.push([f2, l2]); link(l2, rec[0].sMax - 1.6, -6.6);
    const lf2 = add(lift2.s, -9.2, Y, ['platform2', 'dcLift']); link(lf2, lift2.s, -6.6);
    const e2 = add(wellC.top.s + 2.8, (wellC.rect.tMin + wellC.rect.tMax) / 2, Y, ['platform2', 'dcRecess', 'escTopArea']); link(e2, wellC.top.s + 2.8, -6.6);
    // Platform 1: stair foot → wide end → platform; deep lift lobby; lift front; escalator top area
    const f1 = add(st1.sBottom + 1.2, (st1.tMin + st1.tMax) / 2, Y, ['platform1', 'dcStairBottom']); const w1 = add(st1.sBottom + 1.6, 8.0, Y, ['platform1', 'dcRecess']); edges.push([f1, w1]); link(w1, st1.sBottom + 1.6, 6.6);
    const dl = add(deepLift.s + 1.8, deepLift.t, Y, ['platform1', 'dcDeepLift']); const lob = add(wide.sMin + 1.8, 8.0, Y, ['platform1', 'dcRecess']); edges.push([dl, lob]); link(lob, wide.sMin + 1.8, 6.6);
    const lf1 = add(lift1.s, shaft1.tMin - 0.8, Y, ['platform1', 'dcLift']); link(lf1, lift1.s, 6.6);
    const e1 = add(wellD.top.s + 2.8, (wellD.rect.tMin + wellD.rect.tMax) / 2, Y, ['platform1', 'dcRecess', 'escTopArea']); link(e1, wellD.top.s + 2.8, 6.6);
    // stair heads at concourse level
    for (const [st, foot] of [[st2, f2], [st1, f1]]) { const top = add(st.sTop - 1.6, (st.tMin + st.tMax) / 2, CONC, ['hall', 'dcStairTop', 'dcStairTop' + st.platform]); edges.push([top, foot, { kind: 'stairs' }]); }
    ctx.register('nav:district', { nodes, edges });
    const spawn = []; for (const pl of plats) for (const s of [-50, -30, -10, 10, 30, 50]) { const w = dcToWorld(s, pl.tEdge + pl.sgn * 2.6); spawn.push({ x: w.x, y: Y, z: w.z, platform: pl.n }); }
    ctx.register('spawn:district', spawn);
  } catch (e) { console.warn('[districtPlatforms] nav registration failed', e); }

  ctx.scene.add(group);
  const api = { group, frame: dc, platforms: plats, tracks, indicators, speakers: speakerList, emitters, wells: { c: wellC, d: wellD }, deepLiftLobby: deepLift, toWorld: (s, t, y) => W(s, t, y) };
  ctx.register('district', api);
  return api;

  // ---- local helpers --------------------------------------------------------------------------------------------------
  /** Double-sided suspended sign box (front faces +s) hung on two rods from the beam soffit; baked into the merger. */
  function hang(s, t, w, h, front, back = null, { yBottom = Y + 2.45, depth = 0.1 } = {}) {
    const x = -t, yc = yBottom + h / 2;
    merger.box(mat.signBox, w, h, depth, { x, y: yc, z: s });
    merger.wall(signMat(front, { emissive: 0.6 }), w - 0.02, h - 0.02, { x, y: yc, z: s + depth / 2 + 0.003 });
    if (back) merger.wall(signMat(back, { emissive: 0.6 }), w - 0.02, h - 0.02, { x, y: yc, z: s - depth / 2 - 0.003, ry: Math.PI });
    for (const dx of [-w * 0.36, w * 0.36]) merger.tube(mat.stainless, new THREE.Vector3(x + dx, yBottom + h, s), new THREE.Vector3(x + dx, CEIL, s), 0.01, 6);
  }
  /** Half-elliptical brick arch surface from s0 to s1 (local frame), UVs in metres. */
  function archGeometry(s0, s1, halfW, ySpring, rise, nAcross = 28, nAlong = 10) {
    const pos = [], uv = [], idx = []; const arc = Math.PI / 2 * (3 * (halfW + rise) - Math.sqrt((3 * halfW + rise) * (halfW + 3 * rise)));
    for (let j = 0; j <= nAlong; j++) { const s = s0 + (s1 - s0) * j / nAlong; for (let i = 0; i <= nAcross; i++) { const th = Math.PI * i / nAcross; pos.push(-halfW * Math.cos(th), ySpring + rise * Math.sin(th), s); uv.push(arc * i / nAcross, s); } }
    for (let j = 0; j < nAlong; j++) for (let i = 0; i < nAcross; i++) { const a = j * (nAcross + 1) + i, b = a + 1, c = a + nAcross + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  function mergeTwo(a, b) { const A = a.toNonIndexed(), B = b.toNonIndexed(); const n = A.attributes.position.count + B.attributes.position.count; const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uvs = new Float32Array(n * 2); pos.set(A.attributes.position.array, 0); pos.set(B.attributes.position.array, A.attributes.position.count * 3); nrm.set(A.attributes.normal.array, 0); nrm.set(B.attributes.normal.array, A.attributes.position.count * 3); uvs.set(A.attributes.uv.array, 0); uvs.set(B.attributes.uv.array, A.attributes.position.count * 2); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); return g; }
}
