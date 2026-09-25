import assert from 'node:assert/strict';
import test from 'node:test';

import * as transient from '../scripts/shared/transient.mjs';
import {withReactionReach} from '../scripts/reactions/usage.mjs';

test('transient effects are flagged and swept from every actor', async () => {
  const data = transient.markTransient({name: 'Reaction reach', flags: {dae: {x: 1}}});
  assert.equal(transient.isTransient(data), true);
  assert.deepEqual(data.flags.dae, {x: 1});

  const deleted = [];
  const actor = {
    effects: [{id: 'a', ...data}, {id: 'b', name: 'Rage', flags: {}}],
    async deleteEmbeddedDocuments(_type, ids) { deleted.push(...ids); }
  };
  assert.equal(await transient.sweepTransientEffects([actor, {effects: []}]), 1);
  assert.deepEqual(deleted, ['a']);
});

test('a roll that never completes times out instead of hanging', async () => {
  const never = new Promise(() => {});
  const timers = {setTimeout: fn => { fn(); return 1; }, clearTimeout: () => {}};
  assert.equal(await transient.withTimeout(never, 10, timers), undefined);
  assert.equal(await transient.withTimeout(Promise.resolve('rolled'), 10, {setTimeout: () => 1, clearTimeout: () => {}}), 'rolled');
});

test('the reach grace effect is transient', async () => {
  let created;
  const effect = {id: 'g', delete: async () => {}};
  const actor = {
    effects: new Map([['g', effect]]),
    async createEmbeddedDocuments(_type, [data]) { created = data; return [effect]; }
  };
  await withReactionReach(actor, async () => 'ok');
  assert.equal(transient.isTransient(created), true);
});

test('leftovers from older versions are recognised, the echo marker is not', () => {
  assert.equal(transient.isTransient({name: 'Reaction reach', changes: [{key: 'flags.midi-qol.range.all'}]}), true);
  assert.equal(transient.isTransient({name: 'Manifest Echo', changes: [{key: 'flags.midi-qol.rangeOverride.attack.all'}]}), true);
  assert.equal(transient.isTransient({name: 'Manifest Echo', changes: []}), false);
  assert.equal(transient.isTransient({name: 'Rage', changes: [{key: 'system.bonuses.mwak.damage'}]}), false);
});
