// ---------------------------------------------------------------------------
// announcements.js — every spoken line heard at Westminster, as data.
//
// Wording follows docs/WESTMINSTER_REFERENCE.md §10 (Jubilee: Celia Drummond
// 1996-stock DVA; District & Circle: Sarah Parnell S7 DVA; platform PA: Elinor
// Hamilton with Phil Sayer's male inserts). Where the dossier records two
// remembered variants the preferred one is the default and the other is kept
// in VARIANTS / behind an OPTIONS flag, so a recording can correct it later
// without touching any code that speaks.
//
// Consumers:
//   src/systems/trainService.js  reads TRAIN_ANNOUNCEMENTS[line][direction][key]
//                                (string | string[] | (destination) => string)
//   src/audio/soundscape.js      reads STATION_PA and DESTINATIONS
// ---------------------------------------------------------------------------

/** Switchable wording variants (see dossier §10.2, §10.4, §10.6 and §14 items 16, 17, 21, 35). */
export const OPTIONS = {
  jubileeExitClause: false,        // add 'Exit here for the Houses of Parliament and Westminster Abbey.' to the Jubilee arrival (single-memory, off by default)
  jubileeAlphabetical: false,      // 'Circle and District' instead of 'District and Circle' on the Jubilee arrival
  jubileeDoorSide: false,          // 2016-era 'Doors will open on the left-hand side.' flavour line
  jubileeMaleDepartReady: false,   // rolling-stock variant: male 'This train is now ready to depart. Please stand clear of the closing doors.'
  s7MindTheGap: true,              // 'Please mind the gap between the train and the platform.' after the S7 arrival line (flagged at Westminster because of the curve)
  s7SpokenDoorClose: false,        // S7 door close is beeps-only by default; true adds the low-confidence 'Please mind the doors.'
};

/** Which side the doors open, seen from the train (architecture contract: P3 eastbound → left, P4 westbound → right, D&C → left). */
export const DOOR_SIDE = { jubilee: { eastbound: 'left', westbound: 'right' }, district: { eastbound: 'left', westbound: 'left' }, circle: { eastbound: 'left', westbound: 'left' } };

export const LINE_NAMES = { jubilee: 'Jubilee', district: 'District', circle: 'Circle' };

/** Next station along each track from Westminster, and the interchange line read out for it (dossier §10.2, §10.4). */
export const NEXT_STATION = {
  jubilee: { eastbound: 'Waterloo', westbound: 'Green Park' },
  district: { eastbound: 'Embankment', westbound: "St James's Park" },
  circle: { eastbound: 'Embankment', westbound: "St James's Park" },
};
export const NEXT_INTERCHANGE = {
  jubilee: { eastbound: 'Change for the Bakerloo, Northern and Waterloo & City lines, and National Rail services.', westbound: 'Change for the Piccadilly and Victoria lines.' },
  district: { eastbound: 'Change for the Bakerloo and Northern lines, and National Rail services from Charing Cross. Exit for riverboat services from Embankment Pier.', westbound: '' },
  circle: { eastbound: 'Change for the Bakerloo and Northern lines, and National Rail services from Charing Cross. Exit for riverboat services from Embankment Pier.', westbound: '' },
};

/** Circle line 'via' phrasing as spoken on the S7 DVA (dossier §10.5) and as abbreviated on the dot-matrix boards (§9.5). */
export const CIRCLE_VIA = {
  Hammersmith: { spoken: "via Liverpool Street and King's Cross St. Pancras", board: 'Circle via Tower Hill' },
  'Edgware Road': { spoken: 'via Victoria and Paddington', board: 'Edgware Rd via Victoria', alt: 'via Victoria and High Street Kensington' },
};

const join = (...parts) => parts.filter(p => p && String(p).trim()).join(' ');
const districtDest = (dest) => `This is a District line train to ${dest}.`;
const circleDest = (dest) => { const via = CIRCLE_VIA[dest]; return via ? `This is a Circle line train to ${dest} ${via.spoken}.` : `This is a Circle line train to ${dest}.`; };
const WESTMINSTER_EXITS = 'Exit for Westminster Abbey, the Houses of Parliament and riverboat services from Westminster Pier.';

// ---------------------------------------------------------------------------
// On-train scripts. Keys used by the train service: 'arriving' (doors opening at
// Westminster), 'doorsClosing', 'departing'. Extra keys ('approaching', 'terminates',
// 'nextStation', 'terminus', …) are available for the trains / soundscape modules.
// Getters make the OPTIONS flags live.
// ---------------------------------------------------------------------------
function jubileeSet(direction) {
  const next = NEXT_STATION.jubilee[direction], inter = NEXT_INTERCHANGE.jubilee[direction];
  return {
    voice: 'Celia Drummond', stock: '1996',
    // leaving the previous station (Green Park / Waterloo)
    terminates: (dest) => `This train terminates at ${dest}.`,
    approaching: 'The next station is Westminster. Change for the District and Circle lines.',
    // braking in / doors opening — the Jubilee DVA never names its own line
    get arriving() {
      const lines = OPTIONS.jubileeAlphabetical ? 'Circle and District' : 'District and Circle';
      const out = [`This station is Westminster. Change here for the ${lines} lines.`];
      if (OPTIONS.jubileeExitClause) out.push('Exit here for the Houses of Parliament and Westminster Abbey.');
      if (OPTIONS.jubileeDoorSide) out.push(`Doors will open on the ${DOOR_SIDE.jubilee[direction]}-hand side.`);
      return out;
    },
    get doorsClosing() { return OPTIONS.jubileeMaleDepartReady ? 'This train is now ready to depart. Please stand clear of the closing doors.' : 'Please stand clear of the doors.'; },
    // pulling away: destination first, then the next station with its interchanges
    departing: (dest) => join(`This train terminates at ${dest}.`, `The next station is ${next}.`, inter),
    nextStation: join(`The next station is ${next}.`, inter),
    terminus: 'All change please. This train terminates here. All change please.',
    doorSide: `Doors will open on the ${DOOR_SIDE.jubilee[direction]}-hand side.`,
  };
}

function s7Set(line, direction) {
  const next = NEXT_STATION[line][direction], inter = NEXT_INTERCHANGE[line][direction];
  const destLine = line === 'circle' ? circleDest : districtDest;
  return {
    voice: 'Sarah Parnell', stock: 'S7',
    // leaving St James's Park / Embankment: destination + next station + interchange + exits
    approaching: (dest) => join(destLine(dest), 'The next station is Westminster. Change for the Jubilee line.', WESTMINSTER_EXITS),
    // arrival = station name + interchange (+ the mind-the-gap file flagged for Westminster's curve)
    get arriving() { return OPTIONS.s7MindTheGap ? ['This is Westminster. Change for the Jubilee line.', 'Please mind the gap between the train and the platform.'] : ['This is Westminster. Change for the Jubilee line.']; },
    // S7 door close is the pulsed alarm + unison slam with no spoken line; a single space keeps the train service from
    // substituting its Jubilee-style default (see the core note in the soundscape report)
    get doorsClosing() { return OPTIONS.s7SpokenDoorClose ? 'Please mind the doors.' : ' '; },
    departing: (dest) => join(destLine(dest), `The next station is ${next}.`, inter),
    destination: destLine,
    nextStation: join(`The next station is ${next}.`, inter),
    mindTheGap: 'Please mind the gap between the train and the platform.',
    extras: [
      'The front doors will not open at the next station.',
      'Customers are reminded that smoking and drinking alcohol is not permitted on TfL services.',
      'Please keep your belongings with you at all times.',
    ],
    destinationChanged: (dest) => `The destination of this train has now changed. This train is now a ${LINE_NAMES[line]} line train to ${dest}. Please change where necessary.`,
  };
}

export const TRAIN_ANNOUNCEMENTS = {
  jubilee: { eastbound: jubileeSet('eastbound'), westbound: jubileeSet('westbound') },
  district: { eastbound: s7Set('district', 'eastbound'), westbound: s7Set('district', 'westbound') },
  circle: { eastbound: s7Set('circle', 'eastbound'), westbound: s7Set('circle', 'westbound') },
};

/** Remembered alternatives that are NOT the default (kept verbatim so they can be switched in from a recording). */
export const VARIANTS = {
  jubileeArrival: [
    'This is Westminster. Change for the District and Circle lines. Exit for the Houses of Parliament and Westminster Abbey.',
    'This station is Westminster. Change here for the Circle and District lines. This train terminates at Stratford.',
    'This is Westminster. Change here for the Circle and District lines.',
  ],
  jubileeDoorClose: ['This train is now ready to depart. Please stand clear of the closing doors.'],
  jubileeWestboundTerminates: ['Stanmore', 'Wembley Park', 'Willesden Green', 'West Hampstead', 'Neasden', 'Canons Park'].map(d => `This train terminates at ${d}.`),
  districtOld2013: 'The next station is Westminster. Change for the Jubilee Line.',
  circleWestboundVia: 'This is a Circle line train to Edgware Road via Victoria and High Street Kensington.',
};

// ---------------------------------------------------------------------------
// Station PA (dossier §10.7). Female = Elinor Hamilton (TfL Connect long-line),
// male = Phil Sayer inserts. `male: true` entries are spoken lower-pitched.
// ---------------------------------------------------------------------------
const lineName = (line) => LINE_NAMES[line] || 'District';
export const STATION_PA = {
  /** 'The next train will be a … service calling at all stations to …' — the current (2021-verified) form. */
  nextTrain: (line, destination, platform) => {
    const head = `The next train will be a ${lineName(line)} line service calling at all stations to ${destination}.`;
    if (line === 'jubilee' || platform === 3 || platform === 4) return head;   // behind the PEDs no yellow-line message is needed
    return `${head} Please stand behind the yellow line as the train approaches, use the full length of the platform, and let customers off the train first.`;
  },
  /** The same event as the world module calls it (alias kept for the brief's signature). */
  arriving: (line, destination, platform) => STATION_PA.nextTrain(line, destination, platform),
  /** Older, pre-S7 (c. 2010–2016) forms — kept as rare alternates, not used automatically. */
  older: {
    approaching: (platform, destination) => `Platform ${platform}: the train now approaching is to ${destination}.`,
    circleApproaching: (via, destination) => `The train now approaching is a Circle line train via ${via} to ${destination}.`,
    indicator2011: (destination, minutes, next) => `The next train to ${destination} will arrive in ${minutes} ${minutes === 1 ? 'min' : 'mins'} — next station ${next}.`,
  },
  approaching: 'The next train is now approaching. Please stand behind the yellow line.',
  standBack: 'Please stand behind the yellow line.',
  mindTheGap: { text: 'Mind the gap please.', male: true },                                    // Phil Sayer, as an S7 draws in
  mindTheGapLong: 'Please mind the gap between the train and the platform.',
  standClear: { text: 'Stand clear of the doors please.', male: true },                        // Phil Sayer, from the Jubilee platform speakers as a train prepares to leave
  letCustomersOff: 'Please let customers off the train first.',
  fullLength: 'Please use the full length of the platform.',
  jubileePlatform: ['Please stand clear of the platform edge doors.', 'Please let customers off the train first.'],
  /** Everyday safety files, all levels. */
  safety: [
    'Please keep your belongings with you at all times and report anything suspicious to a member of staff.',
    'For your safety, please hold the handrail on the escalators.',
    'Please keep your belongings with you at all times.',
    'Please stand behind the yellow line.',
  ],
  security: { text: "This is a security message. If you see something that doesn't look right, speak to staff or text the British Transport Police on 61016. We'll sort it. See it. Say it. Sorted.", male: true },
  /** 'This is a customer announcement: …' housekeeping lines heard in the ticket hall. */
  customer: (text) => `This is a customer announcement. ${text}`,
  customerLines: [
    'Please do not leave luggage unattended anywhere on the station. Unattended items may be removed and destroyed.',
    'Please keep your belongings with you at all times and take care on the escalators.',
    'Please have your ticket or Oyster card ready as you approach the gates.',
    'Please stand on the right on the escalators and keep moving through the ticket hall.',
  ],
  serviceUpdate: 'This is a London Underground service update. There is a good service on all London Underground lines.',
  serviceUpdateExamples: [
    'There are severe delays on the Bakerloo line between Harrow & Wealdstone and Queen\'s Park, due to an earlier points failure at Willesden Junction. Tickets will be accepted on London Buses.',
    'The District line is part suspended in both directions between Wimbledon and Earl\'s Court due to a signal system failure. Tickets are being accepted on South Western Railway and London Buses.',
  ],
  staff: ['Have your cards ready please.', 'Please keep moving.', 'Hold the handrail please.'],
  /** Emergency files — never played automatically; exposed for the 'bigBen' style test API only. */
  inspectorSands: (where = 'the operations room') => `Would Inspector Sands please report to ${where} immediately.`,
  emergency: 'Attention please. This is an emergency. Please leave the station immediately.',
};

// ---------------------------------------------------------------------------
// Destinations per line/direction with rough share of trains (dossier §9.1, §9.2).
// ---------------------------------------------------------------------------
export const DESTINATIONS = {
  jubilee: {
    eastbound: [['Stratford', 0.78], ['North Greenwich', 0.15], ['West Ham', 0.04], ['Waterloo', 0.02], ['London Bridge', 0.01]],
    westbound: [['Stanmore', 0.5], ['Wembley Park', 0.17], ['Willesden Green', 0.17], ['West Hampstead', 0.16]],
    lateEvening: { westbound: [['Neasden', 0.5], ['Canons Park', 0.5]] },
  },
  district: {
    eastbound: [['Upminster', 0.55], ['Tower Hill', 0.2], ['Barking', 0.15], ['Dagenham East', 0.08], ['Plaistow', 0.02]],
    westbound: [['Wimbledon', 0.35], ['Richmond', 0.25], ['Ealing Broadway', 0.25], ['Edgware Road', 0.1], ['Kensington (Olympia)', 0.02], ["Earl's Court", 0.02], ['Parsons Green', 0.01]],
  },
  circle: {
    eastbound: [['Hammersmith', 1]],
    westbound: [['Edgware Road', 1]],
  },
};

/** Trains per hour (dossier §9.1–9.2) → seconds between trains. */
export const HEADWAYS = {
  jubilee: { peak: 120, offPeak: 150 },
  district: { peak: 171, offPeak: 200 },
  circle: { peak: 600, offPeak: 600 },
  combinedSubSurface: { peak: 133, offPeak: 150 },
};

/** Weighted pick from a DESTINATIONS list. rng defaults to Math.random. */
export function pickDestination(line, direction, rng = Math.random) {
  const list = (DESTINATIONS[line] && DESTINATIONS[line][direction]) || DESTINATIONS.district.eastbound;
  const total = list.reduce((a, d) => a + d[1], 0); let r = rng() * total;
  for (const [name, w] of list) { r -= w; if (r <= 0) return name; }
  return list[0][0];
}

/** Resolve one on-train line to a plain string (same rules as the train service: functions get the destination, arrays are joined). */
export function trainLine(line, direction, key, destination) {
  const set = TRAIN_ANNOUNCEMENTS[line] && TRAIN_ANNOUNCEMENTS[line][direction]; if (!set) return null;
  let v = set[key]; if (typeof v === 'function') v = v(destination);
  if (Array.isArray(v)) v = v.filter(Boolean).join(' ');
  return typeof v === 'string' && v.trim() ? v : null;
}
