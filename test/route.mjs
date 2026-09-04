// Scripted route through the station used by test/run.mjs. yaw in degrees (0 = looking north / -z), pitch in degrees.
import { LEVELS } from '../src/core/layout.js';
export const ROUTE = [
  { name: 'street-big-ben', x: 14, y: 0, z: 3.5, yaw: 150, pitch: 18, expectZone: 'street' },
  { name: 'street-entrance', x: 2, y: 0, z: 4, yaw: 0, pitch: 5, expectZone: 'street' },
  { name: 'stairs-down', x: 0, y: -1.2, z: -4, yaw: 0, pitch: -10 },
  { name: 'ticket-hall', x: 0, y: LEVELS.ticketHall, z: -16, yaw: 180, pitch: 0, expectZone: 'ticketHall', expectY: LEVELS.ticketHall },
  { name: 'gateline', x: -8, y: LEVELS.ticketHall, z: -17, yaw: 0, pitch: 0, expectZone: 'ticketHall', walk: 1 },
  { name: 'box-overlook', x: -26, y: LEVELS.ticketHall, z: -46, yaw: 0, pitch: -25, expectZone: 'ticketHall' },
  { name: 'escalator-top', x: -16, y: LEVELS.ticketHall, z: -53, yaw: 0, pitch: -20 },
  { name: 'box-mid', x: -20, y: LEVELS.jubUpper, z: -85, yaw: 90, pitch: 10, expectZone: 'box' },
  { name: 'jubilee-upper', x: -36, y: LEVELS.jubUpper, z: -80, yaw: 0, pitch: 0, expectZone: 'jubileePlatformUpper', expectY: LEVELS.jubUpper },
  { name: 'jubilee-lower', x: -36, y: LEVELS.jubLower, z: -80, yaw: 180, pitch: 0, expectZone: 'jubileePlatformLower', expectY: LEVELS.jubLower },
  { name: 'district-p1', x: -9, y: LEVELS.dcPlatform, z: 5.5, yaw: 90, pitch: 0, expectZone: 'dcPlatform1', expectY: LEVELS.dcPlatform },
  { name: 'district-p2', x: -9, y: LEVELS.dcPlatform, z: 18.5, yaw: -90, pitch: 0, expectZone: 'dcPlatform2', expectY: LEVELS.dcPlatform },
  { name: 'exit1-big-ben', x: 6, y: 0, z: 33, yaw: 200, pitch: 25, expectZone: 'street' },
  // Board a Jubilee train: stand on the upper platform facing the track, wait for a train with open doors, walk in.
  { name: 'board-jubilee', x: -35.5, y: LEVELS.jubUpper, z: -79.5, yaw: 90, pitch: 0, advanceUntil: 'doorsOpen:jubileeUpper', walk: 2.2, expectTrain: true },
  { name: 'ride-jubilee', x: -35.5, y: LEVELS.jubUpper, z: -79.5, yaw: 90, pitch: 0, advanceUntil: 'doorsOpen:jubileeUpper', walk: 2.2, advance: 45, expectTrain: true },
  // Board a District train from platform 1 (train is to the south of the platform)
  { name: 'board-district', x: -9, y: LEVELS.dcPlatform, z: 6.5, yaw: 180, pitch: 0, advanceUntil: 'doorsOpen:districtEB', walk: 2.4, expectTrain: true },
];
