// ---------------------------------------------------------------------------
// player.js — first-person passenger: pointer-lock look, WASD walk/run, gravity,
// stairs & ramps, riding escalators, riding trains (attached to a moving frame),
// footsteps, head-bob, zone detection and E-to-interact.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { ZONES, SPAWN } from '../core/layout.js';

const EYE = 1.68, RADIUS = 0.33, HEIGHT = 1.78, WALK = 2.1, RUN = 4.2, STEP_UP = 0.42, GRAVITY = 18;

export class Player {
  constructor({ camera, collision, audio, hud, ctx, domElement, noLock = false }) {
    this.camera = camera; this.collision = collision; this.audio = audio; this.hud = hud; this.ctx = ctx; this.dom = domElement;
    this.pos = new THREE.Vector3(...SPAWN.position);   // feet position (world)
    this.yaw = 0; this.pitch = 0; this.vy = 0; this.grounded = true; this.floor = null;
    this.keys = {}; this.locked = false; this.noLock = noLock; this.enabled = false;
    this.bob = 0; this.stepDist = 0; this.zone = null; this.train = null; this.local = new THREE.Vector3(); this.localYaw = 0;
    this.velocity = new THREE.Vector3(); this.crouch = false; this.frozen = false; this.speedMul = 1;
    this.lookTarget = null; this._ray = new THREE.Raycaster(); this._ray.far = 3.5; this.lastInteract = null;
    this.seated = null;
    this._bindInput();
    this.lookAt(new THREE.Vector3(...SPAWN.lookAt));
    this.updateCamera(0);
  }

  lookAt(target) {
    const eye = this.pos.clone(); eye.y += EYE; const d = target.clone().sub(eye);
    this.yaw = Math.atan2(-d.x, -d.z); this.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  }

  teleport(x, y, z, yawDeg = null, pitchDeg = null) {
    this.detachTrain(); this.pos.set(x, y, z); this.vy = 0; this.seated = null;
    if (yawDeg != null) this.yaw = THREE.MathUtils.degToRad(yawDeg); if (pitchDeg != null) this.pitch = THREE.MathUtils.degToRad(pitchDeg);
    this.updateCamera(0);
  }

  _bindInput() {
    const d = this.dom;
    window.addEventListener('keydown', e => { if (e.code === 'Tab') e.preventDefault(); this.keys[e.code] = true; if (e.code === 'KeyE') this._interact(); if (e.code === 'KeyC') this.crouch = !this.crouch; });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
    const onMove = e => {
      if (!this.locked && !this.noLock) return; if (!this.enabled) return;
      const mx = e.movementX || 0, my = e.movementY || 0;
      this.yaw -= mx * 0.0022; this.pitch -= my * 0.0022; this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === d; if (this.hud) this.hud.setPaused(!this.locked && !this.noLock); });
    // touch look (mobile): drag right half to look, left half virtual joystick
    let touchLook = null, touchMove = null;
    d.addEventListener('touchstart', e => { for (const t of e.changedTouches) { if (t.clientX > innerWidth / 2) touchLook = { id: t.identifier, x: t.clientX, y: t.clientY }; else touchMove = { id: t.identifier, x: t.clientX, y: t.clientY, dx: 0, dy: 0 }; } }, { passive: true });
    d.addEventListener('touchmove', e => { for (const t of e.changedTouches) { if (touchLook && t.identifier === touchLook.id) { this.yaw -= (t.clientX - touchLook.x) * 0.005; this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch - (t.clientY - touchLook.y) * 0.005)); touchLook.x = t.clientX; touchLook.y = t.clientY; } if (touchMove && t.identifier === touchMove.id) { touchMove.dx = (t.clientX - touchMove.x) / 60; touchMove.dy = (t.clientY - touchMove.y) / 60; } } }, { passive: true });
    d.addEventListener('touchend', e => { for (const t of e.changedTouches) { if (touchLook && t.identifier === touchLook.id) touchLook = null; if (touchMove && t.identifier === touchMove.id) touchMove = null; } }, { passive: true });
    this._touch = () => touchMove;
  }

  requestLock() { if (this.noLock) { this.enabled = true; return; } try { this.dom.requestPointerLock(); } catch (e) {} this.enabled = true; }

  /** Attach to a train: subsequent movement happens in the train's local frame. */
  attachTrain(train) {
    if (this.train === train) return;
    this.train = train; train.group.updateWorldMatrix(true, false);
    this.local.copy(this.pos); train.group.worldToLocal(this.local);
    const q = train.group.getWorldQuaternion(new THREE.Quaternion()); const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    this.localYaw = this.yaw - e.y; this.vy = 0; this.zone = null;
  }
  detachTrain() {
    if (!this.train) return; const t = this.train; this.train = null; this.seated = null;
    const q = t.group.getWorldQuaternion(new THREE.Quaternion()); const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    this.yaw = this.localYaw + e.y; this.pos.copy(t.group.localToWorld(this.local.clone())); this.vy = 0;
  }

  get moveInput() {
    const k = this.keys; let f = 0, s = 0;
    if (k.KeyW || k.ArrowUp) f += 1; if (k.KeyS || k.ArrowDown) f -= 1; if (k.KeyD || k.ArrowRight) s += 1; if (k.KeyA || k.ArrowLeft) s -= 1;
    const t = this._touch(); if (t) { f -= Math.max(-1, Math.min(1, t.dy)); s += Math.max(-1, Math.min(1, t.dx)); }
    const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
    return { f, s, run: !!(k.ShiftLeft || k.ShiftRight) };
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    if (this.frozen) { this.updateCamera(dt); return; }
    const { f, s, run } = this.enabled ? this.moveInput : { f: 0, s: 0, run: false };
    if (this.seated) { if (f || s) this.standUp(); else { this.updateCamera(dt); this._detectZone(); return; } }
    const speed = (run ? RUN : WALK) * this.speedMul * (this.crouch ? 0.5 : 1);
    if (this.train) this._updateOnTrain(dt, f, s, speed, run); else this._updateWorld(dt, f, s, speed, run);
    this._detectZone();
    this.updateCamera(dt);
    this._updateLook();
  }

  _updateWorld(dt, f, s, speed, run) {
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // forward is -Z rotated by yaw
    const dirX = -sin * f + cos * s, dirZ = -cos * f - sin * s;
    const moving = (f !== 0 || s !== 0);
    const prev = this.pos.clone();
    this.pos.x += dirX * speed * dt; this.pos.z += dirZ * speed * dt;
    // moving floors (escalators)
    if (this.floor && this.floor.move && this.grounded) { this.pos.x += this.floor.move.x * dt; this.pos.z += this.floor.move.z * dt; }
    // walls
    this.collision.resolve(this.pos, RADIUS, HEIGHT, STEP_UP);
    // ground
    const support = this.collision.floorAt(this.pos.x, this.pos.z, this.pos.y, { stepUp: STEP_UP, drop: 80 });
    if (support) {
      const target = support.y;
      if (this.grounded || this.pos.y <= target + 0.02) {
        // snap to floor (smoothly when stepping up)
        const dy = target - this.pos.y;
        if (dy > 0) this.pos.y += Math.min(dy, Math.max(dy * 12 * dt, 0.0));
        else if (dy > -0.6) this.pos.y = target; // walking down slopes/steps: stick to the ground
        else { this.grounded = false; }
        if (dy >= -0.6) { this.grounded = true; this.vy = 0; this.floor = support.floor; }
      }
      if (!this.grounded) { this.vy -= GRAVITY * dt; this.pos.y += this.vy * dt; if (this.pos.y <= target) { this.pos.y = target; this.vy = 0; this.grounded = true; this.floor = support.floor; this._land(); } }
    } else {
      // nothing below: fall (but never below the deepest level — safety net)
      this.grounded = false; this.floor = null; this.vy -= GRAVITY * dt; this.pos.y += this.vy * dt;
      if (this.pos.y < -60) { this.pos.copy(new THREE.Vector3(...SPAWN.position)); this.vy = 0; }
    }
    // footsteps & bob
    const moved = Math.hypot(this.pos.x - prev.x, this.pos.z - prev.z);
    const selfMoved = moving ? moved : 0;
    if (this.grounded && selfMoved > 0) {
      this.stepDist += selfMoved; const stride = run ? 1.55 : 0.72;
      if (this.stepDist > stride) { this.stepDist = 0; this._footstep(run); }
      this.bob += dt * (run ? 11 : 7.5);
    } else this.bob = 0;
    // if standing still on an escalator, keep a tiny bob for realism? no — real escalators are smooth.
    this.velocity.set((this.pos.x - prev.x) / dt, (this.pos.y - prev.y) / dt, (this.pos.z - prev.z) / dt);
  }

  _updateOnTrain(dt, f, s, speed, run) {
    const t = this.train; const q = t.group.getWorldQuaternion(new THREE.Quaternion()); const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    this.yaw = this.localYaw + e.y;
    const yawL = this.localYaw; const sin = Math.sin(yawL), cos = Math.cos(yawL);
    const dirX = -sin * f + cos * s, dirZ = -cos * f - sin * s;
    const prev = this.local.clone();
    this.local.x += dirX * speed * dt; this.local.z += dirZ * speed * dt;
    // interior collision (train-local)
    const res = t.resolveInterior ? t.resolveInterior(this.local, RADIUS, HEIGHT, STEP_UP) : null;
    this.local.y = t.floorY ?? this.local.y;
    if (res && res.exited) {
      // stepped out through an open door: return to the world
      const world = t.group.localToWorld(this.local.clone()); this.detachTrain(); this.pos.copy(world);
      const sup = this.collision.floorAt(this.pos.x, this.pos.z, this.pos.y + 0.5, { stepUp: 1, drop: 2 }); if (sup) this.pos.y = sup.y;
      return;
    }
    this.pos.copy(t.group.localToWorld(this.local.clone()));
    const moved = Math.hypot(this.local.x - prev.x, this.local.z - prev.z);
    if (moved > 0) { this.stepDist += moved; if (this.stepDist > (run ? 1.55 : 0.72)) { this.stepDist = 0; this._footstep(run, 'train'); } this.bob += dt * (run ? 11 : 7.5); } else this.bob = 0;
    this.grounded = true; this.floor = { sound: 'train' };
  }

  /** Sit on a seat: object with world position & facing yaw. */
  sit(seat) { this.seated = seat; this.hud && this.hud.prompt(null); }
  standUp() { this.seated = null; }

  _footstep(run, surfaceOverride = null) {
    const surface = surfaceOverride || (this.floor && this.floor.sound) || 'hard';
    if (this.audio && this.audio.ready) this.audio.play('footstep', { gain: run ? 0.5 : 0.32, params: { surface, run } });
  }
  _land() { if (this.audio && this.audio.ready) this.audio.play('footstep', { gain: 0.6, params: { surface: (this.floor && this.floor.sound) || 'hard', run: true } }); }

  _detectZone() {
    let z = null;
    if (this.train) z = ZONES[0];
    else {
      const p = this.pos; const py = p.y + 1.0;
      for (const zone of ZONES) { if (!zone.box) { z = zone; break; } const b = zone.box; if (p.x >= b.xMin && p.x <= b.xMax && p.z >= b.zMin && p.z <= b.zMax && py >= b.yMin && py <= b.yMax) { z = zone; break; } }
    }
    if (z !== this.zone) { this.zone = z; if (this.audio) this.audio.setZone(z.reverb); if (this.hud) this.hud.location(z.name); }
  }

  updateCamera(dt) {
    const c = this.camera;
    let eye = EYE * (this.crouch ? 0.6 : 1);
    if (this.seated) {
      c.position.copy(this.seated.position); c.position.y += 1.15;
      c.rotation.set(0, 0, 0, 'YXZ'); c.rotation.y = this.yaw; c.rotation.x = this.pitch; return;
    }
    const bobY = Math.sin(this.bob * 2) * 0.028 * (this.bob > 0 ? 1 : 0), bobX = Math.cos(this.bob) * 0.012 * (this.bob > 0 ? 1 : 0);
    c.position.set(this.pos.x, this.pos.y + eye + bobY, this.pos.z);
    if (this.train) {
      // small sway from train motion
      const sway = this.train.sway || 0; c.position.y += Math.sin(performance.now() * 0.0021) * 0.006 * sway; c.position.x += Math.sin(performance.now() * 0.0017) * 0.004 * sway;
    }
    c.rotation.set(0, 0, 0, 'YXZ'); c.rotation.y = this.yaw; c.rotation.x = this.pitch; c.rotation.z = -bobX * 0.5;
  }

  _updateLook() {
    const list = this.ctx ? this.ctx.interactables : []; if (!list.length) { return; }
    this._ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    let best = null, bestD = Infinity; const origin = this.camera.position;
    for (const o of list) {
      const info = o.userData.interactive; if (!info || o.visible === false) continue;
      const p = o.getWorldPosition(new THREE.Vector3()); const d = p.distanceTo(origin); if (d > info.distance + 1.5) continue;
      const hits = this._ray.intersectObject(o, true); if (hits.length && hits[0].distance <= info.distance && hits[0].distance < bestD) { best = o; bestD = hits[0].distance; }
    }
    if (best !== this.lookTarget) { this.lookTarget = best; if (this.hud) this.hud.prompt(best ? best.userData.interactive.prompt : null); if (best && best.userData.interactive.onLook) best.userData.interactive.onLook(); }
  }

  _interact() {
    if (this.lookTarget && this.lookTarget.userData.interactive && this.lookTarget.userData.interactive.onInteract) { this.lookTarget.userData.interactive.onInteract(this); }
  }
}
