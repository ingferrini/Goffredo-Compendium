import {RULESET} from '../constants.mjs';
import {workflowUtils} from '../proxy.mjs';

// 2014: reroll a 1 or 2 once and keep the new result.
export const REROLL = 'r<3';

const defaultDeps = {
  workflowUtils,
  evaluateDamageRoll: (formula, activity, options) => (
    new globalThis.CONFIG.Dice.DamageRoll(formula, activity.getRollData(), options).evaluate()
  )
};

function properties(item) {
  const value = item?.system?.properties;
  if (value instanceof Set) return value;
  return new Set(Array.isArray(value) ? value : []);
}

// Wielded in two hands: two-handed weapons always (unless used one-handed or
// thrown), versatile weapons only in the two-handed attack mode.
export function wieldedTwoHanded(item, attackMode) {
  const props = properties(item);
  if (['oneHanded', 'offhand', 'thrown'].includes(attackMode)) return false;
  if (props.has('two')) return true;
  return props.has('ver') && attackMode === 'twoHanded';
}

function hasReroll(term) {
  return (term.modifiers ?? []).some(modifier => /^r/i.test(modifier));
}

// Rebuilds a formula with the reroll on every die that doesn't already carry one.
export function rerollFormula(roll) {
  return roll.terms.map(term => {
    if (term.isDeterministic || !('faces' in term) || hasReroll(term)) return term.expression ?? term.formula;
    const flavor = term.flavor ? `[${term.flavor}]` : '';
    return `${term.expression}${REROLL}${flavor}`;
  }).join('');
}

export async function greatWeaponFighting({workflow}, deps = defaultDeps) {
  if (!workflow?.damageRolls?.length || !workflow.actor) return undefined;
  if (!deps.workflowUtils.isAttackType(workflow, 'meleeWeaponAttack')) return undefined;
  if (!wieldedTwoHanded(workflow.item, workflow.attackMode)) return undefined;

  let changed = false;
  const rolls = await Promise.all(workflow.damageRolls.map(async roll => {
    const formula = rerollFormula(roll);
    if (formula === roll.terms.map(term => term.expression ?? term.formula).join('')) return roll;
    changed = true;
    return deps.evaluateDamageRoll(formula, workflow.activity, roll.options);
  }));
  if (changed) await workflow.setDamageRolls(rolls);
  return undefined;
}

export const greatWeaponFightingAutomation = {
  name: 'Great Weapon Fighting',
  version: '0.3.0',
  rules: RULESET,
  roll: [{pass: 'actorDamageRoll', macro: greatWeaponFighting, priority: 350}]
};
