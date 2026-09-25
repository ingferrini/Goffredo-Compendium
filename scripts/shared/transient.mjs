import {MODULE_ID} from '../constants.mjs';
import {collectionValues} from './foundry.mjs';

// Short-lived helper effects (reaction reach, attack origin, cast-from-mind)
// must never outlive their roll. They are flagged, removed after the roll or a
// timeout, and swept at every turn change and when the world loads.
export const TRANSIENT_FLAG = 'transient';
export const TRANSIENT_TIMEOUT_MS = 60000;

export function markTransient(effectData) {
  effectData.flags ??= {};
  effectData.flags[MODULE_ID] = {...effectData.flags[MODULE_ID], [TRANSIENT_FLAG]: true};
  return effectData;
}

export function isTransient(effect) {
  return Boolean(effect?.flags?.[MODULE_ID]?.[TRANSIENT_FLAG]);
}

// Resolves with the roll result, or undefined when the roll never comes back.
export function withTimeout(promise, ms = TRANSIENT_TIMEOUT_MS, timers = globalThis) {
  let timer;
  const timeout = new Promise(resolve => { timer = timers.setTimeout(() => resolve(undefined), ms); });
  return Promise.race([promise, timeout]).finally(() => timers.clearTimeout(timer));
}

export async function sweepTransientEffects(actors) {
  let removed = 0;
  for (const actor of actors) {
    const ids = collectionValues(actor?.effects).filter(isTransient).map(effect => effect.id);
    if (!ids.length) continue;
    await actor.deleteEmbeddedDocuments('ActiveEffect', ids);
    removed += ids.length;
  }
  return removed;
}

function sceneActors() {
  const game = globalThis.game;
  const actors = new Set(collectionValues(game?.actors));
  for (const scene of collectionValues(game?.scenes)) {
    for (const token of collectionValues(scene.tokens)) if (token.actor) actors.add(token.actor);
  }
  return [...actors];
}

export function registerTransientSweep(hooks = globalThis.Hooks) {
  const sweep = () => {
    if (!globalThis.game?.user?.isActiveGM) return;
    void sweepTransientEffects(sceneActors()).catch(error => console.error('goffredo-compendium | sweep failed', error));
  };
  sweep();
  return hooks.on('updateCombat', (_combat, changes) => {
    if ('turn' in changes || 'round' in changes) sweep();
  });
}
