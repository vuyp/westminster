// ---------------------------------------------------------------------------
// collision.js — walkable surfaces + blockers for the first-person player.
//
// Floors:  { kind:'flat', xMin,xMax,zMin,zMax, y, tag, sound }  — a horizontal slab
//          { kind:'ramp', ax,az,bx,bz, ya,yb, halfWidth, tag, sound, move } — a sloped strip from A to B
//            (`move` = {x,y,z} velocity in m/s applied to whoever stands on it: escalators, moving walkways)
// Blockers: THREE.Box3 in world space. The player capsule is pushed out horizontally when its body
//           (from feet + stepHeight to head) overlaps the box.
// A coarse XZ grid keeps lookups cheap even with thousands of entries.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const CELL = 8;

export class Collision {
  constructor() {
    this.floors = [];
    this.blockers = [];
    this.grid = new Map(); // "cx,cz" -> { floors: [], blockers: [] }
    this._box = new THREE.Box3();
  }

  _cellsFor(xMin, zMin, xMax, zMax, fn) {
    const cx0 = Math.floor(xMin / CELL), cx1 = Math.floor(xMax / CELL), cz0 = Math.floor(zMin / CELL), cz1 = Math.floor(zMax / CELL);
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
      const k = cx + ',' + cz; let cell = this.grid.get(k);
      if (!cell) { cell = { floors: [], blockers: [] }; this.grid.set(k, cell); }
      fn(cell);
    }
  }

  /** Flat walkable slab. Accepts {xMin,xMax,zMin,zMax,y} or a THREE.Box3 / Mesh (top face becomes the floor). */
  addFloor(spec) {
    let f;
    if (spec instanceof THREE.Object3D) { spec.updateWorldMatrix(true, false); const b = new THREE.Box3().setFromObject(spec); f = { xMin: b.min.x, xMax: b.max.x, zMin: b.min.z, zMax: b.max.z, y: b.max.y, tag: spec.name }; }
    else if (spec instanceof THREE.Box3) f = { xMin: spec.min.x, xMax: spec.max.x, zMin: spec.min.z, zMax: spec.max.z, y: spec.max.y };
    else f = { ...spec };
    f.kind = 'flat'; f.sound = f.sound || 'hard';
    this.floors.push(f);
    this._cellsFor(f.xMin, f.zMin, f.xMax, f.zMax, c => c.floors.push(f));
    return f;
  }

  /** Sloped strip from a (x,y,z) to b (x,y,z), `width` metres wide. opts: { move: {x,y,z} | null, tag, sound } */
  addRamp(a, b, width, opts = {}) {
    const f = { kind: 'ramp', ax: a.x, az: a.z, bx: b.x, bz: b.z, ya: a.y, yb: b.y, halfWidth: width / 2, tag: opts.tag, sound: opts.sound || 'hard', move: opts.move || null, stepPitch: opts.stepPitch || 0 };
    const dx = f.bx - f.ax, dz = f.bz - f.az; f.len = Math.hypot(dx, dz) || 1e-6; f.dx = dx / f.len; f.dz = dz / f.len;
    const xs = [f.ax, f.bx], zs = [f.az, f.bz];
    this.floors.push(f);
    this._cellsFor(Math.min(...xs) - f.halfWidth, Math.min(...zs) - f.halfWidth, Math.max(...xs) + f.halfWidth, Math.max(...zs) + f.halfWidth, c => c.floors.push(f));
    return f;
  }

  /** Solid obstacle. Accepts Box3, Object3D (world bounds), or {xMin,xMax,yMin,yMax,zMin,zMax}. */
  addBlocker(spec, tag) {
    let b;
    if (spec instanceof THREE.Box3) b = spec.clone();
    else if (spec instanceof THREE.Object3D) { spec.updateWorldMatrix(true, false); b = new THREE.Box3().setFromObject(spec); }
    else b = new THREE.Box3(new THREE.Vector3(spec.xMin, spec.yMin, spec.zMin), new THREE.Vector3(spec.xMax, spec.yMax, spec.zMax));
    b.userData = { tag };
    this.blockers.push(b);
    this._cellsFor(b.min.x, b.min.z, b.max.x, b.max.z, c => c.blockers.push(b));
    return b;
  }

  /** Convenience: a thin vertical wall between two XZ points. */
  addWall(x1, z1, x2, z2, yMin, yMax, thickness = 0.3, tag) {
    const minX = Math.min(x1, x2) - thickness / 2, maxX = Math.max(x1, x2) + thickness / 2;
    const minZ = Math.min(z1, z2) - thickness / 2, maxZ = Math.max(z1, z2) + thickness / 2;
    return this.addBlocker({ xMin: minX, xMax: maxX, yMin, yMax, zMin: minZ, zMax: maxZ }, tag);
  }

  /** Remove a floor or blocker previously added (e.g. train doors). */
  remove(entry) {
    const isFloor = !!entry.kind;
    const list = isFloor ? this.floors : this.blockers; const i = list.indexOf(entry); if (i >= 0) list.splice(i, 1);
    for (const cell of this.grid.values()) { const l = isFloor ? cell.floors : cell.blockers; const j = l.indexOf(entry); if (j >= 0) l.splice(j, 1); }
  }

  _cell(x, z) { return this.grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)); }

  /** Height of a floor at (x,z), or null. */
  static heightOf(f, x, z) {
    if (f.kind === 'flat') { if (x < f.xMin || x > f.xMax || z < f.zMin || z > f.zMax) return null; return f.y; }
    const px = x - f.ax, pz = z - f.az; const along = px * f.dx + pz * f.dz; const across = -px * f.dz + pz * f.dx;
    if (along < -0.05 || along > f.len + 0.05 || Math.abs(across) > f.halfWidth) return null;
    const t = Math.min(1, Math.max(0, along / f.len));
    return f.ya + (f.yb - f.ya) * t;
  }

  /**
   * Find the best supporting floor under a point: highest floor whose height is <= feetY + stepUp and >= feetY - drop.
   * Returns { y, floor } or null.
   */
  floorAt(x, z, feetY, { stepUp = 0.4, drop = 60 } = {}) {
    const cell = this._cell(x, z); if (!cell) return null;
    let best = null, bestY = -Infinity;
    for (const f of cell.floors) {
      const y = Collision.heightOf(f, x, z); if (y == null) continue;
      if (y <= feetY + stepUp && y >= feetY - drop && y > bestY) { bestY = y; best = f; }
    }
    return best ? { y: bestY, floor: best } : null;
  }

  /** Push a capsule (centre-bottom at pos, radius r, body from pos.y+stepUp to pos.y+height) out of blockers. Mutates pos. Returns true if a collision occurred. */
  resolve(pos, r = 0.35, height = 1.75, stepUp = 0.45) {
    let hit = false;
    const cells = new Set();
    for (const dx of [-r, r]) for (const dz of [-r, r]) { const c = this._cell(pos.x + dx, pos.z + dz); if (c) cells.add(c); }
    const bodyMin = pos.y + stepUp, bodyMax = pos.y + height;
    for (const cell of cells) for (const b of cell.blockers) {
      if (b.max.y <= bodyMin || b.min.y >= bodyMax) continue;
      // closest point on box (XZ) to the circle centre
      const cx = Math.max(b.min.x, Math.min(pos.x, b.max.x)), cz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
      let dx = pos.x - cx, dz = pos.z - cz; let d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 < 1e-8) { // centre inside box: push out along the nearest face
        const push = [[pos.x - b.min.x, -1, 0], [b.max.x - pos.x, 1, 0], [pos.z - b.min.z, 0, -1], [b.max.z - pos.z, 0, 1]].sort((p, q) => p[0] - q[0])[0];
        pos.x += push[1] * (push[0] + r); pos.z += push[2] * (push[0] + r);
      } else { const d = Math.sqrt(d2); const k = (r - d) / d; pos.x += dx * k; pos.z += dz * k; }
    }
    return hit;
  }

  /** Simple XZ ray test against blockers (for NPC / interaction sanity). Returns distance or null. */
  raycastXZ(x, z, dx, dz, maxDist = 5, y = 1.2) {
    let best = null; const steps = Math.ceil(maxDist / 0.5);
    for (let i = 1; i <= steps; i++) {
      const px = x + dx * i * 0.5, pz = z + dz * i * 0.5; const cell = this._cell(px, pz); if (!cell) continue;
      for (const b of cell.blockers) if (px >= b.min.x && px <= b.max.x && pz >= b.min.z && pz <= b.max.z && y >= b.min.y && y <= b.max.y) { best = i * 0.5; return best; }
    }
    return best;
  }
}
