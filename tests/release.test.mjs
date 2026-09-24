import assert from 'node:assert/strict';
import {readdir, readFile, rm} from 'node:fs/promises';
import test from 'node:test';
import {TextDecoder} from 'node:util';

import {unzipSync} from 'fflate';

import {buildRelease} from '../tools/build-release.mjs';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);

function entriesOf(buffer) {
  return Object.keys(unzipSync(new Uint8Array(buffer))).sort();
}

test('release archive contains the installable module and excludes development sources', async () => {
  await rm(dist, {recursive: true, force: true});
  await buildRelease({root});

  const archive = await readFile(new URL('dist/goffredo-compendium.zip', root));
  const entries = entriesOf(archive);
  for (const required of [
    'module.json',
    'README.md',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'scripts/main.mjs',
    'lang/en.json'
  ]) assert.ok(entries.includes(required), `${required} must be included`);

  assert.ok(entries.some(entry => entry.startsWith('packs/gac-features-2014/')));
  assert.ok(entries.some(entry => entry.startsWith('packs/gac-summons-2014/')));
  assert.ok(entries.some(entry => entry.startsWith('packs/gac-equipment-2014/')));
  assert.equal(entries.some(entry => /\/(?:LOCK|LOG|[^/]+\.log)$/.test(entry)), false);
  for (const forbidden of ['node_modules/', 'packData/', 'tests/', 'docs/', '.git/', '.github/']) {
    assert.equal(entries.some(entry => entry.startsWith(forbidden)), false, `${forbidden} must be excluded`);
  }
  assert.equal(entries.includes('package.json'), false);
});

test('release manifest matches the archived manifest and has stable public URLs', async () => {
  await buildRelease({root});

  const standalone = JSON.parse(await readFile(new URL('dist/module.json', root), 'utf8'));
  const archive = unzipSync(new Uint8Array(await readFile(new URL('dist/goffredo-compendium.zip', root))));
  const archived = JSON.parse(new TextDecoder().decode(archive['module.json']));

  assert.deepEqual(archived, standalone);
  assert.equal(standalone.manifest, 'https://github.com/ingferrini/Goffredo-Compendium/releases/latest/download/module.json');
  assert.equal(standalone.download, `https://github.com/ingferrini/Goffredo-Compendium/releases/download/v${standalone.version}/goffredo-compendium.zip`);
});

test('release contains no undeclared artwork or copied rules descriptions', async () => {
  await buildRelease({root});
  const archive = unzipSync(new Uint8Array(await readFile(new URL('dist/goffredo-compendium.zip', root))));
  // Bundled artwork lives only in assets/icons and every bundled icon is used.
  const imageEntries = Object.keys(archive).filter(entry => /\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(entry));
  assert.ok(imageEntries.every(entry => entry.startsWith('assets/icons/')), imageEntries.join(', '));

  const moduleIcon = /^modules\/goffredo-compendium\/(assets\/icons\/[^"]+)$/;
  const referenced = new Set();
  for (const pack of ['gac-features-2014', 'gac-summons-2014', 'gac-equipment-2014']) {
    for (const filename of await readdir(new URL(`packData/${pack}/`, root))) {
      const source = await readFile(new URL(`packData/${pack}/${filename}`, root), 'utf8');
      for (const [, path] of source.matchAll(/"(modules\/goffredo-compendium\/[^"]+)"/g)) {
        const match = path.match(moduleIcon);
        assert.ok(match, `${filename} references ${path} outside assets/icons`);
        referenced.add(match[1]);
      }
    }
  }
  for (const icon of referenced) assert.ok(archive[icon], `${icon} is referenced but not bundled`);
  assert.deepEqual(imageEntries.filter(entry => !referenced.has(entry)), []);

  const featureSources = ['Manifest_Echo.json', 'Unleash_Incarnation.json', 'Manifest_Mind.json', 'Vengeful_Assault.json', 'Pack_Tactics_Companion.json', 'Great_Weapon_Fighting.json'];
  for (const filename of featureSources) {
    const document = JSON.parse(await readFile(new URL(`packData/gac-features-2014/${filename}`, root), 'utf8'));
    assert.match(document.system.description.value, /Operational summary/i);
    assert.doesNotMatch(document.system.description.value, /magically manifest an echo of yourself/i);
    assert.doesNotMatch(document.system.description.value, /heightened state of fury/i);
    assert.doesNotMatch(document.system.description.value, /conjure forth the mind of your Awakened Spellbook/i);
    assert.doesNotMatch(document.system.description.value, /you can use your reaction to make an attack with the weapon against that creature/i);
    assert.equal(document.system.description.chat, '');
  }
});
