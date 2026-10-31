import assert from 'node:assert/strict';
import test from 'node:test';
import {createEnvironmentalController, registerEnvironmentalControl, registerEnvironmentalModuleApi} from '../scripts/environmental-effects/index.mjs';

test('registers a GM-only token control button', () => {
  let hook;
  let opened = 0;
  registerEnvironmentalControl({on: (_name, callback) => { hook = callback; }}, {isGM: () => true, open: () => { opened += 1; }});
  const controls = {tokens: {tools: {}}};
  hook(controls);
  controls.tokens.tools['gac-environmental-effects'].onChange();
  assert.equal(opened, 1);
  const playerControls = {tokens: {tools: {}}};
  registerEnvironmentalControl({on: (_name, callback) => callback(playerControls)}, {isGM: () => false});
  assert.equal(playerControls.tokens.tools['gac-environmental-effects'], undefined);
});

test('merges the module API and delegates preset execution', async () => {
  const calls = [];
  const module = {api: {existing: true}};
  registerEnvironmentalModuleApi(module, {run: async id => calls.push(id)});
  assert.equal(module.api.existing, true);
  await module.api.runEnvironmentalEffect('fire');
  assert.deepEqual(calls, ['fire']);
});

test('controller resolves a preset by stable id', async () => {
  const calls = [];
  const preset = {id: 'fire'};
  const controller = createEnvironmentalController({
    list: () => [{macro: {id: 'm'}, preset}],
    execute: async value => calls.push(value)
  });
  await controller.run('fire');
  assert.deepEqual(calls, [preset]);
  await assert.rejects(() => controller.run('missing'), /not found/i);
});
