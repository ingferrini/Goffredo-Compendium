import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const manifestUrl = new URL('../module.json', import.meta.url);

test('module manifest declares the supported Foundry stack and public packs', async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));

  assert.equal(manifest.id, 'goffredo-compendium');
  assert.equal(manifest.version, '0.3.3');
  assert.deepEqual(manifest.compatibility, {
    minimum: '14',
    verified: '14.367',
    maximum: '14'
  });

  const [system] = manifest.relationships.systems;
  assert.equal(system.id, 'dnd5e');
  assert.deepEqual(system.compatibility, {
    minimum: '5.3.3',
    verified: '5.3.3',
    maximum: '5.3.99'
  });

  const required = new Map(manifest.relationships.requires.map(module => [module.id, module]));
  assert.deepEqual([...required.keys()].sort(), ['cat', 'dae', 'midi-qol']);
  assert.equal(required.get('midi-qol').compatibility.minimum, '14.0.12');
  assert.equal(required.get('dae').compatibility.minimum, '14.0.14');
  assert.equal(required.get('cat').compatibility.minimum, '0.0.8');

  assert.deepEqual(
    manifest.packs.map(pack => [pack.name, pack.type, pack.system]),
    [
      ['GACFeatures2014', 'Item', 'dnd5e'],
      ['GACSummons2014', 'Actor', 'dnd5e'],
      ['GACEquipment2014', 'Item', 'dnd5e']
    ]
  );
  assert.deepEqual(manifest.languages.map(language => language.lang).sort(), ['en', 'it']);
  assert.equal(manifest.url, 'https://github.com/ingferrini/Goffredo-Compendium');
  assert.equal(
    manifest.manifest,
    'https://github.com/ingferrini/Goffredo-Compendium/releases/latest/download/module.json'
  );
  assert.equal(
    manifest.download,
    'https://github.com/ingferrini/Goffredo-Compendium/releases/download/v0.3.3/goffredo-compendium.zip'
  );
});
