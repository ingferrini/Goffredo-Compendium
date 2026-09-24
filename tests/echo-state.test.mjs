import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearEchoState,
  createEchoState,
  getEchoState,
  setEchoState
} from '../scripts/echo-knight/state.mjs';

function actorWithFlags(initial) {
  const flags = new Map(initial ? [['echo', initial]] : []);
  return {
    flags,
    getFlag(scope, key) {
      assert.equal(scope, 'goffredo-compendium');
      return flags.get(key);
    },
    async setFlag(scope, key, value) {
      assert.equal(scope, 'goffredo-compendium');
      flags.set(key, value);
    },
    async unsetFlag(scope, key) {
      assert.equal(scope, 'goffredo-compendium');
      flags.delete(key);
    }
  };
}

test('echo state serializes owner, token, scene, and schema', () => {
  assert.deepEqual(createEchoState({
    ownerActorUuid: 'Actor.owner',
    itemUuid: 'Actor.owner.Item.echo',
    tokenUuid: 'Scene.scene.Token.echo',
    sceneId: 'scene'
  }), {
    schema: 1,
    ownerActorUuid: 'Actor.owner',
    itemUuid: 'Actor.owner.Item.echo',
    tokenUuid: 'Scene.scene.Token.echo',
    sceneId: 'scene'
  });
});

test('state helpers set, read, and clear only the module flag', async () => {
  const actor = actorWithFlags();
  const state = createEchoState({ownerActorUuid: 'Actor.owner', tokenUuid: 'Token.echo'});

  await setEchoState(actor, state);
  assert.deepEqual(getEchoState(actor), state);
  await clearEchoState(actor);
  assert.equal(getEchoState(actor), undefined);
});

