import assert from 'node:assert/strict';
import test from 'node:test';

import {buildRegionPlacementData, placeTemplate, showFormDialog} from '../scripts/environmental-effects/runtime.mjs';

test('builds a Foundry v14 measured region using scene distance pixels', () => {
  const data = buildRegionPlacementData(
    {shape: 'circle', distance: 20, width: 5},
    {distancePixels: 10},
    {id: 'gm', color: '#ff0000'}
  );
  assert.deepEqual(data.shapes, [{type: 'circle', x: 0, y: 0, radius: 200, gridBased: true}]);
  assert.equal(data.displayMeasurements, true);
  assert.equal(data.ownership.gm, 3);
});

test('places an ephemeral v14 region and returns its bounds for animations', async () => {
  const calls = [];
  const region = {
    bounds: {x: 100, y: 200, width: 300, height: 200},
    shapes: [{type: 'circle', radius: 100}],
    testPoint: () => true
  };
  globalThis.canvas = {
    dimensions: {distancePixels: 10},
    regions: {placeRegion: async (...args) => { calls.push(args); return region; }}
  };
  globalThis.game = {user: {id: 'gm', color: '#ff0000'}};

  const area = await placeTemplate({shape: 'circle', distance: 20, width: 5});

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][1], {create: false});
  assert.equal(area.region, region);
  assert.deepEqual(area.location, {
    x: 250, y: 300, width: 300, height: 200,
    outline: [{type: 'circle', options: {radius: 100}}]
  });
});

test('resolves an immediate preview file from Sequencer database entries', async () => {
  const runtime = await import('../scripts/environmental-effects/runtime.mjs');
  assert.equal(typeof runtime.previewSource, 'function');
  const database = {getEntry: () => ({clone: () => ({getPreviewFile: () => 'preview.webm'})})};
  assert.equal(runtime.previewSource(database, 'jb2a.test'), 'preview.webm');
  assert.equal(runtime.previewSource({getEntry: () => ['first.webm', 'second.webm']}, 'jb2a.test'), 'first.webm');
});

test('form dialogs resolve only after DialogV2 has closed', async () => {
  let options;
  let closeListener;
  let resolved = false;

  class DialogV2 {
    constructor(value) { options = value; }
    addEventListener(type, listener) {
      if (type === 'close') closeListener = listener;
    }
    render() {}
  }

  globalThis.game = {i18n: {localize: key => key}};
  globalThis.foundry = {applications: {api: {DialogV2}}};

  const promise = showFormDialog({title: 'Placement', content: '<form></form>', confirmLabel: 'Place'});
  promise.then(() => { resolved = true; });

  options.submit({distance: 30, width: 5});
  await Promise.resolve();
  assert.equal(resolved, false, 'the modal must remain authoritative until its close event');

  closeListener();
  assert.deepEqual(await promise, {distance: 30, width: 5});
});
