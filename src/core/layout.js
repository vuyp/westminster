// ---------------------------------------------------------------------------
// layout.js — THE geometry contract for the whole station (v2, from the dossier).
//
// Units: metres. Y up. +X = east, +Z = south (north is -Z).
// Origin: the main Bridge Street entrance (Exit 4) in the Portcullis House
// arcade; street level y = 0.
//
// Topology (see docs/WESTMINSTER_REFERENCE.md §2–§7):
//  * Portcullis House (77 × 50 m) sits over the station; its south face is the
//    arcade on Bridge Street at z = -3.
//  * The Jubilee box (80 × 26 m, long axis E–W) lies under the southern strip
//    of Portcullis House: x -40..40, z -29..-3, 39 m deep.
//  * The two Jubilee platform tunnels (7 m i.d.) are STACKED under Bridge
//    Street, immediately south of the box's south wall: Platform 3 eastbound
//    (upper) over Platform 4 westbound (lower). Platforms are on the NORTH
//    (box) side of the track; short passages lead north into the box's EAST
//    and WEST wells at each level.
//  * The District & Circle lines cross the site diagonally (SW → NE) just
//    below the concourse: Platform 1 westbound on the SE side, Platform 2
//    eastbound on the NW side.
//  * Concourse (ticket hall) at -3.6 m; interchange level in the top of the
//    box in two parts (EAST -9.5 m, WEST -14 m); 7 escalator banks criss-cross.
// Every world module places things using these numbers. Tune here, not there.
// ---------------------------------------------------------------------------

export const LEVELS = {
  street: 0,
  concourse: -3.6,            // ticket hall floor (16 steps below the arcade)
  concourseCeiling: -0.7,     // underside of the transfer slab (coffered concrete grid; beams down to beamSoffit)
  concourseBeamSoffit: -1.3,
  ticketHall: -3.6,           // alias
  ticketHallCeiling: -0.7,    // alias
  dcPlatform: -8.5,           // District & Circle platform surface
  dcRail: -9.43,              // rail head (S7 floor 1.005 m above rail; platform c. 0.93 m above rail)
  dcCeiling: -4.6,            // soffit of the concourse slab beams over the sub-surface platforms
  interchangeEast: -9.5,      // Jubilee interchange level, EAST section (foot of bank a, head of bank b)
  interchangeWest: -14.0,     // Jubilee interchange level, WEST section (foot of banks c & d, head of bank e)
  jubUpper: -23.0,            // Platform 3 (eastbound) surface
  jubLower: -32.5,            // Platform 4 (westbound) surface
  jubRailOffset: -0.66,       // rail head relative to a tube platform surface
  boxFloor: -39.0,            // top of the base slab
  boxTop: -3.6,               // the concourse slab is the lid of the box
};

// ---------------------------------------------------------------------------
// STREET LEVEL
// ---------------------------------------------------------------------------
export const STREET = {
  facadeZ: -3,                                   // Portcullis House south face / arcade line
  pavementNorth: { zMin: -3, zMax: 5 },          // arcade + pavement in front of the entrance (roundel totem at the kerb)
  road: { zMin: 5, zMax: 22 },                   // Bridge Street carriageway (two-way; buses)
  pavementSouth: { zMin: 22, zMax: 27 },
  railingsZ: 27,                                 // New Palace Yard railings (Barry, 1868; 2.1 m, black iron with gilt tips)
  bridgeStreetX: { min: -78, max: 84 },          // Parliament Street corner (west) → Westminster Bridge abutment (east); bearing 93°
  portcullisHouse: { xMin: -38, xMax: 39, zMin: -53, zMax: -3, height: 34, roofHeight: 9, chimneys: 14, colonnadeDepth: 5, storeys: 7 },
  normanShaw: { xMin: -38, xMax: 39, zMin: -110, zMax: -60, height: 30 },   // Norman Shaw South (red brick / Portland bands) north of PH
  entranceMain: { x: 0, z: -3, width: 12 },      // Exit 4 'Bridge Street': 12 m opening in the arcade; passage north, lift on the west, 16 steps down
  exit3: { x: 46, z: 29, width: 4 },             // Exit 3 'Houses of Parliament': subway stair on the SOUTH pavement at the foot of Big Ben
  exit2: { x: 76, z: -10, width: 4 },            // Exit 2 'Victoria Embankment': stair at the NW corner of the bridge, by Boadicea (cast-iron arch canopy)
  exit1: { x: 80, z: -16, width: 3, stairs: true },   // Exit 1 'Westminster Pier': stair onto the river wall pavement (a ramp cannot fit the 4.3 m rise)
  exit5: { x: -75, z: -18, width: 3 },           // Exit 5 'Whitehall': stair, east footway of Parliament Street
  exit6: { x: -107, z: -20, width: 3 },          // Exit 6 'Parliament Street / Whitehall': west footway, HM Treasury
  busStop: { x: -24, z: 4, ref: 'H' },
  totem: { x: 6, z: 4.6 },                       // Underground roundel totem/lamp at the kerb
  phoneBox: { x: 32, z: 3.5 },                   // red K6 near the Embankment corner
  elizabethTower: { x: 22, z: 40, width: 12.2, height: 96, clockHeight: 55, belfryTop: 62, spireBase: 70 },  // "Big Ben": diagonally front-LEFT (SSE) of the entrance, 46 m away
  newPalaceYard: { xMin: -70, xMax: 16, zMin: 27, zMax: 62 },    // lime avenue, catalpas, Jubilee fountain, Carriage Gates at the west
  palace: { xMin: -30, xMax: 80, zMin: 46, zMax: 330 },          // Palace of Westminster mass south of the tower; river front on the Thames wall
  westminsterHall: { xMin: -30, xMax: -6, zMin: 62, zMax: 140, height: 28 },
  cannonRow: { xMin: -43, xMax: -38 },                            // gated lane behind PH
  oneParliamentStreet: { xMin: -70, xMax: -43, zMin: -40, zMax: -3, height: 26 },  // Victorian block west of Cannon Row
  parliamentStreet: { xMin: -100, xMax: -78, zMin: -400, zMax: 5, eastFootway: [-78, -70], westFootway: [-108, -100] },
  parliamentSquare: { xMin: -190, xMax: -108, zMin: 8, zMax: 95 },
  churchill: { x: -107, z: 25 },
  embankmentRoad: { xMin: 48, xMax: 66, zMin: -500, zMax: 5 },   // Victoria Embankment carriageway heading north
  embankmentPavementWest: { xMin: 39, xMax: 48 },                // east of Portcullis House
  riversidePavement: { xMin: 66, xMax: 84 },                     // with the dolphin lamp standards and the JLE vent grates
  riverWallX: 84,
  ventGrates: { x: 79, zMin: -63, zMax: -38, count: 4 },
  thames: { xMin: 84, xMax: 324, zMin: -700, zMax: 700, level: -5.5 },   // c. 240 m wide, flows north
  bridge: { xMin: 84, xMax: 334, zMin: 0, zMax: 26, deck: 0.4, arches: 7, colour: 0x2f6b4a },   // Westminster Bridge, 250 × 26 m, green iron
  boadicea: { x: 82, z: 3 },
  pier: { x: 121, z: -75 },
  countyHall: { xMin: 366, xMax: 486, zMin: -160, zMax: -40, height: 40 },
  londonEye: { x: 366, z: -249, radius: 60, hubHeight: 67 },
  southBank: { xMin: 324, xMax: 520, zMin: -400, zMax: 300 },
};

// ---------------------------------------------------------------------------
// CONCOURSE / TICKET HALL (level -3.6)
// One low hall under Portcullis House, continuing south under Bridge Street as
// the old public subway (which doubles as the unpaid concourse).
// ---------------------------------------------------------------------------
export const TICKET_HALL = {
  xMin: -52, xMax: 48, zMin: -40, zMax: 19,   // z > -3 is the subway strip beneath Bridge Street (the P1 stair opening reaches z ≈ 18 under the carriageway)
  floor: LEVELS.concourse, ceiling: LEVELS.concourseCeiling, beamSoffit: LEVELS.concourseBeamSoffit,
  entrancePassage: { xMin: -5, xMax: 5, zMin: -6.5, zMax: -3, y: 0 },              // street level, between Tesco Express (W) and Caffè Nero (E)
  mainStairs: { xMin: -4.5, xMax: 3.5, zTop: -6.5, zBottom: -13.5, yTop: LEVELS.street, yBottom: LEVELS.concourse, steps: 16 },   // descends NORTH
  streetLift: { x: -8, z: -8 },                                                       // arcade ↔ concourse, west of the passage
  ticketWindows: { x: -45, zMin: -28, zMax: -14, facing: 'east' },   // split either side of the Whitehall passage mouth                   // former ticket office, NW/west wall (blank, Tensa barriers)
  ticketMachines: { x: -45, zMin: -15, zMax: -10, count: 5, facing: 'east' },         // flush in the wall near the gateline
  cashMachines: { x: -45, zMin: -38, zMax: -34, count: 4, facing: 'east' },   // west wall, north of the former ticket windows
  payphones: { x: 20, z: 11, count: 4 },
  // Gateline: runs NW–SE across the middle of the hall. Paid side is to the NORTH-EAST of the line.
  gateline: { from: [-16, -27], to: [3, -20], gates: 15, wideGateIndex: 0, boothAt: 'se' },   // c. 20 m for 15 gates (1.35 m pitch: 0.7 m aisle + two 0.3 m cabinets)
  // Bank (a) escalators leave the paid side from the east end of its south side (see ESCALATORS)
  // Openings in the concourse floor for the D&C stairs are given in DISTRICT.stairs (world rects precomputed below)
  embankmentPassage: { xFrom: 48, xTo: 74, zMin: -5, zMax: -1, y: LEVELS.concourse, stepsUpIntoConcourse: 4 },   // meets the UNPAID concourse  // to Exits 1 & 2 (white glazed brick subway)
  whitehallPassage: { xFrom: -45, xTo: -75, zMin: -24, zMax: -18, y: LEVELS.concourse },                          // to Exits 5 & 6 (toilets in the far passage)
  bridgeStreetSubway: { xMin: -45, xMax: 48, zMin: 2, zMax: 8, y: LEVELS.concourse },                              // strip under the road; Exit 3 leaves from its east end
  exit3Passage: { xMin: 44, xMax: 48, zFrom: 8, zTo: 26, y: LEVELS.concourse, stairsTop: [46, 29] },              // south under Bridge Street to the Big Ben pavement
  deepLiftLanding: { x: -32, z: -6 },   // (the deep lift 'DC / JE / JW' is modelled in the WEST well; see JUBILEE.deepLift)
};

// ---------------------------------------------------------------------------
// DISTRICT & CIRCLE (level -8.5): two side platforms on a diagonal alignment.
// Local frame: s = along the line (+s = NORTH-EAST = eastbound direction of
// travel), t = across (+t = SOUTH-EAST, towards Platform 1 / Bridge Street).
// bearing of +s = 60° (ENE): the "45° to the building grid" of the dossier is
// softened to 30° from the x axis so that the platforms' west ends sit under
// Bridge Street and their east ends under the north of Portcullis House.
// ---------------------------------------------------------------------------
const DC_ANGLE = 30 * Math.PI / 180;
const DC_ORIGIN = { x: -4, z: -16 };
const DC_S = { x: Math.cos(DC_ANGLE), z: -Math.sin(DC_ANGLE) };   // (+0.866, -0.5)
const DC_T = { x: Math.sin(DC_ANGLE), z: Math.cos(DC_ANGLE) };    // (+0.5, +0.866)
/** District-line local (s along, t across) → world {x,z}. */
export function dcToWorld(s, t) { return { x: DC_ORIGIN.x + DC_S.x * s + DC_T.x * t, z: DC_ORIGIN.z + DC_S.z * s + DC_T.z * t }; }
/** World {x,z} → District-line local {s,t}. */
export function worldToDc(x, z) { const dx = x - DC_ORIGIN.x, dz = z - DC_ORIGIN.z; return { s: dx * DC_S.x + dz * DC_S.z, t: dx * DC_T.x + dz * DC_T.z }; }
/** Yaw (radians, Three.js rotation.y) that turns a local +z-forward object to face +s. */
export const DC_YAW = Math.atan2(DC_S.x, DC_S.z);   // rotation.y for a group built along local +z = +s

export const DISTRICT = {
  frame: { origin: DC_ORIGIN, angleRad: DC_ANGLE, s: DC_S, t: DC_T, yaw: DC_YAW },
  platformLength: 130,
  sMin: -65, sMax: 65,
  platforms: {
    1: { number: 1, direction: 'westbound', side: 'se', tMin: 3.7, tMax: 8.7, edgeT: 3.7, lines: ['District', 'Circle'], towards: ["St. James's Park", 'Victoria', 'Wimbledon', 'Richmond', 'Ealing Broadway', 'Edgware Road via Victoria'],
         wideWestEnd: { sMin: -50, sMax: -22, tMax: 14 } },                              // widens at its west end: concourse steps, deep lift, bank (d)
    2: { number: 2, direction: 'eastbound', side: 'nw', tMin: -8.7, tMax: -3.7, edgeT: -3.7, lines: ['District', 'Circle'], towards: ['Embankment', 'Tower Hill', 'Upminster', 'Circle via Tower Hill'],
         recesses: [{ sMin: -44, sMax: -34, tMin: -12 }, { sMin: -30, sMax: -18, tMin: -13.5 }] },   // second recess is deeper: bank (c) + its fixed stair (stairLane 1.6)  // concourse steps from the first, bank (c) from the second
  },
  tracks: { eastbound: { t: -1.9 }, westbound: { t: 1.9 } },    // left-hand running: eastbound on the NW track
  trackGauge: 1.435,
  ceiling: LEVELS.dcCeiling, floor: LEVELS.dcPlatform, rail: LEVELS.dcRail,
  box: { sMin: -70, sMax: 70, tMin: -9.7, tMax: 9.7 },            // the cut-and-cover structure (1868 brick beyond the ends)
  // Stairs between the concourse (-3.6) and the platforms (-8.5): 28 steps in two flights, running along the platform.
  // Each is given in the local frame (top and bottom s along the platform, at the t band of the recess).
  stairs: [
    { platform: 2, sTop: -46, sBottom: -37.5, tMin: -12.5, tMax: -9.7, landing: -41.75 },   // from the concourse's SW corner region down to the first recess of P2 (descends towards +s)
    { platform: 1, sTop: -46, sBottom: -37.5, tMin: 9.7, tMax: 12.5, landing: -41.75 },     // down to the wide west end of P1
  ],
  lifts: [{ platform: 2, s: -33, t: -11 }, { platform: 1, s: -33, t: 11 }],
};
// World-space rectangles (axis-aligned bounds) of the stair openings in the concourse floor — used by the ticket hall to leave holes.
DISTRICT.stairOpeningsWorld = DISTRICT.stairs.map(st => {
  const pts = [[st.sTop, st.tMin], [st.sTop, st.tMax], [st.sBottom, st.tMin], [st.sBottom, st.tMax]].map(([s, t]) => dcToWorld(s, t));
  return { platform: st.platform, xMin: Math.min(...pts.map(p => p.x)), xMax: Math.max(...pts.map(p => p.x)), zMin: Math.min(...pts.map(p => p.z)), zMax: Math.max(...pts.map(p => p.z)) };
});

// ---------------------------------------------------------------------------
// JUBILEE (deep level): the box, the wells, the stacked platform tunnels.
// ---------------------------------------------------------------------------
export const JUBILEE = {
  box: { xMin: -40, xMax: 40, zMin: -29, zMax: -3, top: LEVELS.boxTop, floor: LEVELS.boxFloor, wallThickness: 1.2 },
  columns: { x: [-35.4, -23.6, -11.8, 0, 11.8, 23.6, 35.4], z: -16, diameter: 2.0, secondaryDiameter: 1.0 },   // 2 m columns at 11.8 m c/c on the centreline; 1 m secondaries between
  strutLevels: [-12, -18, -25, -31, -36],       // y of the 660 mm solid steel struts across the 26 m width
  voidX: { min: -8, max: 6 },                   // no slabs at all between these x below the interchange (the escalators fly across)
  interchangeEast: { xMin: 12, xMax: 44, zMin: -29, zMax: -3, y: LEVELS.interchangeEast },      // foot of bank (a); head of bank (b)
  interchangeWest: { xMin: -40, xMax: -8, zMin: -29, zMax: 15, y: LEVELS.interchangeWest },     // under the D&C; feet of banks (c),(d); head of bank (e); extends under Bridge Street
  wells: {   // landings at each platform level, north of the platform tunnels; passages lead south to the platforms
    west: { xMin: -32, xMax: -8, zMin: -29, zMax: -3 },
    east: { xMin: 6, xMax: 32, zMin: -29, zMax: -3 },
  },
  passages: [ { x: -20, width: 3.2 }, { x: 20, width: 3.2 } ],   // from each well south through the box wall into the platform (at both levels)
  emergencyStairX: -37,                                          // concrete stair down the west side of the box connecting all levels
  deepLift: { x: -30, z: -6, buttons: ['DC', 'JE', 'JW'] },      // glass/steel lift: D&C Platform 1 (-8.5) ↔ Platform 3 ↔ Platform 4 (lands in the west well)
  // Platform tunnels (7.0 m i.d., E–W under Bridge Street). Platforms on the NORTH side (box side) of the track.
  tunnelRadius: 3.5,
  tunnelAxisZ: 3.8,               // plan position of the tunnel axis
  tunnelAxisYOffset: 2.3,         // tunnel axis above rail head
  platformLength: 126,
  xMin: -63, xMax: 63,            // platform slab extent (centred on x = 0; the box covers x -40..40)
  platformZMin: 1.0,              // back wall (curved tunnel lining) at platform level
  pedZ: 4.0,                      // platform edge / PED screen line
  trackZ: 5.6,                    // rail centreline
  upper: { number: 3, direction: 'eastbound', y: LEVELS.jubUpper, towards: ['Waterloo', 'London Bridge', 'Canary Wharf', 'Stratford'] },
  lower: { number: 4, direction: 'westbound', y: LEVELS.jubLower, towards: ['Green Park', 'Bond Street', 'Baker Street', 'Stanmore'] },
  railOffset: LEVELS.jubRailOffset,
  runningTunnelRadius: 1.9,
};

// Escalators: 7 banks, 17 units (dossier §3.4). Each run: TOP and BOTTOM landing centres, travel dir, lane offsets
// (perpendicular to the run; positive = to the left when looking downhill). 30° incline, 1.0 m steps, 0.75 m/s.
const RUN = 1 / Math.tan(Math.PI / 6);   // horizontal run per metre of rise
const dcp = (s, t) => dcToWorld(s, t);
const pC = dcp(-24, -10.5), pCb = dcp(-24 - 5.5 * RUN, -10.5);   // bank (c) along -s from the second recess of P2
const pD = dcp(-26, 10.5), pDb = dcp(-26 - 5.5 * RUN, 10.5);     // bank (d) along -s from the wide west end of P1
const ESC = (name, top, bottom, dir, lanes, extra = {}) => ({ name, top, bottom, dir, lanes, ...extra });
export const ESCALATORS = [
  ESC('a', { x: 42, y: LEVELS.concourse, z: -8 }, { x: 42 - 5.9 * RUN, y: LEVELS.interchangeEast, z: -8 }, 'down', [-1.4, 0, 1.4], { from: 'concourse', to: 'interchangeEast', note: 'concourse (paid, east end of the south side) → interchange EAST' }),
  ESC('b', { x: 12, y: LEVELS.interchangeEast, z: -8 }, { x: 12 - 13.5 * RUN, y: LEVELS.jubUpper, z: -8 }, 'down', [-1.4, 0, 1.4], { from: 'interchangeEast', to: 'wellWestUpper', note: 'the long flight: interchange EAST → Platform 3 WEST well, descending westward across the void (south side, clear of the D&C structure)' }),
  ESC('c', { x: pC.x, y: LEVELS.dcPlatform, z: pC.z }, { x: pCb.x, y: LEVELS.interchangeWest, z: pCb.z }, 'down', [-1.4, 0], { from: 'dcPlatform2', to: 'interchangeWest', stair: true, stairLane: 1.6, note: 'D&C Platform 2 (eastbound) recess → interchange WEST, with a fixed stair alongside' }),
  ESC('d', { x: pD.x, y: LEVELS.dcPlatform, z: pD.z }, { x: pDb.x, y: LEVELS.interchangeWest, z: pDb.z }, 'down', [-1.4, 0], { from: 'dcPlatform1', to: 'interchangeWest', note: 'D&C Platform 1 (westbound) wide west end → interchange WEST' }),
  ESC('e', { x: -8, y: LEVELS.interchangeWest, z: -24 }, { x: -8 + 9 * RUN, y: LEVELS.jubUpper, z: -24 }, 'down', [-1.4, 0, 1.4], { from: 'interchangeWest', to: 'wellEastUpper', note: 'interchange WEST → Platform 3 EAST well, descending eastward across the void (north side; crosses bank b in plan)' }),
  ESC('f', { x: -12, y: LEVELS.jubUpper, z: -25 }, { x: -12 - 9.5 * RUN, y: LEVELS.jubLower, z: -25 }, 'down', [-1.4, 0], { from: 'wellWestUpper', to: 'wellWestLower', stair: true, stairLane: -4.0, note: 'WEST well: Platform 3 level → Platform 4 level, stair alongside (z ≈ -21)' }),
  ESC('g', { x: 12, y: LEVELS.jubUpper, z: -25 }, { x: 12 + 9.5 * RUN, y: LEVELS.jubLower, z: -25 }, 'down', [0, 1.4], { from: 'wellEastUpper', to: 'wellEastLower', stair: true, stairLane: 4.0, note: 'EAST well: Platform 3 level → Platform 4 level, stair alongside (z ≈ -21)' }),
];

// Flat slabs in the box that the player walks on (besides escalator landings). The box module builds and registers them.
export const BOX_WALKWAYS = [
  { name: 'interchange-east', y: LEVELS.interchangeEast, ...JUBILEE.interchangeEast, floor: 'suregrip' },
  { name: 'interchange-west', y: LEVELS.interchangeWest, ...JUBILEE.interchangeWest, floor: 'suregrip' },
  { name: 'well-west-upper', y: LEVELS.jubUpper, ...JUBILEE.wells.west, floor: 'terrazzo' },
  { name: 'well-east-upper', y: LEVELS.jubUpper, ...JUBILEE.wells.east, floor: 'terrazzo' },
  { name: 'well-west-lower', y: LEVELS.jubLower, ...JUBILEE.wells.west, floor: 'terrazzo' },
  { name: 'well-east-lower', y: LEVELS.jubLower, ...JUBILEE.wells.east, floor: 'terrazzo' },
  { name: 'base-maintenance', y: LEVELS.boxFloor, xMin: -40, xMax: 40, zMin: -29, zMax: -3, floor: 'concrete', publicAccess: false },
];

// ---------------------------------------------------------------------------
// TRACKS — rail-head centrelines (world), sampled as CatmullRom curves.
// `platformCentre` = where a train's CENTRE stops. Trains travel in the
// direction of increasing distance along `points`.
// ---------------------------------------------------------------------------
const jubY = (lvl) => lvl + LEVELS.jubRailOffset;
const dcPts = (t, reverse) => {
  // straight through the station in the local frame; beyond ±110 m the line curves: NE end swings north under
  // Victoria Embankment (towards Embankment station), SW end swings west under Parliament Square (towards St James's Park)
  const pts = [];
  const w = dcToWorld(-110, t);
  pts.push([w.x - 700, LEVELS.dcRail, w.z + 55], [w.x - 400, LEVELS.dcRail, w.z + 55], [w.x - 200, LEVELS.dcRail, w.z + 50], [w.x - 90, LEVELS.dcRail, w.z + 35], [w.x - 40, LEVELS.dcRail, w.z + 18]);
  for (const s of [-110, -80, -40, 0, 40, 80, 110]) { const p = dcToWorld(s, t); pts.push([p.x, LEVELS.dcRail, p.z]); }
  const e = dcToWorld(110, t); pts.push([e.x + 40, LEVELS.dcRail, e.z - 45], [e.x + 60, LEVELS.dcRail, e.z - 120], [e.x + 62, LEVELS.dcRail, e.z - 400], [e.x + 62, LEVELS.dcRail, e.z - 900]);
  return reverse ? pts.slice().reverse() : pts;
};
const dcCentre = (t) => { const p = dcToWorld(0, t); return [p.x, LEVELS.dcRail, p.z]; };
export const TRACKS = {
  jubileeUpper: {   // Platform 3, eastbound: trains travel +x (towards Waterloo, under the river)
    points: [[-700, jubY(LEVELS.jubUpper), JUBILEE.trackZ], [-300, jubY(LEVELS.jubUpper), JUBILEE.trackZ], [-120, jubY(LEVELS.jubUpper), JUBILEE.trackZ], [0, jubY(LEVELS.jubUpper), JUBILEE.trackZ], [120, jubY(LEVELS.jubUpper), JUBILEE.trackZ], [300, jubY(LEVELS.jubUpper), JUBILEE.trackZ], [700, jubY(LEVELS.jubUpper), JUBILEE.trackZ]],
    platformCentre: [0, jubY(LEVELS.jubUpper), JUBILEE.trackZ], platform: 3, line: 'jubilee', direction: 'eastbound',
  },
  jubileeLower: {   // Platform 4, westbound: trains travel -x (towards Green Park)
    points: [[700, jubY(LEVELS.jubLower), JUBILEE.trackZ], [300, jubY(LEVELS.jubLower), JUBILEE.trackZ], [120, jubY(LEVELS.jubLower), JUBILEE.trackZ], [0, jubY(LEVELS.jubLower), JUBILEE.trackZ], [-120, jubY(LEVELS.jubLower), JUBILEE.trackZ], [-300, jubY(LEVELS.jubLower), JUBILEE.trackZ], [-700, jubY(LEVELS.jubLower), JUBILEE.trackZ]],
    platformCentre: [0, jubY(LEVELS.jubLower), JUBILEE.trackZ], platform: 4, line: 'jubilee', direction: 'westbound',
  },
  districtEB: { points: dcPts(DISTRICT.tracks.eastbound.t, false), platformCentre: dcCentre(DISTRICT.tracks.eastbound.t), platform: 2, line: 'district', direction: 'eastbound' },
  districtWB: { points: dcPts(DISTRICT.tracks.westbound.t, true), platformCentre: dcCentre(DISTRICT.tracks.westbound.t), platform: 1, line: 'district', direction: 'westbound' },
};

// ---------------------------------------------------------------------------
// ZONES — HUD location label, audio reverb and ambience. First match wins.
// `box` = axis-aligned; `rect` = rotated rectangle in the District local frame (s/t) with a y range.
// ---------------------------------------------------------------------------
const jubZone = (lvl) => ({ xMin: JUBILEE.xMin - 2, xMax: JUBILEE.xMax + 2, zMin: 0, zMax: 8, yMin: lvl - 0.6, yMax: lvl + 4.5 });
export const ZONES = [
  { id: 'train', name: 'On the train', reverb: 'train' },
  { id: 'jubileePlatformUpper', name: 'Jubilee line — platform 3 (eastbound)', reverb: 'subsurface', box: jubZone(LEVELS.jubUpper) },
  { id: 'jubileePlatformLower', name: 'Jubilee line — platform 4 (westbound)', reverb: 'subsurface', box: jubZone(LEVELS.jubLower) },
  { id: 'dcPlatform1', name: 'District & Circle lines — platform 1 (westbound)', reverb: 'subsurface', rect: { sMin: -68, sMax: 68, tMin: 1.9, tMax: 15, yMin: LEVELS.dcPlatform + 0.3, yMax: LEVELS.dcCeiling } },   // (zone test point is 1 m above the feet)
  { id: 'dcPlatform2', name: 'District & Circle lines — platform 2 (eastbound)', reverb: 'subsurface', rect: { sMin: -68, sMax: 68, tMin: -15, tMax: -1.9, yMin: LEVELS.dcPlatform + 0.3, yMax: LEVELS.dcCeiling } },
  { id: 'jubileeStairs', name: 'Jubilee line — emergency stairs', reverb: 'subsurface', box: { xMin: -64, xMax: -49, zMin: -3.5, zMax: 1.5, yMin: LEVELS.jubLower - 1, yMax: LEVELS.jubUpper + 3.5 } },
  { id: 'box', name: 'Jubilee line escalators', reverb: 'box', box: { xMin: -41, xMax: 45, zMin: -30, zMax: 16, yMin: LEVELS.boxFloor - 1, yMax: LEVELS.boxTop - 0.4 } },
  { id: 'ticketHall', name: 'Westminster — ticket hall', reverb: 'hall', box: { xMin: -53, xMax: 49, zMin: -41, zMax: 20, yMin: LEVELS.concourse - 0.6, yMax: LEVELS.concourseCeiling + 0.6 } },
  { id: 'subway', name: 'Westminster station — subway', reverb: 'hall', box: { xMin: -110, xMax: 84, zMin: -30, zMax: 30, yMin: LEVELS.concourse - 0.6, yMax: -0.2 } },
  { id: 'stairs', name: 'Westminster station', reverb: 'hall', box: { xMin: -53, xMax: 49, zMin: -41, zMax: 20, yMin: LEVELS.concourse - 0.6, yMax: -0.2 } },
  { id: 'street', name: 'Bridge Street, Westminster', reverb: 'street', box: null },
];

// Player spawn: on the pavement outside the entrance, looking across Bridge Street at Big Ben (front-left).
export const SPAWN = { position: [8, LEVELS.street, 2.5], lookAt: [22, 40, 40] };

// Palette (hex) — single source of truth for colours used across modules (dossier §8.4, §12).
export const PALETTE = {
  roundelRed: 0xdc241f, roundelBlue: 0x0019a8, signBlue: 0x0019a8, safetyBlue: 0x005eb8, safetyYellow: 0xffcd00, safetyGreen: 0x007a33,
  jubilee: 0xa0a5a9, district: 0x00782a, circle: 0xffd300, bakerloo: 0xb36305, central: 0xe32017, hammersmith: 0xf3a9bb, metropolitan: 0x9b0056,
  northern: 0x000000, piccadilly: 0x003688, victoria: 0x0098d4, waterlooCity: 0x95cdba, elizabeth: 0x6950a1, overground: 0xee7c0e, dlr: 0x00a4a7,
  wayOutYellow: 0xffd300, amberLED: 0xffb300,
  concrete: 0x9c9b96,          // grillage / columns (pale warm grey, glittery Blackmore-sand mix)
  concreteDark: 0x7f7c76,      // raw diaphragm-wall face (browner, pock-marked)
  precast: 0xa3a29c,           // D&C back walls
  steelGrey: 0x8a8d8f,         // all box steelwork (satin mid-grey, slightly bluer than the concrete)
  blueMosaic: 0x1b2f6b,        // 300 mm dark-blue mosaic band on the columns / balustrade stripe
  stainless: 0xc8cacc,
  terrazzoLight: 0xc8c8c3,     // Jubilee platform floor
  dcFloor: 0xc9c7c0,           // D&C platform floor tiles
  tactileDark: 0x5a5a58,       // dark studded tactile strip with white MIND THE GAP
  tactileGrey: 0x8f9194,
  graniteFloor: 0x55575a,
  jubileePanel: 0xb8bbbe,      // perforated aluminium tunnel panels
  jubileeRib: 0x6e7174,
  escalatorClad: 0xb9bbb9,
  aluminium1996: 0xb8bcc0, aluminiumS7: 0xd9dcdf, windowMask: 0x1c1c1c,
  tarmac: 0x3b3b3c, pavingSlab: 0xa4a19b, portlandStone: 0xd9d2c1, anstonStone: 0xcfc4a9, phSandstone: 0xcdbfa3, bronze: 0x4a3f2f,
  bridgeGreen: 0x2f6b4a, oysterYellow: 0xffcf00, ledOrange: 0xff9e1b,
};
