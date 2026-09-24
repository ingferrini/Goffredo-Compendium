// Thin Midi-QOL adapter used by CAT-independent automations.

function midi() {
  return globalThis.MidiQOL;
}

export function activeOwner(actor, users = globalThis.game?.users) {
  const players = Array.from(users ?? []).filter(user => user.active && !user.isGM);
  return players.find(user => actor?.testUserPermission?.(user, 'OWNER'));
}

export function activeGM(users = globalThis.game?.users) {
  return users?.activeGM ?? Array.from(users ?? []).find(user => user.active && user.isGM);
}

export function hasUsedReaction(actor) {
  return Boolean(midi()?.hasUsedReaction?.(actor));
}

export async function setReactionUsed(actor) {
  await midi()?.setReactionUsed?.(actor);
}

export function canSee(token, target) {
  const api = midi();
  if (!api?.canSee) return true;
  return api.canSee(token.object ?? token, target.object ?? target);
}

export function distance(from, to) {
  return midi().computeDistance(from.object ?? from, to.object ?? to, {
    wallsBlock: false,
    includeCover: false,
    includeElevation: true
  });
}

// Rolls an item against targets through Midi, as its owner when a player owns it.
// Adapted from CAT's workflowUtils.completeItemUse (ISC).
// asReaction: the module tracks the reaction itself, so Midi must neither check
// nor mark it (otherwise it asks for an "additional reaction").
export async function rollItem(item, targets = [], {consume = true, asReaction = false} = {}) {
  const owner = activeOwner(item.actor);
  const currentUser = globalThis.game?.user?.id;
  const asUser = owner?.id ?? currentUser;
  const autoRollDamage = ['always', 'onHit'].includes(midi().configSettings?.()?.autoRollDamage)
    ? midi().configSettings().autoRollDamage
    : 'onHit';
  const midiOptions = {
    targetUuids: targets.map(target => target.uuid),
    configureDialog: false,
    asUser,
    workflowOptions: {autoRollAttack: true, autoFastDamage: true, autoRollDamage, ...(asReaction ? {notReaction: true} : {})}
  };
  const remote = asUser !== currentUser;
  if (remote) Object.assign(midiOptions, {workflowData: true, checkGMStatus: true});
  const config = {consumeUsage: consume, consume: {resources: consume, spellSlot: consume}, midiOptions};
  let workflow = await midi().completeItemUse(item, config, {}, {});
  workflow = workflow?.workflow ?? workflow;
  if (remote && workflow) {
    for (const key of ['hitTargets', 'targets', 'failedSaves']) {
      if (workflow[key]) workflow[key] = new Set(workflow[key]);
    }
  }
  return workflow;
}
