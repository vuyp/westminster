// Unit tests for the collision maths (run: node test/collision.test.mjs). Needs `npm install` (three from node_modules).
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Collision } from '../src/core/collision.js';

const c = new Collision();
c.addFloor({ xMin: -10, xMax: 10, zMin: -10, zMax: 10, y: 0, tag: 'ground' });
c.addFloor({ xMin: 2, xMax: 4, zMin: 2, zMax: 4, y: 0.3, tag: 'step' });
c.addFloor({ xMin: -4, xMax: -2, zMin: -4, zMax: -2, y: 2.0, tag: 'ledge' });
const ramp = c.addRamp({ x: 0, y: 0, z: 10 }, { x: 0, y: -6, z: 20.39 }, 1.2, { tag: 'stairs', sound: 'stairs' });
c.addBlocker({ xMin: 5, xMax: 6, yMin: 0, yMax: 3, zMin: -1, zMax: 1 }, 'wall');
c.addBlocker({ xMin: -1, xMax: 1, yMin: 0, yMax: 0.3, zMin: 5, zMax: 6 }, 'kerb');

// flat floor
assert.equal(c.floorAt(0, 0, 0).y, 0);
// step-up allowed
assert.equal(c.floorAt(3, 3, 0).floor.tag, 'step');
// ledge too high to step up from the ground: falls back to the ground
assert.equal(c.floorAt(-3, -3, 0).floor.tag, 'ground');
// ledge is used when we are already on it
assert.equal(c.floorAt(-3, -3, 2.0).floor.tag, 'ledge');
// ramp: half-way down
const mid = c.floorAt(0, 15.195, -2.9); assert.ok(mid && mid.floor.tag === 'stairs'); assert.ok(Math.abs(mid.y - -3) < 0.05, 'ramp height ' + mid.y);
// ramp width limit
assert.equal(c.floorAt(1.0, 15, -3), null);
// blocker pushes the capsule out
const p = new THREE.Vector3(4.9, 0, 0); const hit = c.resolve(p, 0.35, 1.75, 0.45); assert.ok(hit); assert.ok(p.x <= 5 - 0.35 + 1e-6, 'pushed out to ' + p.x);
// low kerb is stepped over, not blocked
const q = new THREE.Vector3(0, 0, 5.5); assert.equal(c.resolve(q, 0.35, 1.75, 0.45), false);
// remove
c.remove(ramp); assert.equal(c.floorAt(0, 15.195, -2.9), null);
console.log('collision tests passed');
