// ---------------------------------------------------------------------------
// jubileePlatforms.js — the two STACKED Jubilee line platform tunnels at Westminster:
// Platform 3 (eastbound, UPPER, y = LEVELS.jubUpper) directly above Platform 4
// (westbound, LOWER, y = LEVELS.jubLower). Each is a 7.0 m i.d. bored tunnel under
// Bridge Street with the 126 m platform on its NORTH (box) side, the Westinghouse
// platform edge door screen on the z = JUBILEE.pedZ line and the track in the
// south half. Built here:
//   * tunnel lining: light-grey perforated aluminium panels on the dark rib grid
//     (platform side), dark bolted panels alternating 'WESTMINSTER' roundels with
//     cross-track ad frames (track side), grey ceiling panels with the continuous
//     light trough and the lighting/cable spine over the PED line, terrazzo floor
//     with the dark blister band and a worn yellow line inboard of the screen;
//   * the PED screen (entities/platformEdgeDoors.js) — registered 'peds:upper' /
//     'peds:lower' with setOpen(bool);
//   * the two short JLE cross-passages per platform (iron ribs, enamel infill)
//     north through the lining and the box wall into the wells at x = ±20;
//   * platform ends: end walls, headwalls with the running-tunnel portals, 80 m of
//     dark running tunnel each way with signals, tunnel telephone wires and the
//     track (core/track.js) along layout.TRACKS.jubileeUpper / jubileeLower;
//   * the emergency stair at the west end connecting the two platforms;
//   * set dressing from entities/platformFurniture.js (benches, help points, CCTV,
//     speakers, fire points, posters, roundels, name panels, line diagrams, way-out
//     signs, dot-matrix indicators registered 'indicator:3' / 'indicator:4', clock);
//   * collision (floors, walls, benches, PED screen with removable door blockers),
//     audio emitters (PED movement, luminaire hum), 6 real lights + emissives.
// Everything positioned from layout.js — no hard-coded levels.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LEVELS, JUBILEE, TRACKS, PALETTE } from '../core/layout.js';
import { Track, buildTrackMesh } from '../core/track.js';
import { STOCK_1996, doorPositions } from '../entities/trainSpec.js';
import { createPlatformEdgeDoors } from '../entities/platformEdgeDoors.js';
import * as F from '../entities/platformFurniture.js';
import * as K from './jubileePlatformKit.js';

const D2R = Math.PI / 180;
const CEIL_H = 3.5;             // false ceiling above the platform surface
const PASSAGE_H = 3.0;          // crown of the cross-passage vault
const PASSAGE_SPRING = 2.15;    // where the vault springs from the vertical enamel walls
const STAIR_DOOR_X = -61.5;     // emergency stair door in the platform back wall (west end)
const STAIR_DOOR_W = 1.2, STAIR_DOOR_H = 2.2;
const HEADWALL_X = 67;          // platform tunnel ends here (both ends); the running tunnels leave through the portal
const RUNNING_LEN = 80;         // metres of running tunnel modelled beyond each headwall
const RUN_AXIS_ABOVE_RAIL = 1.35;
const END_SLAB_Z = 4.2;         // platform slab reaches slightly beyond the PED line (threshold coping)

// ---------------------------------------------------------------------------
export function build(ctx) {
  const group = new THREE.Group(); group.name = 'jubileePlatforms';
  const result = { group, platforms: {}, platformEdgeDoors: {} };
  const shared = makeShared(ctx);
  for (const key of ['upper', 'lower']) {
    try { const p = buildPlatform(ctx, group, key, shared); result.platforms[key] = p; result.platformEdgeDoors[key] = p.peds; }
    catch (e) { console.error('[jubileePlatforms] platform build failed', key, e); }
  }
  try { buildEmergencyStairs(ctx, group, shared); } catch (e) { console.error('[jubileePlatforms] emergency stairs failed', e); }
  // The two tunnels are separated by c. 3 m of clay: from one platform the other can never be seen, yet its bounds sit inside
  // the frustum below/above the floor, so cull it by camera height (both stay visible while in the stair shaft between them).
  try {
    const up = result.platforms.upper && result.platforms.upper.group, lo = result.platforms.lower && result.platforms.lower.group;
    if (up && lo) ctx.onUpdate(() => {
      const cam = ctx.camera; if (!cam) return; const y = cam.position.y;
      const showLower = y < LEVELS.jubUpper - 1.0, showUpper = y > LEVELS.jubLower + 4.0;
      if (lo.visible !== showLower) lo.visible = showLower; if (up.visible !== showUpper) up.visible = showUpper;
    });
  } catch (e) { console.warn('[jubileePlatforms] level culling failed', e); }
  ctx.scene.add(group);
  return result;
}

// Materials, textures and geometries shared by both platforms (built once).
function makeShared(ctx) {
  const { M, T } = ctx;
  const s = {};
  s.wall = K.jubileeWallMaterial(T, { emissive: 0.16 });
  s.trackside = K.tracksidePanelMaterial(T, { emissive: 0.08 });
  s.ceiling = K.ceilingPanelMaterial(T, { emissive: 0.14 });
  s.enamel = K.enamelPanelMaterial(T, { emissive: 0.2 });
  s.running = K.runningTunnelMaterial(T);
  s.terrazzo = F.terrazzoMaterial(ctx, { seed: 6 }); s.terrazzo.emissive = new THREE.Color(0xffffff); s.terrazzo.emissiveMap = s.terrazzo.map; s.terrazzo.emissiveIntensity = 0.07;
  s.invert = M.concrete({ base: 0x5c5a57, dark: 0x3a3937, seed: 31, stain: 0.5, boardMarks: false, tieHoles: false });
  s.slabFace = M.precast({ base: 0x8e8c87 });
  s.headwall = M.concrete({ base: 0x6f6d6a, dark: 0x4a4947, seed: 44, stain: 0.45, boardMarks: true, tieHoles: true });
  s.rib = M.paint(0x8c9094, { roughness: 0.45, metalness: 0.7 });          // silver-grey passage ribs
  s.ribDark = M.paint(PALETTE.jubileeRib, { roughness: 0.5, metalness: 0.4 });
  s.spine = M.paint(0x35383b, { roughness: 0.6, metalness: 0.4 });
  s.grille = M.perforated();
  s.stainless = M.stainless(); s.stainlessV = M.stainless({ vertical: true });
  s.black = M.paint(0x141517, { roughness: 0.6, metalness: 0.3 });
  s.cable = M.paint(0x2a2c2f, { roughness: 0.85, metalness: 0.1 });
  s.tray = M.paint(0x6e7276, { roughness: 0.55, metalness: 0.6 });
  s.doorGrey = M.paint(0x8a8e92, { roughness: 0.5, metalness: 0.35 });
  s.lum = M.luminaire(0xf3f1e9, 2.6);
  s.lumWarm = M.luminaire(0xfff1dc, 2.0);
  s.redLamp = M.luminaire(0xff1a1a, 2.2); s.greenLamp = M.luminaire(0x2cff5c, 1.8);
  s.railMat = M.paint(0x6b6560, { roughness: 0.55, metalness: 0.75 });
  s.stairConcrete = K.stairConcrete(M); s.stairConcrete.emissive = new THREE.Color(0x9a9894); s.stairConcrete.emissiveIntensity = 0.08;
  s.nosing = M.paint(0xe6dcb8, { roughness: 0.7, metalness: 0 });
  s.glass = M.glass({ opacity: 0.18 });
  return s;
}

// ---------------------------------------------------------------------------
// One platform tunnel.
// ---------------------------------------------------------------------------
function buildPlatform(ctx, parent, key, S) {
  const { M, T, collision, audio } = ctx;
  const P = JUBILEE[key]; const L = P.y; const number = P.number; const isUpper = key === 'upper';
  const railY = L + JUBILEE.railOffset, axisY = railY + JUBILEE.tunnelAxisYOffset, axisZ = JUBILEE.tunnelAxisZ, R = JUBILEE.tunnelRadius;
  const X0 = JUBILEE.xMin, X1 = JUBILEE.xMax, PED_Z = JUBILEE.pedZ, TRACK_Z = JUBILEE.trackZ;
  const CEIL = L + CEIL_H;
  const g = new THREE.Group(); g.name = `jubileePlatform-${number}`; parent.add(g);
  const tag = `jub${number}`;
  const batch = F.createBatcher();

  // ---- key section geometry (derived, never hard-coded)
  const floorBackZ = K.liningZ(L, R, axisY, axisZ, 'north');        // where the platform floor meets the curved lining (≈ 0.7)
  const ceilBackZ = K.liningZ(CEIL, R, axisY, axisZ, 'north');      // where the false ceiling meets the lining
  const phiFloor = K.phiAtY(L, R, axisY, 'north'), phiCeil = K.phiAtY(CEIL, R, axisY, 'north');
  const invertY = railY - 0.16;                                     // concrete invert (track slab) top
  const phiInvS = K.phiAtY(invertY, R, axisY, 'south'), phiInvN = K.phiAtY(invertY, R, axisY, 'north');
  const invZ0 = K.liningZ(invertY, R, axisY, axisZ, 'north'), invZ1 = K.liningZ(invertY, R, axisY, axisZ, 'south');
  const runAxisY = railY + RUN_AXIS_ABOVE_RAIL, runR = JUBILEE.runningTunnelRadius;

  // openings in the platform-side lining: the two cross-passages and the emergency-stair door
  const openings = JUBILEE.passages.map(p => ({ x0: p.x - p.width / 2, x1: p.x + p.width / 2, h: PASSAGE_H, kind: 'passage', x: p.x, width: p.width }));
  openings.push({ x0: STAIR_DOOR_X - STAIR_DOOR_W / 2, x1: STAIR_DOOR_X + STAIR_DOOR_W / 2, h: STAIR_DOOR_H, kind: 'stairDoor', x: STAIR_DOOR_X, width: STAIR_DOOR_W });
  openings.sort((a, b) => a.x0 - b.x0);

  // ---- lining: platform-side wall (light panels) with openings
  const wallGeos = []; let cursor = X0;
  for (const o of openings) { if (o.x0 > cursor + 0.01) wallGeos.push(K.liningBand(cursor, o.x0, phiFloor, phiCeil, R, axisY, axisZ, { vOrigin: phiFloor })); wallGeos.push(K.liningBand(o.x0, o.x1, K.phiAtY(L + o.h, R, axisY, 'north'), phiCeil, R, axisY, axisZ, { vOrigin: phiFloor })); cursor = o.x1; }
  if (X1 > cursor) wallGeos.push(K.liningBand(cursor, X1, phiFloor, phiCeil, R, axisY, axisZ, { vOrigin: phiFloor }));
  addMerged(g, wallGeos, S.wall, 'wall');
  // beyond the platform ends the whole ring is dark (no platform): from the invert on the north side round the crown to the invert on the south side
  const darkGeos = [];
  darkGeos.push(K.liningBand(X0, X1, phiCeil, phiInvS, R, axisY, axisZ, { vOrigin: phiCeil }));                 // over the platform ceiling, the crown and the wall behind the track
  darkGeos.push(K.liningBand(-HEADWALL_X, X0, phiInvN, phiInvS, R, axisY, axisZ, { vOrigin: phiInvN }));
  darkGeos.push(K.liningBand(X1, HEADWALL_X, phiInvN, phiInvS, R, axisY, axisZ, { vOrigin: phiInvN }));
  addMerged(g, darkGeos, S.trackside, 'trackside');
  // concrete invert (flat track slab) the full length, with a central drainage channel; the lining below it is never seen
  addMerged(g, [K.xzQuad(invertY, -HEADWALL_X, HEADWALL_X, invZ0, invZ1, 'up')], S.invert, 'invert');
  g.add(box(S.cable, HEADWALL_X * 2, 0.06, 0.35, 0, invertY + 0.02, TRACK_Z));                                      // dark drain channel cover between the rails
  // platform slab: terrazzo floor + the track-side face down to the invert
  const floor = ctx.floorPlane(X1 - X0, END_SLAB_Z - floorBackZ, S.terrazzo, { x: (X0 + X1) / 2, y: L, z: (floorBackZ + END_SLAB_Z) / 2 }); g.add(floor);
  addMerged(g, [K.xyQuad(END_SLAB_Z, X0 - 0.3, X1 + 0.3, invertY, L, 'south')], S.slabFace, 'slabFace');
  g.add(box(S.stainless, X1 - X0, 0.04, 0.12, 0, L - 0.02, END_SLAB_Z - 0.06));                                       // stainless edge trim under the PED threshold
  collision.addFloor({ xMin: X0, xMax: X1, zMin: floorBackZ, zMax: END_SLAB_Z, y: L, tag: tag + ':platform', sound: 'hard' });
  collision.addFloor({ xMin: -HEADWALL_X, xMax: HEADWALL_X, zMin: invZ0 + 0.2, zMax: invZ1 - 0.2, y: invertY, tag: tag + ':track', sound: 'hard' });
  collision.addBlocker({ xMin: X0 - 0.5, xMax: X1 + 0.5, yMin: invertY - 0.5, yMax: L - 0.02, zMin: floorBackZ, zMax: END_SLAB_Z }, tag + ':slab');
  // platform-edge kit (dossier §6.2 verdict): dark blister band + a faint worn yellow line inboard of the screen; no MIND THE GAP on the Jubilee
  F.addYellowLineAndTactiles(ctx, g, { xMin: X0 + 0.3, xMax: X1 - 0.3, y: L, zEdge: PED_Z, inward: -1, tactileSetback: 0.12, tactileDepth: 0.4, yellowSetback: 0.65, wear: 0.7, mindTheGap: false, batch: null });
  // back-wall blocker (the curved lining) with gaps at the openings; the ceiling; the end walls
  cursor = X0;
  for (const o of openings) { if (o.x0 > cursor) collision.addBlocker({ xMin: cursor, xMax: o.x0, yMin: L, yMax: CEIL, zMin: floorBackZ - 0.5, zMax: floorBackZ + 0.05 }, tag + ':backWall'); cursor = o.x1; }
  collision.addBlocker({ xMin: cursor, xMax: X1, yMin: L, yMax: CEIL, zMin: floorBackZ - 0.5, zMax: floorBackZ + 0.05 }, tag + ':backWall');

  // ---- false ceiling over the platform + the continuous light trough + the lighting/cable spine over the PED line
  addMerged(g, [K.xzQuad(CEIL, X0, X1, ceilBackZ, PED_Z + 0.75, 'down')], S.ceiling, 'ceiling');
  {
    const troughZ = 2.35; const revealGeos = [];
    // continuous luminaire strip recessed in a dark reveal; short dark 'breaks' every 12 m read as fitting joints
    g.add(box(S.lum, X1 - X0, 0.05, 0.28, (X0 + X1) / 2, CEIL - 0.06, troughZ));
    revealGeos.push(new THREE.BoxGeometry(X1 - X0, 0.12, 0.08).translate((X0 + X1) / 2, CEIL - 0.05, troughZ - 0.19), new THREE.BoxGeometry(X1 - X0, 0.12, 0.08).translate((X0 + X1) / 2, CEIL - 0.05, troughZ + 0.19));
    for (let x = X0 + 12; x < X1; x += 12) revealGeos.push(new THREE.BoxGeometry(0.06, 0.1, 0.3).translate(x, CEIL - 0.06, troughZ));
    // spine: a boxed services duct over the PED line with perforated grille faces and downlight slots; the gap beneath it (PED header top → spine) stays open for airflow
    const spineY0 = L + 2.95, spineZ0 = PED_Z - 0.45, spineZ1 = PED_Z + 0.75;
    revealGeos.push(new THREE.BoxGeometry(X1 - X0, CEIL - spineY0, spineZ1 - spineZ0).translate((X0 + X1) / 2, (CEIL + spineY0) / 2, (spineZ0 + spineZ1) / 2));
    addMerged(g, revealGeos, S.spine, 'spine');
    addMerged(g, [K.xyQuad(spineZ0 - 0.005, X0, X1, spineY0 + 0.08, CEIL - 0.08, 'north')], S.grille, 'spineGrille');
    // luminaire strip on the spine underside washing the PED header and doors; uplighter strip on the PED header top facing the crown
    g.add(box(S.lum, X1 - X0, 0.03, 0.14, (X0 + X1) / 2, spineY0 - 0.015, PED_Z - 0.1));
    g.add(box(S.lumWarm, X1 - X0, 0.04, 0.1, (X0 + X1) / 2, L + 2.56, PED_Z + 0.22));
    // speakers every 8 m hang under the spine; register positions for the soundscape module
    const speakerPositions = [];
    for (let x = X0 + 5; x < X1 - 3; x += 8) { const sp = F.addSpeaker(ctx, g, { x, y: spineY0, z: PED_Z - 0.35, facing: 'north', mount: 'ceiling', batch }); speakerPositions.push(sp.position); }
    ctx.register(`speakers:jubilee${isUpper ? 'Upper' : 'Lower'}`, speakerPositions);
    // sparse luminaire hum along the spine
    for (const x of [-45, -15, 15, 45]) audio.emitter({ position: new THREE.Vector3(x, spineY0, PED_Z), synth: 'hum', params: { freq: 100, level: 0.2 }, gain: 0.12, refDistance: 2, maxDistance: 14 });
    // real lights: three per platform inside the box, high under the ceiling
    for (const x of [-27, 0, 27]) ctx.lights.point(g, { x, y: CEIL - 0.25, z: 2.4, color: 0xf2efe4, intensity: 34, distance: 42, decay: 2 });
  }

  // ---- trackside dressing seen through the glass: cable trays, roundels alternating with 3.5 × 1.5 m cross-track ad frames
  {
    const trayY = L + 0.35, trayZ = K.liningZ(trayY, R, axisY, axisZ, 'south') - 0.2;
    const trayGeos = [new THREE.BoxGeometry(HEADWALL_X * 2, 0.08, 0.3).translate(0, trayY, trayZ), new THREE.BoxGeometry(HEADWALL_X * 2, 0.2, 0.02).translate(0, trayY + 0.1, trayZ + 0.15)];
    for (let x = -HEADWALL_X + 1; x < HEADWALL_X; x += 2) trayGeos.push(new THREE.BoxGeometry(0.05, 0.32, 0.34).translate(x, trayY + 0.1, trayZ));
    addMerged(g, trayGeos, S.tray, 'tray');
    addMerged(g, [new THREE.BoxGeometry(HEADWALL_X * 2, 0.09, 0.26).translate(0, trayY + 0.06, trayZ)], S.cable, 'cables');
    const roundelZ = K.liningZ(L + 1.65, R, axisY, axisZ, 'south') - 0.06;
    const adZ = K.liningZ(L + 1.75, R, axisY, axisZ, 'south') - 0.1;
    let seed = number * 7;
    for (let x = -56; x <= 56; x += 8) {
      const k = Math.round((x + 56) / 8);
      if (k % 2 === 0) F.addRoundelBoard(ctx, g, { x, y: L, z: roundelZ, facing: 'north', size: 1.0, centre: 1.65, frame: true, batch });
      else F.addPosterFrame(ctx, g, { x, y: L, z: adZ, facing: 'north', w: 3.5, h: 1.5, bottom: 1.0, seed: seed++, batch, border: 0.06 });
    }
    // 'WESTMINSTER' name panels at the ends of the trackside wall too
    for (const x of [-61, 61]) F.addNamePanel(ctx, g, { x, y: L, z: adZ, facing: 'north', w: 2.4, centre: 1.9, batch });
  }

  // ---- PEDs: door leaves at the train doorways (train-longitudinal s → world x; P3 faces +x, P4 faces -x)
  const dirSign = isUpper ? 1 : -1;
  const pc = (isUpper ? TRACKS.jubileeUpper : TRACKS.jubileeLower).platformCentre;
  const doorways = doorPositions(STOCK_1996).map(d => ({ x: pc[0] + dirSign * d.s, width: d.width, leaves: d.leaves, car: d.car })).sort((a, b) => a.x - b.x);
  const nearestDouble = (tx) => { let best = -1, bd = 1e9; doorways.forEach((d, i) => { if (d.leaves === 2 && Math.abs(d.x - tx) < bd) { bd = Math.abs(d.x - tx); best = i; } }); return best; };
  const levelBoarding = [nearestDouble(JUBILEE.passages[0].x), nearestDouble(JUBILEE.passages[1].x)];
  const soundPositions = [-42, -14, 14, 42].map(x => new THREE.Vector3(x, L + 1.2, PED_Z));
  const peds = createPlatformEdgeDoors(ctx, { name: `peds:${key}`, platformNumber: number, xMin: X0 - 0.3, xMax: X1 + 0.3, y: L, zLine: PED_Z, doorways, endDoors: [-62.4, 62.4], labelPrefix: isUpper ? 'E' : 'W', levelBoarding, soundPositions });
  g.add(peds.group);
  ctx.register(`peds:${key}`, peds);

  // ---- end walls at the platform ends (x = ±63): panelled wall with a staff door to the track walkway, 'No entry' + danger signs
  for (const sx of [-1, 1]) {
    const x = sx > 0 ? X1 : X0; const facing = sx > 0 ? 'west' : 'east';
    addMerged(g, [K.yzQuad(x, L, CEIL, floorBackZ - 0.2, PED_Z + 0.5, facing)], S.wall, 'endWall');
    addMerged(g, [K.yzQuad(x + sx * 0.3, invertY, CEIL + 1.7, floorBackZ - 0.4, PED_Z + 0.5, sx > 0 ? 'east' : 'west')], S.trackside, 'endWallBack');
    const doorZ = 2.2;
    g.add(box(S.doorGrey, 0.06, 2.1, 1.0, x - sx * 0.03, L + 1.05, doorZ));
    g.add(box(S.stainless, 0.05, 0.05, 0.6, x - sx * 0.08, L + 1.05, doorZ));                          // push bar
    F.addWallSign(ctx, g, { x: x - sx * 0.02, y: L + 2.55, z: doorZ, facing, texture: noEntryTexture(ctx), w: 0.5, h: 0.5, depth: 0.02, batch });
    F.addWallSign(ctx, g, { x: x - sx * 0.02, y: L + 1.6, z: doorZ + 0.9, facing, texture: dangerTexture(ctx), w: 0.5, h: 0.35, depth: 0.02, batch });
    F.addRoundelBoard(ctx, g, { x: x - sx * 0.02, y: L, z: 3.4, facing, size: 0.6, centre: 2.7, batch });
    collision.addBlocker({ xMin: Math.min(x, x + sx * 0.4), xMax: Math.max(x, x + sx * 0.4), yMin: L, yMax: CEIL, zMin: floorBackZ - 0.4, zMax: PED_Z + 0.6 }, tag + ':endWall');
  }

  // ---- headwalls, running tunnels, track, signals, tunnel telephone
  const track = new Track(isUpper ? TRACKS.jubileeUpper : TRACKS.jubileeLower);
  for (const sx of [-1, 1]) {
    const hx = sx * HEADWALL_X;
    addMerged(g, [K.headwallGeometry(hx, R, axisY, axisZ, runR, runAxisY, TRACK_Z, sx > 0 ? 'west' : 'east')], S.headwall, 'headwall');
    addMerged(g, [K.tunnelTube(Math.min(hx, hx + sx * RUNNING_LEN), Math.max(hx, hx + sx * RUNNING_LEN), runR, runAxisY, TRACK_Z)], S.running, 'runningTunnel');
    // concrete track slab inside the running tunnel + a black end cap (the tunnel disappears into darkness)
    addMerged(g, [K.xzQuad(invertY, Math.min(hx, hx + sx * RUNNING_LEN), Math.max(hx, hx + sx * RUNNING_LEN), TRACK_Z - 1.1, TRACK_Z + 1.1, 'up')], S.invert, 'runningInvert');
    g.add(new THREE.Mesh(new THREE.CircleGeometry(runR + 0.05, 24).rotateY(sx > 0 ? -Math.PI / 2 : Math.PI / 2).translate(hx + sx * (RUNNING_LEN - 0.2), runAxisY, TRACK_Z), M.matte(0x000000)));
    // tunnel telephone wires (two bare wires on insulators) along the running tunnel wall, plus cable brackets
    const wireGeos = []; const wireY = runAxisY + 0.6, wireZ = TRACK_Z + Math.sqrt(runR * runR - 0.36) - 0.12;
    for (const dy of [0, 0.12]) wireGeos.push(new THREE.BoxGeometry(RUNNING_LEN, 0.012, 0.012).translate(hx + sx * RUNNING_LEN / 2, wireY + dy, wireZ));
    for (let d = 2; d < RUNNING_LEN; d += 4) wireGeos.push(new THREE.BoxGeometry(0.06, 0.2, 0.08).translate(hx + sx * d, wireY + 0.06, wireZ + 0.06));
    addMerged(g, wireGeos, S.tray, 'wires');
    // signal head at the portal (starter shows green at the departure end, the arriving end shows a red repeater); tunnel telephone sign + box
    const departureEnd = (sx > 0) === isUpper;
    const sigX = hx - sx * 1.2, sigZ = TRACK_Z + (isUpper ? -1 : 1) * 1.55;   // on the driver's side of the running direction
    g.add(box(S.black, 0.25, 0.7, 0.2, sigX, railY + 1.9, sigZ));
    g.add(box(departureEnd ? S.greenLamp : S.redLamp, 0.02, 0.16, 0.16, sigX - sx * 0.13, railY + (departureEnd ? 1.72 : 2.08), sigZ));
    g.add(box(S.black, 0.06, 1.3, 0.06, sigX, railY + 0.9, sigZ));
    // tunnel telephone: sign above the portal crown (visible from the platform through the glass and from the cab), box beside it
    F.addWallSign(ctx, g, { x: hx - sx * 0.02, y: runAxisY + runR + 0.55, z: TRACK_Z + 0.2, facing: sx > 0 ? 'west' : 'east', texture: tunnelTelephoneTexture(ctx), w: 0.8, h: 0.3, depth: 0.02, batch });
    g.add(box(S.doorGrey, 0.12, 0.3, 0.25, hx - sx * 0.08, runAxisY + runR + 0.55, TRACK_Z - 0.75));
    g.add(box(S.redLamp, 0.02, 0.06, 0.06, hx - sx * 0.15, runAxisY + runR + 0.75, TRACK_Z - 0.75));
    collision.addBlocker({ xMin: hx - 0.3, xMax: hx + 0.3, yMin: invertY - 1, yMax: axisY + R, zMin: axisZ - R, zMax: axisZ + R }, tag + ':headwall');
  }
  try {
    const sA = track.nearestS(new THREE.Vector3(-HEADWALL_X - RUNNING_LEN + 1, railY, TRACK_Z)), sB = track.nearestS(new THREE.Vector3(HEADWALL_X + RUNNING_LEN - 1, railY, TRACK_Z));
    const trackMesh = buildTrackMesh(track, { sMin: Math.min(sA, sB), sMax: Math.max(sA, sB), railMaterial: S.railMat, sleepers: false, ballastMaterial: null, step: 0.8 });
    g.add(trackMesh);
    // fourth-rail insulator pots and rail chairs read as small white/blue blocks every 2.4 m (instanced)
    const potGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07); const potMat = M.paint(0xb9b3a4, { roughness: 0.7 });
    const n = Math.floor((HEADWALL_X + RUNNING_LEN) * 2 / 2.4); const pots = new THREE.InstancedMesh(potGeo, potMat, n * 2); const m4 = new THREE.Matrix4(); let i = 0;
    for (let k = 0; k < n; k++) { const x = -HEADWALL_X - RUNNING_LEN + (k + 0.5) * 2.4; m4.makeTranslation(x, railY - 0.05, TRACK_Z); pots.setMatrixAt(i++, m4); m4.makeTranslation(x, railY + 0.1, TRACK_Z - 1.435 / 2 - 0.4); pots.setMatrixAt(i++, m4); }
    pots.instanceMatrix.needsUpdate = true; pots.computeBoundingSphere(); g.add(pots);
  } catch (e) { console.warn('[jubileePlatforms] track failed', e); }

  // ---- cross-passages north into the wells
  for (const o of openings) if (o.kind === 'passage') buildPassage(ctx, g, S, { x: o.x, width: o.width, L, floorBackZ, number, isUpper, batch, tag });

  // ---- emergency-stair door frame at the opening (the stair itself is built once for both levels)
  {
    const o = openings.find(q => q.kind === 'stairDoor');
    F.addEmergencyExitSign(ctx, g, { x: o.x, y: L + STAIR_DOOR_H + 0.35, z: K.liningZ(L + STAIR_DOOR_H + 0.6, R, axisY, axisZ, 'north') + 0.03, facing: 'south', arrow: 'up', w: 0.6, batch });
    F.addWallSign(ctx, g, { x: o.x + 1.35, y: L + 1.5, z: K.liningZ(L + 1.2, R, axisY, axisZ, 'north') + 0.02, facing: 'south', texture: stairNoticeTexture(ctx, number), w: 0.5, h: 0.5, depth: 0.02, batch });
  }

  // ---- platform dressing: benches, help points, fire points, posters, roundels, name panels, line diagrams, CCTV, signs, indicators, clock
  {
    const wallZ = (y) => K.liningZ(y, R, axisY, axisZ, 'north');
    const avoid = (x, w) => openings.some(o => x + w / 2 > o.x0 - 0.6 && x - w / 2 < o.x1 + 0.6);
    // benches (stainless 3-seat) with their backs to the wall
    for (const x of [-48, -33, -8, 8, 33, 48]) if (!avoid(x, 1.6)) F.addBench(ctx, g, { x, y: L, z: floorBackZ + 0.36, facing: 'south', batch });
    // help points (white round JLE type is the photographed form; the blue-faced panel from the shared kit reads clearly) and fire points
    for (const x of [-55, -27, 27, 55]) F.addHelpPoint(ctx, g, { x, y: L, z: wallZ(L + 1.2) + 0.02, facing: 'south', batch });
    for (const x of [-44, 3, 44]) F.addFireEquipment(ctx, g, { x, y: L, z: floorBackZ + 0.1, facing: 'south', batch });
    // roundel name boards every ~14 m (bar centre 1.65 m) with 4-sheet posters between them; name panels flank the passage mouths
    let seed = number * 31 + 3;
    for (let x = -56; x <= 56; x += 7) {
      if (avoid(x, 1.2)) continue; const k = Math.round((x + 56) / 7);
      // the wall curves: a flat item must sit on the wall at whichever edge is furthest from the tunnel axis (top edge above the axis, bottom edge below)
      if (k % 2 === 0) F.addRoundelBoard(ctx, g, { x, y: L, z: wallZ(L + 2.15) + 0.02, facing: 'south', size: 1.0, centre: 1.65, frame: true, batch });
      else F.addPosterFrame(ctx, g, { x, y: L, z: wallZ(L + 0.9) + 0.02, facing: 'south', seed: seed++, batch });
    }
    for (const o of openings) if (o.kind === 'passage') {
      for (const sx of [-1, 1]) F.addNamePanel(ctx, g, { x: o.x + sx * (o.width / 2 + 1.6), y: L, z: wallZ(L + 2.9) + 0.02, facing: 'south', w: 2.2, centre: 2.6, batch });
      F.addLineDiagram(ctx, g, { x: o.x - o.width / 2 - 1.6, y: L, z: wallZ(L + 1.2) + 0.03, facing: 'south', line: 'Jubilee', color: '#a0a5a9', stations: STOCK_1996.lineDiagram, current: 'Westminster', w: 1.9, centre: 1.5, batch });
    }
    // CCTV domes on the ceiling; 'CCTV in operation' notices by the passages
    for (const x of [-58, -36, -12, 12, 36, 58]) F.addCCTV(ctx, g, { x, y: CEIL, z: 1.6, mount: 'ceiling', batch });
    for (const o of openings) if (o.kind === 'passage') F.addWallSign(ctx, g, { x: o.x + o.width / 2 + 3.2, y: L + 2.55, z: wallZ(L + 2.7) + 0.02, facing: 'south', texture: cctvTexture(ctx), w: 0.5, h: 0.25, depth: 0.02, batch });
    // suspended wayfinding (JLE dark family): over each passage mouth a 'Way out ↑' facing the platform; along the platform, arrows towards the nearest passage
    for (const o of openings) if (o.kind === 'passage') {
      F.addSuspendedSign(ctx, g, { x: o.x, y: CEIL, z: 2.35, facing: 'east', texture: wayOutTexture(ctx, 'right'), backTexture: wayOutTexture(ctx, 'left'), w: 2.2, h: 0.62, depth: 0.1, drop: 0.32, boxColor: 0x111111, batch });
      F.addWallSign(ctx, g, { x: o.x, y: L + PASSAGE_H + 0.22, z: floorBackZ + 0.16, facing: 'south', texture: wayOutTexture(ctx, 'up'), w: 1.6, h: 0.45, depth: 0.04, batch, backColor: 0x111111 });
    }
    // beyond the passages: the face read while walking TOWARDS the passages says 'Way out ↑', the other face carries the platform identity
    const idTex = platformIdTexture(ctx, number, isUpper);
    for (const x of [-52, -36, 0, 36, 52]) {
      const facing = x < 0 ? 'west' : 'east';   // front face normal; people walking towards the centre look at it
      F.addSuspendedSign(ctx, g, { x, y: CEIL, z: 2.35, facing, texture: wayOutTexture(ctx, 'up'), backTexture: x === 0 ? wayOutTexture(ctx, 'up') : idTex, w: 2.2, h: 0.62, depth: 0.1, drop: 0.32, boxColor: 0x111111, batch });
    }
    // next-train indicators one-third and two-thirds along, double-sided, underside c. 2.6 m
    for (const x of [-24, 24]) F.addNextTrainIndicator(ctx, g, { x, y: CEIL, z: 2.35, facing: 'east', platformNumber: number, cols: 160, rows: 3, drop: CEIL_H - 2.6 - 0.36, batch });
    // platform number tabs under the name panels flanking the passage mouths; clock beside the west passage
    for (const o of openings) if (o.kind === 'passage') for (const sx of [-1, 1]) F.addWallSign(ctx, g, { x: o.x + sx * (o.width / 2 + 1.6), y: L + 2.2, z: wallZ(L + 2.31) + 0.03, facing: 'south', texture: platformTabTexture(ctx, number), w: 0.9, h: 0.22, depth: 0.02, batch, backColor: 0x000000 });
    F.addClock(ctx, g, { x: JUBILEE.passages[0].x - JUBILEE.passages[0].width / 2 - 0.35, y: L + 2.0, z: wallZ(L + 2.2) + 0.02, facing: 'south', size: 0.32 });
  }

  batch.flush(g, { name: tag + ':furniture' });

  // NPC spawn points along the platform (contract: 'spawn:<area>')
  ctx.register(`spawn:jubilee${isUpper ? 'Upper' : 'Lower'}`, [-40, -25, -5, 10, 30, 45].map(x => ({ x, y: L, z: 2.4 })));

  return { group: g, peds, level: L, number, doorways };
}

// ---------------------------------------------------------------------------
// A JLE cross-passage: 3.2 m wide, enamel infill panels between silver-grey iron ribs under an arched vault, from the
// platform back wall north through the lining and the box wall to the well (z = -3).
// ---------------------------------------------------------------------------
function buildPassage(ctx, parent, S, { x, width, L, floorBackZ, number, isUpper, batch, tag }) {
  const { M, T, collision } = ctx;
  const g = new THREE.Group(); g.name = `passage-${number}-${x < 0 ? 'W' : 'E'}`; parent.add(g);
  const Z0 = JUBILEE.box.zMax - 0.05, Z1 = floorBackZ + 0.05;      // through the box wall face … to the lining
  const half = width / 2;
  // profile of the vault (local u across, y up): vertical walls then an elliptical arch
  const prof = [];
  const nArc = 14;
  prof.push([-half, 0], [-half, PASSAGE_SPRING]);
  for (let i = 1; i < nArc; i++) { const t = i / nArc; const a = Math.PI - t * Math.PI; prof.push([Math.cos(a) * half, PASSAGE_SPRING + Math.sin(a) * (PASSAGE_H - PASSAGE_SPRING)]); }
  prof.push([half, PASSAGE_SPRING], [half, 0]);
  // sweep along z with metric UVs (u = z, v = distance along the profile); inward normals
  const pos = [], uv = [], idx = []; const nz = Math.max(1, Math.round((Z1 - Z0) / 0.5)); const arcLen = []; let acc = 0;
  prof.forEach((p, i) => { if (i) acc += Math.hypot(p[0] - prof[i - 1][0], p[1] - prof[i - 1][1]); arcLen.push(acc); });
  for (let j = 0; j <= nz; j++) { const z = Z0 + (Z1 - Z0) * j / nz; prof.forEach((p, i) => { pos.push(x + p[0], L + p[1], z); uv.push(z, arcLen[i]); }); }
  const row = prof.length;
  for (let j = 0; j < nz; j++) for (let i = 0; i < row - 1; i++) { const a = j * row + i, b = (j + 1) * row + i, c = a + 1, d = b + 1; idx.push(a, c, b, b, c, d); }
  const vault = new THREE.BufferGeometry(); vault.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); vault.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); vault.setIndex(idx); vault.computeVertexNormals();
  const vm = new THREE.Mesh(vault, S.enamel); vm.receiveShadow = true; g.add(vm);
  // ribs every metre along the passage (tube along the profile) + skirting rails at the floor and at the springing
  const ribGeos = []; const profPts = prof.map(p => new THREE.Vector3(x + p[0], L + p[1], 0));
  for (let z = Z0 + 0.5; z < Z1; z += 1.0) { const path = new THREE.CatmullRomCurve3(profPts.map(p => new THREE.Vector3(p.x, p.y, z)), false, 'catmullrom', 0.05); ribGeos.push(new THREE.TubeGeometry(path, 36, 0.055, 8, false)); ribGeos.push(new THREE.BoxGeometry(0.16, 0.05, 0.12).translate(x - half + 0.08, L + PASSAGE_SPRING, z), new THREE.BoxGeometry(0.16, 0.05, 0.12).translate(x + half - 0.08, L + PASSAGE_SPRING, z)); }
  for (const sx of [-1, 1]) { ribGeos.push(new THREE.BoxGeometry(0.06, 0.15, Z1 - Z0).translate(x + sx * (half - 0.03), L + 0.075, (Z0 + Z1) / 2)); ribGeos.push(new THREE.BoxGeometry(0.05, 0.05, Z1 - Z0).translate(x + sx * (half - 0.025), L + PASSAGE_SPRING + 0.02, (Z0 + Z1) / 2)); }
  addMerged(g, ribGeos, S.rib, 'ribs');
  // floor
  g.add(ctx.floorPlane(width, Z1 - Z0 + 0.1, S.terrazzo, { x, y: L + 0.002, z: (Z0 + Z1) / 2 }));
  collision.addFloor({ xMin: x - half, xMax: x + half, zMin: Z0 - 0.3, zMax: Z1 + 0.3, y: L, tag: tag + ':passage', sound: 'hard' });
  collision.addBlocker({ xMin: x - half - 0.4, xMax: x - half, yMin: L, yMax: L + PASSAGE_H, zMin: Z0 - 0.3, zMax: Z1 + 0.2 }, tag + ':passageWall');
  collision.addBlocker({ xMin: x + half, xMax: x + half + 0.4, yMin: L, yMax: L + PASSAGE_H, zMin: Z0 - 0.3, zMax: Z1 + 0.2 }, tag + ':passageWall');
  // portal plate on the platform side closing the rectangular opening in the lining around the arch (dark rib colour) + a stainless architrave
  try {
    const shape = new THREE.Shape(); shape.moveTo(-half - 0.35, 0); shape.lineTo(half + 0.35, 0); shape.lineTo(half + 0.35, PASSAGE_H + 0.45); shape.lineTo(-half - 0.35, PASSAGE_H + 0.45); shape.closePath();
    const hole = new THREE.Path(); hole.moveTo(-half, 0); hole.lineTo(-half, PASSAGE_SPRING); for (let i = 1; i < nArc; i++) { const a = Math.PI - (i / nArc) * Math.PI; hole.lineTo(Math.cos(a) * half, PASSAGE_SPRING + Math.sin(a) * (PASSAGE_H - PASSAGE_SPRING)); } hole.lineTo(half, PASSAGE_SPRING); hole.lineTo(half, 0); hole.closePath(); shape.holes.push(hole);
    const plate = new THREE.ShapeGeometry(shape, 12); plate.translate(x, L, Z1 + 0.06);
    const pm = new THREE.Mesh(plate, S.ribDark); g.add(pm);
    const arch = new THREE.CatmullRomCurve3(profPts.map(p => new THREE.Vector3(p.x, p.y, Z1 + 0.08)), false, 'catmullrom', 0.05);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(arch, 36, 0.045, 8, false), S.stainless));
  } catch (e) { console.warn('[jubileePlatforms] passage portal failed', e); }
  // continuous luminaire along the vault crown + a CCTV dome at the platform mouth
  g.add(box(S.lum, 0.12, 0.04, Z1 - Z0 - 0.6, x, L + PASSAGE_H - 0.08, (Z0 + Z1) / 2));
  g.add(box(S.spine, 0.3, 0.05, Z1 - Z0 - 0.5, x, L + PASSAGE_H - 0.04, (Z0 + Z1) / 2));
  F.addCCTV(ctx, g, { x: x + half - 0.4, y: L + PASSAGE_SPRING + 0.4, z: Z1 - 0.6, mount: 'ceiling', batch });
  // signs: mid-passage double-sided — north face for those arriving from the well ('Jubilee line ↑ Eastbound platform 3'),
  // south face for those leaving ('Way out ↑ District and Circle lines'); green emergency-exit box; help point in the passage
  const entrance = platformEntranceTexture(ctx, number, isUpper);
  F.addSuspendedSign(ctx, g, { x, y: L + 2.82, z: Z0 + 1.3, facing: 'north', texture: entrance, backTexture: wayOutTexture(ctx, 'up'), w: 1.9, h: 0.62, depth: 0.08, drop: 0.05, boxColor: 0x111111, batch });
  F.addHelpPoint(ctx, g, { x: x - half + 0.02, y: L, z: (Z0 + Z1) / 2 + 0.6, facing: 'east', batch });
  F.addWallSign(ctx, g, { x: x + half - 0.02, y: L + 1.6, z: (Z0 + Z1) / 2, facing: 'west', texture: F.emergencyExitTexture(ctx, { arrow: 'up', text: 'Emergency exit' }), w: 0.5, h: 0.25, depth: 0.03, batch, backColor: 0x009639 });
  return g;
}

// ---------------------------------------------------------------------------
// Emergency stair at the west end: a concrete dog-leg flight in a shaft north of the tunnels, entered through a push-bar
// door in each platform's back wall at x = STAIR_DOOR_X. Two flights of 30 risers with a half landing at the east end.
// ---------------------------------------------------------------------------
function buildEmergencyStairs(ctx, parent, S) {
  const { M, T, collision } = ctx;
  const Lu = LEVELS.jubUpper, Ll = LEVELS.jubLower; const H = (Lu - Ll) / 2;      // rise per flight
  const g = new THREE.Group(); g.name = 'jubileeEmergencyStair'; parent.add(g);
  const LX0 = -63.5, LX1 = -59.5;                 // lobby x range (both levels)
  const SX1 = -49.5, LAND_X = -51;                // shaft east end; landing x range LAND_X..SX1
  const Z0 = -2.7, Z1 = 0.3;                      // shaft z range (south wall tangent to the lining's northernmost line)
  const NZ = [-2.7, -1.3], SZ = [-1.1, 0.3];      // north half (flight A) / south half (flight B); spine wall between
  const N = 30, rise = H / N, run = (LAND_X - LX1) / N; const wA = NZ[1] - NZ[0];
  const doorZ1 = 0.75;                            // the door throat runs from the shaft's south wall (Z1) to the platform lining
  const conc = S.stairConcrete; conc.side = THREE.DoubleSide;   // shaft walls and door-reveal cheeks are seen from both sides
  const tag = 'jubStair';
  const leafZ = Z1 + 0.06;                        // the door leaf hangs at the shaft wall, recessed behind the curved lining (a proper reveal)
  const wallGeos = [], floorGeos = [];
  // enclosure: north wall, south wall (with the two door holes), west wall, east wall, ceiling; lobby + landing floors
  wallGeos.push(K.xyQuad(Z0, LX0, SX1, Ll - 0.2, Lu + 3.0, 'south'));
  wallGeos.push(K.yzQuad(LX0, Ll - 0.2, Lu + 3.0, Z0, Z1, 'east'));
  wallGeos.push(K.yzQuad(SX1, Ll - 0.2, Lu + 3.0, Z0, Z1, 'west'));
  wallGeos.push(K.xzQuad(Lu + 3.0, LX0, SX1, Z0, Z1, 'down'));
  {  // south wall with door holes (shape x mirrored because the quad faces north)
    const shape = new THREE.Shape(); shape.moveTo(-SX1, Ll - 0.2); shape.lineTo(-LX0, Ll - 0.2); shape.lineTo(-LX0, Lu + 3.0); shape.lineTo(-SX1, Lu + 3.0); shape.closePath();
    for (const L of [Lu, Ll]) { const h = new THREE.Path(); h.moveTo(-(STAIR_DOOR_X - STAIR_DOOR_W / 2), L); h.lineTo(-(STAIR_DOOR_X + STAIR_DOOR_W / 2), L); h.lineTo(-(STAIR_DOOR_X + STAIR_DOOR_W / 2), L + STAIR_DOOR_H); h.lineTo(-(STAIR_DOOR_X - STAIR_DOOR_W / 2), L + STAIR_DOOR_H); h.closePath(); shape.holes.push(h); }
    const sg = new THREE.ShapeGeometry(shape, 4); sg.rotateY(Math.PI); sg.translate(0, 0, Z1); const uv = sg.attributes.uv, p = sg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), p.getY(i)); wallGeos.push(sg);
    // door throats through the lining at each level: side cheeks + lintel + threshold
    for (const L of [Lu, Ll]) {
      wallGeos.push(K.yzQuad(STAIR_DOOR_X - STAIR_DOOR_W / 2, L, L + STAIR_DOOR_H, Z1, doorZ1, 'east'), K.yzQuad(STAIR_DOOR_X + STAIR_DOOR_W / 2, L, L + STAIR_DOOR_H, Z1, doorZ1, 'west'), K.xzQuad(L + STAIR_DOOR_H, STAIR_DOOR_X - STAIR_DOOR_W / 2, STAIR_DOOR_X + STAIR_DOOR_W / 2, Z1 - 0.05, doorZ1 + 0.05, 'down'));
      floorGeos.push(K.xzQuad(L + 0.001, STAIR_DOOR_X - STAIR_DOOR_W / 2, STAIR_DOOR_X + STAIR_DOOR_W / 2, Z1 - 0.05, doorZ1 + 0.1, 'up'));
    }
  }
  // spine wall between the flights (full height between the two levels + parapet above the upper flight)
  wallGeos.push(K.xyQuad(NZ[1], LX1, LAND_X, Ll - 0.2, Lu + 3.0, 'north'), K.xyQuad(SZ[0], LX1, LAND_X, Ll - 0.2, Lu + 3.0, 'south'), K.xzQuad(Lu + 3.0 - 0.001, LX1, LAND_X, NZ[1], SZ[0], 'down'));
  // lobby floors (both levels) and the half landing; ceiling under the landing is the shaft ceiling (hidden)
  floorGeos.push(K.xzQuad(Lu, LX0, LX1, Z0, Z1, 'up'), K.xzQuad(Ll, LX0, LX1, Z0, Z1, 'up'), K.xzQuad(Lu - H, LAND_X, SX1, Z0, Z1, 'up'));
  floorGeos.push(K.xzQuad(Ll, LX1, LAND_X, NZ[0], NZ[1], 'up'));   // lower-level dead space under flight A (walled off below)
  addMerged(g, wallGeos, conc, 'stairWalls');
  addMerged(g, floorGeos, M.granite({ base: 0x7a7c7e, slab: 0.6 }), 'stairFloors');
  // flights: steps as instanced blocks + sloped soffit slabs + nosings; handrails both sides
  const stepGeo = new THREE.BoxGeometry(run, rise, wA); const nosGeo = new THREE.BoxGeometry(0.05, 0.012, wA - 0.1);
  const steps = new THREE.InstancedMesh(stepGeo, conc, N * 2), nos = new THREE.InstancedMesh(nosGeo, S.nosing, N * 2); const m4 = new THREE.Matrix4();
  for (let k = 0; k < N; k++) {
    // flight A: descends eastward from (LX1, Lu) in the north half
    const xa = LX1 + (k + 0.5) * run, ya = Lu - (k + 1) * rise; m4.makeTranslation(xa, ya - rise / 2, (NZ[0] + NZ[1]) / 2); steps.setMatrixAt(k, m4); m4.makeTranslation(xa + run / 2 - 0.025, ya + 0.006, (NZ[0] + NZ[1]) / 2); nos.setMatrixAt(k, m4);
    // flight B: descends westward from (LAND_X, Lu - H) in the south half
    const xb = LAND_X - (k + 0.5) * run, yb = Lu - H - (k + 1) * rise; m4.makeTranslation(xb, yb - rise / 2, (SZ[0] + SZ[1]) / 2); steps.setMatrixAt(N + k, m4); m4.makeTranslation(xb - run / 2 + 0.025, yb + 0.006, (SZ[0] + SZ[1]) / 2); nos.setMatrixAt(N + k, m4);
  }
  steps.instanceMatrix.needsUpdate = true; nos.instanceMatrix.needsUpdate = true; steps.computeBoundingSphere(); nos.computeBoundingSphere(); steps.receiveShadow = true; g.add(steps, nos);
  const slope = Math.atan2(H, LAND_X - LX1), slen = Math.hypot(H, LAND_X - LX1);
  const soffitGeos = [];
  { const sa = new THREE.BoxGeometry(slen, 0.25, wA); sa.rotateZ(-slope); sa.translate((LX1 + LAND_X) / 2, Lu - H / 2 - rise - 0.2, (NZ[0] + NZ[1]) / 2); soffitGeos.push(sa);
    const sb = new THREE.BoxGeometry(slen, 0.25, wA); sb.rotateZ(slope); sb.translate((LX1 + LAND_X) / 2, Lu - H - H / 2 - rise - 0.2, (SZ[0] + SZ[1]) / 2); soffitGeos.push(sb); }
  addMerged(g, soffitGeos, conc, 'stairSoffits');
  const railGeos = [];
  const rail = (x0, y0, x1, y1, z) => { const len = Math.hypot(x1 - x0, y1 - y0); const c = new THREE.CylinderGeometry(0.022, 0.022, len, 10); c.rotateZ(Math.PI / 2); c.rotateZ(Math.atan2(y1 - y0, x1 - x0)); c.translate((x0 + x1) / 2, (y0 + y1) / 2, z); railGeos.push(c); for (const [xx, yy] of [[x0, y0], [x1, y1]]) railGeos.push(new THREE.CylinderGeometry(0.016, 0.016, 0.9, 6).translate(xx, yy - 0.45, z)); };
  for (const z of [NZ[0] + 0.08, NZ[1] - 0.08]) rail(LX1 + 0.1, Lu + 0.95, LAND_X - 0.1, Lu - H + 0.95, z);
  for (const z of [SZ[0] + 0.08, SZ[1] - 0.08]) rail(LAND_X - 0.1, Lu - H + 0.95, LX1 + 0.1, Ll + 0.95, z);
  // balustrade at the upper lobby's void edge (glass + rail) and the landing edge above flight B
  railGeos.push(new THREE.CylinderGeometry(0.022, 0.022, SZ[1] - SZ[0] + 0.2, 10).rotateX(Math.PI / 2).translate(LX1, Lu + 1.1, (SZ[0] + SZ[1]) / 2));
  addMerged(g, railGeos, S.stainless, 'stairRails');
  g.add(new THREE.Mesh(K.yzQuad(LX1, Lu + 0.05, Lu + 1.05, SZ[0], SZ[1] + 0.1, 'west'), S.glass));
  // corduroy hazard strips at the stair heads/feet
  for (const [x, y, z] of [[LX1 - 0.25, Lu, (NZ[0] + NZ[1]) / 2], [LAND_X + 0.25, Lu - H, (NZ[0] + NZ[1]) / 2], [LAND_X + 0.25, Lu - H, (SZ[0] + SZ[1]) / 2], [LX1 - 0.25, Ll, (SZ[0] + SZ[1]) / 2]]) F.addCorduroy(ctx, g, { x, y, z, width: 0.4, depth: wA - 0.1 });
  // lighting: bulkhead luminaires (emissive) on the walls at each level and the landing; green exit signs; level notices
  for (const [x, y, z] of [[LX0 + 0.6, Lu + 2.4, Z0 + 0.12], [LX0 + 0.6, Ll + 2.4, Z0 + 0.12], [SX1 - 0.6, Lu - H + 2.4, Z0 + 0.12], [(LX1 + LAND_X) / 2, Lu + 2.5, Z0 + 0.12], [(LX1 + LAND_X) / 2, Ll + 2.5, Z1 - 0.12], [LX1 - 0.8, Lu + 2.6, Z1 - 0.12], [LX1 - 0.8, Ll + 2.6, Z1 - 0.12]]) g.add(box(S.lum, 0.5, 0.12, 0.2, x, y, z));
  for (const L of [Lu, Ll]) {
    F.addEmergencyExitSign(ctx, g, { x: STAIR_DOOR_X, y: L + STAIR_DOOR_H + 0.35, z: Z1 - 0.03, facing: 'north', arrow: 'down', w: 0.6 });
    F.addWallSign(ctx, g, { x: LX0 + 0.02, y: L + 1.6, z: (Z0 + Z1) / 2, facing: 'east', texture: stairLevelTexture(ctx, L === Lu ? 3 : 4), w: 0.9, h: 0.45, depth: 0.03, backColor: 0x111111 });
  }
  F.addWallSign(ctx, g, { x: SX1 - 0.02, y: Lu - H + 1.6, z: (Z0 + Z1) / 2, facing: 'west', texture: F.emergencyExitTexture(ctx, { arrow: 'up', text: 'Emergency exit' }), w: 0.6, h: 0.3, depth: 0.03, backColor: 0x009639 });
  // the doors: grey steel push-bar doors, interactive (E to push), swinging into the lobby; blockers removed while open
  for (const L of [Lu, Ll]) {
    const leaf = new THREE.Group(); leaf.position.set(STAIR_DOOR_X - STAIR_DOOR_W / 2 + 0.03, L, leafZ); g.add(leaf);
    const lm = new THREE.Mesh(new THREE.BoxGeometry(STAIR_DOOR_W - 0.06, STAIR_DOOR_H - 0.05, 0.05), S.doorGrey); lm.position.set((STAIR_DOOR_W - 0.06) / 2, (STAIR_DOOR_H - 0.05) / 2, 0); leaf.add(lm);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(STAIR_DOOR_W - 0.3, 0.05, 0.05), S.stainless); bar.position.set((STAIR_DOOR_W - 0.06) / 2, 1.0, 0.07); leaf.add(bar);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), F.signMaterial(ctx, pushBarTexture(ctx), { emissive: 0.4 })); plate.position.set((STAIR_DOOR_W - 0.06) / 2, 1.5, 0.028); leaf.add(plate);
    const doorBox = { xMin: STAIR_DOOR_X - STAIR_DOOR_W / 2, xMax: STAIR_DOOR_X + STAIR_DOOR_W / 2, yMin: L, yMax: L + STAIR_DOOR_H, zMin: leafZ - 0.08, zMax: leafZ + 0.08 };
    let blocker = collision.addBlocker(doorBox, tag + ':door');
    let open = false, t = 0, timer = 0;
    ctx.interactive(lm, { prompt: 'E — push the bar to open the emergency door', distance: 2.2, onInteract() { if (!open) { open = true; timer = 8; if (blocker) { collision.remove(blocker); blocker = null; } if (ctx.audio && ctx.audio.ready) ctx.audio.play('gatePaddle', { position: leaf.position.clone(), gain: 0.5 }); } } });
    ctx.onUpdate(dt => { if (open) { timer -= dt; if (timer <= 0) { open = false; if (!blocker) blocker = collision.addBlocker(doorBox, tag + ':door'); } } const target = open ? 1 : 0; t += (target - t) * Math.min(1, dt * 4); leaf.rotation.y = t * 1.6; });
  }
  // collision: floors (lobbies, landing, door throats), ramps (flights), walls, spine, balustrade, the wall under flight A at the lower level
  for (const L of [Lu, Ll]) { collision.addFloor({ xMin: LX0, xMax: LX1, zMin: Z0, zMax: Z1, y: L, tag: tag + ':lobby', sound: 'hard' }); collision.addFloor({ xMin: STAIR_DOOR_X - STAIR_DOOR_W / 2, xMax: STAIR_DOOR_X + STAIR_DOOR_W / 2, zMin: Z1 - 0.1, zMax: doorZ1 + 0.3, y: L, tag: tag + ':throat', sound: 'hard' }); }
  collision.addFloor({ xMin: LAND_X, xMax: SX1, zMin: Z0, zMax: Z1, y: Lu - H, tag: tag + ':landing', sound: 'hard' });
  collision.addRamp({ x: LX1, y: Lu, z: (NZ[0] + NZ[1]) / 2 }, { x: LAND_X, y: Lu - H, z: (NZ[0] + NZ[1]) / 2 }, wA, { sound: 'stairs', tag: tag + ':flightA', stepPitch: run });
  collision.addRamp({ x: LAND_X, y: Lu - H, z: (SZ[0] + SZ[1]) / 2 }, { x: LX1, y: Ll, z: (SZ[0] + SZ[1]) / 2 }, wA, { sound: 'stairs', tag: tag + ':flightB', stepPitch: run });
  collision.addBlocker({ xMin: LX0 - 0.4, xMax: SX1 + 0.4, yMin: Ll - 1, yMax: Lu + 3, zMin: Z0 - 0.4, zMax: Z0 }, tag + ':northWall');
  collision.addBlocker({ xMin: LX0 - 0.4, xMax: STAIR_DOOR_X - STAIR_DOOR_W / 2, yMin: Ll - 1, yMax: Lu + 3, zMin: Z1, zMax: Z1 + 0.4 }, tag + ':southWallW');
  collision.addBlocker({ xMin: STAIR_DOOR_X + STAIR_DOOR_W / 2, xMax: SX1 + 0.4, yMin: Ll - 1, yMax: Lu + 3, zMin: Z1, zMax: Z1 + 0.4 }, tag + ':southWallE');
  collision.addBlocker({ xMin: LX0 - 0.4, xMax: LX0, yMin: Ll - 1, yMax: Lu + 3, zMin: Z0, zMax: Z1 }, tag + ':westWall');
  collision.addBlocker({ xMin: SX1, xMax: SX1 + 0.4, yMin: Ll - 1, yMax: Lu + 3, zMin: Z0, zMax: Z1 }, tag + ':eastWall');
  collision.addBlocker({ xMin: LX1, xMax: LAND_X, yMin: Ll - 1, yMax: Lu + 3, zMin: NZ[1], zMax: SZ[0] }, tag + ':spine');
  collision.addBlocker({ xMin: LX1 - 0.05, xMax: LX1 + 0.05, yMin: Lu - 0.3, yMax: Lu + 1.2, zMin: SZ[0] - 0.1, zMax: SZ[1] + 0.1 }, tag + ':balustrade');
  collision.addBlocker({ xMin: LX1 - 0.05, xMax: LX1 + 0.05, yMin: Ll - 0.3, yMax: Ll + 2.5, zMin: NZ[0] - 0.1, zMax: NZ[1] + 0.1 }, tag + ':underFlight');
  for (const [xa, xb] of [[STAIR_DOOR_X - STAIR_DOOR_W / 2 - 0.5, STAIR_DOOR_X - STAIR_DOOR_W / 2], [STAIR_DOOR_X + STAIR_DOOR_W / 2, STAIR_DOOR_X + STAIR_DOOR_W / 2 + 0.5]]) collision.addBlocker({ xMin: xa, xMax: xb, yMin: Ll - 1, yMax: Lu + 3, zMin: Z1, zMax: doorZ1 + 0.1 }, tag + ':throatCheek');
  return g;
}

// ---------------------------------------------------------------------------
// Sign textures (JLE dark family for the Jubilee levels; white platform-entrance style per dossier §12.4)
// ---------------------------------------------------------------------------
function wayOutTexture(ctx, arrow) {
  const T = ctx.T; const W = 1024, H = 288; const s = 150;
  const ax = arrow === 'right' ? W - 110 : 110; const tx = arrow === 'right' ? 40 : 220;
  return T.sign({ width: W, height: H, bg: '#101113', arrows: [{ dir: arrow, x: ax, y: H / 2, size: s, color: '#ffd300' }],
    lines: [{ text: 'Way out', x: tx, y: 128, size: 112, color: '#ffd300' }, { text: 'District and Circle lines', x: tx, y: 236, size: 64, color: '#ffffff', weight: 'bold' }] });
}
/** Black 'Platform 3 — Eastbound' identity face for the outward side of the end wayfinding signs. */
function platformIdTexture(ctx, number, isUpper) {
  return ctx.T.sign({ width: 1024, height: 288, bg: '#101113', fills: [{ x: 0, y: 0, w: 1024, h: 44, color: '#a0a5a9' }],
    lines: [{ text: 'Jubilee line', x: 24, y: 34, size: 32, color: '#fff' }, { text: `Platform ${number}`, x: 40, y: 190, size: 110 }, { text: isUpper ? 'Eastbound' : 'Westbound', x: 640, y: 190, size: 70, weight: 'normal', color: '#dfe2e6' }] });
}
function platformEntranceTexture(ctx, number, isUpper) {
  const T = ctx.T; const W = 1024, H = 336;
  const towards = (isUpper ? JUBILEE.upper : JUBILEE.lower).towards.join(', ');
  return T.sign({ width: W, height: H, bg: '#f4f4f1', fills: [{ x: 0, y: 0, w: W, h: 46, color: '#a0a5a9' }],
    arrows: [{ dir: 'up', x: 80, y: 165, size: 110, color: '#111' }],
    lines: [{ text: 'Jubilee line', x: 24, y: 36, size: 34, color: '#ffffff' }, { text: `${isUpper ? 'Eastbound' : 'Westbound'}  Platform ${number}`, x: 150, y: 190, size: 72, color: '#111' }, { text: towards, x: 150, y: 282, size: 34, weight: 'normal', color: '#222' }] });
}
function platformTabTexture(ctx, number) { return ctx.T.sign({ width: 512, height: 128, bg: '#000', lines: [{ text: `Platform ${number}`, x: 256, y: 92, size: 80, align: 'center' }] }); }
function noEntryTexture(ctx) { return ctx.T.sign({ width: 256, height: 256, bg: '#ffffff', fills: [{ x: 0, y: 0, w: 256, h: 256, color: '#dc241f' }, { x: 40, y: 108, w: 176, h: 40, color: '#ffffff' }], lines: [{ text: 'No entry', x: 128, y: 236, size: 34, align: 'center', color: '#ffffff' }] }); }
function dangerTexture(ctx) { return ctx.T.sign({ width: 512, height: 358, bg: '#ffd300', lines: [{ text: 'DANGER', x: 256, y: 120, size: 92, align: 'center', color: '#111' }, { text: 'Do not enter the tunnel', x: 256, y: 210, size: 48, align: 'center', color: '#111' }, { text: 'Live rails — 630 volts', x: 256, y: 290, size: 44, align: 'center', color: '#111', weight: 'normal' }] }); }
function cctvTexture(ctx) { return ctx.T.sign({ width: 512, height: 256, bg: '#1c2e8c', lines: [{ text: 'CCTV in operation', x: 256, y: 110, size: 54, align: 'center' }, { text: 'Cameras are in operation on this', x: 256, y: 170, size: 30, align: 'center', weight: 'normal' }, { text: 'station for your safety and security', x: 256, y: 210, size: 30, align: 'center', weight: 'normal' }] }); }
function tunnelTelephoneTexture(ctx) { return ctx.T.sign({ width: 768, height: 288, bg: '#1c2e8c', arrows: [{ dir: 'down', x: 680, y: 144, size: 130, color: '#fff' }], lines: [{ text: 'Tunnel', x: 40, y: 120, size: 96 }, { text: 'telephone', x: 40, y: 236, size: 96 }] }); }
function stairNoticeTexture(ctx, number) { return ctx.T.sign({ width: 512, height: 512, bg: '#009639', lines: [{ text: 'Emergency', x: 256, y: 150, size: 70, align: 'center' }, { text: 'stairs', x: 256, y: 230, size: 70, align: 'center' }, { text: number === 3 ? 'to Platform 4' : 'to Platform 3', x: 256, y: 330, size: 56, align: 'center', weight: 'normal' }, { text: 'Emergency use only', x: 256, y: 440, size: 40, align: 'center', weight: 'normal' }] }); }
function pushBarTexture(ctx) { return ctx.T.sign({ width: 512, height: 256, bg: '#009639', lines: [{ text: 'Push bar to open', x: 256, y: 110, size: 54, align: 'center' }, { text: 'Emergency exit', x: 256, y: 190, size: 40, align: 'center', weight: 'normal' }] }); }
function stairLevelTexture(ctx, number) { return ctx.T.sign({ width: 1024, height: 512, bg: '#101113', fills: [{ x: 0, y: 0, w: 1024, h: 60, color: '#a0a5a9' }], lines: [{ text: 'Jubilee line', x: 30, y: 46, size: 42, color: '#fff' }, { text: `Platform ${number}`, x: 512, y: 250, size: 150, align: 'center' }, { text: number === 3 ? 'Eastbound' : 'Westbound', x: 512, y: 400, size: 96, align: 'center', weight: 'normal' }] }); }

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------
function box(mat, w, h, d, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.receiveShadow = true; return m; }
function addMerged(parent, geos, material, name) {
  const merged = K.mergeAll(mergeGeometries, geos);
  if (!merged) { for (const g of geos) parent.add(new THREE.Mesh(g, material)); return null; }
  merged.computeBoundingSphere(); const mesh = new THREE.Mesh(merged, material); mesh.name = name; mesh.receiveShadow = true; mesh.castShadow = false; parent.add(mesh); return mesh;
}
