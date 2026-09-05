// Dev: both trains standing at their Westminster platforms with the doors open, plus plain platform slabs,
// a strip of track and a hemisphere light — to eyeball the rolling stock with test/screenshot.mjs:
//   node test/screenshot.mjs --module dev/trainTest --views "s7-3q:-20,-9.5,-2:-9,-12,9.9;..." --outdir /tmp/shots/trains
// ?ctx.player.sit is stubbed so the E-to-sit seats are inert here; the full app uses the real Player.
import * as THREE from 'three';
import { LEVELS, JUBILEE, DISTRICT, TRACKS } from '../core/layout.js';
import { Track, buildTrackMesh } from '../core/track.js';
import { createTrain } from '../entities/trains.js';

export function build(ctx) {
  const { M, scene, collision, floorPlane } = ctx;
  const out = { trains: {} };
  // District & Circle: platform 1 slab (north of the eastbound track) + track
  const eb = new Track(TRACKS.districtEB); const p1 = DISTRICT.platforms[1];
  scene.add(floorPlane(DISTRICT.xMax - DISTRICT.xMin, p1.zMax - p1.zMin, M.granite(), { x: (DISTRICT.xMin + DISTRICT.xMax) / 2, y: LEVELS.dcPlatform, z: (p1.zMin + p1.zMax) / 2 }));
  collision.addFloor({ xMin: DISTRICT.xMin, xMax: DISTRICT.xMax, zMin: p1.zMin, zMax: p1.zMax, y: LEVELS.dcPlatform });
  const p2 = DISTRICT.platforms[2];
  scene.add(floorPlane(DISTRICT.xMax - DISTRICT.xMin, p2.zMax - p2.zMin, M.granite(), { x: (DISTRICT.xMin + DISTRICT.xMax) / 2, y: LEVELS.dcPlatform, z: (p2.zMin + p2.zMax) / 2 }));
  scene.add(floorPlane(DISTRICT.xMax - DISTRICT.xMin, 4.5, M.precast(), { x: (DISTRICT.xMin + DISTRICT.xMax) / 2, y: LEVELS.dcRail - 0.2, z: 12.1 }));
  scene.add(buildTrackMesh(eb, { sMin: eb.stopS - 80, sMax: eb.stopS + 80, railMaterial: M.paint(0x6a6560, { roughness: 0.6, metalness: 0.6 }), sleeperMaterial: M.precast() }));
  const s7 = createTrain(ctx, { stock: 'S7', track: eb, direction: 'eastbound', destination: 'Upminster', line: 'district' });
  s7.placeAlong(eb, eb.stopS); scene.add(s7.group); s7.setDoors(true, { side: 'left', silent: true, immediate: true }); s7.setDisplay('This is Westminster. Change here for the Jubilee line.');
  ctx.register('train:district-eb', s7); out.trains.s7 = s7;

  // Jubilee upper platform (east of the track) + track
  const ju = new Track(TRACKS.jubileeUpper);
  const w = JUBILEE.platformXMax - JUBILEE.platformXMin;
  scene.add(floorPlane(w, JUBILEE.zMax - JUBILEE.zMin, M.granite(), { x: (JUBILEE.platformXMin + JUBILEE.platformXMax) / 2, y: LEVELS.jubUpper, z: (JUBILEE.zMin + JUBILEE.zMax) / 2 }));
  collision.addFloor({ xMin: JUBILEE.platformXMin, xMax: JUBILEE.platformXMax, zMin: JUBILEE.zMin, zMax: JUBILEE.zMax, y: LEVELS.jubUpper });
  scene.add(floorPlane(4.5, JUBILEE.zMax - JUBILEE.zMin, M.precast(), { x: JUBILEE.trackX, y: LEVELS.jubUpper + LEVELS.jubRailOffset - 0.2, z: (JUBILEE.zMin + JUBILEE.zMax) / 2 }));
  scene.add(buildTrackMesh(ju, { sMin: ju.stopS - 80, sMax: ju.stopS + 80, railMaterial: M.paint(0x6a6560, { roughness: 0.6, metalness: 0.6 }), sleeperMaterial: M.precast() }));
  const t96 = createTrain(ctx, { stock: '1996', track: ju, direction: 'eastbound', destination: 'Stratford', line: 'jubilee' });
  t96.placeAlong(ju, ju.stopS); scene.add(t96.group); t96.setDoors(true, { side: 'right', silent: true, immediate: true }); t96.setDisplay('This station is Westminster. Change here for the District and Circle lines.');
  ctx.register('train:jubilee-upper', t96); out.trains.t96 = t96;

  // a moving 1996 TS on the lower Jubilee track to check wheel/door/sway animation
  const jl = new Track(TRACKS.jubileeLower);
  const mover = createTrain(ctx, { stock: '1996', track: jl, direction: 'westbound', destination: 'Stanmore', line: 'jubilee' });
  let s = jl.stopS - 60; mover.placeAlong(jl, s); scene.add(mover.group); out.trains.mover = mover;
  ctx.onUpdate(dt => { s += 8 * dt; if (s > jl.stopS + 60) s = jl.stopS - 60; mover.placeAlong(jl, s); mover.setSpeed(8, 0); mover.update(dt); });

  // the two standing trains still need their update for door animation, displays and seat following
  ctx.onUpdate(dt => { s7.update(dt); t96.update(dt); });

  // register the stopped trains' exterior boxes so --showBlockers shows the doorway gaps
  for (const b of s7.exteriorBoxes()) collision.addBlocker(b, 'train'); for (const b of t96.exteriorBoxes()) collision.addBlocker(b, 'train');

  // --lights 0 (?lights=0) → no lights at all: what the saloon looks like in a tunnel, lit only by its own emissive panels
  const dark = typeof location !== 'undefined' && new URLSearchParams(location.search).get('lights') === '0';
  if (!dark) { scene.add(new THREE.HemisphereLight(0xe8eefc, 0x3a3a3a, 1.35)); const d = new THREE.DirectionalLight(0xffffff, 0.8); d.position.set(30, 40, -20); scene.add(d); }
  else scene.add(new THREE.AmbientLight(0xffffff, 0.02));
  return out;
}
