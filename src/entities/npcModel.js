// ---------------------------------------------------------------------------
// npcModel.js — the procedural passenger: a well-proportioned low-poly humanoid
// (≈ 420 triangles) built from a handful of InstancedMeshes, one per body part.
// Every NPC is a SLOT in the pool; per-frame we compute the hierarchical limb
// transforms in JS (hip → thigh → shin → foot, torso → upper arm → forearm → hand,
// torso → head) and write them into the instance matrices. Colours are per-instance
// (skin tone, hair, coat, trousers, shoes) so the whole crowd is ~15 draw calls.
//
//   const pool = createNpcPool(ctx, { max: 200 });
//   const slot = pool.alloc(randomAppearance(rng, { tourist: 0.3, staff: false }));
//   pool.pose(slot, { x, y, z, heading, phase, gait, ...});   // every frame (or every Nth for far NPCs)
//   pool.free(slot);  pool.flush();
//
// Local frame of a person: origin between the feet on the floor, +Y up, +Z forward (the face).
// ---------------------------------------------------------------------------
import * as THREE from 'three';

// ---- proportions for a 1.75 m adult (scaled per NPC by height / 1.75) ----
export const DIM = {
  hipY: 0.93, hipHalf: 0.10,
  thigh: 0.43, shin: 0.42, ankle: 0.08,
  torso: 0.52, shoulderHalf: 0.205, shoulderY: 0.50, neck: 0.11,
  uarm: 0.30, farm: 0.27, hand: 0.10,
  headR: 0.105, headCentreY: 0.115,
};
const REF_HEIGHT = 1.75;

// ---- palettes (London, a cool weekday) ----
export const SKIN = [0xf1c8a8, 0xe8b894, 0xd9a07c, 0xc07f5a, 0x9a5f3d, 0x6e4128, 0x4a2b1c, 0xf5d5bb];
export const HAIR = [0x1c1612, 0x2b1d14, 0x3a2a1c, 0x5b3d22, 0x8a6a3c, 0xb99560, 0x8c8c8c, 0xc9c3b8, 0x7a2f14, 0x0d0b0a];
export const COATS = [0x1c2233, 0x14161a, 0x2f3238, 0x3b3f47, 0x7a6244, 0x9c7b52, 0x3f4a35, 0x5a2430, 0x243f5c, 0x1f1f24, 0x6b6e73, 0x8b1f1f, 0xd9b23a, 0xb7c2cc, 0x2a4a3a, 0x0f2a5a, 0x4a4a52, 0xe6dccb];
export const TROUSERS = [0x1f2a44, 0x141518, 0x2c2e33, 0x3a3d45, 0x6b6558, 0x1a2a4a, 0x4a4238, 0x25324a, 0x8a8478];
export const SHOES = [0x141210, 0x2a201a, 0x3b2a1e, 0xd8d6d0, 0x1a1a1e, 0x5a3b28];
const HIVIS = 0xff6a00;

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/** Deterministic random appearance. opts: { tourist: prob, staff: bool, rng } */
export function randomAppearance(rng = Math.random, { tourist = 0.2, staff = false, child = 0 } = {}) {
  const pick = a => a[Math.floor(rng() * a.length)];
  const female = rng() < 0.5;
  const isTourist = !staff && rng() < tourist;
  const isChild = !staff && rng() < child;
  const height = isChild ? 1.25 + rng() * 0.25 : female ? 1.56 + rng() * 0.16 : 1.66 + rng() * 0.22;
  const hairStyles = female ? ['long', 'long', 'bob', 'short', 'bun', 'beanie'] : ['short', 'short', 'short', 'bald', 'beanie', 'cap', 'buzz'];
  const a = {
    height, female, tourist: isTourist, staff, child: isChild,
    build: 0.9 + rng() * 0.25,                          // width multiplier
    skin: pick(SKIN), hair: pick(HAIR), hairStyle: pick(hairStyles),
    coat: staff ? 0x1c2233 : pick(COATS), trousers: staff ? 0x1c2233 : pick(TROUSERS), shoes: pick(SHOES),
    backpack: !staff && rng() < (isTourist ? 0.55 : 0.28),
    suitcase: isTourist && rng() < 0.55,
    bag: !staff && rng() < 0.22,
    phone: !staff && rng() < 0.45,                       // will use their phone when waiting / photographing
    vest: staff, hood: !staff && rng() < 0.18, scarf: rng() < 0.3 ? pick([0x8b1f1f, 0x2a4a8a, 0xd9c7a0, 0x3a3a3a]) : null,
  };
  if (a.hairStyle === 'beanie' || a.hairStyle === 'cap') a.hatColor = pick([0x1a1a1e, 0x3a3f47, 0x7a2f2f, 0x2a4a3a, 0xc9b98a]);
  return a;
}

// ---- geometry builders (all pivoted at their joint) ----
function cyl(rt, rb, h, seg = 8) { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1); g.translate(0, -h / 2, 0); return g; }
function merge(list) {
  let total = 0; const parts = list.map(g => g.index ? g.toNonIndexed() : g); parts.forEach(g => total += g.attributes.position.count);
  const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3), uv = new Float32Array(total * 2); let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nrm.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return out;
}
function sphere(r, w = 8, h = 6) { return new THREE.SphereGeometry(r, w, h); }

function buildGeometries() {
  const D = DIM; const G = {};
  // head: slightly elongated sphere, pivot at the neck base; face at +Z (u = 0.25 on a SphereGeometry)
  { const g = sphere(D.headR, 12, 9); g.scale(1, 1.16, 1.02); g.translate(0, D.headCentreY, 0.01); G.head = g; }
  // hair caps (short / long / bob / bun / beanie / cap): each a different mesh, all pivoted like the head
  const hairCap = (r, thetaLen, back = true) => { const top = new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, thetaLen); const parts = [top]; if (back) parts.push(new THREE.SphereGeometry(r, 12, 6, Math.PI * 0.95, Math.PI * 1.1, thetaLen - 0.05, Math.PI * 0.32)); const g = merge(parts); g.scale(1, 1.16, 1.02); g.translate(0, D.headCentreY, 0.005); return g; };
  G.hairShort = hairCap(D.headR + 0.006, Math.PI * 0.45);
  G.hairBuzz = hairCap(D.headR + 0.003, Math.PI * 0.42);
  { const g = hairCap(D.headR + 0.008, Math.PI * 0.5); const fall = new THREE.CylinderGeometry(D.headR + 0.006, D.headR * 0.86, 0.24, 10, 1, true, Math.PI * 0.6, Math.PI * 0.8); fall.scale(1, 1, 1.02); fall.translate(0, D.headCentreY - 0.10, 0.0); G.hairLong = merge([g, fall]); }
  { const g = hairCap(D.headR + 0.008, Math.PI * 0.45); const fall = new THREE.CylinderGeometry(D.headR * 1.0, D.headR * 1.05, 0.14, 10, 1, true, Math.PI * 0.5, Math.PI); fall.translate(0, D.headCentreY + 0.0, -0.005); G.hairBob = merge([g, fall]); }
  { const g = hairCap(D.headR + 0.006, Math.PI * 0.45); const bun = sphere(0.04, 7, 5); bun.translate(0, D.headCentreY + 0.07, -0.09); G.hairBun = merge([g, bun]); }
  { const g = new THREE.SphereGeometry(D.headR + 0.014, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5); g.scale(1, 1.2, 1.02); g.translate(0, D.headCentreY + 0.01, 0.005); const band = new THREE.CylinderGeometry(D.headR + 0.018, D.headR + 0.016, 0.05, 12, 1, true); band.translate(0, D.headCentreY + 0.005, 0.005); G.beanie = merge([g, band]); }
  { const g = new THREE.SphereGeometry(D.headR + 0.010, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.42); g.scale(1, 1.16, 1.02); g.translate(0, D.headCentreY + 0.012, 0.005); const peak = new THREE.BoxGeometry(0.12, 0.008, 0.08); peak.translate(0, D.headCentreY + 0.035, D.headR + 0.045); G.cap = merge([g, peak]); }
  // hood (up): a larger cowl behind/over the head, coat colour
  { const g = new THREE.SphereGeometry(D.headR + 0.018, 12, 7, Math.PI * 0.8, Math.PI * 1.4, 0, Math.PI * 0.6); g.scale(1, 1.18, 1.06); g.translate(0, D.headCentreY + 0.008, -0.012); G.hood = g; }
  // torso: elliptical tapered cylinder + rounded shoulders + neck; pivot at the hip joint line
  { const body = new THREE.CylinderGeometry(0.19, 0.155, D.torso, 12, 1); body.scale(1, 1, 0.6); body.translate(0, D.torso / 2 + 0.02, 0);
    const shoulders = sphere(0.19, 12, 6); shoulders.scale(1.04, 0.36, 0.6); shoulders.translate(0, D.torso + 0.01, 0);
    const neck = new THREE.CylinderGeometry(0.055, 0.06, D.neck + 0.02, 8, 1); neck.translate(0, D.torso + D.neck / 2 + 0.005, 0.01);
    G.torso = merge([body, shoulders, neck]); }
  // scarf: a ring at the neck
  { const g = new THREE.TorusGeometry(0.085, 0.035, 6, 12); g.rotateX(Math.PI / 2); g.scale(1, 1, 0.8); g.translate(0, D.torso + 0.05, 0.0); G.scarf = g; }
  // hi-vis vest: a slightly larger open shell over the torso (orange with two grey bands baked into the texture)
  { const g = new THREE.CylinderGeometry(0.205, 0.175, D.torso * 0.92, 12, 1, true); g.scale(1, 1, 0.66); g.translate(0, D.torso * 0.46 + 0.04, 0); G.vest = g; }
  // hips / pelvis
  { const g = new THREE.CylinderGeometry(0.165, 0.175, 0.17, 10, 1); g.scale(1, 1, 0.66); g.translate(0, -0.02, 0); G.hips = g; }
  // limbs
  G.uarm = merge([sphere(0.062, 8, 6), cyl(0.056, 0.046, D.uarm)]);
  G.farm = merge([sphere(0.046, 7, 5), cyl(0.044, 0.036, D.farm)]);
  { const g = sphere(0.05, 7, 5); g.scale(0.75, 1.25, 0.5); g.translate(0, -0.055, 0); G.hand = g; }
  G.thigh = merge([sphere(0.09, 8, 6).scale(1, 0.8, 1), cyl(0.088, 0.068, D.thigh)]);
  G.shin = merge([sphere(0.068, 7, 5), cyl(0.066, 0.046, D.shin)]);
  { const foot = new THREE.BoxGeometry(0.10, 0.075, 0.27, 1, 1, 2); foot.translate(0, -0.0425, 0.06); const heel = new THREE.CylinderGeometry(0.05, 0.05, 0.075, 8); heel.translate(0, -0.0425, -0.06); G.foot = merge([foot, heel]); }
  // accessories
  { const body = new THREE.BoxGeometry(0.30, 0.40, 0.16, 1, 1, 1); body.translate(0, D.torso * 0.55, -0.20); const lid = new THREE.BoxGeometry(0.28, 0.12, 0.06); lid.translate(0, D.torso * 0.55 + 0.26, -0.21); const strapL = new THREE.BoxGeometry(0.05, 0.36, 0.03); strapL.translate(-0.1, D.torso * 0.62, -0.10); const strapR = strapL.clone(); strapR.translate(0.2, 0, 0); G.backpack = merge([body, lid, strapL, strapR]); }
  { // wheeled cabin suitcase: body 0.36 x 0.55 x 0.22, two wheels, telescopic handle; pivot at the handle grip (held by the hand)
    const body = new THREE.BoxGeometry(0.36, 0.55, 0.22); body.translate(0, -0.65, 0); const handleL = new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6); handleL.translate(-0.09, -0.21, -0.05); const handleR = handleL.clone(); handleR.translate(0.18, 0, 0); const grip = new THREE.BoxGeometry(0.22, 0.03, 0.03); grip.translate(0, 0, -0.05);
    const wheelL = new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8); wheelL.rotateZ(Math.PI / 2); wheelL.translate(-0.15, -0.93, 0.08); const wheelR = wheelL.clone(); wheelR.translate(0.30, 0, 0);
    G.suitcase = merge([body, handleL, handleR, grip, wheelL, wheelR]); }
  { const g = new THREE.BoxGeometry(0.07, 0.14, 0.008); g.translate(0, -0.08, 0.04); G.phone = g; }
  { const g = new THREE.BoxGeometry(0.30, 0.34, 0.10); g.translate(0.03, -0.35, 0.0); const strap = new THREE.BoxGeometry(0.02, 0.2, 0.02); strap.translate(0.03, -0.12, 0); G.bag = merge([g, strap]); }
  return G;
}

// ---- textures ----
function faceTexture(T) {
  const c = T.canvas(256, 128); const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 128);
  // SphereGeometry UV: u=0.25 is +Z (the face). Eyes at v≈0.5, mouth below. Everything drawn darker → multiplies the skin colour.
  const cx = 64; x.fillStyle = 'rgba(40,25,20,0.85)';
  for (const dx of [-11, 11]) { x.beginPath(); x.ellipse(cx + dx, 60, 4, 2.6, 0, 0, Math.PI * 2); x.fill(); }
  x.strokeStyle = 'rgba(60,40,30,0.55)'; x.lineWidth = 2; for (const dx of [-11, 11]) { x.beginPath(); x.moveTo(cx + dx - 6, 53); x.lineTo(cx + dx + 6, 52); x.stroke(); }
  x.strokeStyle = 'rgba(120,60,50,0.55)'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - 5, 80); x.quadraticCurveTo(cx, 83, cx + 5, 80); x.stroke();
  x.fillStyle = 'rgba(150,100,90,0.25)'; x.beginPath(); x.ellipse(cx, 70, 2.5, 4, 0, 0, Math.PI * 2); x.fill();
  // cheeks / ears slightly warmer
  x.fillStyle = 'rgba(200,120,110,0.12)'; x.beginPath(); x.ellipse(cx - 14, 72, 6, 5, 0, 0, Math.PI * 2); x.fill(); x.beginPath(); x.ellipse(cx + 14, 72, 6, 5, 0, 0, Math.PI * 2); x.fill();
  const t = T.toTexture(c, { anisotropy: 4 }); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
function coatTexture(T) {
  // fabric noise + a darker front opening/zip line (u=0.25 is the front of the cylinder too) + a collar shadow band at the top
  const c = T.canvas(256, 256); const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
  const rnd = T.mulberry32(5); const img = x.getImageData(0, 0, 256, 256); const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = 235 + rnd() * 20; d[i] = d[i + 1] = d[i + 2] = n; }
  x.putImageData(img, 0, 0);
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(62, 20, 4, 236);                 // front opening
  x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, 0, 256, 14);                  // collar shadow
  x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, 150, 256, 6);                 // waist seam / belt
  x.fillStyle = 'rgba(255,255,255,0.10)'; x.fillRect(40, 20, 3, 236); x.fillRect(85, 20, 3, 236); // lapels
  const t = T.toTexture(c, { anisotropy: 4 }); return t;
}
function vestTexture(T) {
  const c = T.canvas(64, 256); const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 256);
  x.fillStyle = '#c8c8c8'; x.fillRect(0, 96, 64, 26); x.fillRect(0, 160, 64, 26);   // two retro-reflective bands
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(14, 0, 2, 256);                       // zip
  const t = T.toTexture(c, { anisotropy: 2 }); return t;
}
function trouserTexture(T) {
  const c = T.canvas(64, 64); const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64);
  const rnd = T.mulberry32(9); const img = x.getImageData(0, 0, 64, 64); const d = img.data; for (let i = 0; i < d.length; i += 4) { const n = 232 + rnd() * 23; d[i] = d[i + 1] = d[i + 2] = n; } x.putImageData(img, 0, 0);
  return T.toTexture(c, { anisotropy: 2 });
}

/**
 * Create the instanced crowd pool. Returns { group, alloc(appearance), free(slot), pose(slot, p), flush(), count, max }.
 */
export function createNpcPool(ctx, { max = 200 } = {}) {
  const { T, scene } = ctx;
  const G = buildGeometries();
  const group = new THREE.Group(); group.name = 'npcs';

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: faceTexture(T), roughness: 0.75, metalness: 0 });
  const handMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  const coatMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: coatTexture(T), roughness: 0.92, metalness: 0 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: trouserTexture(T), roughness: 0.92, metalness: 0 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.05 });
  const vestMat = new THREE.MeshStandardMaterial({ color: HIVIS, map: vestTexture(T), roughness: 0.7, metalness: 0, side: THREE.DoubleSide, emissive: HIVIS, emissiveIntensity: 0.15 });
  const bagMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.05 });
  const caseMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.35 });
  const phoneMat = new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.3, metalness: 0.4, emissive: 0x9fb8ff, emissiveIntensity: 0.8 });

  // part table: name → { mesh, per: 1 | 2 (left/right) }
  const parts = {};
  const mk = (name, geo, mat, per = 1, shadow = true) => {
    const im = new THREE.InstancedMesh(geo, mat, max * per); im.name = 'npc:' + name; im.castShadow = shadow; im.receiveShadow = false; im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < max * per; i++) im.setMatrixAt(i, ZERO);
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * per * 3).fill(1), 3); im.instanceColor.setUsage(THREE.DynamicDrawUsage);
    group.add(im); parts[name] = { mesh: im, per }; return im;
  };
  mk('head', G.head, skinMat); mk('torso', G.torso, coatMat); mk('hips', G.hips, clothMat);
  mk('uarm', G.uarm, coatMat, 2); mk('farm', G.farm, coatMat, 2); mk('hand', G.hand, handMat, 2);
  mk('thigh', G.thigh, clothMat, 2); mk('shin', G.shin, clothMat, 2); mk('foot', G.foot, shoeMat, 2);
  mk('hairShort', G.hairShort, hairMat); mk('hairBuzz', G.hairBuzz, hairMat); mk('hairLong', G.hairLong, hairMat); mk('hairBob', G.hairBob, hairMat); mk('hairBun', G.hairBun, hairMat);
  mk('beanie', G.beanie, hairMat); mk('cap', G.cap, hairMat); mk('hood', G.hood, coatMat); mk('scarf', G.scarf, hairMat);
  mk('vest', G.vest, vestMat, 1, false); mk('backpack', G.backpack, bagMat); mk('suitcase', G.suitcase, caseMat); mk('bag', G.bag, bagMat); mk('phone', G.phone, phoneMat, 1, false);
  const HAIR_PART = { short: 'hairShort', buzz: 'hairBuzz', long: 'hairLong', bob: 'hairBob', bun: 'hairBun', beanie: 'beanie', cap: 'cap', bald: null };

  const free = []; for (let i = max - 1; i >= 0; i--) free.push(i);
  const slots = new Array(max).fill(null);
  const dirty = new Set();
  const col = new THREE.Color();
  const setColor = (name, idx, hex) => { const p = parts[name]; col.set(hex); p.mesh.setColorAt(idx, col); p.mesh.instanceColor.needsUpdate = true; };
  const hide = (name, idx) => { parts[name].mesh.setMatrixAt(idx, ZERO); dirty.add(name); };

  function alloc(app) {
    if (!free.length) return -1; const i = free.pop(); slots[i] = app;
    // colours
    setColor('head', i, app.skin); setColor('hand', i * 2, app.skin); setColor('hand', i * 2 + 1, app.skin);
    setColor('torso', i, app.coat); setColor('hood', i, app.coat);
    for (const s of [0, 1]) { setColor('uarm', i * 2 + s, app.coat); setColor('farm', i * 2 + s, app.coat); setColor('thigh', i * 2 + s, app.trousers); setColor('shin', i * 2 + s, app.trousers); setColor('foot', i * 2 + s, app.shoes); }
    setColor('hips', i, app.trousers);
    for (const h of ['hairShort', 'hairBuzz', 'hairLong', 'hairBob', 'hairBun']) setColor(h, i, app.hair);
    setColor('beanie', i, app.hatColor || 0x333333); setColor('cap', i, app.hatColor || 0x333333);
    setColor('scarf', i, app.scarf || 0x000000);
    setColor('backpack', i, app.backpackColor || [0x1a1a1e, 0x2f3238, 0x4a2a1e, 0x1f3a5a, 0x6b1f1f][i % 5]);
    setColor('suitcase', i, app.suitcaseColor || [0x2a2a2e, 0x8b1f1f, 0x1a3a6a, 0xc8c8c8, 0x1f1f24][(i * 7) % 5]);
    setColor('bag', i, app.bagColor || [0x2a2a2e, 0x7a5a3a, 0xe0d8c8, 0x1f3a5a][(i * 3) % 4]);
    return i;
  }
  function freeSlot(i) {
    if (i < 0 || !slots[i]) return; slots[i] = null; free.push(i);
    for (const name in parts) { const p = parts[name]; for (let s = 0; s < p.per; s++) p.mesh.setMatrixAt(i * p.per + s, ZERO); dirty.add(name); }
  }

  // ---- pose computation --------------------------------------------------
  const root = new THREE.Matrix4(), hips = new THREE.Matrix4(), torso = new THREE.Matrix4(), head = new THREE.Matrix4(), tmp = new THREE.Matrix4(), limb = new THREE.Matrix4(), limb2 = new THREE.Matrix4(), limb3 = new THREE.Matrix4();
  const e = new THREE.Euler();
  const rotX = (m, a) => { e.set(a, 0, 0); tmp.makeRotationFromEuler(e); m.multiply(tmp); };
  const rotY = (m, a) => { e.set(0, a, 0); tmp.makeRotationFromEuler(e); m.multiply(tmp); };
  const rotZ = (m, a) => { e.set(0, 0, a); tmp.makeRotationFromEuler(e); m.multiply(tmp); };
  const trans = (m, x, y, z) => { tmp.makeTranslation(x, y, z); m.multiply(tmp); };
  const setM = (name, idx, m) => { parts[name].mesh.setMatrixAt(idx, m); dirty.add(name); };

  /**
   * p: { x,y,z, heading (rad, +Z forward at 0), phase (walk cycle rad), stride (0..1 gait amplitude: 0 = standing),
   *      lean (rad, forward +), headYaw, headPitch, phoneUp (0..1), phoneHigh (0..1 photographing), suitcase (0..1 pulling),
   *      idle (seconds, for breathing/weight shift), sway (0..1), armsUp? }
   */
  function pose(i, p) {
    const app = slots[i]; if (!app) return;
    const s = app.height / REF_HEIGHT; const w = app.build;
    const D = DIM; const phase = p.phase || 0; const g = Math.min(1, Math.max(0, p.stride ?? 0));
    const A = (0.30 + 0.16 * g) * g;                               // thigh swing amplitude (rad)
    const sinP = Math.sin(phase), cosP = Math.cos(phase);
    const legLen = D.thigh + D.shin;
    const idle = p.idle || 0;
    // hip height: keep the stance leg (straight knee) on the ground
    const hipY = D.ankle + legLen * Math.cos(A * Math.abs(sinP)) - 0.012 * g + (g < 0.05 ? Math.sin(idle * 1.3) * 0.003 : 0);
    // root: feet origin
    root.makeTranslation(p.x, p.y, p.z); rotY(root, p.heading || 0); tmp.makeScale(s * w, s, s * w); root.multiply(tmp);
    // pelvis: small rotation about Y with the stride, slight lateral sway when idle
    hips.copy(root); trans(hips, (g < 0.05 ? Math.sin(idle * 0.6) * 0.012 : Math.sin(phase) * 0.006 * g), hipY, 0); rotY(hips, sinP * 0.10 * g); rotZ(hips, -Math.sin(phase) * 0.04 * g);
    setM('hips', i, hips);
    // torso: counter-rotates the pelvis, leans forward with speed / on request
    torso.copy(hips); rotY(torso, -sinP * 0.16 * g); rotX(torso, -(p.lean || 0) - 0.04 * g); rotZ(torso, Math.sin(phase) * 0.02 * g);
    setM('torso', i, torso);
    if (app.vest) setM('vest', i, torso);
    if (app.scarf) setM('scarf', i, torso);
    if (app.backpack) setM('backpack', i, torso);
    // head
    head.copy(torso); trans(head, 0, D.torso + D.neck - 0.01, 0.0); rotY(head, p.headYaw || 0); rotX(head, -(p.headPitch || 0) + 0.02 * g);
    setM('head', i, head);
    const hp = app.hood ? 'hood' : HAIR_PART[app.hairStyle]; if (hp) setM(hp, i, head);
    // legs
    for (const side of [0, 1]) {
      const sgn = side === 0 ? -1 : 1; const ph = phase + (side === 0 ? 0 : Math.PI);
      const sp = Math.sin(ph), cp = Math.cos(ph);
      const thighFwd = A * sp;
      const knee = g > 0.02 ? (0.62 * g) * Math.max(0, Math.cos(ph - 0.35)) * (sp > -0.2 ? 1 : 0.35) : 0.02;
      const heel = g > 0.02 ? 0.5 * g * Math.max(0, -sp - 0.3) : 0;
      limb.copy(hips); trans(limb, sgn * D.hipHalf, 0.0, 0); rotX(limb, -thighFwd); rotZ(limb, sgn * -0.02);
      setM('thigh', i * 2 + side, limb);
      limb2.copy(limb); trans(limb2, 0, -D.thigh, 0); rotX(limb2, knee);
      setM('shin', i * 2 + side, limb2);
      limb3.copy(limb2); trans(limb3, 0, -D.shin, 0); rotX(limb3, thighFwd - knee + heel); rotY(limb3, sgn * 0.08);
      setM('foot', i * 2 + side, limb3);
    }
    // arms
    const phoneUp = p.phoneUp || 0, phoneHigh = p.phoneHigh || 0, pulling = p.suitcase || 0;
    for (const side of [0, 1]) {
      const sgn = side === 0 ? -1 : 1; const ph = phase + (side === 0 ? Math.PI : 0);   // arms counter-swing the legs
      const sp = Math.sin(ph);
      let armFwd = 0.42 * A * sp * 1.1, elbow = 0.28 + 0.3 * g * Math.max(0, sp), out = 0.10, twist = 0;
      if (side === 1 && pulling > 0) { armFwd = -0.55 * pulling + armFwd * (1 - pulling); elbow = 0.15; out = 0.18; }
      if (side === 1 && phoneUp > 0) { armFwd = armFwd * (1 - phoneUp) + 0.55 * phoneUp; elbow = elbow * (1 - phoneUp) + 2.05 * phoneUp; twist = -0.55 * phoneUp; out = 0.05; }
      if (side === 0 && phoneUp > 0.5) { armFwd = armFwd * 0.4 + 0.35 * phoneUp; elbow = 1.7 * phoneUp; twist = 0.7 * phoneUp; out = 0.04; }
      if (phoneHigh > 0) { armFwd = 1.5 * phoneHigh + armFwd * (1 - phoneHigh); elbow = 0.9 * phoneHigh; out = 0.12; twist = side === 0 ? 0.6 : -0.6; }
      if (app.bag && side === 0 && pulling === 0 && phoneUp < 0.5) { armFwd *= 0.5; elbow = 0.12; out = 0.14; }
      if (side === 1 && p.tap > 0) { const t = p.tap; armFwd = armFwd * (1 - t) + 0.85 * t; elbow = elbow * (1 - t) + 0.35 * t; out = out * (1 - t) + 0.02 * t; }
      limb.copy(torso); trans(limb, sgn * D.shoulderHalf, D.shoulderY, 0); rotX(limb, -armFwd); rotZ(limb, sgn * -out); rotY(limb, twist);
      setM('uarm', i * 2 + side, limb);
      limb2.copy(limb); trans(limb2, 0, -D.uarm, 0); rotX(limb2, -elbow);
      setM('farm', i * 2 + side, limb2);
      limb3.copy(limb2); trans(limb3, 0, -D.farm, 0);
      setM('hand', i * 2 + side, limb3);
      if (side === 1 && phoneUp > 0.3 && app.phone) { limb.copy(limb3); trans(limb, 0, -0.02, 0.03); rotX(limb, -0.35 - 0.6 * phoneHigh); setM('phone', i, limb); }
      else if (side === 1 && phoneHigh > 0.3) { limb.copy(limb3); trans(limb, 0, -0.02, 0.03); rotX(limb, -1.2); setM('phone', i, limb); }
      else if (side === 1) hide('phone', i);
      if (side === 1 && app.suitcase) { if (pulling > 0.05) { limb.copy(limb3); trans(limb, 0.02, -0.06, -0.02); rotX(limb, 0.55 * pulling); rotY(limb, 0.1); setM('suitcase', i, limb); } else { limb.copy(root); trans(limb, 0.32, 0.93, -0.05); rotX(limb, 0.12); setM('suitcase', i, limb); } }
      if (side === 0 && app.bag) { limb.copy(limb3); trans(limb, -0.01, -0.02, 0); setM('bag', i, limb); }
    }
  }

  function flush() { for (const name of dirty) { parts[name].mesh.instanceMatrix.needsUpdate = true; } dirty.clear(); }
  function hideSlot(i) { for (const name in parts) { const p = parts[name]; for (let s = 0; s < p.per; s++) p.mesh.setMatrixAt(i * p.per + s, ZERO); dirty.add(name); } }

  scene.add(group);
  return { group, parts, alloc, free: freeSlot, pose, flush, hide: hideSlot, get count() { return max - free.length; }, max, appearance: i => slots[i] };
}
