import assert from 'node:assert/strict';
import test from 'node:test';
import {executeEnvironmentalEffect, previewEnvironmentalEffect} from '../scripts/environmental-effects/execution.mjs';

const preset = {
  id: 'fire', animation: 'jb2a.fire', audience: 'enemies', persistent: false,
  placement: {mode: 'template', shape: 'circle', distance: 20, width: 5},
  mechanics: {damage: '2d6', damageType: 'fire', condition: 'prone', saveAbility: 'dex', dc: 15, saveMode: 'half', duration: {value: null, unit: 'round'}}
};

function dependencies(overrides = {}) {
  const log = [];
  const target = {id: 'enemy', actor: {}};
  return {log, target, deps: {
    placeTemplate: async () => ({location: {x: 10, y: 20}, template: {delete: async () => log.push('delete-template')}}),
    configurePlacement: async placement => placement,
    sceneArea: () => ({location: {x: 50, y: 50}}),
    collectTokens: () => [target],
    filterAudience: tokens => tokens,
    chooseTargets: async (targets, mechanics) => ({targets, mechanics, visualOnly: false}),
    validateMechanics: value => value,
    assertAnimation: async () => log.push('validate-animation'),
    playEffect: async () => log.push('play'),
    resolveMidi: async () => { log.push('midi'); return {failed: new Set([target])}; },
    applyConditions: async tokens => log.push(['conditions', ...tokens].map(value => value.id ?? value)),
    saveMechanics: async () => log.push('save'),
    ...overrides
  }};
}

test('cancellation at placement has no side effects', async () => {
  const {log, deps} = dependencies({placeTemplate: async () => null});
  assert.deepEqual(await executeEnvironmentalEffect(preset, deps), {status: 'cancelled'});
  assert.deepEqual(log, []);
});

test('plays before Midi, conditions failed saves, saves defaults, and removes template', async () => {
  const {log, deps} = dependencies();
  const result = await executeEnvironmentalEffect(preset, deps);
  assert.equal(result.status, 'resolved');
  assert.deepEqual(log, ['validate-animation', 'play', 'midi', ['conditions', 'enemy'], 'save', 'delete-template']);
});

test('no-save effects condition every selected target', async () => {
  const noSave = {...preset, mechanics: {...preset.mechanics, saveAbility: '', dc: null}};
  const {log, target, deps} = dependencies({resolveMidi: async () => ({failed: new Set()})});
  await executeEnvironmentalEffect(noSave, deps);
  assert.ok(log.some(entry => Array.isArray(entry) && entry[1] === target.id));
});

test('Midi failure applies no condition and still cleans the template', async () => {
  const {log, deps} = dependencies({resolveMidi: async () => { throw new Error('Midi failed'); }});
  await assert.rejects(() => executeEnvironmentalEffect(preset, deps), /Midi failed/);
  assert.equal(log.some(entry => Array.isArray(entry) && entry[0] === 'conditions'), false);
  assert.equal(log.at(-1), 'delete-template');
});

test('preview is temporary and never invokes mechanics', async () => {
  const calls = [];
  await previewEnvironmentalEffect(preset, {x: 1, y: 2}, {assertAnimation: async () => calls.push('validate'), previewEffect: async () => calls.push('preview')});
  assert.deepEqual(calls, ['validate', 'preview']);
});
