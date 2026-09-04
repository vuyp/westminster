// Scripted route through the station used by test/run.mjs. yaw in degrees (0 = looking north / -z), pitch in degrees.
import { LEVELS, JUBILEE, DISTRICT, ESCALATORS, dcToWorld } from '../src/core/layout.js';
const p1 = dcToWorld(0, 6.2), p2 = dcToWorld(0, -6.2);           // platform centres (District local frame)
const p1door = dcToWorld(3.9, 6.5);                                // an S7 middle-car doorway is ≈3.9 m forward of the train centre (westbound train faces -s, so the door is at s = -3.9 for P1)
const p1doorW = dcToWorld(-3.9, 6.5);
const yawToward = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z)) * 180 / Math.PI;
const escA = ESCALATORS[0];
export const ROUTE = [
  { name: 'street-big-ben', x: 8, y: 0, z: 2.5, yaw: yawToward({ x: 8, z: 2.5 }, { x: 22, z: 40 }), pitch: 22, expectZone: 'street' },
  { name: 'street-entrance', x: 3, y: 0, z: 4, yaw: 0, pitch: 5, expectZone: 'street' },
  { name: 'stairs-down', x: -0.5, y: -1.0, z: -8, yaw: 0, pitch: -12 },
  { name: 'ticket-hall', x: -1, y: LEVELS.concourse, z: -15, yaw: 0, pitch: 0, expectZone: 'ticketHall', expectY: LEVELS.concourse },
  { name: 'gateline', x: -10, y: LEVELS.concourse, z: -20, yaw: 0, pitch: 0, expectZone: 'ticketHall', walk: 1 },
  { name: 'escalator-a-top', x: 44, y: LEVELS.concourse, z: -8, yaw: 90, pitch: -15 },
  { name: 'interchange-east', x: 22, y: LEVELS.interchangeEast, z: -16, yaw: 90, pitch: 5, expectZone: 'box' },
  { name: 'void-from-west', x: -12, y: LEVELS.interchangeWest, z: -16, yaw: -90, pitch: -10, expectZone: 'box' },
  { name: 'well-west-upper', x: -20, y: LEVELS.jubUpper, z: -16, yaw: 180, pitch: 0, expectZone: 'box' },
  { name: 'jubilee-p3', x: 0, y: LEVELS.jubUpper, z: 2.5, yaw: -90, pitch: 0, expectZone: 'jubileePlatformUpper', expectY: LEVELS.jubUpper },
  { name: 'jubilee-p4', x: 0, y: LEVELS.jubLower, z: 2.5, yaw: 90, pitch: 0, expectZone: 'jubileePlatformLower', expectY: LEVELS.jubLower },
  { name: 'district-p1', x: p1.x, y: LEVELS.dcPlatform, z: p1.z, yaw: yawToward(p1, dcToWorld(60, 6.2)), pitch: 0, expectZone: 'dcPlatform1', expectY: LEVELS.dcPlatform },
  { name: 'district-p2', x: p2.x, y: LEVELS.dcPlatform, z: p2.z, yaw: yawToward(p2, dcToWorld(-60, -6.2)), pitch: 0, expectZone: 'dcPlatform2', expectY: LEVELS.dcPlatform },
  { name: 'exit3-big-ben', x: 46, y: 0, z: 31, yaw: yawToward({ x: 46, z: 31 }, { x: 22, z: 40 }), pitch: 35, expectZone: 'street' },
  // Ride escalator bank (a) from the concourse down to the interchange east (moving ramp carries the player westward)
  { name: 'ride-escalator', x: escA.top.x + 2, y: escA.top.y, z: escA.top.z, yaw: 90, pitch: -15, walk: 2.0, advance: 30, expectY: escA.bottom.y, expectGrounded: true },
  // Board a Jubilee train on Platform 3: stand facing the track (south), wait for a train with open doors, walk in.
  // (a 1996 TS middle-car double doorway is ≈2.35 m forward of the train centre; the eastbound train faces +x)
  { name: 'board-jubilee', x: 2.35, y: LEVELS.jubUpper, z: 1.8, yaw: 180, pitch: 0, advanceUntil: 'doorsOpen:jubileeUpper', walk: 2.6, expectTrain: true },
  { name: 'ride-jubilee', x: 2.35, y: LEVELS.jubUpper, z: 1.8, yaw: 180, pitch: 0, advanceUntil: 'doorsOpen:jubileeUpper', walk: 2.6, advance: 45, expectTrain: true },
  // Board a westbound District train from Platform 1 (train is on the NW side of the platform)
  { name: 'board-district', x: p1doorW.x, y: LEVELS.dcPlatform, z: p1doorW.z, yaw: yawToward(p1doorW, dcToWorld(-3.9, 0)), pitch: 0, advanceUntil: 'doorsOpen:districtWB', walk: 2.8, expectTrain: true },
];
