// ---------------------------------------------------------------------------
// soundscape.js — the station's living soundscape on top of the AudioEngine:
//   * ambience beds per reverb zone (street / hall / subsurface / box)
//   * randomly-timed one-shots (sirens, pigeons, gulls, buses, gate beeps,
//     distant trains, escalator stop beeps) placed in the world
//   * continuous colour emitters (JLE vent grates, the river wall, the bagpiper
//     on Westminster Bridge)
//   * Big Ben (src/audio/bigBen.js)
//   * the station PA: 'next train' messages on the right platform speakers when
//     the train service reports an approaching train, Phil Sayer's inserts, and
//     periodic safety / customer / service-update messages in the ticket hall
//
// Nothing here makes a sound before ctx.audio.ready (user gesture): beds and
// emitters connect lazily inside the engine, one-shots and the PA check `ready`.
//
// Registered: 'soundscape' (this api), 'bigBen'. Reads: 'trainService',
// 'speakers:ticketHall' | 'speakers:district' | 'speakers:jubileeUpper' |
// 'speakers:jubileeLower' | 'speakers:box' (positions from the world modules).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { LEVELS, STREET, TICKET_HALL, JUBILEE, DISTRICT, ESCALATORS, dcToWorld } from '../core/layout.js';
import { TRAIN_ANNOUNCEMENTS, STATION_PA, DESTINATIONS, LINE_NAMES, OPTIONS, trainLine, pickDestination } from './announcements.js';
import { createBigBen } from './bigBen.js';

export { TRAIN_ANNOUNCEMENTS, STATION_PA, DESTINATIONS, OPTIONS };

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;

// ---------------------------------------------------------------------------
// synth helpers (shared noise buffers cached on the AudioContext)
// ---------------------------------------------------------------------------
function noiseBuffer(c, seconds = 3, pink = false) {
  const key = '_ssNoise' + (pink ? 'P' : 'W') + seconds; if (c[key]) return c[key];
  const len = Math.floor(c.sampleRate * seconds); const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, seed = 2024 + (pink ? 7 : 0);
  for (let i = 0; i < len; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0; const w = (seed / 4294967296) * 2 - 1;
    if (!pink) { d[i] = w; continue; }
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  c[key] = b; return b;
}
const noiseSource = (c, pink = false, seconds = 3) => { const s = c.createBufferSource(); s.buffer = noiseBuffer(c, seconds, pink); s.loop = true; return s; };
const stopAll = (nodes) => { for (const n of nodes) { try { n.stop(); } catch (e) { /* already stopped */ } } };
const startAll = (nodes, t) => { for (const n of nodes) { try { n.start(t); } catch (e) { /* already started */ } } };
const osc = (c, type, freq) => { const o = c.createOscillator(); o.type = type; o.frequency.value = freq; return o; };
const gain = (c, v) => { const g = c.createGain(); g.gain.value = v; return g; };
const filt = (c, type, freq, Q = 1) => { const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = Q; return f; };
/** LFO → param (adds ±depth around the param's own value). */
const lfo = (c, rate, depth, param, type = 'sine') => { const o = osc(c, type, rate); const g = gain(c, depth); o.connect(g); g.connect(param); return o; };

function registerSynths(audio) {
  const reg = (name, f) => { if (!audio.synths.has(name)) audio.registerSynth(name, f); };

  // Crowd murmur: pink noise through four wandering formant band-passes with syllabic amplitude modulation, plus three
  // buzzy 'voices' (low sawtooths through narrow band-passes) that swell in and out — never intelligible, always there.
  reg('soundscape:murmur', (c, { level = 0.3 } = {}) => {
    const out = gain(c, level); const lp = filt(c, 'lowpass', 2600, 0.6); const n = noiseSource(c, true); const lfos = [];
    for (const [f, q, rate, g] of [[260, 2.5, 0.09, 0.8], [520, 3.0, 0.17, 0.6], [1100, 4.0, 0.31, 0.38], [2200, 5.0, 0.23, 0.16]]) {
      const bp = filt(c, 'bandpass', f, q); const gg = gain(c, g);
      lfos.push(lfo(c, rate, f * 0.22, bp.frequency), lfo(c, rate * 7.3 + 0.7, g * 0.45, gg.gain));
      n.connect(bp); bp.connect(gg); gg.connect(lp);
    }
    const voices = [];
    for (const [f, syl] of [[128, 3.1], [176, 2.6], [215, 3.7]]) {
      const o = osc(c, 'sawtooth', f * (1 + (Math.random() - 0.5) * 0.04)); const bp = filt(c, 'bandpass', f * 4, 1.4); const g = gain(c, 0.018);
      lfos.push(lfo(c, syl, 0.016, g.gain), lfo(c, 0.04 + Math.random() * 0.05, 0.018, g.gain));
      o.connect(bp); bp.connect(g); g.connect(lp); voices.push(o);
    }
    lp.connect(out);
    return { output: out, start() { n.start(); startAll(lfos); startAll(voices); }, stop() { stopAll([n, ...lfos, ...voices]); }, set(k, v) { if (k === 'level') out.gain.setTargetAtTime(v, c.currentTime, 0.8); } };
  });

  // Ticket hall bed: luminaire hum + ventilation + crowd murmur (murmur level follows the time of day via set('murmur', x)).
  reg('soundscape:hallBed', (c, { level = 0.5, murmur = 0.35 } = {}) => {
    const out = gain(c, level);
    const humF = audio.synths.get('hum'); const hum = humF ? humF(c, { freq: 100, level: 0.1 }) : { start() {}, stop() {} }; if (hum.output) hum.output.connect(out);
    const vent = noiseSource(c, true); const vlp = filt(c, 'lowpass', 260, 0.6); const vg = gain(c, 0.22); const vl = lfo(c, 0.08, 60, vlp.frequency); vent.connect(vlp); vlp.connect(vg); vg.connect(out);
    const m = audio.synths.get('soundscape:murmur')(c, { level: murmur }); m.output.connect(out);
    return { output: out, start() { hum.start(); vent.start(); vl.start(); m.start(); }, stop() { hum.stop(); stopAll([vent, vl]); m.stop(); }, set(k, v) { if (k === 'murmur') m.set('level', v); if (k === 'level') out.gain.setTargetAtTime(v, c.currentTime, 0.8); } };
  });

  // Sub-surface platforms (D&C and the Jubilee tunnels): dry — mains hum from the luminaires and cabinets, a structure-borne
  // rumble that breathes very slowly, and the faintest air movement. Trains and drips are positional (other modules) or one-shots.
  reg('soundscape:subsurfaceBed', (c, { level = 0.4 } = {}) => {
    const out = gain(c, level);
    const hums = [[50, 0.045], [100, 0.06], [150, 0.02], [300, 0.008]].map(([f, g]) => { const o = osc(c, 'sine', f); const gg = gain(c, g); o.connect(gg); gg.connect(out); return o; });
    const n = noiseSource(c, true); const lp = filt(c, 'lowpass', 120, 0.7); const g = gain(c, 0.35); const l = lfo(c, 0.03, 0.15, g.gain); n.connect(lp); lp.connect(g); g.connect(out);
    const air = noiseSource(c, false, 2); const hp = filt(c, 'highpass', 2500, 0.5); const ag = gain(c, 0.012); air.connect(hp); hp.connect(ag); ag.connect(out);
    return { output: out, start() { startAll(hums); n.start(); l.start(); air.start(); }, stop() { stopAll([...hums, n, l, air]); }, set(k, v) { if (k === 'level') out.gain.setTargetAtTime(v, c.currentTime, 0.8); } };
  });

  // The Jubilee box: tunnel air + the merged drone of six-plus escalators (step-chain rumble 48–192 Hz with the beating of
  // machines running slightly out of step, the 520 Hz handrail-drive whine, the 2.5 steps/s comb-plate tick) + fan hiss.
  reg('soundscape:boxBed', (c, { level = 0.5 } = {}) => {
    const out = gain(c, level);
    const airF = audio.synths.get('tunnelAir'); const air = airF ? airF(c, { level: 0.5 }) : { start() {}, stop() {} }; if (air.output) air.output.connect(out);
    const drone = filt(c, 'lowpass', 900, 0.7); const dg = gain(c, 0.5); drone.connect(dg); dg.connect(out);
    const oscs = [[48, 0.14], [48.3, 0.1], [96, 0.09], [96.4, 0.06], [144, 0.05], [192, 0.03]].map(([f, g]) => { const o = osc(c, 'sawtooth', f); const gg = gain(c, g); o.connect(gg); gg.connect(drone); return o; });
    const whine = osc(c, 'triangle', 520); const wg = gain(c, 0.012); const wl = lfo(c, 0.6, 0.006, wg.gain); whine.connect(wg); wg.connect(out);
    const tick = noiseSource(c, false, 2); const tbp = filt(c, 'bandpass', 900, 1.2); const tg = gain(c, 0.05); const tl = lfo(c, 2.5, 0.045, tg.gain, 'square'); tick.connect(tbp); tbp.connect(tg); tg.connect(out);
    const fans = noiseSource(c, true); const fbp = filt(c, 'bandpass', 1200, 0.5); const fg = gain(c, 0.06); fans.connect(fbp); fbp.connect(fg); fg.connect(out);
    return { output: out, start() { air.start(); startAll([...oscs, whine, wl, tick, tl, fans]); }, stop() { air.stop(); stopAll([...oscs, whine, wl, tick, tl, fans]); }, set(k, v) { if (k === 'level') out.gain.setTargetAtTime(v, c.currentTime, 0.8); } };
  });

  // A train passing far away in the tunnel: a long low swell (20–140 Hz), optionally with the rails 'singing' first (D&C).
  reg('soundscape:rumble', (c, { seconds = 10, sing = false, level = 0.8 } = {}) => {
    const out = gain(c, level); const t0 = c.currentTime; const n = noiseSource(c, true); const lp = filt(c, 'lowpass', 60, 0.8); const g = gain(c, 0);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(1, t0 + seconds * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    lp.frequency.setValueAtTime(50, t0); lp.frequency.linearRampToValueAtTime(140, t0 + seconds * 0.55); lp.frequency.linearRampToValueAtTime(40, t0 + seconds);
    n.connect(lp); lp.connect(g); g.connect(out); const extra = [];
    if (sing) { const o = osc(c, 'sine', 420); const sg = gain(c, 0); const vib = lfo(c, 5.5, 6, o.frequency); o.frequency.linearRampToValueAtTime(780, t0 + seconds * 0.5); sg.gain.setValueAtTime(0.0001, t0); sg.gain.exponentialRampToValueAtTime(0.05, t0 + seconds * 0.35); sg.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds * 0.7); o.connect(sg); sg.connect(out); extra.push(o, vib); }
    return { output: out, duration: seconds, start() { n.start(); startAll(extra); }, stop() { stopAll([n, ...extra]); } };
  });

  // Black-headed gull over the river: two or three descending 'kee-yah' cries.
  reg('soundscape:gull', (c, { cries = 2 } = {}) => {
    const out = gain(c, 0.5); const t0 = c.currentTime; const nodes = [];
    for (let i = 0; i < cries; i++) {
      const s = t0 + i * 0.55; const o = osc(c, 'sawtooth', 1700); const bp = filt(c, 'bandpass', 1500, 1.5); const g = gain(c, 0);
      o.frequency.setValueAtTime(1750, s); o.frequency.exponentialRampToValueAtTime(1150, s + 0.35);
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.5, s + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.42);
      o.connect(bp); bp.connect(g); g.connect(out); o.start(s); o.stop(s + 0.5); nodes.push(o);
    }
    return { output: out, duration: cries * 0.55 + 0.3, start() {}, stop() { stopAll(nodes); } };
  });

  // A bus at Stop H: the 'bus stopping' bell, the door air release, the door-closing beeps, and a diesel/hybrid idle that drives off.
  reg('soundscape:busStop', (c, { seconds = 9 } = {}) => {
    const out = gain(c, 0.7); const t0 = c.currentTime; const nodes = [];
    const bell = osc(c, 'sine', 1180); const bg = gain(c, 0); bg.gain.setValueAtTime(0.0001, t0); bg.gain.exponentialRampToValueAtTime(0.35, t0 + 0.01); bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.8); bell.connect(bg); bg.connect(out); bell.start(t0); bell.stop(t0 + 0.9); nodes.push(bell);
    const hiss = noiseSource(c, false, 2); const hbp = filt(c, 'bandpass', 3200, 0.7); const hg = gain(c, 0); hg.gain.setValueAtTime(0.0001, t0 + 1.0); hg.gain.exponentialRampToValueAtTime(0.25, t0 + 1.08); hg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.7); hiss.connect(hbp); hbp.connect(hg); hg.connect(out); hiss.start(t0 + 1.0); hiss.stop(t0 + 1.8); nodes.push(hiss);
    const beep = osc(c, 'square', 1600); const blp = filt(c, 'lowpass', 4500, 0.7); const beepG = gain(c, 0); for (let i = 0; i < 5; i++) { const s = t0 + 4.2 + i * 0.3; beepG.gain.setValueAtTime(0.16, s); beepG.gain.setValueAtTime(0, s + 0.1); } beep.connect(blp); blp.connect(beepG); beepG.connect(out); beep.start(t0 + 4.2); beep.stop(t0 + 6.0); nodes.push(beep);
    const idle = osc(c, 'sawtooth', 92); const ilp = filt(c, 'lowpass', 220, 0.8); const ig = gain(c, 0); ig.gain.setValueAtTime(0.14, t0); ig.gain.setValueAtTime(0.14, t0 + 6.0); ig.gain.linearRampToValueAtTime(0.2, t0 + 7.0); ig.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds); idle.frequency.setValueAtTime(92, t0 + 6.0); idle.frequency.linearRampToValueAtTime(150, t0 + seconds); const il = lfo(c, 11, 4, idle.frequency); idle.connect(ilp); ilp.connect(ig); ig.connect(out); idle.start(t0); idle.stop(t0 + seconds); il.start(t0); il.stop(t0 + seconds); nodes.push(idle, il);
    return { output: out, duration: seconds, start() {}, stop() { stopAll(nodes); } };
  });

  // Pelican-crossing beeper (limited audible units at the Parliament Street corner): pulsed 2.5 kHz for ~5 s.
  reg('soundscape:crossingBeeper', (c, { seconds = 5 } = {}) => {
    const out = gain(c, 0); const o = osc(c, 'square', 2500); const lp = filt(c, 'lowpass', 6000, 0.7); o.connect(lp); lp.connect(out); const t0 = c.currentTime;
    for (let t = 0; t < seconds; t += 0.25) { out.gain.setValueAtTime(0.18, t0 + t); out.gain.setValueAtTime(0, t0 + t + 0.08); }
    return { output: out, duration: seconds, start() { o.start(); }, stop() { stopAll([o]); } };
  });

  // The river wall: slow wash of the Thames against the granite, wave rhythm ≈ 0.12 Hz.
  reg('soundscape:river', (c, { level = 0.3 } = {}) => {
    const out = gain(c, level); const n = noiseSource(c, true); const bp = filt(c, 'bandpass', 900, 0.4); const g = gain(c, 0.5); const l = lfo(c, 0.12, 0.3, g.gain); const l2 = lfo(c, 0.31, 0.15, g.gain);
    n.connect(bp); bp.connect(g); g.connect(out); return { output: out, start() { startAll([n, l, l2]); }, stop() { stopAll([n, l, l2]); } };
  });

  // The Westminster Bridge bagpiper, heard from 200–400 m as a thin drone (bass drone A2 + two tenors, chanter on a loop).
  reg('soundscape:bagpipe', (c, { level = 0.25 } = {}) => {
    const out = gain(c, level); const lp = filt(c, 'lowpass', 2200, 0.8); lp.connect(out);
    const drones = [[118, 0.08], [236, 0.05], [236.6, 0.05]].map(([f, g]) => { const o = osc(c, 'sawtooth', f); const gg = gain(c, g); o.connect(gg); gg.connect(lp); return o; });
    const chanter = osc(c, 'sawtooth', 476); const cbp = filt(c, 'bandpass', 1900, 0.7); const cg = gain(c, 0.07); chanter.connect(cbp); cbp.connect(cg); cg.connect(lp);
    // Highland pipe scale (A ≈ 476 Hz): low G, low A, B, C#, D, E, F#, high G, high A
    const S = { G: 422, A: 476, B: 535, C: 595, D: 634, E: 714, F: 793, g: 845, a: 952 };
    const tune = [['A', 1], ['A', 0.5], ['A', 0.5], ['C', 1], ['E', 1], ['E', 0.5], ['F', 0.5], ['E', 1], ['C', 1], ['A', 1], ['A', 0.5], ['B', 0.5], ['C', 1], ['B', 0.5], ['A', 0.5], ['G', 1], ['A', 2], ['E', 1], ['E', 0.5], ['D', 0.5], ['C', 1], ['A', 1], ['C', 0.5], ['E', 0.5], ['a', 1], ['g', 0.5], ['F', 0.5], ['E', 1], ['D', 0.5], ['C', 0.5], ['B', 1], ['A', 2]];
    let timer = null, alive = true;
    const schedule = () => { if (!alive) return; let t = c.currentTime + 0.05; for (let rep = 0; rep < 3; rep++) for (const [n, d] of tune) { chanter.frequency.setValueAtTime(S[n], t); t += d * 0.42; } timer = setTimeout(schedule, (t - c.currentTime - 0.5) * 1000); };
    return { output: out, start() { startAll([...drones, chanter]); schedule(); }, stop() { alive = false; clearTimeout(timer); stopAll([...drones, chanter]); } };
  });
}

// ---------------------------------------------------------------------------
// Station PA — speaker lists from the world modules, nearest-speaker selection,
// male/female voices, one announcement per message however many areas hear it.
// ---------------------------------------------------------------------------
function toVector(e) {
  if (!e) return null; const v = e.isVector3 ? e.clone() : e.position && e.position.isVector3 ? e.position.clone() : (typeof e.x === 'number' ? V3(e.x, e.y, e.z) : null);
  if (v && e.platform != null) v.platform = e.platform; return v;
}
function createPA(ctx, api) {
  const audio = ctx.audio;
  const AREAS = {
    ticketHall: { key: 'speakers:ticketHall', fallback: [V3(0, LEVELS.concourseBeamSoffit - 0.2, -15), V3(-30, LEVELS.concourseBeamSoffit - 0.2, -20), V3(30, LEVELS.concourseBeamSoffit - 0.2, -12)] },
    district: { key: 'speakers:district', fallback: [1, 2].map(n => { const pl = DISTRICT.platforms[n]; const w = dcToWorld(0, (pl.tMin + pl.tMax) / 2); const v = V3(w.x, LEVELS.dcCeiling - 0.25, w.z); v.platform = n; return v; }) },
    jubileeUpper: { key: 'speakers:jubileeUpper', fallback: [-30, 0, 30].map(x => V3(x, LEVELS.jubUpper + 2.9, JUBILEE.pedZ - 0.35)) },
    jubileeLower: { key: 'speakers:jubileeLower', fallback: [-30, 0, 30].map(x => V3(x, LEVELS.jubLower + 2.9, JUBILEE.pedZ - 0.35)) },
    box: { key: 'speakers:box', fallback: [V3(24, LEVELS.interchangeEast + 3, -16), V3(-24, LEVELS.interchangeWest + 3, -16)] },
  };
  const cache = {};
  function list(area) {
    const def = AREAS[area]; if (!def) return [];
    if (cache[area]) return cache[area];
    const raw = ctx.get(def.key); const out = Array.isArray(raw) ? raw.map(toVector).filter(Boolean) : [];
    if (out.length) { cache[area] = out; return out; }
    return def.fallback;
  }
  function nearest(area, filter = null) {
    const L = audio.listenerPos; let best = null, bd = Infinity;
    for (const p of list(area)) { if (filter && !filter(p)) continue; const d = p.distanceToSquared(L); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  function forPlatform(platform) {
    if (platform === 3) return { area: 'jubileeUpper', filter: null };
    if (platform === 4) return { area: 'jubileeLower', filter: null };
    return { area: 'district', filter: (p) => p.platform == null || p.platform === platform };
  }
  /** Speak `text` (string or { text, male }) from the nearest speaker of `area`. Returns the engine's promise (false if inaudible). */
  function say(area, text, { radius = 35, priority = 0, male = null, filter = null, caption = true } = {}) {
    const t = typeof text === 'object' ? text.text : text; const isMale = male != null ? male : (typeof text === 'object' && !!text.male);
    if (!t || !t.trim()) return Promise.resolve(false);
    const at = nearest(area, filter) || null; api.stats.pa++; api.log.push({ kind: 'pa', area, text: t, at: at ? at.toArray().map(v => +v.toFixed(1)) : null }); if (api.log.length > 60) api.log.shift();
    return audio.announce(t, { voice: 'station', at, radius, priority, caption, pitch: isMale ? 0.72 : 1.0, rate: isMale ? 0.95 : 1.0 });
  }
  /** A station-wide message: spoken once from whichever speaker is nearest to the listener. */
  function sayEverywhere(text, opts = {}) {
    const L = audio.listenerPos; let bestArea = 'ticketHall', bd = Infinity;
    for (const area of Object.keys(AREAS)) { const p = nearest(area); if (p) { const d = p.distanceToSquared(L); if (d < bd) { bd = d; bestArea = area; } } }
    return say(bestArea, text, opts);
  }
  return { areas: Object.keys(AREAS), list, nearest, forPlatform, say, sayEverywhere, refresh() { for (const k of Object.keys(cache)) delete cache[k]; } };
}

/** Time-of-day busyness 0.2 (night) … 1 (peaks) used for crowd murmur density and gate-beep cadence. */
function busyness(date) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h < 5.5) return 0.15; if (h < 7) return 0.4; if (h < 9.75) return 1.0; if (h < 16) return 0.7; if (h < 19.25) return 1.0; if (h < 22) return 0.55; return 0.3;
}

// ---------------------------------------------------------------------------
// On-train helper (the train service triggers these itself; other modules can use this).
// ---------------------------------------------------------------------------
export function announceOnTrain(ctx, train, key, { destination = null, display = true, aboard = null, priority = null, radius = 4 } = {}) {
  try {
    if (!train) return null;
    const line = train.line === 'circle' ? 'circle' : (train.line === 'district' || train.stock === 'S7' ? 'district' : 'jubilee');
    const dir = train.direction || (train.track && train.track.def && train.track.def.direction) || 'eastbound';
    const dest = destination || train.destination || pickDestination(line, dir);
    const text = trainLine(line, dir, key, dest); if (!text) return null;
    const isAboard = aboard != null ? aboard : !!(ctx.player && ctx.player.train === train);
    if (display && train.setDisplay) train.setDisplay(text.split('.')[0]);
    return ctx.audio.announce(text, { voice: 'train', at: isAboard ? null : (train.group || null), radius: isAboard ? Infinity : radius, priority: priority != null ? priority : (isAboard ? 2 : 0) });
  } catch (e) { console.warn('[soundscape] announceOnTrain failed', e); return null; }
}

// ---------------------------------------------------------------------------
export function build(ctx) {
  const { audio } = ctx;
  const api = { beds: {}, emitters: [], schedulers: [], stats: { oneShots: 0, pa: 0, trainEvents: 0 }, log: [], pa: null, bigBen: null, svc: null, options: OPTIONS };
  let warnedUpdate = false;

  // 1. synths -----------------------------------------------------------------------------------------------------------
  try { registerSynths(audio); } catch (e) { console.warn('[soundscape] synth registration failed', e); }

  // 2. ambience beds (one per reverb zone; leave any bed another module registered first) ---------------------------------
  try {
    for (const [zone, synth, params, level] of [['street', 'traffic', {}, 0.5], ['hall', 'soundscape:hallBed', { level: 0.5, murmur: 0.35 }, 0.55], ['subsurface', 'soundscape:subsurfaceBed', { level: 0.4 }, 0.5], ['box', 'soundscape:boxBed', { level: 0.5 }, 0.5]]) {
      if (audio.beds.has(zone)) { console.info(`[soundscape] bed '${zone}' already exists — keeping it`); api.beds[zone] = audio.beds.get(zone); continue; }
      api.beds[zone] = audio.bed(zone, synth, params, level);
    }
    if (audio.ready) audio.setZone(audio.zone, true);   // beds created after resume() need activating
  } catch (e) { console.warn('[soundscape] beds failed', e); }

  // 3. continuous colour emitters (street) ----------------------------------------------------------------------------------
  try {
    const vg = STREET.ventGrates; api.emitters.push(audio.emitter({ position: V3(vg.x, 0.3, (vg.zMin + vg.zMax) / 2), synth: 'tunnelAir', params: { level: 0.5 }, gain: 0.45, refDistance: 4, maxDistance: 40 }));   // warm air-blast from the JLE vent grates on the Embankment
    for (const z of [-40, 30]) api.emitters.push(audio.emitter({ position: V3(STREET.riverWallX + 1, -2.5, z), synth: 'soundscape:river', params: { level: 0.3 }, gain: 0.35, refDistance: 5, maxDistance: 60 }));
    api.emitters.push(audio.emitter({ position: V3(STREET.bridge.xMin + 180, 1.2, STREET.bridge.zMax - 2), synth: 'soundscape:bagpipe', params: { level: 0.25 }, gain: 0.5, refDistance: 25, maxDistance: 600, rolloff: 1.2 }));   // the bridge bagpiper, 180 m out on the south footway
  } catch (e) { console.warn('[soundscape] street emitters failed', e); }

  // 4. Big Ben ----------------------------------------------------------------------------------------------------------------
  try { api.bigBen = createBigBen(ctx); ctx.register('bigBen', api.bigBen); } catch (e) { console.warn('[soundscape] Big Ben failed', e); }

  // 5. station PA ---------------------------------------------------------------------------------------------------------------
  const pa = api.pa = createPA(ctx, api);
  const timers = []; let simTime = 0;
  const later = (seconds, fn) => timers.push({ at: simTime + seconds, fn });
  let hallRotation = 0;
  const hallMessages = () => [
    STATION_PA.safety[0], STATION_PA.customer(STATION_PA.customerLines[0]), STATION_PA.safety[1], STATION_PA.serviceUpdate,
    STATION_PA.customer(STATION_PA.customerLines[2]), STATION_PA.security, STATION_PA.customer(STATION_PA.customerLines[1]), STATION_PA.safety[2],
  ];
  /** Handle a train-service event (also callable directly for tests). Returns the PA text spoken, or null. */
  function onTrainEvent(evt, e) {
    api.stats.trainEvents++;
    const platform = Number(e.platform); const { area, filter } = pa.forPlatform(platform); const line = e.line || 'district';
    let text = null;
    if (evt === 'arriving') {
      text = STATION_PA.nextTrain(line, e.destination, platform);
      pa.say(area, text, { filter, priority: 1 });
    } else if (evt === 'stopped') {
      if (platform <= 2) { text = STATION_PA.mindTheGap.text; later(1.0, () => pa.say(area, STATION_PA.mindTheGap, { filter, priority: 1 })); }
      else if (chance(0.25)) { text = STATION_PA.letCustomersOff; later(2.5, () => pa.say(area, text, { filter })); }
    } else if (evt === 'doorsClosing') {
      if (platform >= 3 && chance(0.4)) { text = STATION_PA.standClear.text; later(0.5, () => pa.say(area, STATION_PA.standClear, { filter, priority: 1 })); }
    }
    return text;
  }
  api.onTrainEvent = onTrainEvent;
  api.announceOnTrain = (train, key, opts) => announceOnTrain(ctx, train, key, opts);
  api.say = (text, opts) => pa.sayEverywhere(text, opts);

  // 6. one-shot schedulers -----------------------------------------------------------------------------------------------------
  const zoneId = () => (ctx.player && ctx.player.zone && ctx.player.zone.id) || null;
  const sched = (name, zones, min, max, fire) => { const s = { name, zones: zones ? new Set(zones) : null, min, max, t: rand(min * 0.3, max * 0.8), fired: 0, fire }; api.schedulers.push(s); return s; };
  const pv = STREET.pavementNorth, road = STREET.road;
  sched('pigeon', ['street'], 20, 60, () => audio.play('pigeon', { position: chance(0.7) ? V3(rand(-30, 40), 0.3, rand(pv.zMin + 0.5, pv.zMax - 0.5)) : V3(rand(10, 40), 0.3, rand(STREET.pavementSouth.zMin, STREET.pavementSouth.zMax)), gain: 0.5, refDistance: 2.5, maxDistance: 30 }));
  sched('siren', ['street', 'hall'], 45, 140, (zone) => {
    const onBridgeStreet = chance(0.6); const er = STREET.embankmentRoad;
    const position = onBridgeStreet ? V3(rand(-70, 70), 1, rand(road.zMin + 1, road.zMax - 1)) : V3(rand(er.xMin, er.xMax), 1, rand(-220, 0));
    audio.play('siren', { position, gain: zone === 'hall' ? 0.25 : 0.7, params: { seconds: rand(9, 14) }, refDistance: 12, maxDistance: 400 });
  });
  sched('gull', ['street'], 40, 100, () => audio.play('soundscape:gull', { position: V3(rand(70, 200), rand(12, 30), rand(-80, 40)), gain: 0.45, params: { cries: chance(0.5) ? 2 : 3 }, refDistance: 12, maxDistance: 250 }));
  sched('busStop', ['street'], 60, 150, () => audio.play('soundscape:busStop', { position: V3(STREET.busStop.x, 1.4, STREET.busStop.z + 1.5), gain: 0.5, refDistance: 4, maxDistance: 45 }));
  sched('crossingBeeper', ['street'], 90, 200, () => audio.play('soundscape:crossingBeeper', { position: V3(STREET.bridgeStreetX.min, 1, 4), gain: 0.35, refDistance: 5, maxDistance: 60 }));
  // the gateline: a cascade of valid-touch beeps and paddle thumps, denser in the peaks
  const gl = TICKET_HALL.gateline; const gatePos = () => { const u = Math.random(); return V3(gl.from[0] + (gl.to[0] - gl.from[0]) * u, LEVELS.concourse + 1.0, gl.from[1] + (gl.to[1] - gl.from[1]) * u); };
  const gates = sched('gateline', ['hall'], 2, 7, (zone, zid) => {
    if (zid && zid !== 'ticketHall') return;
    const p = gatePos(); audio.play('gateBeep', { position: p, gain: 0.22, params: { freq: 1650 + rand(-40, 40), dur: 0.11 }, refDistance: 3, maxDistance: 32 });
    if (chance(0.5)) later(0.35, () => audio.play('gatePaddle', { position: p, gain: 0.3, refDistance: 3, maxDistance: 28 }));
    if (chance(0.06)) later(0.5, () => audio.play('gateBeep', { position: p, gain: 0.22, params: { freq: 1450, dur: 0.16, count: 2 }, refDistance: 3, maxDistance: 32 }));   // 'SEEK ASSISTANCE' double beep
  });
  // a train passing far away in the tunnels of the line the listener is standing on
  sched('distantTrain', ['subsurface', 'box'], 60, 120, (zone, zid) => {
    const far = rand(150, 320) * (chance(0.5) ? -1 : 1); let position, sing = false;
    if (zid === 'dcPlatform1' || zid === 'dcPlatform2') { const w = dcToWorld(far, chance(0.5) ? DISTRICT.tracks.eastbound.t : DISTRICT.tracks.westbound.t); position = V3(w.x, LEVELS.dcRail, w.z); sing = true; }
    else { const lvl = zid === 'jubileePlatformLower' ? LEVELS.jubLower : (zid === 'jubileePlatformUpper' ? LEVELS.jubUpper : (chance(0.5) ? LEVELS.jubUpper : LEVELS.jubLower)); position = V3(far, lvl + LEVELS.jubRailOffset, JUBILEE.trackZ); }
    audio.play('soundscape:rumble', { position, gain: zone === 'box' ? 0.45 : 0.6, params: { seconds: rand(8, 12), sing }, refDistance: 25, maxDistance: 600 });
  });
  // the occasional escalator emergency-stop / restart beep somewhere in the box
  sched('escalatorBeep', ['box'], 200, 420, () => { const e = pick(ESCALATORS); audio.play('gateBeep', { position: V3(e.top.x, e.top.y + 1, e.top.z), gain: 0.3, params: { freq: 2200, dur: 0.15, count: 3 }, refDistance: 4, maxDistance: 60 }); });
  // periodic PA: ticket hall every 3–5 min; platforms / box every 5–8 min (station-wide files, spoken once from the nearest speaker)
  sched('hallPA', ['hall'], 180, 300, (zone, zid) => { if (zid && zid !== 'ticketHall' && zid !== 'subway') return; const msgs = hallMessages(); pa.say('ticketHall', msgs[hallRotation++ % msgs.length]); });
  sched('deepPA', ['subsurface', 'box'], 300, 480, (zone, zid) => {
    if (zone === 'box') { pa.say('box', chance(0.3) ? STATION_PA.security : STATION_PA.safety[1]); return; }
    if (zid === 'jubileePlatformUpper' || zid === 'jubileePlatformLower') { pa.say(zid === 'jubileePlatformUpper' ? 'jubileeUpper' : 'jubileeLower', chance(0.3) ? STATION_PA.security : pick([...STATION_PA.jubileePlatform, STATION_PA.safety[0]])); return; }
    pa.say('district', chance(0.3) ? STATION_PA.security : pick([STATION_PA.standBack, STATION_PA.mindTheGapLong, STATION_PA.fullLength, STATION_PA.safety[0]]));
  });

  // 7. update loop ----------------------------------------------------------------------------------------------------------------
  let lastBusy = -1, busyTimer = 0;
  ctx.onUpdate((dt) => {
    try {
      simTime += dt;
      if (timers.length) { const due = timers.filter(t => t.at <= simTime); if (due.length) { for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= simTime) timers.splice(i, 1); for (const t of due) { try { t.fn(); } catch (e) { /* one bad timer must not stop the rest */ } } } }
      // subscribe to the train service as soon as it exists
      if (!api.svc) { const s = ctx.get('trainService'); if (s && s.on) { api.svc = s; for (const evt of ['arriving', 'stopped', 'doorsClosing']) s.on(evt, (e) => { try { onTrainEvent(evt, e); } catch (err) { console.warn('[soundscape] PA failed', err); } }); } }
      if (!audio.ready) return;
      // crowd density follows the station clock (every 20 s)
      busyTimer += dt; if (busyTimer > 20 || lastBusy < 0) { busyTimer = 0; const b = busyness(ctx.stationTime ? ctx.stationTime() : new Date()); if (b !== lastBusy) { lastBusy = b; const hall = api.beds.hall; if (hall && hall.node && hall.node.set) hall.node.set('murmur', 0.12 + 0.3 * b); gates.min = 1.2 + (1 - b) * 5; gates.max = 3 + (1 - b) * 12; } }
      const zone = audio.zone, zid = zoneId();
      for (const s of api.schedulers) {
        s.t -= dt; if (s.t > 0) continue; s.t = rand(s.min, s.max);
        if (s.zones && !s.zones.has(zone)) continue;
        try { s.fire(zone, zid); s.fired++; api.stats.oneShots++; } catch (e) { if (!s.errored) { s.errored = true; console.warn(`[soundscape] scheduler '${s.name}' failed`, e); } }
      }
    } catch (e) { if (!warnedUpdate) { warnedUpdate = true; console.warn('[soundscape] update failed', e); } }
  });

  ctx.register('soundscape', api);
  return api;
}
