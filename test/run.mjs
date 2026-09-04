#!/usr/bin/env node
// Full-app smoke test: boots index.html headlessly, teleports through a scripted route, walks a bit,
// asserts no errors, prints stats, writes screenshots to test/out/.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from './server.mjs';
import { launch } from './browser.mjs';
import { ROUTE } from './route.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outdir = path.join(root, 'test', 'out'); fs.mkdirSync(outdir, { recursive: true });
const { port, close } = await serve(root);
const { page, logs, close: closeBrowser } = await launch({ width: 1280, height: 720 });
let failed = false;
try {
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/index.html?autostart=1&mute=1`);
  await page.waitForFunction(() => window.__app && window.__app.ready, null, { timeout: 300000 });
  console.log(`booted in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await page.waitForTimeout(1500);
  const built = await page.evaluate(() => Object.keys(window.__app.built)); console.log('built modules:', built.join(', '));
  for (const step of ROUTE) {
    await page.evaluate(([x, y, z, yaw, pitch]) => window.__app.teleport(x, y, z, yaw, pitch), [step.x, step.y, step.z, step.yaw, step.pitch ?? 0]);
    await page.evaluate(() => window.__app.advance(0.5));
    if (step.advanceUntil) { // e.g. 'doorsOpen:jubileeUpper' — advance the simulation until that track's train is stopped with doors open
      const [what, key] = step.advanceUntil.split(':');
      const ok = await page.evaluate(([what, key]) => { const svc = window.__app.ctx.get('trainService'); if (!svc) return false; for (let i = 0; i < 400; i++) { const a = svc.lines[key] && svc.lines[key].active; if (a && what === 'doorsOpen' && a.state === 'stopped' && a.train.doorsOpen) return true; window.__app.advance(1); } return false; }, [what, key]);
      console.log(`  advanceUntil ${step.advanceUntil}: ${ok}`); if (!ok) failed = true;
    }
    if (step.walk) { await page.keyboard.down('KeyW'); await page.evaluate(s => window.__app.advance(s), step.walk); await page.keyboard.up('KeyW'); await page.evaluate(() => window.__app.advance(0.2)); }
    if (step.advance) await page.evaluate(s => window.__app.advance(s), step.advance);
    await page.waitForTimeout(300);
    const file = path.join(outdir, `${String(ROUTE.indexOf(step) + 1).padStart(2, '0')}-${step.name}.png`); await page.screenshot({ path: file });
    const pos = await page.evaluate(() => { const p = window.__app.player; return { x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2), zone: p.zone && p.zone.id, grounded: p.grounded, train: !!p.train }; });
    console.log(`${step.name.padEnd(22)} pos=${JSON.stringify(pos)}`);
    if (step.expectZone && pos.zone !== step.expectZone) { console.log(`  !! expected zone ${step.expectZone}`); failed = true; }
    if (step.expectY != null && Math.abs(pos.y - step.expectY) > 0.6) { console.log(`  !! expected y≈${step.expectY}`); failed = true; }
    if (step.expectTrain != null && pos.train !== step.expectTrain) { console.log(`  !! expected train=${step.expectTrain}`); failed = true; }
    if (step.expectGrounded && !pos.grounded) { console.log('  !! expected grounded'); failed = true; }
  }
  const stats = await page.evaluate(() => window.__app.stats()); console.log('stats', JSON.stringify(stats));
  const errors = await page.evaluate(() => window.__app.errors);
  if (errors.length) { failed = true; console.log('APP ERRORS:'); errors.forEach(e => console.log('  ' + e)); }
  const bad = logs.filter(l => !/favicon/.test(l)); if (bad.length) { console.log('CONSOLE (errors/warnings):'); bad.slice(0, 60).forEach(l => console.log('  ' + l)); if (bad.some(l => /\[error\]|\[pageerror\]/.test(l))) failed = true; }
} finally { await closeBrowser(); close(); }
console.log(failed ? 'SMOKE TEST FAILED' : 'SMOKE TEST PASSED');
process.exit(failed ? 1 : 0);
