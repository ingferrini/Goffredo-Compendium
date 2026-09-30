import {MODULE_ID, RULESET} from '../constants.mjs';
import {actorUtils, dialogUtils, documentUtils, effectUtils, tokenUtils, workflowUtils} from '../proxy.mjs';
import {collectionValues, localize} from '../shared/foundry.mjs';
import {currentCombat, turnKey} from '../shared/turn.mjs';

const CRUSHED = 'crusherCritical';
const PUSH_FLAG = 'crusherPush';
const SIZES = ['tiny', 'sm', 'med', 'lg', 'huge', 'grg'];

const defaultDeps = {actorUtils, dialogUtils, documentUtils, effectUtils, tokenUtils, workflowUtils, combat: currentCombat};

export function dealsBludgeoning(workflow) {
  return (workflow?.damageRolls ?? []).some(roll => roll.options?.type === 'bludgeoning');
}

// The target may be at most one size category larger than the attacker.
export function canPush(attacker, target) {
  const from = SIZES.indexOf(attacker?.system?.traits?.size);
  const to = SIZES.indexOf(target?.system?.traits?.size);
  if (from < 0 || to < 0) return true;
  return to <= from + 1;
}

// Until the start of the attacker's next turn, every attack against the target
// has advantage.
export function crushedEffectData(item, deps = defaultDeps) {
  const effectData = deps.documentUtils.getBaseEffectData(item, {
    name: `${item.name}: ${localize('GAC.Crusher.Crushed')}`,
    img: item.img,
    origin: item.uuid,
    identifier: CRUSHED,
    duration: {rounds: 1},
    changes: [{key: 'flags.midi-qol.grants.advantage.attack.all', type: 'custom', value: '1', priority: 20}]
  });
  effectData.flags ??= {};
  effectData.flags.dae = {...effectData.flags.dae, specialDuration: ['turnStartSource']};
  return effectData;
}

async function markCrushed(item, target, deps) {
  const previous = deps.actorUtils.getEffectByIdentifier(target.actor, CRUSHED);
  if (previous) await deps.documentUtils.deleteDocument(previous);
  await deps.effectUtils.createEffects(target.actor, [crushedEffectData(item, deps)]);
}

export async function crusher({document: item, workflow}, deps = defaultDeps) {
  if (!deps.workflowUtils.isAttackType(workflow, 'attack') || !dealsBludgeoning(workflow)) return undefined;
  const [hit] = collectionValues(workflow.hitTargets);
  const target = hit?.document ?? hit;
  if (!target?.actor) return undefined;
  if (workflow.isCritical) await markCrushed(item, target, deps);

  const turn = turnKey(deps.combat());
  const pushedThisTurn = turn && item.flags?.[MODULE_ID]?.[PUSH_FLAG] === turn;
  if (pushedThisTurn || !canPush(workflow.actor, target.actor)) return undefined;
  const push = await deps.dialogUtils.confirm(item.name, localize('GAC.Crusher.PushPrompt'));
  if (!push) return undefined;
  await deps.tokenUtils.displaceToken(target, {sourceToken: workflow.token?.document, range: 5});
  if (turn) await deps.documentUtils.update(item, {[`flags.${MODULE_ID}.${PUSH_FLAG}`]: turn});
  return undefined;
}

export const crusherAutomation = {
  name: 'Crusher',
  version: '0.9.0',
  rules: RULESET,
  roll: [{pass: 'actorRollFinished', macro: crusher, priority: 50}]
};
