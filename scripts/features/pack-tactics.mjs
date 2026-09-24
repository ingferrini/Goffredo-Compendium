import {RULESET} from '../constants.mjs';
import {collectionValues, isIncapacitated, localize, tokenDistance} from '../shared/foundry.mjs';

const ADJACENT = 5;

const defaultDeps = {tokenDistance};

// The companion is named in the feature's Requirements field (e.g. "Jira").
export function companionName(item) {
  return String(item?.system?.requirements ?? '').trim();
}

export function companionTokens(scene, name) {
  const wanted = name.toLowerCase();
  return collectionValues(scene?.tokens).filter(token => (
    token.actor?.name?.toLowerCase() === wanted || token.name?.toLowerCase() === wanted
  ));
}

export function packTacticsApplies({item, targets, scene}, deps = defaultDeps) {
  const name = companionName(item);
  if (!name || !targets.length) return false;
  const companions = companionTokens(scene, name).filter(token => !isIncapacitated(token.actor) && !token.hidden);
  return targets.every(target => companions.some(companion => {
    if (companion.id === target.id) return false;
    const distance = deps.tokenDistance(companion, target);
    return distance >= 0 && distance <= ADJACENT;
  }));
}

export async function packTactics({document: item, workflow}, deps = defaultDeps) {
  const targets = collectionValues(workflow?.targets).map(token => token.document ?? token);
  const scene = workflow?.token?.document?.parent ?? workflow?.token?.parent;
  if (!packTacticsApplies({item, targets, scene}, deps)) return undefined;
  workflow.tracker?.advantage?.add(item.name, localize('GAC.PackTactics.Reason'));
  return undefined;
}

export const packTacticsAutomation = {
  name: 'Pack Tactics (Companion)',
  version: '0.2.0',
  rules: RULESET,
  roll: [{pass: 'actorAttackRollConfig', macro: packTactics, priority: 50}]
};
