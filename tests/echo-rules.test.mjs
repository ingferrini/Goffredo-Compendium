import assert from 'node:assert/strict';
import test from 'node:test';

import {
  accumulateMovement,
  echoArmorClass,
  isMeleeAttack,
  isWithinSummonRange,
  leftEchoReach,
  movementCost3d,
  shouldDismissEcho,
  unleashUses
} from '../scripts/echo-knight/rules.mjs';

test('echo armor class is 14 plus proficiency', () => {
  assert.equal(echoArmorClass(4), 18);
});

test('Unleash Incarnation has at least one use', () => {
  assert.equal(unleashUses(-1), 1);
  assert.equal(unleashUses(0), 1);
  assert.equal(unleashUses(4), 4);
});

test('movement cost uses three-dimensional distance', () => {
  assert.equal(movementCost3d({x: 0, y: 0, elevation: 0}, {x: 3, y: 4, elevation: 12}), 13);
  assert.equal(accumulateMovement(10, {x: 0, y: 0, elevation: 0}, {x: 0, y: 0, elevation: 5}), 15);
});

test('summon and end-turn range boundaries are inclusive', () => {
  assert.equal(isWithinSummonRange(15), true);
  assert.equal(isWithinSummonRange(15.01), false);
  assert.equal(shouldDismissEcho(30), false);
  assert.equal(shouldDismissEcho(30.01), true);
});

test('leaving echo reach requires voluntary non-teleport movement of at least five feet', () => {
  const valid = {startDistance: 5, endDistance: 10, movedDistance: 5};
  assert.equal(leftEchoReach(valid), true);
  assert.equal(leftEchoReach({...valid, movedDistance: 4.99}), false);
  assert.equal(leftEchoReach({...valid, startDistance: 5.01}), false);
  assert.equal(leftEchoReach({...valid, endDistance: 5}), false);
  assert.equal(leftEchoReach({...valid, forced: true}), false);
  assert.equal(leftEchoReach({...valid, teleport: true}), false);
});

test('Unleash accepts equipped melee attack items only', () => {
  assert.equal(isMeleeAttack({hasAttack: true, equipped: true, attackType: 'melee'}), true);
  assert.equal(isMeleeAttack({hasAttack: true, equipped: false, attackType: 'melee'}), false);
  assert.equal(isMeleeAttack({hasAttack: true, equipped: true, attackType: 'ranged'}), false);
  assert.equal(isMeleeAttack({hasAttack: false, equipped: true, attackType: 'melee'}), false);
});
