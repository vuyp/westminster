// ---------------------------------------------------------------------------
// trainSpec.js — shared rolling-stock dimensions. Both the train models and the
// platform edge doors derive door positions from here so they always line up.
// All lengths in metres. Cars are listed from the FRONT of the train (car 0)
// when it travels in its track's forward direction (increasing s).
// Door positions are measured from the car centre along the car (+ = towards the front).
// ---------------------------------------------------------------------------

/** 1996 Tube Stock (Jubilee line): 7 cars, 2 double + 2 single doorways per side per car. */
export const STOCK_1996 = {
  name: '1996 Tube Stock', line: 'jubilee',
  cars: 7,
  carLength: [17.77, 17.37, 17.37, 17.37, 17.37, 17.37, 17.77],   // DM at each end
  gap: 0.35,                    // inter-car gap (corridor connections are not walk-through on 1996 TS)
  width: 2.63, height: 2.875,   // over body / over roof
  floorHeight: 0.66,            // floor above rail head
  bodyBottom: 0.35,             // underframe skirt bottom above rail
  doorways: [                   // per car, per side: [centre offset from car centre, leaf width total]
    { offset: -6.55, width: 0.85, leaves: 1 },
    { offset: -2.35, width: 1.66, leaves: 2 },
    { offset: 2.35, width: 1.66, leaves: 2 },
    { offset: 6.55, width: 0.85, leaves: 1 },
  ],
  doorHeight: 1.95, doorSill: 0.66,
  windowTop: 1.95, windowBottom: 1.0,
  livery: { body: 0xc4c6c9, doors: 0xd0201f, cabFront: 0xd0201f, cabDoors: 0x0a2c8a, skirt: 0x0a2c8a, roof: 0x9fa2a6, windowTint: 0x2b3a44 },
  seats: 'longitudinal+transverse',
  maxSpeed: 27,                 // m/s (≈ 100 km/h)
  accel: 1.1, decel: 1.15,      // m/s²
  dwell: 30,                    // seconds doors open at Westminster (peak ~ 25–35 s)
  doorTime: 2.4,                // seconds for doors to open/close
  chime: 'doorBeep1996',
  runSound: '1996',
};

/** S7 Stock (District & Circle lines): 7 walk-through cars, 2 wide double doorways per side per car (3 on longer DM? no — 2 pairs; DM cars have a single extra at the cab end). */
export const STOCK_S7 = {
  name: 'S7 Stock', line: 'district',
  cars: 7,
  carLength: [17.44, 15.43, 15.43, 15.43, 15.43, 15.43, 17.44],
  gap: 0.0,                     // fully articulated gangways: effectively continuous
  width: 2.92, height: 3.68,
  floorHeight: 0.95,
  bodyBottom: 0.45,
  doorways: [
    { offset: -3.9, width: 1.66, leaves: 2 },
    { offset: 3.9, width: 1.66, leaves: 2 },
  ],
  doorwaysDM: [                 // driving motor cars (longer): one extra single door near the cab
    { offset: -4.6, width: 1.66, leaves: 2 },
    { offset: 2.9, width: 1.66, leaves: 2 },
  ],
  doorHeight: 2.05, doorSill: 0.95,
  windowTop: 2.35, windowBottom: 1.25,
  livery: { body: 0xf2f2f2, doors: 0xd0201f, cabFront: 0xf2f2f2, band: 0x0a2c8a, skirt: 0x0a2c8a, roof: 0xd8d8d8, windowTint: 0x2b3a44, stripe: 0xd0201f },
  seats: 'longitudinal',
  maxSpeed: 27,
  accel: 1.3, decel: 1.2,
  dwell: 35,
  doorTime: 2.6,
  chime: 'doorBeepS7',
  runSound: 'S7',
};

/** Total train length including gaps. */
export function trainLength(spec) { return spec.carLength.reduce((a, b) => a + b, 0) + spec.gap * (spec.cars - 1); }

/**
 * Longitudinal positions (metres, relative to the train centre, + = front) of every doorway centre on one side.
 * Also returns per-doorway width. Use for platform edge doors and for NPC boarding targets.
 */
export function doorPositions(spec) {
  const total = trainLength(spec); const out = []; let cursor = total / 2; // start at the front
  for (let i = 0; i < spec.cars; i++) {
    const len = spec.carLength[i]; const centre = cursor - len / 2;
    const dws = (spec.doorwaysDM && (i === 0 || i === spec.cars - 1)) ? spec.doorwaysDM : spec.doorways;
    for (const d of dws) out.push({ car: i, s: centre + d.offset, width: d.width, leaves: d.leaves });
    cursor -= len + spec.gap;
  }
  return out.sort((a, b) => a.s - b.s);
}
