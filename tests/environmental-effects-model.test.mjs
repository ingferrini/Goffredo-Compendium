import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUDIENCE,
  SAVE_MODE,
  normalizePreset,
  saveOutcome,
  validateMechanics,
  validatePreset
} from '../scripts/environmental-effects/model.mjs';

test('normalizes an export-safe preset with remembered mechanics', () => {
  const preset = normalizePreset({
    id: 'firestorm',
    name: 'Firestorm',
    animation: 'jb2a.fireball.01.orange',
    placement: {mode: 'template', shape: 'circle', distance: 20, width: 5},
    audience: 'enemies',
    persistent: true,
    mechanics: {
      damage: '4d10', damageType: 'fire', saveAbility: 'dex', dc: 15,
      saveMode: 'half', condition: 'burning', duration: {value: 2, unit: 'round'}
    }
  });
  assert.equal(preset.audience, AUDIENCE.ENEMIES);
  assert.equal(preset.mechanics.saveMode, SAVE_MODE.HALF);
  assert.equal(preset.mechanics.dc, 15);
  assert.equal(preset.persistent, true);
  assert.equal(preset.lingeringAnimation, '');
  assert.deepEqual(preset.placement, {mode: 'template', shape: 'circle', distance: 20, width: 5});
});

test('retains an optional lingering animation path', () => {
  assert.equal(normalizePreset({lingeringAnimation: ' jb2a.fire.loop '}).lingeringAnimation, 'jb2a.fire.loop');
});

test('maps save results to damage and condition eligibility', () => {
  assert.deepEqual(saveOutcome({hasSave: false, succeeded: false}), {damage: 'full', condition: true});
  assert.deepEqual(saveOutcome({hasSave: true, succeeded: true, mode: 'half'}), {damage: 'half', condition: false});
  assert.deepEqual(saveOutcome({hasSave: true, succeeded: true, mode: 'negates'}), {damage: 'none', condition: false});
  assert.deepEqual(saveOutcome({hasSave: true, succeeded: false, mode: 'negates'}), {damage: 'full', condition: true});
});

test('migrates legacy canvas shape names to dnd5e activity target types', () => {
  assert.equal(normalizePreset({placement: {shape: 'ray'}}).placement.shape, 'line');
  assert.equal(normalizePreset({placement: {shape: 'rect'}}).placement.shape, 'square');
  assert.equal(normalizePreset({placement: {shape: 'line'}}).placement.shape, 'line');
  assert.equal(normalizePreset({placement: {shape: 'square'}}).placement.shape, 'square');
});

test('rejects invalid presets and mechanical values', () => {
  assert.throws(() => validatePreset(normalizePreset({name: 'Missing'})), /identifier/i);
  assert.throws(() => validatePreset(normalizePreset({id: 'x', name: 'Missing'})), /animation/i);
  assert.throws(() => validateMechanics({damage: '2d6', saveAbility: 'dex', dc: 0}), /DC/i);
  assert.throws(() => validateMechanics({damage: '', condition: ''}), /visual-only/i);
  assert.doesNotThrow(() => validateMechanics({damage: '', condition: ''}, {visualOnly: true}));
});
