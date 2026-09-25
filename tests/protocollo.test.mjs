import assert from 'node:assert/strict';
import test from 'node:test';

import * as protocol from '../scripts/campaign/protocollo-intangibilita.mjs';

function maelis(effects = []) {
  const store = new Map(effects.map(effect => [effect.id, effect]));
  const created = [];
  return {
    created, effects: store,
    async createEmbeddedDocuments(_type, list) { created.push(...list); return list; },
    async deleteEmbeddedDocuments(_type, ids) { ids.forEach(id => store.delete(id)); }
  };
}

test('using the protocol grants resistance, save advantage, grapple/prone immunity and the shield until next turn', async () => {
  const actor = maelis([{id: 'old', flags: {'goffredo-compendium': {protocolShield: false}}}]);
  const item = {name: 'Protocollo di intangibilità', uuid: 'Item.p', img: 'p.webp', system: {identifier: 'protocollo-intangibilita'}};
  assert.equal(await protocol.applyProtocol({item, actor}), true);
  assert.equal(actor.effects.has('old'), false);
  const [effect] = actor.created;
  assert.deepEqual(effect.flags.dae.specialDuration, ['turnStart']);
  assert.equal(effect.flags['goffredo-compendium'].protocolShield, true);
  const keys = effect.system.changes.map(change => `${change.key}=${change.value}`);
  assert.ok(keys.includes('system.traits.dr.value=psychic'));
  assert.ok(keys.includes('flags.midi-qol.advantage.ability.save.all=1'));
  assert.ok(keys.includes('system.traits.ci.value=grappled'));
  assert.ok(keys.includes('system.traits.ci.value=prone'));
  assert.equal(await protocol.applyProtocol({item: {system: {identifier: 'detect'}}, actor}), false);
});

test('the first damage under the protocol becomes 0, later damage is left to resistance', async () => {
  const effect = {id: 'e', disabled: false, flags: {'goffredo-compendium': {protocolShield: true}}};
  const token = {name: 'Maelis', actor: maelis([effect])};
  const spent = [];
  const deps = {chat: async () => {}, spendShield: async target => spent.push(target)};

  const first = {totalDamage: 14, hpDamage: 14, tempDamage: 0, oldHP: 110, newHP: 96, damageDetail: [{value: 14}]};
  assert.equal(await protocol.shieldFirstDamage(token, {ditem: first}, deps), true);
  assert.deepEqual([first.totalDamage, first.hpDamage, first.newHP, first.damageDetail[0].value], [0, 0, 110, 0]);
  assert.deepEqual(spent, [effect]);

  const second = {totalDamage: 9, hpDamage: 9, oldHP: 110, newHP: 101};
  assert.equal(await protocol.shieldFirstDamage(token, {ditem: second}, deps), false);
  assert.equal(second.hpDamage, 9);
});

test('no shield without the protocol or without damage', async () => {
  const deps = {chat: async () => {}, spendShield: async () => {}};
  assert.equal(await protocol.shieldFirstDamage({actor: maelis()}, {ditem: {totalDamage: 5}}, deps), false);
  const shielded = {actor: maelis([{id: 'e', flags: {'goffredo-compendium': {protocolShield: true}}}])};
  assert.equal(await protocol.shieldFirstDamage(shielded, {ditem: {totalDamage: 0}}, deps), false);
});

test('the protocol listens to Midi item completion and per-target damage', () => {
  const hooks = [];
  const queries = {};
  protocol.registerProtocollo({on: name => { hooks.push(name); return 1; }}, queries, {});
  assert.deepEqual(hooks, ['midi-qol.RollComplete', 'midi-qol.preTargetDamageApplication']);
  assert.equal(typeof queries['goffredo-compendium.protocolShieldSpent'], 'function');
});
