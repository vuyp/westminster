// Dev: both trains standing at their Westminster platforms with the doors open, plus plain platform slabs, a strip of
// track and a hemisphere light — to eyeball the rolling stock with test/screenshot.mjs, e.g.
//   node test/screenshot.mjs --module dev/trainTest --views "j-side:0,-21.4,2.2:0,-22.4,5.6" --outdir /tmp/shots/trains
//   --lights 0 → no lights at all (the saloon lit only by its own emissive panels, as in a tunnel)
// ctx.player.sit is stubbed by the harness so the E-to-sit seats are inert here; the full app uses the real Player.
import * as THREE from 'three';
import { LEVELS, JUBILEE, DISTRICT, TRACKS, dcToWorld } from '../core/layout.js';
import { Track, buildTrackMesh } from '../core/track.js';
import { createTrain } from '../entities/trains.js';

export function build(ctx) {
  const { M, scene, collision, floorPlane } = ctx;
  const out = { trains: {} };
  const railMat = M.paint(0x6a6560, { roughness: 0.6, metalness: 0.6 });

  // ---- District & Circle (rotated frame): Platform 2 (eastbound, NW side) + Platform 1 slab + the eastbound track
  const eb = new Track(TRACKS.districtEB);
  for (const p of Object.values(DISTRICT.platforms)) {
    const tc = (p.tMin + p.tMax) / 2; const w = p.tMax - p.tMin; const c = dcToWorld(0, tc);
    const slab = floorPlane(w, DISTRICT.platformLength, M.granite(), { x: c.x, y: LEVELS.dcPlatform, z: c.z }); slab.rotation.y = DISTRICT.frame.yaw; scene.add(slab);
    collision.addFloor({ xMin: c.x - 60, xMax: c.x + 60, zMin: c.z - 40, zMax: c.z + 40, y: LEVELS.dcPlatform });
  }
  const tb = floorPlane(6, DISTRICT.platformLength + 40, M.precast(), { x: dcToWorld(0, 0).x, y: LEVELS.dcRail - 0.2, z: dcToWorld(0, 0).z }); tb.rotation.y = DISTRICT.frame.yaw; scene.add(tb);
  scene.add(buildTrackMesh(eb, { sMin: eb.stopS - 80, sMax: eb.stopS + 80, railMaterial: railMat, sleeperMaterial: M.precast() }));
  const s7 = createTrain(ctx, { stock: 'S7', track: eb, direction: 'eastbound', destination: 'Upminster', line: 'district' });
  s7.placeAlong(eb, eb.stopS); scene.add(s7.group); s7.setDoors(true, { side: 'left', silent: true, immediate: true }); s7.setDisplay('This is Westminster. Change for the Jubilee line.');
  ctx.register('train:district-eb', s7); out.trains.s7 = s7;

  // ---- Jubilee Platform 3 (eastbound, upper): platform slab NORTH of the track + the track
  const ju = new Track(TRACKS.jubileeUpper);
  const pw = JUBILEE.pedZ - JUBILEE.platformZMin;
  scene.add(floorPlane(JUBILEE.xMax - JUBILEE.xMin, pw, M.granite(), { x: 0, y: LEVELS.jubUpper, z: (JUBILEE.pedZ + JUBILEE.platformZMin) / 2 }));
  collision.addFloor({ xMin: JUBILEE.xMin, xMax: JUBILEE.xMax, zMin: JUBILEE.platformZMin, zMax: JUBILEE.pedZ, y: LEVELS.jubUpper });
  scene.add(floorPlane(JUBILEE.xMax - JUBILEE.xMin + 40, 4.5, M.precast(), { x: 0, y: LEVELS.jubUpper + LEVELS.jubRailOffset - 0.2, z: JUBILEE.trackZ }));
  scene.add(buildTrackMesh(ju, { sMin: ju.stopS - 80, sMax: ju.stopS + 80, railMaterial: railMat, sleeperMaterial: M.precast() }));
  const t96 = createTrain(ctx, { stock: '1996', track: ju, direction: 'eastbound', destination: 'Stratford', line: 'jubilee' });
  t96.placeAlong(ju, ju.stopS); scene.add(t96.group); t96.setDoors(true, { side: 'left', silent: true, immediate: true }); t96.setDisplay('This station is Westminster. Change here for the District and Circle lines.');
  ctx.register('train:jubilee-upper', t96); out.trains.t96 = t96;

  // ---- a moving 1996 TS on Platform 4's track (lower) to check wheel / sway animation
  const jl = new Track(TRACKS.jubileeLower);
  scene.add(floorPlane(JUBILEE.xMax - JUBILEE.xMin, pw, M.granite(), { x: 0, y: LEVELS.jubLower, z: (JUBILEE.pedZ + JUBILEE.platformZMin) / 2 }));
  const mover = createTrain(ctx, { stock: '1996', track: jl, direction: 'westbound', destination: 'Stanmore', line: 'jubilee' });
  let s = jl.stopS - 60; mover.placeAlong(jl, s); scene.add(mover.group); out.trains.mover = mover;
  ctx.onUpdate(dt => { s += 8 * dt; if (s > jl.stopS + 60) s = jl.stopS - 60; mover.placeAlong(jl, s); mover.setSpeed(8, 0); mover.update(dt); });
  ctx.onUpdate(dt => { s7.update(dt); t96.update(dt); });

  // register the stopped trains' exterior boxes so --showBlockers shows the doorway gaps
  for (const b of s7.exteriorBoxes()) collision.addBlocker(b, 'train'); for (const b of t96.exteriorBoxes()) collision.addBlocker(b, 'train');

  const dark = typeof location !== 'undefined' && new URLSearchParams(location.search).get('lights') === '0';
  if (!dark) { scene.add(new THREE.HemisphereLight(0xe8eefc, 0x3a3a3a, 1.35)); const d = new THREE.DirectionalLight(0xffffff, 0.8); d.position.set(30, 40, -20); scene.add(d); }
  else scene.add(new THREE.AmbientLight(0xffffff, 0.02));
  return out;
}
