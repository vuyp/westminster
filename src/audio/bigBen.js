// ---------------------------------------------------------------------------
// bigBen.js — the Westminster Quarters and the hour strokes of the Great Bell,
// rung from the belfry of the Elizabeth Tower on station time (dossier §10.10).
//
//   const bigBen = createBigBen(ctx);      // registers synths, an update hook and window.__app.ringBigBen
//   bigBen.ring(quarter, hour)             // 1 = quarter past, 2 = half past, 3 = quarter to, 4 = the hour (+ `hour` strokes)
//   bigBen.stop(); bigBen.nextEvent()      // cancel a running sequence / what rings next
//
// Sound path: every strike is an additive-synthesis bell (the quarter bells reuse
// the engine's 'bell' synth; the Great Bell gets its own measured partials)
// fed into ONE positional bus at the belfry: gain → 440 Hz peaking EQ → low-pass →
// panner → engine source bus. The bus is re-tuned every frame from the listener's
// zone: open and loud on the pavement, faint and low-passed (hum/prime and the
// 440 Hz secondary strike only) in the ticket hall, silent below the concourse.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { STREET } from '../core/layout.js';

/** Equal-temperament reference pitches of the four quarter bells (the real bells sit a few cents off). */
export const QUARTER_BELLS = { 'G#4': 415.3, 'F#4': 370.0, 'E4': 329.6, 'B3': 246.9 };
export const QUARTER_BELL_MASS_T = { 'G#4': 1.1, 'F#4': 1.3, 'E4': 1.7, 'B3': 4.0 };

/** The Great Bell: perceived strike note E3, nominal 335 Hz 'doubletted', strong secondary strike at 440 Hz from the 883 Hz partial. */
export const GREAT_BELL = {
  strikeNote: 'E3', strikeHz: 167, nominalHz: 335, doubletHz: 1.5, secondaryStrikeHz: 440, massT: 13.7,
  // [frequency Hz, relative amplitude, decay seconds]
  partials: [[82, 0.55, 22], [167, 1.0, 18], [200, 0.38, 9], [250, 0.3, 7], [335, 0.5, 6.5], [336.5, 0.5, 6.5], [500, 0.22, 4.5], [670, 0.16, 3.5], [883, 0.42, 5]],
};

/** The five changes of the Westminster Quarters (each = 3 crotchets + 1 minim). */
export const CHANGES = {
  1: ['G#4', 'F#4', 'E4', 'B3'],
  2: ['E4', 'G#4', 'F#4', 'B3'],
  3: ['E4', 'F#4', 'G#4', 'E4'],
  4: ['G#4', 'E4', 'F#4', 'B3'],
  5: ['B3', 'F#4', 'G#4', 'E4'],
};
/** Which changes each quarter rings. The hour version never contains change 1. */
export const QUARTER_CHANGES = { 1: [1], 2: [2, 3], 3: [4, 5, 1], 4: [2, 3, 4, 5] };
/** crotchet ≈ 1 s, minim ≈ 2 s + a short rest → 5 s per change; the hour chime starts 25 s early so the FIRST stroke lands on the hour; strokes 4.5 s apart. */
export const TEMPO = { crotchet: 1.0, minim: 2.0, change: 5.0, hourLead: 25, strokeGap: 4.5 };
/** Seconds into the hour at which each sequence STARTS. */
export const EVENTS = [{ quarter: 1, at: 15 * 60 }, { quarter: 2, at: 30 * 60 }, { quarter: 3, at: 45 * 60 }, { quarter: 4, at: 60 * 60 - TEMPO.hourLead }];

export const twelveHour = (h) => (((h % 12) + 12) % 12) || 12;

/** Strike list for a quarter: [{ t (s from start), bell: 'G#4'|'F#4'|'E4'|'B3'|'greatBell', change?, note?, stroke?, of? }]. */
export function chimeSchedule(quarter, hour = 12) {
  const q = Math.min(4, Math.max(1, Math.round(Number(quarter) || 1))); const events = []; let t = 0;
  for (const ch of QUARTER_CHANGES[q]) {
    CHANGES[ch].forEach((bell, i) => events.push({ t: +(t + i * TEMPO.crotchet).toFixed(3), bell, change: ch, note: i + 1, minim: i === 3 }));
    t += TEMPO.change;
  }
  if (q === 4) { const n = twelveHour(hour); for (let i = 0; i < n; i++) events.push({ t: +(TEMPO.hourLead + i * TEMPO.strokeGap).toFixed(3), bell: 'greatBell', stroke: i + 1, of: n }); }
  return events;
}

/** What rings next after `date`: { quarter, hour, at: Date, inSeconds }. */
export function nextEvent(date = new Date()) {
  const into = date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() / 1000;
  for (const ev of EVENTS) if (ev.at > into) { const d = new Date(date.getTime() + (ev.at - into) * 1000); return { quarter: ev.quarter, hour: twelveHour(date.getHours() + (ev.quarter === 4 ? 1 : 0)), at: d, inSeconds: ev.at - into }; }
  const d = new Date(date.getTime() + (3600 - into + EVENTS[0].at) * 1000); return { quarter: 1, hour: twelveHour(date.getHours() + 1), at: d, inSeconds: 3600 - into + EVENTS[0].at };
}

// muffling profiles by where the listener is (reverb zone → profile; the hall is refined by the layout zone id)
const PROFILES = {
  street: { gain: 1.0, lp: 16000, peak: 0 },
  stairs: { gain: 0.6, lp: 3200, peak: 2 },     // on the open entrance stairs: still fairly clear, a little duller
  subway: { gain: 0.3, lp: 520, peak: 5 },      // the Bridge Street subway: stair openings at both ends
  hall: { gain: 0.22, lp: 340, peak: 8 },       // ticket hall: 80–170 Hz hum/prime + the 440 Hz secondary strike
  none: { gain: 0, lp: 200, peak: 0 },          // box, platforms, on a train: inaudible
};

function noiseBurst(c) {
  if (c._bigBenNoise) return c._bigBenNoise;
  const len = Math.floor(c.sampleRate * 0.25); const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0); let s = 4711;
  for (let i = 0; i < len; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
  c._bigBenNoise = b; return b;
}

/** Additive bell from an explicit partial table [[hz, amp, decaySeconds]]. */
function additiveBell(c, partials, strike = 1, clapperHz = 900) {
  const out = c.createGain(); out.gain.value = 0.9; const t0 = c.currentTime; let longest = 0;
  for (const [f, a, decay] of partials) {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.0015); const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, a * strike * 0.3), t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + decay + 0.1); longest = Math.max(longest, decay);
  }
  // hammer on the sound-bow: a short band-limited 'clank'
  const n = c.createBufferSource(); n.buffer = noiseBurst(c); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = clapperHz; bp.Q.value = 2.5;
  const ng = c.createGain(); ng.gain.setValueAtTime(0.3 * strike, t0); ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07); n.connect(bp); bp.connect(ng); ng.connect(out); n.start(t0); n.stop(t0 + 0.12);
  return { output: out, duration: longest, start() {}, stop() { try { out.disconnect(); } catch (e) { /* */ } } };
}

function registerSynths(audio) {
  if (!audio || !audio.registerSynth) return;
  if (!audio.synths.has('bigBen:greatBell')) audio.registerSynth('bigBen:greatBell', (c, { strike = 1 } = {}) => additiveBell(c, GREAT_BELL.partials, strike, 760));
  if (!audio.synths.has('bigBen:quarterBell')) audio.registerSynth('bigBen:quarterBell', (c, { freq = QUARTER_BELLS.E4, strike = 1, seconds = 7 } = {}) => {
    const base = audio.synths.get('bell');
    if (base) return base(c, { freq, seconds, strike });
    return additiveBell(c, [[0.5, 0.6, 1.0], [1.0, 1.0, 0.7], [1.2, 0.45, 0.5], [1.5, 0.3, 0.45], [2.0, 0.55, 0.35], [2.51, 0.18, 0.25], [3.0, 0.12, 0.2]].map(([r, a, d]) => [freq * r, a, seconds * d]), strike, freq * 3);
  });
}

/**
 * Build the Big Ben ringer. opts: { level (bus gain on the street, 0.85), auto (ring on station time, true) }
 */
export function createBigBen(ctx, { level = 0.85, auto = true } = {}) {
  const audio = ctx.audio; const tower = STREET.elizabethTower;
  // the belfry sits between the dials (55 m) and the belfry top (62 m); the tower is diagonally front-left (SSE) of the entrance
  const position = new THREE.Vector3(tower.x, (tower.clockHeight + tower.belfryTop) / 2, tower.z);
  const state = { auto, rung: 0, sequences: 0, lastIntoHour: null, ringing: null, timers: [], busFailed: false, log: [] };
  let bus = null, warned = false;
  try { registerSynths(audio); } catch (e) { console.warn('[bigBen] synth registration failed', e); }

  const zoneId = () => (ctx.player && ctx.player.zone && ctx.player.zone.id) || null;
  const profile = () => {
    const z = audio.zone; if (z === 'street') return PROFILES.street;
    if (z === 'hall') { const id = zoneId(); return PROFILES[id] || PROFILES.hall; }
    return PROFILES.none;
  };

  function ensureBus() {
    if (bus || state.busFailed) return bus; const c = audio.ctx; if (!c || !audio.sourceBus) return null;
    try {
      const input = c.createGain(); input.gain.value = level;
      const peak = c.createBiquadFilter(); peak.type = 'peaking'; peak.frequency.value = GREAT_BELL.secondaryStrikeHz; peak.Q.value = 3; peak.gain.value = 0;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 16000; lp.Q.value = 0.5;
      const zoneGain = c.createGain(); zoneGain.gain.value = profile().gain;
      const panner = c.createPanner(); panner.panningModel = 'equalpower'; panner.distanceModel = 'inverse'; panner.refDistance = 45; panner.maxDistance = 2000; panner.rolloffFactor = 1.2;
      if (panner.positionX) { panner.positionX.value = position.x; panner.positionY.value = position.y; panner.positionZ.value = position.z; } else panner.setPosition(position.x, position.y, position.z);
      input.connect(peak); peak.connect(lp); lp.connect(zoneGain); zoneGain.connect(panner); panner.connect(audio.sourceBus);
      bus = { input, peak, lp, zoneGain, panner };
    } catch (e) { console.warn('[bigBen] bell bus failed — falling back to audio.play', e); state.busFailed = true; bus = null; }
    return bus;
  }

  /** One strike of one bell, now. Returns true if something was sounded. */
  function strike(bell, strength = 1) {
    if (!audio.ready) return false; const c = audio.ctx;
    const great = bell === 'greatBell'; const params = great ? { strike: strength } : { freq: QUARTER_BELLS[bell] || QUARTER_BELLS.E4, strike: strength, seconds: bell === 'B3' ? 8 : 6.5 };
    const b = ensureBus();
    if (!b) {   // fallback path: engine one-shot, muffled by a lower level only
      const p = profile(); if (p.gain <= 0) return false;
      audio.play(great ? 'bigBen:greatBell' : 'bell', { position, params, gain: p.gain * level, refDistance: 45, maxDistance: 2000 }); state.rung++; return true;
    }
    const f = audio.synths.get(great ? 'bigBen:greatBell' : 'bigBen:quarterBell'); if (!f) return false;
    const s = f(c, params); s.output.connect(b.input); s.start(); state.rung++;
    setTimeout(() => { try { s.stop(); s.output.disconnect(); } catch (e) { /* already gone */ } }, ((s.duration || 8) + 0.6) * 1000);
    return true;
  }

  function stop() { for (const t of state.timers) clearTimeout(t); state.timers = []; state.ringing = null; }

  /**
   * Ring a quarter: 1 = quarter past (change 1), 2 = half past (2, 3), 3 = quarter to (4, 5, 1), 4 = the hour (2, 3, 4, 5 then `hour` strokes).
   * `hour` defaults to the station clock's coming hour. Returns the strike schedule.
   */
  function ring(quarter = 4, hour = null, { origin = 'api' } = {}) {
    stop();
    const now = ctx.stationTime ? ctx.stationTime() : new Date();
    const h = hour != null ? twelveHour(hour) : twelveHour(now.getHours() + (quarter === 4 ? 1 : 0));
    const events = chimeSchedule(quarter, h);
    state.ringing = { quarter, hour: h, origin, startedAt: performance.now(), events }; state.sequences++;
    state.log.push({ at: now.toISOString(), quarter, hour: h, origin }); if (state.log.length > 40) state.log.shift();
    for (const ev of events) state.timers.push(setTimeout(() => { try { strike(ev.bell, ev.bell === 'greatBell' ? 1 : 0.8); } catch (e) { if (!warned) { warned = true; console.warn('[bigBen] strike failed', e); } } }, ev.t * 1000));
    state.timers.push(setTimeout(() => { state.ringing = null; }, (events[events.length - 1].t + 1) * 1000));
    return events;
  }

  function fire(ev, now) { if (!state.auto) return; ring(ev.quarter, twelveHour(now.getHours() + (ev.quarter === 4 ? 1 : 0)), { origin: 'clock' }); }

  function update() {
    // 1. re-tune the bus to where the listener is
    if (bus) { const p = profile(); const t = audio.ctx.currentTime; bus.zoneGain.gain.setTargetAtTime(p.gain, t, 0.35); bus.lp.frequency.setTargetAtTime(p.lp, t, 0.35); bus.peak.gain.setTargetAtTime(p.peak, t, 0.35); }
    else if (audio.ctx) ensureBus();
    // 2. ring on the station clock (quarters at :15 :30 :45; the hour sequence starts at :59:35)
    const now = ctx.stationTime ? ctx.stationTime() : new Date();
    const into = now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
    const prev = state.lastIntoHour; state.lastIntoHour = into;
    if (prev == null) { for (const ev of EVENTS) if (into >= ev.at && into < ev.at + 2.5) fire(ev, now); return; }   // first frame: join a sequence that has just begun
    let delta = into - prev; if (delta < 0) delta += 3600;
    if (delta <= 0 || delta > 90) return;   // no time passed / the tab was asleep: do not ring missed quarters late
    for (const ev of EVENTS) { const crossed = into >= prev ? (prev < ev.at && into >= ev.at) : (ev.at > prev || ev.at <= into); if (crossed) fire(ev, now); }
  }

  ctx.onUpdate(() => { try { update(); } catch (e) { if (!warned) { warned = true; console.warn('[bigBen] update failed', e); } } });

  const api = {
    position, ring, stop, strike, update, chimeSchedule, state,
    get ringing() { return state.ringing; },
    get rung() { return state.rung; },
    nextEvent: () => nextEvent(ctx.stationTime ? ctx.stationTime() : new Date()),
    setAuto(on) { state.auto = !!on; },
    profile,
    bells: QUARTER_BELLS, greatBell: GREAT_BELL, changes: CHANGES, quarters: QUARTER_CHANGES, tempo: TEMPO,
  };
  // test hook: window.__app.ringBigBen(quarter, hour)
  try { if (typeof window !== 'undefined' && window.__app) window.__app.ringBigBen = (quarter = 4, hour = null) => api.ring(quarter, hour, { origin: 'test' }); } catch (e) { /* no global app */ }
  return api;
}
