import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMechanicsForm, parsePresetForm, renderEffectStudio, renderMechanicsDialog} from '../scripts/environmental-effects/studio.mjs';

const localize = key => key;
const preset = {
  id: 'fire', name: '<Firestorm>', icon: 'fire.webp', animation: 'jb2a.fireball', sound: '', persistent: true,
  placement: {mode: 'template', shape: 'circle', distance: 20, width: 5}, audience: 'enemies',
  mechanics: {damage: '4d10', damageType: 'fire', condition: 'prone', saveAbility: 'dex', dc: 15, saveMode: 'half', duration: {value: 2, unit: 'round'}}
};

test('renders the approved three-column Effect Studio and escapes preset names', () => {
  const html = renderEffectStudio({presets: [{preset}], selected: preset, query: '', animationPaths: ['jb2a.fireball'], previewSrc: ''}, {localize});
  assert.match(html, /gac-environment-list/);
  assert.match(html, /gac-environment-visual/);
  assert.match(html, /gac-environment-actions/);
  assert.match(html, /&lt;Firestorm&gt;/);
  assert.doesNotMatch(html, /<Firestorm>/);
  assert.match(html, /data-action="previewCanvas"/);
  assert.match(html, /data-action="manageEffects"/);
  assert.match(html, /data-animation-field="animation"/);
  assert.match(html, /name="lingeringAnimation"/);
  assert.match(html, /data-preview="activation"/);
  assert.match(html, /data-preview="lingering"/);
  assert.match(html, /gac-environment-preview-grid/);
  assert.match(html, /GAC\.EnvironmentalEffects\.TemplateSize/);
  assert.match(html, /GAC\.EnvironmentalEffects\.RayWidth/);
});

test('parses empty and unchecked visual fields safely', () => {
  const result = parsePresetForm({
    id: 'fire', name: 'Firestorm', icon: '', animation: 'jb2a.fire', sound: '',
    lingeringAnimation: 'jb2a.fire.loop',
    placementMode: 'scene', templateShape: 'cone', templateDistance: '30', templateWidth: '10', audience: 'everyone'
  }, preset.mechanics);
  assert.equal(result.persistent, false);
  assert.deepEqual(result.placement, {mode: 'scene', shape: 'cone', distance: 30, width: 10});
  assert.equal(result.icon, 'icons/svg/explosion.svg');
  assert.equal(result.lingeringAnimation, 'jb2a.fire.loop');
});

test('mechanics dialog contains targets, damage, save, condition, and duration controls', () => {
  const html = renderMechanicsDialog({targets: [{id: 'a', name: 'Visible token'}], mechanics: preset.mechanics, conditions: [{id: 'prone', name: 'Prone'}], damageTypes: [{id: 'fire', name: 'Fire'}]}, {localize});
  for (const field of ['target.a', 'damage', 'damageType', 'condition', 'saveAbility', 'dc', 'saveMode', 'durationValue', 'durationUnit']) assert.match(html, new RegExp(`name="${field.replace('.', '\\.')}`));
});

test('renders independent activation and lingering preview sources', () => {
  const selected = {...preset, lingeringAnimation: 'jb2a.fire.ground'};
  const html = renderEffectStudio({presets: [{preset: selected}], selected, query: '', animationPaths: [], activationPreviewSrc: 'activation.webm', lingeringPreviewSrc: 'lingering.webm'}, {localize});
  assert.match(html, /src="activation\.webm"/);
  assert.match(html, /src="lingering\.webm"/);
});

test('parses the nested target object produced by Foundry FormDataExtended', () => {
  const result = parseMechanicsForm({
    target: {enemyA: true, enemyB: false, enemyC: 'on'},
    damage: '2d6', damageType: 'fire', condition: '', saveAbility: 'dex', dc: '14', saveMode: 'half',
    durationValue: '', durationUnit: 'round'
  });
  assert.deepEqual(result.targets, ['enemyA', 'enemyC']);
});
