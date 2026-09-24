import assert from 'node:assert/strict';
import test from 'node:test';

import * as va from '../scripts/species/vengeful-assault.mjs';

function weapon(id, {equipped = true, attackType = 'melee', range = {reach: 5}} = {}) {
  return {
    id, uuid: `Item.${id}`, name: id, type: 'weapon',
    system: {equipped, activities: new Map([['attack', {type: 'attack', attack: {type: {value: attackType}}, range}]])}
  };
}

function context({spent = 0, reactionUsed = false, hp = 50, damage = 8, distance = 5, weapons, answer = 'first'} = {}) {
  const calls = [];
  const actor = {uuid: 'Actor.korax', name: 'Korax', system: {attributes: {hp: {value: hp}}}, statuses: new Set(), items: weapons ?? [weapon('greatsword')]};
  const item = {
    name: 'Vengeful Assault', actor,
    system: {uses: {max: 1, spent}},
    async update(data) { calls.push(['update', data]); }
  };
  const attacker = {uuid: 'Token.goblin', actor: {uuid: 'Actor.goblin'}};
  const defender = {uuid: 'Token.korax', actor};
  const workflow = {token: {document: attacker}, damageList: [{actorUuid: actor.uuid, hpDamage: damage, tempDamage: 0}]};
  const deps = {
    hasUsedReaction: () => reactionUsed,
    async setReactionUsed(target) { calls.push(['reaction', target]); },
    async requestReaction(request) {
      calls.push(['request', request]);
      return answer === 'first' ? request.choices[0].value : answer;
    },
    async rollItem(rolled, targets) { calls.push(['attack', rolled, targets]); },
    tokenDistance: () => distance
  };
  return {actor, attacker, calls, defender, deps, item, workflow};
}

test('taking damage from a creature in weapon reach requests the reaction and attacks back', async () => {
  const {actor, attacker, calls, defender, deps, item, workflow} = context();

  await va.vengefulAssault({document: item, workflow, sourceToken: defender}, deps);

  const request = calls.find(([type]) => type === 'request')[1];
  assert.equal(request.reactionId, 'vengefulAssault');
  assert.equal(request.actor, actor);
  const attack = calls.find(([type]) => type === 'attack');
  assert.equal(attack[1].id, 'greatsword');
  assert.deepEqual(attack[2], [attacker]);
  assert.ok(calls.some(([type, target]) => type === 'reaction' && target === actor));
  assert.deepEqual(calls.find(([type]) => type === 'update')[1], {'system.uses.spent': 1});
});

test('no request without damage, uses, reaction, consciousness, or a weapon in reach', async () => {
  for (const options of [{damage: 0}, {spent: 1}, {reactionUsed: true}, {hp: 0}, {distance: 10}]) {
    const {calls, defender, deps, item, workflow} = context(options);
    await va.vengefulAssault({document: item, workflow, sourceToken: defender}, deps);
    assert.equal(calls.length, 0, JSON.stringify(options));
  }
});

test('a declined or timed out request spends nothing', async () => {
  const {calls, defender, deps, item, workflow} = context({answer: null});
  await va.vengefulAssault({document: item, workflow, sourceToken: defender}, deps);
  assert.deepEqual(calls.map(([type]) => type), ['request']);
});

test('ranged and reach weapons extend the reaction distance', () => {
  assert.equal(va.weaponReach(weapon('glaive', {range: {reach: 10}})), 10);
  assert.equal(va.weaponReach(weapon('bow', {attackType: 'ranged', range: {value: 150, long: 600}})), 600);
  assert.equal(va.weaponReach(weapon('sword', {range: {}})), 5);
});

test('every weapon in reach is offered as a choice', async () => {
  const {calls, defender, deps, item, workflow} = context({weapons: [weapon('greatsword'), weapon('dagger')]});
  await va.vengefulAssault({document: item, workflow, sourceToken: defender}, deps);
  assert.deepEqual(calls.find(([type]) => type === 'request')[1].choices.map(choice => choice.value), ['Item.greatsword', 'Item.dagger']);
});

test('Vengeful Assault listens on the target side after the roll', () => {
  assert.deepEqual(va.vengefulAssaultAutomation.roll.map(({pass}) => pass), ['targetRollFinished']);
});
