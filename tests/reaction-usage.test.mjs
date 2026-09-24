import assert from 'node:assert/strict';
import test from 'node:test';

import * as usage from '../scripts/reactions/usage.mjs';

function actor({hasPlayerOwner = true} = {}) {
  const effects = new Map();
  let next = 0;
  return {
    hasPlayerOwner,
    effects,
    async createEmbeddedDocuments(_type, list) {
      return list.map(data => {
        const effect = {id: `e${next += 1}`, disabled: false, ...data};
        effects.set(effect.id, effect);
        return effect;
      });
    },
    async deleteEmbeddedDocuments(_type, ids) { ids.forEach(id => effects.delete(id)); }
  };
}

const values = collection => Array.from(collection.values());

test('using a reaction places a visible marker, and the marker is the reaction state', async () => {
  const ash = actor();
  assert.equal(usage.hasUsedReaction(ash), false);

  await usage.markReactionUsed(ash, {midi: async () => {}});
  const [marker] = values(ash.effects);
  assert.equal(marker.img, 'modules/midi-qol/icons/reaction.svg');
  assert.deepEqual(marker.statuses, ['reaction']);
  assert.deepEqual(marker.flags.dae.specialDuration, ['turnStart']);
  assert.equal(usage.hasUsedReaction(ash), true);

  // Deleting the marker by hand gives the reaction back.
  ash.effects.delete(marker.id);
  assert.equal(usage.hasUsedReaction(ash), false);
});

test('when Midi places its own marker the module adds none', async () => {
  const korax = actor();
  await usage.markReactionUsed(korax, {midi: async target => {
    target.effects.set('dnd5ereaction000', {id: 'dnd5ereaction000', name: 'Reaction used', disabled: false});
  }});
  assert.deepEqual(Array.from(korax.effects.keys()), ['dnd5ereaction000']);
});

test('the module marker is removed when the actor turn starts', async () => {
  const ash = actor();
  await usage.markReactionUsed(ash, {midi: async () => {}});
  ash.effects.set('other', {id: 'other', name: 'Rage', disabled: false});
  await usage.restoreReaction({combatant: {actor: ash}});
  assert.deepEqual(Array.from(ash.effects.keys()), ['other']);
});

test('a visible reaction effect or status counts as used', () => {
  const withEffect = (name, extra = {}) => ({effects: [{id: 'x', name, disabled: false, ...extra}]});
  assert.equal(usage.hasUsedReaction(withEffect('Reaction')), true);
  assert.equal(usage.hasUsedReaction(withEffect('Reazione usata')), true);
  assert.equal(usage.hasUsedReaction(withEffect('Reactive Strike')), false);
  assert.equal(usage.hasUsedReaction({effects: [{id: 'dnd5ereaction000', name: 'x'}]}), true);
  assert.equal(usage.hasUsedReaction({statuses: new Set(['reaction']), effects: []}), true);
  assert.equal(usage.hasUsedReaction(withEffect('Reaction', {disabled: true})), false);
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


test('an existing marker is not marked again', async () => {
  const ash = actor();
  ash.effects.set('dfreds', {id: 'dfreds', name: 'Reaction', disabled: false});
  let midiCalls = 0;
  await usage.markReactionUsed(ash, {midi: async () => { midiCalls += 1; }});
  assert.equal(midiCalls, 0);
  assert.deepEqual(Array.from(ash.effects.keys()), ['dfreds']);
});
