import assert from 'node:assert/strict';
import test from 'node:test';
import {collectSceneTokens, collectTemplateTokens, filterAudience, sceneArea} from '../scripts/environmental-effects/targeting.mjs';

const token = (id, disposition, type = 'npc', hasPlayerOwner = false) => ({
  id, disposition, center: {x: Number(id.length * 10), y: 10}, actor: {type, hasPlayerOwner}
});

test('filters allies, player characters, enemies, and everyone', () => {
  const rows = [token('ally', 1), token('neutral', 0), token('pc', 1, 'character', true), token('enemy', -1)];
  assert.deepEqual(filterAudience(rows, 'allies').map(row => row.id), ['ally', 'neutral']);
  assert.deepEqual(filterAudience(rows, 'pcs').map(row => row.id), ['pc']);
  assert.deepEqual(filterAudience(rows, 'enemies').map(row => row.id), ['enemy']);
  assert.equal(filterAudience(rows, 'everyone').length, 4);
});

test('collects valid actor tokens whose centres and elevation are inside a v14 region', () => {
  const rows = [token('in', 1), token('outside', -1), {...token('actorless', 0), actor: null}];
  rows[0].elevation = 20;
  const tested = [];
  const region = {testPoint: point => { tested.push(point); return point.x < 50; }};
  assert.deepEqual(collectTemplateTokens(rows, region).map(row => row.id), ['in']);
  assert.deepEqual(tested[0], {x: 20, y: 10, elevation: 20});
});

test('whole-scene collection excludes hidden and actorless tokens', () => {
  const rows = [token('visible', 1), {...token('hidden', -1), hidden: true}, {...token('actorless', 0), actor: null}];
  assert.deepEqual(collectSceneTokens(rows).map(row => row.id), ['visible']);
});

test('whole-scene placement sizes the visual to the scene rectangle', () => {
  const area = sceneArea({dimensions: {sceneRect: {x: 100, y: 200, width: 1200, height: 800}}});
  assert.deepEqual(area.location, {x: 700, y: 600, width: 1200, height: 800});
});
