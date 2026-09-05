// ---------------------------------------------------------------------------
// ticketGate.js — a Cubic-style pneumatic paddle gateline (dossier §4.3):
// brushed-stainless cabinets c. 1.9 × 0.30 m, 1.0 m high with a black top plate,
// glass paddles that fold back into the cabinet, yellow Oyster reader disc on a
// raised black sloped housing at c. 0.95 m, a small colour LCD, magnetic ticket
// slot, end-face green-arrow / red-cross indicators, one wide-aisle gate with
// taller paddles, glass screens between gates, and a glazed staff booth.
//
//   createGateline(ctx, { from:[x,z], to:[x,z], count, wideIndex, y, columns, parent, S, signMat, mats })
//   → { group, gates:[{ index, position, open(), close(), isOpen, direction, wide }], ends:{nw,se}, line, booth }
//
// Gate i is centred at ((i + 0.5) * len / count) along from → to — the same rule the NPC
// system uses (npcGraph.gateCentre) — so passengers walk through real gates. Each gate is
// ctx.interactive: "E — touch in with your Oyster card" beeps, opens the paddles (their
// blocker is removed) for ~5 s and closes them again. Registered by the ticket hall as 'gates'.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { Merger, glassScreen, wallSign } from '../world/ticketHallKit.js';

const CAB_L = 1.9, CAB_W = 0.3, CAB_H = 1.0, AISLE = 0.7, WIDE_AISLE = 1.0;
const OPEN_SECONDS = 5.0;

export function createGateline(ctx, opts) {
  const { from, to, count = 15, wideIndex = 0, y, columns = [], parent, S, signMat, mats } = opts;
  const { collision, audio } = ctx;
  const group = new THREE.Group(); group.name = 'gateline'; parent.add(group);
  const merger = new Merger(group);

  // ---- line geometry (identical to npcGraph.GATELINE)
  const A = new THREE.Vector2(from[0], from[1]), B = new THREE.Vector2(to[0], to[1]);
  const dir = B.clone().sub(A); const len = dir.length(); dir.divideScalar(len);
  const normal = new THREE.Vector2(dir.y, -dir.x); if (normal.x + (-normal.y) < 0) normal.negate();   // → north-east = paid side
  const pitch = len / count;
  const yaw = Math.atan2(-dir.y, dir.x);            // rotation.y mapping local +x → dir; local +z → -normal (unpaid side)
  const at = (along, across = 0) => ({ x: A.x + dir.x * along + normal.x * across, z: A.y + dir.y * along + normal.y * across });

  // ---- shared materials / geometry
  const mCab = mats.stainless, mTop = mats.black, mGlass = mats.paddleGlass, mYellow = mats.yellow;
  const readerFace = signMat(S.oysterDisc(), { emissive: 0.9, transparent: true });
  const lcdMat = signMat(S.readerLCD('ENTER'), { emissive: 1.2 });
  const greenMat = signMat(S.greenArrow(), { emissive: 1.4 }), redMat = signMat(S.redCross(), { emissive: 1.4 });
  const paddleGeo = new THREE.BoxGeometry(1, 1, 0.018);   // scaled per gate

  const gates = []; const animating = new Set();
  const gateAlongs = [];
  for (let i = 0; i < count; i++) {
    let along = (i + 0.5) * pitch; const wide = i === wideIndex; const aisle = wide ? WIDE_AISLE : AISLE; const halfSpan = aisle / 2 + CAB_W;
    // a column on the line? slide this gate along the line until its cabinets clear it (the SE end of the contract line
    // runs into the 2 m box column at x 11.8 / z -16)
    const clear = (a) => columns.every(c => { for (const sx of [-halfSpan, -aisle / 2, aisle / 2, halfSpan]) for (const sz of [-CAB_L / 2, CAB_L / 2]) { const p = at(a + sx, sz); if (Math.hypot(p.x - c.x, p.z - c.z) < c.r + 0.08) return false; } return true; });
    let guard = 0; while (!clear(along) && guard++ < 200) along += 0.05;
    gateAlongs.push(along);
    const c = at(along); const g = new THREE.Group(); g.position.set(c.x, y, c.z); g.rotation.y = yaw; group.add(g);
    const direction = wide ? 'both' : (i % 2 === 0 ? 'entry' : 'exit');   // entry = walking from the unpaid side (local +z) to the paid side (local -z)
    const gm = new Merger(g);
    // cabinets either side of the aisle
    for (const s of [-1, 1]) {
      const cx = s * (aisle / 2 + CAB_W / 2);
      gm.box(mCab, CAB_W, CAB_H - 0.03, CAB_L, { x: cx, y: (CAB_H - 0.03) / 2, z: 0 }, true);
      gm.box(mTop, CAB_W + 0.01, 0.03, CAB_L + 0.01, { x: cx, y: CAB_H - 0.015, z: 0 }, false);
      gm.box(mats.black, CAB_W + 0.02, 0.06, CAB_L + 0.02, { x: cx, y: 0.03, z: 0 }, false);   // kick plate
      // paddle slot line (dark groove where the leaf folds away)
      gm.box(mats.black, 0.01, 0.9, 0.05, { x: cx - s * (CAB_W / 2 - 0.004), y: 0.55, z: 0.1 }, false);
      // end-face indicators (150 mm LED signs): entry face (+z) and exit face (-z)
      const entryOK = direction !== 'exit', exitOK = direction !== 'entry';
      gm.quad(entryOK ? greenMat : redMat, 0.14, 0.14, { x: cx, y: 0.86, z: CAB_L / 2 + 0.002, ry: 0 });
      gm.quad(exitOK ? greenMat : redMat, 0.14, 0.14, { x: cx, y: 0.86, z: -CAB_L / 2 - 0.002, ry: Math.PI });
    }
    // readers: on the right-hand cabinet as you approach, near the approach end; sloped black housing + yellow disc + LCD + ticket slot
    const readerAt = (side, zEnd) => {   // side = +1 (+x cabinet) / -1; zEnd = +1 approach from +z
      const cx = side * (aisle / 2 + CAB_W / 2); const cz = zEnd * (CAB_L / 2 - 0.35);
      gm.box(mats.black, 0.26, 0.08, 0.34, { x: cx, y: CAB_H + 0.035, z: cz, rx: zEnd * 0.28 }, false);   // sloped towards the approaching passenger
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.058, 24), readerFace); disc.rotation.x = -Math.PI / 2 + zEnd * 0.28; disc.position.set(cx, CAB_H + 0.087, cz + zEnd * 0.07); g.add(disc);
      const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.07), lcdMat); lcd.rotation.x = -Math.PI / 2 + zEnd * 0.28; lcd.position.set(cx, CAB_H + 0.095, cz - zEnd * 0.1); g.add(lcd);
      gm.box(mats.black, 0.12, 0.012, 0.03, { x: cx, y: CAB_H + 0.02, z: cz + zEnd * 0.28 }, false);   // magnetic ticket slot
      gm.box(mYellow, 0.02, 0.012, 0.03, { x: cx + 0.05, y: CAB_H + 0.021, z: cz + zEnd * 0.28 }, false);
    };
    if (direction !== 'exit') readerAt(1, 1);
    if (direction !== 'entry') readerAt(-1, -1);
    gm.flush({ name: 'gate-' + i });
    // paddles: two glass leaves hinged on the cabinet faces, meeting in the middle; taller on the wide gate
    const leafH = wide ? 1.2 : 0.9, leafY0 = wide ? 0.12 : 0.15; const halfLeaf = aisle / 2 + 0.01;
    const leaves = [];
    for (const s of [-1, 1]) {
      const hinge = new THREE.Group(); hinge.position.set(s * aisle / 2, leafY0 + leafH / 2, 0.1); g.add(hinge);
      const leaf = new THREE.Mesh(paddleGeo, mGlass); leaf.scale.set(halfLeaf, leafH, 1); leaf.position.x = -s * halfLeaf / 2; hinge.add(leaf);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.02, leafH, 0.03), mats.black); edge.position.x = -s * (halfLeaf - 0.01); hinge.add(edge);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, leafH + 0.02, 8), mats.black); hinge.add(hub);
      leaves.push({ hinge, side: s });
    }
    // collision: cabinet blockers inset (aisle clearance for the 0.33 m player capsule) and segmented (rotated AABBs), plus a paddle blocker
    const seg = 8; const inset = 0.12;   // fine segments keep the rotated AABBs out of the aisle; blockers end at the cabinet face (never into the neighbouring aisle)
    for (const s of [-1, 1]) for (let k = 0; k < seg; k++) {
      const z0 = -CAB_L / 2 + (CAB_L / seg) * k, z1 = z0 + CAB_L / seg; const x0 = s * (aisle / 2 + inset), x1 = s * (aisle / 2 + CAB_W + 0.02);
      const pts = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([lx, lz]) => g.localToWorld(new THREE.Vector3(lx, 0, lz)));
      const bb = new THREE.Box3().setFromPoints(pts); bb.min.y = y; bb.max.y = y + CAB_H; collision.addBlocker(bb, 'gate:cabinet');
    }
    const paddleBox = () => { const pts = [[-aisle / 2, 0.02], [aisle / 2, 0.02], [-aisle / 2, 0.18], [aisle / 2, 0.18]].map(([lx, lz]) => g.localToWorld(new THREE.Vector3(lx, 0, lz))); const bb = new THREE.Box3().setFromPoints(pts); bb.min.y = y; bb.max.y = y + 1.3; return collision.addBlocker(bb, 'gate:paddle'); };
    const gate = {
      index: i, wide, direction, group: g, position: new THREE.Vector3(c.x, y, c.z), along, isOpen: false, blocker: paddleBox(), t: 0, timer: 0, state: 'closed',
      open({ npc = false } = {}) {
        if (gate.state === 'open' || gate.state === 'opening') { gate.timer = OPEN_SECONDS; return; }
        gate.state = 'opening'; gate.timer = OPEN_SECONDS; animating.add(gate);
        if (gate.blocker) { collision.remove(gate.blocker); gate.blocker = null; }
        if (audio && audio.ready) { const p = gate.position.clone().setY(y + 1); if (!npc) audio.play('gateBeep', { position: p, gain: 0.55, refDistance: 2, maxDistance: 25, params: { count: 1 } }); setTimeout(() => { try { audio.play('gatePaddle', { position: p, gain: 0.6, refDistance: 2, maxDistance: 25 }); } catch (e) { /* ignore */ } }, 220); }
      },
      close() { if (gate.state === 'closed' || gate.state === 'closing') return; gate.state = 'closing'; animating.add(gate); if (audio && audio.ready) audio.play('gatePaddle', { position: gate.position.clone().setY(y + 1), gain: 0.35, refDistance: 2, maxDistance: 20 }); },
      leaves,
    };
    gates.push(gate);
    ctx.interactive(g, { prompt: 'E — touch in with your Oyster card', distance: 2.4, onInteract: () => gate.open({ npc: false }) });
  }

  // ---- paddle animation (one update for all gates)
  ctx.onUpdate(dt => {
    for (const gate of animating) {
      if (gate.state === 'opening') { gate.t = Math.min(1, gate.t + dt / 0.32); if (gate.t >= 1) gate.state = 'open'; }
      else if (gate.state === 'open') { gate.timer -= dt; if (gate.timer <= 0) gate.close(); }
      else if (gate.state === 'closing') { gate.t = Math.max(0, gate.t - dt / 0.5); if (gate.t <= 0) { gate.state = 'closed'; if (!gate.blocker) gate.blocker = (() => { const g = gate.group; const aisle = gate.wide ? WIDE_AISLE : AISLE; const pts = [[-aisle / 2, 0.02], [aisle / 2, 0.02], [-aisle / 2, 0.18], [aisle / 2, 0.18]].map(([lx, lz]) => g.localToWorld(new THREE.Vector3(lx, 0, lz))); const bb = new THREE.Box3().setFromPoints(pts); bb.min.y = y; bb.max.y = y + 1.3; return collision.addBlocker(bb, 'gate:paddle'); })(); animating.delete(gate); } }
      gate.isOpen = gate.state === 'open' || gate.state === 'opening';
      const e = gate.t < 0.5 ? 2 * gate.t * gate.t : 1 - Math.pow(-2 * gate.t + 2, 2) / 2;   // ease in-out
      for (const l of gate.leaves) l.hinge.rotation.y = -l.side * e * Math.PI / 2;
    }
  });

  // ---- glass screens between gates (the contract line is much longer than 15 cabinets) and at the NW end
  const outer = (i, s) => gateAlongs[i] + s * ((gates[i].wide ? WIDE_AISLE : AISLE) / 2 + CAB_W);
  for (let i = 0; i + 1 < count; i++) {
    const a0 = outer(i, 1), a1 = outer(i + 1, -1); if (a1 - a0 < 0.12) continue;
    const pa = at(a0), pb = at(a1); glassScreen(merger, mats, collision, pa, pb, y, { height: 1.05, kick: true, post: 1.6, tag: 'gate:screen' });
    // top rail sign every few gaps: 'Please have your ticket or card ready' / keep left
  }
  // ---- staff booth at the SE end: glazed 2.4 × 1.6 m, desk, door on the paid side, 'Gateline assistance'
  const seAlong = outer(count - 1, 1); const boothA0 = seAlong + 0.25, boothA1 = boothA0 + 2.4; const bc = at((boothA0 + boothA1) / 2, 0);
  {
    const bg = new THREE.Group(); bg.position.set(bc.x, y, bc.z); bg.rotation.y = yaw; group.add(bg); const bm = new Merger(bg);
    bm.box(mats.stainless, 2.4, 0.9, 1.6, { x: 0, y: 0.45, z: 0 }, false);                                    // solid dado
    bm.box(mats.glass, 2.36, 1.2, 1.56, { x: 0, y: 1.5, z: 0 }, false);                                       // glazing
    bm.box(mats.stainless, 2.5, 0.12, 1.7, { x: 0, y: 2.16, z: 0 }, false);                                    // roof/fascia
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bm.box(mats.stainless, 0.07, 2.2, 0.07, { x: sx * 1.17, y: 1.1, z: sz * 0.77 }, false);
    bm.box(mats.black, 1.6, 0.04, 0.5, { x: 0, y: 0.95, z: 0.3 }, false);                                     // desk top (unpaid side counter)
    bm.box(mats.black, 0.4, 0.3, 0.05, { x: -0.4, y: 1.25, z: 0.2, ry: 0.3 }, false);                         // monitor
    bm.box(mats.black, 0.02, 2.0, 0.7, { x: -1.19, y: 1.0, z: -0.4 }, false);                                  // door (paid side, west end)
    wallSign(bm, mats, signMat(S.gatelineAssist(), { emissive: 0.6 }), 1.2, 0.3, { x: 0, y: 1.98, z: 0.82, ry: 0, depth: 0.01 });
    bm.flush({ name: 'gate-booth' });
    const pts = [[-1.25, -0.85], [1.25, -0.85], [-1.25, 0.85], [1.25, 0.85]].map(([lx, lz]) => bg.localToWorld(new THREE.Vector3(lx, 0, lz))); const bb = new THREE.Box3().setFromPoints(pts); bb.min.y = y; bb.max.y = y + 2.3; collision.addBlocker(bb, 'gate:booth');
    // link screen between the last gate and the booth
    glassScreen(merger, mats, collision, at(seAlong), at(boothA0), y, { height: 1.05, kick: true, post: 3, tag: 'gate:screen' });
  }
  merger.flush({ name: 'gateline-screens' });

  return { group, gates, line: { from: A, to: B, dir, normal, len, pitch, yaw, at }, ends: { nw: at(outer(0, -1)), nwAlong: outer(0, -1), se: at(boothA1), seAlong: boothA1 }, booth: { centre: bc, along: (boothA0 + boothA1) / 2 } };
}
