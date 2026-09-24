import {RULESET} from '../constants.mjs';
import {actorUtils, documentUtils, effectUtils} from '../proxy.mjs';
import {collectionValues, localize} from '../shared/foundry.mjs';

const EFFECT = 'piumaReginaCorvo';

const defaultDeps = {actorUtils, documentUtils, effectUtils};

export function isEvil(actor) {
  const alignment = String(actor?.system?.details?.alignment ?? '').toLowerCase();
  return /evil|malvag/.test(alignment);
}

export async function activateFeather({document: item, workflow}, deps = defaultDeps) {
  if (workflow?.activity?.identifier !== EFFECT) return undefined;
  const existing = deps.actorUtils.getEffectByIdentifier(workflow.actor, EFFECT);
  if (existing) await deps.documentUtils.deleteDocument(existing);
  const effectData = deps.documentUtils.getBaseEffectData(item, {
    name: item.name,
    img: item.img,
    origin: item.uuid,
    identifier: EFFECT,
    duration: {turns: 1}
  });
  // DAE ends the effect when the owner's turn ends.
  effectData.flags ??= {};
  effectData.flags.dae = {...effectData.flags.dae, specialDuration: ['turnEnd']};
  await deps.effectUtils.createEffects(workflow.actor, [effectData]);
  return undefined;
}

export async function featherAdvantage({document: item, workflow}, deps = defaultDeps) {
  if (!deps.actorUtils.getEffectByIdentifier(workflow?.actor, EFFECT)) return undefined;
  const targets = collectionValues(workflow.targets).map(token => token.document ?? token);
  if (!targets.length || !targets.every(target => isEvil(target.actor))) return undefined;
  workflow.tracker?.advantage?.add(item.name, localize('GAC.Piuma.Reason'));
  return undefined;
}

export async function endFeather({document: item}, deps = defaultDeps) {
  const effect = deps.actorUtils.getEffectByIdentifier(item?.actor, EFFECT);
  if (effect) await deps.documentUtils.deleteDocument(effect);
  return undefined;
}

export const piumaReginaCorvo = {
  name: 'Piuma Metallica della Regina Corvo',
  version: '0.2.0',
  rules: RULESET,
  roll: [
    {pass: 'itemRollFinished', macro: activateFeather, priority: 50},
    {pass: 'actorAttackRollConfig', macro: featherAdvantage, priority: 50}
  ],
  combat: [{pass: 'actorTurnEnd', macro: endFeather, priority: 50}]
};
