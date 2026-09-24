import {RULESET} from '../constants.mjs';
import {distance, hasUsedReaction, rollItem, setReactionUsed} from '../platform/midi.mjs';
import {requestReaction} from '../reactions/prompt.mjs';
import {collectionValues, isIncapacitated, localize} from '../shared/foundry.mjs';

const defaultDeps = {
  hasUsedReaction,
  requestReaction,
  rollItem,
  setReactionUsed,
  tokenDistance: distance
};

function attackActivity(item) {
  return collectionValues(item.system?.activities).find(activity => activity.type === 'attack');
}

// Farthest distance the weapon can attack at: reach for melee, long range otherwise.
export function weaponReach(item) {
  const activity = attackActivity(item);
  const range = activity?.range ?? item.system?.range ?? {};
  const attackType = activity?.attack?.type?.value;
  const melee = attackType ? attackType === 'melee' : String(item.system?.type?.value ?? '').endsWith('M');
  if (melee) {
    const reach = Number(range.reach ?? item.system?.range?.reach);
    return Number.isFinite(reach) && reach > 0 ? reach : 5;
  }
  const long = Number(range.long);
  const normal = Number(range.value);
  if (Number.isFinite(long) && long > 0) return long;
  return Number.isFinite(normal) && normal > 0 ? normal : 0;
}

export function wieldedWeapons(actor) {
  return collectionValues(actor?.items).filter(item => (
    item.type === 'weapon' && item.system?.equipped === true && attackActivity(item)
  ));
}

export function damageTaken(workflow, actor) {
  const entry = collectionValues(workflow?.damageList).find(damage => damage.actorUuid === actor.uuid);
  if (!entry) return 0;
  const taken = (Number(entry.hpDamage) || 0) + (Number(entry.tempDamage) || 0);
  return taken > 0 ? taken : Math.max(0, Number(entry.totalDamage) || 0);
}

function usesLeft(item) {
  const max = Number(item.system?.uses?.max);
  if (!Number.isFinite(max) || max <= 0) return Infinity;
  return max - (Number(item.system?.uses?.spent) || 0);
}

// Runs once per workflow on the attacker's client, after the damage is applied.
export async function vengefulAssault({document: item, workflow, sourceToken}, deps = defaultDeps) {
  const actor = item?.actor;
  const attacker = workflow?.token?.document ?? workflow?.token;
  const defender = sourceToken ?? collectionValues(workflow?.targets)
    .map(token => token.document ?? token)
    .find(token => token.actor?.uuid === actor?.uuid);
  if (!actor || !attacker || !defender || attacker.actor?.uuid === actor.uuid) return undefined;
  if (usesLeft(item) <= 0 || deps.hasUsedReaction(actor) || isIncapacitated(actor)) return undefined;
  if (damageTaken(workflow, actor) <= 0) return undefined;
  if ((Number(actor.system?.attributes?.hp?.value) || 0) <= 0) return undefined;

  const distance = deps.tokenDistance(defender, attacker);
  const weapons = wieldedWeapons(actor).filter(weapon => distance >= 0 && distance <= weaponReach(weapon));
  if (!weapons.length) return undefined;

  // Timeout and fallback come from the Vengeful Assault row of the Reactions panel.
  const choice = await deps.requestReaction({
    reactionId: 'vengefulAssault',
    actor,
    title: `${actor.name}: ${item.name}`,
    content: localize('GAC.VengefulAssault.Prompt'),
    choices: weapons.map(weapon => ({value: weapon.uuid, label: weapon.name}))
  });
  const weapon = weapons.find(entry => entry.uuid === choice);
  if (!weapon) return undefined;

  await deps.setReactionUsed(actor);
  await item.update({'system.uses.spent': (Number(item.system?.uses?.spent) || 0) + 1});
  await deps.rollItem(weapon, [attacker]);
  return undefined;
}

export const vengefulAssaultAutomation = {
  name: 'Vengeful Assault',
  version: '0.4.0',
  rules: RULESET,
  roll: [{pass: 'targetRollFinished', macro: vengefulAssault, priority: 50}]
};
