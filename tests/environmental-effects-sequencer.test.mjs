import assert from 'node:assert/strict';
import test from 'node:test';
import {effectName, listAnimationPaths, openEffectManager, playEffect, previewEffect} from '../scripts/environmental-effects/sequencer.mjs';

function fakeSequence(log) {
  const chain = new Proxy({}, {get: (_target, key) => (...args) => { log.push([key, ...args]); return chain; }});
  return class {effect() { log.push(['effect']); return chain; } sound() { log.push(['sound']); return chain; } play() { log.push(['play']); return 'played'; }};
}

const preset = {id: 'fire', animation: 'jb2a.fireball.orange', sound: '', persistent: true};

test('lists fully qualified public Sequencer paths', () => {
  const database = {
    publicModules: ['jb2a', 'custom'],
    getPathsUnder: (module, options) => { assert.equal(options.fullyQualified, true); return [`${module}.one`, `${module}.two`]; }
  };
  assert.deepEqual(listAnimationPaths(database), ['custom.one', 'custom.two', 'jb2a.one', 'jb2a.two']);
});

test('preview never persists while playback can persist and carries a stable name', async () => {
  const previewLog = [];
  await previewEffect(preset, {x: 10, y: 20}, {SequenceClass: fakeSequence(previewLog)});
  assert.equal(previewLog.some(([method]) => method === 'persist'), false);

  const playLog = [];
  await playEffect(preset, {x: 10, y: 20}, {SequenceClass: fakeSequence(playLog)});
  assert.ok(playLog.some(call => call[0] === 'persist' && call[1] === true));
  assert.ok(playLog.some(call => call[0] === 'name' && call[1] === effectName('fire')));
});

test('plays activation once and a separate lingering animation persistently', async () => {
  const log = [];
  await playEffect({...preset, lingeringAnimation: 'jb2a.fire.ground'}, {x: 10, y: 20}, {SequenceClass: fakeSequence(log)});
  assert.deepEqual(log.filter(([method]) => method === 'file').map(([, file]) => file), [preset.animation, 'jb2a.fire.ground']);
  assert.equal(log.filter(([method]) => method === 'persist').length, 1);
});

test('ignores the stored lingering animation when persistence is disabled', async () => {
  const log = [];
  await playEffect({...preset, persistent: false, lingeringAnimation: 'jb2a.fire.ground'}, {x: 10, y: 20}, {SequenceClass: fakeSequence(log)});
  assert.deepEqual(log.filter(([method]) => method === 'file').map(([, file]) => file), [preset.animation]);
  assert.equal(log.some(([method]) => method === 'persist'), false);
});

test('canvas preview plays both phases without persisting either one', async () => {
  const log = [];
  await previewEffect({...preset, lingeringAnimation: 'jb2a.fire.ground'}, {x: 10, y: 20}, {SequenceClass: fakeSequence(log)});
  assert.deepEqual(log.filter(([method]) => method === 'file').map(([, file]) => file), [preset.animation, 'jb2a.fire.ground']);
  assert.equal(log.some(([method]) => method === 'persist'), false);
});

test('opens Sequencer Effect Manager', () => {
  let opened = 0;
  openEffectManager({show: () => { opened += 1; }});
  assert.equal(opened, 1);
});
