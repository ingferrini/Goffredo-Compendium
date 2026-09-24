import assert from 'node:assert/strict';
import test from 'node:test';

import * as usage from '../scripts/reactions/usage.mjs';

function actor({hasPlayerOwner = true} = {}) {
  const flags = new Map();
  return {
    flags, hasPlayerOwner,
    getFlag: (_scope, key) => flags.get(key),
    async setFlag(_scope, key, value) { flags.set(key, value); },
    async unsetFlag(_scope, key) { flags.delete(key); }
  };
}

test('a reaction stays used in the same combat until the actor turn comes back', async () => {
  const ash = actor();
  const combat = {id: 'c1', round: 2, turn: 3, combatant: {actor: ash}};
  const midi = () => false;
  assert.equal(usage.hasUsedReaction(ash, {combat, midi}), false);

  await usage.markReactionUsed(ash, {combat, midi: async () => {}});
  assert.equal(usage.hasUsedReaction(ash, {combat, midi}), true);
  assert.equal(usage.hasUsedReaction(ash, {combat: {id: 'other'}, midi}), false);

  await usage.restoreReaction(combat);
  assert.equal(usage.hasUsedReaction(ash, {combat, midi}), false);
});

test('Midi reaction state still counts', () => {
  assert.equal(usage.hasUsedReaction(actor(), {combat: {id: 'c1'}, midi: () => true}), true);
});

test('only player characters and publicly named tokens show their names', () => {
  assert.equal(usage.publicName({name: 'Ash', actor: {hasPlayerOwner: true}}), 'Ash');
  assert.equal(usage.publicName({name: 'Goblin', displayName: 50, actor: {hasPlayerOwner: false}}), 'Goblin');
  assert.equal(usage.publicName({name: 'Maelis Rhor', displayName: 20, actor: {hasPlayerOwner: false}}), 'GAC.Reactions.Anonymous');
});

test('the reach grace effect wraps the roll and is removed afterwards, even on failure', async () => {
  const deleted = [];
  const effect = {id: 'e1', delete: async () => deleted.push('e1')};
  const reactor = {
    effects: new Map([['e1', effect]]),
    async createEmbeddedDocuments(_type, [data]) {
      assert.equal(data.system.changes[0].key, 'flags.midi-qol.range.all');
      return [effect];
    }
  };
  assert.equal(await usage.withReactionReach(reactor, async () => 'rolled'), 'rolled');
  await assert.rejects(usage.withReactionReach(reactor, async () => { throw new Error('boom'); }));
  assert.deepEqual(deleted, ['e1', 'e1']);
});

test('a visible reaction effect or status counts as used', () => {
  const midi = () => false;
  const withEffect = name => ({...actor(), effects: [{id: 'x', name, disabled: false}]});
  assert.equal(usage.hasUsedReaction(withEffect('Reaction'), {combat: {id: 'c1'}, midi}), true);
  assert.equal(usage.hasUsedReaction(withEffect('Reaction used'), {combat: {id: 'c1'}, midi}), true);
  assert.equal(usage.hasUsedReaction(withEffect('Reactive Strike'), {combat: {id: 'c1'}, midi}), false);
  assert.equal(usage.hasUsedReaction({...actor(), effects: [{id: 'dnd5ereaction000', name: 'x'}]}, {combat: {id: 'c1'}, midi}), true);
  assert.equal(usage.hasUsedReaction({...actor(), statuses: new Set(['reaction'])}, {combat: {id: 'c1'}, midi}), true);
  assert.equal(usage.hasUsedReaction({...actor(), effects: [{id: 'x', name: 'Reaction', disabled: true}]}, {combat: {id: 'c1'}, midi}), false);
});
