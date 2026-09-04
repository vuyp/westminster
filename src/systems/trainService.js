// ---------------------------------------------------------------------------
// trainService.js — runs the timetable on all four tracks: spawns trains in the
// tunnels, brings them in with a realistic braking curve, opens doors (and the
// Jubilee platform edge doors), dwells, chimes, closes, departs; drives the
// next-train indicators, the on-train announcements and the platform PA hooks,
// registers platform-side collision for stopped trains and attaches the player
// when they walk aboard.
//
//   const svc = ctx.get('trainService');
//   svc.on('arriving'|'stopped'|'doorsOpen'|'doorsClosing'|'departing'|'gone', fn({train, track, platform, line, destination}))
//   svc.nextTrains(platformNumber) → [{destination, minutes, line, seconds}]
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { Track } from '../core/track.js';
import { TRACKS, JUBILEE, DISTRICT } from '../core/layout.js';
import { STOCK_1996, STOCK_S7, trainLength, doorPositions } from '../entities/trainSpec.js';

const APPROACH_DIST = 420;   // metres before the stop where a train appears (in the tunnel, out of sight)
const DEPART_DIST = 380;     // metres after the stop where it is removed

// Service pattern per track. destinations: [name, weight, line]
const SERVICES = {
  jubileeUpper: { headway: 150, first: 22, stock: STOCK_1996, line: 'jubilee', destinations: [['Stratford', 8, 'jubilee'], ['North Greenwich', 2, 'jubilee']] },
  jubileeLower: { headway: 150, first: 85, stock: STOCK_1996, line: 'jubilee', destinations: [['Stanmore', 6, 'jubilee'], ['Willesden Green', 2, 'jubilee'], ['Wembley Park', 2, 'jubilee']] },
  districtEB: { headway: 165, first: 48, stock: STOCK_S7, line: 'district', destinations: [['Upminster', 4, 'district'], ['Barking', 2, 'district'], ['Tower Hill', 1, 'district'], ['Edgware Road', 3, 'circle']] },
  districtWB: { headway: 165, first: 118, stock: STOCK_S7, line: 'district', destinations: [['Ealing Broadway', 3, 'district'], ['Richmond', 3, 'district'], ['Wimbledon', 3, 'district'], ['Hammersmith', 3, 'circle']] },
};

const CIRCLE_VIA = { 'Edgware Road': 'via Tower Hill', 'Hammersmith': 'via Victoria' };

class TrainService {
  constructor(ctx, trainsMod, announcements) {
    this.ctx = ctx; this.trainsMod = trainsMod; this.ann = announcements;
    this.listeners = {}; this.trains = []; this.lines = {}; this.time = 0; this._indicatorTimer = 0; this._timers = [];
    this._rng = mulberry(12345);
    for (const [key, def] of Object.entries(TRACKS)) {
      const svc = SERVICES[key]; if (!svc) continue;
      const track = new Track(def);
      ctx.register('track:' + key, track);
      const line = { key, def, track, svc, platform: def.platform, nextAt: svc.first, active: null, queue: [], pedsKey: key === 'jubileeUpper' ? 'peds:upper' : key === 'jubileeLower' ? 'peds:lower' : null };
      // side of the platform relative to travel direction
      const f = track.frameAt(track.stopS); const left = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), f.tangent);
      const pc = def.platformCentre; const platZ = key.startsWith('jubilee') ? pc[2] : pc[2]; const platCentre = key.startsWith('jubilee') ? new THREE.Vector3((JUBILEE.platformXMin + JUBILEE.platformXMax) / 2, pc[1], pc[2]) : new THREE.Vector3(pc[0], pc[1], (DISTRICT.platforms[def.platform].zMin + DISTRICT.platforms[def.platform].zMax) / 2);
      line.doorSide = platCentre.clone().sub(f.position).dot(left) > 0 ? 'left' : 'right';
      // pre-plan the next few departures for the indicators
      for (let i = 0; i < 4; i++) line.queue.push({ at: svc.first + i * svc.headway + (i ? this._jitter(20) : 0), destination: this._pick(svc.destinations) });
      this.lines[key] = line;
    }
  }
  _jitter(n) { return (this._rng() - 0.5) * 2 * n; }
  _pick(list) { const total = list.reduce((a, d) => a + d[1], 0); let r = this._rng() * total; for (const d of list) { r -= d[1]; if (r <= 0) return { name: d[0], line: d[2] }; } return { name: list[0][0], line: list[0][2] }; }

  /** Schedule fn after `seconds` of SIMULATION time (not wall-clock), so headless tests with advance() stay deterministic. */
  _schedule(seconds, fn) { this._timers.push({ at: this.time + seconds, fn }); }
  _runTimers() { if (!this._timers.length) return; const due = this._timers.filter(t => t.at <= this.time); if (!due.length) return; this._timers = this._timers.filter(t => t.at > this.time); for (const t of due) { try { t.fn(); } catch (e) { console.error('[trainService timer]', e); } } }

  on(evt, fn) { (this.listeners[evt] = this.listeners[evt] || []).push(fn); return () => { const l = this.listeners[evt]; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); }; }
  emit(evt, data) { for (const fn of (this.listeners[evt] || [])) { try { fn(data); } catch (e) { console.error('[trainService listener]', e); } } }

  /** Upcoming trains for a platform number (1,2 District/Circle; 3,4 Jubilee). */
  nextTrains(platformNumber) {
    const line = Object.values(this.lines).find(l => l.platform === platformNumber); if (!line) return [];
    const out = [];
    if (line.active && line.active.state !== 'departing' && line.active.state !== 'gone') out.push({ destination: line.active.destination.name, line: line.active.destination.line, seconds: Math.max(0, line.active.eta), minutes: line.active.state === 'stopped' ? 0 : Math.ceil(Math.max(0, line.active.eta) / 60), state: line.active.state });
    for (const q of line.queue) { const s = q.at - this.time + this._approachTime(line); out.push({ destination: q.destination.name, line: q.destination.line, seconds: s, minutes: Math.max(1, Math.ceil(s / 60)), state: 'scheduled' }); }
    return out.slice(0, 3);
  }
  _approachTime(line) { const v = line.svc.stock.maxSpeed; const a = line.svc.stock.decel; const brake = v * v / (2 * a); return (APPROACH_DIST - brake) / v + v / a; }

  _spawn(line, item) {
    const spec = line.svc.stock; let train = null;
    try { if (this.trainsMod && this.trainsMod.createTrain) train = this.trainsMod.createTrain(this.ctx, { stock: spec === STOCK_1996 ? '1996' : 'S7', track: line.track, direction: line.def.direction, destination: item.destination.name, line: item.destination.line }); } catch (e) { console.error('[trainService] createTrain failed, using placeholder', e); }
    if (!train) train = makePlaceholderTrain(this.ctx, spec);
    const t = { train, line, spec, destination: item.destination, state: 'approaching', s: line.track.stopS - APPROACH_DIST, v: spec.maxSpeed, accel: 0, eta: 0, timer: 0, announced: {}, blockers: [] };
    t.length = trainLength(spec);
    train.destination = item.destination.name;
    if (train.setDestination) train.setDestination(item.destination.line === 'circle' ? `Circle line ${CIRCLE_VIA[item.destination.name] || ''}`.trim() : item.destination.name);
    if (train.setDisplay) train.setDisplay(this._text('arriving', t) || `Westminster`);
    this.ctx.scene.add(train.group);
    this._place(t);
    this.trains.push(t); line.active = t;
    return t;
  }

  _place(t) {
    const tr = t.train;
    if (tr.placeAlong) tr.placeAlong(t.line.track, t.s);
    else { const f = t.line.track.frameAt(t.s); tr.group.position.copy(f.position); tr.group.quaternion.copy(f.quaternion); }
  }

  _text(key, t) {
    if (!this.ann || !this.ann.TRAIN_ANNOUNCEMENTS) return null;
    const line = t.destination.line === 'circle' ? 'circle' : t.line.svc.line; const dir = t.line.def.direction;
    const set = this.ann.TRAIN_ANNOUNCEMENTS[line] && this.ann.TRAIN_ANNOUNCEMENTS[line][dir]; if (!set) return null;
    let v = set[key]; if (typeof v === 'function') v = v(t.destination.name); if (Array.isArray(v)) v = v.join(' ');
    return v || null;
  }

  _announceOnTrain(t, key, extra = {}) {
    const text = this._text(key, t) || DEFAULT_ANNOUNCEMENTS[key] && DEFAULT_ANNOUNCEMENTS[key](t); if (!text) return;
    const aboard = this.ctx.player && this.ctx.player.train === t.train;
    if (t.train.setDisplay && extra.display !== false) t.train.setDisplay(extra.display || text.split('.')[0]);
    this.ctx.audio.announce(text, { voice: 'train', at: aboard ? null : t.train.group, radius: aboard ? Infinity : 4, priority: aboard ? 2 : 0 });
  }

  _setBlockers(t, on) {
    for (const b of t.blockers) this.ctx.collision.remove(b); t.blockers = [];
    if (!on || !t.train.exteriorBoxes) return;
    for (const box of t.train.exteriorBoxes()) t.blockers.push(this.ctx.collision.addBlocker(box, 'train'));
  }

  update(dt) {
    this.time += dt; const ctx = this.ctx; this._runTimers();
    for (const line of Object.values(this.lines)) {
      // spawn when due
      if (!line.active && line.queue.length && this.time >= line.queue[0].at) { const item = line.queue.shift(); const last = line.queue.length ? line.queue[line.queue.length - 1].at : item.at; line.queue.push({ at: last + line.svc.headway + this._jitter(25), destination: this._pick(line.svc.destinations) }); this._spawn(line, item); }
    }
    for (const t of this.trains) this._updateTrain(t, dt);
    this.trains = this.trains.filter(t => t.state !== 'gone');
    this._indicatorTimer += dt; if (this._indicatorTimer > 1) { this._indicatorTimer = 0; this._updateIndicators(); }
    this._playerAttach();
  }

  _updateTrain(t, dt) {
    const spec = t.spec, track = t.line.track, tr = t.train; const stopS = track.stopS; const remain = stopS - t.s;
    switch (t.state) {
      case 'approaching': {
        const brakeDist = t.v * t.v / (2 * spec.decel);
        if (remain <= brakeDist + 0.5) { t.accel = -spec.decel; } else t.accel = 0;
        // avoid creeping: simple kinematics
        t.v = Math.max(0, t.v + t.accel * dt); t.s += t.v * dt;
        t.eta = t.v > 0.1 ? remain / Math.max(t.v, 1) : 0;
        if (!t.announced.arrivingPA && remain < 320) { t.announced.arrivingPA = true; this.emit('arriving', this._evt(t)); }
        if (!t.announced.wind && remain < 190) { t.announced.wind = true; const p = track.pointAt(stopS - 40); this.ctx.audio.play('tunnelWind', { position: p, gain: 0.9, params: { seconds: 7 }, refDistance: 6, maxDistance: 80 }); }
        if (!t.announced.arriving && remain < 150) { t.announced.arriving = true; this._announceOnTrain(t, 'arriving'); }
        if (remain <= 0.15 || t.v < 0.02) { t.s = stopS; t.v = 0; t.accel = 0; t.state = 'stopped'; t.timer = 0; this.ctx.audio.play('airRelease', { object: tr.group, gain: 0.7, refDistance: 5, maxDistance: 60 }); this._setBlockers(t, true); this.emit('stopped', this._evt(t)); if (tr.setSpeed) tr.setSpeed(0, 0); }
        break;
      }
      case 'stopped': {
        t.timer += dt;
        if (!t.announced.doorsOpen && t.timer > 1.2) {
          t.announced.doorsOpen = true; tr.setDoors(true, { side: t.line.doorSide });
          const peds = t.line.pedsKey && this.ctx.get(t.line.pedsKey); if (peds && peds.setOpen) peds.setOpen(true);
          this._schedule(spec.doorTime + 0.1, () => { if (t.state === 'stopped') this._setBlockers(t, true); });
          this.emit('doorsOpen', this._evt(t));
          if (!t.announced.stopped) { t.announced.stopped = true; this._schedule(2.5, () => this._announceOnTrain(t, 'stopped')); }
        }
        const closeAt = 1.2 + spec.dwell;
        if (!t.announced.closing && t.timer > closeAt - 4.5) { t.announced.closing = true; this.ctx.audio.play(spec.chime, { object: tr.group, gain: 0.55, refDistance: 6, maxDistance: 50, params: { seconds: 2.6 } }); this._announceOnTrain(t, 'doorsClosing', { display: 'Please stand clear of the doors' }); this.emit('doorsClosing', this._evt(t)); }
        if (!t.announced.closed && t.timer > closeAt) {
          t.announced.closed = true; tr.setDoors(false, { side: t.line.doorSide });
          const peds = t.line.pedsKey && this.ctx.get(t.line.pedsKey); if (peds && peds.setOpen) peds.setOpen(false);
          this._schedule(spec.doorTime + 0.1, () => { if (t.state === 'stopped') this._setBlockers(t, true); });
        }
        if (t.announced.closed && t.timer > closeAt + spec.doorTime + 2.0) {
          // a passenger who is still in a doorway when the doors close stays aboard (attached); proceed
          t.state = 'departing'; t.timer = 0; this._setBlockers(t, false); this.emit('departing', this._evt(t));
          this._schedule(6, () => this._announceOnTrain(t, 'departing'));
        }
        break;
      }
      case 'departing': {
        t.accel = spec.accel; t.v = Math.min(spec.maxSpeed, t.v + t.accel * dt); t.s += t.v * dt; t.eta = 0;
        if (t.s > stopS + DEPART_DIST) {
          if (this.ctx.player && this.ctx.player.train === tr) { this._rideOnward(t); return; }
          t.state = 'gone'; this.ctx.scene.remove(tr.group); if (tr.dispose) tr.dispose(); t.line.active = null; this.emit('gone', this._evt(t));
        }
        break;
      }
      case 'riding': { this._updateRide(t, dt); break; }
    }
    if (t.state !== 'gone') {
      this._place(t);
      if (tr.setSpeed) tr.setSpeed(t.v, t.accel);
      if (tr.update) tr.update(dt);
      tr.sway = Math.min(1, t.v / 15);
    }
  }

  /** The player stayed aboard: simulate the run to the next station and come back into Westminster on the same platform
   *  (the world only contains Westminster). We fade the HUD, run in the dark tunnel for ~90 s, announce the next station,
   *  then return the train to the approach and let it arrive again as the "next" train. */
  _rideOnward(t) {
    t.state = 'riding'; t.timer = 0; t.rideDuration = 75 + this._rng() * 30;
    const next = NEXT_STATION[t.line.key] && NEXT_STATION[t.line.key](t.destination.name);
    t.nextStation = next;
    this.ctx.hud && this.ctx.hud.notice(`Travelling towards ${next || t.destination.name}…`, 5);
    this._schedule(4, () => { if (t.state === 'riding') this.ctx.audio.announce(`The next station is ${next}.`, { voice: 'train', priority: 2 }); });
    this.emit('gone', this._evt(t)); t.line.active = null;
  }
  _updateRide(t, dt) {
    const spec = t.spec; t.timer += dt;
    // keep the train "in the tunnel" by looping its s over the tunnel section beyond the platform, but far from the station
    if (t.timer < t.rideDuration * 0.5) { t.v = Math.min(spec.maxSpeed, t.v + spec.accel * dt); }
    else if (t.timer < t.rideDuration * 0.5 + 6) { t.v = Math.max(0, t.v - spec.decel * dt); if (t.v === 0 && !t.announced.nextStop) { t.announced.nextStop = true; this.ctx.hud && this.ctx.hud.notice(`${t.nextStation || 'Next station'} — the simulation only models Westminster; the train will return`, 6); this.ctx.audio.announce(`This is ${t.nextStation || 'the next station'}.`, { voice: 'train', priority: 2 }); } }
    else if (t.timer < t.rideDuration) { t.v = Math.min(spec.maxSpeed, t.v + spec.accel * dt); if (!t.announced.back && t.timer > t.rideDuration * 0.5 + 12) { t.announced.back = true; const line = t.line; line.active = null; this.ctx.audio.announce(`The next station is Westminster. Change here for the ${line.svc.line === 'jubilee' ? 'District and Circle lines' : 'Jubilee line'}.`, { voice: 'train', priority: 2 }); } }
    else {
      // re-enter as an arriving train on the same track (opposite direction is not modelled)
      const line = t.line; line.active = t; t.state = 'approaching'; t.s = line.track.stopS - APPROACH_DIST; t.v = spec.maxSpeed; t.accel = 0; t.announced = { arrivingPA: true }; t.destination = this._pick(line.svc.destinations); t.train.destination = t.destination.name;
      if (t.train.setDestination) t.train.setDestination(t.destination.name);
      return;
    }
    // move along the tunnel section far from the platform so the player only sees tunnel walls
    t.s += t.v * dt; const L = t.line.track.length; if (t.s > L - 60) t.s = 60;
  }

  _evt(t) { return { train: t.train, track: t.line.key, platform: t.line.platform, line: t.destination.line, destination: t.destination.name, direction: t.line.def.direction, state: t.state }; }

  _updateIndicators() {
    for (const line of Object.values(this.lines)) {
      const ind = this.ctx.get('indicator:' + line.platform); if (!ind || !ind.set) continue;
      const next = this.nextTrains(line.platform);
      const lines = next.slice(0, 2).map((n, i) => ({ left: `${i + 1}  ${n.destination}${n.line === 'circle' ? ' (Circle)' : ''}`, right: n.state === 'stopped' ? '' : n.minutes === 0 || n.seconds < 30 ? 'Due' : `${n.minutes} min` }));
      const clock = this.ctx.stationTime ? this.ctx.stationTime().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
      lines.push({ left: line.active && line.active.state === 'stopped' ? '*** STAND CLEAR OF THE DOORS ***' : 'Please stand behind the yellow line', right: clock });
      ind.set(lines);
    }
  }

  _playerAttach() {
    const p = this.ctx.player; if (!p || !p.attachTrain) return;
    if (p.train) return; // the player detaches themself when stepping out
    const probe = p.pos.clone(); probe.y += 0.9;
    for (const t of this.trains) {
      if (t.state !== 'stopped' || !t.train.doorsOpen) continue; const tr = t.train;
      const local = tr.group.worldToLocal(probe.clone());
      if (tr.interiorContains && tr.interiorContains(local)) { p.attachTrain(tr); this.ctx.hud && this.ctx.hud.notice(`Aboard the ${t.destination.line === 'circle' ? 'Circle' : t.line.svc.line === 'jubilee' ? 'Jubilee' : 'District'} line train to ${t.destination.name}`, 4); return; }
    }
  }
}

const NEXT_STATION = {
  jubileeUpper: () => 'Waterloo', jubileeLower: () => 'Green Park',
  districtEB: () => 'Embankment', districtWB: () => "St. James's Park",
};

// Used only when src/audio/announcements.js is absent.
const DEFAULT_ANNOUNCEMENTS = {
  arriving: t => t.line.svc.line === 'jubilee' ? 'This station is Westminster. Change here for the District and Circle lines. Exit for the Houses of Parliament and Westminster Abbey.' : `This is Westminster. Change here for the Jubilee line.`,
  stopped: t => `This is a ${t.destination.line === 'circle' ? 'Circle' : t.line.svc.line === 'jubilee' ? 'Jubilee' : 'District'} line train to ${t.destination.name}.`,
  doorsClosing: () => 'Please stand clear of the doors.',
  departing: t => `The next station is ${NEXT_STATION[t.line.key]()}.`,
};

function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Minimal boxy train implementing the contract — used until src/entities/trains.js exists (or if it fails). */
export function makePlaceholderTrain(ctx, spec) {
  const g = new THREE.Group(); g.name = 'placeholder-train';
  const L = trainLength(spec); const cars = []; let cursor = L / 2;
  const bodyMat = new THREE.MeshStandardMaterial({ color: spec.livery.body, roughness: 0.4, metalness: 0.6 });
  const doorMat = new THREE.MeshStandardMaterial({ color: spec.livery.doors, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.6 });
  const doorLeaves = [];
  for (let i = 0; i < spec.cars; i++) {
    const len = spec.carLength[i]; const zc = -(cursor - len / 2); // local -z = forward
    const car = new THREE.Group(); car.position.z = zc; g.add(car);
    const shell = new THREE.Mesh(new THREE.BoxGeometry(spec.width, spec.height - spec.bodyBottom, len - 0.1), bodyMat); shell.position.y = spec.bodyBottom + (spec.height - spec.bodyBottom) / 2; car.add(shell);
    const win = new THREE.Mesh(new THREE.BoxGeometry(spec.width + 0.02, spec.windowTop - spec.windowBottom, len - 1.5), glass); win.position.y = (spec.windowTop + spec.windowBottom) / 2; car.add(win);
    const dws = (spec.doorwaysDM && (i === 0 || i === spec.cars - 1)) ? spec.doorwaysDM : spec.doorways;
    for (const side of [-1, 1]) for (const d of dws) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.05, spec.doorHeight, d.width), doorMat); leaf.position.set(side * (spec.width / 2 + 0.02), spec.doorSill + spec.doorHeight / 2, -d.offset); car.add(leaf);
      doorLeaves.push({ mesh: leaf, side: side < 0 ? 'left' : 'right', base: leaf.position.z, width: d.width });
    }
    cars.push({ group: car, zc, len }); cursor -= len + spec.gap;
  }
  const floorY = spec.floorHeight; let doorsOpen = false, doorT = 0, target = 0;
  const train = {
    group: g, stock: spec === STOCK_1996 ? '1996' : 'S7', floorY, doorsOpen, openSide: 'left', sway: 0, spec,
    interiorContains(p) { return Math.abs(p.x) < spec.width / 2 - 0.15 && Math.abs(p.z) < L / 2 && p.y > floorY - 0.5 && p.y < floorY + 2.2; },
    resolveInterior(p, r) {
      const half = spec.width / 2 - 0.12; let exited = false;
      if (Math.abs(p.x) > half - r) {
        // in a doorway and doors open? then allow exit
        const sideHere = p.x < 0 ? 'left' : 'right';
        const nearDoor = doorLeaves.some(d => d.side === sideHere && Math.abs(p.z - (cars.find(c => Math.abs(p.z - c.zc) < c.len / 2)?.zc ?? 1e9) - d.base) < d.width / 2 + 0.2);
        if (train.doorsOpen && train.openSide === sideHere && nearDoor) { if (Math.abs(p.x) > half + 0.6) exited = true; }
        else p.x = Math.sign(p.x) * (half - r);
      }
      if (Math.abs(p.z) > L / 2 - 0.6) p.z = Math.sign(p.z) * (L / 2 - 0.6);
      return { exited };
    },
    setDoors(open, { side = 'left' } = {}) { target = open ? 1 : 0; train.doorsOpen = open; train.openSide = side; ctx.audio.play('doorMove', { object: g, gain: 0.6, params: { seconds: spec.doorTime, closing: !open }, refDistance: 4, maxDistance: 40 }); },
    setDisplay() {}, setDestination() {}, setSpeed() {},
    exteriorBoxes() {
      // car bodies as world AABBs, split into left/right halves; on the OPEN side leave gaps at the doorways so passengers can board
      const out = []; g.updateMatrixWorld(true);
      for (let i = 0; i < cars.length; i++) {
        const c = cars[i]; const dws = (spec.doorwaysDM && (i === 0 || i === spec.cars - 1)) ? spec.doorwaysDM : spec.doorways;
        for (const side of ['left', 'right']) {
          const segs = [];
          if (!train.doorsOpen || train.openSide !== side) segs.push([-c.len / 2, c.len / 2]);
          else { let z0 = -c.len / 2; const gaps = dws.map(d => [-d.offset - d.width / 2 - 0.1, -d.offset + d.width / 2 + 0.1]).sort((a, b) => a[0] - b[0]); for (const [ga, gb] of gaps) { if (ga > z0) segs.push([z0, ga]); z0 = Math.max(z0, gb); } if (z0 < c.len / 2) segs.push([z0, c.len / 2]); }
          const x0 = side === 'left' ? -spec.width / 2 : 0, x1 = side === 'left' ? 0 : spec.width / 2;
          for (const [za, zb] of segs) { const b = new THREE.Box3(new THREE.Vector3(x0, 0, za + c.zc), new THREE.Vector3(x1, spec.height, zb + c.zc)); b.applyMatrix4(g.matrixWorld); out.push(b); }
        }
      }
      return out;
    },
    placeAlong(track, s) { const f = track.frameAt(s); g.position.copy(f.position); g.quaternion.copy(f.quaternion); g.updateMatrixWorld(true); },
    update(dt) { doorT += (target - doorT) * Math.min(1, dt * (2 / spec.doorTime) * 2); for (const d of doorLeaves) d.mesh.visible = !(train.doorsOpen && train.openSide === d.side && doorT > 0.85); },
    dispose() {},
  };
  return train;
}

export async function build(ctx) {
  let trainsMod = null, ann = null;
  try { trainsMod = await import('../entities/trains.js'); } catch (e) { console.warn('[trainService] entities/trains.js not available — using placeholder trains'); }
  try { ann = await import('../audio/announcements.js'); } catch (e) { console.warn('[trainService] audio/announcements.js not available — using defaults'); }
  const svc = new TrainService(ctx, trainsMod, ann);
  ctx.register('trainService', svc);
  ctx.onUpdate(dt => svc.update(dt));
  return svc;
}
