// ---------------------------------------------------------------------------
// trainSpec.js — shared rolling-stock dimensions (docs/WESTMINSTER_REFERENCE.md §8).
// Both the train models and the platform edge doors derive door positions from
// here so they always line up.
// All lengths in metres; heights are ABOVE RAIL HEAD unless stated otherwise.
// Cars are listed from the FRONT of the train (car 0) when it travels in its
// track's forward direction (increasing s). Car lengths are OVER COUPLERS (the
// sum is the train length); the visible body is shorter by `endInset` at each
// end (coupling / gangway space).
// Door offsets are measured from the car centre along the car (+ = towards the front).
// ---------------------------------------------------------------------------

/**
 * 1996 Tube Stock (Jubilee line) — dossier §8.1.
 * 7 cars, 126.49 m: DM 18.196 m, intermediates 18.02 m. DMs: two double-leaf doorways + one single-leaf door at the
 * inner (non-cab) end; intermediates: two double + a single at each end → 26 doorways per side (14 double + 12 single),
 * matching the 28 PED units per platform (+2 end doors).
 * `profile` = [x (half width), y] points of the OUTER skin from the skirt to the roof centre; `interior` = inner lining.
 */
export const STOCK_1996 = {
  name: '1996 Tube Stock', line: 'jubilee', code: '1996',
  cars: 7,
  carLength: [18.196, 18.02, 18.02, 18.02, 18.02, 18.02, 18.196],
  gap: 0,                       // lengths are over couplers; see endInset
  endInset: { cab: 0.22, closed: 0.18, gangway: 0 },   // body set back from the coupler face at each kind of end
  width: 2.629, height: 2.875,  // over body / rail to roof
  floorHeight: 0.66,            // floor above rail head
  bodyBottom: 0.35,             // underframe skirt bottom above rail
  doorways: [                   // intermediate cars, per side: centre offset from car centre (+ = front), opening width, leaves
    { offset: -7.8, width: 0.8, leaves: 1 },
    { offset: -2.45, width: 1.66, leaves: 2 },
    { offset: 2.45, width: 1.66, leaves: 2 },
    { offset: 7.8, width: 0.8, leaves: 1 },
  ],
  doorwaysDM: [                 // driving motor cars (cab at the + end): single door at the inner end only
    { offset: -7.5, width: 0.8, leaves: 1 },
    { offset: -2.15, width: 1.66, leaves: 2 },
    { offset: 2.75, width: 1.66, leaves: 2 },
  ],
  doorHeight: 1.95, doorSill: 0.66,
  windowBottom: 1.56, windowTop: 2.50,      // above rail (≈ 0.9 m and 1.84 m above the floor)
  doorWindow: [1.62, 2.44],                 // door-leaf window band, above rail
  cabDepth: 2.0,                            // driving cab depth at the outer end of a DM
  bogieSpacing: 0.60,                       // bogie centres as a fraction of car length
  wheelDiameter: 0.79,
  profile: [[1.12, 0.35], [1.27, 0.55], [1.315, 0.95], [1.315, 1.72], [1.28, 2.12], [1.19, 2.42], [1.03, 2.64], [0.76, 2.80], [0.40, 2.865], [0, 2.875]],
  interior: [[1.20, 0.66], [1.22, 1.00], [1.22, 1.72], [1.19, 2.12], [1.10, 2.40], [0.95, 2.58], [0.70, 2.72], [0.38, 2.79], [0, 2.80]],
  // dossier: unpainted aluminium body (#B8BCC0), red doors (#DC241F), NO blue skirt; blue cab face with a red M door and a
  // grey lower valance carrying the number in white; black windscreen surrounds. Interior off-white #EDEDE8, silver-grey
  // poles #B5B7B9, dark floor #3C3C3C, blue armrests, continuous fluorescent strip along the ceiling centreline.
  livery: { body: 0xb8bcc0, lowerBody: 0xa9adb1, doors: 0xdc241f, cabFace: 0x0019a8, mDoor: 0xdc241f, valance: 0x8a8d8f, cabDoors: 0x0019a8, roof: 0xa4a7aa, windowTint: 0x2b3a44, windowFrame: 0x1c1c1c, skirt: null,
    lining: 0xedede8, pole: 0xb5b7b9, poleMetal: true, floor: 0x3c3c3c, floorGroove: 0x7a7a7a, armrest: 0x2a4b9b, strap: 0x2a2a2a },
  seats: 'longitudinal+transverse',
  seatsPerCar: 33,
  seatCushion: 0.43, seatDepth: 0.48,       // above floor / from the lining
  gangway: null,                            // closed ends with inter-car doors and end windows
  displays: 'carEnds',                      // scrolling LED matrix above the car-end windows
  ceilingLights: 'centre',
  maxSpeed: 27,                 // m/s (≈ 100 km/h; c. 60–70 km/h between Green Park, Westminster and Waterloo)
  accel: 1.0, decel: 1.0,       // m/s² (dossier §8.1 / §9.3)
  dwell: 30,                    // seconds doors open at Westminster
  doorTime: 2.4,                // seconds for doors to open/close (open 1.5–2.5 s, close 2.5–3 s)
  chime: 'doorBeep1996',        // pulsed hustle alarm from every door pillar on closing; no chime on opening
  openChime: null,
  runSound: '1996',
  unitNumbers: ['96002', '96017', '96038', '96051', '96064', '96077', '96102', '96115'],
  lineDiagram: ['Stanmore', 'Canons Park', 'Queensbury', 'Kingsbury', 'Wembley Park', 'Neasden', 'Dollis Hill', 'Willesden Green', 'Kilburn', 'West Hampstead', 'Finchley Road', 'Swiss Cottage', "St. John's Wood", 'Baker Street', 'Bond Street', 'Green Park', 'Westminster', 'Waterloo', 'Southwark', 'London Bridge', 'Bermondsey', 'Canada Water', 'Canary Wharf', 'North Greenwich', 'Canning Town', 'West Ham', 'Stratford'],
};

/**
 * S7 Stock (District & Circle lines) — dossier §8.2.
 * 7-car walk-through DM–M1–M2–MS–M2–M1–DM, 117.448 m: DM 18.139 m, intermediates 16.234 m. Three double-leaf doorways
 * per car side on every car (21 per side per train). Floor 1.005 m above rail (level boarding).
 */
export const STOCK_S7 = {
  name: 'S7 Stock', line: 'district', code: 'S7',
  cars: 7,
  carLength: [18.139, 16.234, 16.234, 16.234, 16.234, 16.234, 18.139],
  gap: 0,
  endInset: { cab: 0.25, closed: 0.18, gangway: 0.45 },   // 0.9 m articulated gangway between bodies
  width: 2.92, height: 3.68,    // over body / over roof-mounted air-conditioning
  floorHeight: 1.005,
  bodyBottom: 0.45,
  doorways: [
    { offset: -5.0, width: 1.6, leaves: 2 },
    { offset: 0.0, width: 1.6, leaves: 2 },
    { offset: 5.0, width: 1.6, leaves: 2 },
  ],
  doorwaysDM: [                 // cab at the + end; saloon centre is 1.2 m behind the car centre
    { offset: -5.8, width: 1.6, leaves: 2 },
    { offset: -1.2, width: 1.6, leaves: 2 },
    { offset: 3.4, width: 1.6, leaves: 2 },
  ],
  doorHeight: 2.05, doorSill: 1.005,
  windowBottom: 1.95, windowTop: 2.95,      // above rail (≈ 0.95 m and 1.95 m above the floor)
  doorWindow: [1.95, 2.85],
  cabDepth: 2.6,
  bogieSpacing: 0.60,
  wheelDiameter: 0.86,
  profile: [[1.30, 0.45], [1.42, 0.70], [1.46, 1.10], [1.46, 2.55], [1.42, 2.95], [1.30, 3.22], [1.05, 3.42], [0.65, 3.52], [0.30, 3.555], [0, 3.56]],
  interior: [[1.36, 1.005], [1.36, 2.95], [1.28, 3.06], [1.05, 3.14], [0.6, 3.18], [0, 3.19]],
  // dossier: pale satin aluminium body (#D9DCDF), continuous black window band (#1C1C1C), red doors, corporate-blue band
  // along the lower body; red cab front under a black windscreen mask with the orange LED destination in the black band;
  // roof light grey with two air-con packs per car. Interior off-white #E9E9E6, BLUE poles/rails/straps (#3B83BD),
  // mid-grey floor #5B5F63, grey bellows, ceiling-hung orange LED displays.
  livery: { body: 0xd9dcdf, lowerBody: 0xd9dcdf, doors: 0xdc241f, cabFace: 0xdc241f, mDoor: 0xdc241f, valance: 0x0019a8, cabDoors: 0xd9dcdf, roof: 0xcfd2d5, windowTint: 0x2b3a44, windowFrame: 0x1c1c1c, skirt: 0x0019a8,
    lining: 0xe9e9e6, pole: 0x3b83bd, poleMetal: false, floor: 0x5b5f63, floorGroove: 0x4a4d50, armrest: 0x3b83bd, strap: 0x3b83bd },
  seats: 'longitudinal',
  seatsPerCar: 36,
  seatCushion: 0.45, seatDepth: 0.50,
  gangway: { width: 1.35, height: 2.0 },    // clear opening of the walk-through connection (above floor)
  wheelchairCars: [3],                      // MS car: two wheelchair bays
  displays: 'hanging',                      // orange LED dot-matrix displays hung from the ceiling at intervals
  ceilingLights: 'troughs',
  maxSpeed: 27,
  accel: 1.3, decel: 1.15,      // m/s² (dossier §8.2, verified)
  dwell: 35,
  doorTime: 2.5,
  chime: 'doorBeepS7',          // fast pulsed alarm on closing …
  openChime: 'train:s7open',    // … and a short two-note motif at the moment of opening (dossier §10.6 verdict)
  runSound: 'S7',
  unitNumbers: ['21305', '21322', '21347', '21356', '21378', '21391', '21410', '21433'],
  lineDiagram: ['Ealing Broadway', 'Ealing Common', 'Acton Town', 'Chiswick Park', 'Turnham Green', 'Stamford Brook', 'Ravenscourt Park', 'Hammersmith', 'Barons Court', 'West Kensington', "Earl's Court", 'Gloucester Road', 'South Kensington', 'Sloane Square', 'Victoria', "St. James's Park", 'Westminster', 'Embankment', 'Temple', 'Blackfriars', 'Mansion House', 'Cannon Street', 'Monument', 'Tower Hill', 'Aldgate East', 'Whitechapel', 'Stepney Green', 'Mile End', 'Bow Road', 'Bromley-by-Bow', 'West Ham', 'Plaistow', 'Upton Park', 'East Ham', 'Barking', 'Upney', 'Becontree', 'Dagenham Heathway', 'Dagenham East', 'Elm Park', 'Hornchurch', 'Upminster Bridge', 'Upminster'],
  circleDiagram: ['Hammersmith', 'Goldhawk Road', "Shepherd's Bush Market", 'Wood Lane', 'Latimer Road', 'Ladbroke Grove', 'Westbourne Park', 'Royal Oak', 'Paddington', 'Edgware Road', 'Baker Street', 'Great Portland Street', 'Euston Square', "King's Cross St. Pancras", 'Farringdon', 'Barbican', 'Moorgate', 'Liverpool Street', 'Aldgate', 'Tower Hill', 'Monument', 'Cannon Street', 'Mansion House', 'Blackfriars', 'Temple', 'Embankment', 'Westminster', "St. James's Park", 'Victoria', 'Sloane Square', 'South Kensington', 'Gloucester Road', 'High Street Kensington', 'Notting Hill Gate', 'Bayswater', 'Paddington', 'Edgware Road'],
};

/** Total train length including gaps (car lengths are over couplers, so this is the real train length). */
export function trainLength(spec) { return spec.carLength.reduce((a, b) => a + b, 0) + spec.gap * (spec.cars - 1); }

/** Car centre offsets (metres from the train centre, + = front) and lengths, front car first. */
export function carOffsets(spec) {
  const total = trainLength(spec); const out = []; let cursor = total / 2;
  for (let i = 0; i < spec.cars; i++) { const len = spec.carLength[i]; out.push({ car: i, offset: cursor - len / 2, length: len }); cursor -= len + spec.gap; }
  return out;
}

/** Doorways of one car as offsets from ITS centre (+ = front). The rear DM is the front DM turned round, so its offsets are mirrored. */
export function carDoorways(spec, carIndex) {
  const dm = spec.doorwaysDM && (carIndex === 0 || carIndex === spec.cars - 1);
  const list = dm ? spec.doorwaysDM : spec.doorways;
  const sign = (dm && carIndex === spec.cars - 1) ? -1 : 1;
  return list.map(d => ({ offset: sign * d.offset, width: d.width, leaves: d.leaves })).sort((a, b) => a.offset - b.offset);
}

/**
 * Longitudinal positions (metres, relative to the train centre, + = front) of every doorway centre on one side.
 * Also returns per-doorway width. Use for platform edge doors and for NPC boarding targets.
 */
export function doorPositions(spec) {
  const out = [];
  for (const c of carOffsets(spec)) for (const d of carDoorways(spec, c.car)) out.push({ car: c.car, s: c.offset + d.offset, width: d.width, leaves: d.leaves });
  return out.sort((a, b) => a.s - b.s);
}
