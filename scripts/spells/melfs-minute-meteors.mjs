import {MODULE_ID, RULESET} from '../constants.mjs';
import {actorUtils, documentUtils, effectUtils, workflowUtils} from '../proxy.mjs';
import {notify} from '../shared/foundry.mjs';

const EFFECT = 'melfsMinuteMeteors';
const HURL = 'melfsMinuteMeteorsHurl';
const BASE_LEVEL = 3;
const PER_VOLLEY = 2;

const defaultDeps = {actorUtils, documentUtils, effectUtils, workflowUtils, combat: () => globalThis.game?.combat};

// Six meteors at 3rd level, two more for each slot level above it.
export function meteorCount(castLevel) {
  return 6 + 2 * (Math.max(BASE_LEVEL, Number(castLevel) || BASE_LEVEL) - BASE_LEVEL);
}

// One or two meteors per casting or bonus action: in combat each turn is one
// volley; outside combat there is no turn to count.
export function turnKey(combat) {
  if (!combat?.started) return undefined;
  return `${combat.id}.${combat.round}.${combat.turn}`;
}

function meteorName(item, count) {
  return `${item.name} (${count})`;
}

function stateOf(effect) {
  return effect?.flags?.[MODULE_ID]?.[EFFECT] ?? {meteors: 0};
}

export async function castMeteors({document: item, workflow}, deps = defaultDeps) {
  const previous = deps.actorUtils.getEffectByIdentifier(workflow.actor, EFFECT);
  if (previous) await deps.documentUtils.deleteDocument(previous);
  const concentration = deps.effectUtils.getConcentrationEffect(workflow.actor, item);
  const meteors = meteorCount(deps.workflowUtils.getCastLevel(workflow));
  const effectData = deps.documentUtils.getBaseEffectData(item, {
    name: meteorName(item, meteors),
    img: item.img,
    origin: item.uuid,
    identifier: EFFECT,
    duration: {seconds: 600},
    activityUuid: workflow.activity.uuid,
    unhideActivities: [HURL],
    favoriteActivities: true,
    parentEntity: concentration
  });
  // The casting itself opens the first volley.
  effectData.flags ??= {};
  effectData.flags[MODULE_ID] ={[EFFECT]: {meteors, turn: turnKey(deps.combat()), thrown: 0}};
  await deps.effectUtils.createEffects(workflow.actor, [effectData]);
  return undefined;
}

// Blocks a hurl before the template is placed when no meteor is left or the
// volley for this turn is spent.
export async function checkHurl({activity, actor}, deps = defaultDeps) {
  if (activity?.identifier !== HURL) return undefined;
  const effect = deps.actorUtils.getEffectByIdentifier(actor, EFFECT);
  const state = stateOf(effect);
  if (!effect || state.meteors <= 0) {
    notify('GAC.Meteors.NoneLeft');
    return true;
  }
  const turn = turnKey(deps.combat());
  if (turn && state.turn === turn && state.thrown >= PER_VOLLEY) {
    notify('GAC.Meteors.VolleySpent');
    return true;
  }
  return undefined;
}

export async function hurlMeteor({document: item, workflow}, deps = defaultDeps) {
  const effect = deps.actorUtils.getEffectByIdentifier(workflow.actor, EFFECT);
  if (!effect) return undefined;
  const state = stateOf(effect);
  const meteors = Math.max(0, state.meteors - 1);
  if (meteors === 0) {
    // The spell ends once every meteor is spent.
    await deps.documentUtils.deleteDocument(effect);
    const concentration = deps.effectUtils.getConcentrationEffect(workflow.actor, item);
    if (concentration) await deps.documentUtils.deleteDocument(concentration);
    return undefined;
  }
  const turn = turnKey(deps.combat());
  const thrown = turn && state.turn === turn ? state.thrown + 1 : 1;
  await deps.documentUtils.update(effect, {
    name: meteorName(item, meteors),
    [`flags.${MODULE_ID}.${EFFECT}`]: {meteors, turn, thrown}
  });
  return undefined;
}

async function onRollFinished(trigger) {
  switch (trigger.workflow?.activity?.identifier) {
    case EFFECT:
      return castMeteors(trigger);
    case HURL:
      return hurlMeteor(trigger);
    default:
      return undefined;
  }
}

export const melfsMinuteMeteors = {
  name: "Melf's Minute Meteors",
  version: '0.8.0',
  rules: RULESET,
  roll: [
    {pass: 'itemPreTargeting', macro: checkHurl, priority: 50},
    {pass: 'itemRollFinished', macro: onRollFinished, priority: 50}
  ]
};
