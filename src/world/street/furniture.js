// ---------------------------------------------------------------------------
// street/furniture.js — everything a passenger notices between the buildings: the subway stair heads of
// Exits 1, 2, 3, 5 and 6 (parapet handrails, the black cast-iron arch signed 'City of Westminster ·
// Westminster Station · Public Subway (· Toilets)', the pole-mounted illuminated box roundel, the blue
// exit panel and a Legible London monolith at each), bus stop H (flag only — TfL: no shelter) and the
// sheltered stop G on Parliament Street, Westminster's black 'Windsor' heritage lamp columns and the
// modern Embankment columns, the taxi-rank bollards along the Portcullis House kerb and the PAS68
// security bollards in front of the Palace railings, litter bins, the red K6 telephone box, a pillar box,
// CCTV masts, Belisha beacons at the Parliament Street zebra, Embankment benches, the hot-dog cart and
// souvenir stand at the Big Ben corner, the Embankment plane trees, and a flock of pecking pigeons.
// Dossier §11.11. Everything registers blockers; nothing here is walkable.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { Merger, Instancer, makeMaterials, COL, signMat, bluePanel, modernLampGeometry, bollardGeometry, pigeonGeometry, latheGeo, k6Texture, busFlagTexture, legibleLondonTexture, subwayArchTexture, mulberry, hex, FONT } from './kit.js';

export function buildFurniture(ctx, group, plan, state) {
  const { layout, collision, T } = ctx; const mats = makeMaterials(ctx); const S = layout.STREET; const P = plan;
  const M = new Merger(group, 'furniture'); const I = new Instancer(group);
  const blk = (r, tag) => collision.addBlocker(r, tag);
  const post = (x, z, r, h, tag) => blk({ xMin: x - r, xMax: x + r, yMin: -0.5, yMax: h, zMin: z - r, zMax: z + r }, tag);
  const rnd = mulberry(29);
  const paint = (c, r = 0.6, m = 0.1) => ctx.M.paint(c, { roughness: r, metalness: m });
  const lanternGlass = paint(0xe9e4d2, 0.35, 0.05);                                         // daytime: unlit warm opal glass
  const roundelRed = mats.roundelRed || (mats.roundelRed = new THREE.MeshStandardMaterial({ color: 0xdc241f, emissive: 0xdc241f, emissiveIntensity: 0.5, roughness: 0.5 }));
  const barMat = mats.barMat || (mats.barMat = signMat(ctx, T.sign({ width: 1024, height: 200, bg: '#0019a8', lines: [{ text: 'UNDERGROUND', x: 512, y: 150, size: 132, align: 'center', color: '#ffffff' }] }), { emissive: 0.9 }));
  const rot = (cx, cz, ry) => (lx, ly, lz) => ({ x: cx + Math.cos(ry) * lx + Math.sin(ry) * lz, y: ly, z: cz - Math.sin(ry) * lx + Math.cos(ry) * lz });

  // ================================================================ a pole-mounted illuminated 3D box roundel (ring c. 0.9 m, bar 1.15 m, 3.5 m to the top)
  const roundelBox = (x, z, ry = 0) => {
    M.chunk('exits'); M.cyl(mats.signGrey, 0.06, 0.08, 2.6, 10, { x, y: 1.3, z }); M.cyl(mats.signGrey, 0.2, 0.22, 0.06, 12, { x, y: 0.03, z });
    M.add(roundelRed, new THREE.TorusGeometry(0.4, 0.1, 8, 36).translate(0, 3.05, 0), { x, y: 0, z, ry });
    M.add(mats.blue, new THREE.BoxGeometry(1.15, 0.26, 0.22).translate(0, 3.05, 0), { x, y: 0, z, ry });
    M.add(barMat, new THREE.PlaneGeometry(1.15, 0.24).translate(0, 3.05, 0.115), { x, y: 0, z, ry });
    M.add(barMat, new THREE.PlaneGeometry(1.15, 0.24).rotateY(Math.PI).translate(0, 3.05, -0.115), { x, y: 0, z, ry });
    post(x, z, 0.22, 3.6, 'roundelPole');
  };
  // ================================================================ the Victorian cast-iron arch over a subway stair head
  const archCanopy = (cx, cz, span, ry, { toilets = true } = {}) => {
    M.chunk('exits'); const L = rot(cx, cz, ry);
    const postProfile = [[0.16, 0], [0.16, 0.08], [0.09, 0.12], [0.08, 2.2], [0.11, 2.3], [0.08, 2.4], [0.07, 3.2], [0.1, 3.3], [0.05, 3.45]];
    for (const s of [-1, 1]) { const p = L(s * span / 2, 0, 0); M.lathe(mats.ironBlack, postProfile, 10, { x: p.x, y: 0, z: p.z }); M.sphere(mats.gilt, 0.07, { x: p.x, y: 3.5, z: p.z }); post(p.x, p.z, 0.2, 3.5, 'exitCanopyPost'); }
    const key = 'archMat:' + toilets; const archMat = mats[key] || (mats[key] = signMat(ctx, subwayArchTexture(T, { toilets, w: 4.4, h: 0.7 }), { emissive: 0.35 }));
    M.add(mats.ironBlack, new THREE.BoxGeometry(span + 0.1, 0.8, 0.08).translate(0, 2.75, 0), { x: cx, y: 0, z: cz, ry });
    M.add(archMat, new THREE.PlaneGeometry(span - 0.1, 0.7).translate(0, 2.75, 0.045), { x: cx, y: 0, z: cz, ry });
    M.add(archMat, new THREE.PlaneGeometry(span - 0.1, 0.7).rotateY(Math.PI).translate(0, 2.75, -0.045), { x: cx, y: 0, z: cz, ry });
    const arc = new THREE.TorusGeometry(span / 2, 0.045, 8, 28, Math.PI); arc.scale(1, 0.32, 1); arc.translate(0, 3.15, 0); M.add(mats.ironBlack, arc, { x: cx, y: 0, z: cz, ry });
    const arc2 = new THREE.TorusGeometry(span / 2 - 0.25, 0.03, 6, 28, Math.PI); arc2.scale(1, 0.3, 1); arc2.translate(0, 3.15, 0); M.add(mats.gilt, arc2, { x: cx, y: 0, z: cz, ry });
    for (let k = 1; k < 6; k++) { const u = -span / 2 + span * k / 6; const y1 = 3.15 + Math.sqrt(Math.max(0, 1 - (u / (span / 2)) ** 2)) * span / 2 * 0.32; M.add(mats.ironBlack, new THREE.BoxGeometry(0.03, y1 - 3.15, 0.03).translate(u, (y1 + 3.15) / 2, 0), { x: cx, y: 0, z: cz, ry }); }
    // the roundel riding on the crown of the arch
    const top = 3.15 + span / 2 * 0.32;
    M.add(roundelRed, new THREE.TorusGeometry(0.3, 0.075, 8, 32).translate(0, top + 0.36, 0), { x: cx, y: 0, z: cz, ry });
    M.add(mats.blue, new THREE.BoxGeometry(0.86, 0.19, 0.16).translate(0, top + 0.36, 0), { x: cx, y: 0, z: cz, ry });
    M.add(barMat, new THREE.PlaneGeometry(0.86, 0.18).translate(0, top + 0.36, 0.085), { x: cx, y: 0, z: cz, ry });
    M.add(barMat, new THREE.PlaneGeometry(0.86, 0.18).rotateY(Math.PI).translate(0, top + 0.36, -0.085), { x: cx, y: 0, z: cz, ry });
    // scroll brackets under the sign
    for (const s of [-1, 1]) M.add(mats.ironBlack, new THREE.TorusGeometry(0.22, 0.025, 6, 16, Math.PI * 0.75).rotateZ(s > 0 ? Math.PI * 0.05 : Math.PI * 0.2).translate(s * (span / 2 - 0.3), 2.2, 0), { x: cx, y: 0, z: cz, ry });
  };
  // stainless handrail on top of the trench parapets (the ticket hall builds the 0.9 m cream-tiled upstand), closed on three sides
  const trenchRails = (tr, top, tag) => {
    M.chunk('exits'); const segs = top === 'east'
      ? [[tr.xMin, tr.zMin, tr.xMax, tr.zMin], [tr.xMin, tr.zMax, tr.xMax, tr.zMax], [tr.xMin, tr.zMin, tr.xMin, tr.zMax]]
      : [[tr.xMin, tr.zMin, tr.xMin, tr.zMax], [tr.xMax, tr.zMin, tr.xMax, tr.zMax], [tr.xMin, tr.zMin, tr.xMax, tr.zMin]];
    for (const [x0, z0, x1, z1] of segs) {
      M.tube(mats.chrome, { x: x0, y: 1.06, z: z0 }, { x: x1, y: 1.06, z: z1 }, 0.025, 8);
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 1.5));
      for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n; M.cyl(mats.chrome, 0.018, 0.018, 0.22, 6, { x, y: 0.96, z }); }
      blk({ xMin: Math.min(x0, x1) - 0.15, xMax: Math.max(x0, x1) + 0.15, yMin: -0.5, yMax: 1.1, zMin: Math.min(z0, z1) - 0.15, zMax: Math.max(z0, z1) + 0.15 }, tag + ':parapet');
    }
  };
  // Legible London monolith (dark blue, 2.2 m, map on both faces)
  const llTex = legibleLondonTexture(T); const llMat = signMat(ctx, llTex, { emissive: 0.3 });
  const monolith = (x, z, ry = 0) => {
    M.chunk('exits'); M.add(mats.dark, new THREE.BoxGeometry(0.56, 2.3, 0.16).translate(0, 1.15, 0), { x, y: 0, z, ry });
    M.add(llMat, new THREE.PlaneGeometry(0.5, 2.2).translate(0, 1.18, 0.081), { x, y: 0, z, ry }); M.add(llMat, new THREE.PlaneGeometry(0.5, 2.2).rotateY(Math.PI).translate(0, 1.18, -0.081), { x, y: 0, z, ry });
    post(x, z, 0.3, 2.3, 'monolith');
  };
  const trench = (name) => P.exitTrenches.find(t => t.name === name);

  // ================================================================ the five subway stair heads
  try {
    const exits = [
      { n: 3, name: 'Houses of Parliament', sub: 'Big Ben  ·  Westminster Abbey', tr: trench('exit3'), top: 'south', toilets: false },
      { n: 2, name: 'Victoria Embankment', sub: 'Westminster Bridge  ·  London Eye', tr: trench('exit2'), top: 'east', toilets: true },
      { n: 1, name: 'Westminster Pier', sub: 'River Bus  ·  River Tours', tr: trench('exit1'), top: 'east', toilets: false, simple: true },
      { n: 5, name: 'Whitehall', sub: 'Downing Street  ·  Horse Guards', tr: trench('exit5'), top: 'south', toilets: true },
      { n: 6, name: 'Parliament Street', sub: 'Whitehall  ·  Parliament Square', tr: trench('exit6'), top: 'south', toilets: true },
    ];
    for (const e of exits) {
      const tr = e.tr; if (!tr) continue; const tag = 'exit' + e.n;
      const w = e.top === 'east' ? tr.zMax - tr.zMin : tr.xMax - tr.xMin;
      const cx = e.top === 'east' ? tr.xMax + 0.2 : (tr.xMin + tr.xMax) / 2, cz = e.top === 'east' ? (tr.zMin + tr.zMax) / 2 : tr.zMax + 0.2;
      const ry = e.top === 'east' ? Math.PI / 2 : 0;
      trenchRails(tr, e.top, tag);
      if (!e.simple) archCanopy(cx, cz, w + 0.7, ry, { toilets: e.toilets });
      else { // Exit 1: plain steel handrail posts and a small arch-less sign board
        M.chunk('exits'); for (const s of [-1, 1]) { const p = rot(cx, cz, ry)(s * (w / 2 + 0.2), 0, 0); M.cyl(mats.ironBlack, 0.05, 0.06, 2.6, 8, { x: p.x, y: 1.3, z: p.z }); post(p.x, p.z, 0.12, 2.6, tag + ':post'); }
        const boardMat = signMat(ctx, subwayArchTexture(T, { toilets: false, w: w + 0.5, h: 0.6 }), { emissive: 0.35 });
        M.add(boardMat, new THREE.PlaneGeometry(w + 0.4, 0.55).translate(0, 2.35, 0.041), { x: cx, y: 0, z: cz, ry });
        M.add(boardMat, new THREE.PlaneGeometry(w + 0.4, 0.55).rotateY(Math.PI).translate(0, 2.35, -0.041), { x: cx, y: 0, z: cz, ry });
        M.add(mats.ironBlack, new THREE.BoxGeometry(w + 0.5, 0.62, 0.06).translate(0, 2.35, 0), { x: cx, y: 0, z: cz, ry });
        M.add(mats.ironBlack, new THREE.BoxGeometry(w + 0.5, 0.05, 0.05).translate(0, 2.7, 0), { x: cx, y: 0, z: cz, ry });
      }
      const side = e.top === 'east' ? { x: tr.xMax + 0.7, z: tr.zMax + 1.0 } : { x: tr.xMax + 1.0, z: tr.zMax + 0.7 };
      roundelBox(side.x, side.z, ry);
      // exit panel (roundel + 'Westminster' + exit number) and the destinations panel on the roundel pole
      const panel = signMat(ctx, bluePanel(T, ['Westminster', `Exit ${e.n}  ${e.name}`], { width: 1024, height: 320, roundel: true }), { emissive: 0.6 });
      const dest = mats.destPanel || (mats.destPanel = signMat(ctx, T.sign({ width: 1024, height: 512, bg: '#113b92', lines: [{ text: 'Subway to', size: 60, weight: 'normal' }, { text: 'Westminster Station', size: 78 }, { text: 'Houses of Parliament', size: 60, weight: 'normal' }, { text: 'Westminster Abbey  ·  Whitehall', size: 52, weight: 'normal' }, { text: 'Westminster Pier  ·  London Eye', size: 52, weight: 'normal' }] }), { emissive: 0.55 }));
      M.chunk('exits');
      M.add(panel, new THREE.PlaneGeometry(1.1, 0.34).translate(0, 2.3, 0.05), { x: side.x, y: 0, z: side.z, ry }); M.add(panel, new THREE.PlaneGeometry(1.1, 0.34).rotateY(Math.PI).translate(0, 2.3, -0.05), { x: side.x, y: 0, z: side.z, ry });
      M.add(dest, new THREE.PlaneGeometry(0.9, 0.45).translate(0, 1.75, 0.05), { x: side.x, y: 0, z: side.z, ry }); M.add(dest, new THREE.PlaneGeometry(0.9, 0.45).rotateY(Math.PI).translate(0, 1.75, -0.05), { x: side.x, y: 0, z: side.z, ry });
      M.add(mats.signGrey, new THREE.BoxGeometry(1.14, 0.38, 0.08).translate(0, 2.3, 0), { x: side.x, y: 0, z: side.z, ry }); M.add(mats.signGrey, new THREE.BoxGeometry(0.94, 0.49, 0.08).translate(0, 1.75, 0), { x: side.x, y: 0, z: side.z, ry });
      const mono = e.top === 'east' ? { x: tr.xMax + 0.7, z: tr.zMin - 1.0 } : { x: tr.xMin - 1.0, z: tr.zMax + 0.7 };
      monolith(mono.x, mono.z, ry);
    }
    // a monolith and a box roundel by the main entrance too (the totem is the big one at the kerb)
    monolith(10.5, 3.4, Math.PI / 2);
  } catch (e) { console.warn('[street] exit canopies failed', e); }

  // ================================================================ bus stops: H (Bridge Street, eastbound, flag only) and G (Parliament Street, shelter)
  const busFlag = (x, z, ry, spec) => {
    M.chunk('busstops'); M.cyl(mats.signGrey, 0.045, 0.06, 3.2, 10, { x, y: 1.6, z }); M.cyl(mats.signGrey, 0.16, 0.18, 0.05, 12, { x, y: 0.025, z });
    const flag = signMat(ctx, busFlagTexture(T, spec), { emissive: 0.45 });
    M.add(mats.white, new THREE.BoxGeometry(0.46, 0.62, 0.05).translate(0.28, 2.85, 0), { x, y: 0, z, ry });
    M.add(flag, new THREE.PlaneGeometry(0.44, 0.6).translate(0.28, 2.85, 0.027), { x, y: 0, z, ry }); M.add(flag, new THREE.PlaneGeometry(0.44, 0.6).rotateY(Math.PI).translate(0.28, 2.85, -0.027), { x, y: 0, z, ry });
    // timetable case
    M.add(mats.signGrey, new THREE.BoxGeometry(0.34, 0.5, 0.06).translate(0.0, 1.55, 0.06), { x, y: 0, z, ry });
    M.add(signMat(ctx, T.sign({ width: 512, height: 768, bg: '#ffffff', lines: [{ text: spec.routes.join(' '), size: 120, color: '#dc241f' }, { text: 'every 8–12 min', size: 48, color: '#111', weight: 'normal' }, { text: spec.towards, size: 40, color: '#111', weight: 'normal' }, { text: 'Hopper fare · touch in', size: 40, color: '#111', weight: 'normal' }] }), { emissive: 0.4 }), new THREE.PlaneGeometry(0.3, 0.46).translate(0.0, 1.55, 0.091), { x, y: 0, z, ry });
    post(x, z, 0.18, 3.3, 'busFlag');
  };
  try {
    const bs = S.busStop; busFlag(bs.x, bs.z + 0.3, 0, { letter: bs.ref || 'H', name: 'Westminster Station', sub: 'Westminster Pier', routes: ['11'], towards: 'towards Waterloo' });
    // Stop G: east footway of Parliament Street, 50 m north of the corner — standard TfL shelter (grey steel + glass), bench, flag
    const gx = S.parliamentStreet.eastFootway[0] + 2.6, gz = -55; M.chunk('busstops');
    for (const dz of [-2.2, 0, 2.2]) M.cyl(mats.steelGrey, 0.05, 0.05, 2.6, 8, { x: gx + 0.6, y: 1.3, z: gz + dz }), M.cyl(mats.steelGrey, 0.05, 0.05, 2.6, 8, { x: gx - 0.7, y: 1.3, z: gz + dz });
    M.box(mats.steelGrey, 1.6, 0.08, 4.8, { x: gx - 0.05, y: 2.62, z: gz }); M.box(mats.glass, 1.5, 0.02, 4.6, { x: gx - 0.05, y: 2.6, z: gz });
    M.quad(mats.glass, 4.4, 2.4, { x: gx + 0.6, y: 1.35, z: gz, facing: 'west' }); M.quad(mats.glass, 1.2, 2.4, { x: gx, y: 1.35, z: gz - 2.2, facing: 'south' });
    M.quad(signMat(ctx, T.poster({ seed: 88, headline: 'Westminster', sub: 'Walk it in 5 minutes' }), { emissive: 0.35 }), 1.1, 1.7, { x: gx - 0.02, y: 1.35, z: gz - 2.15, facing: 'south' });
    M.box(mats.dark, 0.4, 0.06, 3.6, { x: gx + 0.35, y: 0.5, z: gz }); for (const dz of [-1.5, 1.5]) M.box(mats.steelGrey, 0.06, 0.5, 0.06, { x: gx + 0.35, y: 0.25, z: gz + dz });
    M.add(roundelRed, new THREE.TorusGeometry(0.16, 0.04, 6, 24).translate(0, 2.2, 0), { x: gx, y: 0, z: gz + 2.19, ry: 0 }); M.box(mats.blue, 0.45, 0.1, 0.05, { x: gx, y: 2.2, z: gz + 2.19 });
    blk({ xMin: gx - 0.8, xMax: gx + 0.7, yMin: -0.5, yMax: 2.7, zMin: gz - 2.4, zMax: gz - 2.0 }, 'shelter'); blk({ xMin: gx + 0.5, xMax: gx + 0.7, yMin: -0.5, yMax: 2.7, zMin: gz - 2.4, zMax: gz + 2.4 }, 'shelter'); blk({ xMin: gx + 0.1, xMax: gx + 0.6, yMin: -0.5, yMax: 0.6, zMin: gz - 1.8, zMax: gz + 1.8 }, 'shelterBench');
    busFlag(gx - 0.6, gz + 2.9, Math.PI / 2, { letter: 'G', name: 'Westminster Station', sub: 'Parliament Square', routes: ['12', '159', '453'], towards: 'towards Kennington' });
  } catch (e) { console.warn('[street] bus stops failed', e); }

  // ================================================================ lamp columns
  try {
    const H = 8.2;
    const postGeo = latheGeo([[0.42, 0], [0.42, 0.12], [0.3, 0.14], [0.3, 0.9], [0.2, 1.0], [0.16, 1.6], [0.13, 1.7], [0.11, H - 1.4], [0.15, H - 1.3], [0.1, H - 1.2], [0.08, H - 0.5], [0.1, H - 0.4], [0.06, H]], 10);
    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.42, 0.9, 6).translate(0, H + 0.45, 0);
    const roofGeo = (() => { const a = new THREE.ConeGeometry(0.5, 0.45, 6).translate(0, H + 1.12, 0), b = new THREE.CylinderGeometry(0.06, 0.06, 0.25, 6).translate(0, H + 1.45, 0), c = new THREE.CylinderGeometry(0.45, 0.45, 0.06, 6).translate(0, H + 0.02, 0); return mergeParts([a, b, c]); })();
    const posts = I.set(postGeo, mats.ironBlack, { name: 'heritage-lamps' }), bodies = I.set(bodyGeo, lanternGlass, { castShadow: false, name: 'heritage-lanterns' }), roofs = I.set(roofGeo, mats.ironBlack, { castShadow: false, name: 'heritage-lantern-roofs' });
    const ladder = I.set(new THREE.BoxGeometry(0.55, 0.05, 0.05).translate(0, H - 0.9, 0), mats.gilt, { castShadow: false, name: 'lamp-ladder-bars' });
    const heritage = (x, z) => { posts.add(x, 0, z); bodies.add(x, 0, z); roofs.add(x, 0, z); ladder.add(x, 0, z); post(x, z, 0.35, 3, 'lamp'); };
    for (const x of [-60, -42, -16, 17, 26, 42]) heritage(x, 3.9);                                      // north footway (kerb side)
    for (const x of [-72, -52, -32, -12, 8, 28, 54, 66, 78]) heritage(x, 23.0);                        // south footway in front of the railings
    for (const z of [-40, -80, -125, -170, -215, -260, -305, -350]) { heritage(S.parliamentStreet.eastFootway[0] + 1.0, z); heritage(S.parliamentStreet.westFootway[1] - 1.0, z + 22); }
    for (const [x, z] of [[-110, 18], [-110, 58], [-110, 92], [-150, 6.5], [-186, 8], [-186, 50], [-186, 90], [-150, 100], [-120, 100]]) heritage(x, z);
    for (const [x, z] of [[-60, 24.5], [-80, 30]]) heritage(x, z);
    // modern grey columns with flat LED luminaires: Victoria Embankment (both sides), the Embankment corner
    const modGeo = modernLampGeometry(10, 1.8); const mods = I.set(modGeo, mats.signGrey, { name: 'modern-lamps' }); const lum = I.set(new THREE.BoxGeometry(0.6, 0.03, 0.22).translate(1.8, 9.92, 0), mats.plastic, { castShadow: false, name: 'modern-lamp-lenses' });
    const modern = (x, z, ry) => { mods.add(x, 0, z, { ry }); lum.add(x, 0, z, { ry }); post(x, z, 0.2, 3, 'lamp'); };
    for (let z = -30; z > P.riverside.zMin + 10; z -= 36) modern(S.riversidePavement.xMin + 1.0, z, Math.PI);       // riverside footway, arm over the road (-x)
    for (let z = -48; z > P.embPavementW.zMin + 10; z -= 36) modern(S.embankmentPavementWest.xMax - 1.0, z, 0);   // west footway, arm over the road (+x)
    modern(S.embankmentRoad.xMax + 1.0, -8, Math.PI);
  } catch (e) { console.warn('[street] lamp columns failed', e); }

  // ================================================================ bollards: black steel along the Portcullis House kerb (taxi drop-off), PAS68 security row along the Palace footway
  try {
    const bol = I.set(bollardGeometry(1.0, 0.11), mats.ironBlack, { name: 'bollards' }); const sec = I.set(bollardGeometry(1.0, 0.16), mats.barrierGrey, { name: 'security-bollards' });
    const skipN = [[S.totem.x, 1.0], [S.phoneBox.x, 1.2], [S.busStop.x, 1.2], [10.5, 0.8], [-8, 8.5]];
    for (let x = -36; x <= 44; x += 1.6) { if (skipN.some(([sx, r]) => Math.abs(x - sx) < r)) continue; if (Math.abs(x) < 8.5) continue; bol.add(x, 0, 4.55); post(x, 4.55, 0.16, 1.0, 'bollard'); }
    const cx = P.crossings.pelicanX, zx = P.crossings.zebraX;
    for (let x = -84; x <= 82; x += 1.4) { if (Math.abs(x - cx) < 3.2 || Math.abs(x - zx) < 3.2) continue; sec.add(x, 0, 22.5); post(x, 22.5, 0.2, 1.0, 'securityBollard'); }
    for (let z = 24; z <= 32; z += 1.4) { sec.add(83.0, 0, z); post(83.0, z, 0.2, 1.0, 'securityBollard'); }                       // the bridge abutment corner
    for (const [x, z] of [[-79, 24], [-79, 26], [-79, 28]]) { bol.add(x, 0, z); post(x, z, 0.16, 1.0, 'bollard'); }
    for (const x of [-4.5, -2, 2, 4.5]) { bol.add(x, 0, 4.55); post(x, 4.55, 0.16, 1.0, 'bollard'); }                           // either side of the totem, leaving the taxi drop-off gap
  } catch (e) { console.warn('[street] bollards failed', e); }

  // ================================================================ small furniture: litter bins, the K6, a pillar box, CCTV masts, benches
  try {
    const binGeo = mergeParts([new THREE.CylinderGeometry(0.33, 0.3, 1.0, 12).translate(0, 0.5, 0), new THREE.CylinderGeometry(0.36, 0.36, 0.06, 12).translate(0, 1.03, 0), new THREE.CylinderGeometry(0.34, 0.34, 0.05, 12).translate(0, 0.78, 0)]);
    const bins = I.set(binGeo, mats.ironBlack, { name: 'litter-bins' }); const binBand = I.set(new THREE.CylinderGeometry(0.335, 0.335, 0.05, 12).translate(0, 0.62, 0), mats.gilt, { castShadow: false, name: 'bin-bands' });
    for (const [x, z] of [[-32, 3.3], [14, 3.3], [38, 3.5], [-50, 23.6], [2, 23.6], [30, 23.6], [56, 24.2], [70, 30], [74, -32], [75, -96], [-76.8, -44], [-101.2, -44], [-111, 30], [-111, 70], [46, -8]]) { bins.add(x, 0, z); binBand.add(x, 0, z); post(x, z, 0.36, 1.1, 'bin'); }
    // the K6 telephone box (Giles Gilbert Scott, 1936): red, 0.92 m square, 2.5 m to the domed roof, 'TELEPHONE' band
    { const k = S.phoneBox; M.chunk('small'); const k6 = signMat(ctx, k6Texture(T), { emissive: 0.15 });
      M.boxUp(mats.k6Red || (mats.k6Red = paint(0xb3181c, 0.45, 0.15)), 0.92, 2.4, 0.92, { x: k.x, y: 0, z: k.z });
      for (const [ox, oz, f] of [[0, 0.461, 'south'], [0, -0.461, 'north'], [0.461, 0, 'east'], [-0.461, 0, 'west']]) M.quad(k6, 0.92, 2.4, { x: k.x + ox, y: 1.2, z: k.z + oz, facing: f });
      M.add(mats.k6Red, new THREE.SphereGeometry(0.62, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1).translate(0, 2.4, 0), { x: k.x, y: 0, z: k.z });
      M.box(mats.k6Red, 1.0, 0.08, 1.0, { x: k.x, y: 2.42, z: k.z }); M.sphere(mats.gilt, 0.05, { x: k.x, y: 2.72, z: k.z });
      blk({ xMin: k.x - 0.5, xMax: k.x + 0.5, yMin: -0.5, yMax: 2.8, zMin: k.z - 0.5, zMax: k.z + 0.5 }, 'k6'); }
    // Royal Mail pillar box near the Parliament Street corner
    { const x = -64, z = 3.4; M.chunk('small'); M.cyl(mats.k6Red, 0.28, 0.3, 1.45, 14, { x, y: 0.725, z }); M.cyl(mats.dark, 0.31, 0.31, 0.12, 14, { x, y: 0.06, z }); M.cyl(mats.k6Red, 0.34, 0.3, 0.1, 14, { x, y: 1.5, z }); M.sphere(mats.k6Red, 0.2, { x, y: 1.56, z }); M.box(mats.dark, 0.3, 0.03, 0.05, { x, y: 1.2, z: z + 0.29 });
      M.quad(signMat(ctx, T.sign({ width: 256, height: 384, bg: '#b3181c', lines: [{ text: 'ER', x: 128, y: 120, size: 84, align: 'center', color: '#f6e6a0' }, { text: 'POST', x: 128, y: 250, size: 54, align: 'center', color: '#f6e6a0' }, { text: 'OFFICE', x: 128, y: 320, size: 54, align: 'center', color: '#f6e6a0' }] }), { emissive: 0.2 }), 0.28, 0.42, { x, y: 0.85, z: z + 0.305, facing: 'south' });
      post(x, z, 0.35, 1.7, 'pillarBox'); }
    // CCTV masts (grey pole, camera heads, control cabinet)
    for (const [x, z] of [[44.6, 4.2], [67.5, 23.3], [-79.5, 3.4], [80, -60]]) { M.chunk('small'); M.cyl(mats.signGrey, 0.06, 0.09, 7, 8, { x, y: 3.5, z }); M.box(mats.dark, 0.14, 0.12, 0.34, { x: x + 0.1, y: 6.9, z, ry: 0.6 }); M.box(mats.dark, 0.14, 0.12, 0.34, { x: x - 0.1, y: 6.7, z, ry: -2.1 }); M.boxUp(mats.signGrey, 0.5, 1.2, 0.35, { x: x + 0.4, y: 0, z }); blk({ xMin: x - 0.2, xMax: x + 0.7, yMin: -0.5, yMax: 1.3, zMin: z - 0.25, zMax: z + 0.25 }, 'cctv'); }
    // Embankment benches (cast-iron ends, hardwood slats) facing the river; Parliament Square benches
    const bench = (x, z, ry) => { M.chunk('small'); for (const s of [-0.85, 0.85]) M.add(mats.ironBlack, new THREE.BoxGeometry(0.08, 0.45, 0.5).translate(s, 0.225, 0), { x, y: 0, z, ry }); for (let k = 0; k < 4; k++) M.add(mats.bark, new THREE.BoxGeometry(1.8, 0.04, 0.09).translate(0, 0.45, -0.2 + k * 0.12), { x, y: 0, z, ry }); for (let k = 0; k < 3; k++) M.add(mats.bark, new THREE.BoxGeometry(1.8, 0.09, 0.04).translate(0, 0.62 + k * 0.13, 0.24), { x, y: 0, z, ry }); for (const s of [-0.85, 0.85]) M.add(mats.ironBlack, new THREE.BoxGeometry(0.08, 0.5, 0.06).translate(s, 0.72, 0.24), { x, y: 0, z, ry }); blk({ xMin: x - 1.0, xMax: x + 1.0, yMin: -0.5, yMax: 1.0, zMin: z - 0.4, zMax: z + 0.4 }, 'bench'); };
    for (const z of [-26, -100, -150, -200, -250]) bench(S.riverWallX - 2.2, z, -Math.PI / 2);
    for (const [x, z] of [[-114, 40], [-114, 70]]) bench(x, z, Math.PI / 2);
  } catch (e) { console.warn('[street] small furniture failed', e); }

  // ================================================================ Belisha beacons at the Parliament Street zebra (flashing amber globes) + pedestrian guard rails
  try {
    const zx = P.crossings.zebraX; const beaconMat = new THREE.MeshStandardMaterial({ color: 0xffb300, emissive: 0xffb300, emissiveIntensity: 1.6, roughness: 0.5 });
    M.chunk('beacons');
    for (const z of [P.bridgeSt.zMin - 0.5, P.bridgeSt.zMax + 0.5]) for (const dx of [-2.2, 2.2]) { M.cyl(mats.stripe, 0.05, 0.05, 2.9, 8, { x: zx + dx, y: 1.45, z }); M.sphere(beaconMat, 0.16, { x: zx + dx, y: 3.05, z }); post(zx + dx, z, 0.12, 3, 'belisha'); }
    let t = 0; ctx.onUpdate((dt) => { t += dt; beaconMat.emissiveIntensity = (Math.floor(t / 0.75) % 2) ? 1.8 : 0.15; });
    state.beaconMat = beaconMat;
  } catch (e) { console.warn('[street] Belisha beacons failed', e); }

  // ================================================================ the Big Ben corner: hot-dog cart, souvenir stand with bunting, a Union-flag postcard rack
  try {
    M.chunk('kiosks');
    { const x = 60, z = 26.2; M.box(mats.chrome, 1.9, 0.9, 1.0, { x, y: 1.0, z }); M.box(mats.white, 1.9, 0.3, 1.0, { x, y: 0.4, z }); for (const s of [-0.7, 0.7]) M.cyl(mats.tyre, 0.25, 0.25, 0.08, 12, { x: x + s, y: 0.25, z: z + 0.55, rx: Math.PI / 2 }); M.cyl(mats.signGrey, 0.03, 0.03, 2.2, 6, { x, y: 2.3, z }); M.cone(mats.kioskRed, 1.4, 0.5, 10, { x, y: 3.35, z }); M.cone(mats.white, 1.05, 0.38, 10, { x, y: 3.4, z });
      M.quad(signMat(ctx, T.sign({ width: 512, height: 128, bg: '#b0201c', lines: [{ text: 'HOT DOGS  ·  DRINKS', x: 256, y: 92, size: 60, align: 'center', color: '#fff3d0' }] }), { emissive: 0.4 }), 1.7, 0.4, { x, y: 1.25, z: z - 0.51, facing: 'north' });
      blk({ xMin: x - 1.0, xMax: x + 1.0, yMin: -0.5, yMax: 1.6, zMin: z - 0.6, zMax: z + 0.6 }, 'cart'); }
    { const x = 52, z = 31.2; M.box(mats.dark, 2.4, 0.06, 0.9, { x, y: 0.85, z }); for (const [sx, sz] of [[-1.1, -0.35], [1.1, -0.35], [-1.1, 0.35], [1.1, 0.35]]) M.cyl(mats.signGrey, 0.02, 0.02, 0.85, 6, { x: x + sx, y: 0.42, z: z + sz });
      M.box(mats.white, 2.4, 0.02, 0.9, { x, y: 0.88, z }); M.boxUp(mats.dark, 0.5, 1.4, 0.5, { x: x - 0.8, y: 0.88, z: z + 0.1 });
      const cards = T.sign({ width: 512, height: 512, bg: '#e8e0cc', lines: [{ text: 'LONDON', x: 256, y: 90, size: 70, align: 'center', color: '#c8102e' }], fills: [{ color: '#012169', x: 40, y: 140, w: 180, h: 120 }, { color: '#c8102e', x: 290, y: 140, w: 180, h: 120 }, { color: '#4d6b8a', x: 40, y: 300, w: 180, h: 120 }, { color: '#c9a227', x: 290, y: 300, w: 180, h: 120 }] });
      const cm = signMat(ctx, cards, { emissive: 0.3 }); M.quad(cm, 0.48, 1.3, { x: x - 0.8, y: 1.55, z: z + 0.36, facing: 'south' }); M.quad(cm, 0.48, 1.3, { x: x - 0.8, y: 1.55, z: z - 0.16, facing: 'north' }); M.quad(cm, 1.4, 0.8, { x: x + 0.4, y: 0.9, z, facing: 'south', ry: -Math.PI / 2 + 0.0 });
      for (let k = 0; k < 8; k++) { const t = k / 7; M.box(k % 2 ? mats.k6Red : mats.blue, 0.22, 0.16, 0.01, { x: x - 1.2 + t * 2.4, y: 2.2 - Math.sin(t * Math.PI) * 0.12, z: z - 0.45 }); } M.tube(mats.dark, { x: x - 1.25, y: 2.35, z: z - 0.45 }, { x: x + 1.25, y: 2.35, z: z - 0.45 }, 0.008, 4);
      for (const sx of [-1.25, 1.25]) M.cyl(mats.signGrey, 0.02, 0.02, 2.4, 6, { x: x + sx, y: 1.2, z: z - 0.45 });
      blk({ xMin: x - 1.3, xMax: x + 1.3, yMin: -0.5, yMax: 1.6, zMin: z - 0.6, zMax: z + 0.6 }, 'souvenirs'); }
  } catch (e) { console.warn('[street] kiosks failed', e); }

  // ================================================================ Embankment plane trees (road side of the riverside footway) and Parliament Street corner trees
  try {
    if (state.trees) { for (let z = -24; z > P.riverside.zMin + 12; z -= 22) state.trees.tree(S.riversidePavement.xMin + 2.6 + (rnd() - 0.5), z + (rnd() - 0.5) * 2, 7.5 + rnd() * 2, 4.6 + rnd() * 1.2, 1.15);
      for (let z = -70; z > P.embPavementW.zMin + 12; z -= 26) state.trees.tree(S.embankmentPavementWest.xMin + 3.0, z, 7 + rnd() * 2, 4.2 + rnd(), 1.1);
      for (const [x, z] of [[-112, 12], [-112, 48], [-112, 84]]) state.trees.tree(x, z, 6, 4.0, 1.2);
      for (let z = -60; z > -370; z -= 40) state.trees.tree(S.parliamentStreet.westFootway[1] - 3.5, z, 6.5, 3.8, 1.1); }
  } catch (e) { console.warn('[street] trees failed', e); }

  // ================================================================ pigeons: an instanced flock pecking on the pavements
  try {
    const pigeonMat = paint(0x71727a, 0.9, 0); const pg = I.set(pigeonGeometry(), pigeonMat, { castShadow: false, name: 'pigeons' });
    const homes = [{ xMin: -20, xMax: 30, zMin: 0.3, zMax: 4.2 }, { xMin: 28, xMax: 62, zMin: 23, zMax: 32.4 }, { xMin: 68, xMax: 82, zMin: -40, zMax: -6 }];
    const birds = [];
    for (let i = 0; i < 18; i++) { const h = homes[i % homes.length]; const b = { home: h, x: h.xMin + rnd() * (h.xMax - h.xMin), z: h.zMin + rnd() * (h.zMax - h.zMin), yaw: rnd() * 6.28, mode: 'peck', t: rnd() * 3, phase: rnd() * 6.28 }; birds.push(b); pg.add(b.x, 0, b.z, { ry: b.yaw }); }
    state.pigeons = birds;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    ctx.onUpdate((dt, el) => {
      const mesh = pg.mesh; if (!mesh) return; let dirty = false;
      for (let i = 0; i < birds.length; i++) {
        const b = birds[i]; b.t -= dt;
        if (b.t <= 0) { b.mode = rnd() < 0.6 ? 'peck' : 'walk'; b.t = 1 + rnd() * 3; if (b.mode === 'walk') b.yaw = rnd() * 6.28; }
        if (b.mode === 'walk') { const nx = b.x + Math.sin(b.yaw) * 0.35 * dt, nz = b.z + Math.cos(b.yaw) * 0.35 * dt; if (nx < b.home.xMin || nx > b.home.xMax || nz < b.home.zMin || nz > b.home.zMax) b.yaw += Math.PI; else { b.x = nx; b.z = nz; } }
        const peck = b.mode === 'peck' ? Math.max(0, Math.sin(el * 6 + b.phase)) * 0.45 : Math.sin(el * 9 + b.phase) * 0.05;
        e.set(peck, b.yaw, 0, 'YXZ'); q.setFromEuler(e); v.set(b.x, 0, b.z); m4.compose(v, q, sc); mesh.setMatrixAt(i, m4); dirty = true;
      }
      if (dirty) mesh.instanceMatrix.needsUpdate = true;
    });
  } catch (e) { console.warn('[street] pigeons failed', e); }

  M.flush(); I.flush();
  return { pigeons: state.pigeons || [] };
}

/** Merge non-indexed geometries (positions/normals/uvs) into one. */
function mergeParts(parts) {
  const np = parts.map(g => g.toNonIndexed()); let total = 0; np.forEach(g => total += g.attributes.position.count);
  const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3), uv = new Float32Array(total * 2); let o = 0;
  for (const g of np) { pos.set(g.attributes.position.array, o * 3); nrm.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}
void COL; void hex; void FONT;
