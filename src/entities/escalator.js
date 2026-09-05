// ---------------------------------------------------------------------------
// escalator.js — a working London Underground escalator (JLE / Westminster style):
// moving steps (InstancedMesh), comb plates, stainless balustrades with under-handrail
// lighting, moving black handrails, skirt panels, landing plates, drive hum, and the
// collision registration that lets the player ride it (a moving ramp).
//
//   createEscalator(ctx, { top:{x,y,z}, bottom:{x,y,z}, dir:'down'|'up', width:1.0, name, lanes:[offsets] })
//   → { group, runs:[{ramp, emitter, from, to}], stop(), start() }
//
// `top`/`bottom` are the centres of the top and bottom comb plates (floor level of the landings).
// The run direction is taken from top→bottom in plan; the incline is whatever those points imply
// (aim for 30°). `lanes` creates several parallel escalators offset perpendicular to the run.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const STEP_SPEED = 0.75;      // m/s along the incline (LU standard 0.75 m/s)
const TREAD = 0.40;           // step tread depth (m)
const STEP_W = 1.0;           // step width (m)
const BALUSTRADE_H = 1.0;     // handrail height above the step nose line (m)

export function createEscalator(ctx, opts) {
  const { top, bottom, dir = 'down', width = STEP_W, name = 'escalator', lanes = [0], real = true, landing = 2.6 } = opts;
  const { M, T, collision, audio, scene } = ctx;
  const group = new THREE.Group(); group.name = name;
  const runs = [];

  // geometry of the run
  const dxz = new THREE.Vector2(bottom.x - top.x, bottom.z - top.z); const plan = dxz.length(); const rise = top.y - bottom.y;
  const dirXZ = dxz.clone().normalize();                     // top → bottom (downhill)
  const perp = new THREE.Vector2(-dirXZ.y, dirXZ.x);          // to the "left" when looking downhill
  const incline = Math.atan2(rise, plan); const slopeLen = Math.hypot(plan, rise);
  const riser = TREAD * Math.tan(incline);                    // step height for this incline
  const nSteps = Math.ceil(plan / TREAD) + 2;

  // shared materials
  const stepMat = new THREE.MeshStandardMaterial({ color: 0xb9bcbf, roughness: 0.55, metalness: 0.7 });
  const stepEdgeMat = M.paint(0xffd300, { roughness: 0.6, metalness: 0.1 });
  const balMat = M.stainless({ vertical: true });
  const skirtMat = M.stainless();
  const handrailTex = handrailTexture(T); const handrailMat = new THREE.MeshStandardMaterial({ map: handrailTex, color: 0xffffff, roughness: 0.85, metalness: 0.0 });
  const combMat = M.paint(0xc9c39a, { roughness: 0.5, metalness: 0.5 });
  const lightMat = M.luminaire(0xfff4e0, 2.0);
  const trussMat = M.paint(0x2c2e31, { roughness: 0.8, metalness: 0.3 });

  // step geometry: tread with a grooved surface (cleat lines) + riser; yellow demarcation lines on the tread edges
  const stepGeo = buildStepGeometry(width, TREAD, riser);
  const yellowGeo = new THREE.BoxGeometry(width, 0.004, 0.03);
  const yellowSideGeo = new THREE.BoxGeometry(0.03, 0.004, TREAD);

  for (const lane of lanes) {
    const laneGroup = new THREE.Group(); group.add(laneGroup);
    const off = new THREE.Vector3(perp.x * lane, 0, perp.y * lane);
    const topP = new THREE.Vector3(top.x, top.y, top.z).add(off), botP = new THREE.Vector3(bottom.x, bottom.y, bottom.z).add(off);
    // orient: local +Z = downhill in plan, +X = perp.
    const yaw = Math.atan2(dirXZ.x, dirXZ.y); // rotate so local +z maps to dirXZ
    laneGroup.position.copy(topP); laneGroup.rotation.y = yaw;
    // In local space: top comb at (0,0,0), bottom comb at (0,-rise,plan).

    // ---- steps
    const steps = new THREE.InstancedMesh(stepGeo, stepMat, nSteps); steps.castShadow = false; steps.receiveShadow = true; laneGroup.add(steps);
    const yl = new THREE.InstancedMesh(yellowGeo, stepEdgeMat, nSteps * 2); laneGroup.add(yl);
    const ys = new THREE.InstancedMesh(yellowSideGeo, stepEdgeMat, nSteps * 2); laneGroup.add(ys);
    let phase = 0; const mtx = new THREE.Matrix4(); const q = new THREE.Quaternion();
    const placeSteps = () => {
      for (let i = 0; i < nSteps; i++) {
        // distance along the plan of the nose of step i, wrapping. Steps live from z=-landing*0.5 (flat, top) … plan+landing*0.5 (flat, bottom)
        let s = ((i * TREAD + phase) % (plan + 2 * TREAD)) - TREAD;   // plan distance of the step nose from the top comb
        const zc = s + TREAD / 2;
        // height follows the incline in the middle and flattens over ~1.2 m at each end (real escalators have 2–3 flat steps)
        const yStep = profileY(s, plan, rise);
        mtx.makeTranslation(0, yStep, zc); steps.setMatrixAt(i, mtx);
        mtx.makeTranslation(0, yStep + 0.002, s + 0.02); yl.setMatrixAt(i * 2, mtx);
        mtx.makeTranslation(0, yStep + 0.002, s + TREAD - 0.02); yl.setMatrixAt(i * 2 + 1, mtx);
        mtx.makeTranslation(-width / 2 + 0.02, yStep + 0.002, zc); ys.setMatrixAt(i * 2, mtx);
        mtx.makeTranslation(width / 2 - 0.02, yStep + 0.002, zc); ys.setMatrixAt(i * 2 + 1, mtx);
      }
      steps.instanceMatrix.needsUpdate = true; yl.instanceMatrix.needsUpdate = true; ys.instanceMatrix.needsUpdate = true;
    };
    placeSteps();

    // ---- comb plates and landing plates (stainless, ribbed)
    for (const [z0, y0, sign] of [[0, 0, -1], [plan, -rise, 1]]) {
      const comb = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 0.03, 0.35), combMat); comb.position.set(0, y0 - 0.005, z0 + sign * 0.17); laneGroup.add(comb);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(width + 0.7, 0.02, landing), M.stainless()); plate.position.set(0, y0 - 0.008, z0 + sign * (0.35 + landing / 2)); plate.receiveShadow = true; laneGroup.add(plate);
    }

    // ---- balustrades (both sides): sloping stainless panels following the profile + the skirt + the handrail + lighting
    const balLanding = Math.min(landing, 1.0);   // balustrades/newels reach 1 m past the comb; the landing plate beyond is open on both sides
    for (const side of [-1, 1]) {
      const x = side * (width / 2 + 0.03);
      const pts = profilePoints(plan, rise, balLanding);
      // skirt (vertical panel next to the steps), 0.35 m high, follows profile
      laneGroup.add(ribbonMesh(pts, x, 0.0, 0.34, skirtMat, side));
      // balustrade panel from skirt top to handrail underside
      laneGroup.add(ribbonMesh(pts, x + side * 0.06, 0.34, BALUSTRADE_H - 0.06, balMat, side));
      // decking (top of the balustrade, under the handrail) — with continuous light strip on the inner face
      laneGroup.add(ribbonMesh(pts, x + side * 0.12, BALUSTRADE_H - 0.06, 0.06, balMat, side, true));
      // under-handrail light strip (JLE stations light the escalator from the balustrade)
      laneGroup.add(ribbonMesh(pts, x + side * 0.01, BALUSTRADE_H - 0.17, 0.02, lightMat, side));
      // handrail: a tube following the profile (torus-like extruded circle)
      const hr = tubeAlongProfile(pts, x + side * 0.12, BALUSTRADE_H + 0.02, 0.045, handrailMat); laneGroup.add(hr);
      // newel ends: the handrail curves down and back under the balustrade at each landing (semicircle in the run plane)
      for (const [z0, y0, sign] of [[pts[0].z, pts[0].y, -1], [pts[pts.length - 1].z, pts[pts.length - 1].y, 1]]) {
        const r = 0.28; const hx = x + side * 0.12; const yTop = y0 + BALUSTRADE_H + 0.02; const arc = [];
        for (let k = 0; k <= 12; k++) { const th = (k / 12) * Math.PI; arc.push(new THREE.Vector3(hx, yTop - r + Math.sin(Math.PI / 2 + th) * 0 + Math.cos(th) * r, z0 + sign * Math.sin(th) * r)); }
        // arc: from the top (theta=0 → y=yTop, z=z0) sweeping outward (z0 + sign*r) and down to (y=yTop-2r)
        const newel = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc), 24, 0.045, 10, false), handrailMat); laneGroup.add(newel);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.12, BALUSTRADE_H - 0.3, 0.5), balMat); cap.position.set(x + side * 0.06, y0 + (BALUSTRADE_H - 0.3) / 2, z0); laneGroup.add(cap);
      }
      // collision: the balustrade is a wall along the run (approximate with a chain of boxes)
      const segs = 6;
      for (let k = 0; k < segs; k++) {
        const za = -balLanding + (plan + 2 * balLanding) * k / segs, zb = -balLanding + (plan + 2 * balLanding) * (k + 1) / segs;
        const ya = profileY(za, plan, rise), yb = profileY(zb, plan, rise);
        const pa = laneGroup.localToWorld(new THREE.Vector3(x, Math.min(ya, yb) - 0.2, za)), pb = laneGroup.localToWorld(new THREE.Vector3(x + side * 0.3, Math.max(ya, yb) + 1.4, zb));
        collision.addBlocker({ xMin: Math.min(pa.x, pb.x) - 0.05, xMax: Math.max(pa.x, pb.x) + 0.05, yMin: pa.y, yMax: pb.y, zMin: Math.min(pa.z, pb.z) - 0.05, zMax: Math.max(pa.z, pb.z) + 0.05 }, name + ':balustrade');
      }
    }

    // ---- truss underside (visible from below in the box): dark panel following the profile under the steps
    const under = ribbonMesh(profilePoints(plan, rise, landing * 0.5), 0, -0.9, 0.02, trussMat, 1, false, width + 1.0, true); laneGroup.add(under);
    const sideA = ribbonMesh(profilePoints(plan, rise, landing * 0.5), -(width / 2 + 0.5), -0.9, 0.9, trussMat, -1); laneGroup.add(sideA);
    const sideB = ribbonMesh(profilePoints(plan, rise, landing * 0.5), (width / 2 + 0.5), -0.9, 0.9, trussMat, 1); laneGroup.add(sideB);

    // ---- collision: moving ramp + flat landings
    const travel = dir === 'down' ? 1 : -1;
    const v3 = new THREE.Vector3(dirXZ.x * Math.cos(incline), -Math.sin(incline) * 1, dirXZ.y * Math.cos(incline)).multiplyScalar(STEP_SPEED * travel);
    const a = laneGroup.localToWorld(new THREE.Vector3(0, 0, 0)), b = laneGroup.localToWorld(new THREE.Vector3(0, -rise, plan));
    const ramp = collision.addRamp(a, b, width + 0.15, { tag: name, sound: 'escalator', move: { x: v3.x, y: v3.y, z: v3.z } });
    const la = laneGroup.localToWorld(new THREE.Vector3(0, 0, -landing - 0.4)), lb = laneGroup.localToWorld(new THREE.Vector3(0, -rise, plan + landing + 0.4));
    collision.addFloor({ xMin: Math.min(a.x, la.x) - width / 2 - 0.4, xMax: Math.max(a.x, la.x) + width / 2 + 0.4, zMin: Math.min(a.z, la.z) - width / 2 - 0.4, zMax: Math.max(a.z, la.z) + width / 2 + 0.4, y: a.y, sound: 'metal', tag: name + ':top' });
    collision.addFloor({ xMin: Math.min(b.x, lb.x) - width / 2 - 0.4, xMax: Math.max(b.x, lb.x) + width / 2 + 0.4, zMin: Math.min(b.z, lb.z) - width / 2 - 0.4, zMax: Math.max(b.z, lb.z) + width / 2 + 0.4, y: b.y, sound: 'metal', tag: name + ':bottom' });

    // ---- sound: drive hum at the top machine chamber + a mid-run chain clatter
    const mid = laneGroup.localToWorld(new THREE.Vector3(0, -rise / 2, plan / 2));
    const emitter = audio.emitter({ position: mid, synth: 'escalator', params: { speed: 1 }, gain: 0.5, refDistance: 3, maxDistance: 45 });
    const topEm = audio.emitter({ position: a.clone(), synth: 'hum', params: { freq: 60, level: 0.25 }, gain: 0.35, refDistance: 2, maxDistance: 18 });

    const run = { lane, ramp, emitter, topEmitter: topEm, from: a, to: b, group: laneGroup, speedMul: 1 };
    runs.push(run);

    // animation
    ctx.onUpdate(dt => {
      if (run.speedMul === 0) return;
      phase = (phase + travel * STEP_SPEED * Math.cos(incline) * dt * run.speedMul + (plan + 2 * TREAD)) % (plan + 2 * TREAD);
      placeSteps();
      handrailTex.offset.y = (handrailTex.offset.y - travel * STEP_SPEED * dt * run.speedMul / 0.5) % 1;   // texture tiles every 0.5 m
    });
  }

  function stop() { for (const r of runs) { r.speedMul = 0; r.ramp.move = null; r.emitter.stop(); } }
  function start() { for (const r of runs) { r.speedMul = 1; const v = runs[0].ramp.move; r.emitter.play(); } }

  scene.add(group);
  return { group, runs, stop, start, incline, plan, rise };
}

/** Profile height (local y, top comb = 0) at plan distance s from the top comb; flat over `flat` at each end. */
function profileY(s, plan, rise) {
  const flat = 1.2; // metres of flat steps at each landing
  if (s <= flat) return 0;
  if (s >= plan - flat) return -rise;
  const t = (s - flat) / (plan - 2 * flat);
  // smooth transitions at the top and bottom (real escalators use a radius, here a short blend)
  const ease = t < 0.08 ? (t / 0.08) * (t / 0.08) * 0.08 / 2 + 0 : t;
  return -rise * smoothTransition(t);
}
function smoothTransition(t) { // linear in the middle, gentle curvature in the first/last 8%
  const k = 0.08; if (t < k) return (t * t) / (2 * k) * (1 / (1 - k)); if (t > 1 - k) { const u = 1 - t; return 1 - (u * u) / (2 * k) * (1 / (1 - k)); } return (t - k / 2) / (1 - k); }

function profilePoints(plan, rise, landing) {
  const pts = []; const n = 40;
  for (let i = 0; i <= n; i++) { const z = -landing + (plan + 2 * landing) * i / n; pts.push(new THREE.Vector3(0, profileY(Math.min(plan, Math.max(0, z)), plan, rise), z)); }
  return pts;
}

/** A vertical ribbon (panel) following profile points at lateral offset x, from height h0 to h0+h. side is used for normal direction. */
function ribbonMesh(pts, x, h0, h, material, side, horizontal = false, width = 0, flipNormal = false) {
  const pos = [], uv = [], idx = [];
  pts.forEach((p, i) => {
    if (!horizontal) { pos.push(x, p.y + h0, p.z, x, p.y + h0 + h, p.z); uv.push(p.z, 0, p.z, h); }
    else { pos.push(x - width / 2, p.y + h0, p.z, x + width / 2, p.y + h0, p.z); uv.push(0, p.z, width, p.z); }
    if (i > 0) { const b = (i - 1) * 2; if (side > 0 !== flipNormal) idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); else idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, material); m.material = material; m.castShadow = false; m.receiveShadow = true;
  // ensure double sided for thin panels
  if (!material.userData._ds) { material.side = THREE.DoubleSide; material.userData._ds = true; }
  return m;
}

function tubeAlongProfile(pts, x, h, radius, material) {
  const path = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(x, p.y + h, p.z)), false, 'catmullrom', 0.1);
  const g = new THREE.TubeGeometry(path, Math.max(8, pts.length * 2), radius, 10, false);
  // remap v so the texture tiles per metre along the tube
  const len = path.getLength(); const uvA = g.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getY(i) * 1.0, uvA.getX(i) * len);
  const m = new THREE.Mesh(g, material); m.castShadow = true; return m;
}

function buildStepGeometry(width, tread, riser) {
  // tread: thin box with cleat grooves (via normal map-free colour stripes baked as geometry: alternate raised strips)
  const geos = [];
  const treadG = new THREE.BoxGeometry(width, 0.02, tread); treadG.translate(0, -0.01, 0); geos.push(treadG);
  const riserG = new THREE.BoxGeometry(width, riser, 0.02); riserG.translate(0, -riser / 2 - 0.02, tread / 2 - 0.01); geos.push(riserG);
  // cleats: 8 mm raised ribs across the tread (longitudinal)
  const n = Math.floor(width / 0.018);
  for (let i = 0; i < n; i += 2) { const c = new THREE.BoxGeometry(0.009, 0.006, tread - 0.02); c.translate(-width / 2 + (i + 0.5) * 0.018, 0.003, 0); geos.push(c); }
  return mergeGeometries(geos);
}

function mergeGeometries(geos) {
  // minimal merge (positions/normals/uvs, non-indexed)
  let total = 0; const parts = geos.map(g => g.toNonIndexed()); parts.forEach(g => total += g.attributes.position.count);
  const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3), uv = new Float32Array(total * 2); let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nrm.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return out;
}

function handrailTexture(T) {
  const c = T.canvas(64, 256); const ctx = c.getContext('2d');
  ctx.fillStyle = '#141414'; ctx.fillRect(0, 0, 64, 256);
  // faint seam line + subtle wear marks so movement is visible
  ctx.fillStyle = '#1e1e1e'; ctx.fillRect(28, 0, 8, 256);
  for (let i = 0; i < 12; i++) { ctx.fillStyle = `rgba(60,60,60,${0.15 + Math.random() * 0.2})`; ctx.fillRect(Math.random() * 64, Math.random() * 256, 6, 2); }
  const t = T.toTexture(c, { repeat: [1, 1] }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
