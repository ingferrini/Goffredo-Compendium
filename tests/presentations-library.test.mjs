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

test('keeps subfolders for absolute percent-encoded Forge URLs', async () => {
  const base = 'https://assets.forge-vtt.com/u1/assets/wildemount/presentations';
  const browse = async (_source, path) => path.endsWith('presentations')
    ? {dirs: [`${path}/Nogvurot`], files: [`${base}/Neris-Fal.webp`]}
    : {dirs: [], files: [`${base}/Nogvurot/Korvanna%20Kalagiano.webp`]};
  const result = await indexPresentationLibrary({source: 'forgevtt', root: 'assets/wildemount/presentations'}, {browse});
  assert.deepEqual(result.entries.map(entry => entry.relativePath), ['Neris-Fal.webp', 'Nogvurot/Korvanna Kalagiano.webp']);
  assert.equal(result.entries[1].filename, 'Korvanna Kalagiano.webp');
  assert.deepEqual(folderPaths(result.entries), ['Nogvurot']);
});

test('keeps subfolders when the configured Forge root is percent-encoded', async () => {
  const root = 'assets/My%20World/presentations';
  const base = `https://assets.forge-vtt.com/u1/${root}`;
  const browse = async (_source, path) => path === root
    ? {dirs: [`${base}/Nogvurot`], files: []}
    : {dirs: [], files: [`${base}/Nogvurot/Korvanna%20Kalagiano.webp`]};
  const result = await indexPresentationLibrary({source: 'forgevtt', root}, {browse});
  assert.deepEqual(result.entries.map(entry => entry.relativePath), ['Nogvurot/Korvanna Kalagiano.webp']);
  assert.deepEqual(folderPaths(result.entries), ['Nogvurot']);
});

test('recurses through absolute Forge directory URLs using source-relative browse paths', async () => {
  const root = 'assets/wildemount/presentations';
  const base = `https://assets.forge-vtt.com/u1/${root}`;
  const browsed = [];
  const browse = async (_source, path) => {
    browsed.push(path);
    return path === root
      ? {dirs: [`${base}/Nogvurot`], files: []}
      : {dirs: [], files: [`${base}/Nogvurot/view.webp`]};
  };
  const result = await indexPresentationLibrary({source: 'forgevtt', root}, {browse});
  assert.deepEqual(browsed, [root, `${root}/Nogvurot`]);
  assert.deepEqual(result.entries.map(entry => entry.relativePath), ['Nogvurot/view.webp']);
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
