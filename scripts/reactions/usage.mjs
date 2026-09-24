import {MODULE_ID} from '../constants.mjs';
import {hasUsedReaction as midiHasUsedReaction, setReactionUsed as midiSetReactionUsed} from '../platform/midi.mjs';
import {localize} from '../shared/foundry.mjs';

// The module tracks reactions itself, so it works whatever Midi's
// "enforce reactions" setting is. A reaction comes back at the start of the
// actor's own turn.
const FLAG = 'reactionUsed';
const DISPLAY_MODES_VISIBLE_TO_ALL = new Set([30, 50]);

function combatOf(actor) {
  return globalThis.game?.combats?.find?.(combat => combat.getCombatantsByActor?.(actor)?.length) ?? globalThis.game?.combat;
}

const MIDI_REACTION_EFFECT = 'dnd5ereaction000';
const REACTION_EFFECT_NAME = /^reaction( used)?$/i;

// Any visible "reaction used" marker counts: Midi's own effect, a status, or a
// Convenient Effects style "Reaction" effect added by hand.
export function hasReactionMarker(actor) {
  if (actor?.statuses?.has?.('reaction')) return true;
  const effects = Array.from(actor?.effects ?? []);
  return effects.some(effect => !effect.disabled && (
    effect.id === MIDI_REACTION_EFFECT || REACTION_EFFECT_NAME.test(String(effect.name ?? '').trim())
  ));
}

export function hasUsedReaction(actor, {combat = combatOf(actor), midi = midiHasUsedReaction} = {}) {
  const used = actor?.getFlag?.(MODULE_ID, FLAG);
  if (used?.combatId && used.combatId === combat?.id) return true;
  return hasReactionMarker(actor) || Boolean(midi(actor));
}

export async function markReactionUsed(actor, {combat = combatOf(actor), midi = midiSetReactionUsed} = {}) {
  if (combat?.id) await actor.setFlag(MODULE_ID, FLAG, {combatId: combat.id, round: combat.round, turn: combat.turn});
  await midi(actor);
}

export async function restoreReaction(combat) {
  const actor = combat?.combatant?.actor;
  if (actor?.getFlag?.(MODULE_ID, FLAG)) await actor.unsetFlag(MODULE_ID, FLAG);
}

export function registerReactionUsage(hooks = globalThis.Hooks) {
  return hooks.on('updateCombat', (combat, changes) => {
    if (!globalThis.game?.user?.isActiveGM) return;
    if (!('turn' in changes) && !('round' in changes)) return;
    void restoreReaction(combat);
  });
}

// Names shown to players: player characters and tokens whose name is shown to
// everyone keep it; anyone else stays anonymous.
export function publicName(token) {
  if (token?.actor?.hasPlayerOwner) return token.name ?? token.actor.name;
  if (DISPLAY_MODES_VISIBLE_TO_ALL.has(Number(token?.displayName))) return token.name;
  return localize('GAC.Reactions.Anonymous');
}

// Midi rejects a reaction attack at a creature that has already left reach.
// A temporary range bonus on the reacting actor covers that single roll.
export async function withReactionReach(actor, roll) {
  const [effect] = await actor.createEmbeddedDocuments('ActiveEffect', [{
    name: localize('GAC.Reactions.ReachGrace'),
    img: 'icons/skills/melee/strike-sword-slashing-red.webp',
    system: {changes: [{key: 'flags.midi-qol.range.all', type: 'add', value: '1000', priority: 50}]}
  }]) ?? [];
  try {
    return await roll();
  } finally {
    if (effect && actor.effects?.get?.(effect.id)) await effect.delete();
  }
}
