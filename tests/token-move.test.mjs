import assert from 'node:assert/strict';
import test from 'node:test';

import {moveToken, withMoveToken} from '../scripts/token-move.mjs';

test('moveToken uses the Foundry TokenDocument move API', async () => {
  const calls = [];
  const token = {async move(...args) { calls.push(args); return true; }};

  assert.equal(await moveToken(token, [{x: 1, y: 2, elevation: 10, action: 'fly'}], {showRuler: false}), true);
  assert.deepEqual(calls, [[[{x: 1, y: 2, elevation: 10, action: 'fly'}], {showRuler: false}]]);
});

test('withMoveToken keeps CAT token utilities and supplies the missing moveToken', () => {
  const getDistance = () => 30;
  const utils = withMoveToken({getDistance});

  assert.equal(utils.getDistance, getDistance);
  assert.equal(utils.moveToken, moveToken);
});
