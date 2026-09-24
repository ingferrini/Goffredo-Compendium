import assert from 'node:assert/strict';
import test from 'node:test';

import * as gwf from '../scripts/features/great-weapon-fighting.mjs';

function die(number, faces, {modifiers = [], flavor} = {}) {
  return {number, faces, modifiers, flavor, isDeterministic: false, expression: `${number}d${faces}${modifiers.join('')}`};
}
const plus = {isDeterministic: true, expression: ' + '};
const flat = value => ({isDeterministic: true, expression: String(value)});

function workflow({properties = ['two'], attackMode = 'twoHanded', melee = true, terms} = {}) {
  const calls = [];
  const roll = {terms: terms ?? [die(2, 6), plus, flat(5)], options: {type: 'slashing', isCritical: false}};
  return {
    calls,
    deps: {
      workflowUtils: {isAttackType: (_workflow, type) => type === 'meleeWeaponAttack' && melee},
      evaluateDamageRoll: async (formula, activity, options) => ({formula, activity, options})
    },
    workflow: {
      actor: {},
      activity: {id: 'attack'},
      item: {system: {properties: new Set(properties)}},
      attackMode,
      damageRolls: [roll],
      async setDamageRolls(rolls) { calls.push(rolls); }
    }
  };
}

test('two-handed melee weapon damage dice reroll 1s and 2s once, keeping flat bonuses and options', async () => {
  const {calls, deps, workflow: wf} = workflow();
  await gwf.greatWeaponFighting({workflow: wf}, deps);
  assert.equal(calls[0][0].formula, '2d6r<3 + 5');
  assert.deepEqual(calls[0][0].options, {type: 'slashing', isCritical: false});
});

test('versatile weapons qualify only when wielded two-handed', async () => {
  const twoHands = workflow({properties: ['ver'], attackMode: 'twoHanded'});
  await gwf.greatWeaponFighting({workflow: twoHands.workflow}, twoHands.deps);
  assert.equal(twoHands.calls.length, 1);

  const oneHand = workflow({properties: ['ver'], attackMode: 'oneHanded'});
  await gwf.greatWeaponFighting({workflow: oneHand.workflow}, oneHand.deps);
  assert.equal(oneHand.calls.length, 0);
});

test('ranged, thrown and non two-handed weapons are untouched', async () => {
  for (const options of [{melee: false}, {attackMode: 'thrown'}, {properties: ['fin']}, {properties: ['ver'], attackMode: ''}]) {
    const {calls, deps, workflow: wf} = workflow(options);
    await gwf.greatWeaponFighting({workflow: wf}, deps);
    assert.equal(calls.length, 0, JSON.stringify(options));
  }
});

test('dice that already reroll are not rerolled twice and flavours survive', () => {
  assert.equal(gwf.rerollFormula({terms: [die(1, 10, {modifiers: ['r<3']}), plus, die(2, 6, {flavor: 'force'})]}), '1d10r<3 + 2d6r<3[force]');
  assert.equal(gwf.rerollFormula({terms: [die(1, 10, {modifiers: ['r<3']})]}), '1d10r<3');
});

test('an already rerolled formula leaves the damage untouched', async () => {
  const {calls, deps, workflow: wf} = workflow({terms: [die(1, 10, {modifiers: ['r<3']})]});
  await gwf.greatWeaponFighting({workflow: wf}, deps);
  assert.equal(calls.length, 0);
});

test('Great Weapon Fighting runs on the owner damage roll pass', () => {
  assert.deepEqual(gwf.greatWeaponFightingAutomation.roll.map(({pass}) => pass), ['actorDamageRoll']);
});
