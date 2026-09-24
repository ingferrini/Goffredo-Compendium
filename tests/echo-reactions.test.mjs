import assert from 'node:assert/strict';
import test from 'node:test';

import * as reactions from '../scripts/echo-knight/opportunity-attack.mjs';

function context({start = 5, end = 10, reactionUsed = false, visible = true, hostile = true, confirm = true, attack = true} = {}) {
  const calls = [];
  const ownerToken = {id: 'owner-token', uuid: 'Scene.scene.Token.owner', parent: {id: 'scene'}};
  const owner = {
    id: 'owner',
    uuid: 'Actor.owner',
    getActiveTokens() { return [{document: ownerToken}]; },
    getFlag() { return {itemUuid: 'Actor.owner.Item.echo'}; }
  };
  ownerToken.actor = owner;
  const echo = {
    id: 'echo',
    uuid: 'Scene.scene.Token.echo',
    parent: {id: 'scene'},
    getFlag() { return {ownerActorUuid: owner.uuid}; }
  };
  const enemy = {
    id: 'enemy',
    uuid: 'Scene.scene.Token.enemy',
    parent: {id: 'scene', tokens: [echo]},
    actor: {uuid: 'Actor.enemy'}
  };
  echo.parent = enemy.parent;
  const feature = {uuid: 'Actor.owner.Item.echo', name: 'Manifest Echo'};
  let phase = 'start';
  const deps = {
    actorUtils: {
      hasUsedReaction() { return reactionUsed; },
      async setReactionUsed(actor) { calls.push(['reaction', actor]); }
    },
    attackFromEcho: async data => {
      calls.push(['attack', data]);
      return attack ? {id: 'attack'} : undefined;
    },
    currentUserId: 'player',
    dialogUtils: {
      async confirm(...args) { calls.push(['confirm', ...args]); return confirm; }
    },
    fromUuid: async uuid => uuid === owner.uuid ? owner : uuid === feature.uuid ? feature : undefined,
    queryUtils: {firstOwner() { return 'player'; }},
    tokenUtils: {
      canSee() { return visible; },
      getDistance() { return phase === 'start' ? start : end; },
      isEnemy() { return hostile; }
    }
  };
  const movement = {
    id: 'move-1',
    origin: {x: 0, y: 0, elevation: 0},
    destination: {x: 0, y: 200, elevation: 0},
    passed: {distance: 10, waypoints: [{action: 'walk'}, {action: 'walk'}]}
  };
  return {
    calls,
    deps,
    echo,
    enemy,
    movement,
    owner,
    ownerToken,
    setEnd() { phase = 'end'; }
  };
}

test('hostile voluntary movement leaving five-foot echo reach offers one opportunity attack', async () => {
  const ctx = context();
  const controller = reactions.createOpportunityController(ctx.deps);

  controller.preMoveToken(ctx.enemy, ctx.movement, {});
  ctx.setEnd();
  await controller.moveToken(ctx.enemy, ctx.movement, {}, {id: 'player'});

  assert.equal(ctx.calls.filter(([type]) => type === 'confirm').length, 1);
  const attack = ctx.calls.find(([type]) => type === 'attack')[1];
  assert.deepEqual([...attack.workflow.targets], [ctx.enemy]);
  assert.equal(ctx.calls.filter(([type]) => type === 'reaction').length, 1);
});

test('forced or teleport movement never offers the reaction', async () => {
  for (const [operation, action] of [[{forced: true}, 'walk'], [{}, 'displace']]) {
    const ctx = context();
    ctx.movement.passed.waypoints[1].action = action;
    const controller = reactions.createOpportunityController(ctx.deps);

    controller.preMoveToken(ctx.enemy, ctx.movement, operation);
    ctx.setEnd();
    await controller.moveToken(ctx.enemy, ctx.movement, operation, {id: 'player'});

    assert.equal(ctx.calls.length, 0);
  }
});

test('visibility, hostility, available reaction, and actual reach crossing are all required', async () => {
  const cases = [
    {visible: false},
    {hostile: false},
    {reactionUsed: true},
    {start: 10},
    {end: 5}
  ];
  for (const options of cases) {
    const ctx = context(options);
    const controller = reactions.createOpportunityController(ctx.deps);
    controller.preMoveToken(ctx.enemy, ctx.movement, {});
    ctx.setEnd();
    await controller.moveToken(ctx.enemy, ctx.movement, {}, {id: 'player'});
    assert.equal(ctx.calls.some(([type]) => type === 'attack'), false, JSON.stringify(options));
  }
});

test('declining or cancelling the weapon attack does not consume the reaction', async () => {
  for (const options of [{confirm: false}, {attack: false}]) {
    const ctx = context(options);
    const controller = reactions.createOpportunityController(ctx.deps);
    controller.preMoveToken(ctx.enemy, ctx.movement, {});
    ctx.setEnd();
    await controller.moveToken(ctx.enemy, ctx.movement, {}, {id: 'player'});
    assert.equal(ctx.calls.some(([type]) => type === 'reaction'), false);
  }
});

test('opportunity integration registers pre- and post-movement hooks', () => {
  const calls = [];
  const hooks = {on(...args) { calls.push(args); return calls.length; }};

  const ids = reactions.registerOpportunityHooks(hooks, {});

  assert.deepEqual(ids, [1, 2]);
  assert.deepEqual(calls.map(([name]) => name), ['preMoveToken', 'moveToken']);
});
