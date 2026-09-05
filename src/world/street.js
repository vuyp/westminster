// ---------------------------------------------------------------------------
// street.js — Bridge Street, Westminster, at street level: the sky and sun, the roads and pavements,
// Portcullis House with the station entrance (Exit 4) in its arcade, the Elizabeth Tower and the Palace
// of Westminster across the road, New Palace Yard, Westminster Bridge and the Thames, the Embankment
// corner (Exits 1 & 2, Boadicea, the river wall, the JLE vent grates, Westminster Pier), Parliament Square
// and Whitehall (Exits 5 & 6), County Hall and the London Eye across the river, the street furniture,
// pigeons, and the buses and cabs looping along Bridge Street.
//
// Origin = the Exit 4 entrance in the Portcullis House arcade; +x east, +z south; street level y = 0.
// Each part lives in src/world/street/*.js and is built inside its own try/catch so that one failure
// never removes the whole street. Sub-modules receive (ctx, group, plan, state).
//
// Registers: 'street' (api), 'nav:street', 'spawn:street', 'speakers:street' ([]), 'street:vehicles',
// 'street:signals', 'street:clock', 'street:sun'.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import * as layout from '../core/layout.js';
import { makePlan } from './street/roads.js';
import { Instancer } from './street/kit.js';

const PARTS = [
  ['sky', './street/sky.js', 'buildSky'],
  ['roads', './street/roads.js', 'buildRoads'],
  ['portcullis', './street/portcullisHouse.js', 'buildPortcullisHouse'],
  ['tower', './street/elizabethTower.js', 'buildElizabethTower'],
  ['palace', './street/palace.js', 'buildPalace'],
  ['whitehall', './street/whitehall.js', 'buildWhitehall'],
  ['bridge', './street/bridge.js', 'buildBridge'],
  ['thames', './street/thames.js', 'buildThames'],
  ['furniture', './street/furniture.js', 'buildFurniture'],
  ['vehicles', './street/vehicles.js', 'buildVehicles'],
];

export async function build(ctx) {
  const group = new THREE.Group(); group.name = 'street'; ctx.scene.add(group);
  const plan = makePlan(layout);
  const late = new Instancer(group);   // instancers shared across parts (trees) — flushed once every part has added to them
  const state = { plan, parts: {}, floors: [], blockers: [], emitters: [], lights: 0, late };
  for (const [name, path, fn] of PARTS) {
    const t0 = performance.now();
    try {
      const mod = await import(path);
      const r = mod[fn] ? mod[fn](ctx, group, plan, state) : null;
      state.parts[name] = r || true;
      console.log(`[street] ${name} built in ${(performance.now() - t0).toFixed(0)} ms`);
    } catch (e) { console.warn(`[street] part '${name}' failed:`, e); state.parts[name] = null; }
  }
  try { late.flush(); } catch (e) { console.warn('[street] late instancer flush failed', e); }

  // ---------------------------------------------------------------- nav graph + spawn points for the NPC module
  try {
    const S = layout.STREET; const nodes = [], edges = []; const id = (n) => 'st-' + n;
    const N = (n, x, y, z) => { nodes.push({ id: id(n), x, y, z }); return id(n); };
    const E = (a, b, o) => edges.push(o ? [a, b, o] : [a, b]);
    const chain = (ids) => { for (let i = 1; i < ids.length; i++) E(ids[i - 1], ids[i]); };
    const north = [-74, -60, -46, -32, -24, -14, -6, 0, 6, 14, 24, 34, 44].map(x => N('n' + x, x, 0, 2.4)); chain(north);
    const south = [-80, -66, -52, -38, -24, -10, 4, 14, 24, 32, 40, 50, 58, 66, 74, 80].map(x => N('s' + x, x, 0, 24.6)); chain(south);
    const ent = N('entrance', S.entranceMain.x, 0, 0.6); E(ent, id('n0')); E(ent, id('n-6')); E(ent, id('n6'));
    const cross = [8.5, 13.5, 18.5].map(z => N('cross' + z, plan.crossings.pelicanX, 0, z)); chain([id('n44'), N('crossN', plan.crossings.pelicanX, 0, 3.6), ...cross, N('crossS', plan.crossings.pelicanX, 0, 23.5), id('s40')]);
    const zebra = [8.5, 13.5, 18.5].map(z => N('zebra' + z, plan.crossings.zebraX, 0, z)); chain([id('n-74'), ...zebra, id('s-80')]);
    const corner = [N('corner1', 70, 0, 2.4), N('corner2', 78, 0, 1.5)]; chain([id('n44'), N('embCrossW', 50, 0, 2.2), N('embCrossE', 63, 0, 2.2), ...corner]);
    const river = [-8, -20, -34, -50, -66, -90].map(z => N('river' + z, 79, 0, z)); chain([corner[1], ...river]);
    const embW = [-10, -30, -50, -70, -90].map(z => N('embW' + z, 43.5, 0, z)); chain([id('n44'), ...embW]);
    const exit1 = N('exit1top', S.exit1.x + 1.5, 0, S.exit1.z); E(exit1, id('river-20')); E(exit1, id('river-8'));
    const exit2 = N('exit2top', S.exit2.x + 2.2, 0, S.exit2.z); E(exit2, id('river-8')); E(exit2, corner[1]);
    const exit3 = N('exit3top', S.exit3.x, 0, S.exit3.z + 1.6); E(exit3, id('s50')); E(exit3, id('s40'));
    const bridgeN = [92, 110, 130].map(x => N('bridgeN' + x, x, 0.4, 2.2)); chain([corner[1], ...bridgeN]); const bridgeS = [92, 110, 130].map(x => N('bridgeS' + x, x, 0.4, 24)); chain([id('s80'), ...bridgeS]);
    const parlE = [-10, -26, -44, -64].map(z => N('parlE' + z, -74, 0, z)); chain([id('n-74'), ...parlE]); const exit5 = N('exit5top', S.exit5.x + 2.3, 0, S.exit5.z + 2); E(exit5, id('parlE-10')); E(exit5, id('parlE-26'));
    const parlW = [-14, -30, -48, -66].map(z => N('parlW' + z, -104, 0, z)); chain(parlW); const exit6 = N('exit6top', S.exit6.x + 2.3, 0, S.exit6.z + 2); E(exit6, id('parlW-14')); E(exit6, id('parlW-30'));
    const sq = [N('sqNE', -106, 0, 8), N('sqE', -106, 0, 30), N('sqE2', -106, 0, 60)]; chain([id('s-80'), N('gates', -80, 0, 24), sq[0]]); chain(sq); E(sq[0], id('parlW-14'));
    const bus = N('busStopH', S.busStop.x, 0, 3.6); E(bus, id('n-24')); E(bus, id('n-32'));
    ctx.register('nav:street', { nodes, edges });
    ctx.register('spawn:street', [{ x: -74, y: 0, z: 2.4 }, { x: 44, y: 0, z: 25 }, { x: 110, y: 0.4, z: 2.2 }, { x: 110, y: 0.4, z: 24 }, { x: 79, y: 0, z: -80 }, { x: -74, y: 0, z: -64 }, { x: -104, y: 0, z: -66 }, { x: -106, y: 0, z: 60 }, { x: 60, y: 0, z: 25 }]);
  } catch (e) { console.warn('[street] nav graph failed', e); }

  ctx.register('speakers:street', []);
  const api = {
    group, plan, parts: state.parts, emitters: state.emitters,
    get sun() { return state.parts.sky && state.parts.sky.sun; },
    vehicles: state.parts.vehicles || null, signals: state.parts.vehicles && state.parts.vehicles.signals || null,
    clock: state.parts.tower && state.parts.tower.clock || null,
    pigeons: state.pigeons || [],
  };
  ctx.register('street', api);
  if (state.parts.sky) ctx.register('street:sun', state.parts.sky);
  if (state.parts.vehicles) { ctx.register('street:vehicles', state.parts.vehicles); if (state.parts.vehicles.signals) ctx.register('street:signals', state.parts.vehicles.signals); }
  if (state.parts.tower && state.parts.tower.clock) ctx.register('street:clock', state.parts.tower.clock);
  return api;
}
