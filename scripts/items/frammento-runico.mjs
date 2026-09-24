import {MODULE_ID, RULESET} from '../constants.mjs';
import {workflowUtils} from '../proxy.mjs';
import {isActive} from '../shared/foundry.mjs';

export const FRAMMENTO_IDENTIFIER = 'frammento-runico-instabile';
const TURN_FLAG = 'frammentoTurns';
const AWAKENED_FLAG = 'frammentoAwakened';
const BACKLASH_EVERY = 3;

const defaultDeps = {
  rollBacklash: async (actor, item) => {
    const roll = await new globalThis.Roll('2d6').evaluate();
    await roll.toMessage({
      speaker: globalThis.ChatMessage.getSpeaker({actor}),
      flavor: `${item.name}: ${game.i18n.localize('GAC.Frammento.Backlash')}`
    });
    await actor.applyDamage([{value: roll.total, type: 'psychic'}]);
    return roll.total;
  },
  workflowUtils
};

export function spellDealsRadiant(workflow) {
  if (workflow?.item?.type !== 'spell') return false;
  return (workflow.damageRolls ?? []).some(roll => roll.options?.type === 'radiant');
}

export async function radiantBonus({document: item, workflow}, deps = defaultDeps) {
  if (!isActive(item) || !spellDealsRadiant(workflow)) return undefined;
  await deps.workflowUtils.bonusDamage(workflow, '1d6', {damageType: 'radiant'});
  return undefined;
}

// Counts the owner's turns per combat while attuned; every third one hurts.
export function nextTurnCount(previous, combatId) {
  const count = previous?.combatId === combatId ? (Number(previous.count) || 0) + 1 : 1;
  return {combatId, count: count >= BACKLASH_EVERY ? 0 : count, backlash: count >= BACKLASH_EVERY};
}

export async function turnBacklash({document: item, combatant}, deps = defaultDeps) {
  if (!isActive(item)) return undefined;
  const combatId = combatant?.combat?.id ?? combatant?.parent?.id ?? 'combat';
  const state = nextTurnCount(item.getFlag?.(MODULE_ID, TURN_FLAG), combatId);
  await item.setFlag(MODULE_ID, TURN_FLAG, {combatId: state.combatId, count: state.count});
  if (state.backlash) await deps.rollBacklash(item.actor, item);
  return undefined;
}

// Nothing happens until the first attunement; from then on, ending it hurts.
export async function unattuneBacklash(item, changes, deps = defaultDeps) {
  if (item?.system?.identifier !== FRAMMENTO_IDENTIFIER || !item.actor) return false;
  const attuned = changes?.system?.attuned;
  if (attuned === true) {
    if (!item.getFlag?.(MODULE_ID, AWAKENED_FLAG)) await item.setFlag(MODULE_ID, AWAKENED_FLAG, true);
    return false;
  }
  if (attuned !== false || !item.getFlag?.(MODULE_ID, AWAKENED_FLAG)) return false;
  await deps.rollBacklash(item.actor, item);
  return true;
}

export const frammentoRunico = {
  name: 'Frammento Runico Instabile',
  version: '0.2.0',
  rules: RULESET,
  roll: [{pass: 'actorDamageRollComplete', macro: radiantBonus, priority: 60}],
  combat: [{pass: 'actorTurnEnd', macro: turnBacklash, priority: 60}]
};
