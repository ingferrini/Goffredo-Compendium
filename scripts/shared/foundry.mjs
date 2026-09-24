// CAT dialogs render strings verbatim, so localize keys before handing them over.
export const localize = key => globalThis.game?.i18n?.localize?.(key) ?? key;

export const notify = key => globalThis.ui?.notifications?.warn(localize(key));

export function collectionValues(collection) {
  if (!collection) return [];
  if (typeof collection.values === 'function') return Array.from(collection.values());
  return Array.from(collection);
}

export function isActive(item) {
  const attunement = item?.system?.attunement;
  const attuned = !attunement || attunement === 'optional' || item.system.attuned === true;
  return item?.system?.equipped === true && attuned;
}

export function isIncapacitated(actor) {
  const statuses = actor?.statuses;
  if (!statuses?.has) return false;
  return ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious', 'dead'].some(status => statuses.has(status));
}

// Midi-QOL measures in scene units with height included, matching the echo reach check.
export function tokenDistance(from, to) {
  return globalThis.MidiQOL.computeDistance(from.object ?? from, to.object ?? to, {
    wallsBlock: false,
    includeCover: false,
    includeElevation: true
  });
}

// Midi reads the attack origin from these workflow fields after the preamble.
export function forceTokenOrigin(midiWorkflow, originToken) {
  midiWorkflow.attackingToken = originToken.object ?? originToken;
  midiWorkflow.tokenId = originToken.id;
  midiWorkflow.tokenUuid = originToken.uuid;
  midiWorkflow.speaker = {
    ...midiWorkflow.speaker,
    scene: originToken.parent?.id,
    token: originToken.id
  };
}
