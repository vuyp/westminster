#!/usr/bin/env node
// Headless Web Audio test for the soundscape (run: node test/audio.mjs).
// Boots index.html?autostart=1&only=soundscape, resumes the AudioContext (headless Chromium allows it thanks to
// --autoplay-policy=no-user-gesture-required in browser.mjs), and checks: the context is running, beds and emitters
// exist and switch with the zone, Big Ben rings, the station PA and on-train helpers produce the canonical wording,
// and the schedulers fire one-shots while the simulation is advanced. Prints Web Audio graph node counts.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './server.mjs';
import { launch } from './browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { port, close } = await serve(root);
const { page, logs, close: closeBrowser } = await launch({ width: 640, height: 360 });
let failed = false;
const check = (cond, msg) => { console.log((cond ? 'ok    ' : 'FAIL  ') + msg); if (!cond) failed = true; };
try {
  // count every AudioNode the page creates, by factory method
  await page.addInitScript(() => {
    const counts = {}; window.__audioNodeCounts = counts; const P = BaseAudioContext.prototype;
    for (const m of Object.getOwnPropertyNames(P)) {
      if (!/^create[A-Z]/.test(m) || m === 'createBuffer' || m === 'createPeriodicWave') continue;
      const d = Object.getOwnPropertyDescriptor(P, m); if (!d || typeof d.value !== 'function') continue; const orig = d.value;
      P[m] = function (...a) { counts[m] = (counts[m] || 0) + 1; return orig.apply(this, a); };
    }
  });
  await page.goto(`http://127.0.0.1:${port}/index.html?autostart=1&only=soundscape`);
  await page.waitForFunction(() => window.__app && window.__app.ready, null, { timeout: 180000 });
  const built = await page.evaluate(() => Object.keys(window.__app.built));
  check(built.includes('soundscape'), 'soundscape module built (' + built.join(', ') + ')');
  await page.evaluate(() => { window.__app.player.frozen = true; });   // no floors are loaded: keep the player from falling through zones

  const resumed = await page.evaluate(() => window.__app.audio.resume());
  check(resumed === true, 'audio.resume() → ' + resumed);
  await page.waitForTimeout(3000);

  const st = await page.evaluate(() => {
    const a = window.__app.audio;
    return { state: a.ctx && a.ctx.state, ready: a.ready, zone: a.zone, emitters: a.emitters.length, emitterSynths: a.emitters.map(e => e.synthName), beds: [...a.beds.keys()], bedNodes: [...a.beds.values()].map(b => !!(b.node && b.gain)), active: [...a.beds.entries()].filter(([, b]) => b.active).map(([k]) => k), synths: [...a.synths.keys()].filter(k => /soundscape|bigBen/.test(k)) };
  });
  console.log('      ' + JSON.stringify(st));
  check(st.state === 'running', 'AudioContext state running');
  check(st.ready === true, 'audio.ready');
  check(st.emitters >= 4, `emitters registered (${st.emitters})`);
  check(st.beds.length >= 4 && ['street', 'hall', 'subsurface', 'box'].every(z => st.beds.includes(z)), 'beds for street/hall/subsurface/box');
  check(st.bedNodes.every(Boolean), 'every bed has a running synth node');
  check(st.active.length === 1 && st.active[0] === 'street', 'only the street bed is active at spawn');
  check(st.synths.length >= 12, `soundscape/bigBen synths registered (${st.synths.length})`);

  // zone switch → beds cross-fade
  const sw = await page.evaluate(() => { window.__app.audio.setZone('hall'); return [...window.__app.audio.beds.entries()].filter(([, b]) => b.active).map(([k]) => k); });
  check(sw.length === 1 && sw[0] === 'hall', 'setZone(hall) activates only the hall bed');

  // Big Ben: registration, schedule shape, strikes actually sound
  const bb = await page.evaluate(() => {
    const b = window.__app.ctx.get('bigBen'); const ev4 = window.__app.ringBigBen(4, 3); const q1 = b.chimeSchedule(1), q3 = b.chimeSchedule(3);
    return { registered: !!b, ev4: ev4.length, strokes: ev4.filter(e => e.bell === 'greatBell').length, firstStroke: ev4.find(e => e.bell === 'greatBell').t, q1: q1.map(e => e.bell).join(' '), q3: q3.length, ringing: !!b.ringing, pos: b.position.toArray().map(v => +v.toFixed(1)), next: b.nextEvent(), profile: b.profile() };
  });
  console.log('      ' + JSON.stringify(bb));
  check(bb.registered, "ctx.get('bigBen') registered");
  check(bb.ev4 === 16 + 3 && bb.strokes === 3 && bb.firstStroke === 25, 'hour sequence = 4 changes (16 strikes) + 3 strokes, first stroke on the hour (t = 25 s)');
  check(bb.q1 === 'G#4 F#4 E4 B3' && bb.q3 === 12, 'quarter past = change 1 (G#4 F#4 E4 B3); quarter to = 12 strikes');
  check(bb.ringing, 'ringBigBen(4) is ringing');
  await page.waitForTimeout(2600);
  const rung = await page.evaluate(() => window.__app.ctx.get('bigBen').state.rung);
  check(rung >= 3, `quarter bells struck so far: ${rung}`);
  await page.evaluate(() => window.__app.ctx.get('bigBen').stop());

  // Station PA + on-train wording
  const pa = await page.evaluate(() => {
    const s = window.__app.ctx.get('soundscape');
    const a = s.onTrainEvent('arriving', { platform: 1, line: 'circle', destination: 'Edgware Road', direction: 'westbound' });
    const j = s.onTrainEvent('arriving', { platform: 3, line: 'jubilee', destination: 'Stratford', direction: 'eastbound' });
    const fake = { line: 'jubilee', direction: 'eastbound', destination: 'Stratford', group: new window.__app.THREE.Group(), setDisplay(t) { this.display = t; } };
    const p = s.announceOnTrain(fake, 'departing');
    const s7 = { line: 'district', direction: 'westbound', destination: 'Wimbledon', stock: 'S7', group: new window.__app.THREE.Group() };
    const s7text = s.announceOnTrain(s7, 'arriving');
    const t = s.options; const ann = window.__app.ctx.get('soundscape');
    return { a, j, promise: !!(p && p.then), display: fake.display, s7: !!s7text, queue: window.__app.audio.speechQueue.length + (window.__app.audio.speaking ? 1 : 0), speakers: ann.pa.list('jubileeUpper').length };
  });
  console.log('      ' + JSON.stringify(pa));
  check(/^The next train will be a Circle line service calling at all stations to Edgware Road\. Please stand behind the yellow line/.test(pa.a), 'D&C next-train PA wording');
  check(pa.j === 'The next train will be a Jubilee line service calling at all stations to Stratford.', 'Jubilee next-train PA wording (no yellow-line clause)');
  check(pa.promise && pa.display === 'This train terminates at Stratford', 'announceOnTrain(departing) speaks and sets the in-car display');
  check(pa.s7, 'announceOnTrain works for an S7 train');
  check(pa.speakers >= 3, 'fallback speaker positions when no platform module is loaded');

  // schedulers: advance the simulation in the street, then in the hall
  const stats = await page.evaluate(() => {
    const app = window.__app; app.audio.setZone('street'); app.advance(150); app.audio.setZone('hall'); app.advance(120);
    const s = app.ctx.get('soundscape'); return { ...s.stats, fired: Object.fromEntries(s.schedulers.map(x => [x.name, x.fired])), errored: s.schedulers.filter(x => x.errored).map(x => x.name), log: s.log.slice(-3) };
  });
  console.log('      ' + JSON.stringify(stats));
  check(stats.oneShots > 0 && stats.fired.pigeon > 0 && stats.fired.gateline > 0, 'one-shots fired while advancing the simulation');
  check(stats.errored.length === 0, 'no scheduler threw');

  const counts = await page.evaluate(() => window.__audioNodeCounts);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log('graph node counts:', JSON.stringify(counts), 'total', total);

  const errors = await page.evaluate(() => window.__app.errors);
  if (errors.length) { failed = true; console.log('APP ERRORS:'); errors.forEach(e => console.log('  ' + e)); }
  const bad = logs.filter(l => !/favicon|Failed to load resource.*404|requestfailed|not present yet|Autoplay/.test(l));
  if (bad.length) { console.log('CONSOLE (errors/warnings):'); bad.slice(0, 40).forEach(l => console.log('  ' + l)); if (bad.some(l => /\[error\]|\[pageerror\]/.test(l))) failed = true; }
} finally { await closeBrowser(); close(); }
console.log(failed ? 'AUDIO TEST FAILED' : 'AUDIO TEST PASSED');
process.exit(failed ? 1 : 0);
