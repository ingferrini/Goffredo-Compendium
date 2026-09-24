import {Buffer} from 'node:buffer';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {zipSync} from 'fflate';

const MODULE_ID = 'goffredo-compendium';
const RELEASE_DATE = new Date('1980-01-01T00:00:00Z');
const RELEASE_PATHS = [
  'module.json',
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'assets',
  'lang',
  'scripts',
  'packs'
];
const VOLATILE_PACK_FILES = new Set(['LOCK', 'LOG']);

function normalizedVersion(value, fallback) {
  const version = String(value || fallback).replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid release version: ${version}`);
  }
  return version;
}

async function filesUnder(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  const fileStat = await stat(absolutePath);
  if (fileStat.isFile()) return [relativePath];

  const entries = await readdir(absolutePath, {withFileTypes: true});
  const nested = await Promise.all(entries.map(entry => (
    filesUnder(root, path.join(relativePath, entry.name))
  )));
  return nested.flat();
}

function releaseManifest(source, version) {
  return {
    ...source,
    version,
    download: `https://github.com/ingferrini/Goffredo-Compendium/releases/download/v${version}/${MODULE_ID}.zip`
  };
}

function digest(data) {
  return createHash('sha256').update(data).digest('hex');
}

export async function buildRelease({root = new URL('../', import.meta.url), version} = {}) {
  const rootPath = fileURLToPath(root);
  const distPath = path.join(rootPath, 'dist');
  await rm(distPath, {recursive: true, force: true});
  await mkdir(distPath, {recursive: true});

  const sourceManifest = JSON.parse(await readFile(path.join(rootPath, 'module.json'), 'utf8'));
  const selectedVersion = normalizedVersion(
    version ?? process.env.RELEASE_VERSION ?? (process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined),
    sourceManifest.version
  );
  const manifest = releaseManifest(sourceManifest, selectedVersion);
  const manifestData = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);

  const relativeFiles = (await Promise.all(
    RELEASE_PATHS.map(relativePath => filesUnder(rootPath, relativePath))
  )).flat().filter(relativePath => {
    if (!relativePath.startsWith(`packs${path.sep}`)) return true;
    const filename = path.basename(relativePath);
    return !VOLATILE_PACK_FILES.has(filename) && !filename.endsWith('.log');
  }).sort((left, right) => left.localeCompare(right));

  const archive = {};
  for (const relativePath of relativeFiles) {
    const archivePath = relativePath.split(path.sep).join('/');
    const data = archivePath === 'module.json'
      ? manifestData
      : await readFile(path.join(rootPath, relativePath));
    archive[archivePath] = [new Uint8Array(data), {mtime: RELEASE_DATE}];
  }

  const archiveData = Buffer.from(zipSync(archive, {level: 9, mtime: RELEASE_DATE}));
  const archiveName = `${MODULE_ID}.zip`;
  await writeFile(path.join(distPath, archiveName), archiveData);
  await writeFile(path.join(distPath, 'module.json'), manifestData);
  await writeFile(path.join(distPath, `${archiveName}.sha256`), `${digest(archiveData)}  ${archiveName}\n`);
  await writeFile(path.join(distPath, 'module.json.sha256'), `${digest(manifestData)}  module.json\n`);
  return {archivePath: path.join(distPath, archiveName), manifestPath: path.join(distPath, 'module.json')};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await buildRelease();
  console.log(`Built ${result.archivePath}`);
}
