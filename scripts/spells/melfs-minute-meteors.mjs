import {MODULE_ID, RULESET} from '../constants.mjs';
import {actorUtils, documentUtils, effectUtils, itemUtils, workflowUtils} from '../proxy.mjs';
import {notify} from '../shared/foundry.mjs';

const EFFECT = 'melfsMinuteMeteors';
const HURL = 'melfsMinuteMeteorsHurl';
const HURL_BONUS = 'melfsMinuteMeteorsHurlBonus';
const BASE_LEVEL = 3;
const PER_VOLLEY = 2;

const defaultDeps = {
  actorUtils,
  documentUtils,
  effectUtils,
  itemUtils,
  workflowUtils,
  combat: () => globalThis.game?.combat,
  fromUuid: (...args) => globalThis.fromUuid(...args)
};

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

// The volley that comes with the casting is free; every later one costs a bonus
// action. The free activity gives way to the bonus-action one once the casting
// turn is over, and the effect keeps whichever is shown so it is hidden again
// when the spell ends.
export async function switchToBonus(effect, item, deps = defaultDeps) {
  if (stateOf(effect).bonus) return false;
  await deps.documentUtils.update(effect, {
    'flags.cat.unhideActivities': [HURL_BONUS],
    [`flags.${MODULE_ID}.${EFFECT}.bonus`]: true
  });
  await deps.itemUtils.rehideActivities(item, [HURL], {favorite: true});
  await deps.itemUtils.unhideActivities(item, [HURL_BONUS], {favorite: true});
  return true;
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
    parentEntity: concentration,
    macros: [{type: 'combat', macros: [{source: MODULE_ID, rules: RULESET, identifier: 'melfs-minute-meteors'}]}]
  });
  // The casting itself opens the first volley.
  const turn = turnKey(deps.combat());
  effectData.flags ??= {};
  effectData.flags[MODULE_ID] = {[EFFECT]: {meteors, castTurn: turn, turn, thrown: 0, bonus: false}};
  await deps.effectUtils.createEffects(workflow.actor, [effectData]);
  return undefined;
}

// Blocks a hurl before the template is placed when no meteor is left, the
// volley for this turn is spent, or the free volley is used after the casting
// turn (a spell cast before combat began, for example).
export async function checkHurl({activity, actor}, deps = defaultDeps) {
  if (activity?.identifier !== HURL && activity?.identifier !== HURL_BONUS) return undefined;
  const effect = deps.actorUtils.getEffectByIdentifier(actor, EFFECT);
  const state = stateOf(effect);
  if (!effect || state.meteors <= 0) {
    notify('GAC.Meteors.NoneLeft');
    return true;
  }
  const turn = turnKey(deps.combat());
  if (activity.identifier === HURL && turn && state.castTurn !== turn) {
    await switchToBonus(effect, activity.item, deps);
    notify('GAC.Meteors.UseBonus');
    return true;
  }
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
    [`flags.${MODULE_ID}.${EFFECT}`]: {...state, meteors, turn, thrown}
  });
  return undefined;
}

// At the end of the caster's turn the free volley is over.
export async function endCastingTurn({document: effect}, deps = defaultDeps) {
  if (!effect || stateOf(effect).bonus) return undefined;
  const item = await deps.fromUuid(effect.origin);
  if (item) await switchToBonus(effect, item, deps);
  return undefined;
}

async function onRollFinished(trigger) {
  switch (trigger.workflow?.activity?.identifier) {
    case EFFECT:
      return castMeteors(trigger);
    case HURL:
    case HURL_BONUS:
      return hurlMeteor(trigger);
    default:
      return undefined;
  }
}

export const melfsMinuteMeteors = {
  name: "Melf's Minute Meteors",
  version: '0.8.1',
  rules: RULESET,
  roll: [
    {pass: 'itemPreTargeting', macro: checkHurl, priority: 50},
    {pass: 'itemRollFinished', macro: onRollFinished, priority: 50}
  ],
  combat: [{pass: 'actorTurnEnd', macro: endCastingTurn, priority: 50}]
};
