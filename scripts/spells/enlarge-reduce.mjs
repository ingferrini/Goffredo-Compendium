import {MODULE_ID, RULESET} from '../constants.mjs';
import {actorUtils, dialogUtils, documentUtils, effectUtils, workflowUtils} from '../proxy.mjs';
import {collectionValues, localize} from '../shared/foundry.mjs';

const EFFECT = 'enlargeReduce';
const SIZES = ['tiny', 'sm', 'med', 'lg', 'huge', 'grg'];
// Grid squares a creature of each size occupies.
const SQUARES = {tiny: 0.5, sm: 1, med: 1, lg: 2, huge: 3, grg: 4};

const defaultDeps = {
  actorUtils,
  dialogUtils,
  documentUtils,
  effectUtils,
  workflowUtils,
  fromUuid: (...args) => globalThis.fromUuid(...args)
};

export function resized(size, mode) {
  const index = SIZES.indexOf(size);
  if (index < 0) return size;
  const next = mode === 'enlarge' ? Math.min(index + 1, SIZES.length - 1) : Math.max(index - 1, 0);
  return SIZES[next];
}

function change(key, value, type = 'override') {
  return {key, type, value: String(value), priority: 20};
}

// One size category up or down, advantage or disadvantage on Strength checks
// and saves, and +1d4 or -1d4 on weapon damage.
export function sizeChanges(actor, mode) {
  const roll = mode === 'enlarge' ? 'advantage' : 'disadvantage';
  const damage = mode === 'enlarge' ? '+1d4' : '-1d4';
  return [
    change('system.traits.size', resized(actor?.system?.traits?.size, mode)),
    change(`flags.midi-qol.${roll}.ability.check.str`, 1, 'custom'),
    change(`flags.midi-qol.${roll}.ability.save.str`, 1, 'custom'),
    change('system.bonuses.mwak.damage', damage, 'add'),
    change('system.bonuses.rwak.damage', damage, 'add')
  ];
}

async function chooseMode(item, activity, deps) {
  const identifier = activity?.identifier;
  if (identifier === 'enlarge' || identifier === 'reduce') return identifier;
  return deps.dialogUtils.buttonDialog(item.name, localize('GAC.EnlargeReduce.Choose'), [
    [localize('GAC.EnlargeReduce.Enlarge'), 'enlarge', {}],
    [localize('GAC.EnlargeReduce.Reduce'), 'reduce', {}]
  ]);
}

function disposition(token) {
  return (token?.document ?? token)?.disposition;
}

// Allies of the caster (the caster included) are willing and never resist;
// anyone else is affected only after failing the save.
export function affectedTargets(workflow) {
  const saved = new Set(collectionValues(workflow?.saves));
  const casterSide = disposition(workflow?.token);
  return collectionValues(workflow?.targets).filter(token => (
    (casterSide !== undefined && disposition(token) === casterSide) || !saved.has(token)
  ));
}

// A sheet copy of the spell may lack Midi's auto-fail for friendly targets and
// may carry its own Enlarge/Reduce effects. For this casting, allies fail the
// save on purpose and Midi applies no effect of its own: this automation
// places the only one.
export async function willingAllies({workflow}, deps = defaultDeps) {
  const activity = workflow?.activity;
  if (activity?.type !== 'save') return undefined;
  const hasEffects = collectionValues(activity.effects).length > 0;
  if (activity.midiProperties?.autoFailFriendly && !hasEffects) return undefined;
  const data = activity.toObject();
  data.midiProperties = {...data.midiProperties, autoFailFriendly: true};
  data.effects = [];
  deps.workflowUtils.setActivity(workflow, data);
  return undefined;
}

// Effects the same spell item placed on its own (an effect attached to the
// activity), which would stack with this one: recognised by origin or by the
// name of one of the item's effects.
export function duplicateEffects(actor, item, keep = []) {
  const kept = new Set(keep.filter(Boolean).map(effect => effect.id));
  const names = new Set(collectionValues(item?.effects).map(effect => effect.name));
  return collectionValues(actor?.effects).filter(effect => (
    !kept.has(effect.id)
    && effect.flags?.cat?.identifier !== EFFECT
    && (String(effect.origin ?? '').startsWith(item.uuid) || names.has(effect.name))
  ));
}

export function tokenSize(size) {
  return SQUARES[size];
}

export async function castEnlargeReduce({document: item, workflow}, deps = defaultDeps) {
  const affected = affectedTargets(workflow);
  if (!affected.length) return undefined;
  const mode = await chooseMode(item, workflow.activity, deps);
  if (!mode) return undefined;
  const concentration = deps.effectUtils.getConcentrationEffect(workflow.actor, item);
  for (const target of affected) {
    const token = target.document ?? target;
    const actor = token.actor ?? target.actor;
    if (!actor) continue;
    const previous = deps.actorUtils.getEffectByIdentifier(actor, EFFECT);
    const original = previous?.flags?.[MODULE_ID]?.[EFFECT] ?? {width: token.width, height: token.height};
    const size = resized(actor.system?.traits?.size, mode);
    const effectData = deps.documentUtils.getBaseEffectData(item, {
      name: `${item.name}: ${localize(mode === 'enlarge' ? 'GAC.EnlargeReduce.Enlarge' : 'GAC.EnlargeReduce.Reduce')}`,
      img: item.img,
      origin: item.uuid,
      identifier: EFFECT,
      duration: {seconds: 60},
      parentEntity: concentration,
      changes: sizeChanges(actor, mode)
    });
    effectData.flags ??= {};
    effectData.flags[MODULE_ID] = {[EFFECT]: {tokenUuid: token.uuid, width: original.width, height: original.height}};
    // The new effect exists before the old one goes, so the old one's removal
    // doesn't restore the token size.
    const [effect] = await deps.effectUtils.createEffects(actor, [effectData]) ?? [];
    for (const duplicate of [previous, ...duplicateEffects(actor, item, [effect, previous, concentration])].filter(Boolean)) {
      await deps.documentUtils.deleteDocument(duplicate);
    }
    const squares = tokenSize(size);
    if (squares && token.uuid) await deps.documentUtils.update(token, {width: squares, height: squares});
  }
  return undefined;
}

// When the spell ends the token gets its size back, unless another casting
// still affects the creature.
export async function restoreTokenSize(effect, deps = defaultDeps) {
  const saved = effect?.flags?.[MODULE_ID]?.[EFFECT];
  if (effect?.flags?.cat?.identifier !== EFFECT || !saved?.tokenUuid) return false;
  if (deps.actorUtils.getEffectByIdentifier(effect.parent, EFFECT)) return false;
  const token = await deps.fromUuid(saved.tokenUuid);
  if (!token || !saved.width || !saved.height) return false;
  await deps.documentUtils.update(token, {width: saved.width, height: saved.height});
  return true;
}

export function registerEnlargeReduceCleanup(hooks = globalThis.Hooks) {
  return hooks.on('deleteActiveEffect', effect => {
    if (!globalThis.game?.user?.isActiveGM) return;
    void restoreTokenSize(effect).catch(error => console.error('goffredo-compendium | token size restore failed', error));
  });
}

export const enlargeReduce = {
  name: 'Enlarge/Reduce',
  version: '0.9.2',
  rules: RULESET,
  roll: [
    {pass: 'itemPreambleComplete', macro: willingAllies, priority: 50},
    {pass: 'itemRollFinished', macro: castEnlargeReduce, priority: 50}
  ]
};
