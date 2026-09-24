import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compatibilityIssues,
  registerAutomationSource,
  registerFunctionMacros
} from '../scripts/registry.mjs';

function liveModules(overrides = {}) {
  const defaults = {
    'midi-qol': {active: true, version: '14.0.12'},
    dae: {active: true, version: '14.0.14'},
    cat: {active: true, version: '0.0.8'}
  };
  const modules = {...defaults, ...overrides};
  return new Map(Object.entries(modules));
}

test('compatibility guard accepts the verified live stack', () => {
  assert.deepEqual(compatibilityIssues(liveModules()), []);
});

test('compatibility guard reports missing, inactive, and old modules', () => {
  const modules = liveModules({
    cat: undefined,
    dae: {active: false, version: '14.0.14'},
    'midi-qol': {active: true, version: '14.0.11'}
  });
  modules.delete('cat');

  assert.deepEqual(compatibilityIssues(modules), [
    {id: 'midi-qol', reason: 'version', minimum: '14.0.12', actual: '14.0.11'},
    {id: 'dae', reason: 'inactive'},
    {id: 'cat', reason: 'missing'}
  ]);
});

test('registry registers 2014 automations with a stable source', () => {
  const calls = [];
  const api = {
    registerFnMacro(data) {
      calls.push(['macro', data]);
    }
  };
  const automation = {
    name: 'Manifest Echo',
    version: '0.1.0',
    rules: '2014',
    roll: [{pass: 'itemRollFinished', macro() {}}]
  };

  registerFunctionMacros(api, [['manifest-echo', automation]]);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][1], {
    source: 'goffredo-compendium',
    identifier: 'manifest-echo',
    ...automation
  });
});

test('registry rejects duplicate identifiers before touching CAT', () => {
  let registered = false;
  const api = {registerFnMacro() { registered = true; }};
  const entries = [
    ['manifest-echo', {rules: '2014'}],
    ['manifest-echo', {rules: '2014'}]
  ];

  assert.throws(() => registerFunctionMacros(api, entries), /Duplicate automation identifier/);
  assert.equal(registered, false);
});

test('registry exposes the module to the CAT Kit', () => {
  const calls = [];
  const api = {
    registerSourceName(...args) { calls.push(['name', ...args]); },
    registerAutomationModule(...args) { calls.push(['module', ...args]); }
  };

  registerAutomationSource(api);

  assert.deepEqual(calls, [
    ['name', 'goffredo-compendium', "Goffredo's Automation Compendium"],
    ['module', 'goffredo-compendium', {ignoredPackIds: []}]
  ]);
});
