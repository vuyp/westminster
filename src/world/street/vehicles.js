// ---------------------------------------------------------------------------
// street/vehicles.js — the traffic: red New-Routemaster-style double-deckers (route 11 calling at Stop H;
// 159 and 453 down from Whitehall), black cabs and a few cars, driving on the LEFT around three closed loops
// (Bridge Street ⇄ Westminster Bridge ⇄ the Parliament Square gyratory; Parliament Street ⇄ the bridge;
// Victoria Embankment ⇄ the bridge), with car-following, the signalised Bridge Street / Victoria Embankment
// junction (three stages: Bridge Street, Embankment, pedestrians — with the pelican crossing at x = 40),
// a 12 s dwell at the bus stop, rolling wheels, direction-aware destination blinds, and a positional
// 'street:engine' synth on every bus and cab. Vehicles are InstancedMesh fleets: one draw call per body face
// material per fleet. Eastbound traffic (+x) uses the NORTH lanes, westbound the SOUTH lanes (left-hand rule).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { Merger, makeMaterials, signMat, busSideTexture, busFrontTexture, busRearTexture, cabSideTexture, cabEndTexture, carSideTexture, carEndTexture, carCabinTexture, blindTexture, signalHousingTexture, mulberry } from './kit.js';

export function buildVehicles(ctx, group, plan, state) {
  const { layout, audio, T } = ctx; const mats = makeMaterials(ctx); const S = layout.STREET; const P = plan; const L = P.lanes;
  const RY = P.ROAD_Y; const B = S.bridge; const deckY = state.deckY || (() => 0);
  const roadY = (x, z) => (x >= B.xMin - 0.3 && x <= B.xMax + 0.3 && z > 3 && z < 23) ? deckY(x) - P.KERB : RY;
  const rnd = mulberry(41);
  const paint = (c, r = 0.5, m = 0.2) => ctx.M.paint(c, { roughness: r, metalness: m });
  const faceMat = (tex, extra = {}) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0.25, ...extra });

  // ================================================================ the engine synth (low rumble whose pitch and hiss follow set('speed'))
  try {
    audio.registerSynth('street:engine', (c, { type = 'bus' } = {}) => {
      const out = c.createGain(); out.gain.value = 0.35;
      const base = type === 'bus' ? 36 : type === 'cab' ? 27 : 32;
      const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = base; const g1 = c.createGain(); g1.gain.value = 0.55;
      const o2 = c.createOscillator(); o2.type = type === 'cab' ? 'square' : 'triangle'; o2.frequency.value = base * 2.01; const g2 = c.createGain(); g2.gain.value = type === 'cab' ? 0.22 : 0.14;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200; lp.Q.value = 1.1;
      // diesel 'rattle': amplitude-modulate the fundamental with a pulse at half the firing rate
      const am = c.createOscillator(); am.type = 'square'; am.frequency.value = base / 2; const amg = c.createGain(); amg.gain.value = type === 'cab' ? 0.35 : 0.18; const amBias = c.createGain(); amBias.gain.value = 1;
      const key = '_streetPink'; if (!c[key]) { const len = c.sampleRate * 2; const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0, seed = 7; for (let i = 0; i < len; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; const w = (seed / 4294967296) * 2 - 1; b0 = 0.997 * b0 + w * 0.03; b1 = 0.985 * b1 + w * 0.08; b2 = 0.95 * b2 + w * 0.15; d[i] = (b0 + b1 + b2 + w * 0.05) * 0.9; } c[key] = b; }
      const n = c.createBufferSource(); n.buffer = c[key]; n.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.6; const ng = c.createGain(); ng.gain.value = 0.12;
      o1.connect(g1); g1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(out); n.connect(bp); bp.connect(ng); ng.connect(out);
      am.connect(amg); amg.connect(g1.gain);
      return {
        output: out, start() { o1.start(); o2.start(); am.start(); n.start(); }, stop() { try { o1.stop(); o2.stop(); am.stop(); n.stop(); } catch (e) {} },
        set(k, v) { if (k !== 'speed') return; const t = c.currentTime; const s = Math.min(1, v / 10); const f = 1 + s * 1.5 + (v > 0.3 ? 0.15 : 0); o1.frequency.setTargetAtTime(base * f, t, 0.25); o2.frequency.setTargetAtTime(base * 2.01 * f, t, 0.25); am.frequency.setTargetAtTime(base * f / 2, t, 0.25); lp.frequency.setTargetAtTime(200 + s * 380, t, 0.2); ng.gain.setTargetAtTime(0.1 + s * 0.4, t, 0.2); out.gain.setTargetAtTime(0.3 + s * 0.5, t, 0.2); },
      };
    });
  } catch (e) { console.warn('[street] engine synth failed', e); }

  // ================================================================ closed loops with filleted corners; segments flagged `hide` are the off-stage turnarounds
  function makeLoop(wps, defaultR = 9) {
    const n = wps.length; const V = (w) => new THREE.Vector3(w.x, 0, w.z);
    const ends = wps.map((w, i) => { const p = V(w), a = V(wps[(i - 1 + n) % n]), b = V(wps[(i + 1) % n]); const dIn = p.clone().sub(a).normalize(), dOut = b.clone().sub(p).normalize(); const angle = dIn.angleTo(dOut); if (angle < 0.03) return { p, in: p.clone(), out: p.clone(), straight: true }; const r = Math.min(w.r ?? defaultR, a.distanceTo(p) * 0.45, p.distanceTo(b) * 0.45); return { p, in: p.clone().addScaledVector(dIn, -r), out: p.clone().addScaledVector(dOut, r) }; });
    const curves = [];
    for (let i = 0; i < n; i++) { const e = ends[i], f = ends[(i + 1) % n]; if (!e.straight) curves.push({ curve: new THREE.QuadraticBezierCurve3(e.in, e.p, e.out), hidden: !!(wps[i].hide || wps[(i - 1 + n) % n].hide) }); curves.push({ curve: new THREE.LineCurve3(e.out, f.in), hidden: !!wps[i].hide }); }
    const cum = []; let acc = 0; for (const c of curves) { acc += c.curve.getLength(); cum.push(acc); }
    const at = (s, out) => { s = ((s % acc) + acc) % acc; let i = 0; while (i < cum.length - 1 && s >= cum[i]) i++; const start = i ? cum[i - 1] : 0; const l = cum[i] - start; const u = l > 1e-6 ? Math.min(1, Math.max(0, (s - start) / l)) : 0; const c = curves[i]; c.curve.getPointAt(u, out.pos); c.curve.getTangentAt(u, out.tan).normalize(); out.hidden = c.hidden; return out; };
    return { at, len: acc };
  }
  const zE = (L.eastGeneral[0] + L.eastGeneral[1]) / 2, zWcar = (L.westGeneral[0] + L.westGeneral[1]) / 2, zWbus = (L.westBus[0] + L.westBus[1]) / 2;
  const GGS_Z = -3, STM_S = -96.5, BS_Z = 109, WEST_X = -184, PS_S = -83.5, PS_N = -94.5, EMB_S = 52.5, EMB_N = 61.5, FAR = B.xMax + 12;
  const bridgeOutAndBack = (zW) => [{ x: B.xMin - 20, z: zE }, { x: FAR, z: zE, hide: true }, { x: FAR + 26, z: zE, r: 9, hide: true }, { x: FAR + 26, z: zW, r: 9, hide: true }, { x: FAR, z: zW }, { x: B.xMin - 20, z: zW }];
  const gyratory = [{ x: -86, z: zWcar + 4, r: 9 }, { x: STM_S, z: 34, r: 9 }, { x: STM_S, z: 100, r: 10 }, { x: -110, z: BS_Z, r: 10 }, { x: -176, z: BS_Z, r: 12 }, { x: WEST_X, z: 95, r: 12 }, { x: WEST_X, z: 10, r: 12 }, { x: -174, z: GGS_Z, r: 12 }];
  const loopBridge = (zW) => makeLoop([{ x: -120, z: GGS_Z }, { x: -92, z: GGS_Z, r: 14 }, { x: -78, z: zE, r: 14 }, { x: -50, z: zE }, ...bridgeOutAndBack(zW), { x: -70, z: zW }, ...gyratory]);
  const loopWhitehall = (zW) => makeLoop([{ x: PS_S, z: -360 }, { x: PS_S, z: zE, r: 13 }, { x: -60, z: zE }, ...bridgeOutAndBack(zW), { x: -70, z: zW }, ...gyratory, { x: -120, z: GGS_Z }, { x: PS_N, z: GGS_Z, r: 8 }, { x: PS_N, z: -360 }, { x: PS_N, z: -382, r: 5, hide: true }, { x: PS_S, z: -382, r: 5, hide: true }]);
  const loopEmbankment = makeLoop([{ x: EMB_S, z: -450 }, { x: EMB_S, z: zE, r: 11 }, { x: B.xMin - 6, z: zE }, { x: FAR, z: zE, hide: true }, { x: FAR + 26, z: zE, r: 9, hide: true }, { x: FAR + 26, z: zWcar, r: 9, hide: true }, { x: FAR, z: zWcar }, { x: EMB_N, z: zWcar, r: 9 }, { x: EMB_N, z: -450 }, { x: EMB_N, z: -474, r: 5, hide: true }, { x: EMB_S, z: -474, r: 5, hide: true }]);

  // ================================================================ traffic signals (the Bridge Street / Victoria Embankment junction + the pelican crossing)
  const STAGES = [['bridgeSt', 30], ['amberA', 3], ['red', 2], ['embankment', 16], ['amberB', 3], ['red', 2], ['pedestrian', 11], ['red', 2]];
  const CYCLE = STAGES.reduce((a, s) => a + s[1], 0);
  const signals = { t: 26, stage: 'bridgeSt', cycle: CYCLE, pedestrian: false,
    /** 'green' | 'amber' | 'red' for a signal group. */
    get(gr) { const st = this.stage; if (gr === 'bridgeSt') return st === 'bridgeSt' ? 'green' : st === 'amberA' ? 'amber' : 'red'; if (gr === 'embankment') return st === 'embankment' ? 'green' : st === 'amberB' ? 'amber' : 'red'; return 'red'; },
    advance(dt) { this.t = (this.t + dt) % CYCLE; let a = 0; for (const [name, d] of STAGES) { a += d; if (this.t < a) { this.stage = name; break; } } this.pedestrian = this.stage === 'pedestrian'; } };
  const lens = { bridgeSt: {}, embankment: {} }; const pedLens = {};
  try {
    const M = new Merger(group, 'signals');
    const housingTex = signalHousingTexture(T); const housing = new THREE.MeshStandardMaterial({ map: housingTex, roughness: 0.6 });
    for (const gr of ['bridgeSt', 'embankment']) for (const [k, col] of [['red', 0xff2a1a], ['amber', 0xffb000], ['green', 0x30ff70]]) lens[gr][k] = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: col, emissiveIntensity: 0.1, roughness: 0.4 });
    for (const [k, col] of [['red', 0xff2a1a], ['green', 0x30ff70]]) pedLens[k] = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: col, emissiveIntensity: 0.1, roughness: 0.4 });
    const facingRy = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 };
    const head = (x, z, facing, gr, { pole = true, h = 2.4 } = {}) => {   // head centre 1.05 m tall; lenses down the front face (local +z after ry)
      M.chunk('signals'); const ry = facingRy[facing]; if (pole) { M.cyl(mats.signGrey, 0.06, 0.07, h + 1.1, 8, { x, y: (h + 1.1) / 2, z }); ctx.collision.addBlocker({ xMin: x - 0.15, xMax: x + 0.15, yMin: -0.5, yMax: 3, zMin: z - 0.15, zMax: z + 0.15 }, 'signalPole'); }
      M.add(mats.dark, new THREE.BoxGeometry(0.36, 1.1, 0.3).translate(0, h + 0.55, 0), { x, y: 0, z, ry });
      M.add(housing, new THREE.PlaneGeometry(0.34, 1.05).translate(0, h + 0.55, 0.151), { x, y: 0, z, ry });
      for (let i = 0; i < 3; i++) { const k = ['red', 'amber', 'green'][i]; M.add(lens[gr][k], new THREE.CircleGeometry(0.1, 14).translate(0, h + 0.55 + 0.35 - i * 0.35, 0.16), { x, y: 0, z, ry }); M.add(mats.dark, new THREE.BoxGeometry(0.3, 0.03, 0.12).translate(0, h + 0.55 + 0.35 - i * 0.35 + 0.13, 0.2), { x, y: 0, z, ry }); }
    };
    const cx = P.crossings.pelicanX, ez = P.crossings.embZ;
    head(cx - 4.5, P.bridgeSt.zMin - 0.5, 'west', 'bridgeSt'); head(S.embankmentRoad.xMax + 1.0, P.bridgeSt.zMin - 0.5, 'west', 'bridgeSt');                 // eastbound: near side + far side of the junction
    head(S.embankmentRoad.xMax + 2.0, P.bridgeSt.zMax + 0.5, 'east', 'bridgeSt'); head(cx + 6.5, P.bridgeSt.zMax + 0.5, 'east', 'bridgeSt');                // westbound
    head(S.embankmentRoad.xMin - 0.6, ez - 4.5, 'north', 'embankment'); head(S.embankmentRoad.xMax + 0.6, ez - 4.5, 'north', 'embankment');                 // Embankment southbound
    // pedestrian aspects (red / green man) + push-button boxes on the pelican poles, and on the Embankment crossing
    const ped = (x, z, facing) => { const ry = facingRy[facing]; M.chunk('signals'); M.cyl(mats.signGrey, 0.06, 0.07, 3.0, 8, { x, y: 1.5, z }); M.add(mats.dark, new THREE.BoxGeometry(0.26, 0.5, 0.2).translate(0, 2.55, 0), { x, y: 0, z, ry }); M.add(pedLens.red, new THREE.CircleGeometry(0.08, 12).translate(0, 2.68, 0.101), { x, y: 0, z, ry }); M.add(pedLens.green, new THREE.CircleGeometry(0.08, 12).translate(0, 2.42, 0.101), { x, y: 0, z, ry }); M.add(mats.signGrey, new THREE.BoxGeometry(0.16, 0.22, 0.12).translate(0, 1.1, 0.08), { x, y: 0, z, ry }); M.add(mats.dark, new THREE.CircleGeometry(0.035, 10).translate(0, 1.1, 0.145), { x, y: 0, z, ry }); ctx.collision.addBlocker({ xMin: x - 0.15, xMax: x + 0.15, yMin: -0.5, yMax: 3, zMin: z - 0.15, zMax: z + 0.15 }, 'pedSignal'); };
    ped(cx - 1.9, P.bridgeSt.zMin - 0.6, 'south'); ped(cx + 1.9, P.bridgeSt.zMax + 0.6, 'north'); ped(S.embankmentRoad.xMin - 0.6, ez - 1.9, 'east'); ped(S.embankmentRoad.xMax + 0.6, ez + 1.9, 'west');
    // the westbound stop line east of the junction box (the road module drew the others)
    M.box(mats.whiteLine, 0.3, 0.006, L.westBus[1] - L.centre, { x: S.embankmentRoad.xMax + 1.6, y: RY + 0.004, z: (L.centre + L.westBus[1]) / 2 });
    M.flush({ castShadow: true });
  } catch (e) { console.warn('[street] traffic signals failed', e); }
  const applySignals = () => {
    for (const gr of ['bridgeSt', 'embankment']) { const s = signals.get(gr); for (const k of ['red', 'amber', 'green']) if (lens[gr][k]) lens[gr][k].emissiveIntensity = (k === s || (k === 'red' && s === 'amber' && signals.stage === 'red')) ? 2.2 : 0.08; }
    if (pedLens.red) { pedLens.red.emissiveIntensity = signals.pedestrian ? 0.08 : 2.0; pedLens.green.emissiveIntensity = signals.pedestrian ? 2.2 : 0.08; }
  };

  // ================================================================ fleets: InstancedMesh per body part (multi-material boxes) + wheels
  const BUS = { len: 11.2, w: 2.5, h: 4.4, wheels: [[-1.2, 0.5, -2.7], [1.2, 0.5, -2.7], [-1.2, 0.5, 2.8], [1.2, 0.5, 2.8]], wheelR: 0.5, wheelW: 0.32, vmax: 8.5, accel: 1.1, decel: 2.4, type: 'bus' };
  const CAB = { len: 4.85, w: 1.85, h: 1.85, wheels: [[-0.8, 0.34, -1.6], [0.8, 0.34, -1.6], [-0.8, 0.34, 1.5], [0.8, 0.34, 1.5]], wheelR: 0.34, wheelW: 0.22, vmax: 10.5, accel: 2.2, decel: 3.2, type: 'cab' };
  const CAR = { len: 4.3, w: 1.8, h: 1.1, wheels: [[-0.78, 0.32, -1.4], [0.78, 0.32, -1.4], [-0.78, 0.32, 1.35], [0.78, 0.32, 1.35]], wheelR: 0.32, wheelW: 0.2, vmax: 10, accel: 2.4, decel: 3.4, type: 'car' };
  const fleets = [];
  function makeFleet(name, spec, parts, count) {
    const meshes = parts.map(p => { const im = new THREE.InstancedMesh(p.geo, p.mat, count); im.castShadow = true; im.receiveShadow = false; im.name = `vehicles:${name}:${p.name}`; group.add(im); return im; });
    const wheelGeo = new THREE.CylinderGeometry(spec.wheelR, spec.wheelR, spec.wheelW, 14).rotateZ(Math.PI / 2); const hubGeo = new THREE.CylinderGeometry(spec.wheelR * 0.55, spec.wheelR * 0.55, spec.wheelW + 0.02, 10).rotateZ(Math.PI / 2);
    const wheels = new THREE.InstancedMesh(wheelGeo, mats.tyre, count * 4); wheels.castShadow = true; wheels.name = `vehicles:${name}:wheels`; group.add(wheels);
    const hubs = new THREE.InstancedMesh(hubGeo, mats.signGrey, count * 4); hubs.name = `vehicles:${name}:hubs`; group.add(hubs);
    const f = { name, spec, meshes, wheels, hubs, count, used: 0, vehicles: [] };
    fleets.push(f); return f;
  }
  const bodyMats = (side, front, rear, roof, under) => [faceMat(side.off), faceMat(side.near), roof, under, faceMat(rear), faceMat(front)];   // [+x offside, -x nearside, +y, -y, +z rear, -z front]
  const busBodyGeo = new THREE.BoxGeometry(BUS.w, BUS.h, BUS.len).translate(0, BUS.h / 2, 0);
  const busRoofGeo = new THREE.CylinderGeometry(BUS.w / 2 - 0.02, BUS.w / 2 - 0.02, BUS.len - 0.1, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2); busRoofGeo.scale(1, 0.22, 1); busRoofGeo.translate(0, BUS.h - 0.01, 0);
  const busRoof = paint(0x9e1a14, 0.55, 0.15), under = paint(0x151515, 0.9, 0.1);
  const busFleet = (route) => makeFleet('bus' + route, BUS, [
    { name: 'body', geo: busBodyGeo, mat: bodyMats({ off: busSideTexture(T, { nearside: false, route }), near: busSideTexture(T, { nearside: true, route }) }, busFrontTexture(T), busRearTexture(T, { route }), busRoof, under) },
    { name: 'roof', geo: busRoofGeo, mat: busRoof },
  ], 3);
  const cabBodyGeo = new THREE.BoxGeometry(CAB.w, CAB.h, CAB.len).translate(0, CAB.h / 2, 0);
  const cabRoofGeo = new THREE.CylinderGeometry(CAB.w / 2 - 0.02, CAB.w / 2 - 0.02, CAB.len - 1.6, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2); cabRoofGeo.scale(1, 0.18, 1); cabRoofGeo.translate(0, CAB.h - 0.01, 0.2);
  const taxiLight = new THREE.MeshStandardMaterial({ color: 0xffe27a, emissive: 0xffd24a, emissiveIntensity: 0.9, roughness: 0.4 });
  const cabFleet = makeFleet('cab', CAB, [
    { name: 'body', geo: cabBodyGeo, mat: bodyMats({ off: cabSideTexture(T, { nearside: false }), near: cabSideTexture(T, { nearside: true }) }, cabEndTexture(T), cabEndTexture(T, { rear: true }), mats.cabBlack, under) },
    { name: 'roof', geo: cabRoofGeo, mat: mats.cabBlack },
    { name: 'taxi', geo: new THREE.BoxGeometry(0.5, 0.12, 0.18).translate(0, CAB.h + 0.06, -0.6), mat: taxiLight },
  ], 5);
  const carFleet = (paintHex, name) => { const pm = paint(paintHex, 0.35, 0.4); const cabin = faceMat(carCabinTexture(T), { roughness: 0.15, metalness: 0.6 }); return makeFleet(name, CAR, [
    { name: 'body', geo: new THREE.BoxGeometry(CAR.w, CAR.h, CAR.len).translate(0, CAR.h / 2, 0), mat: bodyMats({ off: carSideTexture(T, { paint: '#' + paintHex.toString(16).padStart(6, '0'), nearside: false }), near: carSideTexture(T, { paint: '#' + paintHex.toString(16).padStart(6, '0'), nearside: true }) }, carEndTexture(T, { paint: '#' + paintHex.toString(16).padStart(6, '0') }), carEndTexture(T, { paint: '#' + paintHex.toString(16).padStart(6, '0'), rear: true }), pm, under) },
    { name: 'cabin', geo: new THREE.BoxGeometry(CAR.w - 0.12, 0.55, 2.3).translate(0, CAR.h + 0.27, 0.05), mat: [cabin, cabin, pm, pm, cabin, cabin] },
  ], 2); };
  const bus11 = busFleet('11'), bus159 = busFleet('159'); const carSilver = carFleet(0xc4c6c9, 'carSilver'), carBlue = carFleet(0x2b4a7a, 'carBlue');

  // destination blinds (per bus, direction-aware)
  const blindMat = (text) => signMat(ctx, blindTexture(T, text, { w: 512, h: 128 }), { emissive: 1.1 });
  const BLINDS = { '11': ['11  Waterloo', '11  Fulham Broadway'], '159': ['159  Kennington', '159  Marble Arch'] };

  // ================================================================ the vehicles
  const vehicles = []; const tmp = { pos: new THREE.Vector3(), tan: new THREE.Vector3(), hidden: false };
  const addVehicle = (fleet, loop, s, { route = null, stopsAtH = false, engine = true } = {}) => {
    const idx = fleet.used++; if (idx >= fleet.count) return null;
    const v = { fleet, spec: fleet.spec, loop, s, speed: 2, idx, halfLen: fleet.spec.len / 2, route, stopsAtH, served: false, dwell: 0, roll: 0, hidden: false, pos: new THREE.Vector3(), tan: new THREE.Vector3(1, 0, 0), yaw: 0, anchor: new THREE.Object3D(), blind: null, emitter: null };
    group.add(v.anchor);
    if (route && BLINDS[route]) { v.blindMats = BLINDS[route].map(blindMat); v.blind = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.42), v.blindMats[0]); v.blind.castShadow = false; v.anchor.add(v.blind); v.blind.position.set(0, 3.6, -fleet.spec.len / 2 - 0.02); }
    if (engine) { try { v.emitter = audio.emitter({ object: v.anchor, synth: 'street:engine', params: { type: fleet.spec.type }, gain: fleet.spec.type === 'bus' ? 0.55 : 0.32, refDistance: 4, maxDistance: 70, rolloff: 1.3 }); state.emitters.push(v.emitter); } catch (e) { /* no audio */ } }
    vehicles.push(v); fleet.vehicles.push(v); return v;
  };
  const LA_car = loopBridge(zWcar), LA_bus = loopBridge(zWbus), LB_car = loopWhitehall(zWcar), LB_bus = loopWhitehall(zWbus), LC = loopEmbankment;
  addVehicle(bus11, LA_bus, 40, { route: '11', stopsAtH: true }); addVehicle(bus11, LA_bus, LA_bus.len * 0.55, { route: '11', stopsAtH: true }); addVehicle(bus11, LA_bus, LA_bus.len * 0.3, { route: '11', stopsAtH: true });
  addVehicle(bus159, LB_bus, 120, { route: '159' }); addVehicle(bus159, LB_bus, LB_bus.len * 0.6, { route: '159' });
  addVehicle(cabFleet, LA_car, 15); addVehicle(cabFleet, LA_car, LA_car.len * 0.72); addVehicle(cabFleet, LB_car, 300); addVehicle(cabFleet, LC, 380); addVehicle(cabFleet, LC, LC.len * 0.5);
  addVehicle(carSilver, LA_car, LA_car.len * 0.42, { engine: false }); addVehicle(carSilver, LC, 150, { engine: false }); addVehicle(carBlue, LB_car, LB_car.len * 0.25, { engine: false }); addVehicle(carBlue, LA_car, LA_car.len * 0.88, { engine: false });

  // stop lines: { group, axis, dir (direction of travel along the axis), line, band: [min,max] of the other coordinate }
  const cx = P.crossings.pelicanX;
  const STOPS = [
    { group: 'bridgeSt', axis: 'x', dir: 1, line: cx - 4.2, band: [L.cycleN[0], L.centre] },
    { group: 'bridgeSt', axis: 'x', dir: -1, line: S.embankmentRoad.xMax + 1.4, band: [L.centre, L.westBus[1]] },
    { group: 'embankment', axis: 'z', dir: 1, line: P.crossings.embZ - 4.2, band: [S.embankmentRoad.xMin, (S.embankmentRoad.xMin + S.embankmentRoad.xMax) / 2] },
  ];
  const BUS_STOP_X = S.busStop.x + 3.5;   // the bus's front stops here (the flag is at S.busStop.x, the cage extends east)

  // ================================================================ per-frame simulation
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3(0, 0, 0), wm = new THREE.Matrix4(), wr = new THREE.Matrix4(), off = new THREE.Vector3();
  let acc = 0;
  const update = (dt) => {
    signals.advance(dt); applySignals();
    // 1. decide speeds
    for (const v of vehicles) {
      v.loop.at(v.s, tmp); v.pos.copy(tmp.pos); v.tan.copy(tmp.tan); v.hidden = tmp.hidden;
      const front = v.halfLen; let limit = v.spec.vmax;
      const consider = (gap) => { const g = gap - 1.6; const allowed = g <= 0 ? 0 : Math.sqrt(2 * v.spec.decel * g); if (allowed < limit) limit = allowed; };
      // vehicles ahead within a 1.7 m corridor
      for (const o of vehicles) { if (o === v || o.hidden) continue; const dx = o.pos.x - v.pos.x, dz = o.pos.z - v.pos.z; const along = dx * v.tan.x + dz * v.tan.z; if (along <= 0 || along > 34) continue; const lat = Math.abs(dx * v.tan.z - dz * v.tan.x); if (lat > 1.7) continue; const closing = (o.tan.x * v.tan.x + o.tan.z * v.tan.z) > 0.2; consider(along - front - o.halfLen - (closing ? 0 : 1.5)); }
      // stop lines
      for (const st of STOPS) { const sig = signals.get(st.group); if (sig === 'green') continue; const heading = st.axis === 'x' ? v.tan.x * st.dir : v.tan.z * st.dir; if (heading < 0.7) continue; const other = st.axis === 'x' ? v.pos.z : v.pos.x; if (other < st.band[0] - 1 || other > st.band[1] + 1) continue; const coord = st.axis === 'x' ? v.pos.x : v.pos.z; const d = (st.line - coord) * st.dir - front; if (d < -0.3 || d > 45) continue; if (sig === 'amber' && d < 6 && v.speed > 4) continue; consider(d); }
      // the bus stop (route 11 eastbound only)
      if (v.stopsAtH) { if (v.tan.x > 0.9 && v.pos.x > -70 && v.pos.x < BUS_STOP_X + 2 && !v.served) { const d = BUS_STOP_X - (v.pos.x + front); if (d > -0.3) { consider(d); if (d < 0.4 && v.speed < 0.05) { v.dwell += dt; if (v.dwell > 12) { v.served = true; } } } } if (v.pos.x > BUS_STOP_X + 40 || v.pos.x < -75) { v.served = false; v.dwell = 0; } }
      // slow on the gyratory and the tight turnarounds
      if (v.pos.x < -84 || v.hidden) limit = Math.min(limit, 7);
      const target = Math.max(0, limit);
      if (target > v.speed) v.speed = Math.min(target, v.speed + v.spec.accel * dt); else v.speed = Math.max(target, v.speed - v.spec.decel * dt);
    }
    // 2. move & place
    for (const v of vehicles) {
      const ds = v.speed * dt; v.s = (v.s + ds) % v.loop.len; v.roll += ds / v.spec.wheelR;
      v.loop.at(v.s, tmp); v.pos.copy(tmp.pos); v.tan.copy(tmp.tan); v.hidden = tmp.hidden;
      v.pos.y = roadY(v.pos.x, v.pos.z);
      v.yaw = Math.atan2(-v.tan.x, -v.tan.z); e3.set(0, v.yaw, 0, 'YXZ'); q.setFromEuler(e3);
      m4.compose(v.pos, q, v.hidden ? zero : one);
      for (const im of v.fleet.meshes) im.setMatrixAt(v.idx, m4);
      for (let k = 0; k < 4; k++) { const w = v.spec.wheels[k]; off.set(w[0], w[1], w[2]); wr.makeRotationX(v.roll); wr.setPosition(off); wm.multiplyMatrices(m4, wr); v.fleet.wheels.setMatrixAt(v.idx * 4 + k, wm); v.fleet.hubs.setMatrixAt(v.idx * 4 + k, wm); }
      v.anchor.position.copy(v.pos); v.anchor.rotation.y = v.yaw; v.anchor.visible = !v.hidden;
      if (v.blind) { const west = v.tan.x < -0.2 || (v.tan.z > 0.5); const mat = v.blindMats[west ? 1 : 0]; if (v.blind.material !== mat) v.blind.material = mat; }
      if (v.emitter) v.emitter.set('speed', v.hidden ? 0 : v.speed);
    }
    for (const f of fleets) { for (const im of f.meshes) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); } f.wheels.instanceMatrix.needsUpdate = true; f.wheels.computeBoundingSphere(); f.hubs.instanceMatrix.needsUpdate = true; f.hubs.computeBoundingSphere(); }
  };
  // settle the traffic before the first frame so vehicles are spread and moving
  for (let i = 0; i < 90; i++) update(1 / 10);
  ctx.onUpdate((dt) => { acc += dt; update(Math.min(dt, 0.1)); });

  return { vehicles, fleets, signals, loops: { bridgeCar: LA_car, bridgeBus: LA_bus, whitehallCar: LB_car, whitehallBus: LB_bus, embankment: LC } };
}
