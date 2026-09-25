import {MODULE_ID} from '../constants.mjs';
import {setReactionUsed as midiSetReactionUsed} from '../platform/midi.mjs';
import {collectionValues, localize} from '../shared/foundry.mjs';
import {markTransient, withTimeout} from '../shared/transient.mjs';

// A reaction is used exactly while a visible marker sits on the actor: Midi's
// "Reaction used" effect (its counter lives inside that effect), the
// module's own marker, a `reaction` status, or a hand-added effect named
// "Reaction". Deleting the marker gives the reaction back.
const MARKER_FLAG = 'reactionMarker';
const MIDI_REACTION_EFFECT = 'dnd5ereaction000';
const REACTION_EFFECT_NAME = /^(reaction( used)?|reazione( usata)?)$/i;
const MARKER_ICON = 'modules/midi-qol/icons/reaction.svg';
const DISPLAY_MODES_VISIBLE_TO_ALL = new Set([30, 50]);

function effectsOf(actor) {
  return collectionValues(actor?.effects);
}

function isOwnMarker(effect) {
  return Boolean(effect?.flags?.[MODULE_ID]?.[MARKER_FLAG] ?? effect?.getFlag?.(MODULE_ID, MARKER_FLAG));
}

export function hasReactionMarker(actor) {
  if (actor?.statuses?.has?.('reaction')) return true;
  return effectsOf(actor).some(effect => !effect.disabled && (
    effect.id === MIDI_REACTION_EFFECT
    || isOwnMarker(effect)
    || REACTION_EFFECT_NAME.test(String(effect.name ?? '').trim())
  ));
}

export function hasUsedReaction(actor) {
  return hasReactionMarker(actor);
}

export function reactionMarkerData() {
  return {
    name: localize('GAC.Reactions.UsedMarker'),
    img: MARKER_ICON,
    statuses: ['reaction'],
    duration: {value: 1, units: 'rounds'},
    flags: {[MODULE_ID]: {[MARKER_FLAG]: true}, dae: {specialDuration: ['turnStart']}}
  };
}

// Midi places its own marker when its reaction enforcement is on (using the
// Convenient Effects "Reaction" status when that module defines it); otherwise
// the module places one with Midi's icon.
export async function markReactionUsed(actor, {midi = midiSetReactionUsed} = {}) {
  // Midi already marks a reaction attack it recognises; don't count it twice.
  if (hasReactionMarker(actor)) return;
  await midi(actor);
  if (hasReactionMarker(actor)) return;
  await actor.createEmbeddedDocuments('ActiveEffect', [reactionMarkerData()]);
}

export async function restoreReaction(combat) {
  const actor = combat?.combatant?.actor;
  const markers = effectsOf(actor).filter(isOwnMarker).map(effect => effect.id);
  if (markers.length) await actor.deleteEmbeddedDocuments('ActiveEffect', markers);
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
  const [effect] = await actor.createEmbeddedDocuments('ActiveEffect', [markTransient({
    name: localize('GAC.Reactions.ReachGrace'),
    img: 'icons/skills/melee/strike-sword-slashing-red.webp',
    system: {changes: [{key: 'flags.midi-qol.range.all', type: 'add', value: '1000', priority: 50}]}
  })]) ?? [];
  try {
    // A roll that never completes must not leave the grace effect behind.
    return await withTimeout(Promise.resolve().then(roll));
  } finally {
    if (effect && actor.effects?.get?.(effect.id)) await effect.delete();
  }
}
