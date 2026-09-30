import {MODULE_ID, RULESET} from '../constants.mjs';
import {actorUtils, documentUtils, effectUtils, workflowUtils} from '../proxy.mjs';

const EFFECT = 'vampiricTouch';
const TOUCH = 'vampiricTouchAttack';
const BASE_LEVEL = 3;

const defaultDeps = {actorUtils, documentUtils, effectUtils, workflowUtils};

// Necrotic damage the attack actually dealt, after resistances.
export function necroticDealt(damageList = []) {
  return damageList.reduce((sum, entry) => sum + (entry.damageDetail ?? [])
    .filter(detail => detail.type === 'necrotic')
    .reduce((subtotal, detail) => subtotal + Math.max(0, Number(detail.value) || 0), 0), 0);
}

async function drainLife(workflow, deps) {
  const healing = Math.floor(necroticDealt(workflow.damageList) / 2);
  const token = workflow.token?.document ?? workflow.token;
  if (healing > 0 && token) await deps.workflowUtils.applyDamage([token], healing, 'healing');
}

// The casting is the first touch; while concentration lasts, the repeat touch
// is revealed and remembers the slot level.
async function startSpell(item, workflow, deps) {
  const previous = deps.actorUtils.getEffectByIdentifier(workflow.actor, EFFECT);
  if (previous) await deps.documentUtils.deleteDocument(previous);
  const concentration = deps.effectUtils.getConcentrationEffect(workflow.actor, item);
  const effectData = deps.documentUtils.getBaseEffectData(item, {
    name: item.name,
    img: item.img,
    origin: item.uuid,
    identifier: EFFECT,
    duration: {seconds: 60},
    activityUuid: workflow.activity.uuid,
    unhideActivities: [TOUCH],
    favoriteActivities: true,
    parentEntity: concentration
  });
  effectData.flags ??= {};
  effectData.flags[MODULE_ID] = {[EFFECT]: {castLevel: deps.workflowUtils.getCastLevel(workflow) ?? BASE_LEVEL}};
  await deps.effectUtils.createEffects(workflow.actor, [effectData]);
}

export async function vampiricRollFinished({document: item, workflow}, deps = defaultDeps) {
  const identifier = workflow?.activity?.identifier;
  if (identifier !== EFFECT && identifier !== TOUCH) return undefined;
  if (identifier === EFFECT) await startSpell(item, workflow, deps);
  await drainLife(workflow, deps);
  return undefined;
}

// A repeat touch keeps the damage of the slot the spell was cast with.
export async function upcastTouch({workflow}, deps = defaultDeps) {
  if (workflow?.activity?.identifier !== TOUCH) return undefined;
  const effect = deps.actorUtils.getEffectByIdentifier(workflow.actor, EFFECT);
  const castLevel = effect?.flags?.[MODULE_ID]?.[EFFECT]?.castLevel ?? BASE_LEVEL;
  if (castLevel <= BASE_LEVEL) return undefined;
  await deps.workflowUtils.bonusDamage(workflow, `${castLevel - BASE_LEVEL}d6`, {damageType: 'necrotic'});
  return undefined;
}

export const vampiricTouch = {
  name: 'Vampiric Touch',
  version: '0.9.0',
  rules: RULESET,
  roll: [
    {pass: 'itemDamageRollComplete', macro: upcastTouch, priority: 50},
    {pass: 'itemRollFinished', macro: vampiricRollFinished, priority: 50}
  ]
};
