import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import * as actions from '../scripts/echo-knight/manifest-echo.mjs';

function item({
  id,
  name,
  equipped = true,
  attackType = 'melee',
  type = 'weapon'
}) {
  const activity = {
    type: 'attack',
    attack: {type: {value: attackType}}
  };
  return {
    id,
    uuid: `Actor.owner.Item.${id}`,
    name,
    type,
    system: {
      equipped,
      activities: new Map([['attack', activity]])
    }
  };
}

function actorContext() {
  const flags = new Map();
  const actor = {
    id: 'owner',
    uuid: 'Actor.owner',
    name: 'Ash',
    items: [
      item({id: 'sword', name: 'Longsword'}),
      item({id: 'bow', name: 'Longbow', attackType: 'ranged'}),
      item({id: 'axe', name: 'Battleaxe', equipped: false}),
      item({id: 'spell', name: 'Shocking Grasp', type: 'spell'})
    ],
    system: {attributes: {movement: {walk: 30}}},
    getFlag(_scope, key) { return flags.get(key); },
    async setFlag(_scope, key, value) { flags.set(key, value); },
    async unsetFlag(_scope, key) { flags.delete(key); }
  };
  const ownerToken = {
    id: 'owner-token',
    uuid: 'Scene.scene.Token.owner-token',
    x: 100,
    y: 200,
    elevation: 0,
    movementAction: 'walk',
    movementHistory: [{cost: 5}],
    parent: {id: 'scene'},
    actor,
    object: {id: 'owner-object'}
  };
  const echoActor = {uuid: 'Actor.echo'};
  const echoToken = {
    id: 'echo-token',
    uuid: 'Scene.scene.Token.echo-token',
    x: 500,
    y: 600,
    elevation: 20,
    parent: {id: 'scene'},
    actor: echoActor,
    object: {id: 'echo-object'}
  };
  const feature = {uuid: 'Actor.owner.Item.echo', name: 'Manifest Echo', img: 'echo.webp'};
  const workflow = {
    actor,
    token: {document: ownerToken},
    targets: new Set([{uuid: 'Scene.scene.Token.target'}]),
    activity: {identifier: 'manifestEchoAttack'}
  };
  return {actor, echoActor, echoToken, feature, ownerToken, workflow};
}

function actionDependencies(context, {selection, distance = 30, echoDistance = 5} = {}) {
  const calls = [];
  const hooks = new Map();
  const effects = [
    {uuid: 'Actor.owner.ActiveEffect.attack-origin'},
    {uuid: 'Actor.echo.ActiveEffect.attack-origin'}
  ];
  let effectIndex = 0;
  return {
    calls,
    effects,
    deps: {
      actorUtils: {getEffectByIdentifier() { return undefined; }},
      dialogUtils: {
        async selectDocumentDialog(title, content, documents, options) {
          calls.push(['select', title, content, documents, options]);
          return selection;
        }
      },
      documentUtils: {
        getBaseEffectData(_item, data) {
          calls.push(['effectData', data]);
          return data;
        },
        async deleteDocument(document) {
          calls.push(['delete', document]);
        },
        async makeDependent(parent, children) {
          calls.push(['dependent', parent, children]);
        }
      },
      echoDistance: () => echoDistance,
      effectUtils: {
        async createEffects(document, data) {
          const effect = effects[effectIndex++];
          calls.push(['effects', document, data, effect]);
          return [effect];
        }
      },
      fromUuid: async uuid => uuid === context.echoToken.uuid ? context.echoToken : undefined,
      hooks: {
        once(name, callback) {
          calls.push(['hook-once', name]);
          hooks.set(name, callback);
          return 42;
        },
        off(name, id) {
          calls.push(['hook-off', name, id]);
          hooks.delete(name);
        }
      },
      notify: key => calls.push(['notify', key]),
      tokenUtils: {
        getDistance() { return distance; },
        async moveToken(token, waypoints, options) {
          calls.push(['move', token, waypoints, options]);
        }
      },
      workflowUtils: {
        async syntheticItemRoll(selected, targets) {
          calls.push(['roll', selected, targets]);
          const hookName = `midi-qol.preambleComplete.${selected.uuid}`;
          const midiWorkflow = {
            item: selected,
            tokenId: context.ownerToken.id,
            tokenUuid: context.ownerToken.uuid,
            attackingToken: context.ownerToken.object,
            speaker: {actor: context.actor.id, scene: 'scene', token: context.ownerToken.id}
          };
          await hooks.get(hookName)?.(midiWorkflow);
          calls.push(['origin', midiWorkflow]);
          return midiWorkflow;
        }
      }
    }
  };
}

test('Manifest Echo attacks include all equipped weapons while melee-only mode filters ranged attacks', () => {
  const {actor} = actorContext();

  const all = actions.eligibleEchoAttacks(actor);
  const melee = actions.eligibleEchoAttacks(actor, {meleeOnly: true});

  assert.deepEqual(all.map(entry => entry.name), ['Longsword', 'Longbow']);
  assert.deepEqual(melee.map(entry => entry.name), ['Longsword']);
});

test('attack selection rolls the original weapon from the echo and always cleans temporary effects', async () => {
  const context = actorContext();
  await context.actor.setFlag('goffredo-compendium', 'echo', {tokenUuid: context.echoToken.uuid});
  const sword = context.actor.items[0];
  const {calls, effects, deps} = actionDependencies(context, {selection: sword});

  const result = await actions.attackFromEcho({item: context.feature, workflow: context.workflow}, deps);

  assert.equal(result.attackingToken, context.echoToken.object);
  assert.equal(result.tokenId, context.echoToken.id);
  assert.equal(result.tokenUuid, context.echoToken.uuid);
  assert.equal(result.speaker.token, context.echoToken.id);
  assert.deepEqual(calls.find(([type]) => type === 'roll').slice(1), [sword, [...context.workflow.targets]]);
  const createdEffects = calls.filter(([type]) => type === 'effects');
  assert.deepEqual(createdEffects.map(([, document]) => document), [context.actor, context.echoActor]);
  assert.ok(createdEffects.every(([, , [data]]) => data.changes[0].key === 'flags.midi-qol.rangeOverride.attack.all'));
  assert.deepEqual(calls.filter(([type]) => type === 'delete').map(([, effect]) => effect), effects);
});

test('cancelling weapon selection creates no effects and rolls nothing', async () => {
  const context = actorContext();
  await context.actor.setFlag('goffredo-compendium', 'echo', {tokenUuid: context.echoToken.uuid});
  const {calls, deps} = actionDependencies(context, {selection: false});

  const result = await actions.attackFromEcho({item: context.feature, workflow: context.workflow}, deps);

  assert.equal(result, undefined);
  assert.equal(calls.some(([type]) => type === 'effects'), false);
  assert.equal(calls.some(([type]) => type === 'roll'), false);
});

test('swap exchanges horizontal and vertical positions and records a fixed 15-foot owner cost', async () => {
  const context = actorContext();
  await context.actor.setFlag('goffredo-compendium', 'echo', {tokenUuid: context.echoToken.uuid});
  const {calls, deps} = actionDependencies(context);

  const result = await actions.swapWithEcho({workflow: context.workflow}, deps);

  assert.equal(result, true);
  const moves = calls.filter(([type]) => type === 'move');
  assert.equal(moves.length, 2);
  assert.deepEqual(moves[0][2], [{x: 500, y: 600, elevation: 20, action: 'displace'}]);
  assert.deepEqual(moves[1][2], [{x: 100, y: 200, elevation: 0, action: 'catForce'}]);
  assert.equal(moves[0][3].goffredoCompendium.ignoreEchoMovement, true);
  assert.equal(moves[1][3].goffredoCompendium.ignoreEchoMovement, true);
});

test('swap never blocks on spent movement', async () => {
  const context = actorContext();
  context.ownerToken.movementHistory = [{cost: 30}];
  await context.actor.setFlag('goffredo-compendium', 'echo', {tokenUuid: context.echoToken.uuid});
  const {calls, deps} = actionDependencies(context);

  const result = await actions.swapWithEcho({workflow: context.workflow}, deps);

  assert.equal(result, true);
  assert.equal(calls.filter(([type]) => type === 'move').length, 2);
  assert.equal(calls.some(([type]) => type === 'notify'), false);
});

test('owner turn end dismisses an echo beyond 30 feet', async () => {
  const context = actorContext();
  await context.actor.setFlag('goffredo-compendium', 'echo', {tokenUuid: context.echoToken.uuid});
  const effect = {uuid: 'Actor.owner.ActiveEffect.echo', parent: context.actor};
  const {calls, deps} = actionDependencies(context, {distance: 35});

  const result = await actions.checkEchoRange({document: effect, token: context.ownerToken}, deps);

  assert.equal(result, true);
  assert.ok(calls.some(([type, document]) => type === 'delete' && document === effect));
  assert.ok(calls.some(([type, key]) => type === 'notify' && key === 'GAC.Echo.TooFar'));
  assert.equal(context.actor.getFlag('goffredo-compendium', 'echo'), undefined);
});

test('owner turn end keeps an echo at or within 30 feet', async () => {
  const context = actorContext();
  await context.actor.setFlag('goffredo-compendium', 'echo', {tokenUuid: context.echoToken.uuid});
  const effect = {uuid: 'Actor.owner.ActiveEffect.echo', parent: context.actor};
  const {calls, deps} = actionDependencies(context, {distance: 30});

  const result = await actions.checkEchoRange({document: effect, token: context.ownerToken}, deps);

  assert.equal(result, false);
  assert.equal(calls.some(([type]) => type === 'delete'), false);
  assert.equal(context.actor.getFlag('goffredo-compendium', 'echo').tokenUuid, context.echoToken.uuid);
});

test('action prompts and warnings are localized in both supported languages', async () => {
  const root = new URL('../', import.meta.url);
  const languages = await Promise.all(['en', 'it'].map(async language => (
    JSON.parse(await readFile(new URL(`lang/${language}.json`, root), 'utf8'))
  )));

  for (const language of languages) {
    for (const key of ['NoActive', 'NoAttack', 'ChooseAttack', 'ElevationLabel']) {
      assert.equal(typeof language.GAC.Echo[key], 'string', `${key} must be localized`);
      assert.ok(language.GAC.Echo[key].length > 0);
    }
  }
});

test('range cleanup runs on the CAT actorTurnEnd pass (CAT prefixes the owner scope)', () => {
  assert.deepEqual(actions.manifestEcho.combat.map(({pass}) => pass), ['actorTurnEnd']);
});

test('attack from echo stops when the target is beyond reach from the echo, height included', async () => {
  const context = actorContext();
  await context.actor.setFlag('goffredo-compendium', 'echo', {tokenUuid: context.echoToken.uuid});
  const sword = context.actor.items[0];
  const {calls, deps} = actionDependencies(context, {selection: sword, echoDistance: 10});

  const result = await actions.attackFromEcho({item: context.feature, workflow: context.workflow}, deps);

  assert.equal(result, undefined);
  assert.ok(calls.some(([type, key]) => type === 'notify' && key === 'GAC.Echo.OutOfRange'));
  assert.equal(calls.some(([type]) => type === 'effects'), false);
});

test('attack range uses melee reach or ranged long range', () => {
  const context = actorContext();
  const [sword, bow] = context.actor.items;
  bow.system.activities.get('attack').range = {value: 150, long: 600};
  sword.system.activities.get('attack').range = {reach: 10};

  assert.equal(actions.attackRange(bow), 600);
  assert.equal(actions.attackRange(sword), 10);
  sword.system.activities.get('attack').range = {};
  assert.equal(actions.attackRange(sword), 5);
});
