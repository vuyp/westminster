// ---------------------------------------------------------------------------
// audio.js — Web Audio engine: zones with synthesised reverb, positional emitters,
// a procedural synth registry, one-shot sounds, ambience beds, and PA / in-train
// announcements (SpeechSynthesis + captions).
//
// Nothing is loaded from disk: every sound is synthesised.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const REVERBS = {
  street:     { rt60: 0.9,  lowpass: 3500, pre: 0.02, wet: 0.12 },
  hall:       { rt60: 1.6,  lowpass: 5000, pre: 0.015, wet: 0.28 },
  subsurface: { rt60: 2.4,  lowpass: 4500, pre: 0.02, wet: 0.36 },
  box:        { rt60: 4.2,  lowpass: 3000, pre: 0.03, wet: 0.42 },
  train:      { rt60: 0.5,  lowpass: 6000, pre: 0.005, wet: 0.14 },
};

export class AudioEngine {
  constructor({ hud = null } = {}) {
    this.hud = hud;
    this.ctx = null;
    this.ready = false;
    this.zone = 'street';
    this.synths = new Map();
    this.emitters = [];
    this.oneShots = [];
    this.beds = new Map();
    this.speechQueue = [];
    this.speaking = false;
    this.listenerPos = new THREE.Vector3();
    this.muted = false;
    this._registerBuiltinSynths();
    this._captionOnly = typeof speechSynthesis === 'undefined';
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  async resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this._buildGraph();
      // (re)connect any emitters created before the context existed
      for (const e of this.emitters) e._connect();
      for (const [, bed] of this.beds) bed._connect();
    }
    if (this.ctx.state !== 'running') { try { await this.ctx.resume(); } catch (e) { /* ignore */ } }
    this.ready = this.ctx.state === 'running';
    if (this.ready) this.setZone(this.zone, true);
    return this.ready;
  }

  _buildGraph() {
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.9;
    this.limiter = c.createDynamicsCompressor(); this.limiter.threshold.value = -8; this.limiter.knee.value = 12; this.limiter.ratio.value = 6; this.limiter.attack.value = 0.003; this.limiter.release.value = 0.2;
    this.master.connect(this.limiter); this.limiter.connect(c.destination);
    // source bus → dry + each reverb
    this.sourceBus = c.createGain(); this.dry = c.createGain(); this.dry.gain.value = 1;
    this.sourceBus.connect(this.dry); this.dry.connect(this.master);
    this.reverbs = {};
    for (const [name, spec] of Object.entries(REVERBS)) {
      const conv = c.createConvolver(); conv.buffer = this._impulse(spec);
      const g = c.createGain(); g.gain.value = 0;
      const pre = c.createDelay(0.1); pre.delayTime.value = spec.pre;
      this.sourceBus.connect(pre); pre.connect(conv); conv.connect(g); g.connect(this.master);
      this.reverbs[name] = { conv, gain: g, spec };
    }
    // ambience bus (beds are not spatialised)
    this.bedBus = c.createGain(); this.bedBus.gain.value = 1; this.bedBus.connect(this.master);
    // a "PA" bus for the station tannoy: band-limited + a bit of reverb
    this.paBus = c.createGain(); const paHP = c.createBiquadFilter(); paHP.type = 'highpass'; paHP.frequency.value = 300; const paLP = c.createBiquadFilter(); paLP.type = 'lowpass'; paLP.frequency.value = 3800;
    this.paBus.connect(paHP); paHP.connect(paLP); paLP.connect(this.sourceBus);
    if (c.listener.positionX) { /* modern API */ }
  }

  /** Synthesised exponentially-decaying noise impulse response. */
  _impulse({ rt60, lowpass }) {
    const c = this.ctx; const sr = c.sampleRate; const len = Math.floor(sr * Math.min(6, rt60 * 1.3)); const buf = c.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let lp = 0; const k = Math.exp(-2 * Math.PI * lowpass / sr);
      let seed = 1234 + ch * 77;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0; const white = (seed / 4294967296) * 2 - 1;
        lp = lp * k + white * (1 - k);
        const t = i / sr; const env = Math.pow(10, -3 * t / rt60);
        // early reflections: a few discrete taps in the first 80 ms
        d[i] = lp * env * (i < sr * 0.08 && (i % 977 === 0 || i % 1373 === 0) ? 4 : 1);
      }
    }
    return buf;
  }

  setZone(zone, immediate = false) {
    const type = zone in REVERBS ? zone : (zone === 'train' ? 'train' : 'street');
    this.zone = type;
    if (!this.ready) return;
    const t = this.ctx.currentTime, ramp = immediate ? 0.01 : 0.8;
    for (const [name, r] of Object.entries(this.reverbs)) {
      const target = name === type ? r.spec.wet : 0;
      r.gain.gain.cancelScheduledValues(t); r.gain.gain.setTargetAtTime(target, t, ramp / 3);
    }
    for (const [bedZone, bed] of this.beds) bed.setActive(bedZone === type || (Array.isArray(bed.zones) && bed.zones.includes(type)), immediate);
  }

  /** Register a synth factory: (ctx, params) => { output: AudioNode, start(), stop(), set?(k,v) } */
  registerSynth(name, factory) { this.synths.set(name, factory); }

  /**
   * Positional sound source attached to an Object3D (or a fixed position).
   * opts: { object, position, synth, params, gain, refDistance, maxDistance, rolloff, autoplay, loop }
   */
  emitter(opts) {
    const e = new Emitter(this, opts); this.emitters.push(e); if (this.ctx) e._connect(); return e;
  }

  /** Looping ambience bed for a zone (not spatialised). zones: string | string[] */
  bed(zone, synthName, params = {}, gain = 0.5) {
    const b = new Bed(this, zone, synthName, params, gain); this.beds.set(Array.isArray(zone) ? zone[0] : zone, b); if (this.ctx) b._connect(); return b;
  }

  /** One-shot sound at a position (or non-positional if no position). Returns the synth instance. */
  play(synthName, { position = null, object = null, gain = 1, params = {}, refDistance = 3, maxDistance = 60, bus = 'source' } = {}) {
    if (!this.ready) return null; const f = this.synths.get(synthName); if (!f) { console.warn('[audio] unknown synth', synthName); return null; }
    const c = this.ctx; const s = f(c, params); const g = c.createGain(); g.gain.value = gain;
    s.output.connect(g);
    const out = bus === 'pa' ? this.paBus : this.sourceBus;
    if (position || object) {
      const p = this._panner(refDistance, maxDistance); g.connect(p); p.connect(out);
      const pos = object ? object.getWorldPosition(new THREE.Vector3()) : position; this._setPannerPos(p, pos);
    } else g.connect(out);
    s.start();
    const rec = { s, g, done: false };
    this.oneShots.push(rec);
    const stopAt = s.duration ? c.currentTime + s.duration + 0.5 : null;
    if (stopAt) setTimeout(() => { try { s.stop(); } catch (e) {} rec.done = true; }, (s.duration + 0.6) * 1000);
    return s;
  }

  _panner(refDistance, maxDistance) {
    const p = this.ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = refDistance; p.maxDistance = maxDistance; p.rolloffFactor = 1.4; return p;
  }
  _setPannerPos(p, pos) {
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
  }

  /**
   * Speak an announcement with captions.
   * opts: { voice: 'train'|'station'|'pa', at: Vector3|Object3D (audibility check), radius, priority, onEnd }
   * Returns a promise resolved when finished (or skipped).
   */
  announce(text, { voice = 'station', at = null, radius = 40, priority = 0, caption = true, rate = 1.0, pitch = 1.0, onStart = null, onEnd = null } = {}) {
    return new Promise(resolve => {
      const pos = at ? (at.isObject3D ? at.getWorldPosition(new THREE.Vector3()) : at) : null;
      const audible = !pos || pos.distanceTo(this.listenerPos) <= radius;
      if (!audible) { resolve(false); return; }
      this.speechQueue.push({ text, voice, priority, caption, rate, pitch, onStart, onEnd, resolve, pos });
      this.speechQueue.sort((a, b) => b.priority - a.priority);
      this._pumpSpeech();
    });
  }

  _pumpSpeech() {
    if (this.speaking || !this.speechQueue.length) return;
    const item = this.speechQueue.shift(); this.speaking = true;
    const dur = Math.max(1.6, item.text.length * 0.062);
    if (item.caption && this.hud) this.hud.caption(item.text, dur + 0.6, item.voice);
    item.onStart && item.onStart();
    // tannoy 'ping' cue for station announcements
    if (item.voice === 'station' && this.ready) this.play('paChime', { gain: 0.35, bus: 'pa' });
    const finish = () => { this.speaking = false; item.onEnd && item.onEnd(); item.resolve(true); this._pumpSpeech(); };
    let spoke = false;
    if (!this._captionOnly && !this.muted) {
      try {
        const u = new SpeechSynthesisUtterance(item.text);
        const voices = speechSynthesis.getVoices();
        const pick = voices.find(v => /en[-_]GB/i.test(v.lang) && /female|hazel|susan|kate|serena|google uk english female/i.test(v.name)) || voices.find(v => /en[-_]GB/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
        if (pick) u.voice = pick;
        u.lang = 'en-GB'; u.rate = item.rate * (item.voice === 'train' ? 0.98 : 0.95); u.pitch = item.pitch * (item.voice === 'train' ? 1.05 : 0.95);
        u.volume = pos ? Math.max(0.15, 1 - pos.distanceTo(this.listenerPos) / 45) : 0.9;
        let ended = false; const done = () => { if (!ended) { ended = true; finish(); } };
        u.onend = done; u.onerror = done;
        speechSynthesis.speak(u); spoke = true;
        setTimeout(done, (dur + 4) * 1000); // safety in case events never fire
      } catch (e) { spoke = false; }
    }
    if (!spoke) setTimeout(finish, dur * 1000);
  }

  cancelSpeech() { this.speechQueue.length = 0; try { speechSynthesis.cancel(); } catch (e) {} this.speaking = false; }

  /** Per-frame: update listener from camera and emitter positions. */
  update(dt, camera) {
    if (!this.ready) return;
    const c = this.ctx; const L = c.listener;
    camera.getWorldPosition(this.listenerPos);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    if (L.positionX) {
      const t = c.currentTime;
      L.positionX.setTargetAtTime(this.listenerPos.x, t, 0.02); L.positionY.setTargetAtTime(this.listenerPos.y, t, 0.02); L.positionZ.setTargetAtTime(this.listenerPos.z, t, 0.02);
      L.forwardX.setTargetAtTime(fwd.x, t, 0.02); L.forwardY.setTargetAtTime(fwd.y, t, 0.02); L.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      L.upX.setTargetAtTime(up.x, t, 0.02); L.upY.setTargetAtTime(up.y, t, 0.02); L.upZ.setTargetAtTime(up.z, t, 0.02);
    } else { L.setPosition(this.listenerPos.x, this.listenerPos.y, this.listenerPos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
    for (const e of this.emitters) e.update(dt);
    if (this.oneShots.length > 64) this.oneShots = this.oneShots.filter(o => !o.done);
  }

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05); }

  // ---------------------------------------------------------------------
  // Built-in synths. World modules / the audio content module can register more.
  // A synth factory returns { output, start(), stop(), set(k,v)?, duration? }
  // ---------------------------------------------------------------------
  _registerBuiltinSynths() {
    const noiseBuffer = (c, seconds = 2, pink = false) => {
      const key = '_noise' + (pink ? 'P' : 'W') + seconds; if (c[key]) return c[key];
      const len = c.sampleRate * seconds; const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; let seed = 99;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0; const w = (seed / 4294967296) * 2 - 1;
        if (!pink) { d[i] = w; continue; }
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
      c[key] = b; return b;
    };
    const noiseSource = (c, pink = false) => { const s = c.createBufferSource(); s.buffer = noiseBuffer(c, 3, pink); s.loop = true; return s; };
    const env = (param, t0, a, d, s, peak = 1) => { param.setValueAtTime(0, t0); param.linearRampToValueAtTime(peak, t0 + a); param.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t0 + a + d); };

    // Escalator: motor hum (fundamental ~ 48 Hz drive + gear harmonics) + filtered step-chain noise
    this.registerSynth('escalator', (c, { speed = 1 } = {}) => {
      const out = c.createGain(); out.gain.value = 0.6;
      const oscs = [[48, 0.35], [96, 0.22], [144, 0.12], [192, 0.08], [400 * speed, 0.03]].map(([f, g]) => { const o = c.createOscillator(); o.type = f > 300 ? 'triangle' : 'sawtooth'; o.frequency.value = f; const gg = c.createGain(); gg.gain.value = g; o.connect(gg); gg.connect(out); return o; });
      const n = noiseSource(c, true); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7; const ng = c.createGain(); ng.gain.value = 0.25;
      const lfo = c.createOscillator(); lfo.frequency.value = 1.9 * speed; const lg = c.createGain(); lg.gain.value = 0.12; lfo.connect(lg); lg.connect(ng.gain);
      n.connect(bp); bp.connect(ng); ng.connect(out);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; out.disconnect(); out.connect(lp);
      return { output: lp, start() { oscs.forEach(o => o.start()); n.start(); lfo.start(); }, stop() { oscs.forEach(o => { try { o.stop(); } catch (e) {} }); try { n.stop(); lfo.stop(); } catch (e) {} } };
    });

    // Generic fluorescent / ventilation hum for halls
    this.registerSynth('hum', (c, { freq = 100, level = 0.3 } = {}) => {
      const out = c.createGain(); out.gain.value = level; const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq; const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2; const g2 = c.createGain(); g2.gain.value = 0.3;
      const n = noiseSource(c, true); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; const ng = c.createGain(); ng.gain.value = 0.7;
      o.connect(out); o2.connect(g2); g2.connect(out); n.connect(lp); lp.connect(ng); ng.connect(out);
      return { output: out, start() { o.start(); o2.start(); n.start(); }, stop() { try { o.stop(); o2.stop(); n.stop(); } catch (e) {} } };
    });

    // Street traffic bed: pink noise with slow swells + occasional engine drones
    this.registerSynth('traffic', (c, {} = {}) => {
      const out = c.createGain(); out.gain.value = 0.7;
      const n = noiseSource(c, true); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; const g = c.createGain(); g.gain.value = 0.5;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 0.25; lfo.connect(lg); lg.connect(g.gain);
      const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.23; const lg2 = c.createGain(); lg2.gain.value = 300; lfo2.connect(lg2); lg2.connect(lp.frequency);
      const drone = c.createOscillator(); drone.type = 'sawtooth'; drone.frequency.value = 55; const dg = c.createGain(); dg.gain.value = 0.05; const dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 200;
      n.connect(lp); lp.connect(g); g.connect(out); drone.connect(dlp); dlp.connect(dg); dg.connect(out);
      return { output: out, start() { n.start(); lfo.start(); lfo2.start(); drone.start(); }, stop() { try { n.stop(); lfo.stop(); lfo2.stop(); drone.stop(); } catch (e) {} } };
    });

    // Deep-level ventilation / tunnel air bed for the box
    this.registerSynth('tunnelAir', (c, { level = 0.4 } = {}) => {
      const out = c.createGain(); out.gain.value = level; const n = noiseSource(c, true); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 350; lp.Q.value = 0.5;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.05; const lg = c.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(lp.frequency);
      n.connect(lp); lp.connect(out); return { output: out, start() { n.start(); lfo.start(); }, stop() { try { n.stop(); lfo.stop(); } catch (e) {} } };
    });

    // Ticket gate: single "beep" (valid) — 1.6 kHz 120 ms
    this.registerSynth('gateBeep', (c, { freq = 1650, dur = 0.12, count = 1 } = {}) => {
      const out = c.createGain(); out.gain.value = 0; const o = c.createOscillator(); o.type = 'square'; o.frequency.value = freq; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000; o.connect(lp); lp.connect(out);
      const t0 = c.currentTime; for (let i = 0; i < count; i++) { out.gain.setValueAtTime(0.5, t0 + i * (dur + 0.08)); out.gain.setValueAtTime(0, t0 + i * (dur + 0.08) + dur); }
      return { output: out, duration: count * (dur + 0.08), start() { o.start(); }, stop() { try { o.stop(); } catch (e) {} } };
    });

    // Ticket gate paddle: mechanical clunk + swish
    this.registerSynth('gatePaddle', (c) => {
      const out = c.createGain(); out.gain.value = 0.8; const n = noiseSource(c); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1.5; const g = c.createGain();
      const t0 = c.currentTime; env(g.gain, t0, 0.005, 0.18, 0.001, 0.7); n.connect(bp); bp.connect(g); g.connect(out);
      const o = c.createOscillator(); o.frequency.value = 180; const og = c.createGain(); env(og.gain, t0, 0.002, 0.08, 0.001, 0.5); o.connect(og); og.connect(out);
      return { output: out, duration: 0.3, start() { n.start(); o.start(); }, stop() { try { n.stop(); o.stop(); } catch (e) {} } };
    });

    // PA chime before station announcements: soft two-note (G5→C6 like a tannoy pre-tone)
    this.registerSynth('paChime', (c) => {
      const out = c.createGain(); out.gain.value = 0.5; const t0 = c.currentTime;
      [[784, 0], [1046.5, 0.25]].forEach(([f, dt]) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = c.createGain(); env(g.gain, t0 + dt, 0.01, 0.5, 0.001, 0.6); o.connect(g); g.connect(out); o.start(t0 + dt); o.stop(t0 + dt + 0.7); });
      return { output: out, duration: 1.0, start() {}, stop() {} };
    });

    // 1996 stock door closing warning: repeating high beeps (~ 1.9 kHz, 8 Hz)
    this.registerSynth('doorBeep1996', (c, { seconds = 2.2 } = {}) => {
      const out = c.createGain(); out.gain.value = 0; const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 1900; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000; o.connect(lp); lp.connect(out);
      const t0 = c.currentTime; const period = 0.125; for (let t = 0; t < seconds; t += period) { out.gain.setValueAtTime(0.45, t0 + t); out.gain.setValueAtTime(0, t0 + t + period * 0.5); }
      return { output: out, duration: seconds, start() { o.start(); }, stop() { try { o.stop(); } catch (e) {} } };
    });

    // S7 stock door chime: faster, higher continuous beeping (~ 2.5 kHz at 10 Hz) preceded by a 'ding'
    this.registerSynth('doorBeepS7', (c, { seconds = 2.4 } = {}) => {
      const out = c.createGain(); out.gain.value = 0; const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 2500; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000; o.connect(lp); lp.connect(out);
      const t0 = c.currentTime; const period = 0.1; for (let t = 0; t < seconds; t += period) { out.gain.setValueAtTime(0.4, t0 + t); out.gain.setValueAtTime(0, t0 + t + period * 0.5); }
      return { output: out, duration: seconds, start() { o.start(); }, stop() { try { o.stop(); } catch (e) {} } };
    });

    // Pneumatic door motion: air hiss + rubber thump at the end
    this.registerSynth('doorMove', (c, { seconds = 1.6, closing = false } = {}) => {
      const out = c.createGain(); out.gain.value = 0.7; const n = noiseSource(c); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.8; const g = c.createGain();
      const t0 = c.currentTime; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.08); g.gain.exponentialRampToValueAtTime(0.12, t0 + seconds * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
      n.connect(bp); bp.connect(g); g.connect(out);
      const th = c.createOscillator(); th.frequency.value = 70; const tg = c.createGain(); tg.gain.setValueAtTime(0, t0); env(tg.gain, t0 + seconds - 0.05, 0.005, 0.15, 0.001, closing ? 0.9 : 0.5); th.connect(tg); tg.connect(out);
      return { output: out, duration: seconds + 0.2, start() { n.start(); th.start(); }, stop() { try { n.stop(); th.stop(); } catch (e) {} } };
    });

    // Brake release / air dump
    this.registerSynth('airRelease', (c, { seconds = 1.2 } = {}) => {
      const out = c.createGain(); out.gain.value = 0.8; const n = noiseSource(c); const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500; const g = c.createGain();
      const t0 = c.currentTime; g.gain.setValueAtTime(0.6, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
      n.connect(hp); hp.connect(g); g.connect(out); return { output: out, duration: seconds, start() { n.start(); }, stop() { try { n.stop(); } catch (e) {} } };
    });

    // Train running sound: controllable. set('speed', v m/s) drives rumble level, wheel/rail tone and traction inverter whine.
    this.registerSynth('trainRun', (c, { stock = '1996' } = {}) => {
      const out = c.createGain(); out.gain.value = 0;
      const n = noiseSource(c, true); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200; const rg = c.createGain(); rg.gain.value = 1; n.connect(lp); lp.connect(rg); rg.connect(out);
      const n2 = noiseSource(c); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 2; const hg = c.createGain(); hg.gain.value = 0; n2.connect(bp); bp.connect(hg); hg.connect(out);
      const inv = c.createOscillator(); inv.type = stock === 'S7' ? 'triangle' : 'sawtooth'; inv.frequency.value = 200; const ig = c.createGain(); ig.gain.value = 0; const ilp = c.createBiquadFilter(); ilp.type = 'lowpass'; ilp.frequency.value = 3000; inv.connect(ilp); ilp.connect(ig); ig.connect(out);
      const inv2 = c.createOscillator(); inv2.type = 'sine'; inv2.frequency.value = 400; const ig2 = c.createGain(); ig2.gain.value = 0; inv2.connect(ig2); ig2.connect(out);
      let speed = 0, accel = 0;
      const api = {
        output: out, start() { n.start(); n2.start(); inv.start(); inv2.start(); }, stop() { try { n.stop(); n2.stop(); inv.stop(); inv2.stop(); } catch (e) {} },
        set(k, v) {
          const t = c.currentTime;
          if (k === 'speed') {
            speed = v; const s = Math.min(1, v / 22);
            out.gain.setTargetAtTime(Math.min(1, s * 1.6 + (v > 0.2 ? 0.05 : 0)), t, 0.1);
            lp.frequency.setTargetAtTime(150 + s * 500, t, 0.1);
            hg.gain.setTargetAtTime(s * s * 0.25, t, 0.1); bp.frequency.setTargetAtTime(1500 + s * 2500, t, 0.1);
            // traction inverter: pitch tracks speed (1996 TS GTO 'whine'), audible mainly under power/braking
            const active = Math.abs(accel) > 0.15 ? 1 : 0.25;
            inv.frequency.setTargetAtTime(stock === 'S7' ? 300 + s * 1400 : 120 + s * 900, t, 0.1); ig.gain.setTargetAtTime(active * Math.min(0.12, s * 0.35 + 0.02) * (v > 0.3 ? 1 : 0), t, 0.15);
            inv2.frequency.setTargetAtTime(stock === 'S7' ? 900 + s * 2400 : 350 + s * 1800, t, 0.1); ig2.gain.setTargetAtTime(active * Math.min(0.05, s * 0.12) * (v > 0.3 ? 1 : 0), t, 0.15);
          } else if (k === 'accel') accel = v;
        },
      };
      return api;
    });

    // Tunnel wind gust ahead of an arriving train (piston effect)
    this.registerSynth('tunnelWind', (c, { seconds = 6 } = {}) => {
      const out = c.createGain(); out.gain.value = 0.8; const n = noiseSource(c, true); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 250; lp.Q.value = 0.8; const g = c.createGain();
      const t0 = c.currentTime; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.9, t0 + seconds * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
      lp.frequency.setValueAtTime(120, t0); lp.frequency.linearRampToValueAtTime(700, t0 + seconds * 0.6); lp.frequency.linearRampToValueAtTime(150, t0 + seconds);
      n.connect(lp); lp.connect(g); g.connect(out); return { output: out, duration: seconds, start() { n.start(); }, stop() { try { n.stop(); } catch (e) {} } };
    });

    // Bell: additive inharmonic partials (used for Big Ben & the quarter bells). freq = nominal (prime) partial.
    this.registerSynth('bell', (c, { freq = 330, seconds = 6, strike = 1 } = {}) => {
      const out = c.createGain(); out.gain.value = 0.9; const t0 = c.currentTime;
      // partial ratios roughly of a large bell: hum 0.5, prime 1, tierce 1.2, quint 1.5, nominal 2, + upper
      [[0.5, 0.6, 1.0], [1.0, 1.0, 0.7], [1.2, 0.45, 0.5], [1.5, 0.3, 0.45], [2.0, 0.55, 0.35], [2.51, 0.18, 0.25], [3.0, 0.12, 0.2], [4.2, 0.06, 0.12]].forEach(([r, a, decay]) => {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq * r * (1 + (Math.random() - 0.5) * 0.002); const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(a * strike * 0.35, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds * decay);
        o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + seconds * decay + 0.1);
      });
      // clapper strike transient
      const n = noiseSource(c); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq * 3; bp.Q.value = 3; const ng = c.createGain(); ng.gain.setValueAtTime(0.25 * strike, t0); ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06); n.connect(bp); bp.connect(ng); ng.connect(out); n.start(t0); n.stop(t0 + 0.1);
      return { output: out, duration: seconds, start() {}, stop() {} };
    });

    // Footstep: filtered noise burst, character by surface
    this.registerSynth('footstep', (c, { surface = 'hard', run = false } = {}) => {
      const out = c.createGain(); out.gain.value = run ? 0.7 : 0.5; const t0 = c.currentTime; const n = noiseSource(c);
      const f = c.createBiquadFilter(); f.type = 'bandpass';
      const prof = { hard: [1400, 1.2, 0.08], granite: [1800, 1.5, 0.07], metal: [2600, 2.5, 0.12], stairs: [1200, 1.0, 0.09], pavement: [900, 0.9, 0.1], carpet: [400, 0.5, 0.1], train: [700, 0.9, 0.11], escalator: [2200, 2.0, 0.09] }[surface] || [1400, 1.2, 0.08];
      f.frequency.value = prof[0] * (0.9 + Math.random() * 0.2); f.Q.value = prof[1]; const g = c.createGain(); env(g.gain, t0, 0.003, prof[2], 0.001, 0.6);
      n.connect(f); f.connect(g); g.connect(out);
      const th = c.createOscillator(); th.frequency.value = 90; const tg = c.createGain(); env(tg.gain, t0, 0.002, 0.05, 0.001, 0.25); th.connect(tg); tg.connect(out);
      return { output: out, duration: 0.25, start() { n.start(); th.start(); }, stop() { try { n.stop(); th.stop(); } catch (e) {} } };
    });

    // Platform edge door: motor whirr + soft stop
    this.registerSynth('pedMove', (c, { seconds = 1.8 } = {}) => {
      const out = c.createGain(); out.gain.value = 0.6; const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 160; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; const g = c.createGain();
      const t0 = c.currentTime; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.1); g.gain.setValueAtTime(0.25, t0 + seconds - 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
      o.connect(lp); lp.connect(g); g.connect(out); return { output: out, duration: seconds, start() { o.start(); }, stop() { try { o.stop(); } catch (e) {} } };
    });

    // Distant siren pass-by (street colour)
    this.registerSynth('siren', (c, { seconds = 8 } = {}) => {
      const out = c.createGain(); out.gain.value = 0.15; const o = c.createOscillator(); o.type = 'triangle'; const t0 = c.currentTime;
      for (let t = 0; t < seconds; t += 0.6) { o.frequency.setValueAtTime(740, t0 + t); o.frequency.setValueAtTime(980, t0 + t + 0.3); }
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(1, t0 + seconds * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
      o.connect(g); g.connect(out); return { output: out, duration: seconds, start() { o.start(); }, stop() { try { o.stop(); } catch (e) {} } };
    });

    // Pigeon coo / flutter (street)
    this.registerSynth('pigeon', (c) => {
      const out = c.createGain(); out.gain.value = 0.25; const t0 = c.currentTime; const o = c.createOscillator(); o.type = 'sine'; const g = c.createGain(); g.gain.value = 0;
      for (let i = 0; i < 3; i++) { const s = t0 + i * 0.45; o.frequency.setValueAtTime(380, s); o.frequency.linearRampToValueAtTime(330, s + 0.3); g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.5, s + 0.05); g.gain.linearRampToValueAtTime(0, s + 0.35); }
      o.connect(g); g.connect(out); return { output: out, duration: 1.6, start() { o.start(); }, stop() { try { o.stop(); } catch (e) {} } };
    });
  }
}

class Emitter {
  constructor(engine, { object = null, position = null, synth, params = {}, gain = 1, refDistance = 2, maxDistance = 50, rolloff = 1.4, autoplay = true, loop = true, cone = null } = {}) {
    this.engine = engine; this.object = object; this.position = position ? position.clone() : null; this.synthName = synth; this.params = params; this.gainValue = gain;
    this.refDistance = refDistance; this.maxDistance = maxDistance; this.rolloff = rolloff; this.autoplay = autoplay; this.cone = cone;
    this.node = null; this.playing = false; this._tmp = new THREE.Vector3(); this.enabled = true;
  }
  _connect() {
    const c = this.engine.ctx; if (!c || this.panner) return;
    this.panner = this.engine._panner(this.refDistance, this.maxDistance); this.panner.rolloffFactor = this.rolloff;
    if (this.cone) { this.panner.coneInnerAngle = this.cone.inner; this.panner.coneOuterAngle = this.cone.outer; this.panner.coneOuterGain = this.cone.outerGain ?? 0.2; }
    this.gain = c.createGain(); this.gain.gain.value = this.gainValue; this.gain.connect(this.panner); this.panner.connect(this.engine.sourceBus);
    if (this.autoplay) this.play();
  }
  play() {
    if (this.playing || !this.engine.ctx) return; const f = this.engine.synths.get(this.synthName); if (!f) { console.warn('[audio] unknown synth', this.synthName); return; }
    this.node = f(this.engine.ctx, this.params); this.node.output.connect(this.gain); this.node.start(); this.playing = true;
  }
  stop() { if (!this.playing) return; try { this.node.stop(); this.node.output.disconnect(); } catch (e) {} this.playing = false; this.node = null; }
  set(k, v) { if (this.node && this.node.set) this.node.set(k, v); }
  setGain(v, ramp = 0.1) { this.gainValue = v; if (this.gain) this.gain.gain.setTargetAtTime(v, this.engine.ctx.currentTime, ramp); }
  update() {
    if (!this.panner) return;
    const p = this.object ? this.object.getWorldPosition(this._tmp) : this.position; if (!p) return;
    // Far-away emitters: cheap culling by just leaving them (Web Audio handles distance). Update position only.
    if (this.panner.positionX) { const t = this.engine.ctx.currentTime; this.panner.positionX.setTargetAtTime(p.x, t, 0.03); this.panner.positionY.setTargetAtTime(p.y, t, 0.03); this.panner.positionZ.setTargetAtTime(p.z, t, 0.03); }
    else this.panner.setPosition(p.x, p.y, p.z);
    if (this.cone && this.object) { const d = new THREE.Vector3(0, 0, -1).applyQuaternion(this.object.getWorldQuaternion(new THREE.Quaternion())); if (this.panner.orientationX) { this.panner.orientationX.value = d.x; this.panner.orientationY.value = d.y; this.panner.orientationZ.value = d.z; } }
  }
}

class Bed {
  constructor(engine, zones, synthName, params, gainValue) { this.engine = engine; this.zones = Array.isArray(zones) ? zones : [zones]; this.synthName = synthName; this.params = params; this.gainValue = gainValue; this.active = false; }
  _connect() {
    const c = this.engine.ctx; if (!c || this.gain) return; const f = this.engine.synths.get(this.synthName); if (!f) return;
    this.gain = c.createGain(); this.gain.gain.value = 0; this.gain.connect(this.engine.bedBus); this.node = f(c, this.params); this.node.output.connect(this.gain); this.node.start();
  }
  setActive(on, immediate = false) { this.active = on; if (!this.gain) return; this.gain.gain.setTargetAtTime(on ? this.gainValue : 0, this.engine.ctx.currentTime, immediate ? 0.01 : 0.6); }
}
