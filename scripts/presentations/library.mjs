export const IMAGE_EXTENSIONS = Object.freeze(['avif', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp']);

export function defaultPresentationRoot(worldId) {
  return `assets/${String(worldId ?? '').trim()}/presentations`;
}

export function normalizeLibraryConfig(value = {}, worldId = '') {
  const source = typeof value.source === 'string' && value.source.trim() ? value.source.trim() : 'forgevtt';
  const raw = typeof value.root === 'string' && value.root.trim() ? value.root.trim() : defaultPresentationRoot(worldId);
  const root = raw.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
  return {source, root};
}

function insideRoot(path, root) {
  const normalized = String(path).replaceAll('\\', '/').replace(/\/+$/g, '');
  return normalized === root || normalized.startsWith(`${root}/`);
}

function imageFile(path) {
  const clean = String(path).split(/[?#]/, 1)[0];
  return IMAGE_EXTENSIONS.includes(clean.split('.').pop()?.toLocaleLowerCase());
}

function decoded(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

// Forge may return absolute, percent-encoded URLs while FilePicker still expects
// source-relative paths for browse calls. Compare decoded forms, but retain the
// original URL on each entry for image loading.
function relativeToRoot(url, root) {
  const path = decoded(String(url).split(/[?#]/, 1)[0].replaceAll('\\', '/')).replace(/\/+$/g, '');
  const decodedRoot = decoded(root).replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
  if (path === decodedRoot) return '';
  if (path.startsWith(`${decodedRoot}/`)) return path.slice(decodedRoot.length + 1);
  const marker = `/${decodedRoot}/`;
  const markerIndex = path.indexOf(marker);
  return markerIndex >= 0 ? path.slice(markerIndex + marker.length) : null;
}

export async function indexPresentationLibrary(config, {browse}) {
  const {source, root} = normalizeLibraryConfig(config);
  const queue = [root];
  const visited = new Set();
  const entries = [];
  const warnings = [];
  while (queue.length) {
    const path = queue.shift().replaceAll('\\', '/').replace(/\/+$/g, '');
    if (!insideRoot(path, root) || visited.has(path)) continue;
    visited.add(path);
    try {
      const result = await browse(source, path);
      for (const directory of result?.dirs ?? []) {
        const relativeDirectory = relativeToRoot(directory, root);
        if (relativeDirectory !== null) queue.push(relativeDirectory ? `${root}/${relativeDirectory}` : root);
      }
      for (const url of result?.files ?? []) {
        if (!imageFile(url)) continue;
        const relativePath = relativeToRoot(url, root) ?? decoded(String(url).split(/[?#]/, 1)[0]).split('/').pop();
        const filename = relativePath.split('/').pop();
        entries.push({url, filename, relativePath, searchText: relativePath.toLocaleLowerCase()});
      }
    } catch (error) {
      warnings.push({path, message: error instanceof Error ? error.message : String(error)});
    }
  }
  entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return {entries, warnings};
}

export function searchPresentationLibrary(entries, query) {
  const needle = String(query ?? '').trim().toLocaleLowerCase();
  return needle ? entries.filter(entry => entry.searchText.includes(needle)) : [...entries];
}

export async function ensurePresentationRoot(config, {browse, createDirectory}) {
  const {source, root} = normalizeLibraryConfig(config);
  const parts = root.split('/').filter(Boolean);
  let path = '';
  for (const part of parts) {
    path = path ? `${path}/${part}` : part;
    try {
      await browse(source, path);
    } catch {
      await createDirectory(source, path);
    }
  }
  return {source, root};
}

export function folderPaths(entries) {
  const folders = new Set();
  for (const entry of entries) {
    const parts = String(entry.relativePath ?? '').split('/');
    parts.pop();
    for (let index = 1; index <= parts.length; index += 1) folders.add(parts.slice(0, index).join('/'));
  }
  return [...folders].sort((a, b) => a.localeCompare(b));
}

export function entriesInFolder(entries, folder) {
  if (!folder) return [...entries];
  const prefix = `${folder}/`;
  return entries.filter(entry => {
    const remainder = String(entry.relativePath ?? '').slice(prefix.length);
    return String(entry.relativePath ?? '').startsWith(prefix) && !remainder.includes('/');
  });
}
