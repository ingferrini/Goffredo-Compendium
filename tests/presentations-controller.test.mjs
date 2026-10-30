import assert from 'node:assert/strict';
import test from 'node:test';
import {ACTIVE_PRESENTATION_SETTING, LIBRARY_SETTING, registerPresentationSettings} from '../scripts/presentations/controller.mjs';

test('registers hidden world settings with a world-specific default root', () => {
  const calls = [];
  registerPresentationSettings({register: (...args) => calls.push(args)}, 'wildemount');
  assert.equal(calls[0][1], LIBRARY_SETTING);
  assert.equal(calls[0][2].default.root, 'assets/wildemount/presentations');
  assert.equal(calls[1][1], ACTIVE_PRESENTATION_SETTING);
  assert.equal(calls[1][2].scope, 'world');
});
