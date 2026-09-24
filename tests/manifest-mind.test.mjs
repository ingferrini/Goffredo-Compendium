import assert from 'node:assert/strict';
import test from 'node:test';

import * as mind from '../scripts/wizard/manifest-mind.mjs';

function context({armed = false, mindToken = {id: 'mind', uuid: 'Scene.s.Token.mind', parent: {id: 's'}, actor: {uuid: 'Actor.mind'}}} = {}) {
  const calls = [];
  const effects = new Map();
  if (armed) effects.set('manifestMindCast', {uuid: 'ActiveEffect.cast'});
  const flags = new Map(mindToken ? [['mind', {tokenUuid: mindToken.uuid}]] : []);
  const actor = {
    uuid: 'Actor.woland', name: 'Woland', items: [],
    getFlag: (_scope, key) => flags.get(key),
    async setFlag(_scope, key, value) { flags.set(key, value); },
    async unsetFlag(_scope, key) { flags.delete(key); }
  };
  const feature = {uuid: 'Actor.woland.Item.mind', name: 'Manifest Mind', img: 'mind.webp', system: {identifier: 'manifest-mind'}};
  actor.items.push(feature);
  const deps = {
    actorUtils: {getEffectByIdentifier: (_actor, id) => effects.get(id)},
    compendiumUtils: {async getDocumentByIdentifier(pack, id) { calls.push(['source', pack, id]); return {uuid: 'Compendium.mind'}; }},
    documentUtils: {
      getBaseEffectData(_item, data) { calls.push(['effectData', data]); return {...data}; },
      async deleteDocument(document) { calls.push(['delete', document]); },
      async makeDependent(parent, children) { calls.push(['dependent', parent, children]); }
    },
    effectUtils: {async createEffects(document, data) { calls.push(['effects', document, data]); return [{uuid: `effect-${calls.length}`}]; }},
    fromUuid: async uuid => (mindToken && uuid === mindToken.uuid ? mindToken : undefined),
    notify: key => calls.push(['notify', key]),
    tokenUtils: {async displaceToken(token, options) { calls.push(['displace', token, options]); }},
    summonUtils: {
      async createSummon(_actor, _source, options) { calls.push(['create', options]); return {token: undefined}; },
      async placeSummons(_summons, range, options) { calls.push(['place', range, options]); return [{uuid: 'Scene.s.Token.placed'}]; }
    },
    tokenDistance: () => 30,
    userTargets: () => [{id: 'target'}]
  };
  return {actor, calls, deps, effects, feature, flags};
}

function spell({range = {value: 120, units: 'ft'}, activation = 'action', sourceClass = 'wizard'} = {}) {
  const item = {type: 'spell', system: {sourceClass}};
  return {item, range, activation: {type: activation}};
}

test('summoning places the spectral mind within 60 feet under a combat-checked marker', async () => {
  const {actor, calls, deps, feature} = context({mindToken: undefined});
  const workflow = {actor, token: {document: {disposition: 1}}, activity: {uuid: 'Activity.summon', identifier: 'manifestMind'}};

  await mind.summonMind({item: feature, workflow}, deps);

  assert.deepEqual(calls.find(([type]) => type === 'source').slice(1), ['goffredo-compendium.GACSummons2014', 'manifestMind']);
  const marker = calls.find(([type]) => type === 'effectData')[1];
  assert.equal(marker.identifier, 'manifestMind');
  assert.deepEqual(marker.unhideActivities, ['manifestMindCast', 'manifestMindMove', 'manifestMindDismiss']);
  assert.equal(marker.macros[0].macros[0].identifier, 'manifest-mind');
  assert.equal(calls.find(([type]) => type === 'create')[1].name, 'Spectral Mind of Woland');
  assert.equal(calls.find(([type]) => type === 'place')[1], 60);
  assert.equal(actor.getFlag('goffredo-compendium', 'mind').tokenUuid, 'Scene.s.Token.placed');
});

test('casting from the mind arms both the caster and the mind with a dependent range override', async () => {
  const {actor, calls, deps, feature} = context();

  const armed = await mind.armCastFromMind({item: feature, workflow: {actor}}, deps);

  assert.equal(armed, true);
  const effectData = calls.find(([type]) => type === 'effectData')[1];
  assert.equal(effectData.identifier, 'manifestMindCast');
  assert.equal(effectData.changes[0].key, 'flags.midi-qol.rangeOverride.attack.all');
  assert.equal(calls.filter(([type]) => type === 'effects').length, 2);
  assert.ok(calls.some(([type]) => type === 'dependent'));
});

test('an armed wizard spell with a target beyond range from the mind is cancelled before it is cast', async () => {
  const {actor, calls, deps} = context({armed: true});
  deps.tokenDistance = () => 150;

  const cancelled = await mind.checkMindRange({activity: spell(), actor}, deps);

  assert.equal(cancelled, true);
  assert.ok(calls.some(([type, key]) => type === 'notify' && key === 'GAC.Mind.OutOfRange'));
});

test('range checks from the mind ignore unarmed casts, reactions and non-wizard spells', async () => {
  const unarmed = context();
  assert.equal(await mind.checkMindRange({activity: spell(), actor: unarmed.actor}, unarmed.deps), undefined);

  const armed = context({armed: true});
  armed.deps.tokenDistance = () => 999;
  for (const activity of [spell({activation: 'reaction'}), spell({sourceClass: 'cleric'})]) {
    assert.equal(await mind.checkMindRange({activity, actor: armed.actor}, armed.deps), undefined);
  }
});

test('the armed spell originates from the mind and consumes the armed use', async () => {
  const {actor, calls, deps, effects} = context({armed: true});
  const workflow = {actor, activity: spell(), speaker: {alias: 'Woland'}};

  await mind.castFromMind({workflow}, deps);

  assert.equal(workflow.tokenUuid, 'Scene.s.Token.mind');
  assert.equal(workflow.speaker.token, 'mind');
  assert.ok(calls.some(([type, document]) => type === 'delete' && document === effects.get('manifestMindCast')));
});

test('spell range covers feet and touch and skips self or area-only ranges', () => {
  assert.equal(mind.spellRange({range: {value: 120, units: 'ft'}}), 120);
  assert.equal(mind.spellRange({range: {units: 'touch'}}), 5);
  assert.equal(mind.spellRange({range: {units: 'self'}}), undefined);
});

test('the mind vanishes at turn end beyond 300 feet and stays within it', async () => {
  const far = context();
  far.deps.tokenDistance = () => 305;
  const effect = {uuid: 'ActiveEffect.marker', parent: far.actor};
  assert.equal(await mind.checkMindLeash({document: effect, token: {}}, far.deps), true);
  assert.ok(far.calls.some(([type, key]) => type === 'notify' && key === 'GAC.Mind.TooFar'));
  assert.equal(far.flags.has('mind'), false);

  const near = context();
  near.deps.tokenDistance = () => 300;
  assert.equal(await mind.checkMindLeash({document: {parent: near.actor}, token: {}}, near.deps), false);
});

test('move repositions the recorded mind token with a 30-foot crosshair', async () => {
  const {actor, calls, deps} = context();
  assert.equal(await mind.moveMind({workflow: {actor}}, deps), true);
  const [, token, options] = calls.find(([type]) => type === 'displace');
  assert.equal(token.uuid, 'Scene.s.Token.mind');
  assert.equal(options.range, 30);
});

test('move and cast report a missing mind instead of failing', async () => {
  const {actor, calls, deps, feature} = context({mindToken: null});
  assert.equal(await mind.moveMind({workflow: {actor}}, deps), false);
  assert.equal(await mind.armCastFromMind({item: feature, workflow: {actor}}, deps), false);
  assert.equal(calls.filter(([type, key]) => type === 'notify' && key === 'GAC.Mind.NoActive').length, 2);
});

test('Manifest Mind registers owner-scoped CAT passes', () => {
  assert.deepEqual(mind.manifestMind.roll.map(({pass}) => pass), ['itemRollFinished', 'actorPreTargeting', 'actorPreambleComplete']);
  assert.deepEqual(mind.manifestMind.combat.map(({pass}) => pass), ['actorTurnEnd']);
});
