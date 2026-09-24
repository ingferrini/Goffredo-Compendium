import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function json(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, root), 'utf8'));
}

test('Manifest Echo exposes four stable CAT activities without licensed rules text', async () => {
  const item = await json('packData/gac-features-2014/Manifest_Echo.json');
  assert.equal(item._id, 'GACManifestEcho1');
  assert.equal(item.system.identifier, 'manifest-echo');
  assert.equal(item.system.source.rules, '2014');
  assert.match(item.system.description.value, /Operational summary/i);
  assert.doesNotMatch(item.system.description.value, /magically manifest an echo of yourself/i);

  const activities = Object.values(item.system.activities);
  assert.deepEqual(
    activities.map(activity => activity.midiProperties.identifier),
    ['manifestEcho', 'manifestEchoAttack', 'manifestEchoSwap', 'manifestEchoDismiss']
  );
  assert.equal(new Set(activities.map(activity => activity._id)).size, 4);
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

test('English and Italian localization files have identical key trees', async () => {
  const en = await json('lang/en.json');
  const it = await json('lang/it.json');
  const flatten = (value, prefix = '') => Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object' ? flatten(child, path) : [path];
  });
  assert.deepEqual(flatten(en).sort(), flatten(it).sort());
});

test('pack source filenames are JSON documents only', async () => {
  for (const directory of ['packData/gac-features-2014/', 'packData/gac-summons-2014/']) {
    const files = await readdir(new URL(directory, root));
    assert.ok(files.length > 0);
    assert.ok(files.every(file => file.endsWith('.json')));
  }
});
