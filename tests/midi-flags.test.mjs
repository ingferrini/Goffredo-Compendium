import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const scripts = fileURLToPath(new URL('../scripts/', import.meta.url));

// Midi 14 reads per-ability advantage as advantage.check.<ability> and
// advantage.save.<ability>; the older advantage.ability.check/save.<ability>
// keys are silently ignored.
test('no script uses the pre-Midi-14 ability advantage flags', async () => {
  const files = (await readdir(scripts, {recursive: true})).filter(file => file.endsWith('.mjs'));
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = await readFile(path.join(scripts, file), 'utf8');
    assert.doesNotMatch(source, /(dis)?advantage\.ability\.(check|save)\./, file);
  }
});
