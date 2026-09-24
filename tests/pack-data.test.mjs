import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function json(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, root), 'utf8'));
}

test('Manifest Echo exposes stable CAT controls without licensed rules text', async () => {
  const item = await json('packData/gac-features-2014/Manifest_Echo.json');
  assert.equal(item._id, 'GACManifestEcho1');
  assert.equal(item.system.identifier, 'manifest-echo');
  assert.equal(item.system.source.rules, '2014');
  assert.match(item.system.description.value, /Operational summary/i);
  assert.doesNotMatch(item.system.description.value, /magically manifest an echo of yourself/i);

  const activities = Object.values(item.system.activities);
  assert.deepEqual(
    activities.map(activity => activity.midiProperties.identifier),
    ['manifestEcho', 'manifestEchoAttack', 'manifestEchoSwap', 'manifestEchoElevation', 'manifestEchoDismiss']
  );
  assert.equal(new Set(activities.map(activity => activity._id)).size, 5);
  assert.deepEqual(item.flags.cat.macros.roll, [{
    source: 'goffredo-compendium',
    rules: '2014',
    identifier: 'manifest-echo'
  }]);
});

test('Unleash Incarnation carries long-rest uses and CAT automation metadata', async () => {
  const item = await json('packData/gac-features-2014/Unleash_Incarnation.json');
  assert.equal(item._id, 'GACUnleashInc001');
  assert.equal(item.system.identifier, 'unleash-incarnation');
  assert.equal(item.system.uses.max, '@abilities.con.mod');
  assert.deepEqual(item.system.uses.recovery, [{period: 'lr', type: 'recoverAll'}]);
  assert.equal(item.system.activities.GACUnleashUse001.midiProperties.identifier, 'unleashIncarnation');
  assert.deepEqual(item.flags.cat.macros.roll, [{
    source: 'goffredo-compendium',
    rules: '2014',
    identifier: 'unleash-incarnation'
  }]);
});

test('Echo summon is a one-hit-point condition-immune CAT actor', async () => {
  const actor = await json('packData/gac-summons-2014/Echo.json');
  assert.equal(actor._id, 'GACEchoSummon001');
  assert.equal(actor.type, 'npc');
  assert.equal(actor.system.attributes.hp.value, 1);
  assert.equal(actor.system.attributes.hp.max, 1);
  assert.equal(actor.system.attributes.movement.fly, 30);
  assert.equal(actor.system.attributes.movement.hover, true);
  assert.equal(actor.flags.cat.identifier, 'manifestEcho');
  assert.ok(actor.system.traits.ci.value.length >= 14);
  assert.ok(['blinded', 'charmed', 'stunned', 'unconscious'].every(
    condition => actor.system.traits.ci.value.includes(condition)
  ));
});

test('the module ships English only', async () => {
  const manifest = await json('module.json');
  assert.deepEqual(manifest.languages.map(language => language.lang), ['en']);
  const files = await readdir(new URL('lang/', root));
  assert.deepEqual(files, ['en.json']);
});

test('feature descriptions and activity names carry no Italian text', async () => {
  for (const filename of await readdir(new URL('packData/gac-features-2014/', root))) {
    const item = await json(`packData/gac-features-2014/${filename}`);
    assert.doesNotMatch(item.system.description.value, /Riassunto operativo/, filename);
    for (const activity of Object.values(item.system.activities ?? {})) {
      assert.doesNotMatch(activity.name, / \/ /, `${filename}: ${activity.name}`);
    }
  }
});

test('pack source filenames are JSON documents only', async () => {
  for (const directory of ['packData/gac-features-2014/', 'packData/gac-summons-2014/', 'packData/gac-equipment-2014/']) {
    const files = await readdir(new URL(directory, root));
    assert.ok(files.length > 0);
    assert.ok(files.every(file => file.endsWith('.json')));
  }
});

test('Manifest Mind exposes summon, slot, cast, move and dismiss controls', async () => {
  const item = await json('packData/gac-features-2014/Manifest_Mind.json');
  assert.equal(item.system.identifier, 'manifest-mind');
  const activities = Object.values(item.system.activities);
  assert.deepEqual(
    activities.map(activity => activity.midiProperties.identifier),
    ['manifestMind', 'manifestMindSlot', 'manifestMindCast', 'manifestMindMove', 'manifestMindDismiss']
  );
  const cast = activities.find(activity => activity.midiProperties.identifier === 'manifestMindCast');
  assert.equal(cast.uses.max, '@prof');
  const slot = activities.find(activity => activity.midiProperties.identifier === 'manifestMindSlot');
  assert.equal(slot.consumption.targets[0].type, 'spellSlots');
  assert.equal(item.flags.cat.macros.roll[0].identifier, 'manifest-mind');
});

test('Spectral mind token is tiny, hovering, with 60 ft darkvision and 10 ft dim light', async () => {
  const actor = await json('packData/gac-summons-2014/Spectral_Mind.json');
  assert.equal(actor.flags.cat.identifier, 'manifestMind');
  assert.equal(actor.system.traits.size, 'tiny');
  assert.equal(actor.system.attributes.senses.darkvision, 60);
  assert.equal(actor.system.attributes.movement.hover, true);
  assert.equal(actor.prototypeToken.width, 0.5);
  assert.equal(actor.prototypeToken.sight.range, 60);
  assert.equal(actor.prototypeToken.sight.visionMode, 'darkvision');
  assert.equal(actor.prototypeToken.light.dim, 10);
  assert.equal(actor.prototypeToken.light.bright, 0);
  assert.equal(actor.flags['midi-qol'].neverTarget, true);
});

test('reactive, companion and homebrew items carry their CAT macros', async () => {
  const expectations = [
    ['packData/gac-features-2014/Vengeful_Assault.json', 'vengeful-assault', ['roll']],
    ['packData/gac-features-2014/Pack_Tactics_Companion.json', 'pack-tactics-companion', ['roll']],
    ['packData/gac-equipment-2014/Frammento_Runico_Instabile.json', 'frammento-runico-instabile', ['roll', 'combat']],
    ['packData/gac-equipment-2014/Piuma_Metallica_Regina_Corvo.json', 'piuma-regina-corvo', ['roll', 'combat']]
  ];
  for (const [path, identifier, types] of expectations) {
    const item = await json(path);
    assert.equal(item.system.identifier, identifier, path);
    assert.deepEqual(Object.keys(item.flags.cat.macros).sort(), types.sort(), path);
    for (const type of types) assert.equal(item.flags.cat.macros[type][0].identifier, identifier, path);
  }
  const pack = await json('packData/gac-features-2014/Pack_Tactics_Companion.json');
  assert.equal(pack.system.requirements, 'Jira');
});
