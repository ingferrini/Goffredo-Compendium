import assert from 'node:assert/strict';
import test from 'node:test';

import * as unleash from '../scripts/echo-knight/unleash-incarnation.mjs';

function context({constitution = 0, spent = 0, targets = 1} = {}) {
  const actor = {
    uuid: 'Actor.owner',
    system: {abilities: {con: {mod: constitution}}}
  };
  const updates = [];
  const item = {
    uuid: 'Actor.owner.Item.unleash',
    name: 'Unleash Incarnation',
    system: {uses: {spent}},
    async update(data) { updates.push(data); }
  };
  const workflow = {
    id: 'attack-action-1',
    actor,
    token: {document: {uuid: 'Scene.scene.Token.owner'}},
    targets: new Set(Array.from({length: targets}, (_, index) => ({uuid: `Target.${index}`})))
  };
  return {actor, item, updates, workflow};
}

test('available uses use Constitution modifier with a minimum maximum of one', () => {
  const low = context({constitution: 0, spent: 0});
  const high = context({constitution: 3, spent: 1});

  assert.equal(unleash.availableUnleashUses(low.actor, low.item), 1);
  assert.equal(unleash.availableUnleashUses(high.actor, high.item), 2);
});

test('cancelled attack selection does not consume an Unleash use', async () => {
  const ctx = context({constitution: 2});
  let attacks = 0;
  const deps = {
    attackFromEcho: async ({meleeOnly}) => {
      attacks += 1;
      assert.equal(meleeOnly, true);
      return undefined;
    },
    notify() {}
  };

  const result = await unleash.useUnleash({document: ctx.item, workflow: ctx.workflow}, deps);

  assert.equal(result, undefined);
  assert.equal(attacks, 1);
  assert.deepEqual(ctx.updates, []);
});

test('a started melee attack consumes one use only once for the same Attack action workflow', async () => {
  const ctx = context({constitution: 2});
  let attacks = 0;
  const deps = {
    attackFromEcho: async () => {
      attacks += 1;
      return {id: 'synthetic-attack'};
    },
    notify() {}
  };

  const first = await unleash.useUnleash({document: ctx.item, workflow: ctx.workflow}, deps);
  const duplicate = await unleash.useUnleash({document: ctx.item, workflow: ctx.workflow}, deps);

  assert.equal(first.id, 'synthetic-attack');
  assert.equal(duplicate, undefined);
  assert.equal(attacks, 1);
  assert.deepEqual(ctx.updates, [{'system.uses.spent': 1}]);
});

test('no target or no remaining uses prevents the extra attack', async () => {
  for (const ctx of [context({targets: 0}), context({constitution: 1, spent: 1})]) {
    let attacks = 0;
    const notices = [];
    const result = await unleash.useUnleash({document: ctx.item, workflow: ctx.workflow}, {
      attackFromEcho: async () => { attacks += 1; },
      notify: key => notices.push(key)
    });

    assert.equal(result, undefined);
    assert.equal(attacks, 0);
    assert.equal(notices.length, 1);
  }
});

test('Unleash automation listens to its stable activity identifier', () => {
  assert.equal(unleash.unleashIncarnation.rules, '2014');
  assert.deepEqual(unleash.unleashIncarnation.roll.map(entry => entry.pass), ['itemRollFinished']);
});
