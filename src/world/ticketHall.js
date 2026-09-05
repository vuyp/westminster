// ---------------------------------------------------------------------------
// ticketHall.js — Westminster concourse / ticket hall (layout.TICKET_HALL, dossier §4):
// an irregular low hall at LEVELS.concourse under the Portcullis House transfer slab
// (fair-faced concrete coffered ceiling with the big circular 'saucer' luminaires,
// light speckled-grey terrazzo floor, fair-faced concrete walls), continuing south
// under Bridge Street as the old white-glazed-brick public subway strip.
//
// Builds: the Bridge Street entrance (Exit 4: street passage, lift, 16 steps down),
// the former ticket-office windows (Tensa barriers), ticket machines, cash machines,
// payphones, the NW–SE Cubic gateline (15 gates, wide gate, staff booth, glass screens)
// with its paid-side enclosure around the top of escalator bank (a), the floor openings
// for the District & Circle stairs and the two D&C lifts, the Embankment passage (dog-
// legged so Exits 1 & 2 arrive on the unpaid side) with the Exit 2 / Exit 1 stairs, the
// Whitehall passage to Exits 5 & 6 (toilets), the Bridge Street subway strip with
// billboards, the Exit 3 passage and stairs to the foot of Big Ben (pass-holders'
// Parliament door), signage with the dossier's exact wordings, saucer luminaires,
// columns with the blue mosaic band, help points, CCTV, extinguishers, speakers, bins,
// a station map, Tube map, service-status board, clock, posters.
//
// Registers: floors/ramps/blockers, 'gates' (array of gate objects with open()/close()),
// 'nav:ticketHall', 'spawn:ticketHall', 'speakers:ticketHall', 'indicator:hall', 'ticketHall'.
// Uses at most 10 real point lights (ctx.lights.point); everything else is emissive.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { LEVELS, TICKET_HALL, STREET, DISTRICT, JUBILEE, ESCALATORS, PALETTE, dcToWorld } from '../core/layout.js';
import { Merger, makeSigns, signMatFactory, hangSign, wallSign, posterFrame, helpPoint, extinguishers, speaker, ringBin, wallClock, tensaRun, glassScreen, handrail, stairFlight, liftShaft, bounce, scaleUV, boxMetric } from './ticketHallKit.js';
import { createGateline } from '../entities/ticketGate.js';
import { createTicketMachine } from '../entities/ticketMachine.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function build(ctx) {
  const { scene, M, T, collision, audio } = ctx;
  const group = new THREE.Group(); group.name = 'ticketHall';
  const TH = TICKET_HALL;
  const H = TH.floor, C = TH.ceiling, B = TH.beamSoffit, S0 = LEVELS.street;
  const SUB = H - 0.7;                    // floor of the old subways east of the concourse (4 steps below)
  const CEIL_SUB = -1.1;                  // subway strip / passage soffit (2.5 m clear)
  const merger = new Merger(group);
  const S = makeSigns(T); const signMat = signMatFactory(M);

  // ---------------------------------------------------------------- materials
  const mat = {
    terrazzo: (() => { const m = bounce(M.granite({ base: PALETTE.dcFloor, slab: 2 / 3, joints: true, seed: 12 }), 0.05); m.roughnessMap = null; m.roughness = 0.72; m.metalness = 0.02; return m; })(),   // 2/3 m tiles (3 per texture repeat, seamless); semi-matte so the point lights don't bloom on it
    paving: (() => { const m = bounce(M.granite({ base: 0x7a7975, slab: 1.0, joints: true, seed: 5 }), 0.05); m.roughnessMap = null; m.roughness = 0.82; m.metalness = 0.0; return m; })(),   // worn concrete flags of the old subways
    concrete: bounce(M.concrete({ base: PALETTE.concrete, seed: 11 }), 0.07),
    concretePlain: bounce(M.concrete({ base: 0xa6a49f, seed: 4, boardMarks: false, tieHoles: false, stain: 0.2 }), 0.06),
    soffit: bounce(M.precast({ base: 0xb3b1ac }), 0.1),
    brick: bounce(M.tiles({ color: 0xf1f0ea, grout: 0xb9b6ad, tileW: 0.215, tileH: 0.07, seed: 3 }), 0.12),
    blueTile: bounce(M.tiles({ color: 0x1f3a93, grout: 0xd9dde8, tileW: 0.15, tileH: 0.15, seed: 8 }), 0.06),
    creamTile: bounce(M.tiles({ color: 0xe9e2cf, grout: 0xb5ad98, tileW: 0.15, tileH: 0.15, seed: 6 }), 0.1),
    subCeiling: bounce(M.paint(0xd8d6d0, { roughness: 0.9, metalness: 0 }), 0.1),
    stainless: M.stainless(), stainlessV: M.stainless({ vertical: true }),
    black: M.paint(0x1c1c1e, { roughness: 0.6, metalness: 0.3 }), dark: M.paint(0x3a3b3e, { roughness: 0.7, metalness: 0.2 }),
    blue: M.paint(PALETTE.roundelBlue, { roughness: 0.45, metalness: 0.1 }), signBlue: M.paint(0x14287a, { roughness: 0.5, metalness: 0.1 }),
    yellow: M.yellow(), red: M.paint(0xc9201a, { roughness: 0.5, metalness: 0.2 }), yellowLED: M.luminaire(0xffc200, 2), greenLED: M.luminaire(0x2cff5c, 2),
    mosaic: M.paint(PALETTE.blueMosaic, { roughness: 0.35, metalness: 0.1 }), grille: M.perforated(), white: M.paint(0xe9e8e3, { roughness: 0.8, metalness: 0 }),
    glass: (() => { const m = M.glass({ opacity: 0.22 }).clone(); m.envMapIntensity = 0.55; m.opacity = 0.24; return m; })(),   // screens read as glass, not frosted white, under the hemisphere light
    paddleGlass: (() => { const m = M.glass({ color: 0xd9e4ea, opacity: 0.45, roughness: 0.15 }).clone(); m.envMapIntensity = 0.6; return m; })(), door: M.stainless({ vertical: true }),
    tactile: M.tactile('corduroy', 0x5a5a58), nosing: M.paint(0xd8d6cf, { roughness: 0.6, metalness: 0 }), tread: bounce(M.granite({ base: 0x8e8d88, slab: 0.3, joints: false, seed: 21 }), 0.04),
    bag: M.glass({ color: 0xf0f4f6, opacity: 0.5, roughness: 0.6 }), tape: M.paint(0x111111, { roughness: 0.8, metalness: 0 }), frame: M.paint(0x2a2b2e, { roughness: 0.6, metalness: 0.4 }),
    saucer: M.luminaire(0xfff2df, 2.2), saucerRim: M.paint(0xdcdad4, { roughness: 0.5, metalness: 0.5 }), spot: M.luminaire(0xffe9c8, 3.5), tube: M.luminaire(0xf4f3ea, 2.0),
    box: M.paint(0x14287a, { roughness: 0.5, metalness: 0.1 }), rod: M.stainless(), redEnamel: M.paint(0xb51e17, { roughness: 0.4, metalness: 0.1 }),
    cableTray: M.paint(0x8a8d8f, { roughness: 0.6, metalness: 0.5 }),
  };
  for (const k of ['glass', 'paddleGlass', 'bag']) mat[k].side = THREE.DoubleSide;

  // ---------------------------------------------------------------- plan (all from the contract; see the report for the two documented deviations)
  const HX0 = -45, HX1 = TH.xMax, HZ0 = TH.zMin, HZ1 = -3;                        // main hall under Portcullis House
  const PAVE_Z1 = 2;                                                                // hall continues under the pavement to z = 2, then the subway strip
  const STRIP = TH.bridgeStreetSubway;                                              // x -45..48, z 2..8
  const BAY2 = { xMin: TH.xMin, xMax: HX0, zMin: -10, zMax: 0 };                    // P2 stair bay west of the wall line
  const BAY1 = { xMin: -43, xMax: -24, zMin: STRIP.zMax, zMax: TH.zMax };           // P1 stair bay south of the strip (under the carriageway)
  const E3 = TH.exit3Passage; const E3_STAIR_Z0 = 18.4;
  const ESC = ESCALATORS[0]; const ESC_OPEN = { xMin: ESC.top.x - 12, xMax: ESC.top.x, zMin: ESC.top.z - 2.25, zMax: ESC.top.z + 2.25 };   // 4.5 × 12 m opening west of the top comb
  const EMB_MOUTH = { zMin: -5, zMax: -1 };                                          // where the (dog-legged) Embankment passage enters the unpaid concourse
  const MS = TH.mainStairs; const MS_W = MS.xMax - MS.xMin; const MS_CX = (MS.xMin + MS.xMax) / 2;
  const LIFT_ST = TH.streetLift;
  const GL = TH.gateline;
  const openings = DISTRICT.stairOpeningsWorld; const open2 = openings.find(o => o.platform === 2), open1 = openings.find(o => o.platform === 1);
  // ---- seal the concourse floor around the diagonal District stair openings (the holes are axis-aligned AABBs of rotated stairs)
  try {
    const H = LEVELS.concourse;
    const seal = (s0, s1, t0, t1) => { const sm = (s0 + s1) / 2; const a = dcToWorld(sm, t0), b = dcToWorld(sm, t1); ctx.collision.addRamp({ x: a.x, y: H, z: a.z }, { x: b.x, y: H, z: b.z }, Math.abs(s1 - s0), { tag: 'stairSeal', sound: 'hard' }); };
    for (const st of DISTRICT.stairs) {
      seal(st.sTop - 3.5, st.sTop + 0.03, st.tMin, st.tMax);            // approach landing at the head
      seal(st.sTop - 3.5, st.sBottom + 3.5, st.tMin - 4, st.tMin);       // band beside the flight
      seal(st.sTop - 3.5, st.sBottom + 3.5, st.tMax, st.tMax + 4);       // band beside the flight
      seal(st.sBottom - 0.03, st.sBottom + 3.5, st.tMin, st.tMax);       // beyond the foot (guarded at concourse level)
    }
  } catch (e) { console.warn('[ticketHall] stair seals failed', e); }

  const st2 = DISTRICT.stairs.find(s => s.platform === 2), st1 = DISTRICT.stairs.find(s => s.platform === 1);
  const lift2 = DISTRICT.lifts.find(l => l.platform === 2), lift1 = DISTRICT.lifts.find(l => l.platform === 1);
  const L2 = dcToWorld(lift2.s, lift2.t), L1 = dcToWorld(lift1.s, lift1.t);

  // ---------------------------------------------------------------- helpers
  /** Wall given by its inner face line (x1,z1)→(x2,z2) and the outward direction; box + blocker. */
  function wall(x1, z1, x2, z2, out, y0, y1, m = mat.concrete, thick = 0.3, tag = 'wall') {
    const len = Math.hypot(x2 - x1, z2 - z1); if (len < 0.01) return; const yaw = -Math.atan2(z2 - z1, x2 - x1);
    const cx = (x1 + x2) / 2 + out.x * thick / 2, cz = (z1 + z2) / 2 + out.z * thick / 2;
    merger.box(m, len, y1 - y0, thick, { x: cx, y: (y0 + y1) / 2, z: cz, ry: yaw });
    const hx = Math.abs(Math.cos(yaw)) * len / 2 + Math.abs(Math.sin(yaw)) * thick / 2, hz = Math.abs(Math.sin(yaw)) * len / 2 + Math.abs(Math.cos(yaw)) * thick / 2;
    collision.addBlocker({ xMin: cx - hx, xMax: cx + hx, yMin: y0, yMax: y1, zMin: cz - hz, zMax: cz + hz }, tag);
  }
  const wallX = (x, z0, z1, outX, y0, y1, m, thick, tag) => wall(x, z0, x, z1, { x: outX, z: 0 }, y0, y1, m, thick, tag);
  const wallZ = (z, x0, x1, outZ, y0, y1, m, thick, tag) => wall(x0, z, x1, z, { x: 0, z: outZ }, y0, y1, m, thick, tag);
  const floorRect = (r, y, sound = 'hard', tag = 'hall') => collision.addFloor({ xMin: r.xMin, xMax: r.xMax, zMin: r.zMin, zMax: r.zMax, y, sound, tag });
  /** Flat rotated strip (a→b, width) — a zero-slope ramp, used to fill around the diagonal D&C openings. */
  const flatStrip = (a, b, w, y, tag) => collision.addRamp(V(a.x, y, a.z), V(b.x, y, b.z), w, { tag, sound: 'hard' });
  const sm = (tex, o) => signMat(tex, o);
  /** Horizontal ShapeGeometry from [x,z] points (with [x,z] holes), facing up. */
  const shape = (pts, holes = []) => { const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))); for (const h of holes) sh.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z)))); const g = new THREE.ShapeGeometry(sh, 1); g.rotateX(-Math.PI / 2); return g; };
  const clockObjs = [];
  /** Blue/white tiled bay around a help point on a glazed-brick wall (dossier §2.5): white-tile surround, blue field, the help point. */
  function helpBay(x, z, facing, y0, y1) {
    const rot = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }[facing] ?? 0; const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    merger.box(mat.creamTile, 2.0, y1 - y0, 0.02, { x: x + fwd.x * 0.01, y: (y0 + y1) / 2, z: z + fwd.z * 0.01, ry: rot });
    merger.box(mat.blueTile, 1.6, y1 - y0 - 0.4, 0.02, { x: x + fwd.x * 0.025, y: (y0 + y1) / 2, z: z + fwd.z * 0.025, ry: rot });
    helpPoint(merger, mat, sm(S.helpPoint(), { emissive: 0.5 }), { x: x + fwd.x * 0.035, y: y0 + 1.2, z: z + fwd.z * 0.035, facing });
  }
  const pill = { jubilee: { name: 'Jubilee line', color: '#a0a5a9' }, district: { name: 'District', color: '#00782a' }, circle: { name: 'Circle', color: '#ffd300', textColor: '#0019a8' } };
  const speakers = []; const spawn = []; const navNodes = []; const navEdges = []; const emitters = [];
  const N = (id, x, y, z, tags) => { navNodes.push({ id, x, y, z, tags }); return id; };
  const E = (a, b, o) => navEdges.push(o ? [a, b, o] : [a, b]);
  const chain = (...ids) => { for (let i = 1; i < ids.length; i++) E(ids[i - 1], ids[i]); };

  // ================================================================ 1. FLOORS
  try {
    // visual: one terrazzo shape for the hall (+ P2 bay, + under-pavement strip) with holes; one paving shape for the subway strip, P1 bay, Exit 3
    const rotRect = (st) => [[st.sTop, st.tMin], [st.sBottom, st.tMin], [st.sBottom, st.tMax], [st.sTop, st.tMax]].map(([s, t]) => { const w = dcToWorld(s, t); return [w.x, w.z]; });
    const escHole = [[ESC_OPEN.xMin, ESC_OPEN.zMin], [ESC_OPEN.xMax, ESC_OPEN.zMin], [ESC_OPEN.xMax, ESC_OPEN.zMax], [ESC_OPEN.xMin, ESC_OPEN.zMax]];
    const hallOutline = [[HX0, HZ0], [HX1, HZ0], [HX1, PAVE_Z1], [HX0, PAVE_Z1], [HX0, BAY2.zMax], [BAY2.xMin, BAY2.zMax], [BAY2.xMin, BAY2.zMin], [HX0, BAY2.zMin]];
    const fl = new THREE.Mesh(shape(hallOutline, [escHole, rotRect(st2)]), mat.terrazzo); fl.position.y = H; fl.receiveShadow = true; group.add(fl);
    const subOutline = [[HX0, PAVE_Z1], [HX1, PAVE_Z1], [HX1, E3_STAIR_Z0], [E3.xMin, E3_STAIR_Z0], [E3.xMin, STRIP.zMax], [BAY1.xMax, STRIP.zMax], [BAY1.xMax, BAY1.zMax], [BAY1.xMin, BAY1.zMax], [BAY1.xMin, STRIP.zMax], [HX0, STRIP.zMax]];
    const fs = new THREE.Mesh(shape(subOutline, [rotRect(st1)]), mat.paving); fs.position.y = H + 0.002; fs.receiveShadow = true; group.add(fs);
    // yellow line + dark corduroy at the escalator opening edge; nosing trims at the D&C openings
    merger.box(mat.yellow, ESC_OPEN.xMax - ESC_OPEN.xMin + 0.6, 0.004, 0.1, { x: (ESC_OPEN.xMin + ESC_OPEN.xMax) / 2, y: H + 0.003, z: ESC_OPEN.zMin - 0.45 }, false);
    merger.box(mat.yellow, ESC_OPEN.xMax - ESC_OPEN.xMin + 0.6, 0.004, 0.1, { x: (ESC_OPEN.xMin + ESC_OPEN.xMax) / 2, y: H + 0.003, z: ESC_OPEN.zMax + 0.45 }, false);
    // collision: axis-aligned slabs around the holes + rotated strips around the diagonal openings
    floorRect({ xMin: HX0, xMax: HX1, zMin: HZ0, zMax: ESC_OPEN.zMin }, H);
    floorRect({ xMin: HX0, xMax: ESC_OPEN.xMin, zMin: ESC_OPEN.zMin, zMax: open2.zMin }, H);
    floorRect({ xMin: open2.xMax, xMax: ESC_OPEN.xMin, zMin: open2.zMin, zMax: open2.zMax }, H);
    floorRect({ xMin: HX0, xMax: ESC_OPEN.xMin, zMin: open2.zMax, zMax: STRIP.zMax }, H);
    floorRect({ xMin: ESC_OPEN.xMax, xMax: HX1, zMin: ESC_OPEN.zMin, zMax: ESC_OPEN.zMax }, H);
    floorRect({ xMin: ESC_OPEN.xMin, xMax: HX1 + 0.65, zMin: ESC_OPEN.zMax, zMax: STRIP.zMax }, H);   // reaches through the Embankment mouth to meet the top of its 4 steps
    floorRect({ xMin: BAY2.xMin, xMax: HX0, zMin: BAY2.zMin, zMax: open2.zMin }, H); floorRect({ xMin: BAY2.xMin, xMax: open2.xMin, zMin: open2.zMin, zMax: open2.zMax }, H); floorRect({ xMin: BAY2.xMin, xMax: HX0, zMin: open2.zMax, zMax: BAY2.zMax }, H);
    floorRect({ xMin: BAY1.xMin, xMax: BAY1.xMax, zMin: BAY1.zMin, zMax: open1.zMin }, H); floorRect({ xMin: BAY1.xMin, xMax: open1.xMin, zMin: open1.zMin, zMax: open1.zMax }, H); floorRect({ xMin: open1.xMax, xMax: BAY1.xMax, zMin: open1.zMin, zMax: open1.zMax }, H); floorRect({ xMin: BAY1.xMin, xMax: BAY1.xMax, zMin: open1.zMax, zMax: BAY1.zMax }, H);
    floorRect({ xMin: E3.xMin, xMax: E3.xMax, zMin: STRIP.zMax, zMax: E3_STAIR_Z0 }, H, 'hard', 'exit3Passage');
    for (const st of [st2, st1]) {   // strips just outside each edge of the rotated opening (inner edge exactly on the hole)
      const W = 2.2; const tMid = (st.tMin + st.tMax) / 2;
      flatStrip(dcToWorld(st.sTop - 2, st.tMin - W / 2), dcToWorld(st.sBottom + 2, st.tMin - W / 2), W, H, 'dcOpeningEdge');
      flatStrip(dcToWorld(st.sTop - 2, st.tMax + W / 2), dcToWorld(st.sBottom + 2, st.tMax + W / 2), W, H, 'dcOpeningEdge');
      collision.addRamp(dcToWorld(st.sTop - W / 2 - 0.01, st.tMin - 2), dcToWorld(st.sTop - W / 2 - 0.01, st.tMax + 2), W, { tag: 'dcOpeningEdge', sound: 'hard' });
      collision.addRamp(dcToWorld(st.sBottom + W / 2 + 0.01, st.tMin - 2), dcToWorld(st.sBottom + W / 2 + 0.01, st.tMax + 2), W, { tag: 'dcOpeningEdge', sound: 'hard' });
    }
  } catch (e) { console.warn('[ticketHall] floors failed', e); }

  // ================================================================ 2. WALLS (fair-faced concrete; white glazed brick in the subway strip)
  try {
    const WH = C;   // walls rise to the slab
    wallZ(HZ0, HX0, HX1, -1, H, WH);                                                                    // north wall
    // west wall x = -45: cash machines / ticket windows / Whitehall passage gap / ticket machines, down to the P2 bay
    const WP = TH.whitehallPassage;
    wallX(HX0, HZ0, WP.zMin, -1, H, WH); wallX(HX0, WP.zMax, BAY2.zMin, -1, H, WH);
    wallX(HX0, WP.zMin, WP.zMax, -1, CEIL_SUB, WH);                                                    // lintel over the Whitehall passage mouth (its ceiling is lower)
    wallX(HX0, BAY2.zMax, STRIP.zMax, -1, H, WH);                                                      // west end of the subway strip
    wallX(BAY2.xMin, BAY2.zMin, BAY2.zMax, -1, H, WH); wallZ(BAY2.zMin, BAY2.xMin, HX0, -1, H, WH); wallZ(BAY2.zMax, BAY2.xMin, HX0, 1, H, WH);
    // south side: strip wall at z = 8 except the P1 bay and the Exit 3 passage
    wallZ(STRIP.zMax, HX0, BAY1.xMin, 1, H, CEIL_SUB, mat.brick); wallZ(STRIP.zMax, BAY1.xMax, E3.xMin, 1, H, CEIL_SUB, mat.brick);
    wallX(BAY1.xMin, BAY1.zMin, BAY1.zMax, -1, H, WH); wallX(BAY1.xMax, BAY1.zMin, BAY1.zMax, 1, H, WH); wallZ(BAY1.zMax, BAY1.xMin, BAY1.xMax, 1, H, WH);
    // east wall x = 48 with the Embankment mouth (z -5..-1)
    wallX(HX1, HZ0, EMB_MOUTH.zMin, 1, H, WH); wallX(HX1, EMB_MOUTH.zMax, STRIP.zMax, 1, H, WH);
    // Exit 3 passage walls (white glazed brick) from the strip to the stair top
    wallX(E3.xMin, STRIP.zMax, E3_STAIR_Z0, -1, H, CEIL_SUB, mat.brick); wallX(E3.xMax, STRIP.zMax, E3_STAIR_Z0, 1, H, CEIL_SUB, mat.brick);
    wallX(E3.xMin, E3_STAIR_Z0, E3.stairsTop[1] + 0.5, -1, H, S0 + 0.9, mat.creamTile, 0.25, 'exitTrench'); wallX(E3.xMax, E3_STAIR_Z0, E3.stairsTop[1] + 0.5, 1, H, S0 + 0.9, mat.creamTile, 0.25, 'exitTrench');   // stair trench up to the pavement
    // piers along the hall/subway boundary (z = 2): the road's edge beam sits on 1 m piers every 12 m — reads as a colonnade
    for (let x = -38; x < HX1 - 2; x += 12) { if (Math.abs(x - MS_CX) < 6) continue; merger.box(mat.concrete, 1.0, C - H, 1.2, { x, y: (H + C) / 2, z: PAVE_Z1 + 0.6 }); collision.addBlocker({ xMin: x - 0.5, xMax: x + 0.5, yMin: H, yMax: C, zMin: PAVE_Z1, zMax: PAVE_Z1 + 1.2 }, 'pier'); }
  } catch (e) { console.warn('[ticketHall] walls failed', e); }

  // ================================================================ 3. CEILINGS: coffered concrete grid + saucer luminaires; flat painted soffits in the subways
  try {
    const cg = new Merger(group);
    // slab soffit (facing down) over the hall and the pavement strip; P1/P2 bays
    const WELL = { xMin: MS.xMin - 0.2, xMax: MS.xMax + 0.2, zMin: MS.zBottom - 0.2, zMax: HZ1 };   // the stair well cuts through the slab
    { const mz = pts => pts.map(([x, z]) => [x, -z]); const g = shape(mz([[HX0, HZ0], [HX1, HZ0], [HX1, PAVE_Z1], [HX0, PAVE_Z1]]), [mz([[WELL.xMin, WELL.zMin], [WELL.xMax, WELL.zMin], [WELL.xMax, WELL.zMax], [WELL.xMin, WELL.zMax]])]); g.rotateX(Math.PI); cg.add(mat.soffit, g, { y: C }); }   // (z pre-mirrored so the half-turn leaves it facing down in place)
    cg.flat(mat.soffit, BAY2.xMax - BAY2.xMin, BAY2.zMax - BAY2.zMin, { x: (BAY2.xMin + BAY2.xMax) / 2, y: C - 0.02, z: (BAY2.zMin + BAY2.zMax) / 2, down: true });
    cg.flat(mat.soffit, BAY1.xMax - BAY1.xMin, BAY1.zMax - BAY1.zMin, { x: (BAY1.xMin + BAY1.xMax) / 2, y: C - 0.02, z: (BAY1.zMin + BAY1.zMax) / 2, down: true });
    cg.box(mat.concrete, BAY1.xMax - BAY1.xMin + 0.6, C - CEIL_SUB, 0.3, { x: (BAY1.xMin + BAY1.xMax) / 2, y: (C + CEIL_SUB) / 2, z: STRIP.zMax + 0.15 });   // downstand over the P1 bay mouth (bay ceiling higher than the strip's)
    // beams: N–S on the column half-grid (5.9 m), E–W every 5.29 m; 0.5 wide, down to the beam soffit; split around the stair well
    const bd = C - B; const xs = []; for (let x = -41.3; x <= 47.3; x += 5.9) xs.push(x);
    for (const x of xs) { if (x > WELL.xMin && x < WELL.xMax) cg.box(mat.concrete, 0.5, bd, WELL.zMin - HZ0, { x, y: C - bd / 2, z: (HZ0 + WELL.zMin) / 2 }); else cg.box(mat.concrete, 0.5, bd, PAVE_Z1 - HZ0, { x, y: C - bd / 2, z: (HZ0 + PAVE_Z1) / 2 }); }
    const zs = []; for (let k = 1; k <= 7; k++) zs.push(HZ0 + k * 5.29);
    const beamEW = (z, h, w) => { if (z > WELL.zMin && z <= WELL.zMax) { cg.box(mat.concrete, WELL.xMin - HX0, h, w, { x: (HX0 + WELL.xMin) / 2, y: C - h / 2, z }); cg.box(mat.concrete, HX1 - WELL.xMax, h, w, { x: (WELL.xMax + HX1) / 2, y: C - h / 2, z }); } else cg.box(mat.concrete, HX1 - HX0, h, w, { x: (HX0 + HX1) / 2, y: C - h / 2, z }); };
    for (const z of zs) beamEW(z, bd, 0.5);
    beamEW(HZ1, bd + 0.2, 1.0);          // the deep transfer beam on the facade line
    cg.box(mat.concrete, HX1 - HX0, C - CEIL_SUB, 0.6, { x: (HX0 + HX1) / 2, y: (C + CEIL_SUB) / 2, z: PAVE_Z1 + 0.3 });   // road edge beam over the piers
    // perimeter downstands
    cg.box(mat.concrete, HX1 - HX0, bd, 0.5, { x: (HX0 + HX1) / 2, y: C - bd / 2, z: HZ0 + 0.25 });
    // saucer luminaires (1.4 m discs, 0.3 m below the slab inside the coffers) on 3 thin rods, plus a spot head on a stalk; instanced
    const saucerGeo = new THREE.CylinderGeometry(0.7, 0.66, 0.06, 36); const rimGeo = new THREE.TorusGeometry(0.7, 0.025, 8, 36); rimGeo.rotateX(Math.PI / 2);
    const rodGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.27, 5); const spotGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.16, 12); const stalkGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6);
    const places = []; const spots = [];
    for (let i = 0; i + 1 < xs.length; i += 2) for (let k = 0; k <= zs.length; k++) {
      const z0 = k === 0 ? HZ0 : zs[k - 1], z1 = k === zs.length ? HZ1 : zs[k]; const cx = (xs[i] + xs[i + 1]) / 2, cz = (z0 + z1) / 2;
      if (cx > ESC_OPEN.xMin - 1 && cx < ESC_OPEN.xMax + 1 && cz > ESC_OPEN.zMin - 1 && cz < ESC_OPEN.zMax + 1) continue;
      if (Math.abs(cx - MS_CX) < 5 && cz > MS.zBottom - 1) continue;
      places.push([cx, cz]); if ((i / 2 + k) % 2 === 0) spots.push([cx + 2.2, cz - 1.6, 0.5]); else spots.push([cx - 2.2, cz + 1.6, -0.5]);
    }
    const inst = (geo, m, n) => { const im = new THREE.InstancedMesh(geo, m, n); im.castShadow = false; im.receiveShadow = false; group.add(im); return im; };
    const saucers = inst(saucerGeo, mat.saucer, places.length), rims = inst(rimGeo, mat.saucerRim, places.length), rods = inst(rodGeo, mat.stainless, places.length * 3), spotHeads = inst(spotGeo, mat.dark, spots.length), stalks = inst(stalkGeo, mat.dark, spots.length), spotLens = inst(new THREE.CircleGeometry(0.05, 12), mat.spot, spots.length);
    const mx = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler();
    places.forEach(([x, z], i) => {
      mx.makeTranslation(x, C - 0.3, z); saucers.setMatrixAt(i, mx); rims.setMatrixAt(i, mx);
      for (let r = 0; r < 3; r++) { const a = r * Math.PI * 2 / 3; mx.makeTranslation(x + Math.cos(a) * 0.45, C - 0.135, z + Math.sin(a) * 0.45); rods.setMatrixAt(i * 3 + r, mx); }
    });
    spots.forEach(([x, z, tilt], i) => { mx.makeTranslation(x, C - 0.22, z); stalks.setMatrixAt(i, mx); e.set(tilt, 0, 0.35); q.setFromEuler(e); mx.compose(V(x, C - 0.5, z), q, V(1, 1, 1)); spotHeads.setMatrixAt(i, mx); e.set(-Math.PI / 2 + tilt, 0, 0.35); q.setFromEuler(e); mx.compose(V(x + Math.sin(0.35) * 0.09, C - 0.585, z), q, V(1, 1, 1)); spotLens.setMatrixAt(i, mx); });
    // cable trays along two N–S beams and speakers/CCTV hang from them (fixtures below)
    for (const x of [xs[3] + 0.6, xs[10] + 0.6]) { cg.box(mat.cableTray, 0.3, 0.06, HZ1 - HZ0, { x, y: B - 0.05, z: (HZ0 + HZ1) / 2 }, false); }
    // subway strip + bays: painted concrete soffit at -1.1 and battens
    cg.flat(mat.subCeiling, STRIP.xMax - STRIP.xMin, STRIP.zMax - PAVE_Z1 - 0.6, { x: (STRIP.xMin + STRIP.xMax) / 2, y: CEIL_SUB, z: (PAVE_Z1 + 0.6 + STRIP.zMax) / 2, down: true });
    cg.flat(mat.subCeiling, E3.xMax - E3.xMin, E3.stairsTop[1] + 0.5 - STRIP.zMax, { x: (E3.xMin + E3.xMax) / 2, y: CEIL_SUB, z: (STRIP.zMax + E3.stairsTop[1] + 0.5) / 2, down: true });
    cg.flush({ name: 'ceiling', castShadow: false });
    for (let x = STRIP.xMin + 4; x < STRIP.xMax - 2; x += 6) ctx.lights.tube(group, { x, y: CEIL_SUB - 0.06, z: (PAVE_Z1 + STRIP.zMax) / 2 + 0.3, axis: 'x', length: 1.5, color: 0xf2f1e6, emissive: 2.0, real: false });
    for (let z = STRIP.zMax + 3; z < E3_STAIR_Z0 - 1; z += 5) ctx.lights.tube(group, { x: (E3.xMin + E3.xMax) / 2, y: CEIL_SUB - 0.06, z, axis: 'x', length: 1.2, real: false });
  } catch (e) { console.warn('[ticketHall] ceiling failed', e); }

  // ================================================================ 4. COLUMNS: hall-level segment of the 2 m box columns with the blue mosaic band
  try {
    const cols = JUBILEE.columns; const r = cols.diameter / 2;
    const cm = new Merger(group);
    for (const x of cols.x) {
      const z = cols.z; if (x < HX0 + r || x > HX1 - r) continue;
      cm.cyl(mat.concretePlain, r, r, C - H + 0.02, 40, { x, y: (H + C) / 2, z });
      cm.cyl(mat.mosaic, r + 0.006, r + 0.006, 0.3, 40, { x, y: H + 1.2, z }, true);
      cm.cyl(mat.concrete, r + 0.12, r + 0.02, 0.5, 40, { x, y: C - 0.25, z });                        // cast collar at the slab
      cm.cyl(mat.dark, r + 0.06, r + 0.06, 0.03, 40, { x, y: H + 0.015, z });                           // skirting ring
      collision.addBlocker({ xMin: x - r - 0.02, xMax: x + r + 0.02, yMin: H, yMax: C, zMin: z - r - 0.02, zMax: z + r + 0.02 }, 'column');
      // ring-mounted uplighter pair on a collar bracket (dossier §5.2), emissive only
      for (const a of [Math.PI / 4, Math.PI * 1.25]) { cm.box(mat.dark, 0.12, 0.1, 0.18, { x: x + Math.cos(a) * (r + 0.12), y: H + 2.35, z: z + Math.sin(a) * (r + 0.12), ry: -a }); cm.cyl(mat.spot, 0.04, 0.04, 0.01, 10, { x: x + Math.cos(a) * (r + 0.12), y: H + 2.405, z: z + Math.sin(a) * (r + 0.12) }); }
      cm.cyl(mat.dark, r + 0.14, r + 0.14, 0.04, 40, { x, y: H + 2.3, z }, true);
    }
    cm.flush({ name: 'columns' });
  } catch (e) { console.warn('[ticketHall] columns failed', e); }

  // ================================================================ 5. BRIDGE STREET ENTRANCE (Exit 4): street passage, lift, 16 steps down
  try {
    const EP = TH.entrancePassage; const PX0 = MS.xMin, PX1 = MS.xMax; const TOP_Y = S0 + 3.6;   // passage/lobby ceiling inside Portcullis House
    // street-level floor: passage (z -6.5..-3) + lift lobby alongside the top of the stairs (x -6.7..-4.5, z -9.6..-6.5)
    const LOB = { xMin: LIFT_ST.x + 1.3, xMax: PX0, zMin: LIFT_ST.z - 1.6, zMax: MS.zTop };
    merger.flat(mat.paving, 12, MS.zTop - EP.zMin - 0.0 + 3.45, { x: 0, y: S0 + 0.001, z: (EP.zMin + EP.zMax - 0.1) / 2 });
    merger.flat(mat.paving, LOB.xMax - LOB.xMin, LOB.zMax - LOB.zMin, { x: (LOB.xMin + LOB.xMax) / 2, y: S0 + 0.001, z: (LOB.zMin + LOB.zMax) / 2 });
    floorRect({ xMin: -6, xMax: 6, zMin: EP.zMin, zMax: EP.zMax + 0.5 }, S0, 'hard', 'entrancePassage'); floorRect(LOB, S0, 'hard', 'liftLobby');
    // walls of the passage & stair well: full height from the concourse to the passage ceiling (the well is cut through the transfer slab)
    wallX(PX0, MS.zBottom, EP.zMax, -1, H, TOP_Y, mat.concrete, 0.35, 'stairWall');                 // west flank: runs from the stair foot to the arcade
    wallX(PX1, MS.zBottom, EP.zMax, 1, H, TOP_Y, mat.concrete, 0.35, 'stairWall');                  // east flank
    // the lift lobby sits west of the west flank at street level: its north wall (the shaft is its west side)
    wallZ(LOB.zMin, LOB.xMin, LOB.xMax, -1, S0, TOP_Y, mat.concrete, 0.3, 'lobbyWall');
    wallZ(EP.zMax - 0.2, PX0 - 1.5, PX0, -1, S0, TOP_Y, mat.concrete, 0.3, 'return'); wallZ(EP.zMax - 0.2, PX1, PX1 + 2.5, -1, S0, TOP_Y, mat.concrete, 0.3, 'return');   // returns to the 12 m arcade opening
    // ceilings: passage soffit, sloped soffit over the stairs meeting the hall slab at the foot
    merger.flat(mat.soffit, PX1 - PX0 + 3, MS.zTop - EP.zMax + 0.6, { x: (PX0 + PX1) / 2 - 0.5, y: TOP_Y, z: (EP.zMax + MS.zTop) / 2 - 0.3, down: true });
    merger.flat(mat.soffit, LOB.xMax - LOB.xMin, LOB.zMax - LOB.zMin, { x: (LOB.xMin + LOB.xMax) / 2, y: TOP_Y, z: (LOB.zMin + LOB.zMax) / 2, down: true });
    { const g = new THREE.PlaneGeometry(MS_W + 0.7, Math.hypot(MS.zBottom - MS.zTop, C - (TOP_Y - 0.6))); scaleUV(g, MS_W, 8); const ang = Math.atan2((TOP_Y - 0.6) - C, MS.zTop - MS.zBottom); g.rotateX(Math.PI / 2 - ang); merger.add(mat.soffit, g, { x: MS_CX, y: ((TOP_Y - 0.6) + C) / 2, z: (MS.zTop + MS.zBottom) / 2 }); }
    merger.box(mat.concrete, MS_W + 0.7, 0.6, 0.4, { x: MS_CX, y: TOP_Y - 0.3, z: MS.zTop - 0.2 });   // bulkhead over the stair head
    // the 16 steps down (northwards) with side and centre handrails, corduroy at both ends
    stairFlight(merger, mat, collision, { from: { x: MS_CX, y: H, z: MS.zBottom }, to: { x: MS_CX, y: S0, z: MS.zTop }, width: MS_W, steps: MS.steps, tag: 'mainStairs', handrails: 'both', centreRail: true });
    // solid mass under the flight (blockers stepped under the treads) and its visible concrete wedge
    { const sh = new THREE.Shape([new THREE.Vector2(MS.zTop, S0 - 0.02), new THREE.Vector2(MS.zBottom, H + 0.01), new THREE.Vector2(MS.zTop, H + 0.01)]); const g = new THREE.ExtrudeGeometry(sh, { depth: MS_W, bevelEnabled: false }); g.rotateY(-Math.PI / 2); g.translate(MS.xMax, 0, 0); merger.add(mat.concrete, g);
      const nS = 6; for (let k = 0; k < nS; k++) { const z1 = MS.zTop - (MS.zTop - MS.zBottom) * k / nS, z0 = MS.zTop - (MS.zTop - MS.zBottom) * (k + 1) / nS; const yTop = S0 - (S0 - H) * (k + 1) / nS - 0.5; if (yTop > H + 0.3) collision.addBlocker({ xMin: MS.xMin, xMax: MS.xMax, yMin: H, yMax: yTop, zMin: z0, zMax: z1 }, 'stairMass'); } }
    // street lift: glazed shaft from the concourse up through the slab; doors south (street lobby) and north (concourse)
    const shaft = { x: LIFT_ST.x, z: LIFT_ST.z, w: 2.6, d: 2.6 };
    liftShaft(merger, mat, collision, sm(S.lift('to ticket hall'), { emissive: 0.6 }), sm(S.liftDoorLabel('Lift to ticket hall'), { emissive: 0.5 }), { x: shaft.x, z: shaft.z, y0: S0, y1: TOP_Y, w: shaft.w, d: shaft.d, facing: 'east', tag: 'streetLift' });
    liftShaft(merger, mat, collision, sm(S.lift('to street'), { emissive: 0.6 }), sm(S.liftDoorLabel('Lift to street'), { emissive: 0.5 }), { x: shaft.x, z: shaft.z, y0: H, y1: C, w: shaft.w, d: shaft.d, facing: 'north', tag: 'streetLift' });
    merger.box(mat.concrete, shaft.w + 0.2, 0.7, shaft.d + 0.2, { x: shaft.x, y: C + 0.35, z: shaft.z });   // shaft passes through the slab
    // signage at the entrance: WESTMINSTER STATION fascia over the stair head (both faces), roundels on the flank walls, 'Keep left', notices
    hangSign(merger, mat, sm(S.stationFascia(), { emissive: 0.7 }), sm(S.wayOut('up', [{ n: 4, text: 'Bridge Street' }]), { emissive: 0.7 }), 4.0, 0.42, { x: MS_CX, z: MS.zTop - 0.45, yBottom: TOP_Y - 1.1, facing: 'south', depth: 0.08 });
    const rnd = sm(T.roundel({ text: 'UNDERGROUND' }), { emissive: 0.7, transparent: true });
    merger.quad(rnd, 1.0, 1.0, { x: PX0 + 0.01, y: S0 + 1.9, z: EP.zMax - 1.7, facing: 'east' }); merger.quad(rnd, 1.0, 1.0, { x: PX1 - 0.01, y: S0 + 1.9, z: EP.zMax - 1.7, facing: 'west' });
    wallSign(merger, mat, sm(S.lift('to ticket hall', 'left'), { emissive: 0.6 }), 1.0, 0.34, { x: PX0 + 0.01, y: S0 + 2.5, z: MS.zTop + 0.4, facing: 'east' });
    wallSign(merger, mat, sm(S.noSmoking(), { emissive: 0.4 }), 0.3, 0.22, { x: PX1 - 0.01, y: S0 + 1.5, z: EP.zMax - 0.6, facing: 'west' });
    wallSign(merger, mat, sm(S.cctv(), { emissive: 0.4 }), 0.36, 0.22, { x: PX0 + 0.01, y: S0 + 2.2, z: EP.zMax - 0.7, facing: 'east' });
    wallSign(merger, mat, sm(S.keepLeft(), { emissive: 0.6 }), 0.5, 0.25, { x: PX1 - 0.01, y: S0 + 2.1, z: MS.zTop + 0.3, facing: 'west' });
    wallSign(merger, mat, sm(S.holdHandrail(), { emissive: 0.5 }), 0.25, 0.32, { x: PX0 + 0.01, y: S0 + 1.3, z: MS.zTop + 0.25, facing: 'east' });
    // at the foot of the stairs: 'Way out ↑ 4 Bridge Street' facing north (for those leaving) + a station map board on the east flank
    hangSign(merger, mat, sm(S.wayOut('up', [{ n: 4, text: 'Bridge Street' }]), { emissive: 0.7 }), null, 2.2, 0.42, { x: MS_CX, z: MS.zBottom - 1.4, yBottom: H + 2.0, yRodTop: B, facing: 'north' });
    posterFrame(merger, mat, sm(S.stationMap(), { emissive: 0.55 }), { x: PX1 + 0.36, y: H + 1.5, z: MS.zBottom + 3.0, facing: 'east', w: 1.2, h: 0.9, border: 0.04 });   // on the east flank of the stair mass
    helpPoint(merger, mat, sm(S.helpPoint(), { emissive: 0.5 }), { x: PX0 - 0.35, y: H + 1.2, z: MS.zBottom + 2.2, facing: 'west' });                                      // west flank
    clockObjs.push(wallClock(group, mat, sm(S.clockFace(), { emissive: 0.5 }), { x: MS.xMax - 0.7, y: TOP_Y - 0.3, z: MS.zTop - 0.43, facing: 'north' }));                // clock on the bulkhead's north face over the stair head, read from the hall when climbing
    // CCTV fixed box camera on the stairs, corduroy already placed by stairFlight
    merger.box(mat.white, 0.08, 0.08, 0.25, { x: PX1 - 0.15, y: TOP_Y - 0.4, z: MS.zTop - 0.3, ry: 0.6, rx: 0.4 }, false);
    // street-level lobby: 'Lift to ticket hall' notice + step-free sign
    wallSign(merger, mat, sm(S.stepFreeNotice(), { emissive: 0.6 }), 1.0, 0.33, { x: LOB.xMin + 0.01, y: S0 + 2.3, z: LOB.zMax - 0.4, facing: 'east' });
    // nav
    N('ms-top', MS_CX, S0, MS.zTop + 0.4, ['stairTop', 'mainStairs', 'street']); N('ms-bot', MS_CX, H, MS.zBottom - 1.2, ['stairBottom', 'mainStairs', 'hall', 'unpaid']); E('ms-top', 'ms-bot', { kind: 'stairs' });
    N('ms-pas', MS_CX, S0, EP.zMax - 1.0, ['street', 'entrancePassage']); E('ms-pas', 'ms-top'); N('lift-st-hall', LIFT_ST.x, H, LIFT_ST.z - 2.2, ['hall', 'unpaid', 'lift']); E('lift-st-hall', 'ms-bot');
    spawn.push({ x: MS_CX - 1.5, y: H, z: MS.zBottom - 2.5 }, { x: LIFT_ST.x, y: H, z: LIFT_ST.z - 2.0 });
  } catch (e) { console.warn('[ticketHall] entrance failed', e); }

  // ================================================================ 6. GATELINE + paid-side enclosure (glass screens) around the top of bank (a)
  let gateline = null; const gates = [];
  try {
    const cols = JUBILEE.columns.x.map(x => ({ x, z: JUBILEE.columns.z, r: JUBILEE.columns.diameter / 2 }));
    gateline = createGateline(ctx, { from: GL.from, to: GL.to, count: GL.gates, wideIndex: GL.wideGateIndex ?? 0, y: H, columns: cols, parent: group, S, signMat, mats: mat });
    gates.push(...gateline.gates);
    const L = gateline.line;
    // NW closure: from the first cabinet along the paid-side normal to the north wall
    { const a = gateline.ends.nw; const t = (HZ0 - a.z) / L.normal.y; const b = { x: a.x + L.normal.x * t, z: HZ0 }; glassScreen(merger, mat, collision, a, b, H, { height: 1.8, band: true, tag: 'paidScreen' }); }
    // SE closure: booth → along the line to x = 26.9, then south past the escalator opening, then east along its south side to the east wall
    const encW = ESC_OPEN.xMin - 3.1, encS = ESC_OPEN.zMax + 0.2;
    const tEnd = (encW - L.from.x) / L.dir.x; const pLine = L.at(tEnd);
    glassScreen(merger, mat, collision, gateline.ends.se, pLine, H, { height: 1.8, band: true, tag: 'paidScreen' });
    glassScreen(merger, mat, collision, pLine, { x: encW, z: encS }, H, { height: 1.8, band: true, tag: 'paidScreen' });
    glassScreen(merger, mat, collision, { x: encW, z: encS }, { x: HX1, z: encS }, H, { height: 1.8, band: true, tag: 'paidScreen' });
    // 'Please have your ticket or card ready' and 'Jubilee line' over the gateline (unpaid side reads the line sign; paid side reads Way out)
    const mid = L.at(L.len * 0.42); const yaw = L.yaw;
    hangSign(merger, mat, sm(S.lineSign([pill.jubilee], 'Platforms 3 and 4', 'upright'), { emissive: 0.7 }), sm(S.wayOut('downright', [{ n: 4, text: 'Bridge Street' }, { n: 5, text: 'Whitehall' }, { n: 3, text: 'Houses of Parliament' }]), { emissive: 0.7 }), 2.6, 0.48, { x: mid.x - L.normal.x * 1.6, z: mid.z - L.normal.y * 1.6, yBottom: H + 2.0, yRodTop: B, ry: yaw });
    const mid2 = L.at(L.len * 0.72);
    hangSign(merger, mat, sm(S.ticketReady(), { emissive: 0.7 }), sm(S.wayOut('down', [{ n: 1, text: 'Westminster Pier' }, { n: 2, text: 'Victoria Embankment' }, { n: 6, text: 'Parliament Street' }]), { emissive: 0.7 }), 2.6, 0.48, { x: mid2.x - L.normal.x * 1.6, z: mid2.z - L.normal.y * 1.6, yBottom: H + 2.0, yRodTop: B, ry: yaw });
    // bins on ring stands and a 'See it. Say it. Sorted.' poster near the wide gate; staff post spot marked by a 'Keep left' floor sticker
    const g0 = L.at(gateline.gates[0].along, -3.0); ringBin(merger, mat, { x: g0.x, y: H, z: g0.z }); const g1 = L.at(gateline.gates[GL.gates - 1].along, -3.2); ringBin(merger, mat, { x: g1.x + 1.2, y: H, z: g1.z });
    for (const p of [g0, { x: g1.x + 1.2, z: g1.z }]) collision.addBlocker({ xMin: p.x - 0.25, xMax: p.x + 0.25, yMin: H, yMax: H + 1, zMin: p.z - 0.25, zMax: p.z + 0.25 }, 'bin');
    // nav: gate approach nodes both sides of the middle gates
    const gA = L.at(L.len * 0.5, -2.2), gB = L.at(L.len * 0.5, 2.2); N('gate-unpaid', gA.x, H, gA.z, ['hall', 'unpaid', 'gateline']); N('gate-paid', gB.x, H, gB.z, ['hall', 'paid', 'gateline']); E('gate-unpaid', 'gate-paid', { kind: 'gate', cost: 8 });
  } catch (e) { console.warn('[ticketHall] gateline failed', e); }

  // ================================================================ 7. ESCALATOR BANK (a) TOP: opening guards, signs, next-train summary
  let dm = null;
  try {
    const o = ESC_OPEN; const bandOpts = { height: 1.15, band: true, tag: 'escGuard', post: 3 };
    glassScreen(merger, mat, collision, { x: o.xMin - 0.2, z: o.zMin - 0.2 }, { x: o.xMax - 0.8, z: o.zMin - 0.2 }, H, bandOpts);
    glassScreen(merger, mat, collision, { x: o.xMin - 0.2, z: o.zMin - 0.2 }, { x: o.xMin - 0.2, z: o.zMax + 0.2 }, H, bandOpts);
    // stainless cladding of the opening's edge (the escalator truss below is the box module's)
    merger.box(mat.stainless, o.xMax - o.xMin + 0.4, 0.5, 0.06, { x: (o.xMin + o.xMax) / 2, y: H - 0.25, z: o.zMin }, false); merger.box(mat.stainless, o.xMax - o.xMin + 0.4, 0.5, 0.06, { x: (o.xMin + o.xMax) / 2, y: H - 0.25, z: o.zMax }, false); merger.box(mat.stainless, 0.06, 0.5, o.zMax - o.zMin, { x: o.xMin, y: H - 0.25, z: (o.zMin + o.zMax) / 2 }, false);
    // signs over the top comb: 'Jubilee line ↓' (grey pill), 'Eastbound platform 3 / Westbound platform 4'
    hangSign(merger, mat, sm(S.lineSign([pill.jubilee], 'Platforms 3 and 4', 'down'), { emissive: 0.7 }), sm(S.wayOut('up', [{ n: 4, text: 'Bridge Street, Big Ben' }]), { emissive: 0.7 }), 2.4, 0.48, { x: ESC.top.x + 2.2, z: o.zMin - 1.2, yBottom: H + 2.0, yRodTop: B, facing: 'north' });
    hangSign(merger, mat, sm(S.whitePanel(['#a0a5a9'], [{ text: 'Jubilee line', size: 0.2 }, { text: 'Eastbound  Platform 3   Waterloo, London Bridge, Canary Wharf, Stratford', size: 0.13, weight: 'normal' }, { text: 'Westbound  Platform 4   Green Park, Bond Street, Baker Street, Stanmore', size: 0.13, weight: 'normal' }]), { emissive: 0.55 }), null, 2.6, 0.9, { x: ESC.top.x + 2.4, z: o.zMax + 0.35, yBottom: H + 1.9, yRodTop: B, facing: 'north' });
    wallSign(merger, mat, sm(S.holdHandrail(), { emissive: 0.5 }), 0.25, 0.32, { x: ESC.top.x + 3.2, y: H + 1.25, z: o.zMin - 0.3, facing: 'north', depth: 0.03 });
    // next-train summary dot-matrix on a pole at the north side of the opening, read from the gateline
    dm = T.dotMatrix({ cols: 120, rows: 3, dot: 5, gap: 2 }); dm.set([' Jubilee line', { left: ' P3 Stratford', right: '2 min ' }, { left: ' P4 Stanmore', right: '4 min ' }]);
    const dmW = 1.8, dmH = dmW / dm.aspect; const dmMesh = new THREE.Mesh(new THREE.PlaneGeometry(dmW, dmH), M.screen(dm.texture, 1.4)); dmMesh.position.set(ESC.top.x - 3, H + 2.45 + dmH / 2, o.zMin - 0.9); dmMesh.rotation.y = Math.PI; group.add(dmMesh);
    merger.box(mat.black, dmW + 0.08, dmH + 0.08, 0.12, { x: ESC.top.x - 3, y: H + 2.45 + dmH / 2, z: o.zMin - 0.9 + 0.07 }, false); for (const s of [-1, 1]) merger.tube(mat.stainless, V(ESC.top.x - 3 + s * (dmW / 2 - 0.1), H + 2.45 + dmH, o.zMin - 0.85), V(ESC.top.x - 3 + s * (dmW / 2 - 0.1), B, o.zMin - 0.85), 0.012, 6);
    ctx.register('indicator:hall', { set: lines => dm.set(lines) });
    N('escA-top', ESC.top.x + 2.8, H, ESC.top.z, ['hall', 'paid', 'escTopArea']); N('escA-approach', ESC.top.x + 2.8, H, o.zMin - 3.5, ['hall', 'paid']); E('escA-top', 'escA-approach'); E('escA-approach', 'gate-paid');
  } catch (e) { console.warn('[ticketHall] escalator top failed', e); }

  // ================================================================ 8. DISTRICT & CIRCLE: stair heads, lifts to Platforms 1 and 2, signs (guarding is built by the District module; fallback below)
  try {
    const dcSign = (arrow) => sm(S.lineSign([pill.district, pill.circle], 'Platforms 1 and 2', arrow, { sub: null }), { emissive: 0.7 });
    for (const [st, o, n] of [[st2, open2, 2], [st1, open1, 1]]) {
      const tMid = (st.tMin + st.tMax) / 2; const head = dcToWorld(st.sTop - 0.6, tMid); const apron = dcToWorld(st.sTop - 1.8, tMid);
      const yaw = Math.atan2(DISTRICT.frame.s.x, DISTRICT.frame.s.z);   // faces along +s (down the stair)
      // corduroy at the head + a stainless nosing along the head edge + 'Platform n' sign hung over the head facing the approaching passenger
      merger.box(mat.tactile, st.tMax - st.tMin, 0.012, 0.4, { x: apron.x, y: H + 0.006, z: apron.z, ry: yaw }, false);
      hangSign(merger, mat, dcSign('down'), sm(S.wayOut('up', [{ n: 4, text: 'Bridge Street' }]), { emissive: 0.7 }), 2.2, 0.48, { x: head.x, z: head.z, yBottom: H + 2.0, yRodTop: C - 0.1, ry: yaw + Math.PI });
      const lab = sm(S.whitePanel(['#00782a', '#ffd300'], [{ text: `Platform ${n}`, size: 0.3 }, { text: n === 1 ? 'Westbound  Victoria, Wimbledon, Richmond, Ealing Broadway' : 'Eastbound  Embankment, Tower Hill, Upminster', size: 0.13, weight: 'normal' }]), { emissive: 0.55 });
      const side = dcToWorld(st.sTop - 0.6, st.tMax + 1.6); hangSign(merger, mat, lab, null, 1.6, 0.6, { x: side.x, z: side.z, yBottom: H + 1.75, yRodTop: C - 0.1, ry: yaw + Math.PI, depth: 0.06 });   // white platform panel beside the head
      const top = dcToWorld(st.sTop - 1.5, tMid); N('dc-head' + n, top.x, H, top.z, ['hall', 'dcStairTop', 'dcStairTop' + n]); spawn.push({ x: top.x, y: H, z: top.z });
    }
    // fallback guarding if the District module is not loaded (it normally builds the three-sided balustrade itself)
    let checked = false; const off = ctx.onUpdate(() => { if (checked) return; checked = true; off(); if (ctx.get('district')) return; try { const gm = new Merger(group); for (const st of [st2, st1]) { const a = dcToWorld(st.sTop - 0.3, st.tMin - 0.2), b = dcToWorld(st.sBottom + 0.5, st.tMin - 0.2), c = dcToWorld(st.sBottom + 0.5, st.tMax + 0.2), d = dcToWorld(st.sTop - 0.3, st.tMax + 0.2); glassScreen(gm, mat, collision, a, b, H, { height: 1.1, band: true, tag: 'dcGuard' }); glassScreen(gm, mat, collision, b, c, H, { height: 1.1, band: true, tag: 'dcGuard' }); glassScreen(gm, mat, collision, c, d, H, { height: 1.1, band: true, tag: 'dcGuard' }); } gm.flush({ name: 'dcGuardFallback' }); } catch (e) { console.warn('[ticketHall] dc guard fallback failed', e); } });
    // lifts: glazed shafts with closed doors; P2 door faces north into the hall, P1 door faces west into the stair bay
    liftShaft(merger, mat, collision, sm(S.lift('to Platform 2 — District and Circle lines'), { emissive: 0.6 }), sm(S.liftDoorLabel('Lift to Platform 2'), { emissive: 0.5 }), { x: L2.x, z: L2.z, y0: H, y1: C, facing: 'north', tag: 'liftP2' });
    liftShaft(merger, mat, collision, sm(S.lift('to Platform 1 — District and Circle lines'), { emissive: 0.6 }), sm(S.liftDoorLabel('Lift to Platform 1'), { emissive: 0.5 }), { x: L1.x, z: Math.max(L1.z, BAY1.zMin + 1.4), y0: H, y1: C, facing: 'west', tag: 'liftP1' });
    N('lift-p2', L2.x, H, L2.z - 2.2, ['hall', 'lift']); N('lift-p1', L1.x - 2.2, H, Math.max(L1.z, BAY1.zMin + 1.4), ['hall', 'lift']);
    // direction signs towards the D&C stairs from the middle of the hall (west) and at the P2 bay mouth
    hangSign(merger, mat, sm(S.lineSign([pill.district, pill.circle], 'Platforms 1 and 2', 'left'), { emissive: 0.7 }), sm(S.lineSign([pill.jubilee], 'Platforms 3 and 4', 'right'), { emissive: 0.7 }), 2.6, 0.48, { x: MS_CX - 4.5, z: MS.zBottom - 4.6, yBottom: H + 2.0, yRodTop: B, facing: 'south' });
    hangSign(merger, mat, sm(S.lineSign([pill.district, pill.circle], 'Platform 2', 'left'), { emissive: 0.7 }), sm(S.lineSign([pill.district, pill.circle], 'Platform 1', 'right', { sub: null }), { emissive: 0.7 }), 2.2, 0.48, { x: HX0 - 0.3, z: (BAY2.zMin + BAY2.zMax) / 2, yBottom: H + 2.05, yRodTop: C - 0.1, facing: 'east' });
    hangSign(merger, mat, sm(S.lineSign([pill.district, pill.circle], 'Platform 1', 'down'), { emissive: 0.7 }), null, 2.0, 0.48, { x: (BAY1.xMin + BAY1.xMax) / 2, z: STRIP.zMax + 0.5, yBottom: H + 2.05, yRodTop: C - 0.1, facing: 'north' });
    hangSign(merger, mat, sm(S.lineSign([pill.district, pill.circle], 'Platform 1', 'right'), { emissive: 0.7 }), sm(S.lineSign([pill.district, pill.circle], 'Platform 1', 'left'), { emissive: 0.7 }), 2.0, 0.44, { x: BAY1.xMax + 4, z: (PAVE_Z1 + STRIP.zMax) / 2, yBottom: H + 2.0, yRodTop: CEIL_SUB, facing: 'west' });
  } catch (e) { console.warn('[ticketHall] district heads failed', e); }

  // ================================================================ 9. WEST WALL: cash machines, former ticket windows (Tensa), ticket machines; payphones; hall furniture
  try {
    const cm = TH.cashMachines, tw = TH.ticketWindows, tm = TH.ticketMachines, WP = TH.whitehallPassage;
    // cash machines (4, Euro-capable) recessed in the wall
    const cashN = cm.count || 4; const cashPitch = (cm.zMax - cm.zMin) / cashN;
    for (let i = 0; i < cashN; i++) { const z = cm.zMin + cashPitch * (i + 0.5); merger.box(mat.stainless, 0.1, 1.9, 0.9, { x: HX0 + 0.05, y: H + 0.95, z }, false); merger.box(mat.signBlue, 0.14, 1.1, 0.8, { x: HX0 + 0.07, y: H + 1.45, z }, false); merger.quad(sm(S.cashFascia(), { emissive: 0.7 }), 0.76, 0.24, { x: HX0 + 0.145, y: H + 1.85, z, facing: 'east' }); merger.quad(sm(S.cashScreen(), { emissive: 1.2 }), 0.34, 0.26, { x: HX0 + 0.145, y: H + 1.35, z, facing: 'east' }); merger.box(mat.black, 0.02, 0.05, 0.3, { x: HX0 + 0.15, y: H + 1.05, z: z + 0.15 }, false); merger.box(mat.black, 0.02, 0.03, 0.12, { x: HX0 + 0.15, y: H + 1.13, z: z - 0.2 }, false); for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) merger.box(mat.stainless, 0.012, 0.018, 0.02, { x: HX0 + 0.15, y: H + 1.0 - r * 0.026, z: z - 0.22 + c * 0.03 }, false); }
    hangSign(merger, mat, sm(S.dir('Cash machines', 'up'), { emissive: 0.7 }), sm(S.dir('Cash machines', 'up'), { emissive: 0.7 }), 1.6, 0.4, { x: HX0 + 2.4, z: (cm.zMin + cm.zMax) / 2, yBottom: H + 2.0, yRodTop: B, facing: 'east' });
    // former ticket-office windows either side of the Whitehall passage mouth: dark glazing in stainless frames, blinds, Tensa barriers, notice
    const winBays = [[tw.zMin, WP.zMin - 0.5], [WP.zMax + 0.5, tw.zMax]];
    const tensaPts = [];
    for (const [z0, z1] of winBays) { const n = Math.max(1, Math.floor((z1 - z0) / 1.75)); const wW = (z1 - z0) / n; for (let i = 0; i < n; i++) { const z = z0 + wW * (i + 0.5); merger.box(mat.stainless, 0.08, 1.55, wW - 0.08, { x: HX0 + 0.04, y: H + 1.75, z }, false); merger.box(mat.black, 0.02, 1.35, wW - 0.2, { x: HX0 + 0.085, y: H + 1.75, z }, false); merger.box(mat.stainless, 0.3, 0.05, wW - 0.2, { x: HX0 + 0.15, y: H + 1.0, z }, false); merger.box(mat.white, 0.01, 0.9, wW - 0.24, { x: HX0 + 0.09, y: H + 1.98, z }, false); } tensaPts.push([{ x: HX0 + 1.0, z: z0 + 0.2 }, { x: HX0 + 1.0, z: (z0 + z1) / 2 }, { x: HX0 + 1.0, z: z1 - 0.2 }]); wallSign(merger, mat, sm(S.visitMachines(), { emissive: 0.5 }), 1.0, 0.31, { x: HX0 + 0.13, y: H + 2.55, z: (z0 + z1) / 2, facing: 'east', depth: 0.02 }); }
    for (const pts of tensaPts) tensaRun(merger, mat, collision, pts, H, 'tensa');
    // ticket machines flush in the west wall (contract z -12..-2 overlaps the P2 stair bay: placed at the wall's south end, north of the bay)
    const tmN = tm.count || 5; const tmZ1 = BAY2.zMin - 0.3, tmZ0 = tmZ1 - tmN * 0.86; const machines = [];
    for (let i = 0; i < tmN; i++) { const z = tmZ0 + 0.86 * (i + 0.5); machines.push(createTicketMachine(ctx, { x: HX0 + 0.02, y: H, z, facing: 'east', parent: group, S, signMat, mats: mat })); }
    hangSign(merger, mat, sm(S.dir('Tickets', 'up'), { emissive: 0.7 }), sm(S.dir('Tickets', 'up'), { emissive: 0.7 }), 1.4, 0.4, { x: HX0 + 2.4, z: (tmZ0 + tmZ1) / 2, yBottom: H + 2.0, yRodTop: B, facing: 'east' });
    posterFrame(merger, mat, sm(S.tubeMap(), { emissive: 0.5 }), { x: HX0 + 0.01, y: H + 1.55, z: tmZ0 - 0.9, facing: 'east', w: 0.9, h: 1.2, border: 0.05 });
    N('tm', HX0 + 2.0, H, (tmZ0 + tmZ1) / 2, ['hall', 'unpaid', 'ticketMachine']); N('cash', HX0 + 2.0, H, (cm.zMin + cm.zMax) / 2, ['hall', 'unpaid', 'cashMachine']); N('tw', HX0 + 3.0, H, tw.zMax - 1.5, ['hall', 'unpaid']); chain('cash', 'tw', 'tm');
    // payphones (4) on a stainless stand in the subway strip under the road
    const pp = TH.payphones; for (let i = 0; i < (pp.count || 4); i++) { const x = pp.x - 1.5 + i * 1.0; merger.box(mat.stainless, 0.6, 0.9, 0.5, { x, y: H + 1.55, z: pp.z + 1.9 }, false); merger.box(mat.black, 0.22, 0.28, 0.12, { x, y: H + 1.35, z: pp.z + 1.6 }, false); merger.box(mat.black, 0.06, 0.24, 0.04, { x: x - 0.18, y: H + 1.35, z: pp.z + 1.6 }, false); merger.box(mat.stainless, 0.5, 0.04, 0.3, { x, y: H + 1.05, z: pp.z + 1.75 }, false); merger.box(mat.dark, 0.08, 1.1, 0.08, { x, y: H + 0.55, z: pp.z + 2.05 }, false); }
    merger.quad(sm(S.payphone(), { emissive: 0.6 }), 3.6, 0.28, { x: pp.x, y: H + 2.15, z: pp.z + 1.64, facing: 'north' });
    collision.addBlocker({ xMin: pp.x - 2.1, xMax: pp.x + 2.1, yMin: H, yMax: H + 2.2, zMin: pp.z + 1.6, zMax: pp.z + 2.2 }, 'payphones');
    // hall furniture: help points, extinguishers, CCTV domes, speakers, posters, service status, WiFi, no smoking, bins
    helpPoint(merger, mat, sm(S.helpPoint(), { emissive: 0.5 }), { x: HX0 + 0.0, y: H + 1.2, z: HZ0 + 2.5, facing: 'east' });
    helpPoint(merger, mat, sm(S.helpPoint(), { emissive: 0.5 }), { x: HX1 - 0.0, y: H + 1.2, z: -20, facing: 'west' });
    extinguishers(merger, mat, { x: HX0 + 0.0, y: H + 0.3, z: tw.zMin - 1.2, facing: 'east' }); extinguishers(merger, mat, { x: HX1, y: H + 0.3, z: -30, facing: 'west' }); extinguishers(merger, mat, { x: MS.xMax + 0.35, y: H + 0.3, z: MS.zBottom + 5.5, facing: 'east' });
    wallSign(merger, mat, sm(S.fireAction(), { emissive: 0.5 }), 0.25, 0.32, { x: HX0 + 0.01, y: H + 1.55, z: tw.zMin - 0.6, facing: 'east' }); wallSign(merger, mat, sm(S.breakGlass(), { emissive: 0.6 }), 0.09, 0.09, { x: HX0 + 0.01, y: H + 1.3, z: tw.zMin - 1.9, facing: 'east', depth: 0.04 });
    posterFrame(merger, mat, sm(S.serviceStatus(), { emissive: 0.6 }), { x: HX0 + 0.01, y: H + 1.55, z: HZ0 + 5, facing: 'east', w: 0.9, h: 1.2, border: 0.05 });
    posterFrame(merger, mat, sm(S.seeItSayIt(), { emissive: 0.55 }), { x: HX1 - 0.01, y: H + 1.55, z: -35, facing: 'west' });
    posterFrame(merger, mat, sm(T.poster({ seed: 4, headline: 'Theatre', sub: 'West End · book now' }), { emissive: 0.5 }), { x: HX1 - 0.01, y: H + 1.55, z: -26, facing: 'west' });
    posterFrame(merger, mat, sm(S.priorityNotice(), { emissive: 0.5 }), { x: MS.xMin - 0.36, y: H + 1.55, z: MS.zBottom + 5.0, facing: 'west', w: 0.7, h: 0.5, border: 0.04 });
    wallSign(merger, mat, sm(S.wifi(), { emissive: 0.5 }), 0.3, 0.22, { x: HX0 + 0.01, y: H + 2.4, z: cm.zMax + 1.0, facing: 'east' });
    wallSign(merger, mat, sm(S.noSmoking(), { emissive: 0.45 }), 0.3, 0.22, { x: HX1 - 0.01, y: H + 2.2, z: EMB_MOUTH.zMin - 0.8, facing: 'west' });
    wallSign(merger, mat, sm(S.cctv(), { emissive: 0.45 }), 0.36, 0.22, { x: MS_CX + 0.0, y: H + 2.4, z: HZ0 + 0.01, facing: 'south' });
    // north wall dressing: 4-sheet poster frames, the HMS Westminster plaque and the Wallinger Labyrinth enamel panel (dossier §12.5, §12.9)
    for (const [x, seed, head, sub] of [[-30, 61, 'Autumn', 'Walks along the river'], [-16, 63, 'Music', 'Southbank this weekend'], [22, 65, 'Art', 'Late openings'], [38, 67, 'Cycling', 'Hire a bike near you']]) posterFrame(merger, mat, sm(T.poster({ seed, headline: head, sub }), { emissive: 0.45 }), { x, y: H + 1.55, z: HZ0 + 0.01, facing: 'south' });
    wallSign(merger, mat, sm(S.hmsPlaque(), { emissive: 0.35 }), 0.64, 0.48, { x: 6, y: H + 1.6, z: HZ0 + 0.01, facing: 'south', depth: 0.03 });
    wallSign(merger, mat, sm(S.labyrinth(), { emissive: 0.45 }), 0.6, 0.6, { x: -6, y: H + 1.6, z: HZ0 + 0.01, facing: 'south', depth: 0.02 });
    for (const [x, arrow] of [[-38, 'right'], [30, 'left']]) wallSign(merger, mat, sm(S.wayOut(arrow, [{ n: 4, text: 'Bridge Street' }]), { emissive: 0.7 }), 1.4, 0.35, { x, y: H + 2.35, z: HZ0 + 0.01, facing: 'south', depth: 0.05 });   // (the stairs are towards the middle of the hall)
    for (const [x, z] of [[-30, -22], [-10, -34], [20, -30], [40, -20], [10, -6], [-40, -6], [30, 4], [-20, 5]]) { merger.cyl(mat.white, 0.08, 0.08, 0.04, 16, { x, y: B - 0.02, z }); merger.cyl(mat.black, 0.065, 0.065, 0.02, 16, { x, y: B - 0.05, z }); }   // CCTV domes on the beam soffits
    for (const [x, z, ry] of [[-38.2, -12, Math.PI], [-20.2, -12, Math.PI], [-38.2, -30, 0], [-20.2, -30, 0], [3.4, -30, 0], [21.1, -30, 0], [21.1, -12, Math.PI], [39, -20, 0], [3.4, -8, Math.PI], [-6, 5, 0], [20, 5, 0], [40, 5, 0]]) speakers.push(speaker(merger, mat, { x, y: (z > 2 ? CEIL_SUB : B) - 0.2, z, ry }));
    // ring bins by the stair foot and the machines
    for (const p of [{ x: MS.xMin - 1.0, z: MS.zBottom - 2.5 }, { x: HX0 + 1.6, z: tmZ1 + 0.6 }]) { ringBin(merger, mat, { x: p.x, y: H, z: p.z }); collision.addBlocker({ xMin: p.x - 0.25, xMax: p.x + 0.25, yMin: H, yMax: H + 1, zMin: p.z - 0.25, zMax: p.z + 0.25 }, 'bin'); }
    // 'Way out' exit-list signs at the stair foot: east (Exits 1, 2, 3) and west (Exits 5, 6)
    hangSign(merger, mat, sm(S.wayOut('upright', [{ n: 1, text: 'Westminster Pier' }, { n: 2, text: 'Victoria Embankment' }, { n: 3, text: 'Houses of Parliament' }]), { emissive: 0.7 }), sm(S.wayOut('up', [{ n: 5, text: 'Whitehall' }, { n: 6, text: 'Parliament Street' }]), { emissive: 0.7 }), 2.4, 0.5, { x: MS_CX + 6.5, z: MS.zBottom - 3.0, yBottom: H + 2.0, yRodTop: B, facing: 'west' });
    hangSign(merger, mat, sm(S.wayOut('up', [{ n: 5, text: 'Whitehall' }, { n: 6, text: 'Parliament Street / Whitehall' }]), { emissive: 0.7 }), sm(S.wayOut('upright', [{ n: 1, text: 'Westminster Pier / River Bus' }, { n: 2, text: 'Victoria Embankment' }, { n: 3, text: 'Houses of Parliament' }]), { emissive: 0.7 }), 2.4, 0.5, { x: MS_CX - 7.5, z: MS.zBottom - 3.0, yBottom: H + 2.0, yRodTop: B, facing: 'east' });
  } catch (e) { console.warn('[ticketHall] west wall / furniture failed', e); }

  // ================================================================ 10. EMBANKMENT PASSAGE → Exits 1 & 2 (white glazed brick; dog-legs south to enter the unpaid concourse)
  try {
    const EM = TH.embankmentPassage; const DOG = { xMin: HX1 + 0.6, xMax: HX1 + 4.6, zMin: EM.zMin, zMax: EMB_MOUTH.zMax }; const LOBBY = { xMin: 62, xMax: 70, zMin: -19, zMax: -8 }; const PASS = { xMin: DOG.xMax, xMax: LOBBY.xMin, zMin: EM.zMin, zMax: EM.zMax };
    const brick = mat.brick; const CS = CEIL_SUB;
    // lintel over the mouth (the passage ceiling is lower than the hall's) and the short brick reveal through the wall thickness
    merger.box(mat.concrete, DOG.xMin - HX1 + 0.02, C - (CS - 0.5), EMB_MOUTH.zMax - EMB_MOUTH.zMin + 0.2, { x: (HX1 + DOG.xMin) / 2, y: (C + CS - 0.5) / 2, z: (EMB_MOUTH.zMin + EMB_MOUTH.zMax) / 2 });
    collision.addBlocker({ xMin: HX1, xMax: DOG.xMin, yMin: CS - 0.5, yMax: C, zMin: EMB_MOUTH.zMin, zMax: EMB_MOUTH.zMax }, 'lintel');
    for (const z of [EMB_MOUTH.zMin, EMB_MOUTH.zMax]) merger.box(brick, DOG.xMin - HX1 - 0.28, CS - 0.5 - H, 0.02, { x: (HX1 + 0.3 + DOG.xMin) / 2, y: (H + CS - 0.5) / 2, z: z + (z < -3 ? 0.01 : -0.01) });
    // floors
    const pav = (r) => { merger.flat(mat.paving, r.xMax - r.xMin, r.zMax - r.zMin, { x: (r.xMin + r.xMax) / 2, y: SUB + 0.002, z: (r.zMin + r.zMax) / 2 }); floorRect(r, SUB, 'hard', 'embankmentPassage'); merger.flat(mat.subCeiling, r.xMax - r.xMin, r.zMax - r.zMin, { x: (r.xMin + r.xMax) / 2, y: CS - 0.5, z: (r.zMin + r.zMax) / 2, down: true }); };
    pav(DOG); pav(PASS); pav(LOBBY);
    // 4 steps up into the concourse inside the dog-leg (x 49.95 → 48.3, rising west to the mouth in the east wall)
    stairFlight(merger, mat, collision, { from: { x: DOG.xMin + 1.65, y: SUB, z: (EMB_MOUTH.zMin + EMB_MOUTH.zMax) / 2 }, to: { x: DOG.xMin, y: H, z: (EMB_MOUTH.zMin + EMB_MOUTH.zMax) / 2 }, width: EMB_MOUTH.zMax - EMB_MOUTH.zMin - 0.1, steps: EM.stepsUpIntoConcourse || 4, tag: 'embSteps', handrails: 'both' });
    // walls
    wallX(DOG.xMin, DOG.zMin, EMB_MOUTH.zMin, -1, SUB, CS - 0.5, brick); wallX(DOG.xMax, DOG.zMin, PASS.zMin, 1, SUB, CS - 0.5, brick); wallX(DOG.xMax, PASS.zMax, DOG.zMax, 1, SUB, CS - 0.5, brick); wallZ(DOG.zMax, DOG.xMin, DOG.xMax, 1, SUB, CS - 0.5, brick); wallZ(DOG.zMin, DOG.xMin, DOG.xMax, -1, SUB, CS - 0.5, brick);
    wallZ(PASS.zMin, PASS.xMin, PASS.xMax, -1, SUB, CS - 0.5, brick); wallZ(PASS.zMax, PASS.xMin, PASS.xMax, 1, SUB, CS - 0.5, brick);
    wallX(LOBBY.xMin, LOBBY.zMin, PASS.zMin, -1, SUB, CS - 0.5, brick); wallX(LOBBY.xMin, PASS.zMax, LOBBY.zMax, -1, SUB, CS - 0.5, brick); wallZ(LOBBY.zMin, LOBBY.xMin, LOBBY.xMax, -1, SUB, CS - 0.5, brick); wallZ(LOBBY.zMax, LOBBY.xMin, 65.5, 1, SUB, CS - 0.5, brick);   // (north wall stops where the Exit 2 stair trench takes over)
    // Exit 2: 30 steps (13 + landing + 17) rising EAST from the lobby to the pavement by Boadicea (STREET.exit2); Exit 1: 27 steps rising east onto the river wall pavement (STREET.exit1)
    const ex2 = STREET.exit2, ex1 = STREET.exit1; const E2 = { zMin: ex2.z - 2, zMax: ex2.z + 2 }; const E1 = { zMin: ex1.z - 1.5, zMax: ex1.z + 1.5 };
    const s2 = stairFlight(merger, mat, collision, { from: { x: 65.5, y: SUB, z: ex2.z }, to: { x: ex2.x, y: S0, z: ex2.z }, width: E2.zMax - E2.zMin - 0.1, steps: 30, landings: [{ after: 13, len: 1.5 }], tag: 'exit2', handrails: 'both', centreRail: true, tactile: false });
    const s1 = stairFlight(merger, mat, collision, { from: { x: LOBBY.xMax, y: SUB, z: ex1.z }, to: { x: ex1.x - 0.4, y: S0, z: ex1.z }, width: E1.zMax - E1.zMin - 0.1, steps: 27, landings: [{ after: 12, len: 1.2 }], tag: 'exit1', handrails: 'both', tactile: false });
    // trench walls of both stairs up to street level (cream tiles at the stair heads per the dossier), with the lobby's east wall between/around them
    for (const [E_, x0, x1] of [[E2, 65.5, ex2.x + 0.4], [E1, LOBBY.xMax, ex1.x]]) { wallZ(E_.zMin, x0, x1, -1, SUB, S0 + 0.9, mat.creamTile, 0.25, 'exitTrench'); wallZ(E_.zMax, x0, x1, 1, SUB, S0 + 0.9, mat.creamTile, 0.25, 'exitTrench'); }
    wallX(LOBBY.xMax, LOBBY.zMin, E1.zMin, 1, SUB, CS - 0.5, brick); wallX(LOBBY.xMax, E1.zMax, E2.zMin, 1, SUB, CS - 0.5, brick); wallX(LOBBY.xMax, E2.zMax, LOBBY.zMax, 1, SUB, CS - 0.5, brick);
    // soffits over the stairs (sloped, facing down) — the street module builds the canopies at the heads
    for (const [E_, x0, x1] of [[E2, 65.5, ex2.x], [E1, LOBBY.xMax, ex1.x - 0.4]]) { const f = Math.max(0.15, Math.min(1, (-0.3 - (SUB + 2.3)) / (S0 - SUB))); const xt = x0 + (x1 - x0) * f; const len = Math.hypot(xt - x0, (S0 - SUB) * f); const g = new THREE.PlaneGeometry(len + 0.6, E_.zMax - E_.zMin + 0.5); scaleUV(g, len, 4); g.rotateX(Math.PI / 2); g.rotateZ(Math.atan2(S0 - SUB, x1 - x0)); merger.add(mat.subCeiling, g, { x: (x0 + xt) / 2 - 0.6, y: SUB + 2.3 + (S0 - SUB) * f / 2, z: (E_.zMin + E_.zMax) / 2 }); }   // soffit only over the covered lower part of the flight (stays below the pavement)
    // signs (dossier §12.5 wordings)
    hangSign(merger, mat, sm(S.wayOut('up', [{ n: 1, text: 'Westminster Pier / River Bus' }, { n: 2, text: 'Victoria Embankment' }]), { emissive: 0.7 }), sm(S.dir('Trains, tickets and Exits 3 to 6', 'up', { pills: [pill.jubilee, pill.district, pill.circle] }), { emissive: 0.7 }), 2.2, 0.48, { x: DOG.xMin + 2.0, z: DOG.zMax - 2.0, yBottom: SUB + 2.2, yRodTop: CS - 0.5, facing: 'south' });
    hangSign(merger, mat, sm(S.wayOut('up', [{ n: 1, text: 'Westminster Pier / River Bus' }, { n: 2, text: 'Victoria Embankment' }]), { emissive: 0.7 }), sm(S.dir('Westminster station — all lines', 'up', { pills: [pill.jubilee, pill.district, pill.circle] }), { emissive: 0.7 }), 2.2, 0.48, { x: PASS.xMin + 4, z: (PASS.zMin + PASS.zMax) / 2, yBottom: SUB + 2.2, yRodTop: CS - 0.5, facing: 'west' });
    hangSign(merger, mat, sm(S.exitRows([{ arrow: 'up', n: 2, text: 'Victoria Embankment' }, { arrow: 'upright', n: 1, text: 'Westminster Pier' }]), { emissive: 0.7 }), null, 2.0, 0.7, { x: LOBBY.xMin + 3, z: LOBBY.zMin + 1.2, yBottom: SUB + 2.1, yRodTop: CS - 0.5, facing: 'west' });
    hangSign(merger, mat, sm(S.dir('Westminster Pier   River Bus / River Tours', 'up'), { emissive: 0.7 }), sm(S.exitNumberPlate(1, 'Westminster Pier'), { emissive: 0.7 }), 2.0, 0.45, { x: LOBBY.xMax - 1.6, z: ex1.z, yBottom: SUB + 2.15, yRodTop: CS - 0.5, facing: 'west' });   // over the foot of the Exit 1 stair
    hangSign(merger, mat, sm(S.exitNumberPlate(2, 'Victoria Embankment'), { emissive: 0.7 }), sm(S.wayOut('up', [{ n: 2, text: 'Victoria Embankment' }]), { emissive: 0.7 }), 1.6, 0.5, { x: LOBBY.xMax - 1.6, z: ex2.z, yBottom: SUB + 2.15, yRodTop: CS - 0.5, facing: 'west' });   // over the foot of the Exit 2 stair
    wallSign(merger, mat, sm(S.whitePanel(['#0019a8'], [{ text: 'London Eye · London Dungeon · London Aquarium', size: 0.2 }, { text: 'Exit 1 — cross Westminster Bridge', size: 0.16, weight: 'normal' }]), { emissive: 0.55 }), 1.8, 0.66, { x: LOBBY.xMax - 0.01, y: SUB + 1.6, z: (E1.zMax + E2.zMin) / 2, facing: 'west' });   // on the wall between the two stairs
    wallSign(merger, mat, sm(S.dir('Trains and tickets', 'down', { pills: [pill.jubilee, pill.district, pill.circle] }), { emissive: 0.7 }), 1.8, 0.4, { x: 70.6, y: S0 - 0.9, z: E2.zMin + 0.01, facing: 'south' });
    wallSign(merger, mat, sm(S.publicSubway(), { emissive: 0.6 }), 1.6, 0.25, { x: PASS.xMin + 3, y: SUB + 2.25, z: PASS.zMin + 0.01, facing: 'south' });
    wallSign(merger, mat, sm(S.cyclists(), { emissive: 0.5 }), 0.5, 0.19, { x: LOBBY.xMin + 1.5, y: SUB + 1.9, z: LOBBY.zMax - 0.01, facing: 'north' });
    // blue/white tiled section around the help point, billboards, extinguisher, CCTV, battens, help point
    helpBay(PASS.xMin + 8, PASS.zMin, 'south', SUB, CS - 0.5);
    posterFrame(merger, mat, sm(S.billboard(7, 'Summer by the river', 'Late boats from Westminster Pier'), { emissive: 0.45 }), { x: PASS.xMin + 3.5, y: SUB + 1.5, z: PASS.zMax - 0.01, facing: 'north', w: 3.0, h: 1.5, border: 0.06 });
    posterFrame(merger, mat, sm(S.billboard(11, 'The Thames', 'See it from the water'), { emissive: 0.45 }), { x: DOG.xMax - 0.01, y: SUB + 1.5, z: DOG.zMin + 6, facing: 'west', w: 2.4, h: 1.2, border: 0.06 });
    posterFrame(merger, mat, sm(S.billboard(13, 'Museums', 'Free entry, every day'), { emissive: 0.45 }), { x: LOBBY.xMin + 3.6, y: SUB + 1.5, z: LOBBY.zMin + 0.01, facing: 'north', w: 2.2, h: 1.1, border: 0.06 });   // lobby south wall
    extinguishers(merger, mat, { x: LOBBY.xMin + 0.0, y: SUB + 0.3, z: LOBBY.zMin + 2.0, facing: 'east' });
    for (const [x, z, ry] of [[DOG.xMin + 2, DOG.zMin + 4, 0], [PASS.xMin + 5, PASS.zMin + 1, Math.PI], [LOBBY.xMin + 4, LOBBY.zMin + 1, Math.PI]]) speakers.push(speaker(merger, mat, { x, y: CS - 0.7, z, ry }));
    for (let x = DOG.xMin + 1.5; x < LOBBY.xMax - 1; x += 5) { const z = x < DOG.xMax ? -8 : (x < LOBBY.xMin ? EM.zMin + 3 : -13.5); ctx.lights.tube(group, { x, y: CS - 0.56, z, axis: 'x', length: 1.5, real: false }); }
    for (const [x, z] of [[DOG.xMin + 2, DOG.zMin + 1.5], [LOBBY.xMax - 1, LOBBY.zMax - 1]]) { merger.box(mat.white, 0.08, 0.08, 0.22, { x, y: CS - 0.75, z, ry: 0.8, rx: 0.3 }, false); }
    // nav + spawn
    const dz = (EMB_MOUTH.zMin + EMB_MOUTH.zMax) / 2; N('emb-mouth', HX1 - 2.2, H, dz, ['hall', 'unpaid', 'embankmentPassage']); N('emb-steps', DOG.xMin + 1.3, SUB, dz, ['hall', 'embankmentPassage']); N('emb-dogS', (DOG.xMin + DOG.xMax) / 2, SUB, dz, ['hall', 'embankmentPassage']); N('emb-dogN', (DOG.xMin + DOG.xMax) / 2, SUB, (EM.zMin + EM.zMax) / 2, ['hall', 'embankmentPassage']); N('emb-pass', (PASS.xMin + PASS.xMax) / 2, SUB, (EM.zMin + EM.zMax) / 2, ['hall', 'embankmentPassage']); N('emb-lobby', LOBBY.xMin + 3, SUB, -13, ['hall', 'embankmentPassage']);
    N('exit2-bot', 65.2, SUB, ex2.z, ['hall', 'embankmentPassage', 'stairBottom', 'exit2']); N('exit2-top', ex2.x + 0.8, S0, ex2.z, ['street', 'stairTop', 'exit2', 'riverside']); N('exit1-bot', LOBBY.xMax - 0.6, SUB, ex1.z, ['hall', 'embankmentPassage', 'stairBottom', 'exit1']); N('exit1-top', ex1.x + 0.4, S0, ex1.z, ['street', 'stairTop', 'exit1', 'riverside']);
    chain('emb-mouth', 'emb-steps', 'emb-dogS', 'emb-dogN', 'emb-pass', 'emb-lobby'); E('emb-lobby', 'exit2-bot'); E('exit2-bot', 'exit2-top', { kind: 'stairs' }); E('emb-lobby', 'exit1-bot'); E('exit1-bot', 'exit1-top', { kind: 'stairs' }); E('emb-mouth', 'gate-unpaid');
    spawn.push({ x: LOBBY.xMin + 2, y: SUB, z: -13 }, { x: (DOG.xMin + DOG.xMax) / 2, y: SUB, z: -10 });
    emitters.push(audio.emitter({ position: V(LOBBY.xMin + 4, CS - 0.6, -13), synth: 'hum', params: { freq: 100, level: 0.2 }, gain: 0.15, refDistance: 2, maxDistance: 16 }));
  } catch (e) { console.warn('[ticketHall] embankment passage failed', e); }

  // ================================================================ 11. WHITEHALL PASSAGE → Exit 5, jog north, 4 steps down, toilets, Exit 6
  try {
    const WP = TH.whitehallPassage; const ex5 = STREET.exit5, ex6 = STREET.exit6; const CS = CEIL_SUB; const brick = mat.brick;
    const P1 = { xMin: -80, xMax: WP.xFrom, zMin: WP.zMin, zMax: WP.zMax };                        // hall → Exit 5 lobby
    const P2 = { xMin: -92, xMax: -80, zMin: WP.zMin, zMax: WP.zMax };                            // west of Exit 5
    const JOG = { xMin: -95, xMax: -92 };                                                          // veers left then right: shifts 2 m north
    const P3 = { xMin: -98.6, xMax: -95, zMin: WP.zMin - 2, zMax: WP.zMax - 2 };                   // to the 4 steps down
    const P4 = { xMin: -112, xMax: -99.9, zMin: WP.zMin - 2, zMax: WP.zMax - 2 };                  // under Whitehall to Exit 6 (0.7 m lower)
    const pav = (r, y) => { merger.flat(mat.paving, r.xMax - r.xMin, r.zMax - r.zMin, { x: (r.xMin + r.xMax) / 2, y: y + 0.002, z: (r.zMin + r.zMax) / 2 }); floorRect(r, y, 'hard', 'whitehallPassage'); merger.flat(mat.subCeiling, r.xMax - r.xMin, r.zMax - r.zMin, { x: (r.xMin + r.xMax) / 2, y: CS, z: (r.zMin + r.zMax) / 2, down: true }); };
    pav(P1, H); pav(P2, H); pav(P3, H); pav(P4, SUB);
    // the jog: two diagonal wall pairs; floor as a rotated strip
    const jogA = { x: JOG.xMin, z: (P3.zMin + P3.zMax) / 2 }, jogB = { x: JOG.xMax, z: (P2.zMin + P2.zMax) / 2 }; collision.addRamp(V(jogB.x + 0.5, H, jogB.z), V(jogA.x - 0.5, H, jogA.z), 6.5, { tag: 'whitehallJog', sound: 'hard' });
    { const g = new THREE.PlaneGeometry(4.2, 6.6); scaleUV(g, 4.2, 6.6); g.rotateX(-Math.PI / 2); g.rotateY(-Math.atan2(jogA.z - jogB.z, jogA.x - jogB.x)); merger.add(mat.paving, g, { x: (jogA.x + jogB.x) / 2, y: H + 0.002, z: (jogA.z + jogB.z) / 2 }); const c = g.clone(); c.rotateX(Math.PI); merger.add(mat.subCeiling, c, { x: (jogA.x + jogB.x) / 2, y: CS, z: (jogA.z + jogB.z) / 2 }); }
    wallZ(P1.zMin, P1.xMin, P1.xMax, -1, H, CS, brick); wallZ(P1.zMax, P1.xMin, P1.xMax, 1, H, CS, brick);
    wallZ(P2.zMin, P2.xMin, P2.xMax, -1, H, CS, brick); wallZ(P2.zMax, P2.xMin, P2.xMax, 1, H, CS, brick);
    wall(JOG.xMax, P2.zMin, JOG.xMin, P3.zMin, { x: 0.55, z: -0.83 }, H, CS, brick); wall(JOG.xMax, P2.zMax, JOG.xMin, P3.zMax, { x: -0.55, z: 0.83 }, H, CS, brick);
    wallZ(P3.zMin, P3.xMin - 1.3, P3.xMax, -1, H, CS, brick); wallZ(P3.zMax, P3.xMin - 1.3, P3.xMax, 1, H, CS, brick);
    wallZ(P4.zMin, P4.xMin, P4.xMax, -1, SUB, CS, brick); wallZ(P4.zMax, P4.xMin, P4.xMax, 1, SUB, CS, brick); wallX(P4.xMin, P4.zMin, P4.zMax, -1, SUB, CS, brick);
    // 4 steps down westwards between P3 and P4
    stairFlight(merger, mat, collision, { from: { x: P4.xMax, y: SUB, z: (P4.zMin + P4.zMax) / 2 }, to: { x: P3.xMin, y: H, z: (P3.zMin + P3.zMax) / 2 }, width: P4.zMax - P4.zMin - 0.1, steps: 4, tag: 'whitehallSteps', handrails: 'both' });
    // Exit 5: 11 + 11 steps rising SOUTH out of the passage's south wall (east footway of Parliament Street); Exit 6: 12 + 12 rising south from the far passage
    // (each stair rises out of the south half of its passage: bottom inside the passage band, top at the contract point)
    const E5 = { xMin: ex5.x - 1.5, xMax: ex5.x + 1.5, z0: P1.zMax - 3.7, z1: ex5.z + 3.7, y0: H }, E6 = { xMin: ex6.x - 1.5, xMax: ex6.x + 1.5, z0: P4.zMax - 4.0, z1: ex6.z + 4.4, y0: SUB };
    stairFlight(merger, mat, collision, { from: { x: ex5.x, y: H, z: E5.z0 }, to: { x: ex5.x, y: S0, z: E5.z1 }, width: 2.9, steps: 22, landings: [{ after: 11, len: 1.24 }], tag: 'exit5', handrails: 'both', tactile: false });
    stairFlight(merger, mat, collision, { from: { x: ex6.x, y: SUB, z: E6.z0 }, to: { x: ex6.x, y: S0, z: E6.z1 }, width: 2.9, steps: 24, landings: [{ after: 12, len: 1.2 }], tag: 'exit6', handrails: 'both', tactile: false });
    for (const E_ of [E5, E6]) { wallX(E_.xMin, E_.z0, E_.z1 + 0.4, -1, E_.y0, S0 + 0.9, mat.creamTile, 0.25, 'exitTrench'); wallX(E_.xMax, E_.z0, E_.z1 + 0.4, 1, E_.y0, S0 + 0.9, mat.creamTile, 0.25, 'exitTrench'); wallZ(E_.z1 + 0.4, E_.xMin, E_.xMax, 1, S0 - 0.3, S0 + 0.9, mat.creamTile, 0.25, 'exitTrench');
      const f = Math.max(0.15, Math.min(1, (-0.3 - (E_.y0 + 2.2)) / (S0 - E_.y0))); const zt = E_.z0 + (E_.z1 - E_.z0) * f; const len = Math.hypot(zt - E_.z0, (S0 - E_.y0) * f); const g = new THREE.PlaneGeometry(E_.xMax - E_.xMin + 0.5, len + 0.5); scaleUV(g, 3, len); g.rotateX(Math.PI / 2 - Math.atan2(S0 - E_.y0, E_.z1 - E_.z0)); merger.add(mat.subCeiling, g, { x: (E_.xMin + E_.xMax) / 2, y: E_.y0 + 2.2 + (S0 - E_.y0) * f / 2, z: (E_.z0 + zt) / 2 + 0.6 }); }   // clipped below pavement level
    // signs
    hangSign(merger, mat, sm(S.wayOut('up', [{ n: 5, text: 'Whitehall' }, { n: 6, text: 'Parliament Street / Whitehall' }]), { emissive: 0.7 }), sm(S.dir('Trains, tickets and Exits 1 to 4', 'up', { pills: [pill.jubilee, pill.district, pill.circle] }), { emissive: 0.7 }), 2.4, 0.48, { x: WP.xFrom - 3, z: (WP.zMin + WP.zMax) / 2, yBottom: H + 2.15, yRodTop: CS, facing: 'east' });
    hangSign(merger, mat, sm(S.wayOut('right', [{ n: 5, text: 'Whitehall' }]), { emissive: 0.7 }), sm(S.wayOut('left', [{ n: 5, text: 'Whitehall' }]), { emissive: 0.7 }), 1.8, 0.42, { x: ex5.x + 3.2, z: (WP.zMin + WP.zMax) / 2, yBottom: H + 2.15, yRodTop: CS, facing: 'east' });
    hangSign(merger, mat, sm(S.wayOut('up', [{ n: 6, text: 'Parliament Street / Whitehall' }]), { emissive: 0.7 }), sm(S.dir('Trains and tickets', 'up', { pills: [pill.jubilee, pill.district, pill.circle] }), { emissive: 0.7 }), 2.4, 0.46, { x: -84, z: (WP.zMin + WP.zMax) / 2, yBottom: H + 2.15, yRodTop: CS, facing: 'east' });
    hangSign(merger, mat, sm(S.toilets(), { emissive: 0.7 }), sm(S.wayOut('up', [{ n: 6, text: 'Parliament Street / Whitehall' }]), { emissive: 0.7 }), 1.8, 0.42, { x: P4.xMax - 2, z: (P4.zMin + P4.zMax) / 2, yBottom: SUB + 2.15, yRodTop: CS, facing: 'east' });
    wallSign(merger, mat, sm(S.exitNumberPlate(5, 'Whitehall'), { emissive: 0.7 }), 1.5, 0.47, { x: ex5.x, y: S0 + 0.4, z: E5.z1 + 0.39, facing: 'north' });                          // on the trench end wall, read from the passage looking up the stair
    wallSign(merger, mat, sm(S.exitNumberPlate(6, 'Parliament Street / Whitehall'), { emissive: 0.7 }), 1.5, 0.47, { x: ex6.x, y: S0 + 0.4, z: E6.z1 + 0.39, facing: 'north' });
    wallSign(merger, mat, sm(S.dir('Trains and tickets', 'down', { pills: [pill.jubilee, pill.district, pill.circle] }), { emissive: 0.7 }), 1.8, 0.4, { x: ex5.x + 1.49, y: S0 - 0.9, z: E5.z1 - 1.5, facing: 'west' });
    wallSign(merger, mat, sm(S.publicSubway(), { emissive: 0.6 }), 1.6, 0.25, { x: -60, y: H + 2.25, z: WP.zMin + 0.01, facing: 'south' });
    wallSign(merger, mat, sm(S.stairsAhead(), { emissive: 0.6 }), 1.0, 0.25, { x: P3.xMin + 0.9, y: H + 2.1, z: P3.zMin + 0.01, facing: 'south' });
    // toilets: turnstile door (closed) + 'Toilets 50p' fascia on the north wall of the far passage; parent room door
    { const tx = -104; merger.box(mat.stainless, 1.6, 2.2, 0.06, { x: tx, y: SUB + 1.1, z: P4.zMin + 0.03 }, false); merger.box(mat.dark, 1.5, 0.05, 0.1, { x: tx, y: SUB + 1.0, z: P4.zMin + 0.08 }, false); for (let k = 0; k < 3; k++) merger.box(mat.stainless, 0.03, 0.03, 0.4, { x: tx, y: SUB + 1.0, z: P4.zMin + 0.25, ry: k * Math.PI * 2 / 3 }, false); merger.box(mat.black, 0.6, 0.3, 0.02, { x: tx, y: SUB + 2.0, z: P4.zMin + 0.07 }, false); wallSign(merger, mat, sm(S.toilets(), { emissive: 0.7 }), 1.5, 0.35, { x: tx, y: SUB + 2.35, z: P4.zMin + 0.02, facing: 'south' }); merger.box(mat.dark, 0.9, 2.1, 0.05, { x: tx - 2.2, y: SUB + 1.05, z: P4.zMin + 0.03 }, false); collision.addBlocker({ xMin: tx - 0.8, xMax: tx + 0.8, yMin: SUB, yMax: SUB + 2.2, zMin: P4.zMin - 0.1, zMax: P4.zMin + 0.35 }, 'turnstile'); }
    // tiled help-point section, billboards, battens, CCTV, speakers
    helpBay(-66, WP.zMin, 'south', H, CS);
    posterFrame(merger, mat, sm(S.billboard(21, 'Whitehall', 'Walk it in ten minutes'), { emissive: 0.45 }), { x: -55, y: H + 1.5, z: WP.zMax - 0.01, facing: 'north', w: 3.0, h: 1.5, border: 0.06 });
    posterFrame(merger, mat, sm(S.billboard(23, 'Parks', 'St James\'s Park is four minutes away'), { emissive: 0.45 }), { x: -86, y: H + 1.5, z: WP.zMin + 0.01, facing: 'south', w: 3.0, h: 1.5, border: 0.06 });
    posterFrame(merger, mat, sm(T.poster({ seed: 31, headline: 'Exhibition', sub: 'Open until late' }), { emissive: 0.45 }), { x: -108, y: SUB + 1.5, z: P4.zMax - 0.01, facing: 'north' });
    for (let x = WP.xFrom - 3; x > -110; x -= 5) { const lower = x < -99.5; const z = x < -95 ? (P3.zMin + P3.zMax) / 2 : (WP.zMin + WP.zMax) / 2; ctx.lights.tube(group, { x, y: CS - 0.06, z, axis: 'x', length: 1.5, real: false }); }
    for (const [x, z, ry] of [[-52, WP.zMin + 1, Math.PI], [-70, WP.zMax - 1, 0], [-88, WP.zMin + 1, Math.PI], [-105, P4.zMax - 1, 0]]) speakers.push(speaker(merger, mat, { x, y: CS - 0.2, z, ry }));
    for (const [x, z] of [[WP.xFrom - 1.5, WP.zMin + 0.4], [-90, WP.zMax - 0.4]]) merger.box(mat.white, 0.08, 0.08, 0.22, { x, y: CS - 0.25, z, ry: 2.4, rx: 0.3 }, false);
    extinguishers(merger, mat, { x: -76, y: H + 0.3, z: WP.zMin + 0.0, facing: 'south' });
    // nav + spawn
    const wz = (WP.zMin + WP.zMax) / 2; N('wh-mouth', WP.xFrom - 1.5, H, wz, ['hall', 'unpaid', 'whitehallPassage']); N('wh-mid', -62, H, wz, ['hall', 'whitehallPassage']); N('exit5-bot', ex5.x, H, wz + 1.6, ['hall', 'whitehallPassage', 'stairBottom', 'exit5']); N('exit5-top', ex5.x, S0, ex5.z + 4.4, ['street', 'stairTop', 'exit5', 'parliamentSt']);
    N('wh-p2', -86, H, wz, ['hall', 'whitehallPassage']); N('wh-jog', -93.5, H, wz - 1, ['hall', 'whitehallPassage']); N('wh-p3', -97, H, wz - 2, ['hall', 'whitehallPassage']); N('wh-p4', -102, SUB, wz - 2, ['hall', 'whitehallPassage']); N('exit6-bot', ex6.x, SUB, wz - 0.6, ['hall', 'whitehallPassage', 'stairBottom', 'exit6']); N('exit6-top', ex6.x, S0, ex6.z + 5.0, ['street', 'stairTop', 'exit6', 'parliamentSt']);
    chain('wh-mouth', 'wh-mid', 'exit5-bot'); E('exit5-bot', 'exit5-top', { kind: 'stairs' }); chain('exit5-bot', 'wh-p2', 'wh-jog', 'wh-p3', 'wh-p4', 'exit6-bot'); E('exit6-bot', 'exit6-top', { kind: 'stairs' }); E('wh-mouth', 'tw');
    spawn.push({ x: -62, y: H, z: wz }, { x: -102, y: SUB, z: wz - 2 });
    emitters.push(audio.emitter({ position: V(-70, CS - 0.4, wz), synth: 'hum', params: { freq: 100, level: 0.2 }, gain: 0.14, refDistance: 2, maxDistance: 16 }));
  } catch (e) { console.warn('[ticketHall] whitehall passage failed', e); }

  // ================================================================ 12. BRIDGE STREET SUBWAY STRIP + EXIT 3 (south under the carriageway to the Big Ben pavement)
  try {
    const ex3 = STREET.exit3; const CS = CEIL_SUB;
    // billboards along the strip's south wall; the photographed exit panel at the junction; help point; cyclists dismount
    for (const [x, seed, head, sub] of [[-30, 41, 'Big Ben', 'Tours every hour'], [-8, 43, 'Westminster Abbey', 'Book online'], [14, 45, 'The Thames', 'River Bus from Westminster Pier'], [32, 47, 'London', 'See more of it']]) posterFrame(merger, mat, sm(S.billboard(seed, head, sub), { emissive: 0.45 }), { x, y: H + 1.5, z: STRIP.zMax - 0.01, facing: 'north', w: 3.0, h: 1.5, border: 0.06 });
    hangSign(merger, mat, sm(S.exitRows([{ arrow: 'left', n: 1, text: 'Westminster Pier' }, { arrow: 'left', n: 2, text: 'Victoria Embankment' }, { arrow: 'up', n: 3, text: 'Houses of Parliament' }]), { emissive: 0.7 }), sm(S.dir('Trains, tickets and Exits 4 to 6', 'up', { pills: [pill.jubilee, pill.district, pill.circle] }), { emissive: 0.7 }), 2.2, 0.72, { x: E3.xMin - 2.5, z: STRIP.zMax - 2.0, yBottom: H + 1.9, yRodTop: CS, facing: 'north' });
    hangSign(merger, mat, sm(S.wayOut('right', [{ n: 3, text: 'Houses of Parliament' }]), { emissive: 0.7 }), sm(S.wayOut('left', [{ n: 3, text: 'Houses of Parliament' }]), { emissive: 0.7 }), 2.0, 0.44, { x: E3.xMin - 12, z: (PAVE_Z1 + STRIP.zMax) / 2, yBottom: H + 2.0, yRodTop: CS, facing: 'west' });
    wallSign(merger, mat, sm(S.cyclists(), { emissive: 0.5 }), 0.5, 0.19, { x: -40, y: H + 1.9, z: STRIP.zMax - 0.01, facing: 'north' });
    wallSign(merger, mat, sm(S.publicSubway(), { emissive: 0.6 }), 1.6, 0.25, { x: 0, y: H + 2.25, z: STRIP.zMax - 0.01, facing: 'north' });
    helpBay(2, STRIP.zMax, 'north', H, CS);
    // Exit 3 passage: pass-holders' Parliament door on the LEFT (east wall) heading south, then 4 short flights (24 steps) up to the south pavement
    { const dx = E3.xMax - 0.02, dz = 12; merger.box(mat.stainless, 0.08, 2.3, 1.7, { x: dx - 0.03, y: H + 1.15, z: dz }, false); merger.box(mat.dark, 0.05, 2.1, 1.4, { x: dx - 0.06, y: H + 1.05, z: dz }, false); merger.box(mat.stainless, 0.02, 0.9, 0.05, { x: dx - 0.09, y: H + 1.0, z: dz + 0.4 }, false); wallSign(merger, mat, sm(S.passHolders(), { emissive: 0.55 }), 0.75, 0.5, { x: dx - 0.09, y: H + 1.65, z: dz - 0.0, facing: 'west' }); merger.box(mat.black, 0.06, 0.12, 0.08, { x: dx - 0.07, y: H + 1.25, z: dz + 0.95 }, false); merger.cyl(mat.white, 0.05, 0.05, 0.02, 12, { x: dx - 0.12, y: H + 2.45, z: dz - 0.9, rx: Math.PI / 2, ry: 0 }); }
    const s3 = stairFlight(merger, mat, collision, { from: { x: ex3.x, y: H, z: E3_STAIR_Z0 }, to: { x: ex3.x, y: S0, z: ex3.z }, width: E3.xMax - E3.xMin - 0.1, steps: 24, landings: [{ after: 6, len: 1.0 }, { after: 12, len: 1.0 }, { after: 18, len: 1.0 }], tag: 'exit3', handrails: 'both', tactile: false });
    { const len = Math.hypot(ex3.z - E3_STAIR_Z0, S0 - H); const g = new THREE.PlaneGeometry(E3.xMax - E3.xMin + 0.5, len + 0.6); scaleUV(g, 4, len); g.rotateX(Math.PI / 2 - Math.atan2(S0 - H, ex3.z - E3_STAIR_Z0)); merger.add(mat.subCeiling, g, { x: ex3.x, y: (S0 + H) / 2 + 2.2, z: (E3_STAIR_Z0 + ex3.z) / 2 + 0.5 }); }
    wallZ(ex3.z + 0.5, E3.xMin, E3.xMax, 1, S0 - 0.3, S0 + 0.9, mat.creamTile, 0.25, 'exitTrench');
    hangSign(merger, mat, sm(S.wayOut('up', [{ n: 3, text: 'Houses of Parliament' }]), { emissive: 0.7 }), sm(S.dir('Trains and tickets', 'up', { pills: [pill.jubilee, pill.district, pill.circle] }), { emissive: 0.7 }), 1.8, 0.42, { x: ex3.x, z: STRIP.zMax + 2.5, yBottom: H + 2.15, yRodTop: CS, facing: 'north' });
    wallSign(merger, mat, sm(S.exitNumberPlate(3, 'Houses of Parliament — Big Ben'), { emissive: 0.7 }), 1.5, 0.47, { x: ex3.x, y: H + 2.05, z: E3_STAIR_Z0 + 0.9, facing: 'north' });
    wallSign(merger, mat, sm(S.dir('Trains and tickets', 'down', { pills: [pill.jubilee, pill.district, pill.circle] }), { emissive: 0.7 }), 1.8, 0.4, { x: ex3.x, y: S0 - 0.9, z: ex3.z + 0.45, facing: 'north' });
    posterFrame(merger, mat, sm(T.poster({ seed: 51, headline: 'Parliament', sub: 'Tours on Saturdays' }), { emissive: 0.45 }), { x: E3.xMin + 0.01, y: H + 1.5, z: 14, facing: 'east' });
    merger.box(mat.white, 0.08, 0.08, 0.22, { x: E3.xMin + 0.3, y: CS - 0.25, z: STRIP.zMax + 1, ry: -2.4, rx: 0.3 }, false);
    N('e3-mouth', ex3.x, H, STRIP.zMax + 1.5, ['hall', 'unpaid', 'subway', 'exit3Passage']); N('e3-mid', ex3.x, H, (STRIP.zMax + E3_STAIR_Z0) / 2, ['hall', 'unpaid', 'exit3Passage']); N('exit3-bot', ex3.x, H, E3_STAIR_Z0 - 0.8, ['hall', 'unpaid', 'stairBottom', 'exit3']); N('exit3-top', ex3.x, S0, ex3.z + 0.8, ['street', 'stairTop', 'exit3']);
    chain('e3-mouth', 'e3-mid', 'exit3-bot'); E('exit3-bot', 'exit3-top', { kind: 'stairs' }); E('e3-mouth', 'emb-mouth');
    spawn.push({ x: ex3.x, y: H, z: (STRIP.zMax + E3_STAIR_Z0) / 2 });
  } catch (e) { console.warn('[ticketHall] subway strip / exit 3 failed', e); }

  // ================================================================ 13. LIGHTING: ≤ 10 real point lights + emissive fixtures already placed
  try {
    const pts = [[-32, -30], [-12, -32], [8, -30], [30, -30], [-30, -12], [-8, -14], [14, -12], [36, -10], [8, 5], [66, -13]];
    for (const [x, z] of pts) { const y = z > 2 ? CEIL_SUB - 0.4 : (x > 60 ? CEIL_SUB - 0.75 : B - 0.15); ctx.lights.point(group, { x, y, z, color: 0xfff1df, intensity: x > 60 ? 12 : (z > 2 ? 22 : 42), distance: x > 60 || z > 2 ? 22 : 28, decay: 2 }); }
  } catch (e) { console.warn('[ticketHall] lights failed', e); }

  // ================================================================ 14. AUDIO: luminaire/vent hum in the hall, street leak down the stairs
  try {
    for (const [x, z] of [[-24, -24], [12, -22], [36, -14]]) emitters.push(audio.emitter({ position: V(x, B, z), synth: 'hum', params: { freq: 100, level: 0.22 }, gain: 0.13, refDistance: 3, maxDistance: 20 }));
    audio.registerSynth('hall:ventilation', (c, { level = 0.3 } = {}) => { const out = c.createGain(); out.gain.value = level; const n = c.createBufferSource(); const len = c.sampleRate * 2; const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0); let s = 7; for (let i = 0; i < len; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; } n.buffer = b; n.loop = true; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.6; const lfo = c.createOscillator(); lfo.frequency.value = 0.08; const lg = c.createGain(); lg.gain.value = 60; lfo.connect(lg); lg.connect(lp.frequency); n.connect(lp); lp.connect(out); return { output: out, start() { n.start(); lfo.start(); }, stop() { try { n.stop(); lfo.stop(); } catch (e) { /* */ } } }; });
    emitters.push(audio.emitter({ position: V(HX1 - 1, B, -34), synth: 'hall:ventilation', params: { level: 0.35 }, gain: 0.2, refDistance: 3, maxDistance: 22 }));
    emitters.push(audio.emitter({ position: V(MS_CX, S0 + 1.5, MS.zTop - 0.5), synth: 'traffic', gain: 0.12, refDistance: 3, maxDistance: 26 }));   // street noise spilling down the open stairs
  } catch (e) { console.warn('[ticketHall] audio failed', e); }

  // ================================================================ 15. finish: merge, register, update loop
  merger.flush({ name: 'ticketHall-static' });
  scene.add(group);
  try {
    // link the hall's own nodes together (the NPC system stitches them to its default grid within 3.5 m)
    N('se-corner', 20, H, -3, ['hall', 'unpaid']); N('paid-mid', 24, H, -22, ['hall', 'paid']); N('west-mid', -30, H, -14, ['hall', 'unpaid']);
    chain('ms-bot', 'gate-unpaid'); chain('ms-bot', 'west-mid', 'tm'); chain('ms-bot', 'se-corner', 'emb-mouth'); chain('west-mid', 'wh-mouth'); E('tm', 'dc-head2'); E('lift-p2', 'west-mid'); E('e3-mouth', 'lift-p1'); E('lift-p1', 'dc-head1'); chain('gate-paid', 'paid-mid', 'escA-approach');
    ctx.register('nav:ticketHall', { nodes: navNodes, edges: navEdges });
    ctx.register('spawn:ticketHall', spawn);
    ctx.register('speakers:ticketHall', speakers);
    ctx.register('gates', gates);
  } catch (e) { console.warn('[ticketHall] registration failed', e); }

  // clock hands + next-train summary (from the train service when it is running)
  let acc = 0.9;
  ctx.onUpdate(dt => {
    acc += dt; if (acc < 1) return; acc = 0;
    try { const now = ctx.stationTime ? ctx.stationTime() : new Date(); const h = now.getHours() % 12 + now.getMinutes() / 60, m = now.getMinutes() + now.getSeconds() / 60, s = now.getSeconds(); for (const c of clockObjs) { c.hour.rotation.z = -h / 12 * Math.PI * 2; c.minute.rotation.z = -m / 60 * Math.PI * 2; c.second.rotation.z = -s / 60 * Math.PI * 2; } } catch (e) { /* ignore */ }
    try { const svc = ctx.get('trainService'); if (svc && dm) { const a = svc.nextTrains(3) || [], b = svc.nextTrains(4) || []; const fmt = t => t ? { left: `${t.destination}`, right: t.minutes <= 0 ? 'Due' : `${Math.round(t.minutes)} min` } : ''; dm.set([' Jubilee line', fmt(a[0]) ? { left: ' P3 ' + a[0].destination, right: fmt(a[0]).right + ' ' } : ' P3 Eastbound', fmt(b[0]) ? { left: ' P4 ' + b[0].destination, right: fmt(b[0]).right + ' ' } : ' P4 Westbound']); } } catch (e) { /* ignore */ }
  });

  const api = { group, gates, gateline, speakers, spawn, nav: { nodes: navNodes, edges: navEdges }, emitters, indicator: dm };
  ctx.register('ticketHall', api);
  return api;
}

