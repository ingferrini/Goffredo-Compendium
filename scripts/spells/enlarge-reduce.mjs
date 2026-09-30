import {RULESET} from '../constants.mjs';
import {actorUtils, dialogUtils, documentUtils, effectUtils} from '../proxy.mjs';
import {collectionValues, localize} from '../shared/foundry.mjs';

const EFFECT = 'enlargeReduce';
const SIZES = ['tiny', 'sm', 'med', 'lg', 'huge', 'grg'];
// Grid squares a creature of each size occupies.
const SQUARES = {tiny: 0.5, sm: 1, med: 1, lg: 2, huge: 3, grg: 4};

const defaultDeps = {actorUtils, dialogUtils, documentUtils, effectUtils};

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
// and saves, and +1d4 or -1d4 on weapon damage. The token is resized through
// Active Token Effects when it is active.
export function sizeChanges(actor, mode) {
  const size = resized(actor?.system?.traits?.size, mode);
  const roll = mode === 'enlarge' ? 'advantage' : 'disadvantage';
  const damage = mode === 'enlarge' ? '+1d4' : '-1d4';
  const changes = [
    change('system.traits.size', size),
    change(`flags.midi-qol.${roll}.ability.check.str`, 1, 'custom'),
    change(`flags.midi-qol.${roll}.ability.save.str`, 1, 'custom'),
    change('system.bonuses.mwak.damage', damage, 'add'),
    change('system.bonuses.rwak.damage', damage, 'add')
  ];
  if (SQUARES[size]) changes.push(change('ATL.width', SQUARES[size]), change('ATL.height', SQUARES[size]));
  return changes;
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

export async function castEnlargeReduce({document: item, workflow}, deps = defaultDeps) {
  const affected = affectedTargets(workflow);
  if (!affected.length) return undefined;
  const mode = await chooseMode(item, workflow.activity, deps);
  if (!mode) return undefined;
  const concentration = deps.effectUtils.getConcentrationEffect(workflow.actor, item);
  for (const token of affected) {
    const actor = token.actor ?? token.document?.actor;
    if (!actor) continue;
    const previous = deps.actorUtils.getEffectByIdentifier(actor, EFFECT);
    if (previous) await deps.documentUtils.deleteDocument(previous);
    const effectData = deps.documentUtils.getBaseEffectData(item, {
      name: `${item.name}: ${localize(mode === 'enlarge' ? 'GAC.EnlargeReduce.Enlarge' : 'GAC.EnlargeReduce.Reduce')}`,
      img: item.img,
      origin: item.uuid,
      identifier: EFFECT,
      duration: {seconds: 60},
      parentEntity: concentration,
      changes: sizeChanges(actor, mode)
    });
    await deps.effectUtils.createEffects(actor, [effectData]);
  }
  return undefined;
}

export const enlargeReduce = {
  name: 'Enlarge/Reduce',
  version: '0.9.0',
  rules: RULESET,
  roll: [{pass: 'itemRollFinished', macro: castEnlargeReduce, priority: 50}]
};
