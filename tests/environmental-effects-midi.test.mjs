import assert from 'node:assert/strict';
import test from 'node:test';
import {buildEnvironmentalItemData, ensureEnvironmentalActor, resolveEnvironmentalWorkflow} from '../scripts/environmental-effects/midi.mjs';

test('builds a numeric save activity with Midi damage-on-save semantics', () => {
  const data = buildEnvironmentalItemData({damage: '4d10', damageType: 'fire', saveAbility: 'dex', dc: 15, saveMode: 'half'});
  const activity = Object.values(data.system.activities)[0];
  assert.match(activity._id, /^[A-Za-z0-9]{16}$/);
  assert.ok(data.system.activities[activity._id]);
  assert.equal(activity.type, 'save');
  assert.equal(activity.save.dc.formula, '15');
  assert.equal(activity.damage.onSave, 'half');
  assert.deepEqual(activity.damage.parts[0].custom, {enabled: true, formula: '4d10'});
});

test('builds a damage activity when no save is configured', () => {
  const data = buildEnvironmentalItemData({damage: '2d6', damageType: 'cold', saveAbility: '', dc: null});
  assert.equal(Object.values(data.system.activities)[0].type, 'damage');
});

test('normalizes remote Midi workflow sets', async () => {
  const targets = [{uuid: 'Token.a'}, {uuid: 'Token.b'}];
  const result = await resolveEnvironmentalWorkflow({itemData: {}, actor: {}, targets}, {
    createItem: () => ({name: 'Environmental Effect'}),
    completeItemUse: async (_item, config) => {
      assert.deepEqual(config.midiOptions.targetUuids, ['Token.a', 'Token.b']);
      return {workflow: {failedSaves: targets.slice(0, 1), saves: targets.slice(1)}};
    }
  });
  assert.equal(result.failed.size, 1);
  assert.equal(result.succeeded.size, 1);
});

test('creates one hidden flagged source actor and reuses it', async () => {
  const created = [];
  const actor = await ensureEnvironmentalActor([], {createActor: async data => { created.push(data); return data; }});
  assert.equal(actor.name, 'Environmental Effects');
  assert.equal(actor.flags['goffredo-compendium'].environmentalSource, true);
  assert.equal(created.length, 1);
  const reused = await ensureEnvironmentalActor([actor], {createActor: async () => assert.fail('must not create')});
  assert.equal(reused, actor);
});
