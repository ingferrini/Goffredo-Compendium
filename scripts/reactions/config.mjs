import {MODULE_ID} from '../constants.mjs';

export const REACTIONS_SETTING = 'reactions';
export const GENERAL_SETTING = 'reactionsGeneral';

export const REACTION_TYPES = Object.freeze(['opportunityAttack', 'sentinel', 'sentinelAttack', 'warCaster', 'polearmMaster', 'vengefulAssault']);
export const ON_TIMEOUT = Object.freeze(['decline', 'accept', 'gm']);
export const NPC_MODES = Object.freeze(['ask', 'auto', 'off']);
export const AUDIENCES = Object.freeze(['owner', 'ownerAndGm', 'gm']);

export const DEFAULT_REACTION = Object.freeze({
  enabled: true,
  timeout: 15,
  onTimeout: 'decline',
  npcMode: 'ask',
  audience: 'owner'
});

export const DEFAULT_GENERAL = Object.freeze({combatOnly: true, chatSummary: true});

const MIN_TIMEOUT = 5;
const MAX_TIMEOUT = 120;

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function normalizeReaction(value = {}) {
  const timeout = Math.round(Number(value.timeout));
  return {
    enabled: value.enabled === undefined ? DEFAULT_REACTION.enabled : Boolean(value.enabled),
    timeout: Number.isFinite(timeout) ? Math.min(MAX_TIMEOUT, Math.max(MIN_TIMEOUT, timeout)) : DEFAULT_REACTION.timeout,
    onTimeout: pick(value.onTimeout, ON_TIMEOUT, DEFAULT_REACTION.onTimeout),
    npcMode: pick(value.npcMode, NPC_MODES, DEFAULT_REACTION.npcMode),
    audience: pick(value.audience, AUDIENCES, DEFAULT_REACTION.audience)
  };
}

export function normalizeGeneral(value = {}) {
  return {
    combatOnly: value.combatOnly === undefined ? DEFAULT_GENERAL.combatOnly : Boolean(value.combatOnly),
    chatSummary: value.chatSummary === undefined ? DEFAULT_GENERAL.chatSummary : Boolean(value.chatSummary)
  };
}

function readSetting(settings, key) {
  try {
    return settings?.get?.(MODULE_ID, key) ?? {};
  } catch {
    return {};
  }
}

export function getReactionConfig(id, settings = globalThis.game?.settings) {
  return normalizeReaction(readSetting(settings, REACTIONS_SETTING)?.[id]);
}

export function getGeneralConfig(settings = globalThis.game?.settings) {
  return normalizeGeneral(readSetting(settings, GENERAL_SETTING));
}

export function allReactionConfigs(settings = globalThis.game?.settings) {
  const stored = readSetting(settings, REACTIONS_SETTING);
  return Object.fromEntries(REACTION_TYPES.map(id => [id, normalizeReaction(stored?.[id])]));
}

export function registerReactionSettings(settings, menuClass) {
  settings.register(MODULE_ID, REACTIONS_SETTING, {scope: 'world', config: false, type: Object, default: {}});
  settings.register(MODULE_ID, GENERAL_SETTING, {scope: 'world', config: false, type: Object, default: {...DEFAULT_GENERAL}});
  settings.register(MODULE_ID, LEGENDARY_SETTING, {scope: 'world', config: false, type: Object, default: {}});
  if (menuClass) {
    settings.registerMenu(MODULE_ID, 'reactionsMenu', {
      name: 'GAC.Reactions.Menu.Name',
      label: 'GAC.Reactions.Menu.Label',
      hint: 'GAC.Reactions.Menu.Hint',
      icon: 'fas fa-shield-halved',
      type: menuClass,
      restricted: true
    });
  }
}

// Legendary and lair actions and Legendary Resistance are GM decisions, not
// reactions: they have their own section and never spend a reaction.
export const LEGENDARY_SETTING = 'legendary';
export const LEGENDARY_TYPES = Object.freeze(['legendaryActions', 'lairActions', 'legendaryResistance']);
export const DEFAULT_LEGENDARY = Object.freeze({enabled: true, timeout: 0, pause: true, onTimeout: 'decline'});

export function normalizeLegendary(value = {}) {
  const timeout = Math.round(Number(value.timeout));
  return {
    enabled: value.enabled === undefined ? DEFAULT_LEGENDARY.enabled : Boolean(value.enabled),
    // 0 means no time limit for the GM.
    timeout: Number.isFinite(timeout) && timeout > 0 ? Math.min(MAX_TIMEOUT, Math.max(MIN_TIMEOUT, timeout)) : 0,
    pause: value.pause === undefined ? DEFAULT_LEGENDARY.pause : Boolean(value.pause),
    onTimeout: value.onTimeout === 'accept' ? 'accept' : 'decline'
  };
}

export function getLegendaryConfig(id, settings = globalThis.game?.settings) {
  return normalizeLegendary(readSetting(settings, LEGENDARY_SETTING)?.[id]);
}

export function allLegendaryConfigs(settings = globalThis.game?.settings) {
  const stored = readSetting(settings, LEGENDARY_SETTING);
  return Object.fromEntries(LEGENDARY_TYPES.map(id => [id, normalizeLegendary(stored?.[id])]));
}
