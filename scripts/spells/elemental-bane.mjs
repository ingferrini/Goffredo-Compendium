import {MODULE_ID, RULESET} from '../constants.mjs';
import {actorUtils, dialogUtils, documentUtils, effectUtils, workflowUtils} from '../proxy.mjs';
import {collectionValues, localize} from '../shared/foundry.mjs';
import {currentCombat, turnKey} from '../shared/turn.mjs';

export const BANE_TYPES = ['acid', 'cold', 'fire', 'lightning', 'thunder'];
const EFFECT = 'elementalBane';

const defaultDeps = {
  actorUtils,
  dialogUtils,
  documentUtils,
  effectUtils,
  workflowUtils,
  combat: currentCombat,
  roll: async (formula, type) => new globalThis.CONFIG.Dice.DamageRoll(formula, {}, {type}).evaluate()
};

function stateOf(effect) {
  return effect?.flags?.[MODULE_ID]?.[EFFECT] ?? {};
}

// The cursed creature loses its resistance to the chosen type and carries the
// trigger for the extra damage.
export function baneEffectData(item, damageType, concentration, deps = defaultDeps) {
  const label = globalThis.CONFIG?.DND5E?.damageTypes?.[damageType]?.label ?? damageType;
  const effectData = deps.documentUtils.getBaseEffectData(item, {
    name: `${item.name} (${localize(label)})`,
    img: item.img,
    origin: item.uuid,
    identifier: EFFECT,
    duration: {seconds: 60},
    parentEntity: concentration,
    changes: [{key: 'system.traits.dr.value', type: 'add', value: `-${damageType}`, priority: 20}],
    macros: [{type: 'roll', macros: [{source: MODULE_ID, rules: RULESET, identifier: 'elemental-bane'}]}]
  });
  effectData.flags ??= {};
  effectData.flags[MODULE_ID] = {[EFFECT]: {damageType}};
  return effectData;
}

export async function castBane({document: item, workflow}, deps = defaultDeps) {
  if (workflow?.activity?.identifier !== EFFECT) return undefined;
  const concentration = deps.effectUtils.getConcentrationEffect(workflow.actor, item);
  const cursed = collectionValues(workflow.failedSaves);
  if (!cursed.length) {
    // Every target resisted: nothing left to concentrate on.
    if (concentration) await deps.documentUtils.deleteDocument(concentration);
    return undefined;
  }
  const damageType = await deps.dialogUtils.selectDamageType(
    BANE_TYPES, item.name, localize('GAC.ElementalBane.ChooseType')
  ) || 'fire';
  for (const token of cursed) {
    const actor = token.actor ?? token.document?.actor;
    if (!actor) continue;
    const previous = deps.actorUtils.getEffectByIdentifier(actor, EFFECT);
    if (previous) await deps.documentUtils.deleteDocument(previous);
    await deps.effectUtils.createEffects(actor, [baneEffectData(item, damageType, concentration, deps)]);
  }
  return undefined;
}

function damageOfType(workflow, actor, damageType) {
  const entry = (workflow?.damageList ?? []).find(item => item.actorUuid === actor?.uuid);
  return (entry?.damageDetail ?? []).some(detail => detail.type === damageType && Number(detail.value) > 0);
}

// The first time each turn the cursed creature takes damage of the chosen
// type, it takes an extra 2d6 of that type.
export async function baneExtraDamage({document: effect, workflow}, deps = defaultDeps) {
  const actor = effect?.parent;
  const state = stateOf(effect);
  if (!actor || !state.damageType || !damageOfType(workflow, actor, state.damageType)) return undefined;
  const turn = turnKey(deps.combat());
  if (turn && state.turn === turn) return undefined;
  const token = collectionValues(workflow.targets).find(target => (target.actor ?? target.document?.actor) === actor);
  if (!token) return undefined;
  const roll = await deps.roll('2d6', state.damageType);
  await roll.toMessage?.({flavor: effect.name});
  await deps.workflowUtils.applyDamage([token.document ?? token], roll.total, state.damageType);
  if (turn) await deps.documentUtils.update(effect, {[`flags.${MODULE_ID}.${EFFECT}.turn`]: turn});
  return undefined;
}

export const elementalBane = {
  name: 'Elemental Bane',
  version: '0.9.0',
  rules: RULESET,
  roll: [
    {pass: 'itemRollFinished', macro: castBane, priority: 50},
    {pass: 'targetRollFinished', macro: baneExtraDamage, priority: 50}
  ]
};
