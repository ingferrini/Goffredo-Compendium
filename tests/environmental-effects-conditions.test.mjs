import assert from 'node:assert/strict';
import test from 'node:test';
import {applyCondition, conditionDuration} from '../scripts/environmental-effects/conditions.mjs';

test('maps combat and clock duration units', () => {
  assert.deepEqual(conditionDuration({value: null, unit: 'round'}), {});
  assert.deepEqual(conditionDuration({value: 2, unit: 'round'}), {rounds: 2});
  assert.deepEqual(conditionDuration({value: 3, unit: 'turn'}), {turns: 3});
  assert.deepEqual(conditionDuration({value: 2, unit: 'minute'}), {seconds: 120});
  assert.deepEqual(conditionDuration({value: 1, unit: 'hour'}), {seconds: 3600});
});

test('applies one permanent standard status when duration is empty', async () => {
  const calls = [];
  const actor = {};
  await applyCondition(actor, 'prone', {value: null, unit: 'round'}, {
    status: () => ({id: 'prone', name: 'Prone', img: 'icons/svg/falling.svg'}),
    create: async (_actor, data) => calls.push(data)
  });
  assert.deepEqual(calls[0].statuses, ['prone']);
  assert.deepEqual(calls[0].duration, {});
});

test('rejects a condition that is not registered by Foundry', async () => {
  await assert.rejects(() => applyCondition({}, 'invented', {}, {status: () => null, create: async () => {}}), /Unknown condition/);
});
