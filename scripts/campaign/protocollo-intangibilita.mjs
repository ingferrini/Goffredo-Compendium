import {MODULE_ID} from '../constants.mjs';
import {activeGM} from '../platform/midi.mjs';
import {publicName} from '../reactions/usage.mjs';
import {collectionValues, localize} from '../shared/foundry.mjs';

// Campaign feature of Maelis Rhor (legendary action, cost 2). Until the start of
// her next turn: the first damage she would take becomes 0; she has resistance
// to all damage, advantage on saving throws and can't be grappled or knocked prone.
export const PROTOCOL_IDENTIFIER = 'protocollo-intangibilita';
export const SHIELD_FLAG = 'protocolShield';
export const SHIELD_QUERY = `${MODULE_ID}.protocolShieldSpent`;
const ICON = 'modules/goffredo-compendium/assets/icons/manifest-mind-dismiss.webp';

function damageTypes() {
  const types = Object.keys(globalThis.CONFIG?.DND5E?.damageTypes ?? {});
  return types.length ? types : ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];
}

export function protocolEffectData(item) {
  return {
    name: item?.name ?? 'Protocollo di intangibilità',
    img: item?.img ?? ICON,
    origin: item?.uuid,
    duration: {value: 1, units: 'rounds'},
    flags: {[MODULE_ID]: {[SHIELD_FLAG]: true}, dae: {specialDuration: ['turnStart']}},
    system: {changes: [
      ...damageTypes().map(type => ({key: 'system.traits.dr.value', type: 'add', value: type, priority: 20})),
      {key: 'flags.midi-qol.advantage.ability.save.all', type: 'custom', value: '1', priority: 20},
      {key: 'system.traits.ci.value', type: 'add', value: 'grappled', priority: 20},
      {key: 'system.traits.ci.value', type: 'add', value: 'prone', priority: 20}
    ]}
  };
}

function isProtocol(item) {
  return item?.system?.identifier === PROTOCOL_IDENTIFIER;
}

function protocolEffects(actor) {
  return collectionValues(actor?.effects).filter(effect => (
    !effect.disabled && effect.flags?.[MODULE_ID]?.[SHIELD_FLAG] !== undefined
  ));
}

export async function applyProtocol(workflow) {
  if (!isProtocol(workflow?.item)) return false;
  const actor = workflow.actor ?? workflow.item.actor;
  const old = protocolEffects(actor).map(effect => effect.id);
  if (old.length) await actor.deleteEmbeddedDocuments('ActiveEffect', old);
  await actor.createEmbeddedDocuments('ActiveEffect', [protocolEffectData(workflow.item)]);
  return true;
}

export function negateDamage(ditem) {
  ditem.totalDamage = 0;
  ditem.hpDamage = 0;
  ditem.tempDamage = 0;
  if (ditem.oldHP !== undefined) ditem.newHP = ditem.oldHP;
  if (ditem.oldTempHP !== undefined) ditem.newTempHP = ditem.oldTempHP;
  for (const detail of [...(ditem.damageDetail ?? []), ...(ditem.rawDamageDetail ?? [])]) detail.value = 0;
}

function incomingDamage(ditem) {
  return Math.max(Number(ditem?.totalDamage) || 0, (Number(ditem?.hpDamage) || 0) + (Number(ditem?.tempDamage) || 0));
}

const defaultDeps = {
  chat: content => globalThis.ChatMessage?.create?.({content}),
  // The attacker's client may not own Maelis: the GM spends the shield.
  spendShield: async effect => {
    if (effect.isOwner) return effect.setFlag(MODULE_ID, SHIELD_FLAG, false);
    return activeGM()?.query?.(SHIELD_QUERY, {uuid: effect.uuid});
  }
};

// Before Midi applies damage to a target: the first damage under the protocol becomes 0.
export async function shieldFirstDamage(token, {ditem}, deps = defaultDeps) {
  const actor = token?.actor;
  const effect = protocolEffects(actor).find(entry => entry.flags[MODULE_ID][SHIELD_FLAG] === true);
  if (!effect || incomingDamage(ditem) <= 0) return false;
  negateDamage(ditem);
  // Mark it spent locally at once, so a second hit in the same moment is not negated too.
  effect.flags[MODULE_ID][SHIELD_FLAG] = false;
  await deps.spendShield(effect);
  await deps.chat(`<p><strong>${publicName(token.document ?? token)}</strong>: ${localize('GAC.Campaign.ProtocolNegated')}</p>`);
  return true;
}

export function registerProtocollo(hooks = globalThis.Hooks, queries = globalThis.CONFIG?.queries, deps = defaultDeps) {
  if (queries) {
    queries[SHIELD_QUERY] = async ({uuid}) => {
      const effect = await globalThis.fromUuid?.(uuid);
      if (effect) await effect.setFlag(MODULE_ID, SHIELD_FLAG, false);
      return true;
    };
  }
  return [
    hooks.on('midi-qol.RollComplete', workflow => { void applyProtocol(workflow); }),
    hooks.on('midi-qol.preTargetDamageApplication', (token, data) => shieldFirstDamage(token, data, deps))
  ];
}
