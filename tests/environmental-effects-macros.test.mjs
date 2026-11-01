import assert from 'node:assert/strict';
import test from 'node:test';
import {createPresetMacro, deletePresetMacro, discoverPresets, duplicatePresetMacro, updatePresetMacro} from '../scripts/environmental-effects/macros.mjs';

const preset = {
  id: 'firestorm', name: 'Firestorm', icon: 'fire.webp', animation: 'jb2a.fireball', lingeringAnimation: '', sound: '',
  persistent: false, placement: {mode: 'template', shape: 'circle', distance: 10, width: 5}, audience: 'enemies',
  mechanics: {damage: '4d10', damageType: 'fire', condition: '', saveAbility: 'dex', dc: 15, saveMode: 'half', duration: {value: null, unit: 'round'}}
};

test('discovers only flagged environmental macros', () => {
  const macros = [
    {id: 'a', flags: {'goffredo-compendium': {environmentalEffect: preset}}},
    {id: 'b', flags: {}}
  ];
  assert.deepEqual(discoverPresets(macros).map(row => row.macro.id), ['a']);
});

test('creates a minimal delegating script macro', async () => {
  const created = [];
  await createPresetMacro(preset, {create: async data => { created.push(data); return data; }});
  assert.equal(created[0].type, 'script');
  assert.match(created[0].command, /runEnvironmentalEffect\("firestorm"\)/);
  assert.deepEqual(created[0].flags['goffredo-compendium'].environmentalEffect, preset);
});

test('updates, duplicates with a new id, and deletes through the repository', async () => {
  const calls = [];
  const repository = {
    update: async (macro, changes) => calls.push(['update', macro.id, changes]),
    create: async data => { calls.push(['create', data]); return data; },
    delete: async macro => calls.push(['delete', macro.id])
  };
  const macro = {id: 'a'};
  await updatePresetMacro(macro, {...preset, name: 'Firestorm II'}, repository);
  const duplicate = await duplicatePresetMacro(preset, repository, () => 'copy-id');
  await deletePresetMacro(macro, repository);
  assert.equal(calls[0][2].name, 'Firestorm II');
  assert.equal(duplicate.flags['goffredo-compendium'].environmentalEffect.id, 'copy-id');
  assert.deepEqual(calls.at(-1), ['delete', 'a']);
});
