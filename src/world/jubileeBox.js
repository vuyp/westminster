// ---------------------------------------------------------------------------
// jubileeBox.js — the Jubilee Line Extension 'box' at Westminster (Hopkins /
// Maunsell, 1999): the 80 × 26 m, 39 m deep 'Piranesian' concrete cavern under
// the south strip of Portcullis House (dossier §3, §5). Built here:
//   * the structural shell via boxStructure.js (diaphragm walls + grillage,
//     columns, struts, braces, escalator supports, base slab, lid, D&C soffit);
//   * the interchange slabs (EAST -9.5, WEST -14 extending south under Bridge
//     Street), the four well landings at the two platform levels, the open void
//     between (no slab at all across layout.JUBILEE.voidX), the bank-(a) cutting
//     through the east wall and the bank-(c) alcove in the west wall;
//   * all seven escalator banks (17 machines) from layout.ESCALATORS through
//     entities/escalator.js, baked to a few draw calls per bank, clad in
//     light-grey aluminium panels between exposed ribs; fixed concrete stairs
//     alongside banks (c), (f) and (g); the in-situ concrete emergency stair
//     down the west side connecting every level; the glass/steel deep lift
//     (buttons DC / JE / JW) with its slowly moving car;
//   * Suregrip chequer-plate and terrazzo floors, perforated-stainless and glass
//     balustrades with 42 mm rails and the dark-blue stripe, JLE dark-family
//     signage with the dossier's exact wordings, dot-matrix next-train
//     summaries ('indicator:box-east' / 'indicator:box-west'), bins, help
//     points, CCTV, speakers ('speakers:box'), fire kit, cable trays,
//     sprinklers, drains, the HMS Westminster plaque;
//   * 12 real point lights + one AmbientLight + emissive fixtures; audio
//     emitters; collision for every surface; 'nav:box' and 'spawn:box'.
// Every level height and position comes from layout.js.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { LEVELS, JUBILEE, ESCALATORS, PALETTE } from '../core/layout.js';
import { createEscalator } from '../entities/escalator.js';
import * as F from '../entities/platformFurniture.js';
import * as K from './boxKit.js';
import { buildStructure, GRILLAGE } from './boxStructure.js';

const BOX = JUBILEE.box;
const IE = JUBILEE.interchangeEast, IW = JUBILEE.interchangeWest, WW = JUBILEE.wells.west, WE = JUBILEE.wells.east;
const SLAB_T = 0.8;                                  // interchange / well slab thickness
const RAIL_H = 1.1;                                  // balustrade rail height
const UNDERCROFT_Y = LEVELS.dcRail - 0.75;           // soffit of the D&C underpinning slab over the west section
const STAIR = { xMin: JUBILEE.emergencyStairX - 2.6, xMax: JUBILEE.emergencyStairX + 1.15, zMin: BOX.zMin, zMax: BOX.zMin + 14.5, landingZ: BOX.zMin + 2.6 };
const STAIR_LEVELS = [LEVELS.concourse, IW.y, LEVELS.jubUpper, LEVELS.jubLower, BOX.floor];
const LIFT = { x: JUBILEE.deepLift.x, z: JUBILEE.deepLift.z, w: 2.8, d: 2.6, stops: [{ id: 'JW', y: LEVELS.jubLower }, { id: 'JE', y: LEVELS.jubUpper }, { id: 'DC', y: LEVELS.dcPlatform }] };
const DEFAULT_STAIR_LANE = { c: -3.0, f: -4.0, g: 4.0 };   // fixed stair alongside: lane offset (perp, +left looking downhill); layout may override with e.stairLane
const TAN30 = Math.tan(Math.PI / 6);
const SIGN_UNDERSIDE = 2.45;                         // suspended sign undersides above the landing floors

export function build(ctx) {
  const { T, collision, audio } = ctx;
  const group = new THREE.Group(); group.name = 'jubileeBox'; ctx.scene.add(group);
  const mats = K.makeMaterials(ctx); const signs = K.makeSigns(ctx); const KK = { mats, signs };
  const result = { group, escalators: {}, stairs: {}, lights: [], emitters: [], speakers: [], lift: null };
  const B = new K.Bucket();          // static merged geometry
  const batch = F.createBatcher();   // furniture / signs
  const step = (name, fn) => { try { fn(); } catch (e) { console.error('[jubileeBox] ' + name + ' failed', e); } };

  // =============================================================== 1. escalator frames and the plan
  const liftRect = K.R(LIFT.x - LIFT.w / 2, LIFT.x + LIFT.w / 2, LIFT.z - LIFT.d / 2, LIFT.z + LIFT.d / 2);
  const stairRect = K.R(STAIR.xMin, STAIR.xMax, STAIR.zMin, STAIR.zMax);
  const stairHole = K.R(STAIR.xMin, STAIR.xMax, STAIR.landingZ, STAIR.zMax);
  const frames = ESCALATORS.map(e => K.escalatorFrame(e, { landing: 2.6, stairLane: e.stair ? (e.stairLane ?? DEFAULT_STAIR_LANE[e.name] ?? null) : null }));
  // banks whose foot meets another's head (b → f in the layout) get short landing plates so the two do not overlap
  for (const a of frames) for (const b of frames) { if (a === b) continue; if (a.bottom.distanceTo(b.top) < 3.5) { a.landing = Math.min(a.landing, 0.5); b.landing = Math.min(b.landing, 0.5); } }
  const byName = Object.fromEntries(frames.map(f => [f.name, f]));
  const fa = byName.a, fb = byName.b, fc = byName.c, fd = byName.d, fe = byName.e, ff = byName.f, fg = byName.g;
  const holeAcross = (f) => { let c0 = f.laneMin - 0.72, c1 = f.laneMax + 0.72; if (f.stairLane != null) { c0 = Math.min(c0, f.stairLane - 0.85); c1 = Math.max(c1, f.stairLane + 0.85); } return [c0, c1]; };
  const wellHole = (f) => { const [c0, c1] = holeAcross(f); return { poly: f.poly(0, f.plan + f.landing + 1.0, c0, c1), c0, c1, alongEnd: f.plan + f.landing + 1.0 }; };
  const soffitHole = (f) => { const [c0, c1] = holeAcross(f); const alongOpen = 1.2 + (f.top.y - UNDERCROFT_Y + 2.3) / TAN30 + 0.5; return f.poly(-0.6, Math.min(f.plan, alongOpen), c0 - 0.05, c1 + 0.05); };
  // bank (a) cutting through the east wall (its top comb lies beyond the box) and bank (c)'s alcove in the west wall
  const cutting = fa && fa.top.x > BOX.xMax - 0.5 ? K.R(BOX.xMax, Math.max(IE.xMax, fa.top.x + 2.5), fa.top.z - (fa.halfWidth + 1.9), fa.top.z + (fa.halfWidth + 1.9)) : null;
  if (cutting) { cutting.yMin = IE.y; cutting.yMax = BOX.top; cutting.soffit = { y: LEVELS.dcCeiling, holes: [fa.poly(-fa.landing - 0.5, fa.plan, fa.laneMin - 0.8, fa.laneMax + 0.8)] }; }
  let alcove = null;
  if (fc) { const [c0, c1] = holeAcross(fc); const b = boundsOf(fc.poly(fc.plan - 0.6, fc.plan + fc.landing + 0.6, c0, c1)); if (b.xMin < BOX.xMin + 0.3) { alcove = K.R(Math.min(b.xMin - 0.5, BOX.xMin - 1.5), BOX.xMin, Math.max(BOX.zMin + 0.5, b.zMin - 0.5), Math.min(BOX.zMax - 0.5, b.zMax + 0.5)); alcove.yMin = IW.y; alcove.yMax = UNDERCROFT_Y; } }

  // slab outlines: listed with the slab interior on the RIGHT of travel (freeEdges relies on it); walkable rects come from subtracting holes
  const ieOuter = [{ x: IE.xMin, z: IE.zMin }, { x: BOX.xMax, z: IE.zMin }, ...(cutting ? [{ x: BOX.xMax, z: cutting.zMin }, { x: cutting.xMax, z: cutting.zMin }, { x: cutting.xMax, z: cutting.zMax }, { x: BOX.xMax, z: cutting.zMax }] : []), { x: BOX.xMax, z: IE.zMax }, { x: IE.xMin, z: IE.zMax }];
  const iwOuter = [{ x: IW.xMin, z: IW.zMin }, { x: IW.xMax, z: IW.zMin }, { x: IW.xMax, z: BOX.zMax }, { x: IW.xMax, z: IW.zMax }, { x: IW.xMin, z: IW.zMax }];
  const wellWestOuter = [{ x: STAIR.xMax, z: BOX.zMin }, { x: WW.xMax, z: BOX.zMin }, { x: WW.xMax, z: BOX.zMax }, { x: BOX.xMin, z: BOX.zMax }, { x: BOX.xMin, z: STAIR.zMax }, { x: STAIR.xMax, z: STAIR.zMax }];
  const wellEastOuter = K.rectPoly(K.R(WE.xMin, BOX.xMax, BOX.zMin, BOX.zMax));
  const fHole = ff ? wellHole(ff) : null, gHole = fg ? wellHole(fg) : null;
  const slabs = [
    { name: 'interchange-east', y: IE.y, outer: ieOuter, holes: [], floor: 'chequer', rectFloors: [K.R(IE.xMin, BOX.xMax, IE.zMin, IE.zMax), ...(cutting ? [K.R(BOX.xMax, cutting.xMax, cutting.zMin, cutting.zMax)] : [])], holeRects: [] },
    { name: 'interchange-west', y: IW.y, outer: iwOuter, holes: [K.rectPoly(stairHole), K.rectPoly(liftRect)], floor: 'chequer', rectFloors: [K.R(IW.xMin, IW.xMax, IW.zMin, IW.zMax), ...(alcove ? [K.R(alcove.xMin, BOX.xMin, alcove.zMin, alcove.zMax)] : [])], holeRects: [stairHole, liftRect] },
    { name: 'well-west-upper', y: LEVELS.jubUpper, outer: wellWestOuter, holes: [...(fHole ? [fHole.poly] : []), K.rectPoly(liftRect)], floor: 'terrazzo', rectFloors: [K.R(STAIR.xMax, WW.xMax, BOX.zMin, STAIR.zMax), K.R(BOX.xMin, WW.xMax, STAIR.zMax, BOX.zMax)], holeRects: [...(fHole ? [boundsOf(fHole.poly)] : []), liftRect] },
    { name: 'well-east-upper', y: LEVELS.jubUpper, outer: wellEastOuter, holes: gHole ? [gHole.poly] : [], floor: 'terrazzo', rectFloors: [K.R(WE.xMin, BOX.xMax, BOX.zMin, BOX.zMax)], holeRects: gHole ? [boundsOf(gHole.poly)] : [] },
    { name: 'well-west-lower', y: LEVELS.jubLower, outer: wellWestOuter, holes: [K.rectPoly(liftRect)], floor: 'terrazzo', rectFloors: [K.R(STAIR.xMax, WW.xMax, BOX.zMin, STAIR.zMax), K.R(BOX.xMin, WW.xMax, STAIR.zMax, BOX.zMax)], holeRects: [liftRect] },
    { name: 'well-east-lower', y: LEVELS.jubLower, outer: wellEastOuter, holes: [], floor: 'terrazzo', rectFloors: [K.R(WE.xMin, BOX.xMax, BOX.zMin, BOX.zMax)], holeRects: [] },
  ];
  for (const s of slabs) { s.rect = boundsOf(s.outer); s.walkRects = s.rectFloors.flatMap(r => subtractRects([r], s.holeRects)); }
  const planSlabs = [...slabs.map(s => ({ y: s.y, rect: s.rect, holes: s.holeRects })), { y: BOX.floor, rect: K.R(BOX.xMin, BOX.xMax, BOX.zMin, BOX.zMax) }, ...STAIR_LEVELS.map(y => ({ y, rect: K.R(STAIR.xMin, STAIR.xMax, STAIR.zMin, STAIR.landingZ) }))];
  const stairFrames = []; for (const f of frames) if (f.stairLane != null) stairFrames.push(makeStairFrame(f));
  const plan = {
    slabs: planSlabs,
    solids: [{ rect: stairRect, yMin: BOX.floor - 1, yMax: BOX.top + 1 }, { rect: liftRect, yMin: BOX.floor - 1, yMax: LEVELS.dcPlatform + 3 }],
    banks: [...frames, ...stairFrames],
    passages: JUBILEE.passages.map(p => ({ x: p.x, width: p.width, levels: [LEVELS.jubUpper, LEVELS.jubLower] })),
    cutting, alcove,
    dcHoleW: { zMin: -10, zMax: BOX.zMax, yMin: LEVELS.dcRail - 0.3, yMax: LEVELS.dcCeiling + 0.4 },
    dcHoleN: { xMin: -2, xMax: 39, yMin: LEVELS.dcRail - 0.3, yMax: LEVELS.dcCeiling + 0.4 },     // District structure crosses the north wall over x -1..38
    dcHoleS: { xMin: BOX.xMin + 0.5, xMax: -6.5, yMin: LEVELS.dcRail - 0.3, yMax: LEVELS.dcCeiling + 0.4 },   // ... and the south wall over x -40..-7   // District Platform 2 / its recess and stair cross the west wall at platform level
    arcade: { xMin: IW.xMin + 1.5, xMax: IW.xMax - 1.5, yMin: IW.y - 0.05, yMax: UNDERCROFT_Y },
    undercroft: { y: UNDERCROFT_Y, rect: K.R(IW.xMin, IW.xMax, IW.zMin, IW.zMax), holes: [...(fc ? [soffitHole(fc)] : []), ...(fd ? [soffitHole(fd)] : []), K.rectPoly(liftRect), K.rectPoly(stairRect)], ext: { xMin: IW.xMin, xMax: IW.xMax, zMin: BOX.zMax, zMax: IW.zMax, yMin: IW.y - SLAB_T } },
    lidHoles: [...(fa ? [boundsOf(fa.poly(-0.2, fa.plan, fa.laneMin - 0.9, fa.laneMax + 0.9))].map(r => K.R(Math.max(BOX.xMin, r.xMin), Math.min(BOX.xMax, r.xMax), r.zMin, r.zMax)) : []), stairRect],
    baseWalkway: { zMin: JUBILEE.columns.z + 3.2, zMax: JUBILEE.columns.z + 4.8 },
    baseSpur: { xMin: STAIR.xMax + 1.2, xMax: STAIR.xMax + 2.8, zMin: STAIR.landingZ - 1.0, zMax: JUBILEE.columns.z + 3.2 },
  };

  // =============================================================== 2. structure
  let structure = null;
  step('structure', () => { structure = buildStructure(ctx, group, KK, plan); });
  if (!structure) structure = { primaryX: JUBILEE.columns.x.slice(), ribX: [], columns: [], nButt: BOX.zMin + GRILLAGE.buttressD, sButt: BOX.zMax - GRILLAGE.buttressD };
  /** z of the wall surface a sign can sit on at x (buttress / rib face, else the cell back), for the north (-1) or south (+1) wall. */
  const wallZ = (x, side) => { const face = side < 0 ? BOX.zMin : BOX.zMax; let depth = 0; for (const px of structure.primaryX) if (Math.abs(x - px) < GRILLAGE.buttressW / 2) depth = GRILLAGE.buttressD; for (const rx of structure.ribX) if (Math.abs(x - rx) < GRILLAGE.ribW / 2) depth = GRILLAGE.ribD; return face - side * (depth + 0.02); };

  // =============================================================== 3. slabs: floors, soffits, edge beams, balustrades, collision
  step('slabs', () => {
    freeEdges.frames = frames; freeEdges.columns = structure.columns;
    for (const s of slabs) {
      const outer = K.ensureCCW(s.outer);
      B.add(K.polyQuad(s.y, outer, s.holes, 'up'), s.floor === 'chequer' ? mats.chequer : mats.terrazzo);
      B.add(K.polyQuad(s.y - SLAB_T, outer, s.holes, 'down'), mats.precast);
      B.add(K.bandGeo(s.outer, s.y - SLAB_T, s.y - 0.02, true, 'outward'), mats.precast);
      for (const h of s.holes) B.add(K.bandGeo(h, s.y - SLAB_T, s.y - 0.02, true, 'inward'), mats.precast);
      // downstand beams under the slab on the buttress lines (concrete), skipping the holes
      const lines = [...structure.primaryX, ...structure.ribX].filter(x => x > s.rect.xMin + 1 && x < s.rect.xMax - 1);
      for (const x of lines) for (const [z0, z1] of splitZ(x, s.rect.zMin + 0.3, s.rect.zMax - 0.3, s.holeRects)) if (z1 - z0 > 1) B.add(K.boxGeo(T, 0.55, 0.7, z1 - z0, { x, y: s.y - SLAB_T - 0.35, z: (z0 + z1) / 2 }), mats.precast);
      // stainless edge trim + the continuous light strip under every free edge; balustrades along them
      for (const e of freeEdges(s)) {
        const len = Math.hypot(e.b.x - e.a.x, e.b.z - e.a.z); const cx = (e.a.x + e.b.x) / 2, cz = (e.a.z + e.b.z) / 2; const yaw = Math.atan2(e.b.x - e.a.x, e.b.z - e.a.z);
        B.add(K.plainBox(0.08, 0.06, len, { x: cx, y: s.y + 0.02, z: cz, ry: yaw }), mats.stainless);
        B.add(K.plainBox(0.2, 0.09, Math.max(0.2, len - 0.3), { x: cx - e.n.x * 0.16, y: s.y - 0.3, z: cz - e.n.z * 0.16, ry: yaw }), mats.steelDark);
        B.add(K.plainBox(0.12, 0.05, Math.max(0.2, len - 0.4), { x: cx - e.n.x * 0.16, y: s.y - 0.36, z: cz - e.n.z * 0.16, ry: yaw }), mats.lumStrip);
        addBalustrade(ctx, B, mats, e.a, e.b, s.y, 'perf');
      }
      // expansion joints across the chequer plate every ~12 m
      if (s.floor === 'chequer') for (let x = Math.ceil(s.rect.xMin / 12) * 12; x < s.rect.xMax; x += 12) B.add(K.plainBox(0.04, 0.004, s.rect.zMax - s.rect.zMin - 0.6, { x, y: s.y + 0.004, z: (s.rect.zMin + s.rect.zMax) / 2 }), mats.darkGrey);
      for (const r of s.walkRects) collision.addFloor({ ...r, y: s.y, tag: 'box:' + s.name, sound: s.floor === 'chequer' ? 'metal' : 'hard' });
    }
    if (alcove) B.add(K.xzQuad(IW.y + 0.001, alcove.xMin, BOX.xMin + 0.02, alcove.zMin, alcove.zMax, 'up'), mats.chequer);
    // hole rims of the well openings: from where the escalator balustrades have dropped below the slab to the far end
    for (const [f, hole] of [[ff, fHole], [fg, gHole]]) { if (!f || !hole) continue; const a0 = 3.0, a1 = hole.alongEnd; const p = (al, ac) => { const w = f.world(al, ac); return { x: w.x, z: w.z }; }; addBalustrade(ctx, B, mats, p(a0, hole.c1), p(a1, hole.c1), LEVELS.jubUpper, 'perf'); addBalustrade(ctx, B, mats, p(a1, hole.c1), p(a1, hole.c0), LEVELS.jubUpper, 'perf'); addBalustrade(ctx, B, mats, p(a1, hole.c0), p(a0, hole.c0), LEVELS.jubUpper, 'perf'); }
    // the base slab and its walkway are walkable too (staff only, but the emergency stair leads there)
    collision.addFloor({ xMin: BOX.xMin, xMax: BOX.xMax, zMin: BOX.zMin, zMax: BOX.zMax, y: BOX.floor, tag: 'box:base', sound: 'hard' });
    collision.addFloor({ xMin: BOX.xMin + 1.5, xMax: BOX.xMax - 1.5, zMin: plan.baseWalkway.zMin, zMax: plan.baseWalkway.zMax, y: BOX.floor + 0.23, tag: 'box:baseWalkway', sound: 'metal' });
    collision.addFloor({ ...plan.baseSpur, y: BOX.floor + 0.23, tag: 'box:baseSpur', sound: 'metal' });
    // box walls (thick blockers), grillage verticals, columns, cutting / alcove / extension walls
    const wallT = BOX.wallThickness;
    collision.addBlocker({ xMin: BOX.xMin - wallT, xMax: BOX.xMax + wallT, yMin: BOX.floor - 1, yMax: BOX.top - 0.05, zMin: BOX.zMin - wallT, zMax: BOX.zMin }, 'box:wallN');
    for (const [x0, x1] of splitWall(BOX.xMin, BOX.xMax)) collision.addBlocker({ xMin: x0, xMax: x1, yMin: BOX.floor - 1, yMax: BOX.top - 0.05, zMin: BOX.zMax, zMax: BOX.zMax + wallT }, 'box:wallS');
    collision.addBlocker({ xMin: IW.xMin + 1.5, xMax: IW.xMax - 1.5, yMin: BOX.floor - 1, yMax: IW.y - 0.05, zMin: BOX.zMax, zMax: BOX.zMax + wallT }, 'box:wallS');
    collision.addBlocker({ xMin: IW.xMin + 1.5, xMax: IW.xMax - 1.5, yMin: UNDERCROFT_Y, yMax: BOX.top - 0.05, zMin: BOX.zMax, zMax: BOX.zMax + wallT }, 'box:wallS');
    for (const y of [LEVELS.jubUpper, LEVELS.jubLower]) for (const p of JUBILEE.passages) { collision.addBlocker({ xMin: p.x - p.width / 2, xMax: p.x + p.width / 2, yMin: y + 3.0, yMax: y + 6, zMin: BOX.zMax - 0.1, zMax: BOX.zMax + wallT }, 'box:passageLintel'); collision.addBlocker({ xMin: p.x - p.width / 2, xMax: p.x + p.width / 2, yMin: BOX.floor - 1, yMax: y - 0.05, zMin: BOX.zMax - 0.1, zMax: BOX.zMax + wallT }, 'box:passageSill'); }
    collision.addBlocker({ xMin: BOX.xMax, xMax: BOX.xMax + wallT, yMin: BOX.floor - 1, yMax: BOX.top - 0.05, zMin: BOX.zMin, zMax: cutting ? cutting.zMin : BOX.zMax }, 'box:wallE');
    if (cutting) { collision.addBlocker({ xMin: BOX.xMax, xMax: BOX.xMax + wallT, yMin: BOX.floor - 1, yMax: cutting.yMin - 0.01, zMin: cutting.zMin, zMax: cutting.zMax }, 'box:wallE'); collision.addBlocker({ xMin: BOX.xMax, xMax: BOX.xMax + wallT, yMin: BOX.floor - 1, yMax: BOX.top - 0.05, zMin: cutting.zMax, zMax: BOX.zMax }, 'box:wallE'); for (const [za, zb] of [[cutting.zMin - 0.4, cutting.zMin], [cutting.zMax, cutting.zMax + 0.4]]) collision.addBlocker({ xMin: BOX.xMax, xMax: cutting.xMax + 0.4, yMin: cutting.yMin, yMax: cutting.yMax + 1, zMin: za, zMax: zb }, 'box:cuttingWall'); collision.addBlocker({ xMin: cutting.xMax, xMax: cutting.xMax + 0.4, yMin: cutting.yMin, yMax: cutting.yMax - 1.2, zMin: cutting.zMin, zMax: cutting.zMax }, 'box:cuttingEnd'); }
    collision.addBlocker({ xMin: BOX.xMin - wallT, xMax: BOX.xMin, yMin: BOX.floor - 1, yMax: BOX.top - 0.05, zMin: BOX.zMin, zMax: alcove ? alcove.zMin : BOX.zMax }, 'box:wallW');
    if (alcove) { collision.addBlocker({ xMin: BOX.xMin - wallT, xMax: BOX.xMin, yMin: BOX.floor - 1, yMax: alcove.yMin - 0.01, zMin: alcove.zMin, zMax: alcove.zMax }, 'box:wallW'); collision.addBlocker({ xMin: BOX.xMin - wallT, xMax: BOX.xMin, yMin: alcove.yMax, yMax: BOX.top - 0.05, zMin: alcove.zMin, zMax: alcove.zMax }, 'box:wallW'); collision.addBlocker({ xMin: BOX.xMin - wallT, xMax: BOX.xMin, yMin: BOX.floor - 1, yMax: BOX.top - 0.05, zMin: alcove.zMax, zMax: BOX.zMax }, 'box:wallW'); collision.addBlocker({ xMin: alcove.xMin - 0.4, xMax: alcove.xMin, yMin: alcove.yMin, yMax: alcove.yMax, zMin: alcove.zMin, zMax: alcove.zMax }, 'box:alcoveBack'); for (const [za, zb] of [[alcove.zMin - 0.4, alcove.zMin], [alcove.zMax, alcove.zMax + 0.4]]) collision.addBlocker({ xMin: alcove.xMin - 0.4, xMax: BOX.xMin, yMin: alcove.yMin, yMax: alcove.yMax, zMin: za, zMax: zb }, 'box:alcoveWall'); }
    { // pierce the west wall's collision at District level where the platforms cross it
      const hole = { zMin: -10, zMax: BOX.zMax, yMin: LEVELS.dcRail - 0.3, yMax: LEVELS.dcCeiling + 0.4 };
      for (const b of collision.blockers.filter(b => b.userData && b.userData.tag === 'box:wallW' && b.max.z > hole.zMin && b.min.y < hole.yMax && b.max.y > hole.yMin)) {
        collision.remove(b); const x0 = b.min.x, x1 = b.max.x, z0 = b.min.z, z1 = b.max.z, y0 = b.min.y, y1 = b.max.y;
        if (z0 < hole.zMin) collision.addBlocker({ xMin: x0, xMax: x1, yMin: y0, yMax: y1, zMin: z0, zMax: hole.zMin }, 'box:wallW');
        if (y0 < hole.yMin) collision.addBlocker({ xMin: x0, xMax: x1, yMin: y0, yMax: hole.yMin, zMin: Math.max(z0, hole.zMin), zMax: z1 }, 'box:wallW');
        if (y1 > hole.yMax) collision.addBlocker({ xMin: x0, xMax: x1, yMin: hole.yMax, yMax: y1, zMin: Math.max(z0, hole.zMin), zMax: z1 }, 'box:wallW');
      }
    }
    collision.addBlocker({ xMin: IW.xMax, xMax: IW.xMax + 0.6, yMin: IW.y - 1, yMax: UNDERCROFT_Y + 1, zMin: BOX.zMax, zMax: IW.zMax + 0.6 }, 'box:extE');
    collision.addBlocker({ xMin: IW.xMin - 0.6, xMax: IW.xMax + 0.6, yMin: IW.y - 1, yMax: UNDERCROFT_Y + 1, zMin: IW.zMax, zMax: IW.zMax + 0.6 }, 'box:extS');
    collision.addBlocker({ xMin: IW.xMin - 0.6, xMax: IW.xMin, yMin: IW.y - 1, yMax: UNDERCROFT_Y + 1, zMin: BOX.zMax, zMax: IW.zMax }, 'box:extW');
    for (const side of [-1, 1]) { const zf = side < 0 ? BOX.zMin : BOX.zMax; for (const x of structure.primaryX) collision.addBlocker({ xMin: x - GRILLAGE.buttressW / 2, xMax: x + GRILLAGE.buttressW / 2, yMin: BOX.floor - 1, yMax: BOX.top, zMin: side < 0 ? zf : zf - GRILLAGE.buttressD, zMax: side < 0 ? zf + GRILLAGE.buttressD : zf }, 'box:buttress'); for (const x of structure.ribX) collision.addBlocker({ xMin: x - GRILLAGE.ribW / 2, xMax: x + GRILLAGE.ribW / 2, yMin: BOX.floor - 1, yMax: BOX.top, zMin: side < 0 ? zf : zf - GRILLAGE.ribD, zMax: side < 0 ? zf + GRILLAGE.ribD : zf }, 'box:rib'); }
    for (const c of structure.columns) collision.addBlocker({ xMin: c.x - c.r * 0.92, xMax: c.x + c.r * 0.92, yMin: BOX.floor - 1, yMax: BOX.top, zMin: JUBILEE.columns.z - c.r * 0.92, zMax: JUBILEE.columns.z + c.r * 0.92 }, 'box:column');
  });

  // =============================================================== 4. escalators (all seven banks), cladding, under-truss blockers, newel signs
  step('escalators', () => {
    for (const f of frames) {
      const e = f.def;
      const esc = createEscalator(ctx, { top: e.top, bottom: e.bottom, dir: e.dir, lanes: e.lanes, name: 'esc-' + e.name, landing: f.landing });
      ctx.scene.remove(esc.group);
      const eb = F.createBatcher(); eb.bakeGroup(group, esc.group); eb.flush(group, { name: 'escalator-' + e.name });
      ctx.register('escalator:' + e.name, esc); result.escalators[e.name] = esc; f.esc = esc;
      // aluminium cladding around the truss: soffit and sides between exposed ribs, along the incline
      const a0 = 0.9, a1 = f.plan - 0.9; const hw = f.halfWidth + 0.5;
      B.add(K.frameRibbon(f, f.centreLane, -1.06, 0, a0, a1, { horizontal: true, width: hw * 2, flip: false }), mats.clad);
      B.add(K.frameRibbon(f, f.centreLane - hw, -1.06, 1.4, a0, a1, { flip: true }), mats.clad);
      B.add(K.frameRibbon(f, f.centreLane + hw, -1.06, 1.4, a0, a1, { flip: false }), mats.clad);
      for (let al = a0 + 0.4; al < a1; al += 1.6) { const y = f.yAt(al); const p0 = f.world(al, f.centreLane - hw - 0.02), p1 = f.world(al, f.centreLane + hw + 0.02); B.add(K.tubeGeo([p0.x, y - 1.1, p0.z], [p1.x, y - 1.1, p1.z], 0.045, 8), mats.cladRib); B.add(K.tubeGeo([p0.x, y - 1.1, p0.z], [p0.x, y + 0.34, p0.z], 0.04, 8), mats.cladRib); B.add(K.tubeGeo([p1.x, y - 1.1, p1.z], [p1.x, y + 0.34, p1.z], 0.04, 8), mats.cladRib); }
      // linear battens under the soffit (the fluorescent battens fixed to the support frames)
      for (let al = a0 + 2; al < a1 - 1; al += 4.5) { const y = f.yAt(al); const p = f.world(al, f.centreLane); B.add(K.plainBox(0.09, 0.05, 1.3, { x: p.x, y: y - 1.12, z: p.z, ry: f.yaw }), mats.lum); }
      // blockers where the truss is too low to walk under (over a slab)
      for (let al = 0; al < f.plan; al += 1) { const c = f.world(al + 0.5, f.centreLane); const soff = f.yAt(al + 0.5) - 1.06; const slab = slabYAt(planSlabs, c.x, c.z, soff); if (slab == null) continue; if (soff > slab + 0.1 && soff < slab + 2.15) { const r = boundsOf(f.poly(al, al + 1, f.centreLane - hw, f.centreLane + hw)); collision.addBlocker({ ...r, yMin: slab, yMax: soff + 0.3 }, 'box:underEscalator'); } }
      // newel signage (dossier §12.7): 'Stand on the right' + companions, emergency-stop button; skirt notice mid-run
      for (const [al, sgn] of [[-f.landing - 0.2, 1], [f.plan + f.landing + 0.2, -1]]) {
        const y = f.yAt(al) + 1.15; const facing = sgn > 0 ? f.yaw + Math.PI : f.yaw;
        for (let i = 0; i < f.lanes.length; i++) { const lane = f.lanes[i]; const side = i === 0 ? -0.66 : 0.66; const p = f.world(al, lane + side); const tex = i % 2 === 0 ? signs.standRight() : (sgn > 0 ? signs.holdHandrail() : signs.dogsCarried()); F.addWallSign(ctx, group, { x: p.x, y, z: p.z, facing, texture: tex, w: 0.22, h: 0.3, depth: 0.02, batch, backColor: 0x0019a8 }); }
        const pStop = f.world(al + sgn * 0.3, f.laneMax + 0.66); F.addWallSign(ctx, group, { x: pStop.x, y: y - 0.36, z: pStop.z, facing, texture: signs.emergencyStop(), w: 0.16, h: 0.1, depth: 0.02, batch, backColor: 0x111111 });
        const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.035, 14), mats.red); btn.position.copy(pStop).add(new THREE.Vector3(Math.sin(facing) * 0.04, -0.36 + 0.09, Math.cos(facing) * 0.04)); btn.rotation.x = Math.PI / 2; btn.rotation.z = facing; batch.bakeGroup(group, wrap(btn));
      }
      { const al = f.plan * 0.45; const p = f.world(al, f.laneMin - 0.5); F.addWallSign(ctx, group, { x: p.x, y: f.yAt(al) + 0.2, z: p.z, facing: f.yaw - Math.PI / 2, texture: signs.feetAway(), w: 0.36, h: 0.11, depth: 0.005, batch, backColor: 0xffd300 }); }
      if (f.stairLane != null) step('stair-' + f.name, () => { result.stairs[f.name] = buildSideStair(ctx, group, B, mats, batch, f, signs); });
    }
  });

  // =============================================================== 5. the emergency stair down the west side
  step('emergencyStair', () => buildEmergencyStair(ctx, group, B, mats, batch, signs));

  // =============================================================== 6. the deep lift (DC / JE / JW)
  step('lift', () => { result.lift = buildDeepLift(ctx, group, B, mats, batch, signs, liftRect); });

  // =============================================================== 7. signage, dot-matrix summaries
  step('signage', () => {
    const hang = (x, y, z, facing, tex, back, w, h, drop) => F.addSuspendedSign(ctx, group, { x, y, z, facing, texture: tex, backTexture: back || tex, w, h, depth: 0.1, drop, batch, boxColor: 0x101113 });
    const hangAt = (x, floorY, z, facing, tex, back, w, h, from) => hang(x, from, z, facing, tex, back, w, h, Math.max(0.15, from - (floorY + SIGN_UNDERSIDE) - h));
    const gantry = (x, floorY, z, facing, tex, back, w, h) => { const yaw = F.facingYaw(facing); const dx = Math.cos(yaw), dz = -Math.sin(yaw); const top = floorY + SIGN_UNDERSIDE + h + 0.35; for (const s of [-1, 1]) B.add(K.tubeGeo([x + s * dx * (w / 2 + 0.25), floorY, z + s * dz * (w / 2 + 0.25)], [x + s * dx * (w / 2 + 0.25), floorY + top - floorY, z + s * dz * (w / 2 + 0.25)], 0.035, 10), mats.stainless); B.add(K.tubeGeo([x - dx * (w / 2 + 0.25), top, z - dz * (w / 2 + 0.25)], [x + dx * (w / 2 + 0.25), top, z + dz * (w / 2 + 0.25)], 0.03, 10), mats.stainless); for (const s of [-1, 1]) { const px = x + s * dx * (w / 2 + 0.25), pz = z + s * dz * (w / 2 + 0.25); B.add(K.plainBox(0.24, 0.02, 0.24, { x: px, y: floorY + 0.01, z: pz }), mats.stainless); ctx.collision.addBlocker({ xMin: px - 0.12, xMax: px + 0.12, yMin: floorY, yMax: floorY + 2.2, zMin: pz - 0.12, zMax: pz + 0.12 }, 'box:gantryPost'); } hang(x, top, z, facing, tex, back, w, h, 0.2); };
    // interchange EAST: foot of (a) → both platforms via (b); head of (b) → Way out / District and Circle via (a)
    if (fa && fb) {
      const lid = BOX.top - 0.95;
      const pa = fa.world(fa.plan + 3.5, fa.centreLane); hangAt(pa.x, IE.y, pa.z, 'east', signs.jubileeBoth('downleft'), signs.wayOut('up', 'District and Circle lines'), 3.0, 0.95, lid);
      const pb = fb.world(-fb.landing - 2.2, fb.centreLane); hangAt(pb.x + 0.6, IE.y, pb.z, 'east', signs.jubileeBoth('down'), signs.wayOut('up', 'District and Circle lines'), 3.0, 0.95, lid);
      hangAt((pa.x + pb.x) / 2, IE.y, (pa.z + pb.z) / 2 + 2.5, 'east', signs.jubileeBoth('downleft'), signs.districtCircle('up'), 3.0, 0.95, lid);
      result.indicatorEast = addSummaryIndicator(ctx, group, batch, 'indicator:box-east', pb.x + 1.6, IE.y + 2.35, pb.z - 3.4, 'east', lid);
      addPlaque(ctx, group, batch, signs, IE.xMin + 6, IE.y, wallZ(IE.xMin + 6, 1), 'north');
    }
    // interchange WEST: feet of (c) and (d) → platforms via (e); head of (e) → Way out / District and Circle via (c)/(d)
    if (fe) {
      const soff = UNDERCROFT_Y - 0.02;
      const pe = fe.world(-fe.landing - 2.0, fe.centreLane);
      hangAt(pe.x, IW.y, pe.z, 'west', signs.jubileeBoth('down'), signs.wayOut('up', 'District and Circle lines'), 3.0, 0.95, soff);
      hangAt(pe.x - 10, IW.y, pe.z, 'west', signs.jubileeBoth('up'), signs.districtCircle('up'), 3.0, 0.95, soff);
      hangAt(pe.x - 10, IW.y, pe.z + 9, 'south', signs.jubileeBoth('upright'), signs.districtCircle('downleft'), 3.0, 0.95, soff);
      if (fc) { const pc = fc.world(fc.plan + 2.6, fc.centreLane); hangAt(pc.x + 3, IW.y, pc.z + 0.5, fc.yaw + Math.PI, signs.jubileeBoth('upright'), signs.districtCircle('up'), 3.0, 0.95, soff); }
      if (fd) { const pd = fd.world(fd.plan + 2.6, fd.centreLane); hangAt(pd.x - 2, IW.y, pd.z - 2, fd.yaw + Math.PI, signs.jubileeBoth('up'), signs.districtCircle('up'), 3.0, 0.95, soff); }
      result.indicatorWest = addSummaryIndicator(ctx, group, batch, 'indicator:box-west', pe.x - 1.6, IW.y + 2.35, pe.z + 3.2, 'west', soff);
    }
    // wells: over each passage mouth the platform identity (on the wall above the lintel); at the feet of (b)/(e) gantry signs
    const pWest = JUBILEE.passages.find(p => p.x < 0), pEast = JUBILEE.passages.find(p => p.x > 0);
    for (const [lvlName, y, which] of [['upper', LEVELS.jubUpper, 'upper'], ['lower', LEVELS.jubLower, 'lower']]) {
      for (const p of [pWest, pEast]) if (p) {
        F.addWallSign(ctx, group, { x: p.x, y: y + 3.55, z: BOX.zMax - 0.03, facing: 'north', texture: signs.jubileeDir(which, 'up'), w: 2.6, h: 0.65, depth: 0.05, batch, backColor: 0x101113 });
        F.addWallSign(ctx, group, { x: p.x + p.width / 2 + 0.7, y: y + 2.2, z: BOX.zMax - 0.03, facing: 'north', texture: signs.platformTab(which === 'upper' ? JUBILEE.upper.number : JUBILEE.lower.number), w: 0.9, h: 0.22, depth: 0.02, batch, backColor: 0x000000 });
        F.addWallSign(ctx, group, { x: p.x - p.width / 2 - 0.7, y: y + 2.2, z: BOX.zMax - 0.03, facing: 'north', texture: signs.wayOut('down', null, { width: 1024, height: 288 }), w: 0.9, h: 0.25, depth: 0.02, batch, backColor: 0x101113 });
      }
      if (lvlName === 'upper' && fb && pWest) { const pb = fb.world(fb.plan + 1.5, fb.centreLane); gantry(pb.x - 3.0, y, pb.z + 3.8, 'east', signs.jubileeDir('upper', 'left'), signs.jubileeDir('upper', 'right'), 2.6, 0.7); if (ff) { const pf = ff.world(-ff.landing - 0.3, ff.centreLane); gantry(pf.x + 2.6, y, pf.z - 3.0, 'east', signs.jubileeDir('lower', 'down'), signs.wayOut('up', 'District and Circle lines'), 2.6, 0.7); } }
      if (lvlName === 'upper' && fe && pEast) { const pe = fe.world(fe.plan + 1.5, fe.centreLane); gantry(pe.x + 3.0, y, pe.z + 3.8, 'west', signs.jubileeDir('upper', 'right'), signs.jubileeDir('upper', 'left'), 2.6, 0.7); if (fg) { const pg = fg.world(-fg.landing - 0.3, fg.centreLane); gantry(pg.x - 2.6, y, pg.z - 3.0, 'west', signs.jubileeDir('lower', 'down'), signs.wayOut('up', 'District and Circle lines'), 2.6, 0.7); } }
      if (lvlName === 'lower') { const soffit = LEVELS.jubUpper - SLAB_T - 0.02; for (const [f, p] of [[ff, pWest], [fg, pEast]]) if (f && p) { const pf = f.world(f.plan + 3.2, f.centreLane); hangAt(pf.x, y, pf.z + 0.2, f.yaw + Math.PI, signs.jubileeDir('lower', p.x < pf.x ? 'left' : 'right'), signs.wayOut('up'), 2.6, 0.7, soffit); } }
    }
    // CCTV notices, fire action, 'See it. Say it. Sorted.', no smoking, 4-sheet posters on the walls
    const wallSigns = [[IE.xMin + 3.2, IE.y, -1], [IW.xMax - 4, IW.y, -1], [WW.xMax - 6, LEVELS.jubUpper, -1], [WE.xMin + 6, LEVELS.jubUpper, -1], [WW.xMax - 6, LEVELS.jubLower, -1], [WE.xMin + 6, LEVELS.jubLower, -1]];
    wallSigns.forEach(([x, y, side], i) => { const facing = side < 0 ? 'south' : 'north'; F.addWallSign(ctx, group, { x, y: y + 2.3, z: wallZ(x, side), facing, texture: signs.cctv(), w: 0.5, h: 0.25, depth: 0.02, batch }); F.addWallSign(ctx, group, { x: x + 0.9, y: y + 1.5, z: wallZ(x + 0.9, side), facing, texture: signs.fireAction(), w: 0.3, h: 0.375, depth: 0.01, batch, backColor: 0x0019a8 }); if (i % 2 === 0) F.addWallSign(ctx, group, { x: x + 1.9, y: y + 1.85, z: wallZ(x + 1.9, side), facing, texture: signs.seeItSayIt(), w: 1.0, h: 0.5, depth: 0.02, batch, backColor: 0x0019a8 }); });
    for (const [x, y, z, facing, seed] of [[BOX.xMax - 0.02, IE.y, BOX.zMin + 6.5, 'west', 3], [BOX.xMax - 0.02, IE.y, BOX.zMin + 12, 'west', 4], [BOX.xMax - 0.02, LEVELS.jubUpper, BOX.zMin + 9, 'west', 5], [BOX.xMax - 0.02, LEVELS.jubLower, BOX.zMin + 9, 'west', 6], [IW.xMax - 0.02, IW.y, BOX.zMax + 5, 'west', 7], [IW.xMax - 0.02, IW.y, BOX.zMax + 9, 'west', 8]]) F.addPosterFrame(ctx, group, { x, y, z, facing, seed, batch });
    F.addWallSign(ctx, group, { x: BOX.xMax - 0.02, y: IE.y + 2.0, z: BOX.zMin + 3.2, facing: 'west', texture: signs.noSmoking(), w: 0.3, h: 0.225, depth: 0.01, batch, backColor: 0xffffff });
    // 'WESTMINSTER' roundel boards (stainless-framed) on the end walls of the interchange levels and on a rib face in each well
    F.addRoundelBoard(ctx, group, { x: BOX.xMax - 0.02, y: IE.y, z: BOX.zMin + 16, facing: 'west', frame: true, batch });
    F.addRoundelBoard(ctx, group, { x: IW.xMax - 0.02, y: IW.y, z: BOX.zMax + 12.5, facing: 'west', frame: true, batch });
    for (const y of [LEVELS.jubUpper, LEVELS.jubLower]) for (const x of [WW.xMax - 10, WE.xMin + 10]) F.addRoundelBoard(ctx, group, { x, y, z: wallZ(x, -1), facing: 'south', frame: true, batch });
  });

  // =============================================================== 8. furniture
  step('furniture', () => {
    const colZ = JUBILEE.columns.z;
    const landings = [
      { y: IE.y, cols: structure.columns.filter(c => c.x > IE.xMin + 0.5 && c.x < IE.xMax), bins: [[IE.xMin + 4, BOX.zMax - 6.5], [BOX.xMax - 6, BOX.zMin + 7]], soffit: BOX.top - 0.05, rect: K.R(IE.xMin, BOX.xMax, IE.zMin, IE.zMax) },
      { y: IW.y, cols: structure.columns.filter(c => c.x > IW.xMin && c.x < IW.xMax - 0.5), bins: [[IW.xMin + 6, BOX.zMax - 5.5], [IW.xMax - 6, BOX.zMin + 7], [IW.xMax - 4, BOX.zMax + 7]], soffit: UNDERCROFT_Y - 0.02, rect: K.R(IW.xMin, IW.xMax, IW.zMin, IW.zMax) },
      { y: LEVELS.jubUpper, cols: structure.columns.filter(c => (c.x > WW.xMin && c.x < WW.xMax - 0.5) || (c.x > WE.xMin + 0.5 && c.x < WE.xMax)), bins: [[WW.xMin + 6, BOX.zMax - 5.5], [WE.xMax - 6, BOX.zMax - 5.5]], soffit: null, rect: null },
      { y: LEVELS.jubLower, cols: structure.columns.filter(c => (c.x > WW.xMin && c.x < WW.xMax - 0.5) || (c.x > WE.xMin + 0.5 && c.x < WE.xMax)), bins: [[WW.xMin + 6, BOX.zMax - 5.5], [WE.xMax - 6, BOX.zMax - 5.5]], soffit: LEVELS.jubUpper - SLAB_T - 0.02, rect: null },
    ];
    for (const L of landings) {
      for (const [x, z] of L.bins) addBin(ctx, group, batch, mats, x, L.y, z);
      L.cols.forEach((c, i) => {
        const face = c.x < 0 ? 1 : -1;   // help points face towards the void
        F.addHelpPoint(ctx, group, { x: c.x + face * (c.r + 0.02), y: L.y, z: colZ, facing: face > 0 ? 'east' : 'west', batch });
        const sp = F.addSpeaker(ctx, group, { x: c.x, y: L.y + 3.1, z: colZ + (i % 2 ? 1 : -1) * (c.r + 0.02), facing: i % 2 ? 'south' : 'north', mount: 'wall', batch }); result.speakers.push(sp.position);
        F.addCCTV(ctx, group, { x: c.x - face * (c.r + 0.02), y: L.y + 3.3, z: colZ, facing: face > 0 ? 'west' : 'east', mount: 'wall', batch });
        const num = structure.primaryX.indexOf(c.x) + 1; if (num > 0) F.addWallSign(ctx, group, { x: c.x, y: L.y + 2.0, z: colZ - (c.r + 0.02), facing: 'north', texture: signs.columnNumber(num), w: 0.22, h: 0.22, depth: 0.01, batch, backColor: 0xf1f1ee });
      });
      if (L.soffit != null && L.rect) for (const x of [L.rect.xMin + 5, (L.rect.xMin + L.rect.xMax) / 2, L.rect.xMax - 5]) F.addCCTV(ctx, group, { x, y: L.soffit, z: colZ + 6, mount: 'ceiling', batch });
    }
    // fire points by the emergency stair landings, next to the passages and on the east wall
    for (const y of [IW.y, LEVELS.jubUpper, LEVELS.jubLower, BOX.floor]) F.addFireEquipment(ctx, group, { x: STAIR.xMax + 0.6, y, z: wallZ(STAIR.xMax + 0.6, -1), facing: 'south', batch });
    for (const y of [LEVELS.jubUpper, LEVELS.jubLower]) for (const p of JUBILEE.passages) { const x = p.x - p.width / 2 - 1.3; F.addFireEquipment(ctx, group, { x, y, z: wallZ(x, 1), facing: 'north', batch }); }
    F.addFireEquipment(ctx, group, { x: BOX.xMax - 0.02, y: IE.y, z: BOX.zMax - 5, facing: 'west', batch });
    // cable trays and the sprinkler main under every slab soffit along the north wall; vertical risers on the end walls
    for (const s of slabs) { const y = s.y - SLAB_T - 0.25; const r = s.rect; const x0 = Math.max(r.xMin, BOX.xMin) + 1.5, x1 = Math.min(r.xMax, BOX.xMax) - 1.5; B.add(K.plainBox(x1 - x0, 0.08, 0.3, { x: (x0 + x1) / 2, y, z: BOX.zMin + GRILLAGE.buttressD + 0.6 }), mats.galv); B.add(K.plainBox(x1 - x0, 0.05, 0.24, { x: (x0 + x1) / 2, y: y + 0.02, z: BOX.zMin + GRILLAGE.buttressD + 0.6 }), mats.cable); B.add(K.tubeGeo([x0, y - 0.2, BOX.zMin + GRILLAGE.buttressD + 1.1], [x1, y - 0.2, BOX.zMin + GRILLAGE.buttressD + 1.1], 0.06, 10), mats.pipeRed); }
    for (const x of [BOX.xMin + 0.45, BOX.xMax - 0.45]) { B.add(K.plainBox(0.4, BOX.top - BOX.floor - 1, 0.12, { x, y: (BOX.top + BOX.floor) / 2, z: BOX.zMin + 4.5 }), mats.galv); B.add(K.plainBox(0.34, BOX.top - BOX.floor - 1, 0.1, { x, y: (BOX.top + BOX.floor) / 2, z: BOX.zMin + 4.5 }), mats.cable); B.add(K.tubeGeo([x, BOX.floor + 0.5, BOX.zMin + 5.2], [x, BOX.top - 0.5, BOX.zMin + 5.2], 0.07, 10), mats.pipeRed); }
    F.addWallSign(ctx, group, { x: STAIR.xMax + 0.02, y: BOX.floor + 1.6, z: STAIR.landingZ - 1.3, facing: 'east', texture: signs.maintenance(), w: 0.6, h: 0.3, depth: 0.02, batch, backColor: 0xffd300 });
  });

  // =============================================================== 9. lighting: 12 real lights, ambient, emissive battens (merged)
  step('lighting', () => {
    group.add(new THREE.AmbientLight(0x8890a0, 0.35));
    const colZ = JUBILEE.columns.z;
    const pts = [
      [fa ? fa.bottom.x - 3 : IE.xMax - 12, IE.y + 3.2, fa ? fa.bottom.z : -8, 0xf2f1ea, 38, 26],
      [fb ? fb.top.x + 3 : IE.xMin + 3, IE.y + 3.4, fb ? fb.top.z + 1 : -22, 0xf2f1ea, 38, 26],
      [fe ? fe.top.x - 3 : IW.xMax - 3, IW.y + 3.2, fe ? fe.top.z : -8, 0xf2f1ea, 38, 26],
      [fc ? fc.bottom.x + 3 : IW.xMin + 6, IW.y + 3.2, fc ? fc.bottom.z - 1 : -10, 0xf2f1ea, 34, 24],
      [fd ? fd.bottom.x + 2 : IW.xMin + 10, IW.y + 3.2, fd ? fd.bottom.z - 3 : 8, 0xf2f1ea, 32, 22],
      [(JUBILEE.voidX.min + JUBILEE.voidX.max) / 2, IW.y - 2.5, colZ - 6, 0xe9eef8, 70, 34],
      [(JUBILEE.voidX.min + JUBILEE.voidX.max) / 2, LEVELS.jubUpper - 4, colZ + 5, 0xe9eef8, 70, 34],
      [(WW.xMin + WW.xMax) / 2, LEVELS.jubUpper + 4.2, colZ, 0xf2f1ea, 30, 28],
      [(WE.xMin + WE.xMax) / 2, LEVELS.jubUpper + 4.2, colZ, 0xf2f1ea, 30, 28],
      [(WW.xMin + WW.xMax) / 2, LEVELS.jubLower + 4.0, colZ, 0xf2f1ea, 28, 26],
      [(WE.xMin + WE.xMax) / 2, LEVELS.jubLower + 4.0, colZ, 0xf2f1ea, 28, 26],
      [0, BOX.floor + 3.5, colZ + 4, 0xe4e8ee, 30, 30],
    ];
    for (const [x, y, z, color, intensity, distance] of pts) { const l = ctx.lights.point(group, { x, y, z, color, intensity, distance, decay: 2 }); if (l) result.lights.push(l); }
    // battens (merged emissive tubes) between the beam lines under the slab soffits, the lid over the east section, the undercroft
    const lines = [...structure.primaryX, ...structure.ribX].sort((a, b) => a - b); const mids = []; for (let i = 0; i < lines.length - 1; i++) mids.push((lines[i] + lines[i + 1]) / 2);
    const rows = (rect, y, zs) => { for (const x of mids) { if (x < rect.xMin + 1 || x > rect.xMax - 1) continue; for (const z of zs) { if (z < rect.zMin + 1 || z > rect.zMax - 1) continue; const b = K.battenGeos(x, y, z, 'z', 1.5); B.add(b.tube, mats.lum); B.add(b.housing, mats.white); } } };
    rows(K.R(IE.xMin, BOX.xMax, IE.zMin, IE.zMax), BOX.top - 1.0, [colZ - 9, colZ - 3, colZ + 3, colZ + 9]);
    rows(K.R(IW.xMin, IW.xMax, IW.zMin, IW.zMax), UNDERCROFT_Y - 0.9, [colZ - 9, colZ - 3, colZ + 3, colZ + 9, BOX.zMax + 5, BOX.zMax + 12]);
    rows(K.R(WW.xMin, WW.xMax, BOX.zMin, BOX.zMax), IW.y - SLAB_T - 0.15, [colZ - 8, colZ + 8]);
    rows(K.R(WE.xMin, WE.xMax, BOX.zMin, BOX.zMax), IE.y - SLAB_T - 0.15, [colZ - 8, colZ + 8]);
    for (const wx of [K.R(WW.xMin, WW.xMax, BOX.zMin, BOX.zMax), K.R(WE.xMin, WE.xMax, BOX.zMin, BOX.zMax)]) rows(wx, LEVELS.jubUpper - SLAB_T - 0.15, [colZ - 8, colZ + 8]);
    for (let x = BOX.xMin + 6; x < BOX.xMax - 3; x += 12) { const b = K.battenGeos(x, BOX.floor + 3.2, plan.baseWalkway.zMax + 0.6, 'x', 1.2); B.add(b.tube, mats.lum); B.add(b.housing, mats.white); }
  });

  // =============================================================== 10. audio
  step('audio', () => {
    if (!audio || !audio.emitter) return;
    if (audio.registerSynth && !audio.synths.has('box:liftChime')) audio.registerSynth('box:liftChime', (c) => { const out = c.createGain(); out.gain.value = 0.5; const t0 = c.currentTime; [[880, 0], [1174.7, 0.22]].forEach(([f, dt]) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = c.createGain(); g.gain.setValueAtTime(0, t0 + dt); g.gain.linearRampToValueAtTime(0.5, t0 + dt + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t0 + dt + 0.6); o.connect(g); g.connect(out); o.start(t0 + dt); o.stop(t0 + dt + 0.7); }); return { output: out, duration: 1.0, start() {}, stop() {} }; });
    const em = (o) => { const e = audio.emitter(o); result.emitters.push(e); return e; };
    for (const x of [-22, 22]) em({ position: new THREE.Vector3(x, LEVELS.jubUpper - 3, BOX.zMin + 1), synth: 'tunnelAir', params: { level: 0.32 }, gain: 0.45, refDistance: 6, maxDistance: 45 });
    em({ position: new THREE.Vector3(0, BOX.floor + 6, JUBILEE.columns.z), synth: 'tunnelAir', params: { level: 0.25 }, gain: 0.35, refDistance: 8, maxDistance: 50 });
    em({ position: new THREE.Vector3(LIFT.x, UNDERCROFT_Y + 0.5, LIFT.z), synth: 'hum', params: { freq: 90, level: 0.2 }, gain: 0.3, refDistance: 3, maxDistance: 22 });
    em({ position: new THREE.Vector3(BOX.xMin + 4.5, BOX.floor + 0.8, BOX.zMin + 3.7), synth: 'hum', params: { freq: 50, level: 0.3 }, gain: 0.35, refDistance: 3, maxDistance: 20 });
    ctx.register('speakers:box', result.speakers);
  });

  // =============================================================== 11. nav graph and spawn points
  step('nav', () => {
    const nodes = [], edges = []; const N = (id, x, y, z, tags) => { nodes.push({ id, x, y, z, tags }); return id; }; const E = (a, b, o) => edges.push(o ? [a, b, o] : [a, b]);
    const pWest = JUBILEE.passages.find(p => p.x < 0) || { x: -20 }, pEast = JUBILEE.passages.find(p => p.x > 0) || { x: 20 };
    const colZ = JUBILEE.columns.z;
    if (fa) { N('a-top', fa.world(-fa.landing - 1.6, fa.centreLane).x, fa.top.y, fa.top.z, ['escTopArea', 'concourse']); N('a-bot', fa.world(fa.plan + fa.landing + 1.4, fa.centreLane).x, fa.bottom.y, fa.bottom.z, ['interchangeEast']); }
    N('ie-mid', (IE.xMin + BOX.xMax) / 2, IE.y, colZ + 4, ['interchangeEast']); N('ie-n', (IE.xMin + BOX.xMax) / 2, IE.y, colZ - 6, ['interchangeEast']);
    if (fb) { N('b-top', fb.world(-fb.landing - 1.6, fb.centreLane).x, fb.top.y, fb.top.z, ['interchangeEast']); N('b-bot', fb.world(fb.plan + fb.landing + 1.4, fb.centreLane).x, fb.bottom.y, fb.bottom.z, ['wellWestUpper']); }
    N('wwu-mid', pWest.x, LEVELS.jubUpper, colZ + 3, ['wellWestUpper']); N('wwu-pass', pWest.x, LEVELS.jubUpper, BOX.zMax - 1.8, ['wellWestUpper', 'passage']);
    N('wwl-mid', pWest.x, LEVELS.jubLower, colZ + 3, ['wellWestLower']); N('wwl-pass', pWest.x, LEVELS.jubLower, BOX.zMax - 1.8, ['wellWestLower', 'passage']);
    if (ff) { N('f-top', ff.world(-ff.landing - 1.4, ff.centreLane).x, ff.top.y, ff.top.z, ['wellWestUpper']); N('f-bot', ff.world(ff.plan + ff.landing + 1.4, ff.centreLane).x, ff.bottom.y, ff.bottom.z, ['wellWestLower']); }
    if (fc) { const t = fc.world(-fc.landing - 1.6, fc.centreLane), b = fc.world(fc.plan + fc.landing + 1.0, fc.centreLane); N('c-top', t.x, fc.top.y, t.z, ['dcRecess', 'escTopArea']); N('c-bot', b.x, fc.bottom.y, b.z, ['interchangeWest']); }
    if (fd) { const t = fd.world(-fd.landing - 1.6, fd.centreLane), b = fd.world(fd.plan + fd.landing + 1.4, fd.centreLane); N('d-top', t.x, fd.top.y, t.z, ['dcRecess', 'escTopArea']); N('d-bot', b.x, fd.bottom.y, b.z, ['interchangeWest']); }
    N('iw-mid', (IW.xMin + IW.xMax) / 2, IW.y, colZ + 6, ['interchangeWest']); N('iw-s', (IW.xMin + IW.xMax) / 2, IW.y, BOX.zMax + 4, ['interchangeWest']);
    if (fe) { N('e-top', fe.world(-fe.landing - 1.6, fe.centreLane).x, fe.top.y, fe.top.z, ['interchangeWest']); N('e-bot', fe.world(fe.plan + fe.landing + 1.4, fe.centreLane).x, fe.bottom.y, fe.bottom.z, ['wellEastUpper']); }
    N('ewu-mid', pEast.x, LEVELS.jubUpper, colZ + 3, ['wellEastUpper']); N('ewu-pass', pEast.x, LEVELS.jubUpper, BOX.zMax - 1.8, ['wellEastUpper', 'passage']);
    N('ewl-mid', pEast.x, LEVELS.jubLower, colZ + 3, ['wellEastLower']); N('ewl-pass', pEast.x, LEVELS.jubLower, BOX.zMax - 1.8, ['wellEastLower', 'passage']);
    if (fg) { N('g-top', fg.world(-fg.landing - 1.4, fg.centreLane).x, fg.top.y, fg.top.z, ['wellEastUpper']); N('g-bot', fg.world(fg.plan + fg.landing + 1.4, fg.centreLane).x, fg.bottom.y, fg.bottom.z, ['wellEastLower']); }
    const has = id => nodes.some(n => n.id === id); const link = (a, b, o) => { if (has(a) && has(b)) E(a, b, o); };
    link('a-bot', 'ie-mid'); link('ie-mid', 'ie-n'); link('ie-mid', 'b-top'); link('ie-n', 'b-top'); link('a-bot', 'b-top');
    link('b-bot', 'wwu-mid'); link('wwu-mid', 'wwu-pass'); link('b-bot', 'f-top'); link('f-top', 'wwu-mid'); link('f-bot', 'wwl-mid'); link('wwl-mid', 'wwl-pass');
    link('c-bot', 'iw-mid'); link('d-bot', 'iw-s'); link('iw-s', 'iw-mid'); link('iw-mid', 'e-top'); link('c-bot', 'e-top');
    link('e-bot', 'ewu-mid'); link('ewu-mid', 'ewu-pass'); link('e-bot', 'g-top'); link('g-top', 'ewu-mid'); link('g-bot', 'ewl-mid'); link('ewl-mid', 'ewl-pass');
    ctx.register('nav:box', { nodes, edges });
    const spawns = ['ie-mid', 'ie-n', 'iw-mid', 'iw-s', 'wwu-mid', 'ewu-mid', 'wwl-mid', 'ewl-mid'].map(id => nodes.find(n => n.id === id)).filter(Boolean).map(n => ({ x: n.x, y: n.y, z: n.z }));
    ctx.register('spawn:box', spawns);
  });

  // =============================================================== 12. bake and register
  step('flush', () => { B.flush(group, { name: 'box' }); batch.flush(group, { name: 'boxFurniture' }); });
  ctx.register('jubileeBox', result);
  return result;
}

// ---------------------------------------------------------------------------
// Fixed concrete stair alongside an escalator (banks c, f, g): a straight flight at the escalator's slope with stainless
// nosings, glass balustrades with round handrails on both sides, corduroy at head and foot, an aluminium infill between
// the stair and the escalator, a walkable ramp with the stairs footstep sound.
// ---------------------------------------------------------------------------
function makeStairFrame(f) {
  const sf = K.escalatorFrame({ ...f.def, lanes: [f.stairLane] }, { landing: 1.4, stairLane: null });
  sf.name = f.name + '-stair'; sf.noSupports = true; sf.isStair = true; return sf;
}
function buildSideStair(ctx, parent, B, mats, batch, f, signs) {
  const { collision } = ctx; const lane = f.stairLane; const W = 1.5;
  const a0 = 0.6, a1 = f.plan - 0.6; const run = a1 - a0; const N = Math.max(4, Math.round(f.rise / 0.165)); const riser = f.rise / N, going = run / N;
  const treadGeo = new THREE.BoxGeometry(W, riser, going); const nosGeo = new THREE.BoxGeometry(W - 0.04, 0.012, 0.05);
  const treads = new THREE.InstancedMesh(treadGeo, mats.precast, N), nos = new THREE.InstancedMesh(nosGeo, mats.nosing, N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.yaw), s1 = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < N; i++) {
    const top = f.top.y - (i + 1) * riser; const c = f.world(a0 + (i + 0.5) * going, lane); m4.compose(new THREE.Vector3(c.x, top - riser / 2, c.z), q, s1); treads.setMatrixAt(i, m4);
    const n = f.world(a0 + i * going + 0.025, lane); m4.compose(new THREE.Vector3(n.x, top + 0.006, n.z), q, s1); nos.setMatrixAt(i, m4);
  }
  treads.instanceMatrix.needsUpdate = true; nos.instanceMatrix.needsUpdate = true; treads.computeBoundingSphere(); nos.computeBoundingSphere(); treads.receiveShadow = true; parent.add(treads, nos);
  // sloped soffit slab under the flight with a stringer each side
  const slope = Math.atan2(f.rise, run), slen = Math.hypot(f.rise, run); const cm = f.world((a0 + a1) / 2, lane);
  B.add(K.plainBox(W + 0.1, 0.32, slen, { x: cm.x, y: (f.top.y + f.bottom.y) / 2 - riser - 0.28, z: cm.z, rx: slope, ry: f.yaw }), mats.precast);
  for (const side of [-1, 1]) { const c = f.world((a0 + a1) / 2, lane + side * (W / 2 + 0.03)); B.add(K.plainBox(0.06, 0.4, slen, { x: c.x, y: (f.top.y + f.bottom.y) / 2 - riser / 2 - 0.1, z: c.z, rx: slope, ry: f.yaw }), mats.precast); }
  // balustrades: glass 0.85 m with the rail at 1.0 and a lower rail, following the flight (with short level returns at each end)
  for (const side of [-1, 1]) {
    const ac = lane + side * (W / 2 + 0.06); const pts = [];
    for (let i = 0; i <= 12; i++) { const al = a0 - 0.6 + (run + 1.2) * i / 12; pts.push({ al, y: stairY(f, al, a0, a1) }); }
    for (let i = 0; i < pts.length - 1; i++) { const p = f.world(pts[i].al, ac), qn = f.world(pts[i + 1].al, ac); const y0 = pts[i].y, y1 = pts[i + 1].y; B.add(quadV(p.x, y0 + 0.08, p.z, qn.x, y1 + 0.08, qn.z, 0.85), mats.glass); B.add(K.tubeGeo([p.x, y0 + 1.0, p.z], [qn.x, y1 + 1.0, qn.z], 0.021, 8), mats.stainless); B.add(K.tubeGeo([p.x, y0 + 0.62, p.z], [qn.x, y1 + 0.62, qn.z], 0.016, 8), mats.stainless); if (i % 2 === 0) B.add(K.tubeGeo([p.x, y0 + 0.02, p.z], [p.x, y0 + 1.0, p.z], 0.024, 8), mats.stainless); }
    for (let i = 0; i < 6; i++) { const aA = a0 - 0.6 + (run + 1.2) * i / 6, aB = a0 - 0.6 + (run + 1.2) * (i + 1) / 6; const pa = f.world(aA, ac), pb = f.world(aB, ac); const ya = stairY(f, aA, a0, a1), yb = stairY(f, aB, a0, a1); collision.addBlocker({ xMin: Math.min(pa.x, pb.x) - 0.1, xMax: Math.max(pa.x, pb.x) + 0.1, yMin: Math.min(ya, yb) - 0.1, yMax: Math.max(ya, yb) + 1.2, zMin: Math.min(pa.z, pb.z) - 0.1, zMax: Math.max(pa.z, pb.z) + 0.1 }, 'box:stairBalustrade'); }
  }
  // infill between the escalator's outer balustrade and the stair (aluminium, following the escalator profile), with a stainless upstand at the head
  const escSide = lane > f.centreLane ? f.laneMax + 0.72 : f.laneMin - 0.72; const stairSide = lane > f.centreLane ? lane - W / 2 - 0.08 : lane + W / 2 + 0.08;
  if (Math.abs(stairSide - escSide) > 0.2) {
    const mid = (escSide + stairSide) / 2, w = Math.abs(stairSide - escSide);
    B.add(K.frameRibbon(f, mid, 0.02, 0, -0.2, f.plan + 0.4, { horizontal: true, width: w, flip: true }), mats.clad);
    const hp = f.world(0.0, mid); B.add(K.plainBox(w, 1.0, 0.05, { x: hp.x, y: f.top.y + 0.5, z: hp.z, ry: f.yaw }), mats.stainlessV);
    const e1 = f.world(0, escSide), e2 = f.world(0, stairSide); B.add(K.tubeGeo([e1.x, f.top.y + 1.05, e1.z], [e2.x, f.top.y + 1.05, e2.z], 0.021, 8), mats.stainless);
    const r = boundsOf(f.poly(-0.2, 0.3, escSide, stairSide)); collision.addBlocker({ ...r, yMin: f.top.y, yMax: f.top.y + 1.1 }, 'box:infillUpstand');
  }
  // corduroy hazard strips at head and foot (rotated to the run), the ramp, and the flat approach floors
  for (const al of [a0 - 0.5, a1 + 0.5]) { const p = f.world(al, lane); const y = al < a0 ? f.top.y : f.bottom.y; const g = new THREE.PlaneGeometry(W - 0.1, 0.4); g.rotateX(-Math.PI / 2); g.rotateY(f.yaw); g.translate(p.x, y + 0.005, p.z); const m = ctx.M.tactile('corduroy', 0x6a6a68); m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1; B.add(g, m); }
  const ta = f.world(a0, lane), tb = f.world(a1, lane);
  const ramp = collision.addRamp({ x: ta.x, y: f.top.y, z: ta.z }, { x: tb.x, y: f.bottom.y, z: tb.z }, W - 0.05, { tag: 'box:stair-' + f.name, sound: 'stairs', stepPitch: going });
  for (const [al0, al1, y] of [[-f.landing - 0.6, a0, f.top.y], [a1, f.plan + f.landing + 0.8, f.bottom.y]]) { const r = boundsOf(f.poly(al0, al1, lane - W / 2, lane + W / 2)); collision.addFloor({ ...r, y, tag: 'box:stairLanding-' + f.name, sound: 'hard' }); }
  const hp = f.world(-0.3, lane + (lane > f.centreLane ? 1 : -1) * (W / 2 + 0.1)); F.addWallSign(ctx, parent, { x: hp.x, y: f.top.y + 1.35, z: hp.z, facing: f.yaw + Math.PI, texture: signs.holdHandrail(), w: 0.22, h: 0.3, depth: 0.02, batch, backColor: 0x0019a8 });
  return { ramp, treads: N, going, riser };
}
function stairY(f, al, a0, a1) { if (al <= a0) return f.top.y; if (al >= a1) return f.bottom.y; return f.top.y - f.rise * (al - a0) / (a1 - a0); }
/** Vertical quad between two points of height h (upwards). */
function quadV(x0, y0, z0, x1, y1, z1, h) { const pos = [x0, y0, z0, x1, y1, z1, x1, y1 + h, z1, x0, y0 + h, z0]; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); return g; }

// ---------------------------------------------------------------------------
// Emergency stair down the west side: dog-leg in-situ concrete flights (west lane down, east lane back), stainless
// nosings, glass balustrades with round rails, level landings at the north end joining the slabs, half landings at the
// south end, corduroy, bulkhead lights, green 'Emergency stairs' boards, walkable ramps at every flight.
// ---------------------------------------------------------------------------
function buildEmergencyStair(ctx, parent, B, mats, batch, signs) {
  const { T, collision } = ctx;
  const xMid = (STAIR.xMin + STAIR.xMax) / 2; const laneW = (STAIR.xMax - STAIR.xMin) / 2 - 0.2;
  const xW = STAIR.xMin + 0.1 + laneW / 2, xE = STAIR.xMax - 0.1 - laneW / 2;
  const going = 0.29; const z0 = STAIR.landingZ; const maxLen = STAIR.zMax - z0 - 1.8;
  const treadGeos = [], nosGeos = [];
  const glassSeg = (x, za, ya, zb, yb) => { B.add(quadV(x, ya + 0.08, za, x, yb + 0.08, zb, 0.9), mats.glass); B.add(K.tubeGeo([x, ya + 1.05, za], [x, yb + 1.05, zb], 0.021, 8), mats.stainless); B.add(K.tubeGeo([x, ya + 0.65, za], [x, yb + 0.65, zb], 0.016, 8), mats.stainless); B.add(K.tubeGeo([x, ya + 0.02, za], [x, ya + 1.05, za], 0.024, 8), mats.stainless); B.add(K.tubeGeo([x, yb + 0.02, zb], [x, yb + 1.05, zb], 0.024, 8), mats.stainless); };
  const wallRail = (x, za, ya, zb, yb) => { B.add(K.tubeGeo([x, ya + 1.0, za], [x, yb + 1.0, zb], 0.021, 8), mats.stainless); for (let t = 0; t <= 1; t += 0.25) B.add(K.tubeGeo([x, ya + (yb - ya) * t + 1.0, za + (zb - za) * t], [x - 0.08, ya + (yb - ya) * t + 1.0, za + (zb - za) * t], 0.014, 6), mats.stainless); };
  for (let i = 0; i < STAIR_LEVELS.length - 1; i++) {
    const Lhi = STAIR_LEVELS[i], Llo = STAIR_LEVELS[i + 1]; const H = (Lhi - Llo) / 2;
    let N = Math.ceil(H / 0.165); let len = N * going; if (len > maxLen) { N = Math.floor(maxLen / going); len = N * going; } const riser = H / N;
    const zHalf = z0 + len; const Lmid = Lhi - H;
    for (let k = 0; k < N; k++) {
      const ya = Lhi - (k + 1) * riser, za = z0 + (k + 0.5) * going; treadGeos.push(K.plainBox(laneW, riser, going, { x: xW, y: ya - riser / 2, z: za })); nosGeos.push(K.plainBox(laneW - 0.04, 0.012, 0.05, { x: xW, y: ya + 0.006, z: z0 + k * going + 0.025 }));
      const yb = Lmid - (k + 1) * riser, zb = zHalf - (k + 0.5) * going; treadGeos.push(K.plainBox(laneW, riser, going, { x: xE, y: yb - riser / 2, z: zb })); nosGeos.push(K.plainBox(laneW - 0.04, 0.012, 0.05, { x: xE, y: yb + 0.006, z: zHalf - k * going - 0.025 }));
    }
    const slope = Math.atan2(H, len), slen = Math.hypot(H, len);
    B.add(K.plainBox(laneW + 0.1, 0.3, slen, { x: xW, y: Lhi - H / 2 - riser - 0.25, z: (z0 + zHalf) / 2, rx: slope }), mats.precast);
    B.add(K.plainBox(laneW + 0.1, 0.3, slen, { x: xE, y: Lmid - H / 2 - riser - 0.25, z: (z0 + zHalf) / 2, rx: -slope }), mats.precast);
    // half landing (south end) with its rims
    B.add(K.boxGeo(T, STAIR.xMax - STAIR.xMin, 0.35, STAIR.zMax - zHalf, { x: xMid, y: Lmid - 0.175, z: (zHalf + STAIR.zMax) / 2 }), mats.precast);
    B.add(K.xzQuad(Lmid + 0.002, STAIR.xMin, STAIR.xMax, zHalf, STAIR.zMax, 'up'), mats.terrazzo);
    collision.addFloor({ xMin: STAIR.xMin, xMax: STAIR.xMax, zMin: zHalf - 0.05, zMax: STAIR.zMax, y: Lmid, tag: 'box:stairHalf', sound: 'hard' });
    glassSeg(STAIR.xMax - 0.06, zHalf, Lmid, STAIR.zMax, Lmid); B.add(quadV(STAIR.xMin, Lmid + 0.08, STAIR.zMax - 0.06, STAIR.xMax, Lmid + 0.08, STAIR.zMax - 0.06, 0.9), mats.glass); B.add(K.tubeGeo([STAIR.xMin, Lmid + 1.05, STAIR.zMax - 0.06], [STAIR.xMax, Lmid + 1.05, STAIR.zMax - 0.06], 0.021, 8), mats.stainless);
    collision.addWall(STAIR.xMax, zHalf, STAIR.xMax, STAIR.zMax, Lmid, Lmid + 1.2, 0.15, 'box:stairRim'); collision.addWall(STAIR.xMin, STAIR.zMax, STAIR.xMax, STAIR.zMax, Lmid, Lmid + 1.2, 0.15, 'box:stairRim');
    // flight balustrades: A's east side (glass), A's west side (wall rail); B's both sides (glass)
    glassSeg(xW + laneW / 2 + 0.04, z0, Lhi, zHalf, Lmid); wallRail(STAIR.xMin + 0.02, z0, Lhi, zHalf, Lmid);
    glassSeg(xE - laneW / 2 - 0.04, zHalf, Lmid, z0, Llo); glassSeg(xE + laneW / 2 + 0.04, zHalf, Lmid, z0, Llo);
    for (let k = 0; k < 6; k++) { const za = z0 + len * k / 6, zb = z0 + len * (k + 1) / 6; const yA0 = Lhi - H * k / 6, yA1 = Lhi - H * (k + 1) / 6; collision.addBlocker({ xMin: xW + laneW / 2 - 0.05, xMax: xW + laneW / 2 + 0.15, yMin: Math.min(yA0, yA1) - 0.1, yMax: Math.max(yA0, yA1) + 1.2, zMin: za, zMax: zb }, 'box:stairGlass'); const yB0 = Llo + H * k / 6, yB1 = Llo + H * (k + 1) / 6; collision.addBlocker({ xMin: xE - laneW / 2 - 0.15, xMax: xE - laneW / 2 + 0.05, yMin: Math.min(yB0, yB1) - 0.1, yMax: Math.max(yB0, yB1) + 1.2, zMin: za, zMax: zb }, 'box:stairGlass'); collision.addBlocker({ xMin: xE + laneW / 2 - 0.05, xMax: xE + laneW / 2 + 0.15, yMin: Math.min(yB0, yB1) - 0.1, yMax: Math.max(yB0, yB1) + 1.2, zMin: za, zMax: zb }, 'box:stairGlass'); }
    collision.addRamp({ x: xW, y: Lhi, z: z0 }, { x: xW, y: Lmid, z: zHalf }, laneW, { tag: 'box:emergencyStairA', sound: 'stairs', stepPitch: going });
    collision.addRamp({ x: xE, y: Lmid, z: zHalf }, { x: xE, y: Llo, z: z0 }, laneW, { tag: 'box:emergencyStairB', sound: 'stairs', stepPitch: going });
    for (const [x, y, z] of [[xW, Lhi, z0 - 0.3], [xW, Lmid, zHalf + 0.3], [xE, Lmid, zHalf + 0.3], [xE, Llo, z0 - 0.3]]) F.addCorduroy(ctx, parent, { x, y, z, width: laneW - 0.1, batch });
    B.add(K.plainBox(0.5, 0.12, 0.2, { x: STAIR.xMin + 0.3, y: Lmid + 2.4, z: STAIR.zMax - 0.5 }), mats.lum);
  }
  // level landings (north end) at every level; rims along the hole's east side and south end at slab level
  STAIR_LEVELS.forEach((L, i) => {
    const isConcourse = i === 0, isBase = L === BOX.floor;
    B.add(K.boxGeo(T, STAIR.xMax - STAIR.xMin, 0.35, STAIR.landingZ - STAIR.zMin, { x: xMid, y: L - 0.175 - (isConcourse ? 0.003 : 0), z: (STAIR.zMin + STAIR.landingZ) / 2 }), mats.precast);
    B.add(K.xzQuad(L + (isConcourse ? -0.001 : 0.002), STAIR.xMin, STAIR.xMax, STAIR.zMin, STAIR.landingZ, 'up'), mats.terrazzo);
    collision.addFloor({ xMin: STAIR.xMin, xMax: STAIR.xMax, zMin: STAIR.zMin, zMax: STAIR.landingZ + 0.05, y: L, tag: 'box:stairLanding', sound: 'hard' });
    if (!isBase) {
      glassSeg(STAIR.xMax - 0.06, STAIR.landingZ, L, STAIR.zMax, L); collision.addWall(STAIR.xMax, STAIR.landingZ, STAIR.xMax, STAIR.zMax, L, L + 1.2, 0.15, 'box:stairRim');
      B.add(quadV(STAIR.xMin, L + 0.08, STAIR.zMax + 0.06, STAIR.xMax, L + 0.08, STAIR.zMax + 0.06, 0.9), mats.glass); B.add(K.tubeGeo([STAIR.xMin, L + 1.05, STAIR.zMax + 0.06], [STAIR.xMax, L + 1.05, STAIR.zMax + 0.06], 0.021, 8), mats.stainless); collision.addWall(STAIR.xMin, STAIR.zMax + 0.06, STAIR.xMax, STAIR.zMax + 0.06, L, L + 1.2, 0.15, 'box:stairRim');
    }
    B.add(K.plainBox(0.5, 0.12, 0.2, { x: STAIR.xMin + 0.3, y: L + 2.4, z: STAIR.zMin + 0.6 }), mats.lum);
    const to = isConcourse ? 'to Jubilee line' : isBase ? 'lowest level' : L === IW.y ? 'to platforms 3 and 4' : L === LEVELS.jubUpper ? 'Platform 3 level' : 'Platform 4 level';
    F.addWallSign(ctx, parent, { x: STAIR.xMin + 0.02, y: L + 1.7, z: (STAIR.zMin + STAIR.landingZ) / 2, facing: 'east', texture: signs.emergencyStairs(to), w: 0.5, h: 0.5, depth: 0.02, batch, backColor: 0x009639 });
    if (!isConcourse) F.addEmergencyExitSign(ctx, parent, { x: STAIR.xMax - 0.4, y: L + 2.3, z: STAIR.zMin + 0.03, facing: 'south', arrow: 'up', w: 0.5, batch });
  });
  // the shaft above the west section (between the D&C soffit and the concourse): walls east and south so the stair reads as enclosed
  B.add(K.yzQuad(STAIR.xMax + 0.02, UNDERCROFT_Y - 0.4, BOX.top, STAIR.zMin, STAIR.zMax + 0.4, 'west'), mats.grillage);
  B.add(K.yzQuad(STAIR.xMax + 0.42, UNDERCROFT_Y - 0.4, BOX.top, STAIR.zMin, STAIR.zMax + 0.4, 'east'), mats.grillage);
  B.add(K.xyQuad(STAIR.zMax + 0.42, STAIR.xMin - 0.1, STAIR.xMax + 0.42, UNDERCROFT_Y - 0.4, BOX.top, 'south'), mats.grillage);
  B.add(K.xyQuad(STAIR.zMax + 0.02, STAIR.xMin - 0.1, STAIR.xMax + 0.42, UNDERCROFT_Y - 0.4, BOX.top, 'north'), mats.grillage);
  collision.addBlocker({ xMin: STAIR.xMax, xMax: STAIR.xMax + 0.44, yMin: UNDERCROFT_Y - 0.4, yMax: BOX.top - 0.05, zMin: STAIR.zMin, zMax: STAIR.zMax + 0.44 }, 'box:stairShaftE');
  collision.addBlocker({ xMin: STAIR.xMin - 0.1, xMax: STAIR.xMax + 0.44, yMin: UNDERCROFT_Y - 0.4, yMax: BOX.top - 0.05, zMin: STAIR.zMax, zMax: STAIR.zMax + 0.44 }, 'box:stairShaftS');
  const treadMerged = new K.Bucket(); for (const g of treadGeos) treadMerged.add(g, mats.precast); for (const g of nosGeos) treadMerged.add(g, mats.nosing); treadMerged.flush(parent, { name: 'emergencyStairTreads' });
}

// ---------------------------------------------------------------------------
// The deep lift 'DC / JE / JW': a glass and stainless shaft from the base slab up through the west well landings and
// the interchange slab into the D&C underpinning slab, a slowly cycling car, closed doors at JE and JW with call
// panels, lift signs, a chime on arrival.
// ---------------------------------------------------------------------------
function buildDeepLift(ctx, parent, B, mats, batch, signs, rect) {
  const { T, collision, audio } = ctx; const cx = LIFT.x, cz = LIFT.z, w = LIFT.w, d = LIFT.d;
  const yPit = LEVELS.jubLower - 1.6, yGlassTop = UNDERCROFT_Y, yTop = LEVELS.dcPlatform + 3.0;
  B.add(K.boxGeo(T, w + 0.4, yPit - BOX.floor, d + 0.4, { x: cx, y: (yPit + BOX.floor) / 2, z: cz }), mats.grillage);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.add(K.plainBox(0.16, yGlassTop - yPit, 0.16, { x: cx + sx * (w / 2 - 0.08), y: (yGlassTop + yPit) / 2, z: cz + sz * (d / 2 - 0.08) }), mats.steel);
  for (const y of [LEVELS.jubLower + 2.6, LEVELS.jubUpper + 2.6, yPit + 0.3, LEVELS.jubLower - 0.05, LEVELS.jubUpper - 0.05, yGlassTop - 0.3]) { B.add(K.plainBox(w, 0.14, 0.12, { x: cx, y, z: cz - d / 2 + 0.06 }), mats.steel); B.add(K.plainBox(0.12, 0.14, d, { x: cx - w / 2 + 0.06, y, z: cz }), mats.steel); B.add(K.plainBox(0.12, 0.14, d, { x: cx + w / 2 - 0.06, y, z: cz }), mats.steel); }
  B.add(K.yzQuad(cx - w / 2 + 0.02, yPit, yGlassTop, cz - d / 2, cz + d / 2, 'west'), mats.glassLift); B.add(K.yzQuad(cx + w / 2 - 0.02, yPit, yGlassTop, cz - d / 2, cz + d / 2, 'east'), mats.glassLift);
  B.add(K.xyQuad(cz + d / 2 - 0.02, cx - w / 2, cx + w / 2, yPit, yGlassTop, 'north'), mats.stainlessV);
  const doorW = 1.1, doorH = 2.1; const doorYs = LIFT.stops.filter(s => s.id !== 'DC').map(s => s.y);
  let yCur = yPit; for (const y of doorYs) { B.add(K.xyQuad(cz - d / 2 + 0.02, cx - w / 2, cx + w / 2, yCur, y, 'south'), mats.glassLift); B.add(K.xyQuad(cz - d / 2 + 0.02, cx - w / 2, cx - doorW / 2, y, y + doorH, 'south'), mats.glassLift); B.add(K.xyQuad(cz - d / 2 + 0.02, cx + doorW / 2, cx + w / 2, y, y + doorH, 'south'), mats.glassLift); yCur = y + doorH; }
  B.add(K.xyQuad(cz - d / 2 + 0.02, cx - w / 2, cx + w / 2, yCur, yGlassTop, 'south'), mats.glassLift);
  for (const y of doorYs) { B.add(K.plainBox(w - doorW - 0.1, 0.06, 0.01, { x: cx - (w + doorW) / 4 - 0.025, y: y + 1.1, z: cz - d / 2 + 0.005 }), mats.blueBand); B.add(K.plainBox(w - doorW - 0.1, 0.06, 0.01, { x: cx + (w + doorW) / 4 + 0.025, y: y + 1.1, z: cz - d / 2 + 0.005 }), mats.blueBand); }
  B.add(K.boxGeo(T, w + 0.3, yTop - yGlassTop, d + 0.3, { x: cx, y: (yTop + yGlassTop) / 2, z: cz }), mats.grillage);
  for (const y of doorYs) {
    const g = new THREE.Group(); g.position.set(cx, y, cz - d / 2 - 0.02); parent.add(g);
    for (const s of [-1, 1]) { const leaf = new THREE.Mesh(new THREE.BoxGeometry(doorW / 2 - 0.01, doorH, 0.04), mats.stainlessV); leaf.position.set(s * doorW / 4, doorH / 2, 0); g.add(leaf); const vis = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.9), mats.glass); vis.position.set(s * doorW / 4, 1.35, -0.022); vis.rotation.y = Math.PI; g.add(vis); }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.3, 0.12, 0.1), mats.stainless); frame.position.set(0, doorH + 0.06, -0.02); g.add(frame);
    const strip = ctx.T.ledStrip({ width: 256, height: 64 }); strip.set(y === LEVELS.jubUpper ? 'JE' : 'JW');
    const ind = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.09), ctx.M.screen(strip.texture, 1.4)); ind.position.set(0, doorH + 0.06, -0.075); ind.rotation.y = Math.PI; g.add(ind);
    batch.bakeGroup(parent, g);
    F.addWallSign(ctx, parent, { x: cx + doorW / 2 + 0.35, y: y + 1.1, z: cz - d / 2 - 0.02, facing: 'north', texture: signs.liftButtons(-1), w: 0.2, h: 0.4, depth: 0.03, batch, backColor: 0xc4c7c9 });
    F.addWallSign(ctx, parent, { x: cx, y: y + doorH + 0.55, z: cz - d / 2 - 0.02, facing: 'north', texture: signs.lift(y === LEVELS.jubUpper ? 'to District and Circle lines and platform 4' : 'to District and Circle lines and platform 3'), w: 1.6, h: 0.5, depth: 0.06, batch, backColor: 0x101113 });
    F.addWallSign(ctx, parent, { x: cx - doorW / 2 - 0.35, y: y + 1.5, z: cz - d / 2 - 0.02, facing: 'north', texture: signs.liftFloorPlate(y === LEVELS.jubUpper ? 'JE' : 'JW'), w: 0.3, h: 0.1, depth: 0.01, batch, backColor: 0xc4c7c9 });
  }
  const car = new THREE.Group(); car.name = 'deepLiftCar'; parent.add(car);
  const cw = w - 0.5, cd = d - 0.5, ch = 2.4;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.12, cd), mats.chequer); floor.position.set(0, 0.06, 0); car.add(floor);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.1, cd), mats.stainless); ceil.position.set(0, ch, 0); car.add(ceil);
  const lamp = new THREE.Mesh(new THREE.PlaneGeometry(cw - 0.4, cd - 0.4), mats.lum); lamp.rotation.x = Math.PI / 2; lamp.position.set(0, ch - 0.06, 0); car.add(lamp);
  const back = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, 0.04), mats.stainlessV); back.position.set(0, ch / 2, cd / 2); car.add(back);
  for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.PlaneGeometry(cd, ch - 0.2), mats.glassLift); side.position.set(s * cw / 2, ch / 2, 0); side.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; car.add(side); }
  const front = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch - 0.2), mats.glassLift); front.position.set(0, ch / 2, -cd / 2); front.rotation.y = Math.PI; car.add(front);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, cw - 0.2, 8), mats.stainless); rail.rotation.z = Math.PI / 2; rail.position.set(0, 0.95, cd / 2 - 0.08); car.add(rail);
  const band = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.08, 0.01), mats.blueBand); band.position.set(0, 1.15, cd / 2 - 0.03); car.add(band);
  car.position.set(cx, LEVELS.jubLower, cz);
  const stops = LIFT.stops.slice().sort((a, b) => a.y - b.y); let idx = 0, dir = 1, wait = 12, moving = false; const speed = 1.0;
  ctx.onUpdate(dt => {
    if (!moving) { wait -= dt; if (wait <= 0) { idx += dir; if (idx >= stops.length - 1) dir = -1; if (idx <= 0) dir = 1; moving = true; } return; }
    const target = stops[idx].y; const dy = target - car.position.y; const stepY = Math.sign(dy) * speed * dt;
    if (Math.abs(dy) <= Math.abs(stepY)) { car.position.y = target; moving = false; wait = 14 + Math.random() * 10; if (audio && audio.ready && target < UNDERCROFT_Y) audio.play('box:liftChime', { position: new THREE.Vector3(cx, target + 2.2, cz - d / 2), gain: 0.35 }); }
    else car.position.y += stepY;
  });
  collision.addBlocker({ xMin: rect.xMin - 0.05, xMax: rect.xMax + 0.05, yMin: BOX.floor - 1, yMax: yTop, zMin: rect.zMin - 0.05, zMax: rect.zMax + 0.05 }, 'box:liftShaft');
  return { car, stops, group: car };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function wrap(mesh) { const g = new THREE.Group(); g.add(mesh); return g; }
function boundsOf(poly) { return { xMin: Math.min(...poly.map(p => p.x)), xMax: Math.max(...poly.map(p => p.x)), zMin: Math.min(...poly.map(p => p.z)), zMax: Math.max(...poly.map(p => p.z)) }; }
/** Subtract axis-aligned holes from a list of rects → list of rects. */
function subtractRects(rects, holes) {
  let out = rects.slice();
  for (const h of holes) {
    const next = [];
    for (const r of out) {
      if (!K.rectsOverlap(r, h)) { next.push(r); continue; }
      if (h.zMin > r.zMin) next.push(K.R(r.xMin, r.xMax, r.zMin, Math.min(h.zMin, r.zMax)));
      if (h.zMax < r.zMax) next.push(K.R(r.xMin, r.xMax, Math.max(h.zMax, r.zMin), r.zMax));
      const zi0 = Math.max(r.zMin, h.zMin), zi1 = Math.min(r.zMax, h.zMax);
      if (h.xMin > r.xMin) next.push(K.R(r.xMin, Math.min(h.xMin, r.xMax), zi0, zi1));
      if (h.xMax < r.xMax) next.push(K.R(Math.max(h.xMax, r.xMin), r.xMax, zi0, zi1));
    }
    out = next.filter(r => r.xMax - r.xMin > 0.05 && r.zMax - r.zMin > 0.05);
  }
  return out;
}
function splitZ(x, z0, z1, holes) { const cuts = holes.filter(h => x > h.xMin - 0.3 && x < h.xMax + 0.3).sort((a, b) => a.zMin - b.zMin); const out = []; let cur = z0; for (const h of cuts) { if (h.zMin > cur) out.push([cur, Math.min(h.zMin, z1)]); cur = Math.max(cur, h.zMax); } if (cur < z1) out.push([cur, z1]); return out; }
/** The south wall blocker is split so the passages and the west-section arcade stay open (lintels / sills are added separately). */
function splitWall(x0, x1) { const cuts = [...JUBILEE.passages.map(p => [p.x - p.width / 2, p.x + p.width / 2]), [IW.xMin + 1.5, IW.xMax - 1.5]].sort((a, b) => a[0] - b[0]); const out = []; let cur = x0; for (const [a, b] of cuts) { if (a > cur) out.push([cur, a]); cur = Math.max(cur, b); } if (cur < x1) out.push([cur, x1]); return out; }
function slabYAt(slabs, x, z, yMax) { let best = null; for (const s of slabs) { if (!K.inRect(s.rect, x, z) || s.y > yMax + 0.05) continue; if ((s.holes || []).some(h => K.inRect(h, x, z))) continue; if (best == null || s.y > best) best = s.y; } return best; }
/** Free edges of a slab outline (listed with the interior on the right): sides not against a box wall, minus the escalator mouths and the columns. */
function freeEdges(s) {
  const out = []; const o = s.outer; const near = (v, w) => Math.abs(v - w) < 0.3;
  for (let i = 0; i < o.length; i++) {
    const a = o[i], b = o[(i + 1) % o.length];
    if (near(a.x, b.x) && (near(a.x, BOX.xMin) || near(a.x, BOX.xMax))) continue;
    if (near(a.z, b.z) && (near(a.z, BOX.zMin) || near(a.z, BOX.zMax) || near(a.z, IW.zMax))) continue;
    if (a.x >= BOX.xMax - 0.1 && b.x >= BOX.xMax - 0.1) continue;                                          // the cutting's walls
    if (near(a.x, b.x) && near(a.x, IW.xMax) && Math.min(a.z, b.z) >= BOX.zMax - 0.1) continue;           // the extension's east wall
    if (near(a.x, b.x) && near(a.x, STAIR.xMax) && Math.max(a.z, b.z) <= STAIR.zMax + 0.1) continue;      // the stair's own rim
    if (near(a.z, b.z) && near(a.z, STAIR.zMax) && Math.max(a.x, b.x) <= STAIR.xMax + 0.1) continue;
    if (Math.hypot(b.x - a.x, b.z - a.z) < 0.2) continue;
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz); const n = { x: dz / len, z: -dx / len };   // outward (left of travel)
    let segs = [{ a, b }];
    for (const f of freeEdges.frames || []) { const mouths = [f.poly(-f.landing - 0.7, 3.2, f.laneMin - 0.75, f.laneMax + 0.75), f.poly(f.plan - 4.0, f.plan + f.landing + 0.7, f.laneMin - 0.75, f.laneMax + 0.75)].map(boundsOf); for (const m of mouths) segs = segs.flatMap(sg => clipSegment(sg, m)); }
    for (const c of freeEdges.columns || []) { const m = K.R(c.x - c.r - 0.15, c.x + c.r + 0.15, JUBILEE.columns.z - c.r - 0.15, JUBILEE.columns.z + c.r + 0.15); segs = segs.flatMap(sg => clipSegment(sg, m)); }
    for (const sg of segs) out.push({ a: sg.a, b: sg.b, n });
  }
  return out;
}
function clipSegment(sg, r) {
  const { a, b } = sg; const pad = 0.1; const rr = K.R(r.xMin - pad, r.xMax + pad, r.zMin - pad, r.zMax + pad);
  if (Math.abs(a.x - b.x) < 1e-6) { if (a.x < rr.xMin || a.x > rr.xMax) return [sg]; const lo = Math.min(a.z, b.z), hi = Math.max(a.z, b.z); if (hi <= rr.zMin || lo >= rr.zMax) return [sg]; const out = []; const fwd = a.z < b.z; if (lo < rr.zMin) out.push(fwd ? { a: { x: a.x, z: lo }, b: { x: a.x, z: rr.zMin } } : { a: { x: a.x, z: rr.zMin }, b: { x: a.x, z: lo } }); if (hi > rr.zMax) out.push(fwd ? { a: { x: a.x, z: rr.zMax }, b: { x: a.x, z: hi } } : { a: { x: a.x, z: hi }, b: { x: a.x, z: rr.zMax } }); return out; }
  if (Math.abs(a.z - b.z) < 1e-6) { if (a.z < rr.zMin || a.z > rr.zMax) return [sg]; const lo = Math.min(a.x, b.x), hi = Math.max(a.x, b.x); if (hi <= rr.xMin || lo >= rr.xMax) return [sg]; const out = []; const fwd = a.x < b.x; if (lo < rr.xMin) out.push(fwd ? { a: { x: lo, z: a.z }, b: { x: rr.xMin, z: a.z } } : { a: { x: rr.xMin, z: a.z }, b: { x: lo, z: a.z } }); if (hi > rr.xMax) out.push(fwd ? { a: { x: rr.xMax, z: a.z }, b: { x: hi, z: a.z } } : { a: { x: hi, z: a.z }, b: { x: rr.xMax, z: a.z } }); return out; }
  return [sg];
}
/** Perforated-stainless (or glass) balustrade with 42 mm round rails between two plan points at floor level y; registers a wall blocker. */
function addBalustrade(ctx, B, mats, a, b, y, style = 'perf') {
  const len = Math.hypot(b.x - a.x, b.z - a.z); if (len < 0.3) return;
  const ux = (b.x - a.x) / len, uz = (b.z - a.z) / len; const yaw = Math.atan2(ux, uz); const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
  B.add(K.tubeGeo([a.x, y + RAIL_H, a.z], [b.x, y + RAIL_H, b.z], 0.021, 10), mats.stainless);
  B.add(K.tubeGeo([a.x, y + 0.1, a.z], [b.x, y + 0.1, b.z], 0.016, 8), mats.stainless);
  const nPosts = Math.max(2, Math.round(len / 1.5) + 1);
  for (let i = 0; i < nPosts; i++) { const t = i / (nPosts - 1); const px = a.x + (b.x - a.x) * t, pz = a.z + (b.z - a.z) * t; B.add(K.tubeGeo([px, y + 0.02, pz], [px, y + RAIL_H, pz], 0.028, 10), mats.stainless); }
  if (style === 'perf') B.add(K.plainBox(0.02, RAIL_H - 0.24, len - 0.1, { x: cx, y: y + 0.12 + (RAIL_H - 0.24) / 2, z: cz, ry: yaw }), mats.perfPanel);
  else { B.add(K.plainBox(0.012, RAIL_H - 0.2, len - 0.1, { x: cx, y: y + 0.1 + (RAIL_H - 0.2) / 2, z: cz, ry: yaw }), mats.glass); B.add(K.plainBox(0.016, 0.06, len - 0.1, { x: cx, y: y + 1.0, z: cz, ry: yaw }), mats.blueBand); }
  ctx.collision.addWall(a.x, a.z, b.x, b.z, y - 0.2, y + RAIL_H + 0.1, 0.14, 'box:balustrade');
}
/** Grey stainless litter/salt bin: cylinder with a domed top and the dark-blue band. */
function addBin(ctx, parent, batch, mats, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.27, 0.86, 20), mats.stainlessV); body.position.y = 0.43; g.add(body);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.09, 20, 1, true), mats.blueBand); band.position.y = 0.62; g.add(band);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.stainless); dome.position.y = 0.86; g.add(dome);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.3), mats.black); slot.position.y = 0.95; g.add(slot);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.3, 0.04, 20), mats.darkGrey); base.position.y = 0.02; g.add(base);
  batch.bakeGroup(parent, g);
  ctx.collision.addBlocker({ xMin: x - 0.3, xMax: x + 0.3, yMin: y, yMax: y + 1.1, zMin: z - 0.3, zMax: z + 0.3 }, 'box:bin');
}
/** HMS Westminster plaque (bronze) on a wall face. */
function addPlaque(ctx, parent, batch, signs, x, y, z, facing) {
  F.addWallSign(ctx, parent, { x, y: y + 1.55, z, facing, texture: signs.plaque(), w: 0.8, h: 0.5, depth: 0.03, batch, backColor: 0x4a3f2f });
}
/** Dot-matrix summary of both Jubilee platforms at the head of a bank into the void, hung on rods from `ceilY`; registers
 * 'indicator:<name>' { set(lines) } and refreshes each second from the train service (ctx.get('trainService').nextTrains(3 / 4)). */
function addSummaryIndicator(ctx, parent, batch, name, x, y, z, facing, ceilY) {
  const { T, M } = ctx; const dm = T.dotMatrix({ cols: 150, rows: 3, dot: 6, gap: 2, color: '#ffa21a', dim: '#1d1204', lineGap: 3 }); const mat = M.screen(dm.texture, 1.7);
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = F.facingYaw(facing);
  const hw = 1.5, hh = 0.4, hd = 0.16; const housing = new THREE.Mesh(new THREE.BoxGeometry(hw, hh, hd), M.paint(0x141517, { roughness: 0.45, metalness: 0.3 })); g.add(housing);
  const fw = 1.4, fh = fw / dm.aspect;
  for (const s of [1, -1]) { const face = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), mat); face.position.set(0, 0.01, s * (hd / 2 + 0.002)); face.rotation.y = s > 0 ? 0 : Math.PI; face.userData.noBatch = true; g.add(face); }
  const rodL = Math.max(0.3, (ceilY ?? (y + 0.8)) - (y + hh / 2));
  for (const sx of [-hw / 2 + 0.15, hw / 2 - 0.15]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, rodL, 6), M.stainless()); rod.position.set(sx, hh / 2 + rodL / 2, 0); g.add(rod); }
  const tab = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.09), F.signMaterial(ctx, T.sign({ width: 768, height: 116, bg: '#000', lines: [{ text: 'Jubilee line', x: 384, y: 84, size: 70, align: 'center' }] }), { emissive: 0.5 })); tab.position.set(0, hh / 2 + 0.045, 0); g.add(tab);
  batch.bakeGroup(parent, g);
  const up = JUBILEE.upper, lo = JUBILEE.lower;
  const set = (lines) => { try { dm.set(lines); } catch (e) { /* ignore */ } };
  const clock = () => (ctx.stationTime ? ctx.stationTime() : new Date()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fallback = () => set([{ left: `${up.number} Eastbound  ${up.towards[up.towards.length - 1]}`, right: '2 min' }, { left: `${lo.number} Westbound  ${lo.towards[lo.towards.length - 1]}`, right: '1 min' }, { left: 'Jubilee line  Good service', right: clock() }]);
  fallback();
  let acc = 0.7;
  ctx.onUpdate(dt => {
    acc += dt; if (acc < 1) return; acc = 0;
    const svc = ctx.get('trainService');
    if (!svc || !svc.nextTrains) { fallback(); return; }
    try {
      const fmt = (p, dirName) => { const n = (svc.nextTrains(p.number) || [])[0]; if (!n) return { left: `${p.number} ${dirName}  ${p.towards[p.towards.length - 1]}`, right: '-- min' }; const m = Math.max(0, Math.round((n.minutes ?? (n.seconds ?? 0) / 60))); return { left: `${p.number} ${dirName}  ${n.destination || ''}`, right: m <= 0 ? 'Due' : `${m} min` }; };
      set([fmt(up, 'Eastbound'), fmt(lo, 'Westbound'), { left: 'Jubilee line  Good service', right: clock() }]);
    } catch (e) { fallback(); }
  });
  const api = { set, display: dm }; ctx.register(name, api); return api;
}
