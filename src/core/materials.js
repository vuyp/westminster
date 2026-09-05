// ---------------------------------------------------------------------------
// materials.js — shared PBR material factory. Materials are cached and reused.
// Every material carries `userData.metres` = metres per texture tile; use
// T.boxGeometryMetric / T.planeGeometryMetric (UVs in metres) so the tiling is right.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import * as T from './textures.js';
import { PALETTE } from './layout.js';

const cache = new Map();
function cached(key, make) { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); }

/** Apply the `metres` tiling of a texture set to a material (textures already have repeat = 1 per tile; we scale by 1/metres). */
function applyTiling(mat, tex) {
  const r = 1 / (tex.metres || 1);
  ['map', 'roughnessMap', 'normalMap', 'metalnessMap', 'aoMap'].forEach(k => {
    if (tex[k]) { const t = tex[k].clone(); t.repeat.set(r, r); t.needsUpdate = true; mat[k] = t; }
  });
  mat.userData.metres = tex.metres || 1;
  return mat;
}

export const M = {
  /** Board-marked fair-faced concrete (walls, columns, ceilings of the box). */
  concrete(opts = {}) {
    return cached('concrete:' + JSON.stringify(opts), () => {
      const tex = T.concrete({ base: opts.base ?? PALETTE.concrete, dark: opts.dark ?? 0x6f6d69, seed: opts.seed ?? 7, stain: opts.stain ?? 0.35, boardMarks: opts.boardMarks ?? true, tieHoles: opts.tieHoles ?? true });
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.6, 0.6) });
      return applyTiling(m, tex);
    });
  },
  /** Smooth precast concrete (platform slabs, walkway soffits): fewer marks, lighter. */
  precast(opts = {}) {
    return cached('precast:' + JSON.stringify(opts), () => {
      const tex = T.concrete({ base: opts.base ?? 0xa6a49f, dark: 0x7e7c77, seed: 19, stain: 0.2, boardMarks: false, tieHoles: false, metres: 3 });
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, normalScale: new THREE.Vector2(0.3, 0.3) });
      return applyTiling(m, tex);
    });
  },
  /** Dark grey granite floor (ticket hall, platforms, walkways). */
  granite(opts = {}) {
    return cached('granite:' + JSON.stringify(opts), () => {
      const tex = T.granite({ base: opts.base ?? PALETTE.graniteFloor, slab: opts.slab ?? 1.0, joints: opts.joints ?? true, seed: opts.seed ?? 3 });
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.05 });
      return applyTiling(m, tex);
    });
  },
  /** Tactile paving: 'blister' (platform edge) or 'corduroy' (stairs). */
  tactile(type = 'blister', color = PALETTE.tactileGrey) {
    return cached('tactile:' + type + color, () => {
      const tex = T.tactile({ type, color });
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, normalScale: new THREE.Vector2(0.8, 0.8) });
      return applyTiling(m, tex);
    });
  },
  /** Brushed stainless steel (escalator balustrades, handrails, PED frames, gates). */
  stainless(opts = {}) {
    return cached('stainless:' + JSON.stringify(opts), () => {
      const tex = T.brushedMetal({ base: opts.base ?? PALETTE.stainless, vertical: opts.vertical ?? false });
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.92, envMapIntensity: 1.2 });
      return applyTiling(m, tex);
    });
  },
  /** Plain painted / powder-coated metal. */
  paint(color, { roughness = 0.5, metalness = 0.15 } = {}) {
    return cached(`paint:${color}:${roughness}:${metalness}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  },
  /** Bare aluminium (1996 stock body sides), semi-gloss. */
  aluminium() { return cached('aluminium', () => new THREE.MeshStandardMaterial({ color: 0xc4c6c9, roughness: 0.42, metalness: 0.85 })); },
  /** Dark structural steel (struts, props, beams) — the box's flying struts are grey-painted steel tubes. */
  structuralSteel(color = 0x6b6e73) { return cached('steel:' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.6 })); },
  /** Glass for PEDs, balustrades, windows. */
  glass({ color = 0xdfe8ee, opacity = 0.28, roughness = 0.05, tint = null } = {}) {
    return cached(`glass:${color}:${opacity}:${roughness}:${tint}`, () => new THREE.MeshPhysicalMaterial({ color: tint ?? color, roughness, metalness: 0, transmission: 0, transparent: true, opacity, envMapIntensity: 1.5, side: THREE.DoubleSide, depthWrite: false }));
  },
  /** Ceramic wall tiles (older sub-surface finishes, staircases). */
  tiles(opts = {}) {
    return cached('tiles:' + JSON.stringify(opts), () => {
      const tex = T.tiles({ color: opts.color ?? 0xe8e6e0, grout: opts.grout ?? 0x9a9892, tileW: opts.tileW ?? 0.3, tileH: opts.tileH ?? 0.15, seed: opts.seed ?? 9 });
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.05, normalScale: new THREE.Vector2(0.5, 0.5) });
      return applyTiling(m, tex);
    });
  },
  /** Street paving slabs. */
  paving() { return cached('paving', () => applyTiling(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), T.pavingSlabs())); },
  /** Road tarmac. */
  tarmac() { return cached('tarmac', () => applyTiling(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), T.tarmac())); },
  /** Portland stone ashlar (Palace of Westminster, Elizabeth Tower). */
  portland(opts = {}) {
    return cached('portland:' + JSON.stringify(opts), () => applyTiling(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, normalScale: new THREE.Vector2(0.4, 0.4) }), T.ashlar({ color: opts.color ?? PALETTE.portlandStone, weathering: opts.weathering ?? 0.5, courseH: opts.courseH ?? 0.45, blockW: opts.blockW ?? 0.9 })));
  },
  /** Portcullis House sandstone (warm buff) — Hopkins used a pale sandstone with bronze. */
  sandstone() { return cached('sandstone', () => applyTiling(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), T.ashlar({ color: 0xcdbfa3, dark: 0x8d7f65, weathering: 0.3, courseH: 0.6, blockW: 1.2, seed: 55 }))); },
  /** Bronze / dark patinated metal (Portcullis House roof & chimneys, bridge ironwork detail). */
  bronze(color = 0x4a3f2f) { return cached('bronze:' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.8 })); },
  /** Perforated metal panels (ceilings, wall cladding). Optional tint. */
  perforated(color = 0xdadcde) { return cached('perforated:' + color, () => applyTiling(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.4 }), T.perforated({ color }))); },
  /** Victorian engineering brick (1868 cut-and-cover tunnels): stretcher bond, soot-darkened. */
  brick({ color = 0x6b4a3a, mortar = 0x8a8078, courseH = 0.075, blockW = 0.225, weathering = 0.7 } = {}) { return cached(`brick:${color}:${mortar}:${courseH}:${blockW}`, () => applyTiling(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, normalScale: new THREE.Vector2(0.6, 0.6) }), T.ashlar({ color, dark: mortar, courseH, blockW, weathering, metres: 2, seed: 61 }))); },
  /** Seat moquette. */
  moquette(style = 'barman') { return cached('moquette:' + style, () => applyTiling(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), T.moquette({ style }))); },
  /** Emissive luminaire surface (fluorescent tube diffusers, LED panels). */
  luminaire(color = 0xffffff, intensity = 2.2) { return cached(`lum:${color}:${intensity}`, () => new THREE.MeshStandardMaterial({ color: 0x222222, emissive: color, emissiveIntensity: intensity, roughness: 0.6 })); },
  /** A sign/texture on a plane: unlit-ish so it reads clearly under any lighting (signs are internally lit or matte). */
  signMaterial(texture, { emissive = 0.55, side = THREE.FrontSide, transparent = false } = {}) {
    const m = new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: emissive, roughness: 0.7, metalness: 0, side, transparent, alphaTest: transparent ? 0.1 : 0 });
    return m;
  },
  /** Display screen material (dot-matrix / LED) — fully emissive. */
  screen(texture, intensity = 1.6) {
    return new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: intensity, color: 0x000000, roughness: 0.3, metalness: 0.2, toneMapped: true });
  },
  /** Yellow paint (platform edge line, way-out accents) */
  yellow() { return M.paint(PALETTE.wayOutYellow, { roughness: 0.6, metalness: 0 }); },
  /** Black rubber / plastic (handrails, seals). */
  rubber(color = 0x1a1a1a) { return cached('rubber:' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 })); },
  /** Water for the Thames (simple, dark, glossy; the street module may animate the normal map). */
  water() { return cached('water', () => new THREE.MeshStandardMaterial({ color: 0x3f4d4f, roughness: 0.15, metalness: 0.2 })); },
  /** Generic matte for placeholder blocks. */
  matte(color) { return cached('matte:' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 })); },
  /** Sky-visible distant buildings. */
  distant(color) { return cached('distant:' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 })); },
};

/** Helper: a mesh from a metric box with a material that tiles in metres. Shadows on. */
export function box(w, h, d, material, { x = 0, y = 0, z = 0, castShadow = true, receiveShadow = true } = {}) {
  const mesh = new THREE.Mesh(T.boxGeometryMetric(w, h, d), material);
  mesh.position.set(x, y, z); mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow;
  return mesh;
}

/** Helper: a flat metric plane facing +Y (floor) or a wall; rotate yourself for other orientations. */
export function floorPlane(w, d, material, { x = 0, y = 0, z = 0 } = {}) {
  const g = T.planeGeometryMetric(w, d); g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, material); mesh.position.set(x, y, z); mesh.receiveShadow = true; return mesh;
}

/** Helper: a vertical sign plane (width w, height h) with the given texture at position, facing direction `facing` ('north'|'south'|'east'|'west'). */
export function signPlane(texture, w, h, { x = 0, y = 0, z = 0, facing = 'south', emissive = 0.55, doubleSided = false, transparent = false } = {}) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.signMaterial(texture, { emissive, side: doubleSided ? THREE.DoubleSide : THREE.FrontSide, transparent }));
  mesh.position.set(x, y, z);
  const rot = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }[facing] ?? 0;
  mesh.rotation.y = rot;
  return mesh;
}
