import assert from 'node:assert/strict';
import test from 'node:test';

import * as movement from '../scripts/echo-knight/movement.mjs';

function context({round = 2, turn = 1, activeOwner = true, spent = 0} = {}) {
  const flags = new Map();
  const owner = {id: 'owner', uuid: 'Actor.owner', name: 'Ash'};
  const other = {id: 'other', uuid: 'Actor.other', name: 'Other'};
  const combat = {
    id: 'combat',
    round,
    turn,
    combatant: {actor: activeOwner ? owner : other}
  };
  const token = {
    id: 'echo',
    uuid: 'Scene.scene.Token.echo',
    x: 0,
    y: 0,
    elevation: 0,
    actor: {uuid: 'Actor.echo'},
    parent: {id: 'scene', grid: {size: 100, distance: 5}},
    getFlag(_scope, key) { return flags.get(key); },
    async setFlag(_scope, key, value) { flags.set(key, value); }
  };
  flags.set('echo', {ownerActorUuid: owner.uuid});
  if (spent) flags.set('echoMovement', {schema: 1, combatId: combat.id, round, turn, spent});
  return {combat, flags, other, owner, token};
}

function move({origin = {x: 0, y: 0, elevation: 0}, destination, action = 'fly'} = {}) {
  destination ??= {x: 0, y: 200, elevation: 0};
  return {
    id: 'move-1',
    origin,
    destination,
    animation: {ended: Promise.resolve()},
    passed: {
      waypoints: [
        {...origin, action, cost: 0},
        {...destination, action, cost: 0}
      ]
    }
  };
}

function dependencies(ctx, {elevation = 25, currentUserId = 'player'} = {}) {
  const calls = [];
  return {
    calls,
    deps: {
      currentUserId,
      dialogUtils: {
        async numberDialog(...args) {
          calls.push(['dialog', ...args]);
          return elevation;
        }
      },
      fromUuid: async uuid => uuid === ctx.owner.uuid ? ctx.owner : uuid === ctx.token.uuid ? ctx.token : undefined,
      getCombat: () => ctx.combat,
      notify: key => calls.push(['notify', key]),
      tokenUtils: {
        async moveToken(...args) {
          calls.push(['move', ...args]);
        }
      }
    }
  };
}

test('owner turn detection matches the active combatant actor', () => {
  const active = context({activeOwner: true});
  const inactive = context({activeOwner: false});

  assert.equal(movement.isOwnerTurn(active.owner, active.combat), true);
  assert.equal(movement.isOwnerTurn(inactive.owner, inactive.combat), false);
});

test('movement distance includes horizontal scale and elevation', () => {
  const {token} = context();
  const operation = move({destination: {x: 60, y: 80, elevation: 12}});

  assert.equal(movement.echoMovementDistance(operation, token.parent), 13);
});

test('valid movements accumulate against the current combat turn', async () => {
  const ctx = context({spent: 10});
  const {calls, deps} = dependencies(ctx);

  const result = await movement.handleEchoMovement(
    ctx.token,
    move({destination: {x: 0, y: 200, elevation: 0}}),
    {},
    {id: 'player'},
    deps
  );

  assert.equal(result, 'recorded');
  assert.equal(ctx.flags.get('echoMovement').spent, 20);
  assert.equal(calls.some(([type]) => type === 'move'), false);
});

test('a new owner turn resets the cumulative movement budget', async () => {
  const ctx = context({round: 3, turn: 0});
  ctx.flags.set('echoMovement', {schema: 1, combatId: 'combat', round: 2, turn: 1, spent: 29});
  const {deps} = dependencies(ctx);

  await movement.handleEchoMovement(
    ctx.token,
    move({destination: {x: 0, y: 200, elevation: 0}}),
    {},
    {id: 'player'},
    deps
  );

  assert.equal(ctx.flags.get('echoMovement').spent, 10);
  assert.equal(ctx.flags.get('echoMovement').round, 3);
});

test('forced and module-internal movement do not spend the budget', async () => {
  for (const operation of [
    {forced: true},
    {goffredoCompendium: {ignoreEchoMovement: true}}
  ]) {
    const ctx = context({spent: 12});
    const {calls, deps} = dependencies(ctx);
    const result = await movement.handleEchoMovement(
      ctx.token,
      move({destination: {x: 0, y: 400, elevation: 0}}),
      operation,
      {id: 'player'},
      deps
    );

    assert.equal(result, 'ignored');
    assert.equal(ctx.flags.get('echoMovement').spent, 12);
    assert.equal(calls.length, 0);
  }
});

test('over-budget movement is rolled back without recursively charging the rollback', async () => {
  const ctx = context({spent: 25});
  const {calls, deps} = dependencies(ctx);
  const operation = move({
    origin: {x: 100, y: 100, elevation: 5},
    destination: {x: 100, y: 300, elevation: 5}
  });

  const result = await movement.handleEchoMovement(ctx.token, operation, {}, {id: 'player'}, deps);

  assert.equal(result, 'rolled-back');
  assert.equal(ctx.flags.get('echoMovement').spent, 25);
  const rollback = calls.find(([type]) => type === 'move');
  assert.deepEqual(rollback[2], [{x: 100, y: 100, elevation: 5, action: 'catForce'}]);
  assert.equal(rollback[3].goffredoCompendium.ignoreEchoMovement, true);
  assert.ok(calls.some(([type, key]) => type === 'notify' && key === 'GAC.Echo.MovementExceeded'));
});

test('manual echo movement outside the owner turn is rolled back', async () => {
  const ctx = context({activeOwner: false});
  const {calls, deps} = dependencies(ctx);

  const result = await movement.handleEchoMovement(ctx.token, move(), {}, {id: 'player'}, deps);

  assert.equal(result, 'rolled-back');
  assert.ok(calls.some(([type, key]) => type === 'notify' && key === 'GAC.Echo.OwnerTurnOnly'));
});

test('elevation control moves only vertically within the remaining budget', async () => {
  const ctx = context({spent: 10});
  ctx.token.x = 400;
  ctx.token.y = 500;
  ctx.token.elevation = 10;
  ctx.owner.getFlag = () => ({tokenUuid: ctx.token.uuid});
  const {calls, deps} = dependencies(ctx, {elevation: 25});
  const workflow = {actor: ctx.owner};

  const result = await movement.moveEchoVertically({workflow}, deps);

  assert.equal(result, true);
  const dialog = calls.find(([type]) => type === 'dialog');
  assert.equal(dialog[3].options.value, 10);
  assert.equal(dialog[3].options.min, -10);
  assert.equal(dialog[3].options.max, 30);
  const tokenMove = calls.find(([type]) => type === 'move');
  assert.deepEqual(tokenMove[2], [{x: 400, y: 500, elevation: 25, action: 'fly'}]);
  assert.equal(tokenMove[3].constrainOptions.ignoreWalls, true);
});

test('movement integration registers exactly one Foundry v14 moveToken hook', () => {
  const calls = [];
  const hooks = {on(...args) { calls.push(args); return 7; }};

  const id = movement.registerMovementHooks(hooks, {});

  assert.equal(id, 7);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'moveToken');
  assert.equal(typeof calls[0][1], 'function');
});

test('module lifecycle registers Manifest Echo with CAT and installs movement on ready', async () => {
  const once = new Map();
  const movementHooks = [];
  const catCalls = [];
  globalThis.Hooks = {
    once(name, callback) { once.set(name, callback); },
    on(name, callback) { movementHooks.push([name, callback]); return 9; }
  };
  globalThis.game = {
    modules: new Map([
      ['midi-qol', {active: true, version: '14.0.12'}],
      ['dae', {active: true, version: '14.0.14'}],
      ['cat', {active: true, version: '0.0.8'}]
    ])
  };
  globalThis.cat = {api: {
    registerFnMacro(data) { catCalls.push(['macro', data]); },
    registerSourceName(...args) { catCalls.push(['source', ...args]); },
    registerAutomationModule(...args) { catCalls.push(['module', ...args]); }
  }};

  try {
    await import(`../scripts/main.mjs?movement-test=${Date.now()}`);
    once.get('catReady')();
    once.get('ready')();

    assert.ok(catCalls.some(([type, data]) => type === 'macro' && data.identifier === 'manifest-echo'));
    assert.ok(catCalls.some(([type, data]) => type === 'macro' && data.identifier === 'unleash-incarnation'));
    assert.equal(movementHooks.filter(([name]) => name === 'preMoveToken').length, 1);
    assert.equal(movementHooks.filter(([name]) => name === 'moveToken').length, 2);
  } finally {
    delete globalThis.Hooks;
    delete globalThis.game;
    delete globalThis.cat;
  }
});
