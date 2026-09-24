import assert from 'node:assert/strict';
import test from 'node:test';

import {normalizeReaction} from '../scripts/reactions/config.mjs';
import * as attacks from '../scripts/reactions/attack-reactions.mjs';

const grid = {size: 100, distance: 5};
const sentinelFeat = {name: 'Sentinel', system: {identifier: 'sentinel'}};

function weapon(name) {
  return {uuid: `Item.${name}`, name, type: 'weapon', system: {equipped: true, activities: new Map([['a', {type: 'attack', attack: {type: {value: 'melee'}}, range: {reach: 5}}]])}};
}

function token(id, {x, y = 0, disposition, items = [], echo = false}) {
  return {
    id, uuid: `Token.${id}`, name: id, x: x * 100, y: y * 100, width: 1, height: 1, elevation: 0, disposition, inCombat: true,
    actor: {uuid: `Actor.${id}`, name: id, type: disposition === 1 ? 'character' : 'npc', statuses: new Set(), items},
    getFlag: (_scope, key) => (echo && key === 'echo' ? {ownerActorUuid: 'Actor.ash'} : undefined)
  };
}

function setup({ashX = 1, targetHasSentinel = false, answer = 'first', used = false, targetIsAsh = false, attackRoll = {}} = {}) {
  const calls = [];
  const scene = {grid, tokens: []};
  const ash = token('ash', {x: ashX, disposition: 1, items: [sentinelFeat, weapon('Maul')]});
  const korax = token('korax', {x: 0, y: 1, disposition: 1, items: targetHasSentinel ? [sentinelFeat] : []});
  const goblin = token('goblin', {x: 0, disposition: -1});
  for (const entry of [ash, korax, goblin]) entry.parent = scene;
  scene.tokens.push(ash, korax, goblin);
  const workflow = {attackRoll, token: {document: goblin}, targets: new Set([targetIsAsh ? ash : korax])};
  const deps = {
    chat: async text => calls.push(['chat', text]),
    general: () => ({combatOnly: true, chatSummary: false}),
    hasUsedReaction: () => used,
    markReactionUsed: async actor => calls.push(['reaction', actor]),
    publicName: entry => entry.name,
    reactionConfig: () => normalizeReaction({}),
    requestReaction: async request => {
      calls.push(['request', request]);
      return answer === 'first' ? request.choices[0].value : answer;
    },
    rollItem: async (item, targets, options) => { calls.push(['roll', item, targets, options]); return {}; }
  };
  return {ash, calls, deps, goblin, workflow};
}

test('an attack on another creature next to Ash offers the Sentinel attack against the attacker', async () => {
  const {ash, calls, deps, goblin, workflow} = setup();
  const results = await attacks.resolveAttackReactions(workflow, deps);
  assert.equal(results.length, 1);
  assert.equal(calls.find(([type]) => type === 'request')[1].reactionId, 'sentinelAttack');
  const [, item, targets, options] = calls.find(([type]) => type === 'roll');
  assert.equal(item.name, 'Maul');
  assert.deepEqual(targets, [goblin]);
  assert.deepEqual(options, {asReaction: true});
  assert.ok(calls.some(([type, actor]) => type === 'reaction' && actor === ash.actor));
});

test('no Sentinel attack when the attack targets Ash, a Sentinel holder, or comes from beyond 5 feet', async () => {
  for (const options of [{targetIsAsh: true}, {targetHasSentinel: true}, {ashX: 3}]) {
    const {calls, deps, workflow} = setup(options);
    assert.deepEqual(await attacks.resolveAttackReactions(workflow, deps), [], JSON.stringify(options));
    assert.equal(calls.length, 0, JSON.stringify(options));
  }
});

test('no Sentinel attack without an attack roll, with the reaction used, or when declined', async () => {
  const noAttack = setup({attackRoll: null});
  assert.deepEqual(await attacks.resolveAttackReactions(noAttack.workflow, noAttack.deps), []);
  const used = setup({used: true});
  assert.deepEqual(await attacks.resolveAttackReactions(used.workflow, used.deps), []);
  const declined = setup({answer: null});
  assert.deepEqual(await attacks.resolveAttackReactions(declined.workflow, declined.deps), []);
  assert.equal(declined.calls.some(([type]) => type === 'roll'), false);
});

test('an attack made as a reaction also triggers Sentinel', async () => {
  // Midi completes reaction rolls like any other workflow: only the attack roll matters.
  const {deps, workflow} = setup({attackRoll: {total: 17}});
  workflow.workflowOptions = {notReaction: true};
  assert.equal((await attacks.resolveAttackReactions(workflow, deps)).length, 1);
});

test('the echo is never a Sentinel reactor', () => {
  const scene = {grid, tokens: []};
  const echo = token('echo', {x: 1, disposition: 1, items: [sentinelFeat], echo: true});
  const goblin = token('goblin', {x: 0, disposition: -1});
  const korax = token('korax', {x: 0, y: 1, disposition: 1});
  scene.tokens.push(echo, goblin, korax);
  assert.deepEqual(attacks.sentinelCandidates({attacker: goblin, targets: [korax], scene}), []);
});

test('attack reactions listen to midi-qol.RollComplete', () => {
  const hooks = [];
  attacks.registerAttackReactions({on: name => { hooks.push(name); return 1; }}, {});
  assert.deepEqual(hooks, ['midi-qol.RollComplete']);
});

test('5 feet are measured from Ash, never from the echo', async () => {
  // Ash is 15 ft away; his echo stands right next to the attacker.
  const {calls, deps, goblin, workflow, ash} = setup({ashX: 3});
  const echo = token('echo', {x: 1, disposition: 1, echo: true});
  echo.parent = goblin.parent;
  goblin.parent.tokens.push(echo);
  assert.deepEqual(await attacks.resolveAttackReactions(workflow, deps), []);
  assert.equal(calls.length, 0);
  assert.equal(ash.x, 300);
});
