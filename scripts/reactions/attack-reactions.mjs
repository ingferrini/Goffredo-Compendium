import {FLAGS} from '../constants.mjs';
import {rollItem} from '../platform/midi.mjs';
import {collectionValues, isIncapacitated, localize} from '../shared/foundry.mjs';
import {getGeneralConfig, getReactionConfig} from './config.mjs';
import {footprintDistance, hasFeature, isHostilePair, meleeWeapons} from './movement-engine.mjs';
import {requestReaction} from './prompt.mjs';
import {hasUsedReaction, markReactionUsed, publicName} from './usage.mjs';

const SENTINEL_RANGE = 5;

const hasSentinel = actor => hasFeature(actor, 'sentinel', 'Sentinel');

const defaultDeps = {
  chat: content => globalThis.ChatMessage?.create?.({content}),
  general: () => getGeneralConfig(),
  hasUsedReaction,
  markReactionUsed,
  publicName,
  reactionConfig: id => getReactionConfig(id),
  requestReaction,
  rollItem
};

function tokenDocument(token) {
  return token?.document ?? token;
}

// Sentinel, third part (2014): a creature within 5 feet of you attacks a target
// other than you that lacks Sentinel; your reaction is a melee weapon attack
// against it. Any attack counts, including one made as a reaction.
export function sentinelCandidates({attacker, targets, scene}) {
  return collectionValues(scene?.tokens).filter(token => {
    if (!token.actor || token.id === attacker.id) return false;
    if (token.getFlag?.(FLAGS.scope, FLAGS.echo)) return false;
    if (!hasSentinel(token.actor) || !isHostilePair(token, attacker)) return false;
    if (targets.some(target => target.id === token.id)) return false;
    if (!targets.some(target => !hasSentinel(target.actor))) return false;
    return footprintDistance(token, attacker, scene?.grid) <= SENTINEL_RANGE;
  });
}

export async function resolveAttackReactions(workflow, deps = defaultDeps) {
  if (!workflow?.attackRoll) return [];
  const attacker = tokenDocument(workflow.token);
  if (!attacker?.parent) return [];
  if (deps.general().combatOnly && !attacker.inCombat) return [];
  if (!deps.reactionConfig('sentinelAttack').enabled) return [];

  const targets = collectionValues(workflow.targets).map(tokenDocument).filter(Boolean);
  if (!targets.length) return [];

  const results = [];
  for (const reactor of sentinelCandidates({attacker, targets, scene: attacker.parent})) {
    const actor = reactor.actor;
    if (deps.hasUsedReaction(actor) || isIncapacitated(actor)) continue;
    const weapons = meleeWeapons(actor);
    if (!weapons.length) continue;

    const choice = await deps.requestReaction({
      reactionId: 'sentinelAttack',
      actor,
      title: `${actor.name}: ${localize('GAC.Reactions.Types.sentinelAttack')}`,
      content: `${deps.publicName(attacker)}: ${localize('GAC.Reactions.Prompt.sentinelAttack')}`,
      choices: weapons.map(weapon => ({value: weapon.uuid, label: weapon.name}))
    });
    const weapon = weapons.find(entry => entry.uuid === choice);
    if (!weapon) continue;

    let rolled;
    try {
      rolled = await deps.rollItem(weapon, [attacker], {asReaction: true});
    } catch (error) {
      console.error('goffredo-compendium | Sentinel reaction failed', error);
    }
    if (!rolled) continue;
    await deps.markReactionUsed(actor);
    if (deps.general().chatSummary) {
      await deps.chat(`<p><strong>${deps.publicName(reactor)}</strong>: ${localize('GAC.Reactions.Types.sentinelAttack')} → ${deps.publicName(attacker)}</p>`);
    }
    results.push({reactor: actor.uuid, choice});
  }
  return results;
}

// Runs where the attack workflow ran, after it completes, without holding it.
export function registerAttackReactions(hooks = globalThis.Hooks, deps = defaultDeps) {
  return hooks.on('midi-qol.RollComplete', workflow => {
    globalThis.setTimeout(() => {
      void resolveAttackReactions(workflow, deps).catch(error => {
        console.error('goffredo-compendium | attack reactions failed', error);
      });
    }, 0);
  });
}
