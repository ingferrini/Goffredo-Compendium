import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultPresentationRoot,
  ensurePresentationRoot,
  folderPaths,
  entriesInFolder,
  indexPresentationLibrary,
  normalizeLibraryConfig,
  searchPresentationLibrary
} from '../scripts/presentations/library.mjs';

test('normalizes the Forge presentation root', () => {
  assert.equal(defaultPresentationRoot('wildemount'), 'assets/wildemount/presentations');
  assert.deepEqual(normalizeLibraryConfig({source: 'forgevtt', root: 'assets\\wildemount\\presentations/'}), {
    source: 'forgevtt', root: 'assets/wildemount/presentations'
  });
});

test('creates a missing presentation root one directory at a time', async () => {
  const existing = new Set(['assets']);
  const created = [];
  const browse = async (_source, path) => {
    if (!existing.has(path)) throw new Error('missing');
    return {dirs: [], files: []};
  };
  const createDirectory = async (_source, path) => { existing.add(path); created.push(path); };
  await ensurePresentationRoot({source: 'forgevtt', root: 'assets/wildemount/presentations'}, {browse, createDirectory});
  assert.deepEqual(created, ['assets/wildemount', 'assets/wildemount/presentations']);
});

test('derives expandable folders and filters their direct images', () => {
  const entries = [
    {relativePath: 'Rexxentrum/city.webp'},
    {relativePath: 'Rexxentrum/Archive/hall.webp'},
    {relativePath: 'Eiselcross/ice.webp'}
  ];
  assert.deepEqual(folderPaths(entries), ['Eiselcross', 'Rexxentrum', 'Rexxentrum/Archive']);
  assert.deepEqual(entriesInFolder(entries, 'Rexxentrum').map(entry => entry.relativePath), ['Rexxentrum/city.webp']);
  assert.equal(entriesInFolder(entries, '').length, 3);
});

test('indexes supported images recursively and searches names and folders', async () => {
  const browse = async (_source, path) => ({
    dirs: path.endsWith('presentations') ? [`${path}/Rexxentrum`, '../outside'] : [],
    files: path.endsWith('presentations')
      ? [`${path}/skyline.webp`, `${path}/notes.txt`]
      : [`${path}/Archive Hall.PNG`]
  });
  const result = await indexPresentationLibrary({source: 'forgevtt', root: 'assets/wildemount/presentations'}, {browse});
  assert.deepEqual(result.entries.map(entry => entry.relativePath), ['Rexxentrum/Archive Hall.PNG', 'skyline.webp']);
  assert.deepEqual(searchPresentationLibrary(result.entries, 'archive'), [result.entries[0]]);
});

test('keeps successful results when one subdirectory fails', async () => {
  const browse = async (_source, path) => {
    if (path.endsWith('/broken')) throw new Error('denied');
    return {dirs: path.endsWith('presentations') ? [`${path}/broken`] : [], files: [`${path}/view.jpg`]};
  };
  const result = await indexPresentationLibrary({source: 'forgevtt', root: 'assets/wildemount/presentations'}, {browse});
  assert.equal(result.entries.length, 1);
  assert.equal(result.warnings.length, 1);
});
