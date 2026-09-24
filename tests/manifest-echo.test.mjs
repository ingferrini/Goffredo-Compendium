import assert from 'node:assert/strict';
import test from 'node:test';

import {dismissEcho, summonEcho} from '../scripts/echo-knight/manifest-echo.mjs';

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
            summon.token = {
              uuid: 'Scene.scene.Token.echo',
              parent: {id: 'scene'}
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
  assert.equal(create.updates.actor.system.attributes.ac.flat, 18);
  assert.equal(create.updates.actor.system.attributes.hp.value, 1);
  assert.equal(create.updates.actor.system.traits.size, 'med');
  assert.equal(create.updates.token.texture.src, 'ash.webp');
  assert.deepEqual(calls.find(([type]) => type === 'place').slice(1), [15, {token: workflow.token.document}]);
  assert.equal(actor.getFlag('goffredo-compendium', 'echo').tokenUuid, 'Scene.scene.Token.echo');
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
