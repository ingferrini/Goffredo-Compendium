import assert from 'node:assert/strict';
import test from 'node:test';

import {regionOutline} from '../scripts/environmental-effects/geometry.mjs';

test('converts circle and rectangle Region shapes for Sequencer', () => {
  const bounds = {x: 100, y: 200, width: 80, height: 60};
  assert.deepEqual(regionOutline({shapes: [{type: 'circle', radius: 40}]}, bounds), [
    {type: 'circle', options: {radius: 40}}
  ]);
  assert.deepEqual(regionOutline({shapes: [{type: 'rectangle', width: 80, height: 60}]}, bounds), [
    {type: 'rectangle', options: {width: 80, height: 60}}
  ]);
});

test('converts resolved cone and line polygons relative to the Region centre', () => {
  const shape = {type: 'cone', polygons: [{points: [100, 200, 180, 230, 100, 260]}]};
  assert.deepEqual(regionOutline({shapes: [shape]}, {x: 100, y: 200, width: 80, height: 60}), [
    {type: 'polygon', options: {points: [[-40, -30], [40, 0], [-40, 30]]}}
  ]);
});

test('ignores malformed or empty Region geometry', () => {
  assert.deepEqual(regionOutline(null, {x: 0, y: 0, width: 10, height: 10}), []);
  assert.deepEqual(regionOutline({shapes: [{type: 'cone', polygons: [{points: [1, 2, 3]}]}]}, {x: 0, y: 0, width: 10, height: 10}), []);
});
