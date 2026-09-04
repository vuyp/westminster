// ---------------------------------------------------------------------------
// layout.js — THE geometry contract for the whole station.
//
// Units: metres. Y up. +X = east, +Z = south (north is -Z).
// Origin: pavement outside the Bridge Street entrance, street level y = 0.
//
// Every world module places things using these numbers. Tune here, not there.
// ---------------------------------------------------------------------------

export const LEVELS = {
  street: 0,
  ticketHall: -6.5,          // ticket hall floor (one storey below the street, under Bridge Street)
  ticketHallCeiling: -2.6,   // underside of the street slab / Portcullis House ground floor
  dcPlatform: -12.0,         // District & Circle platform surface
  dcRail: -12.95,            // District & Circle rail head (S7 floor ≈ platform height)
  dcCeiling: -7.6,           // flat concrete ceiling over the sub-surface platforms
  jubUpper: -26.5,           // upper Jubilee platform surface (see JUBILEE.upper.direction)
  jubLower: -35.0,           // lower Jubilee platform surface
  jubRailOffset: -0.66,      // rail head relative to a tube platform surface (1996 TS floor height)
  boxFloor: -37.2,           // bottom slab of the Jubilee box (walkway at the lowest level)
  boxTop: -6.5,              // the box is open to the ticket hall level at its top
};

// Rough footprint of things at street level (x: east+, z: south+)
export const STREET = {
  pavementNorth: { zMin: -2, zMax: 6 },             // pavement in front of Portcullis House
  road:          { zMin: 6, zMax: 28 },             // Bridge Street carriageway (two-way, buses)
  pavementSouth: { zMin: 28, zMax: 35 },            // pavement in front of the Palace railings
  bridgeStreetX: { min: -140, max: 45 },            // Parliament Square (west) → Westminster Bridge (east)
  portcullisHouse: { xMin: -52, xMax: 24, zMin: -60, zMax: -2, height: 34, roofHeight: 8 },
  entranceMain:  { x: 0, z: -2, width: 12 },        // Bridge Street entrance in the PH south facade (stairs go DOWN and NORTH)
  entranceExit1: { x: 6, z: 31, width: 6 },         // Exit 1 stairs rising to the south pavement (Big Ben / Westminster Bridge / Parliament)
  entranceEmbankment: { x: 30, z: -8, width: 6 },   // Exit 3/5 stairs on the Victoria Embankment side
  elizabethTower: { x: -22, z: 50, width: 12, height: 96, clockHeight: 55 },  // "Big Ben"
  palace:        { xMin: -140, xMax: 10, zMin: 44, zMax: 300 },              // Palace of Westminster mass (north front along Bridge St)
  parliamentSquare: { xMin: -150, xMax: -60, zMin: 6, zMax: 90 },
  embankmentRoad: { xMin: 30, xMax: 45, zMin: -400, zMax: 6 },               // Victoria Embankment heading north
  riverWallX: 48,                                                            // Thames west bank
  thames:        { xMin: 48, xMax: 300, zMin: -600, zMax: 600, level: -6 }, // water surface y
  bridge:        { xMin: 45, xMax: 300, zMin: 6, zMax: 28, deck: 0.3 },      // Westminster Bridge deck
  countyHall:    { xMin: 305, xMax: 420, zMin: 20, zMax: 140, height: 40 },
  londonEye:     { x: 330, z: -60, radius: 60, hubHeight: 67 },
  whitehallX:    -58,                                                        // Parliament Street runs north from the square
};

// The ticket hall (unpaid + paid areas) — one large hall beneath Bridge Street and the south part of Portcullis House
export const TICKET_HALL = {
  xMin: -46, xMax: 24, zMin: -52, zMax: 32,
  floor: LEVELS.ticketHall,
  ceiling: LEVELS.ticketHallCeiling,
  // main stair from the Bridge Street entrance: starts at street level on the facade line and descends northwards
  mainStairs: { xMin: -6, xMax: 6, zTop: -2, zBottom: -14, yTop: LEVELS.street, yBottom: LEVELS.ticketHall },
  // Exit 1 stair: from the hall up to the south pavement (facing Big Ben)
  exit1Stairs: { xMin: 3, xMax: 9, zTop: 31, zBottom: 19, yTop: LEVELS.street, yBottom: LEVELS.ticketHall },
  // Embankment stair
  embankmentStairs: { xMin: 27, xMax: 33, zTop: -8, zBottom: -8, yTop: LEVELS.street, yBottom: LEVELS.ticketHall, dir: 'west' },
  // gateline separating unpaid (north/east) from paid (south/west)
  gateline: { z: -20, xMin: -24, xMax: 8, gates: 12, wideGateIndex: 0 },
  ticketMachines: { x: 20, zMin: -16, zMax: 4, count: 6, facing: 'west' },
  // stairs from the paid area down to the District & Circle platforms (one per platform, at both ends)
  dcStairs: [
    { platform: 1, xMin: -12, xMax: -8, zTop: 2, zBottom: 6.5, side: 'north' },
    { platform: 1, xMin: 20, xMax: 24, zTop: 2, zBottom: 6.5, side: 'north' },
    { platform: 2, xMin: -12, xMax: -8, zTop: 26, zBottom: 21.5, side: 'south' },
    { platform: 2, xMin: 20, xMax: 24, zTop: 26, zBottom: 21.5, side: 'south' },
  ],
  // opening in the hall floor over the Jubilee box (balustraded), top of the first escalator bank
  boxOverlook: { xMin: -42, xMax: -10, zMin: -52, zMax: -48 },
};

// District & Circle: sub-surface platforms under Bridge Street. Tracks run east-west.
// Trains keep left, so the eastbound track is the NORTHERN one.
export const DISTRICT = {
  platformLength: 134,
  xMin: -76, xMax: 58,
  platforms: {
    1: { number: 1, direction: 'eastbound', zMin: 3.0, zMax: 8.2, edgeZ: 8.2, lines: ['District', 'Circle'], towards: ['Embankment', 'Tower Hill', 'Upminster'] },
    2: { number: 2, direction: 'westbound', zMin: 16.0, zMax: 21.2, edgeZ: 16.0, lines: ['District', 'Circle'], towards: ['St. James\'s Park', 'Victoria', 'Ealing Broadway', 'Richmond', 'Wimbledon'] },
  },
  tracks: {
    eastbound: { z: 9.9 },   // rail centreline
    westbound: { z: 14.3 },
  },
  trackGauge: 1.435,
  ceiling: LEVELS.dcCeiling,
  floor: LEVELS.dcPlatform,
  rail: LEVELS.dcRail,
  // the cut-and-cover box the platforms sit in
  box: { xMin: -80, xMax: 62, zMin: 2.5, zMax: 21.7 },
};

// Jubilee line: deep box under Portcullis House. Tracks run north-south along the WEST wall of the box.
// The two platforms are STACKED (upper and lower) on the west side; the void with escalators is to the east.
export const JUBILEE = {
  box: { xMin: -42, xMax: -10, zMin: -110, zMax: -48, top: LEVELS.boxTop, floor: LEVELS.boxFloor },
  platformLength: 125,
  zMin: -142, zMax: -17,                   // platforms extend beyond the box into tunnel sections
  trackX: -40.2,                          // rail centreline (against the west wall)
  platformXMin: -38.6, platformXMax: -33.2,  // platform slab; PEDs stand on the platformXMin edge
  pedX: -38.6,
  upper: { number: 4, direction: 'eastbound', y: LEVELS.jubUpper, towards: ['Waterloo', 'London Bridge', 'Canary Wharf', 'Stratford'] },
  lower: { number: 3, direction: 'westbound', y: LEVELS.jubLower, towards: ['Green Park', 'Bond Street', 'Baker Street', 'Stanmore'] },
  railOffset: LEVELS.jubRailOffset,
  tunnelRadius: 1.9,                      // running tunnel bore
  platformTunnelRadius: 2.9,              // platform tunnel bore beyond the box
};

// Escalators. Each run is defined by its TOP and BOTTOM landing centre points. 30° incline.
// `dir` is the travel direction for passengers ('down' or 'up'). Width 1.0 m step.
// Banks of 3 side by side are created by the builder with `lanes` offsets perpendicular to the run.
const ESC = (name, top, bottom, dir, lanes) => ({ name, top, bottom, dir, lanes });
export const ESCALATORS = [
  // Bank A: ticket hall (top of box) down the east side of the box to the upper Jubilee platform level
  ESC('A', { x: -16, y: LEVELS.ticketHall, z: -52 }, { x: -16, y: LEVELS.jubUpper, z: -52 - 20 / Math.tan(Math.PI / 6) }, 'down', [-1.4, 0, 1.4]),
  // Bank B: upper platform level back across the void to the lower platform
  ESC('B', { x: -24, y: LEVELS.jubUpper, z: -100 }, { x: -24, y: LEVELS.jubLower, z: -100 + 8.5 / Math.tan(Math.PI / 6) }, 'down', [-1.4, 0, 1.4]),
  // Bank C: intermediate return escalator (up) from the lower level on the west/centre of the void
  ESC('C', { x: -30, y: LEVELS.jubUpper, z: -62 }, { x: -30, y: LEVELS.jubLower, z: -62 - 8.5 / Math.tan(Math.PI / 6) }, 'up', [-1.4, 0]),
];

// Bridges / walkways in the box (flat slabs the player can walk on) — builder may add more.
export const BOX_WALKWAYS = [
  { name: 'upper-landing', y: LEVELS.jubUpper, xMin: -33.2, xMax: -10, zMin: -110, zMax: -80 },
  { name: 'upper-bridge', y: LEVELS.jubUpper, xMin: -33.2, xMax: -10, zMin: -68, zMax: -56 },
  { name: 'lower-landing', y: LEVELS.jubLower, xMin: -33.2, xMax: -10, zMin: -90, zMax: -76 },
];

// Track polylines for trains (rail-head centreline), in world coordinates.
// Each is sampled as a CatmullRom curve. `stop` = distance along the track (m) where a train's CENTRE stops at the platform.
export const TRACKS = {
  districtEB: {
    points: [[-700, LEVELS.dcRail, 9.9], [-300, LEVELS.dcRail, 9.9], [-150, LEVELS.dcRail, 9.9], [-100, LEVELS.dcRail, 9.9], [-60, LEVELS.dcRail, 9.9], [-20, LEVELS.dcRail, 9.9], [20, LEVELS.dcRail, 9.9], [60, LEVELS.dcRail, 9.9], [90, LEVELS.dcRail, 9.9], [120, LEVELS.dcRail, 6], [150, LEVELS.dcRail, -8], [175, LEVELS.dcRail, -40], [185, LEVELS.dcRail, -110], [185, LEVELS.dcRail, -700]],
    platformCentre: [-9, LEVELS.dcRail, 9.9],
    platform: 1, line: 'district', direction: 'eastbound',
  },
  districtWB: {
    points: [[181, LEVELS.dcRail, -700], [181, LEVELS.dcRail, -110], [171, LEVELS.dcRail, -40], [146, LEVELS.dcRail, -6], [118, LEVELS.dcRail, 10.5], [90, LEVELS.dcRail, 14.3], [60, LEVELS.dcRail, 14.3], [20, LEVELS.dcRail, 14.3], [-20, LEVELS.dcRail, 14.3], [-60, LEVELS.dcRail, 14.3], [-100, LEVELS.dcRail, 14.3], [-150, LEVELS.dcRail, 14.3], [-300, LEVELS.dcRail, 14.3], [-700, LEVELS.dcRail, 14.3]],
    platformCentre: [-9, LEVELS.dcRail, 14.3],
    platform: 2, line: 'district', direction: 'westbound',
  },
  jubileeUpper: {
    points: [[-40.2, LEVELS.jubUpper + LEVELS.jubRailOffset, 500], [-40.2, LEVELS.jubUpper + LEVELS.jubRailOffset, 100], [-40.2, LEVELS.jubUpper + LEVELS.jubRailOffset, -79.5], [-40.2, LEVELS.jubUpper + LEVELS.jubRailOffset, -300], [-40.2, LEVELS.jubUpper + LEVELS.jubRailOffset, -700]],
    platformCentre: [-40.2, LEVELS.jubUpper + LEVELS.jubRailOffset, -79.5],
    platform: 4, line: 'jubilee', direction: 'eastbound',   // trains travel towards -z (north end of the tunnel) in this world; see docs
  },
  jubileeLower: {
    points: [[-40.2, LEVELS.jubLower + LEVELS.jubRailOffset, -700], [-40.2, LEVELS.jubLower + LEVELS.jubRailOffset, -300], [-40.2, LEVELS.jubLower + LEVELS.jubRailOffset, -79.5], [-40.2, LEVELS.jubLower + LEVELS.jubRailOffset, 100], [-40.2, LEVELS.jubLower + LEVELS.jubRailOffset, 500]],
    platformCentre: [-40.2, LEVELS.jubLower + LEVELS.jubRailOffset, -79.5],
    platform: 3, line: 'jubilee', direction: 'westbound',
  },
};

// Named zones — used for HUD location label, audio reverb and ambience selection. Order matters: first match wins.
export const ZONES = [
  { id: 'train', name: 'On the train', reverb: 'train' },   // set dynamically by the player when aboard
  { id: 'jubileePlatformUpper', name: 'Jubilee line — platform 4 (eastbound)', reverb: 'box', box: { xMin: -42, xMax: -33, zMin: -142, zMax: -17, yMin: LEVELS.jubUpper - 0.5, yMax: LEVELS.jubUpper + 3.5 } },
  { id: 'jubileePlatformLower', name: 'Jubilee line — platform 3 (westbound)', reverb: 'box', box: { xMin: -42, xMax: -33, zMin: -142, zMax: -17, yMin: LEVELS.jubLower - 0.5, yMax: LEVELS.jubLower + 3.5 } },
  { id: 'box', name: 'Jubilee line escalators', reverb: 'box', box: { xMin: -43, xMax: -9, zMin: -111, zMax: -47, yMin: LEVELS.boxFloor - 1, yMax: LEVELS.boxTop - 0.2 } },
  { id: 'dcPlatform1', name: 'District & Circle lines — platform 1 (eastbound)', reverb: 'subsurface', box: { xMin: -80, xMax: 62, zMin: 2.5, zMax: 9, yMin: LEVELS.dcPlatform - 0.5, yMax: LEVELS.dcCeiling } },
  { id: 'dcPlatform2', name: 'District & Circle lines — platform 2 (westbound)', reverb: 'subsurface', box: { xMin: -80, xMax: 62, zMin: 15, zMax: 21.7, yMin: LEVELS.dcPlatform - 0.5, yMax: LEVELS.dcCeiling } },
  { id: 'ticketHall', name: 'Westminster — ticket hall', reverb: 'hall', box: { xMin: -47, xMax: 35, zMin: -53, zMax: 33, yMin: LEVELS.ticketHall - 0.5, yMax: LEVELS.ticketHallCeiling + 0.5 } },
  { id: 'stairs', name: 'Westminster station', reverb: 'hall', box: { xMin: -47, xMax: 35, zMin: -53, zMax: 33, yMin: LEVELS.ticketHall - 0.5, yMax: -0.3 } },
  { id: 'street', name: 'Bridge Street, Westminster', reverb: 'street', box: null },
];

// Player spawn: on the pavement outside the entrance, facing Big Ben across the road.
export const SPAWN = { position: [14, LEVELS.street, 3.5], lookAt: [-22, 30, 50] };

// Palette (hex) — the single source of truth for colours used across modules.
export const PALETTE = {
  roundelRed: 0xdc241f,
  roundelBlue: 0x0019a8,
  signBlue: 0x113b92,
  jubilee: 0xa0a5a9,
  district: 0x00782a,
  circle: 0xffd300,
  bakerloo: 0xb36305,
  central: 0xe32017,
  hammersmith: 0xf3a9bb,
  metropolitan: 0x9b0056,
  northern: 0x000000,
  piccadilly: 0x003688,
  victoria: 0x0098d4,
  waterlooCity: 0x95cdba,
  elizabeth: 0x6950a1,
  overground: 0xee7c0e,
  dlr: 0x00a4a7,
  wayOutYellow: 0xffd300,
  concrete: 0x9a9893,
  concreteDark: 0x7d7b76,
  stainless: 0xc8cacc,
  graniteFloor: 0x55575a,
  tactileGrey: 0x8f9194,
  tarmac: 0x3b3b3c,
  pavingSlab: 0xa4a19b,
  portlandStone: 0xd9d2c1,
  bridgeGreen: 0x2f6b4a,
  oysterYellow: 0xffcf00,
  ledOrange: 0xff7a00,
};
