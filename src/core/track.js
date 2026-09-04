// ---------------------------------------------------------------------------
// track.js — track centreline curves with arc-length parametrisation.
// Trains, rails and NPC paths use `Track.frameAt(s)` where s = metres along the track.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

export class Track {
  constructor(def) {
    this.def = def;
    this.points = def.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    this.curve = new THREE.CatmullRomCurve3(this.points, false, 'centripetal', 0.5);
    this.curve.arcLengthDivisions = 4000;
    this.length = this.curve.getLength();
    this.curve.getLengths(4000);
    // distance along the track of the platform stopping point (train centre)
    const pc = def.platformCentre ? new THREE.Vector3(...def.platformCentre) : null;
    this.stopS = pc ? this.nearestS(pc) : this.length / 2;
    this._up = new THREE.Vector3(0, 1, 0);
  }

  /** Point at s metres from the start. */
  pointAt(s, target = new THREE.Vector3()) {
    const u = Math.min(1, Math.max(0, s / this.length));
    return this.curve.getPointAt(u, target);
  }

  /** Unit tangent at s. */
  tangentAt(s, target = new THREE.Vector3()) {
    const u = Math.min(1, Math.max(0, s / this.length));
    return this.curve.getTangentAt(u, target).normalize();
  }

  /** Position + quaternion for an object whose local -Z axis points FORWARD along the track (direction of increasing s); local +X is to the right of travel. */
  frameAt(s, target = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), tangent: new THREE.Vector3() }) {
    this.pointAt(s, target.position); this.tangentAt(s, target.tangent);
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), target.tangent, this._up);
    target.quaternion.setFromRotationMatrix(m);
    return target;
  }

  /** Brute-force nearest arc-length to a world point (coarse then refined). */
  nearestS(p) {
    let bestS = 0, bestD = Infinity; const n = 800;
    const tmp = new THREE.Vector3();
    for (let i = 0; i <= n; i++) { const s = this.length * i / n; this.pointAt(s, tmp); const d = tmp.distanceToSquared(p); if (d < bestD) { bestD = d; bestS = s; } }
    const step = this.length / n;
    for (let s = bestS - step; s <= bestS + step; s += step / 50) { this.pointAt(s, tmp); const d = tmp.distanceToSquared(p); if (d < bestD) { bestD = d; bestS = s; } }
    return bestS;
  }

  /** Sample the track every `ds` metres; returns [{s, position, tangent}] — used to lay rails/sleepers/tunnel rings. */
  samples(ds = 1, sMin = 0, sMax = this.length) {
    const out = [];
    for (let s = sMin; s <= sMax; s += ds) out.push({ s, position: this.pointAt(s), tangent: this.tangentAt(s) });
    return out;
  }
}

/**
 * Build rail geometry along a track section as a single merged mesh: two rails (I-section approximated by boxes),
 * concrete sleepers / slab track, and the tunnel invert. Returns a THREE.Group.
 */
export function buildTrackMesh(track, { sMin = 0, sMax = track.length, gauge = 1.435, railMaterial, sleeperMaterial, ballastMaterial, sleepers = true, thirdFourthRail = true, step = 0.6, railHeight = 0.152 } = {}) {
  const group = new THREE.Group(); group.name = 'track';
  const railGeo = new THREE.BoxGeometry(0.07, railHeight, step + 0.01);
  const headGeo = new THREE.BoxGeometry(0.075, 0.04, step + 0.01);
  const sleeperGeo = new THREE.BoxGeometry(2.5, 0.15, 0.25);
  const conRailGeo = new THREE.BoxGeometry(0.12, 0.08, step + 0.01);
  const count = Math.max(1, Math.floor((sMax - sMin) / step));
  const rails = new THREE.InstancedMesh(railGeo, railMaterial, count * 2);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xb9bcbf, roughness: 0.25, metalness: 0.95 }), count * 2);
  const conRails = thirdFourthRail ? new THREE.InstancedMesh(conRailGeo, railMaterial, count * 2) : null;
  const sl = sleepers ? new THREE.InstancedMesh(sleeperGeo, sleeperMaterial, count) : null;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), t = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const frame = { position: pos, quaternion: q, tangent: t };
  let i = 0;
  for (let k = 0; k < count; k++) {
    const s = sMin + (k + 0.5) * step; track.frameAt(s, frame);
    side.crossVectors(up, t).normalize();
    for (const sgn of [-1, 1]) {
      const p = pos.clone().addScaledVector(side, sgn * gauge / 2); p.y += railHeight / 2;
      m.compose(p, q, new THREE.Vector3(1, 1, 1)); rails.setMatrixAt(i, m);
      const ph = p.clone(); ph.y += railHeight / 2; m.compose(ph, q, new THREE.Vector3(1, 1, 1)); heads.setMatrixAt(i, m);
      if (conRails) { // positive (4th) rail centre, negative (3rd) outside: LU four-rail system
        const pc = sgn < 0 ? pos.clone().addScaledVector(side, -gauge / 2 - 0.4) : pos.clone(); pc.y += (sgn < 0 ? 0.24 : 0.09);
        m.compose(pc, q, new THREE.Vector3(1, 1, 1)); conRails.setMatrixAt(i, m);
      }
      i++;
    }
    if (sl) { const ps = pos.clone(); ps.y -= 0.075; m.compose(ps, q, new THREE.Vector3(1, 1, 1)); sl.setMatrixAt(k, m); }
  }
  rails.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
  rails.castShadow = heads.castShadow = false; rails.receiveShadow = true;
  group.add(rails, heads);
  if (conRails) { conRails.instanceMatrix.needsUpdate = true; group.add(conRails); }
  if (sl) { sl.instanceMatrix.needsUpdate = true; sl.receiveShadow = true; group.add(sl); }
  if (ballastMaterial) {
    // continuous invert / ballast strip as a ribbon
    const pts = track.samples(4, sMin, sMax);
    const positions = [], uvs = [], idx = [];
    pts.forEach((p, k) => {
      side.crossVectors(up, p.tangent).normalize();
      const l = p.position.clone().addScaledVector(side, -1.6), r = p.position.clone().addScaledVector(side, 1.6); l.y -= 0.16; r.y -= 0.16;
      positions.push(l.x, l.y, l.z, r.x, r.y, r.z); uvs.push(0, p.s / 4, 1, p.s / 4);
      if (k > 0) { const b = (k - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx); g.computeVertexNormals();
    const ribbon = new THREE.Mesh(g, ballastMaterial); ribbon.receiveShadow = true; group.add(ribbon);
  }
  return group;
}
