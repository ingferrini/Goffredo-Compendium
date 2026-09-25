import assert from 'node:assert/strict';
import test from 'node:test';

import {normalizeLegendary} from '../scripts/reactions/config.mjs';
import {parseReactionsForm} from '../scripts/reactions/menu.mjs';
import * as legendary from '../scripts/legendary/legendary.mjs';

function item(id, activation, cost = 1) {
  return {id, uuid: `Item.${id}`, name: id, system: {activities: new Map([['a', {activation: {type: activation, value: cost}}]])}};
}

function actor({legact = {value: 3, max: 3, spent: 0}, legres, lair, items = [], hasPlayerOwner = false, lastLair} = {}) {
  const updates = [];
  const flags = new Map(lastLair ? [['lastLairAction', lastLair]] : []);
  return {
    uuid: 'Actor.dragon', name: 'Dragon', hasPlayerOwner, isOwner: true, updates,
    system: {resources: {legact, legres, lair}},
    items,
    async update(data) { updates.push(data); },
    getFlag: (_scope, key) => flags.get(key),
    async setFlag(_scope, key, value) { flags.set(key, value); },
    flags
  };
}

function combatant(id, initiative, act, {defeated = false} = {}) {
  return {id, initiative, actor: act, defeated};
}

function combat({combatants, turn = 0, round = 1, prompted}) {
  const calls = [];
  const flags = new Map(prompted ? [['legendaryPrompted', prompted]] : []);
  return {
    calls, round, turn, turns: combatants, combatants,
    get combatant() { return combatants[this.turn]; },
    getFlag: (_scope, key) => flags.get(key),
    async setFlag(_scope, key, value) { flags.set(key, value); },
    async nextTurn() { calls.push('nextTurn'); },
    async nextRound() { calls.push('nextRound'); }
  };
}

const enabled = () => normalizeLegendary({});

function deps(answers = [], overrides = {}) {
  const calls = [];
  const queue = [...answers];
  return {
    calls,
    deps: {
      askGM: async request => { calls.push(['ask', request]); return queue.length ? queue.shift() : request.choices[0].value; },
      chat: async text => calls.push(['chat', text]),
      config: enabled,
      gm: () => ({query: async (...args) => calls.push(['query', ...args])}),
      isGM: () => true,
      notice: text => calls.push(['notice', text]),
      pause: async paused => calls.push(['pause', paused]),
      rollItem: async (rolled, targets) => { calls.push(['roll', rolled, targets]); return {}; },
      spend: async (target, key, amount) => calls.push(['spend', key, amount]),
      targets: () => ['target'],
      ...overrides
    }
  };
}

// ---------- helpers ----------

test('legendary actions are those the remaining points can pay for', () => {
  const dragon = actor({legact: {value: 1, max: 3}, items: [item('tail', 'legendary', 1), item('wing', 'legendary', 2), item('bite', 'action')]});
  assert.deepEqual(legendary.legendaryActions(dragon).map(entry => entry.id), ['tail']);
  assert.equal(legendary.remainingLegendaryActions(actor({legact: {max: 3, spent: 1}})), 2);
});

test('lair actions happen when initiative 20 is crossed, losing ties, and not twice in a row', () => {
  const next = init => ({initiative: init});
  assert.equal(legendary.crossesLairCount({current: next(22), next: next(15), newRound: false}, 20), true);
  assert.equal(legendary.crossesLairCount({current: next(20), next: next(19), newRound: false}, 20), true);
  assert.equal(legendary.crossesLairCount({current: next(25), next: next(20), newRound: false}, 20), false);
  assert.equal(legendary.crossesLairCount({current: next(5), next: next(18), newRound: true}, 20), true);
  assert.equal(legendary.crossesLairCount({current: next(18), next: next(12), newRound: false}, 20), false);

  const lair = actor({items: [item('quake', 'lair'), item('fog', 'lair')], lastLair: {itemId: 'quake', round: 2}});
  assert.deepEqual(legendary.lairActions(lair, 3).map(entry => entry.id), ['fog']);
  assert.deepEqual(legendary.lairActions(lair, 4).map(entry => entry.id), ['quake', 'fog']);
});

test('legendary candidates exclude the creature whose turn is ending and the defeated', () => {
  const dragon = actor({items: [item('tail', 'legendary')]});
  const fight = combat({combatants: [combatant('ash', 18, actor({legact: {value: 0}})), combatant('dragon', 12, dragon), combatant('dead', 5, dragon, {defeated: true})]});
  assert.deepEqual(legendary.legendaryCandidates(fight).map(entry => entry.id), ['dragon']);
  fight.turn = 1;
  assert.deepEqual(legendary.legendaryCandidates(fight).map(entry => entry.id), []);
});

// ---------- turn holding ----------

test('advancing the turn is held when a legendary action is possible, once per turn', () => {
  const dragon = actor({items: [item('tail', 'legendary')]});
  const combatants = [combatant('ash', 18, actor({legact: {}})), combatant('dragon', 12, dragon)];
  const {deps: d} = deps();
  assert.equal(legendary.shouldHoldTurn(combat({combatants}), {turn: 1}, {direction: 1}, d), true);
  assert.equal(legendary.shouldHoldTurn(combat({combatants}), {turn: 1}, {direction: -1}, d), false);
  assert.equal(legendary.shouldHoldTurn(combat({combatants, prompted: {round: 1, turn: 0}}), {turn: 1}, {direction: 1}, d), false);
  const off = deps([], {config: () => normalizeLegendary({enabled: false})});
  assert.equal(legendary.shouldHoldTurn(combat({combatants}), {turn: 1}, {direction: 1}, off.deps), false);
});

test('the GM flow pauses, warns the players, runs the chosen action and resumes the turn', async () => {
  const tail = item('tail', 'legendary');
  const dragon = actor({legact: {value: 3, max: 3, spent: 0}, items: [tail]});
  const fight = combat({combatants: [combatant('ash', 18, actor({legact: {}})), combatant('dragon', 12, dragon)]});
  const {calls, deps: d} = deps();

  await legendary.runBetweenTurns(fight, {turn: 1}, d);

  assert.deepEqual(calls.filter(([type]) => type === 'pause').map(([, paused]) => paused), [true, false]);
  assert.equal(calls.find(([type]) => type === 'notice')[1], 'GAC.Legendary.PlayerNotice');
  const roll = calls.find(([type]) => type === 'roll');
  assert.equal(roll[1], tail);
  assert.deepEqual(roll[2], ['target']);
  // dnd5e did not spend the point in this mock, so the module does.
  assert.deepEqual(calls.find(([type]) => type === 'spend').slice(1), ['legact', 1]);
  assert.deepEqual(fight.calls, ['nextTurn']);
  assert.deepEqual(fight.getFlag('x', 'legendaryPrompted'), {round: 1, turn: 0});
});

test('skipping the legendary action still resumes the turn', async () => {
  const dragon = actor({items: [item('tail', 'legendary')]});
  const fight = combat({combatants: [combatant('ash', 18, actor({legact: {}})), combatant('dragon', 12, dragon)]});
  const {calls, deps: d} = deps([null]);
  await legendary.runBetweenTurns(fight, {turn: 1}, d);
  assert.equal(calls.some(([type]) => type === 'roll'), false);
  assert.deepEqual(fight.calls, ['nextTurn']);
});

test('a lair action is offered at initiative 20 and remembered for the next round', async () => {
  const quake = item('quake', 'lair');
  const lairLord = actor({legact: {value: 0}, lair: {value: true, initiative: 20}, items: [quake]});
  const fight = combat({combatants: [combatant('ash', 22, actor({legact: {}})), combatant('lord', 12, lairLord)]});
  const {calls, deps: d} = deps();
  await legendary.runBetweenTurns(fight, {turn: 1}, d);
  assert.equal(calls.find(([type]) => type === 'notice')[1], 'GAC.Legendary.PlayerNoticeLair');
  assert.equal(calls.find(([type]) => type === 'roll')[1], quake);
  assert.deepEqual(lairLord.flags.get('lastLairAction'), {itemId: 'quake', round: 1});
});

test('a player advancing the turn hands the decision to the GM', () => {
  const hooks = new Map();
  const dragon = actor({items: [item('tail', 'legendary')]});
  const fight = combat({combatants: [combatant('ash', 18, actor({legact: {}})), combatant('dragon', 12, dragon)]});
  fight.id = 'c1';
  const {calls, deps: d} = deps([], {isGM: () => false});
  const queries = {};
  legendary.registerLegendaryTurns({on: (name, fn) => hooks.set(name, fn)}, queries, d);
  assert.equal(hooks.get('preUpdateCombat')(fight, {turn: 1}, {direction: 1}), false);
  assert.deepEqual(calls.find(([type]) => type === 'query').slice(1, 3), ['goffredo-compendium.betweenTurns', {combatId: 'c1', changes: {turn: 1}}]);
  assert.equal(typeof queries['goffredo-compendium.spendResource'], 'function');
});

// ---------- Legendary Resistance ----------

test('Legendary Resistance turns a failed save into a success and spends one use', async () => {
  const dragon = actor({legres: {value: 2, max: 3, spent: 1}});
  const token = {actor: dragon, name: 'Dragon', displayName: 50};
  const other = {actor: actor({legres: {value: 0}}), name: 'Kobold'};
  const workflow = {item: {name: 'Hold Monster'}, failedSaves: new Set([token, other]), saves: new Set()};
  const {calls, deps: d} = deps(['use']);

  const used = await legendary.offerLegendaryResistance(workflow, d);

  assert.deepEqual(used, ['Actor.dragon']);
  assert.deepEqual([...workflow.failedSaves], [other]);
  assert.deepEqual([...workflow.saves], [token]);
  assert.deepEqual(calls.find(([type]) => type === 'spend').slice(1), ['legres', 1]);
});

test('Legendary Resistance is not offered to player characters or when declined', async () => {
  const hero = {actor: actor({legres: {value: 3}, hasPlayerOwner: true})};
  const monster = {actor: actor({legres: {value: 3}})};
  const workflow = {failedSaves: new Set([hero, monster]), saves: new Set()};
  const {calls, deps: d} = deps([null]);
  assert.deepEqual(await legendary.offerLegendaryResistance(workflow, d), []);
  assert.equal(calls.filter(([type]) => type === 'ask').length, 1);
  assert.equal(workflow.failedSaves.size, 2);
});

test('the panel saves the legendary section, with 0 meaning no time limit', () => {
  const {legendary: saved} = parseReactionsForm({
    'legendaryActions.enabled': true, 'legendaryActions.timeout': '0', 'legendaryActions.pause': true, 'legendaryActions.onTimeout': 'decline',
    'legendaryResistance.enabled': true, 'legendaryResistance.timeout': '30', 'legendaryResistance.onTimeout': 'accept'
  });
  assert.deepEqual(saved.legendaryActions, {enabled: true, timeout: 0, pause: true, onTimeout: 'decline'});
  assert.equal(saved.lairActions.enabled, false);
  assert.deepEqual(saved.legendaryResistance, {enabled: true, timeout: 30, pause: false, onTimeout: 'accept'});
});

test('spending never goes past the maximum', async () => {
  const dragon = actor({legact: {value: 0, max: 3, spent: 3}});
  await legendary.spendResource(dragon, 'legact', 2);
  assert.deepEqual(dragon.updates, [{'system.resources.legact.spent': 3}]);
  const fresh = actor({legres: {value: 3, max: 3, spent: 0}});
  await legendary.spendResource(fresh, 'legres', 1);
  assert.deepEqual(fresh.updates, [{'system.resources.legres.spent': 1}]);
  assert.equal(await legendary.spendResource(fresh, 'hp', 1), false);
});
