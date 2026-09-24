import assert from 'node:assert/strict';
import test from 'node:test';

import {destroyEchoAtZeroHp, dismissEcho, echoAbilities, summonEcho} from '../scripts/echo-knight/manifest-echo.mjs';

function context() {
  const flags = new Map();
  const actor = {
    uuid: 'Actor.owner',
    name: 'Ash',
    system: {
      abilities: {con: {value: 18}},
      attributes: {prof: 4, senses: {darkvision: 60}},
      details: {type: {value: 'humanoid'}},
      traits: {size: 'med'}
    },
    prototypeToken: {sight: {enabled: true}},
    getFlag(_scope, key) { return flags.get(key); },
    async setFlag(_scope, key, value) { flags.set(key, value); },
    async unsetFlag(_scope, key) { flags.delete(key); }
  };
  const tokenDocument = {
    uuid: 'Scene.scene.Token.owner',
    width: 1,
    height: 1,
    disposition: 1,
    texture: {src: 'ash.webp'},
    parent: {id: 'scene'}
  };
  return {
    actor,
    item: {uuid: 'Actor.owner.Item.echo', name: 'Manifest Echo', img: 'echo.webp'},
    workflow: {
      actor,
      token: {document: tokenDocument},
      activity: {uuid: 'Activity.manifest', identifier: 'manifestEcho'}
    }
  };
}

function dependencies({cancelPlacement = false, existingEffect} = {}) {
  const calls = [];
  const marker = {uuid: 'Actor.owner.ActiveEffect.echo', flags: {}};
  const summon = {token: undefined};
  return {
    calls,
    marker,
    deps: {
      actorUtils: {
        getEffectByIdentifier() { return existingEffect; }
      },
      compendiumUtils: {
        async getDocumentByIdentifier(pack, identifier) {
          calls.push(['source', pack, identifier]);
          return {uuid: 'Compendium.echo'};
        }
      },
      documentUtils: {
        getBaseEffectData(_item, data) {
          calls.push(['effectData', data]);
          return {...data, flags: {}};
        },
        async deleteDocument(document) {
          calls.push(['delete', document]);
        }
      },
      effectUtils: {
        async createEffects(_actor, data) {
          calls.push(['effects', data]);
          return [marker];
        }
      },
      summonUtils: {
        async createSummon(_actor, _source, options) {
          calls.push(['create', options]);
          return summon;
        },
        async placeSummons(_summons, range, options) {
          calls.push(['place', range, options]);
          if (!cancelPlacement) {
            const tokenFlags = new Map();
            summon.token = {
              uuid: 'Scene.scene.Token.echo',
              parent: {id: 'scene'},
              getFlag(_scope, key) { return tokenFlags.get(key); },
              async setFlag(_scope, key, value) { tokenFlags.set(key, value); }
            };
          }
        }
      }
    }
  };
}

test('summon builds a one-hp echo from the current owner and places it within 15 feet', async () => {
  const {actor, item, workflow} = context();
  const {calls, deps} = dependencies();

  const result = await summonEcho({item, workflow}, deps);

  assert.equal(result.token.uuid, 'Scene.scene.Token.echo');
  const create = calls.find(([type]) => type === 'create')[1];
  assert.equal(create.name, 'Echo of Ash');
  // CAT merges updates straight into the actor data, so they must be actor-shaped.
  assert.equal(create.updates.actor, undefined);
  assert.equal(create.updates.token, undefined);
  assert.equal(create.updates.system.attributes.ac.flat, 18);
  assert.equal(create.updates.system.attributes.hp.value, 1);
  assert.equal(create.updates.system.traits.size, 'med');
  assert.equal(create.updates.prototypeToken.texture.src, 'ash.webp');
  assert.deepEqual(calls.find(([type]) => type === 'place').slice(1), [15, {token: workflow.token.document}]);
  assert.equal(actor.getFlag('goffredo-compendium', 'echo').tokenUuid, 'Scene.scene.Token.echo');
  assert.equal(result.token.getFlag('goffredo-compendium', 'echo').ownerActorUuid, actor.uuid);
});

test('summoning removes an existing marker before creating the replacement', async () => {
  const existing = {uuid: 'ActiveEffect.old'};
  const {item, workflow} = context();
  const {calls, deps} = dependencies({existingEffect: existing});

  await summonEcho({item, workflow}, deps);

  assert.deepEqual(calls[0], ['delete', existing]);
});

test('cancelled placement removes the marker and leaves no echo state', async () => {
  const {actor, item, workflow} = context();
  const {calls, marker, deps} = dependencies({cancelPlacement: true});

  const result = await summonEcho({item, workflow}, deps);

  assert.equal(result, undefined);
  assert.ok(calls.some(([type, document]) => type === 'delete' && document === marker));
  assert.equal(actor.getFlag('goffredo-compendium', 'echo'), undefined);
});

test('dismiss deletes the active marker and clears state', async () => {
  const marker = {uuid: 'ActiveEffect.echo'};
  const {actor, item, workflow} = context();
  await actor.setFlag('goffredo-compendium', 'echo', {tokenUuid: 'Token.echo'});
  const {calls, deps} = dependencies({existingEffect: marker});

  await dismissEcho({item, workflow}, deps);

  assert.ok(calls.some(([type, document]) => type === 'delete' && document === marker));
  assert.equal(actor.getFlag('goffredo-compendium', 'echo'), undefined);
});

test('echo saves use the owner save totals, not the echo proficiency bonus', () => {
  const abilities = echoAbilities({
    str: {value: 18, proficient: 1, save: {value: 8}},
    dex: {value: 12, proficient: 0, save: {value: 1}},
    con: {value: 15, proficient: 1, save: 6}
  });

  assert.deepEqual(abilities.str, {value: 18, proficient: 0, bonuses: {check: '', save: '4'}});
  assert.equal(abilities.dex.bonuses.save, '0');
  assert.equal(abilities.con.bonuses.save, '4');
});

test('summon copies owner saves and keeps the Echo creature type', async () => {
  const {item, workflow} = context();
  workflow.actor.system.abilities = {con: {value: 18, proficient: 1, save: {value: 8}}};
  const {calls, deps} = dependencies();

  await summonEcho({item, workflow}, deps);

  const {system} = calls.find(([type]) => type === 'create')[1].updates;
  assert.deepEqual(system.abilities.con, {value: 18, proficient: 0, bonuses: {check: '', save: '4'}});
  assert.equal(system.details, undefined);
});

test('an echo reduced to 0 hp is dismissed through its owner', async () => {
  const marker = {uuid: 'ActiveEffect.echo'};
  const {actor} = context();
  await actor.setFlag('goffredo-compendium', 'echo', {tokenUuid: 'Token.echo'});
  const {calls, deps} = dependencies({existingEffect: marker});
  deps.fromUuid = async uuid => uuid === actor.uuid ? actor : undefined;
  const echoActor = {token: {getFlag: () => ({ownerActorUuid: actor.uuid})}};

  assert.equal(await destroyEchoAtZeroHp(echoActor, {system: {attributes: {hp: {value: 1}}}}, deps), false);
  assert.equal(await destroyEchoAtZeroHp(echoActor, {system: {attributes: {hp: {value: 0}}}}, deps), true);
  assert.ok(calls.some(([type, document]) => type === 'delete' && document === marker));
  assert.equal(actor.getFlag('goffredo-compendium', 'echo'), undefined);
});
