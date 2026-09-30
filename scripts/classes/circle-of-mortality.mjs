import {RULESET} from '../constants.mjs';
import {workflowUtils} from '../proxy.mjs';
import {collectionValues} from '../shared/foundry.mjs';

const defaultDeps = {
  workflowUtils,
  maximize: async roll => roll.clone().evaluate({maximize: true})
};

// Extra healing owed to downed creatures when a spell heals several targets
// and only some of them are at 0 hit points.
const pending = new WeakMap();

function hitPoints(token) {
  return (token?.actor ?? token?.document?.actor)?.system?.attributes?.hp?.value;
}

function total(rolls) {
  return rolls.reduce((sum, roll) => sum + (Number(roll.total) || 0), 0);
}

// Healing dice from a spell use their highest value for a creature at 0 hit points.
export async function maximizeHealing({workflow}, deps = defaultDeps) {
  if (workflow?.item?.type !== 'spell') return undefined;
  const rolls = workflow.damageRolls ?? [];
  if (!rolls.length || !rolls.every(roll => roll.options?.type === 'healing')) return undefined;
  const targets = collectionValues(workflow.targets);
  const downed = targets.filter(token => hitPoints(token) === 0);
  if (!downed.length) return undefined;
  const maximized = await Promise.all(rolls.map(roll => deps.maximize(roll)));
  if (downed.length === targets.length) {
    await workflow.setDamageRolls(maximized);
    return undefined;
  }
  const extra = total(maximized) - total(rolls);
  if (extra > 0) pending.set(workflow, {extra, downed});
  return undefined;
}

export async function healDowned({workflow}, deps = defaultDeps) {
  const owed = pending.get(workflow);
  if (!owed) return undefined;
  pending.delete(workflow);
  await deps.workflowUtils.applyDamage(owed.downed.map(token => token.document ?? token), owed.extra, 'healing');
  return undefined;
}

export const circleOfMortality = {
  name: 'Circle of Mortality',
  version: '0.9.0',
  rules: RULESET,
  roll: [
    {pass: 'actorDamageRollComplete', macro: maximizeHealing, priority: 50},
    {pass: 'actorRollFinished', macro: healDowned, priority: 50}
  ]
};
