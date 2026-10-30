import assert from 'node:assert/strict';
import test from 'node:test';
import {ACTIVE_PRESENTATION_SETTING, LIBRARY_SETTING, registerPresentationControl, registerPresentationSettings} from '../scripts/presentations/controller.mjs';

test('registers hidden world settings with a world-specific default root', () => {
  const calls = [];
  registerPresentationSettings({register: (...args) => calls.push(args)}, 'wildemount');
  assert.equal(calls[0][1], LIBRARY_SETTING);
  assert.equal(calls[0][2].default.root, 'assets/wildemount/presentations');
  assert.equal(calls[1][1], ACTIVE_PRESENTATION_SETTING);
  assert.equal(calls[1][2].scope, 'world');
});

test('registers the Foundry 14 scene-control hook during init with onChange', () => {
  let hook;
  let opened = 0;
  registerPresentationControl({on: (_name, callback) => { hook = callback; }}, {isGM: () => true, open: () => { opened += 1; }});
  const controls = {tokens: {tools: {}}};
  hook(controls);
  const tool = controls.tokens.tools['gac-presentations'];
  assert.equal(tool.visible, true);
  assert.equal(typeof tool.onChange, 'function');
  assert.equal(tool.onClick, undefined);
  tool.onChange();
  assert.equal(opened, 1);
});
