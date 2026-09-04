// ---------------------------------------------------------------------------
// main.js — boots the station.
// URL params: ?autostart=1 (skip start screen, no pointer lock — used by tests)
//             ?pos=x,y,z&yaw=deg&pitch=deg   ?quality=low|high   ?mute=1
//             ?skip=street,npcs   ?only=ticketHall   ?time=HH:MM
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { createEngine } from './core/engine.js';
import { createContext } from './core/context.js';
import { Collision } from './core/collision.js';
import * as layout from './core/layout.js';
import { AudioEngine } from './systems/audio.js';
import { Player } from './systems/player.js';
import { HUD } from './ui/hud.js';
import { stationMapHTML } from './ui/stationMap.js';

const WORLD_MODULES = [
  ['street', './world/street.js'],
  ['ticketHall', './world/ticketHall.js'],
  ['jubileeBox', './world/jubileeBox.js'],
  ['jubileePlatforms', './world/jubileePlatforms.js'],
  ['districtPlatforms', './world/districtPlatforms.js'],
];
const SYSTEM_MODULES = [
  ['trainService', './systems/trainService.js'],
  ['npcs', './entities/npcs.js'],
  ['soundscape', './audio/soundscape.js'],
];

const params = new URLSearchParams(location.search);
const autostart = params.get('autostart') === '1';
const quality = params.get('quality') || (navigator.hardwareConcurrency <= 4 ? 'high' : 'high');
const skip = new Set((params.get('skip') || '').split(',').filter(Boolean));
const only = params.get('only') ? new Set(params.get('only').split(',')) : null;

const app = { ready: false, errors: [], built: {}, layout, THREE };
window.__app = app;
window.addEventListener('error', e => app.errors.push(String(e.message || e)));
window.addEventListener('unhandledrejection', e => app.errors.push('unhandledrejection: ' + String(e.reason && e.reason.stack || e.reason)));

async function boot() {
  const canvas = document.getElementById('view');
  const engine = createEngine({ canvas, quality });
  const hud = new HUD(); hud.setMapHTML(stationMapHTML());
  const audio = new AudioEngine({ hud });
  const collision = new Collision();
  const ctx = createContext({ scene: engine.scene, collision, audio, hud, quality });
  ctx.camera = engine.camera; ctx.renderer = engine.renderer; ctx.engine = engine;
  const player = new Player({ camera: engine.camera, collision, audio, hud, ctx, domElement: canvas, noLock: autostart });
  ctx.player = player;
  Object.assign(app, { engine, scene: engine.scene, camera: engine.camera, hud, audio, collision, ctx, player });

  // Clock: the station runs on real London time unless ?time=HH:MM is given
  const t0 = params.get('time'); const startMs = t0 ? (() => { const [h, m] = t0.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime(); })() : Date.now();
  const realStart = performance.now();
  ctx.stationTime = () => new Date(startMs + (performance.now() - realStart));

  hud.status('Building station…');
  const loadList = async (list, kind) => {
    for (const [name, path] of list) {
      if (skip.has(name) || (only && !only.has(name))) continue;
      hud.status(`Building ${name}…`);
      try {
        const mod = await import(path);
        const t = performance.now();
        const result = await mod.build(ctx);
        app.built[name] = result || true;
        console.log(`[build] ${kind} ${name} in ${(performance.now() - t).toFixed(0)} ms`);
      } catch (e) {
        if (e && /Failed to fetch dynamically imported module|Cannot find module|404/.test(String(e.message))) { console.warn(`[build] ${name} not present yet (${path})`); }
        else { console.error(`[build] ${name} failed`, e); app.errors.push(`${name}: ${e && e.stack || e}`); }
      }
      await new Promise(r => setTimeout(r, 0));
    }
  };
  await loadList(WORLD_MODULES, 'world');
  await loadList(SYSTEM_MODULES, 'system');

  // fallback lighting if nothing created a sun / ambient (e.g. street module skipped)
  let hasLight = false; engine.scene.traverse(o => { if (o.isLight) hasLight = true; });
  if (!hasLight) { engine.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x404040, 1.2)); }

  // position override
  if (params.get('pos')) { const [x, y, z] = params.get('pos').split(',').map(Number); player.teleport(x, y, z, params.get('yaw') != null ? Number(params.get('yaw')) : null, params.get('pitch') != null ? Number(params.get('pitch')) : null); }
  if (params.get('mute') === '1') audio.setMuted(true);

  app.teleport = (x, y, z, yaw, pitch) => player.teleport(x, y, z, yaw, pitch);
  app.stats = () => ({ calls: engine.renderer.info.render.calls, triangles: engine.renderer.info.render.triangles, lights: ctx.lights.count, geometries: engine.renderer.info.memory.geometries, textures: engine.renderer.info.memory.textures, floors: collision.floors.length, blockers: collision.blockers.length, emitters: audio.emitters.length });
  app.frameTimes = [];
  /** Deterministically advance the simulation by `seconds` (used by tests; no rendering). */
  app.advance = (seconds, step = 1 / 30) => { let t = 0; while (t < seconds) { const dt = Math.min(step, seconds - t); player.update(dt); ctx._update(dt, engine.clock.getElapsedTime() + t); t += dt; } };

  hud.status('Ready.');
  hud.onStart(async () => { await audio.resume(); hud.hideStart(); player.requestLock(); });
  if (autostart) { hud.hideStart(); player.enabled = true; player.noLock = true; }

  // main loop
  let last = performance.now();
  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now(); const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const elapsed = engine.clock.getElapsedTime();
    player.update(dt);
    ctx._update(dt, elapsed);
    audio.update(dt, engine.camera);
    const st = ctx.stationTime(); hud.clock(st.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    engine.render();
    if (app.frameTimes.length < 600) app.frameTimes.push(performance.now() - now);
  }
  frame();
  app.ready = true;
  document.dispatchEvent(new Event('app-ready'));
}

boot().catch(e => { console.error(e); app.errors.push(String(e && e.stack || e)); app.ready = true; });
