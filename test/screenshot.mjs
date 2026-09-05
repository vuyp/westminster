#!/usr/bin/env node
// Render one module (or the whole app) headlessly and save PNGs.
//   node test/screenshot.mjs --module world/street --pos 0,1.7,5 --look 0,1.7,-10 --out /tmp/street.png
//   node test/screenshot.mjs --module world/ticketHall --views "hall:0,-4.8,-10:0,-5,-30;gates:-10,-4.8,-15:-10,-5,-25" --outdir /tmp/shots
//   node test/screenshot.mjs --full --pos 14,0,3.5 --yaw -40 --pitch 20 --out /tmp/full.png     (whole app via index.html?autostart=1)
//   extra: --advance 40 (advance the simulation 40 s deterministically before shooting) --showFloors --showBlockers --lights 0 --width 1280 --height 720 --wait 1500 --fov 75 --skip street --only ticketHall --time 14:30
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from './server.mjs';
import { launch } from './browser.mjs';

const args = process.argv.slice(2); const opt = {}; for (let i = 0; i < args.length; i++) { const a = args[i]; if (a.startsWith('--')) { const k = a.slice(2); const v = (i + 1 < args.length && !args[i + 1].startsWith('--')) ? args[++i] : '1'; opt[k] = v; } }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { port, close } = await serve(root);
const { page, logs, close: closeBrowser } = await launch({ width: Number(opt.width || 1280), height: Number(opt.height || 720) });
const wait = Number(opt.wait || 1200);
const views = [];
if (opt.views) for (const v of opt.views.split(';')) { const [name, pos, look] = v.split(':'); views.push({ name, pos, look }); }
else views.push({ name: 'shot', pos: opt.pos || '0,1.7,5', look: opt.look || '0,1.7,-10' });
const outdir = opt.outdir || path.dirname(opt.out || 'shot.png'); fs.mkdirSync(outdir, { recursive: true });
try {
  if (opt.full) {
    const q = new URLSearchParams({ autostart: '1', mute: '1' }); if (opt.pos) q.set('pos', opt.pos); if (opt.yaw) q.set('yaw', opt.yaw); if (opt.pitch) q.set('pitch', opt.pitch); if (opt.skip) q.set('skip', opt.skip); if (opt.only) q.set('only', opt.only); if (opt.quality) q.set('quality', opt.quality); if (opt.time) q.set('time', opt.time);
    await page.goto(`http://127.0.0.1:${port}/index.html?${q}`);
    await page.waitForFunction(() => window.__app && window.__app.ready, null, { timeout: 180000 });
    await page.waitForTimeout(wait);
    if (opt.advance) await page.evaluate(n => window.__app.advance(n), Number(opt.advance));
    for (const v of views) {
      if (opt.views) { const [x, y, z] = v.pos.split(',').map(Number); const [lx, ly, lz] = v.look.split(',').map(Number); await page.evaluate(([x, y, z, lx, ly, lz]) => { const p = window.__app.player; p.teleport(x, y, z); p.lookAt(new window.__app.THREE.Vector3(lx, ly, lz)); p.updateCamera(0); }, [x, y, z, lx, ly, lz]); await page.waitForTimeout(400); }
      const file = opt.out && !opt.views ? opt.out : path.join(outdir, `${v.name}.png`); await page.screenshot({ path: file, timeout: 300000 }); console.log('wrote', file);
    }
    const stats = await page.evaluate(() => window.__app.stats ? window.__app.stats() : null); console.log('stats', JSON.stringify(stats));
    const ft = await page.evaluate(() => { const f = window.__app.frameTimes || []; f.sort((a, b) => a - b); return f.length ? { median: f[f.length >> 1].toFixed(1), p90: f[Math.floor(f.length * 0.9)].toFixed(1), n: f.length } : null; }); console.log('frame ms (swiftshader, not representative of a GPU):', JSON.stringify(ft));
  } else {
    const q = new URLSearchParams({ module: opt.module || 'world/street' }); if (opt.showFloors) q.set('showFloors', '1'); if (opt.showBlockers) q.set('showBlockers', '1'); if (opt.lights) q.set('lights', opt.lights); if (opt.fov) q.set('fov', opt.fov); if (opt.quality) q.set('quality', opt.quality);
    q.set('pos', views[0].pos); q.set('look', views[0].look);
    await page.goto(`http://127.0.0.1:${port}/test/harness.html?${q}`);
    await page.waitForFunction(() => window.__app && window.__app.ready, null, { timeout: 180000 });
    await page.waitForTimeout(wait);
    if (opt.advance) await page.evaluate(n => window.__app.advance(n), Number(opt.advance));
    for (const v of views) {
      await page.evaluate(([pos, look, fov]) => window.__app.setView(pos.split(',').map(Number), look.split(',').map(Number), fov), [v.pos, v.look, Number(opt.fov || 0) || null]);
      await page.waitForTimeout(300);
      const file = opt.out && !opt.views ? opt.out : path.join(outdir, `${v.name}.png`); await page.screenshot({ path: file, timeout: 300000 }); console.log('wrote', file);
    }
    const stats = await page.evaluate(() => window.__app.stats()); console.log('stats', JSON.stringify(stats));
  }
  const errors = await page.evaluate(() => window.__app.errors);
  if (errors.length) { console.log('APP ERRORS:'); errors.forEach(e => console.log('  ' + e)); }
  if (logs.length) { console.log('CONSOLE:'); logs.slice(0, 40).forEach(l => console.log('  ' + l)); }
  process.exitCode = errors.length ? 1 : 0;
} finally { await closeBrowser(); close(); }
