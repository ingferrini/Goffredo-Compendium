import assert from 'node:assert/strict';
import test from 'node:test';

import * as pack from '../scripts/features/pack-tactics.mjs';
import * as frammento from '../scripts/items/frammento-runico.mjs';
import * as piuma from '../scripts/items/piuma-regina-corvo.mjs';

function tracker() {
  const added = [];
  return {added, tracker: {advantage: {add: (...args) => added.push(args)}}};
}

function packContext({jiraDistance = 5, incapacitated = false, requirements = 'Jira'} = {}) {
  const target = {id: 'target', actor: {name: 'Goblin'}};
  const jira = {id: 'jira', name: 'Jira', actor: {name: 'Jira', statuses: new Set(incapacitated ? ['unconscious'] : [])}};
  const scene = {tokens: [target, jira]};
  const {added, tracker: workflowTracker} = tracker();
  const workflow = {targets: new Set([target]), token: {document: {parent: scene}}, tracker: workflowTracker};
  const item = {name: 'Pack Tactics (Companion)', system: {requirements}};
  const deps = {tokenDistance: (from, to) => (from.id === 'jira' && to.id === 'target' ? jiraDistance : 30)};
  return {added, deps, item, workflow};
}

test('Pack Tactics grants advantage only while the named companion is adjacent and able', async () => {
  const near = packContext();
  await pack.packTactics({document: near.item, workflow: near.workflow}, near.deps);
  assert.equal(near.added.length, 1);

  for (const options of [{jiraDistance: 10}, {incapacitated: true}, {requirements: 'Someone Else'}, {requirements: ''}]) {
    const context = packContext(options);
    await pack.packTactics({document: context.item, workflow: context.workflow}, context.deps);
    assert.equal(context.added.length, 0, JSON.stringify(options));
  }
});

function frammentoItem({equipped = true, attuned = true, flag} = {}) {
  const flags = new Map(flag ? [['frammentoTurns', flag]] : []);
  return {
    name: 'Frammento Runico Instabile', actor: {name: 'Kragdar'},
    system: {identifier: 'frammento-runico-instabile', equipped, attuned, attunement: 'required'},
    getFlag: (_scope, key) => flags.get(key),
    async setFlag(_scope, key, value) { flags.set(key, value); },
    flags
  };
}

test('the Frammento adds 1d6 radiant to radiant spells only while equipped and attuned', async () => {
  const calls = [];
  const deps = {workflowUtils: {async bonusDamage(...args) { calls.push(args); }}};
  const radiantSpell = {item: {type: 'spell'}, damageRolls: [{options: {type: 'radiant'}}]};

  await frammento.radiantBonus({document: frammentoItem(), workflow: radiantSpell}, deps);
  assert.deepEqual(calls[0].slice(1), ['1d6', {damageType: 'radiant'}]);

  await frammento.radiantBonus({document: frammentoItem({attuned: false}), workflow: radiantSpell}, deps);
  await frammento.radiantBonus({document: frammentoItem(), workflow: {item: {type: 'spell'}, damageRolls: [{options: {type: 'fire'}}]}}, deps);
  await frammento.radiantBonus({document: frammentoItem(), workflow: {item: {type: 'weapon'}, damageRolls: [{options: {type: 'radiant'}}]}}, deps);
  assert.equal(calls.length, 1);
});

test('every third owner turn in the same combat triggers the psychic backlash', async () => {
  assert.deepEqual(frammento.nextTurnCount(undefined, 'c1'), {combatId: 'c1', count: 1, backlash: false});
  assert.deepEqual(frammento.nextTurnCount({combatId: 'c1', count: 2}, 'c1'), {combatId: 'c1', count: 0, backlash: true});
  assert.deepEqual(frammento.nextTurnCount({combatId: 'old', count: 2}, 'c1'), {combatId: 'c1', count: 1, backlash: false});

  const hits = [];
  const item = frammentoItem({flag: {combatId: 'c1', count: 2}});
  await frammento.turnBacklash({document: item, combatant: {parent: {id: 'c1'}}}, {rollBacklash: async () => hits.push('hit')});
  assert.deepEqual(hits, ['hit']);
  assert.deepEqual(item.flags.get('frammentoTurns'), {combatId: 'c1', count: 0});
});

test('the backlash on losing attunement starts only after the first attunement', async () => {
  const hits = [];
  const deps = {rollBacklash: async () => hits.push('hit')};
  const item = frammentoItem({attuned: false});

  assert.equal(await frammento.unattuneBacklash(item, {system: {attuned: false}}, deps), false);
  assert.equal(hits.length, 0);

  await frammento.unattuneBacklash(item, {system: {attuned: true}}, deps);
  assert.equal(item.flags.get('frammentoAwakened'), true);
  assert.equal(await frammento.unattuneBacklash(item, {system: {equipped: false}}, deps), false);
  assert.equal(await frammento.unattuneBacklash(item, {system: {attuned: false}}, deps), true);
  assert.equal(await frammento.unattuneBacklash({system: {identifier: 'other'}, actor: {}}, {system: {attuned: false}}, deps), false);
  assert.equal(hits.length, 1);
});

test('the Piuma grants advantage against evil targets while its turn effect is active', async () => {
  const effects = new Map();
  const calls = [];
  const deps = {
    actorUtils: {getEffectByIdentifier: (_actor, id) => effects.get(id)},
    documentUtils: {
      getBaseEffectData(_item, data) { return {...data}; },
      async deleteDocument(document) { calls.push(['delete', document]); }
    },
    effectUtils: {async createEffects(_actor, [data]) { effects.set('piumaReginaCorvo', data); calls.push(['create', data]); return [data]; }}
  };
  const item = {name: 'Piuma', uuid: 'Item.piuma', img: 'piuma.webp', actor: {}};

  await piuma.activateFeather({document: item, workflow: {actor: {}, activity: {identifier: 'piumaReginaCorvo'}}}, deps);
  assert.deepEqual(calls[0][1].flags.dae.specialDuration, ['turnEnd']);

  const evil = {actor: {system: {details: {alignment: 'Caotico Malvagio'}}}};
  const good = {actor: {system: {details: {alignment: 'Lawful Good'}}}};
  const first = tracker();
  await piuma.featherAdvantage({document: item, workflow: {actor: {}, targets: new Set([evil]), tracker: first.tracker}}, deps);
  assert.equal(first.added.length, 1);
  const second = tracker();
  await piuma.featherAdvantage({document: item, workflow: {actor: {}, targets: new Set([good]), tracker: second.tracker}}, deps);
  assert.equal(second.added.length, 0);

  await piuma.endFeather({document: item}, deps);
  assert.ok(calls.some(([type]) => type === 'delete'));
});

test('alignment detection understands English and Italian evil alignments', () => {
  assert.equal(piuma.isEvil({system: {details: {alignment: 'neutral evil'}}}), true);
  assert.equal(piuma.isEvil({system: {details: {alignment: 'Legale Malvagio'}}}), true);
  assert.equal(piuma.isEvil({system: {details: {alignment: 'Neutrale Buono'}}}), false);
});
