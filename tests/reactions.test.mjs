import assert from 'node:assert/strict';
import test from 'node:test';

import * as config from '../scripts/reactions/config.mjs';
import {parseReactionsForm} from '../scripts/reactions/menu.mjs';
import * as engine from '../scripts/reactions/movement-engine.mjs';
import {requestReaction} from '../scripts/reactions/prompt.mjs';

// ---------- configuration ----------

test('reaction settings fill defaults and clamp or reject invalid values', () => {
  assert.deepEqual(config.normalizeReaction({}), {...config.DEFAULT_REACTION});
  assert.deepEqual(
    config.normalizeReaction({enabled: false, timeout: 999, onTimeout: 'gm', npcMode: 'nope', audience: 'gm'}),
    {enabled: false, timeout: 120, onTimeout: 'gm', npcMode: 'ask', audience: 'gm'}
  );
  assert.equal(config.normalizeReaction({timeout: 1}).timeout, 5);
  const settings = {get: () => ({opportunityAttack: {timeout: 30}})};
  assert.equal(config.getReactionConfig('opportunityAttack', settings).timeout, 30);
  assert.equal(config.getReactionConfig('sentinel', settings).timeout, 15);
});

test('the reactions panel form keeps unchecked boxes as disabled', () => {
  const {reactions, general} = parseReactionsForm({
    'opportunityAttack.enabled': true, 'opportunityAttack.timeout': '20', 'opportunityAttack.onTimeout': 'accept',
    'opportunityAttack.npcMode': 'auto', 'opportunityAttack.audience': 'ownerAndGm',
    'general.combatOnly': true
  });
  assert.deepEqual(reactions.opportunityAttack, {enabled: true, timeout: 20, onTimeout: 'accept', npcMode: 'auto', audience: 'ownerAndGm'});
  assert.equal(reactions.sentinel.enabled, false);
  assert.deepEqual(general, {combatOnly: true, chatSummary: false});
});

// ---------- prompt service ----------

function promptDeps({reaction = {}, answers = {}, owner = {id: 'player'}, gm = {id: 'gm'}} = {}) {
  const asked = [];
  const users = {player: owner, gm};
  for (const user of Object.values(users)) {
    if (!user) continue;
    user.query = async () => {
      asked.push(user.id);
      const answer = answers[user.id];
      return answer === undefined ? {choice: null, timedOut: true} : {choice: answer, timedOut: false};
    };
  }
  return {
    asked,
    deps: {
      config: () => config.normalizeReaction(reaction),
      currentUserId: () => 'server',
      gm: () => gm,
      owner: () => owner,
      showDialog: async () => ({choice: null, timedOut: true}),
      randomId: () => 'req'
    }
  };
}

const choices = [{value: 'sword', label: 'Sword'}, {value: 'axe', label: 'Axe'}];
const pc = {hasPlayerOwner: true};
const npc = {hasPlayerOwner: false};

test('a player answer is returned and a decline returns nothing', async () => {
  const yes = promptDeps({answers: {player: 'axe'}});
  assert.equal(await requestReaction({reactionId: 'opportunityAttack', actor: pc, choices}, yes.deps), 'axe');
  const no = promptDeps({answers: {player: null}});
  assert.equal(await requestReaction({reactionId: 'opportunityAttack', actor: pc, choices}, no.deps), null);
});

test('when time runs out the configured fallback applies', async () => {
  const decline = promptDeps();
  assert.equal(await requestReaction({reactionId: 'x', actor: pc, choices}, decline.deps), null);

  const accept = promptDeps({reaction: {onTimeout: 'accept'}});
  assert.equal(await requestReaction({reactionId: 'x', actor: pc, choices}, accept.deps), 'sword');

  const forward = promptDeps({reaction: {onTimeout: 'gm'}, answers: {gm: 'axe'}});
  assert.equal(await requestReaction({reactionId: 'x', actor: pc, choices}, forward.deps), 'axe');
  assert.deepEqual(forward.asked, ['player', 'gm']);
});

test('an offline player counts as a timeout', async () => {
  const offline = promptDeps({owner: undefined, reaction: {onTimeout: 'accept'}});
  assert.equal(await requestReaction({reactionId: 'x', actor: pc, choices}, offline.deps), 'sword');
});

test('NPC reactions ask the GM, act automatically, or stay off', async () => {
  const ask = promptDeps({answers: {gm: 'axe'}});
  assert.equal(await requestReaction({reactionId: 'x', actor: npc, choices}, ask.deps), 'axe');
  assert.deepEqual(ask.asked, ['gm']);
  const auto = promptDeps({reaction: {npcMode: 'auto'}});
  assert.equal(await requestReaction({reactionId: 'x', actor: npc, choices}, auto.deps), 'sword');
  const off = promptDeps({reaction: {npcMode: 'off'}});
  assert.equal(await requestReaction({reactionId: 'x', actor: npc, choices}, off.deps), null);
});

test('disabled reactions never prompt', async () => {
  const disabled = promptDeps({reaction: {enabled: false}, answers: {player: 'sword'}});
  assert.equal(await requestReaction({reactionId: 'x', actor: pc, choices}, disabled.deps), null);
  assert.deepEqual(disabled.asked, []);
});

// ---------- movement engine helpers ----------

const grid = {size: 100, distance: 5};
const at = (x, y, elevation = 0) => ({x: x * 100, y: y * 100, elevation, width: 1, height: 1});

test('footprint distance counts adjacency as 5 feet and adds height gaps', () => {
  assert.equal(engine.footprintDistance(at(0, 0), at(1, 0), grid), 5);
  assert.equal(engine.footprintDistance(at(0, 0), at(1, 1), grid), 5);
  assert.equal(engine.footprintDistance(at(0, 0), at(2, 0), grid), 10);
  assert.equal(engine.footprintDistance(at(0, 0), at(1, 0, 15), grid), 15);
});

test('reach events detect leaving, passing through and entering reach', () => {
  assert.deepEqual(engine.reachEvent([5, 10], 5), {type: 'leave'});
  assert.deepEqual(engine.reachEvent([10, 5, 10], 5), {type: 'leave'});
  assert.deepEqual(engine.reachEvent([15, 5], 5), {type: 'enter'});
  assert.equal(engine.reachEvent([5, 5], 5), null);
  assert.equal(engine.reachEvent([15, 20], 10), null);
  assert.deepEqual(engine.reachEvent([10, 15], 10), {type: 'leave'});
});

test('dispositions, disengage and teleports are recognised', () => {
  assert.equal(engine.isHostilePair({disposition: 1}, {disposition: -1}), true);
  assert.equal(engine.isHostilePair({disposition: 1}, {disposition: 1}), false);
  assert.equal(engine.isHostilePair({disposition: 0}, {disposition: -1}), false);
  assert.equal(engine.hasDisengaged({statuses: new Set(), effects: [{name: 'Disengage'}]}), true);
  assert.equal(engine.isForcedOrTeleport({passed: {waypoints: [{action: 'blink'}]}}), true);
  assert.equal(engine.isForcedOrTeleport({passed: {waypoints: [{action: 'walk'}]}}, {forced: true}), true);
});

// ---------- movement engine ----------

function weapon(name, {reach = 5, baseItem = 'longsword'} = {}) {
  return {
    uuid: `Item.${name}`, name, type: 'weapon',
    system: {equipped: true, type: {baseItem}, activities: new Map([['a', {type: 'attack', attack: {type: {value: 'melee'}}, range: {reach}}]])}
  };
}

function scenario({features = [], disengaged = false, answer = 'first', hit = false, moverPath, extraReactors = []} = {}) {
  const calls = [];
  const ashActor = {uuid: 'Actor.ash', name: 'Ash', statuses: new Set(), items: [weapon('Maul'), ...features]};
  const ash = {id: 'ash', actor: ashActor, disposition: 1, x: 0, y: 0, width: 1, height: 1, elevation: 0, getFlag: () => undefined};
  const goblinActor = {uuid: 'Actor.goblin', name: 'Goblin', statuses: new Set(disengaged ? ['disengaged'] : []), items: []};
  const scene = {grid, tokens: []};
  const mover = {
    id: 'goblin', uuid: 'Token.goblin', name: 'Goblin', actor: goblinActor, disposition: -1, width: 1, height: 1,
    inCombat: true, parent: scene, getFlag: () => undefined,
    async move(waypoints) { calls.push(['move', waypoints]); }
  };
  scene.tokens.push(ash, mover, ...extraReactors);
  const [origin, ...rest] = moverPath ?? [at(1, 0), at(3, 0)];
  const movement = {origin, passed: {waypoints: rest.map(point => ({...point, action: 'walk'}))}};
  const deps = {
    attackFromEcho: async args => { calls.push(['echo', args]); return {hitTargets: new Set(hit ? [mover] : [])}; },
    canSee: () => true,
    chat: async text => calls.push(['chat', text]),
    fromUuidSync: uuid => (uuid === ashActor.uuid ? ashActor : undefined),
    general: () => ({combatOnly: true, chatSummary: false}),
    hasUsedReaction: () => false,
    isResponsibleGM: () => true,
    reactionConfig: () => config.normalizeReaction({}),
    requestReaction: async request => {
      calls.push(['request', request]);
      return answer === 'first' ? request.choices[0].value : answer;
    },
    rollItem: async (item, targets, options) => { calls.push(['roll', item, targets, options]); return {hitTargets: new Set(hit ? [mover] : [])}; },
    setReactionUsed: async actor => calls.push(['reaction', actor]),
    withReactionReach: async (actor, roll) => { calls.push(['grace', actor]); return roll(); },
    publicName: token => token.name,
    applySentinel: async (target, stopAt) => calls.push(['sentinel', target, stopAt])
  };
  return {ash, ashActor, calls, deps, mover, movement};
}

test('leaving reach asks for an opportunity attack and rolls the chosen weapon', async () => {
  const {ashActor, calls, deps, mover, movement} = scenario();
  const results = await engine.resolveMovementReactions({mover, movement}, deps);
  assert.equal(results.length, 1);
  const request = calls.find(([type]) => type === 'request')[1];
  assert.equal(request.reactionId, 'opportunityAttack');
  assert.deepEqual(request.choices.map(choice => choice.label), ['Maul']);
  assert.ok(calls.some(([type, item, targets, options]) => type === 'roll' && item.name === 'Maul' && targets[0] === mover && options.asReaction));
  assert.ok(calls.some(([type, actor]) => type === 'reaction' && actor === ashActor));
});

test('Disengage prevents the attack unless the reactor has Sentinel', async () => {
  const plain = scenario({disengaged: true});
  assert.deepEqual(await engine.resolveMovementReactions({mover: plain.mover, movement: plain.movement}, plain.deps), []);

  const sentinel = scenario({disengaged: true, features: [{name: 'Sentinel', system: {identifier: 'sentinel'}}]});
  assert.equal((await engine.resolveMovementReactions({mover: sentinel.mover, movement: sentinel.movement}, sentinel.deps)).length, 1);
});

test('a Sentinel hit stops the mover at the last point inside reach', async () => {
  const {calls, deps, mover, movement} = scenario({hit: true, features: [{name: 'Sentinel', system: {identifier: 'sentinel'}}]});
  await engine.resolveMovementReactions({mover, movement}, deps);
  const [, target, stopAt] = calls.find(([type]) => type === 'sentinel');
  assert.equal(target, mover);
  assert.deepEqual([stopAt.x, stopAt.y], [100, 0]);
});

test('a declined request spends no reaction and rolls nothing', async () => {
  const {calls, deps, mover, movement} = scenario({answer: null});
  assert.deepEqual(await engine.resolveMovementReactions({mover, movement}, deps), []);
  assert.equal(calls.some(([type]) => type === 'roll' || type === 'reaction'), false);
});

test('only the active GM runs the engine, and only in combat when configured', async () => {
  const notGM = scenario();
  notGM.deps.isResponsibleGM = () => false;
  assert.deepEqual(await engine.resolveMovementReactions({mover: notGM.mover, movement: notGM.movement}, notGM.deps), []);

  const outOfCombat = scenario();
  outOfCombat.mover.inCombat = false;
  assert.deepEqual(await engine.resolveMovementReactions({mover: outOfCombat.mover, movement: outOfCombat.movement}, outOfCombat.deps), []);
});

test('the echo reacts for its owner, sharing one reaction with the owner token', async () => {
  const echoToken = {
    id: 'echo', actor: {uuid: 'Actor.echo'}, x: 300, y: 0, width: 1, height: 1, elevation: 0,
    getFlag: (_scope, key) => (key === 'echo' ? {ownerActorUuid: 'Actor.ash'} : undefined)
  };
  const {calls, deps, mover, movement} = scenario({moverPath: [at(4, 0), at(6, 0)], extraReactors: [echoToken]});
  const results = await engine.resolveMovementReactions({mover, movement}, deps);
  assert.equal(results.length, 1);
  assert.ok(calls.some(([type, args]) => type === 'echo' && args.weapon.name === 'Maul' && args.checkRange === false && args.asReaction));
  assert.equal(calls.filter(([type]) => type === 'request').length, 1);
});

test('War Caster offers single-target action spells alongside weapons', async () => {
  const fireBolt = {
    uuid: 'Item.bolt', name: 'Toll the Dead', type: 'spell',
    system: {level: 0, activities: new Map([['a', {type: 'save', activation: {type: 'action'}, target: {affects: {type: 'creature', count: 1}}}]])}
  };
  const {calls, deps, mover, movement} = scenario({features: [{name: 'War Caster', system: {identifier: 'war-caster'}}, fireBolt]});
  await engine.resolveMovementReactions({mover, movement}, deps);
  const request = calls.find(([type]) => type === 'request')[1];
  assert.deepEqual(request.choices.map(choice => choice.value), ['weapon|Item.Maul', 'spell|Item.bolt']);
});

test('Polearm Master reacts when a creature enters polearm reach', async () => {
  const glaive = weapon('Glaive', {reach: 10, baseItem: 'glaive'});
  const {calls, deps, mover, movement} = scenario({
    moverPath: [at(5, 0), at(2, 0)],
    features: [glaive, {name: 'Polearm Master', system: {identifier: 'polearm-master'}}]
  });
  await engine.resolveMovementReactions({mover, movement}, deps);
  const request = calls.find(([type]) => type === 'request')[1];
  assert.equal(request.reactionId, 'polearmMaster');
  assert.deepEqual(request.choices.map(choice => choice.label), ['Glaive']);
});

test('the reaction engine listens to Foundry v14 moveToken', () => {
  const hooks = [];
  engine.registerMovementReactions({on: (name, fn) => { hooks.push([name, fn]); return 1; }}, {});
  assert.deepEqual(hooks.map(([name]) => name), ['moveToken']);
});

test('NPC natural attacks count even unequipped or as features, with their reach', () => {
  const bite = {type: 'feat', system: {activities: new Map([['a', {type: 'attack', attack: {type: {value: 'melee'}}, range: {reach: 10}}]])}};
  const claw = {type: 'weapon', system: {equipped: false, activities: new Map([['a', {type: 'attack', attack: {type: {value: 'melee'}}, range: {reach: 5}}]])}};
  const bow = {type: 'weapon', system: {equipped: true, activities: new Map([['a', {type: 'attack', attack: {type: {value: 'ranged'}}, range: {value: 80}}]])}};
  const monster = {type: 'npc', items: [bite, claw, bow]};
  assert.deepEqual(engine.meleeWeapons(monster), [bite, claw]);
  assert.equal(Math.max(...engine.meleeWeapons(monster).map(engine.weaponReach)), 10);

  const hero = {type: 'character', items: [claw, bite]};
  assert.deepEqual(engine.meleeWeapons(hero), []);
});

test('the reaction roll gets a temporary reach grace on the reacting actor', async () => {
  const {ashActor, calls, deps, mover, movement} = scenario();
  await engine.resolveMovementReactions({mover, movement}, deps);
  const grace = calls.findIndex(([type]) => type === 'grace');
  const roll = calls.findIndex(([type]) => type === 'roll');
  assert.equal(calls[grace][1], ashActor);
  assert.ok(grace < roll);
});

test('a failing reaction roll is logged and spends no reaction', async () => {
  const {calls, deps, mover, movement} = scenario();
  deps.rollItem = async () => { throw new Error('boom'); };
  const original = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await engine.resolveMovementReactions({mover, movement}, deps), []);
  } finally {
    console.error = original;
  }
  assert.equal(calls.some(([type]) => type === 'reaction'), false);
});
