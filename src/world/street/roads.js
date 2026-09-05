// ---------------------------------------------------------------------------
// street/roads.js — the ground plane of Westminster: carriageways (Bridge Street, Victoria Embankment,
// Parliament Street / St Margaret Street, the Parliament Square gyratory), York-stone pavements with
// granite kerbs, red-route and lane markings, the westbound bus lane, the CS3 cycle track, the pelican
// crossing at the Embankment junction, the zebra at the Parliament Street corner, the yellow box, drains,
// manholes, tactile paving, lawns — and the collision floors (with holes for the subway stair trenches)
// plus the blockers that keep the player inside the modelled world.
// All positions derive from layout.STREET via makePlan().
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { Merger, Instancer, makeMaterials, COL, signMat, DEG } from './kit.js';

/** The street's derived plan (every rectangle used by the street sub-modules). */
export function makePlan(layout) {
  const S = layout.STREET, TH = layout.TICKET_HALL;
  const e3 = S.exit3, e2 = S.exit2, e1 = S.exit1, e5 = S.exit5, e6 = S.exit6;
  return {
    ROAD_Y: -0.15, KERB: 0.15, S,
    bridgeSt: { xMin: -100, xMax: S.bridgeStreetX.max, zMin: S.road.zMin, zMax: S.road.zMax },
    embankment: { xMin: S.embankmentRoad.xMin, xMax: S.embankmentRoad.xMax, zMin: -480, zMax: S.road.zMin },
    parliamentSt: { xMin: S.parliamentStreet.xMin, xMax: S.parliamentStreet.xMax, zMin: -380, zMax: S.road.zMin },
    stMargaretSt: { xMin: -100, xMax: -86, zMin: S.road.zMax, zMax: 150 },
    greatGeorgeSt: { xMin: -190, xMax: -100, zMin: -8, zMax: S.road.zMin },
    cannonRow: { xMin: S.cannonRow.xMin, xMax: S.cannonRow.xMax, zMin: -110, zMax: S.facadeZ },
    northPavement: { xMin: S.parliamentStreet.xMax, xMax: S.embankmentRoad.xMin, zMin: S.pavementNorth.zMin, zMax: S.pavementNorth.zMax },
    cornerPavement: { xMin: S.embankmentRoad.xMax, xMax: S.riverWallX, zMin: S.pavementNorth.zMin, zMax: S.pavementNorth.zMax },
    southPavement: { xMin: -86, xMax: 16, zMin: S.pavementSouth.zMin, zMax: S.railingsZ },
    plaza: { xMin: 16, xMax: S.riverWallX, zMin: S.pavementSouth.zMin, zMax: 33 },
    speakersGreen: { xMin: S.elizabethTower.x + S.elizabethTower.width / 2 + 0.4, xMax: S.riverWallX, zMin: 33.3, zMax: S.palace.zMin },
    towerRailZ: 33, towerYard: { xMin: 16, xMax: S.elizabethTower.x + S.elizabethTower.width / 2 + 0.4, zMin: 33.3, zMax: S.palace.zMin },
    embPavementW: { xMin: S.embankmentPavementWest.xMin, xMax: S.embankmentPavementWest.xMax, zMin: -480, zMax: S.facadeZ },
    riverside: { xMin: S.riversidePavement.xMin, xMax: S.riverWallX, zMin: -480, zMax: S.pavementNorth.zMin },
    parlE: { xMin: S.parliamentStreet.eastFootway[0], xMax: S.parliamentStreet.eastFootway[1], zMin: -380, zMax: S.facadeZ },
    parlW: { xMin: S.parliamentStreet.westFootway[0], xMax: S.parliamentStreet.westFootway[1], zMin: -380, zMax: -8 },
    squareEast: { xMin: -112, xMax: -100, zMin: S.road.zMin, zMax: 100 },
    gatesPavement: { xMin: -86, xMax: S.newPalaceYard.xMin, zMin: S.road.zMax, zMax: S.newPalaceYard.zMax },
    cromwellPavement: { xMin: -86, xMax: -50, zMin: S.newPalaceYard.zMax, zMax: 150 }, cromwellGreen: { xMin: -50, xMax: S.westminsterHall.xMin, zMin: S.newPalaceYard.zMax, zMax: S.westminsterHall.zMax },
    abingdonPavement: { xMin: -86, xMax: S.palace.xMin, zMin: 150, zMax: 330 },
    squareRing: { xMin: S.parliamentSquare.xMin, xMax: -112, zMin: S.road.zMin, zMax: 100 }, squareLawn: { xMin: S.parliamentSquare.xMin + 4, xMax: -116, zMin: S.parliamentSquare.zMin + 1, zMax: S.parliamentSquare.zMax },
    treasuryPavement: { xMin: S.parliamentSquare.xMin, xMax: -108, zMin: -12, zMax: -8 },
    broadSanctuary: { xMin: -230, xMax: -100, zMin: 100, zMax: 116 },
    bridgeN: { xMin: S.bridge.xMin, xMax: S.bridge.xMax, zMin: S.bridge.zMin, zMax: 4 }, bridgeS: { xMin: S.bridge.xMin, xMax: S.bridge.xMax, zMin: 22, zMax: S.bridge.zMax }, bridgeRoad: { xMin: S.bridge.xMin, xMax: S.bridge.xMax, zMin: 4, zMax: 22 },
    lanes: { cycleN: [5, 8], eastGeneral: [8, 13.5], westGeneral: [13.5, 17.75], westBus: [17.75, 22], centre: 13.5 },
    crossings: { pelicanX: 40, zebraX: -76, embZ: 2.2, stMargaretZ: 30 },
    phGap: { xMin: S.portcullisHouse.xMin, xMax: S.portcullisHouse.xMax, zMin: S.normanShaw.zMax, zMax: S.portcullisHouse.zMin },
    // stair trenches cut through the pavements by the ticket hall module (its stairs rise inside them)
    exitTrenches: [
      { xMin: TH.exit3Passage.xMin, xMax: TH.exit3Passage.xMax, zMin: 18.4, zMax: e3.z + 0.7, name: 'exit3' },
      { xMin: 65.5, xMax: e2.x + 0.5, zMin: e2.z - 2, zMax: e2.z + 2, name: 'exit2' },
      { xMin: 70, xMax: e1.x, zMin: e1.z - 1.5, zMax: e1.z + 1.5, name: 'exit1' },
      { xMin: e5.x - 1.5, xMax: e5.x + 1.5, zMin: -21.7, zMax: e5.z + 4.1, name: 'exit5' },
      { xMin: e6.x - 1.5, xMax: e6.x + 1.5, zMin: -24, zMax: e6.z + 4.8, name: 'exit6' },
    ],
    entranceFloor: { xMin: -6, xMax: 6, zMin: TH.entrancePassage.zMin, zMax: S.facadeZ },   // the ticket hall's street passage (not ours)
  };
}

/** Subtract rectangle h from r → up to 4 rectangles. */
export function subtractRect(r, h) {
  if (h.xMax <= r.xMin || h.xMin >= r.xMax || h.zMax <= r.zMin || h.zMin >= r.zMax) return [r];
  const out = [];
  if (h.zMin > r.zMin) out.push({ xMin: r.xMin, xMax: r.xMax, zMin: r.zMin, zMax: h.zMin });
  if (h.zMax < r.zMax) out.push({ xMin: r.xMin, xMax: r.xMax, zMin: h.zMax, zMax: r.zMax });
  const z0 = Math.max(r.zMin, h.zMin), z1 = Math.min(r.zMax, h.zMax);
  if (h.xMin > r.xMin) out.push({ xMin: r.xMin, xMax: h.xMin, zMin: z0, zMax: z1 });
  if (h.xMax < r.xMax) out.push({ xMin: h.xMax, xMax: r.xMax, zMin: z0, zMax: z1 });
  return out.filter(q => q.xMax - q.xMin > 0.01 && q.zMax - q.zMin > 0.01);
}
export function subtractAll(r, holes) { let list = [r]; for (const h of holes) list = list.flatMap(q => subtractRect(q, h)); return list; }

export function buildRoads(ctx, group, plan) {
  const { layout, collision, T } = ctx; const mats = makeMaterials(ctx); const P = plan; const RY = P.ROAD_Y;
  const M = new Merger(group, 'roads'); const I = new Instancer(group);
  const floors = [], blockers = [];
  const floor = (r, y, sound, tag, holes = []) => { for (const q of subtractAll(r, holes)) floors.push(collision.addFloor({ ...q, y, sound, tag })); };
  const paved = (mat, r, y, chunk, holes = []) => { M.chunk(chunk); for (const q of subtractAll(r, holes)) M.rect(mat, q, y); };

  // ================================================================ carriageways (tarmac at ROAD_Y)
  M.chunk('road-bridgeSt'); M.rect(mats.tarmac, P.bridgeSt, RY); floor(P.bridgeSt, RY, 'hard', 'bridgeStreet');
  M.chunk('road-emb'); M.rect(mats.tarmac, P.embankment, RY); floor(P.embankment, RY, 'hard', 'embankment');
  M.chunk('road-parl'); M.rect(mats.tarmac, P.parliamentSt, RY); floor(P.parliamentSt, RY, 'hard', 'parliamentStreet');
  M.rect(mats.tarmac, P.stMargaretSt, RY); floor(P.stMargaretSt, RY, 'hard', 'stMargaretStreet');
  M.rect(mats.tarmac, P.greatGeorgeSt, RY); floor(P.greatGeorgeSt, RY, 'hard', 'greatGeorgeStreet');
  M.rect(mats.tarmac, P.broadSanctuary, RY); floor(P.broadSanctuary, RY, 'hard', 'broadSanctuary');
  M.rect(mats.tarmac, { xMin: -190, xMax: -175, zMin: 5, zMax: 100 }, RY - 0.001);   // west side of the gyratory (in front of the Supreme Court)
  M.chunk('road-cannon'); M.rect(mats.tarmac, P.cannonRow, RY + 0.12); floor(P.cannonRow, RY + 0.12, 'hard', 'cannonRow');

  // ================================================================ pavements (York stone at 0) with kerbs
  const holes = P.exitTrenches;
  paved(mats.paving, P.northPavement, 0, 'pav-north'); floor(P.northPavement, 0, 'pavement', 'pavementN');
  paved(mats.paving, P.cornerPavement, 0, 'pav-north'); floor(P.cornerPavement, 0, 'pavement', 'boadiceaCorner');
  paved(mats.paving, P.southPavement, 0, 'pav-south'); floor(P.southPavement, 0, 'pavement', 'pavementS');
  paved(mats.paving, P.plaza, 0, 'pav-south', holes); floor(P.plaza, 0, 'pavement', 'bigBenPlaza', holes);
  paved(mats.paving, P.embPavementW, 0, 'pav-emb'); floor(P.embPavementW, 0, 'pavement', 'embankmentW');
  paved(mats.paving, P.riverside, 0, 'pav-river', holes); floor(P.riverside, 0, 'pavement', 'riverside', holes);
  paved(mats.paving, P.parlE, 0, 'pav-parl', holes); floor(P.parlE, 0, 'pavement', 'parliamentE', holes);
  paved(mats.paving, P.parlW, 0, 'pav-parl', holes); floor(P.parlW, 0, 'pavement', 'parliamentW', holes);
  paved(mats.paving, P.squareEast, 0, 'pav-square'); floor(P.squareEast, 0, 'pavement', 'squareEast');
  paved(mats.paving, P.gatesPavement, 0, 'pav-south'); floor(P.gatesPavement, 0, 'pavement', 'carriageGates');
  paved(mats.paving, P.cromwellPavement, 0, 'pav-south'); floor(P.cromwellPavement, 0, 'pavement', 'stMargaretE');
  paved(mats.paving, P.abingdonPavement, 0, 'pav-far'); floor(P.abingdonPavement, 0, 'pavement', 'abingdon');
  paved(mats.paving, P.squareRing, 0, 'pav-square'); floor(P.squareRing, 0, 'pavement', 'squareRing');
  paved(mats.paving, P.treasuryPavement, 0, 'pav-square'); floor(P.treasuryPavement, 0, 'pavement', 'treasury');
  paved(mats.paving, { xMin: -230, xMax: -190, zMin: 5, zMax: 100 }, 0, 'pav-far'); floor({ xMin: -230, xMax: -190, zMin: 5, zMax: 100 }, 0, 'pavement', 'guildhall');
  paved(mats.paving, { xMin: -230, xMax: -100, zMin: 116, zMax: 122 }, 0, 'pav-far'); floor({ xMin: -230, xMax: -100, zMin: 116, zMax: 122 }, 0, 'pavement', 'abbeyPavement');
  paved(mats.paving, P.phGap, 0, 'pav-emb'); floor(P.phGap, 0, 'pavement', 'phGap');
  // lawns
  M.chunk('lawns'); M.rect(mats.grass, P.squareLawn, 0.06); floor(P.squareLawn, 0.06, 'carpet', 'squareLawn');
  M.rect(mats.grass, P.speakersGreen, 0.05); M.rect(mats.grass, P.cromwellGreen, 0.05);
  M.rect(mats.grass, { xMin: layout.STREET.palace.xMin, xMax: layout.STREET.riverWallX, zMin: layout.STREET.palace.zMax, zMax: 420 }, 0.05);   // Victoria Tower Gardens
  M.rect(mats.grass, { xMin: -200, xMax: -100, zMin: 122, zMax: 240 }, 0.05);   // the Abbey's precinct (far)

  // ================================================================ kerbs (granite, 0.3 × 0.17, top flush with the pavement)
  const kerbX = (z, xMin, xMax, side) => { M.chunk('kerbs'); M.box(mats.kerb, xMax - xMin, 0.17, 0.3, { x: (xMin + xMax) / 2, y: -0.08, z: z + side * 0.15 }); };   // along x at z, side = +1 → kerb lies south of z
  const kerbZ = (x, zMin, zMax, side) => { M.chunk('kerbs'); M.box(mats.kerb, 0.3, 0.17, zMax - zMin, { x: x + side * 0.15, y: -0.08, z: (zMin + zMax) / 2 }); };
  kerbX(P.bridgeSt.zMin, P.northPavement.xMin, P.northPavement.xMax, -1); kerbX(P.bridgeSt.zMin, P.cornerPavement.xMin, P.cornerPavement.xMax, -1);
  kerbX(P.bridgeSt.zMax, P.southPavement.xMin, P.plaza.xMax, 1);
  kerbZ(P.embankment.xMin, P.embankment.zMin, P.embankment.zMax, -1); kerbZ(P.embankment.xMax, P.embankment.zMin, P.embankment.zMax, 1);
  kerbZ(P.parliamentSt.xMin, P.parliamentSt.zMin, -8, -1); kerbZ(P.parliamentSt.xMax, P.parliamentSt.zMin, P.parliamentSt.zMax, 1);
  kerbZ(P.stMargaretSt.xMin, P.stMargaretSt.zMin, P.stMargaretSt.zMax, -1); kerbZ(P.stMargaretSt.xMax, P.stMargaretSt.zMin, P.stMargaretSt.zMax, 1);
  kerbX(P.greatGeorgeSt.zMin, P.greatGeorgeSt.xMin, -108, -1); kerbX(P.greatGeorgeSt.zMax, P.greatGeorgeSt.xMin, P.greatGeorgeSt.xMax, 1);
  kerbZ(P.cannonRow.xMin, P.cannonRow.zMin, P.cannonRow.zMax, -1); kerbZ(P.cannonRow.xMax, P.cannonRow.zMin, P.cannonRow.zMax, 1);

  // ================================================================ road markings (thin boxes just above the tarmac)
  const MY = RY + 0.004; M.chunk('markings');
  const lineX = (mat, z, xMin, xMax, w = 0.1) => M.box(mat, xMax - xMin, 0.006, w, { x: (xMin + xMax) / 2, y: MY, z });
  const lineZ = (mat, x, zMin, zMax, w = 0.1) => M.box(mat, w, 0.006, zMax - zMin, { x, y: MY, z: (zMin + zMax) / 2 });
  const dashX = (mat, z, xMin, xMax, mark, gap, w = 0.1) => { for (let x = xMin; x < xMax; x += mark + gap) lineX(mat, z, x, Math.min(xMax, x + mark), w); };
  const dashZ = (mat, x, zMin, zMax, mark, gap, w = 0.1) => { for (let z = zMin; z < zMax; z += mark + gap) lineZ(mat, x, z, Math.min(zMax, z + mark), w); };
  const L = P.lanes; const cx = P.crossings.pelicanX;
  // Bridge Street: centre line (hazard 4/2), lane line, cycle track edge, bus lane
  dashX(mats.whiteLine, L.centre, P.bridgeSt.xMin, P.bridgeSt.xMax, 4, 2); dashX(mats.whiteLine, L.eastGeneral[1], P.bridgeSt.xMin, 34, 2, 7);
  lineX(mats.whiteLine, L.cycleN[1], -72, 36, 0.15);                                             // CS3 segregation line
  M.box(mats.greenCycle, 30, 0.004, 3, { x: 51, y: MY - 0.001, z: 6.5 }); M.box(mats.greenCycle, 28, 0.004, 3, { x: -86, y: MY - 0.001, z: 6.5 });   // green at the junctions
  M.box(mats.busLaneRed, 36 - (-70), 0.004, L.westBus[1] - L.westBus[0] - 0.3, { x: (36 - 70) / 2, y: MY - 0.001, z: (L.westBus[0] + L.westBus[1]) / 2 }); lineX(mats.whiteLine, L.westBus[0], -70, 36, 0.15);
  // double red lines (TfL red route) along both kerbs, broken at the bus stop cage and the crossings
  const redRoute = (z, xMin, xMax, side) => { for (const [a, b] of [[xMin, -34], [-14, cx - 3], [cx + 3, xMax]]) if (b > a) { lineX(mats.redRoute, z + side * 0.2, a, b, 0.08); lineX(mats.redRoute, z + side * 0.4, a, b, 0.08); } };
  redRoute(P.bridgeSt.zMin, P.bridgeSt.xMin, P.bridgeSt.xMax, 1); redRoute(P.bridgeSt.zMax, P.bridgeSt.xMin, P.bridgeSt.xMax, -1);
  // bus stop H cage (eastbound, north kerb): yellow dashed box + 'BUS STOP' lettering
  { const bs = layout.STREET.busStop; const x0 = bs.x - 10, x1 = bs.x + 8; dashX(mats.yellowLine, L.eastGeneral[1] - 0.2, x0, x1, 0.6, 0.3, 0.1); dashZ(mats.yellowLine, x0, L.cycleN[1], L.eastGeneral[1], 0.6, 0.3, 0.1); dashZ(mats.yellowLine, x1, L.cycleN[1], L.eastGeneral[1], 0.6, 0.3, 0.1);
    const t = T.sign({ width: 512, height: 128, bg: '#00000000', lines: [{ text: 'BUS STOP', x: 256, y: 100, size: 96, align: 'center', color: '#ffd300' }] }); const m = signMat(ctx, t, { emissive: 0.15, transparent: true }); M.flat(m, 6, 1.5, { x: bs.x, y: MY + 0.002, z: (L.eastGeneral[0] + L.eastGeneral[1]) / 2, metric: false }); }
  // pelican crossing across Bridge Street at x = pelicanX: stop lines, studs, zigzags, 'LOOK RIGHT / LEFT'
  lineZ(mats.whiteLine, cx - 4, L.cycleN[0], L.centre, 0.3); lineZ(mats.whiteLine, cx + 4, L.centre, L.westBus[1], 0.3);
  const stud = I.set(new THREE.BoxGeometry(0.1, 0.012, 0.1), mats.whiteLine, { castShadow: false, name: 'studs' });
  for (let z = P.bridgeSt.zMin + 0.4; z < P.bridgeSt.zMax; z += 0.5) { stud.add(cx - 1.6, MY, z); stud.add(cx + 1.6, MY, z); }
  const zig = (z, xMin, xMax) => { const n = Math.round((xMax - xMin) / 2.2); for (let i = 0; i < n; i++) { const x0 = xMin + i * 2.2, x1 = x0 + 2.2; const a = new THREE.Vector3(x0, MY, z + (i % 2 ? 0.6 : -0.6)), b = new THREE.Vector3(x1, MY, z + (i % 2 ? -0.6 : 0.6)); M.tube(mats.whiteLine, a, b, 0.05, 4); } };
  zig(P.bridgeSt.zMin + 0.9, cx - 22, cx - 4); zig(P.bridgeSt.zMin + 0.9, cx + 4, cx + 22); zig(P.bridgeSt.zMax - 0.9, cx - 22, cx - 4); zig(P.bridgeSt.zMax - 0.9, cx + 4, cx + 22);
  const look = (text, x, z, ry) => { const t = T.sign({ width: 512, height: 128, bg: '#00000000', lines: [{ text, x: 256, y: 100, size: 88, align: 'center', color: '#f4f4f0' }] }); M.flat(signMat(ctx, t, { emissive: 0.15, transparent: true }), 3, 0.75, { x, y: MY + 0.002, z, metric: false, ry }); };
  look('LOOK RIGHT', cx, P.bridgeSt.zMin + 1.0, Math.PI); look('LOOK LEFT', cx, P.bridgeSt.zMax - 1.0, 0);
  // crossing over the Embankment at z = embZ (part of the same signalised junction)
  { const ez = P.crossings.embZ; for (let x = P.embankment.xMin + 0.4; x < P.embankment.xMax; x += 0.5) { stud.add(x, MY, ez - 1.6); stud.add(x, MY, ez + 1.6); } lineX(mats.whiteLine, ez - 4, P.embankment.xMin, 57, 0.3); }
  // yellow box junction
  { const b = { xMin: P.embankment.xMin + 0.5, xMax: P.embankment.xMax - 0.5, zMin: P.bridgeSt.zMin + 0.5, zMax: P.bridgeSt.zMax - 0.5 }; lineX(mats.yellowLine, b.zMin, b.xMin, b.xMax); lineX(mats.yellowLine, b.zMax, b.xMin, b.xMax); lineZ(mats.yellowLine, b.xMin, b.zMin, b.zMax); lineZ(mats.yellowLine, b.xMax, b.zMin, b.zMax);
    const w = b.xMax - b.xMin, d = b.zMax - b.zMin;
    for (let o = -d; o < w; o += 2.6) { const t0 = Math.max(0, -o), t1 = Math.min(d, w - o); if (t1 - t0 < 0.5) continue;   // both diagonal families, clipped to the box
      M.tube(mats.yellowLine, new THREE.Vector3(b.xMin + o + t0, MY, b.zMin + t0), new THREE.Vector3(b.xMin + o + t1, MY, b.zMin + t1), 0.05, 4);
      M.tube(mats.yellowLine, new THREE.Vector3(b.xMin + o + t0, MY, b.zMax - t0), new THREE.Vector3(b.xMin + o + t1, MY, b.zMax - t1), 0.05, 4); } }
  // zebra at the Parliament Street corner (x = zebraX): stripes along the road direction, zigzags, give-way line
  { const zx = P.crossings.zebraX; for (let z = P.bridgeSt.zMin + 0.25; z < P.bridgeSt.zMax - 0.25; z += 1.0) M.box(mats.whiteLine, 3.0, 0.006, 0.5, { x: zx, y: MY, z }); zig(P.bridgeSt.zMin + 0.9, zx - 16, zx - 2.5); zig(P.bridgeSt.zMin + 0.9, zx + 2.5, zx + 10); zig(P.bridgeSt.zMax - 0.9, zx - 16, zx - 2.5); zig(P.bridgeSt.zMax - 0.9, zx + 2.5, zx + 10); }
  // Embankment: centre line, lane lines, red route; Parliament Street: centre, lanes, double yellows; St Margaret St
  dashZ(mats.whiteLine, (P.embankment.xMin + P.embankment.xMax) / 2, P.embankment.zMin, P.embankment.zMax - 8, 4, 2); dashZ(mats.whiteLine, P.embankment.xMin + 4.5, P.embankment.zMin, P.embankment.zMax - 8, 2, 7); dashZ(mats.whiteLine, P.embankment.xMax - 4.5, P.embankment.zMin, P.embankment.zMax - 8, 2, 7);
  for (const [x, s] of [[P.embankment.xMin, 1], [P.embankment.xMax, -1]]) { lineZ(mats.redRoute, x + s * 0.2, P.embankment.zMin, P.embankment.zMax - 6, 0.08); lineZ(mats.redRoute, x + s * 0.4, P.embankment.zMin, P.embankment.zMax - 6, 0.08); }
  dashZ(mats.whiteLine, (P.parliamentSt.xMin + P.parliamentSt.xMax) / 2, P.parliamentSt.zMin, P.parliamentSt.zMax - 6, 4, 2); dashZ(mats.whiteLine, P.parliamentSt.xMin + 5.5, P.parliamentSt.zMin, P.parliamentSt.zMax - 6, 2, 7); dashZ(mats.whiteLine, P.parliamentSt.xMax - 5.5, P.parliamentSt.zMin, P.parliamentSt.zMax - 6, 2, 7);
  for (const [x, s] of [[P.parliamentSt.xMin, 1], [P.parliamentSt.xMax, -1]]) { lineZ(mats.yellowLine, x + s * 0.2, P.parliamentSt.zMin, -8, 0.08); lineZ(mats.yellowLine, x + s * 0.4, P.parliamentSt.zMin, -8, 0.08); }
  dashZ(mats.whiteLine, -93, P.stMargaretSt.zMin + 4, P.stMargaretSt.zMax, 4, 2); dashX(mats.whiteLine, -1.5, P.greatGeorgeSt.xMin, P.greatGeorgeSt.xMax - 4, 4, 2);
  lineZ(mats.whiteLine, P.parliamentSt.xMin + 0.2, -8, P.parliamentSt.zMax, 0.3);   // give-way at the corner
  // Parliament Street / Bridge Street: stop line & studs for the pedestrian crossing at z = -6 (Exit 5 / Exit 6 link)
  { for (let x = P.parliamentSt.xMin + 0.4; x < P.parliamentSt.xMax; x += 0.5) { stud.add(x, MY, -7.6); stud.add(x, MY, -4.4); } lineX(mats.whiteLine, -10, P.parliamentSt.xMin, -89, 0.3); }

  // ================================================================ drains, manholes, tactile paving
  const gully = I.set(new THREE.BoxGeometry(0.45, 0.02, 0.35), mats.dark, { castShadow: false, name: 'gullies' });
  for (let x = P.bridgeSt.xMin + 12; x < P.bridgeSt.xMax; x += 25) { gully.add(x, RY + 0.005, P.bridgeSt.zMin + 0.45); gully.add(x + 11, RY + 0.005, P.bridgeSt.zMax - 0.45); }
  for (let z = P.embankment.zMin + 10; z < P.embankment.zMax - 8; z += 27) { gully.add(P.embankment.xMin + 0.45, RY + 0.005, z, { ry: Math.PI / 2 }); gully.add(P.embankment.xMax - 0.45, RY + 0.005, z + 13, { ry: Math.PI / 2 }); }
  for (let z = P.parliamentSt.zMin + 10; z < P.parliamentSt.zMax - 8; z += 27) { gully.add(P.parliamentSt.xMin + 0.45, RY + 0.005, z, { ry: Math.PI / 2 }); gully.add(P.parliamentSt.xMax - 0.45, RY + 0.005, z + 13, { ry: Math.PI / 2 }); }
  const manhole = I.set(new THREE.CylinderGeometry(0.33, 0.33, 0.02, 14), mats.steelGrey, { castShadow: false, name: 'manholes' });
  for (const [x, z] of [[-60, 10], [-20, 16], [14, 9], [30, 18], [60, 12], [56, -30], [60, -80], [-89, -40], [-89, -120], [-40, 2], [20, 3], [-70, 25]]) manhole.add(x, (z >= 5 && z <= 22) || x < -78 || (x > 48 && x < 66) ? RY + 0.005 : 0.005, z);
  const tactileRed = ctx.M.tactile('blister', 0xa83a2e), tactileBuff = ctx.M.tactile('blister', 0xb9a889);
  M.chunk('tactile'); for (const [x, z, w, d, mat] of [[cx, P.bridgeSt.zMin - 0.7, 3.2, 1.2, tactileRed], [cx, P.bridgeSt.zMax + 0.7, 3.2, 1.2, tactileRed], [P.embankment.xMin - 0.7, P.crossings.embZ, 1.2, 3.2, tactileRed], [P.embankment.xMax + 0.7, P.crossings.embZ, 1.2, 3.2, tactileRed], [P.crossings.zebraX, P.bridgeSt.zMin - 0.7, 3.2, 1.2, tactileBuff], [P.crossings.zebraX, P.bridgeSt.zMax + 0.7, 3.2, 1.2, tactileBuff], [P.parliamentSt.xMin - 0.7, -6, 1.2, 3.2, tactileRed], [P.parliamentSt.xMax + 0.7, -6, 1.2, 3.2, tactileRed]]) M.flat(mat, w, d, { x, y: 0.004, z });

  // ================================================================ world-edge blockers (railings / building lines, never invisible mid-street walls)
  const blk = (r, tag, yMax = 2.2) => blockers.push(collision.addBlocker({ ...r, yMin: -1, yMax }, tag));
  blk({ xMin: -232, xMax: -230, zMin: -20, zMax: 130 }, 'edge:west'); blk({ xMin: -232, xMax: -100, zMin: 122, zMax: 124 }, 'edge:abbey');
  blk({ xMin: P.parlW.xMin - 1, xMax: P.parlE.xMax + 1, zMin: -382, zMax: -380 }, 'edge:whitehallN');
  blk({ xMin: P.embPavementW.xMin - 1, xMax: P.riverside.xMax + 1, zMin: -482, zMax: -480 }, 'edge:embankmentN');
  blk({ xMin: -102, xMax: -84, zMin: 150, zMax: 152 }, 'edge:stMargaretS'); blk({ xMin: -88, xMax: -28, zMin: 330, zMax: 332 }, 'edge:abingdonS');
  M.flush({ castShadow: false }); I.flush();
  return { floors, blockers };
}
