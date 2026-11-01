import assert from 'node:assert/strict';
import test from 'node:test';

test('unwraps the arrays returned by dnd5e template creation and placement', async () => {
  const runtime = await import('../scripts/environmental-effects/runtime.mjs');
  assert.equal(typeof runtime.firstTemplateResult, 'function');
  const preview = {drawPreview() {}};
  const document = {id: 'template'};
  assert.equal(runtime.firstTemplateResult([preview]), preview);
  assert.equal(runtime.firstTemplateResult([document]), document);
  assert.equal(runtime.firstTemplateResult(preview), preview);
  assert.equal(runtime.firstTemplateResult(null), null);
});

test('resolves an immediate preview file from Sequencer database entries', async () => {
  const runtime = await import('../scripts/environmental-effects/runtime.mjs');
  assert.equal(typeof runtime.previewSource, 'function');
  const database = {getEntry: () => ({clone: () => ({getPreviewFile: () => 'preview.webm'})})};
  assert.equal(runtime.previewSource(database, 'jb2a.test'), 'preview.webm');
  assert.equal(runtime.previewSource({getEntry: () => ['first.webm', 'second.webm']}, 'jb2a.test'), 'first.webm');
});
