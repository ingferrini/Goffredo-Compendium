import {FLAGS, MODULE_ID, PACKS, RULESET} from '../constants.mjs';
import {
  actorUtils,
  compendiumUtils,
  dialogUtils,
  documentUtils,
  effectUtils,
  summonUtils,
  tokenUtils,
  workflowUtils
} from '../proxy.mjs';
import {withMoveToken} from '../token-move.mjs';
import {echoArmorClass, shouldDismissEcho} from './rules.mjs';
import {moveEchoVertically} from './movement.mjs';
import {clearEchoState, createEchoState, getEchoState, setEchoState} from './state.mjs';

// CAT dialogs render strings verbatim, so localize keys before handing them over.
const localize = key => globalThis.game?.i18n?.localize?.(key) ?? key;

const defaultDeps = {
  actorUtils,
  compendiumUtils,
  dialogUtils,
  documentUtils,
  echoDistance,
  effectUtils,
  fromUuid: (...args) => globalThis.fromUuid(...args),
  hooks: {
    off: (...args) => globalThis.Hooks.off(...args),
    once: (...args) => globalThis.Hooks.once(...args)
  },
  notify: key => globalThis.ui?.notifications?.warn(globalThis.game?.i18n?.localize?.(key) ?? key),
  summonUtils,
  tokenUtils: withMoveToken(tokenUtils),
  workflowUtils
};

const controlActivities = [
  'manifestEchoAttack',
  'manifestEchoSwap',
  'manifestEchoElevation',
  'manifestEchoDismiss'
];
const ATTACK_ORIGIN_FLAG = 'flags.midi-qol.rangeOverride.attack.all';

function collectionValues(collection) {
  if (!collection) return [];
  if (typeof collection.values === 'function') return Array.from(collection.values());
  return Array.from(collection);
}

function hasMeleeAttack(item) {
  return collectionValues(item.system?.activities).some(activity => {
    if (activity.type !== 'attack') return false;
    const attackType = activity.attack?.type?.value;
    return attackType === 'melee' || (!attackType && item.system?.actionType?.startsWith('m'));
  });
}

function hasAttack(item) {
  return collectionValues(item.system?.activities).some(activity => activity.type === 'attack');
}

function position(token) {
  return {x: token.x, y: token.y, elevation: token.elevation};
}

function validPosition(value) {
  return ['x', 'y', 'elevation'].every(key => Number.isFinite(Number(value[key])));
}

async function echoTokenFor(actor, deps) {
  const state = getEchoState(actor);
  if (!state?.tokenUuid) return undefined;
  return deps.fromUuid(state.tokenUuid);
}

function attackOriginEffect(item) {
  return {
    name: item.name,
    img: item.img,
    origin: item.uuid,
    duration: {seconds: 1},
    changes: [{key: ATTACK_ORIGIN_FLAG, type: 'custom', value: 1, priority: 20}]
  };
}

function forceEchoOrigin(midiWorkflow, echoToken) {
  midiWorkflow.attackingToken = echoToken.object ?? echoToken;
  midiWorkflow.tokenId = echoToken.id;
  midiWorkflow.tokenUuid = echoToken.uuid;
  midiWorkflow.speaker = {
    ...midiWorkflow.speaker,
    scene: echoToken.parent?.id,
    token: echoToken.id
  };
}

// The attack-origin effect switches off Midi's own range check, so reach is
// enforced here from the echo's space, always counting height difference.
function echoDistance(echoToken, target) {
  const from = echoToken.object ?? echoToken;
  const to = target.object ?? target;
  return globalThis.MidiQOL.computeDistance(from, to, {wallsBlock: false, includeCover: false, includeElevation: true});
}

export function attackRange(item) {
  const activity = collectionValues(item.system?.activities).find(entry => entry.type === 'attack');
  const range = activity?.range ?? item.system?.range ?? {};
  if (hasMeleeAttack(item)) {
    const reach = Number(range.reach ?? item.system?.range?.reach);
    return Number.isFinite(reach) && reach > 0 ? reach : 5;
  }
  const long = Number(range.long);
  const normal = Number(range.value);
  if (Number.isFinite(long) && long > 0) return long;
  return Number.isFinite(normal) && normal > 0 ? normal : Infinity;
}

export function eligibleEchoAttacks(actor, {meleeOnly = false} = {}) {
  return collectionValues(actor?.items).filter(item => (
    item.type === 'weapon'
    && item.system?.equipped === true
    && (meleeOnly ? hasMeleeAttack(item) : hasAttack(item))
  ));
}

function echoName(actor) {
  if (globalThis.game?.i18n?.format) return game.i18n.format('GAC.Echo.Name', {name: actor.name});
  return `Echo of ${actor.name}`;
}

function abilityModifier(score) {
  return Math.floor((Number(score) - 10) / 2);
}

function saveTotal(ability) {
  const save = ability?.save;
  const value = Number(typeof save === 'object' ? save?.value : save);
  return Number.isFinite(value) ? value : abilityModifier(ability?.value ?? 10);
}

// The echo rolls saves with its owner's bonuses: copy the scores and fold the
// owner's full save total into a flat bonus, so the echo's own proficiency never applies.
export function echoAbilities(ownerAbilities = {}) {
  return Object.fromEntries(Object.entries(ownerAbilities).map(([key, ability]) => {
    const value = Number(ability?.value) || 10;
    return [key, {
      value,
      proficient: 0,
      bonuses: {check: '', save: String(saveTotal(ability) - abilityModifier(value))}
    }];
  }));
}

// CAT merges these updates straight into the source actor data, so they are
// actor-shaped; the placed token comes from the linked prototype token.
export function summonUpdates(workflow, name) {
  const actor = workflow.actor;
  const token = workflow.token.document;
  const tokenImage = token.texture?.src ?? actor.prototypeToken?.texture?.src;
  return {
    name,
    system: {
      abilities: echoAbilities(actor.system.abilities),
      attributes: {
        ac: {calc: 'flat', flat: echoArmorClass(actor.system.attributes.prof)},
        hp: {value: 1, max: 1},
        senses: actor.system.attributes.senses
      },
      traits: {size: actor.system.traits.size}
    },
    prototypeToken: {
      name,
      width: token.width,
      height: token.height,
      sight: actor.prototypeToken.sight,
      texture: {src: tokenImage}
    }
  };
}

export async function dismissEcho({workflow}, deps = defaultDeps) {
  const marker = deps.actorUtils.getEffectByIdentifier(workflow.actor, 'manifestEcho');
  if (marker) await deps.documentUtils.deleteDocument(marker);
  await clearEchoState(workflow.actor);
}

export async function summonEcho({item, workflow}, deps = defaultDeps) {
  await dismissEcho({workflow}, deps);
  const sourceActor = await deps.compendiumUtils.getDocumentByIdentifier(PACKS.summons, 'manifestEcho');
  if (!sourceActor) return undefined;

  const effectData = deps.documentUtils.getBaseEffectData(item, {
    name: item.name,
    img: item.img,
    origin: item.uuid,
    identifier: 'manifestEcho',
    activityUuid: workflow.activity.uuid,
    unhideActivities: controlActivities,
    unhideActivitiesFavorite: true,
    macros: [{
      type: 'combat',
      macros: [{source: MODULE_ID, rules: RULESET, identifier: 'manifest-echo'}]
    }]
  });
  effectData.flags ??= {};
  effectData.flags[MODULE_ID] = {itemUuid: item.uuid};
  const [marker] = await deps.effectUtils.createEffects(workflow.actor, [effectData]);
  if (!marker) return undefined;

  const name = echoName(workflow.actor);
  const summon = await deps.summonUtils.createSummon(workflow.actor, sourceActor, {
    name,
    disposition: workflow.token.document.disposition,
    parent: marker,
    sourceDocument: item,
    updates: summonUpdates(workflow, name)
  });
  if (!summon) {
    await deps.documentUtils.deleteDocument(marker);
    return undefined;
  }

  const [placed] = await deps.summonUtils.placeSummons([summon], 15, {token: workflow.token.document}) ?? [];
  const echoToken = placed ?? summon.token;
  if (!echoToken) {
    await deps.documentUtils.deleteDocument(marker);
    await clearEchoState(workflow.actor);
    return undefined;
  }

  await echoToken.setFlag(FLAGS.scope, FLAGS.echo, {ownerActorUuid: workflow.actor.uuid});
  await setEchoState(workflow.actor, createEchoState({
    ownerActorUuid: workflow.actor.uuid,
    itemUuid: item.uuid,
    tokenUuid: echoToken.uuid,
    sceneId: echoToken.parent?.id
  }));
  return summon;
}

export async function attackFromEcho({item, workflow, meleeOnly = false, checkRange = true}, deps = defaultDeps) {
  const echoToken = await echoTokenFor(workflow.actor, deps);
  if (!echoToken) {
    deps.notify('GAC.Echo.NoActive');
    return undefined;
  }

  if (!workflow.targets?.size) {
    deps.notify('GAC.Echo.ChooseTarget');
    return undefined;
  }

  const attacks = eligibleEchoAttacks(workflow.actor, {meleeOnly});
  if (!attacks.length) {
    deps.notify('GAC.Echo.NoAttack');
    return undefined;
  }
  const selected = await deps.dialogUtils.selectDocumentDialog(
    item.name,
    localize('GAC.Echo.ChooseAttack'),
    attacks,
    {sort: 'alphabetical'}
  );
  if (!selected) return undefined;

  if (checkRange) {
    const range = attackRange(selected);
    const outOfRange = Array.from(workflow.targets).some(target => {
      const distance = deps.echoDistance(echoToken, target);
      return distance < 0 || distance > range;
    });
    if (outOfRange) {
      deps.notify('GAC.Echo.OutOfRange');
      return undefined;
    }
  }

  const effects = [];
  const hookName = `midi-qol.preambleComplete.${selected.uuid}`;
  let hookRan = false;
  const hookId = deps.hooks.once(hookName, midiWorkflow => {
    hookRan = true;
    forceEchoOrigin(midiWorkflow, echoToken);
  });

  try {
    const data = deps.documentUtils.getBaseEffectData(item, attackOriginEffect(item));
    const [ownerEffect] = await deps.effectUtils.createEffects(workflow.actor, [data]);
    if (ownerEffect) effects.push(ownerEffect);
    const [echoEffect] = await deps.effectUtils.createEffects(echoToken.actor, [data]);
    if (echoEffect) effects.push(echoEffect);
    if (!ownerEffect || !echoEffect) return undefined;
    await deps.documentUtils.makeDependent(ownerEffect, [echoEffect]);
    return await deps.workflowUtils.syntheticItemRoll(selected, Array.from(workflow.targets ?? []));
  } finally {
    if (!hookRan) deps.hooks.off(hookName, hookId);
    await Promise.allSettled(effects.map(effect => deps.documentUtils.deleteDocument(effect)));
  }
}

export async function swapWithEcho({workflow}, deps = defaultDeps) {
  const ownerToken = workflow.token?.document;
  const echoToken = await echoTokenFor(workflow.actor, deps);
  if (!ownerToken || !echoToken || ownerToken.parent?.id !== echoToken.parent?.id) {
    console.warn(`${MODULE_ID} | swap: no usable echo`, {
      state: getEchoState(workflow.actor), ownerToken, echoToken
    });
    deps.notify('GAC.Echo.NoActive');
    return false;
  }

  const ownerDestination = position(echoToken);
  const echoDestination = position(ownerToken);
  if (!validPosition(ownerDestination) || !validPosition(echoDestination)) {
    console.warn(`${MODULE_ID} | swap: invalid positions`, {ownerDestination, echoDestination});
    return false;
  }
  console.info(`${MODULE_ID} | swap`, {ownerDestination, echoDestination});

  const commonOptions = {
    constrainOptions: {ignoreCost: true, ignoreWalls: true},
    goffredoCompendium: {ignoreEchoMovement: true},
    showRuler: false
  };
  await Promise.all([
    deps.tokenUtils.moveToken(
      ownerToken,
      [{...ownerDestination, action: 'displace'}],
      commonOptions
    ),
    deps.tokenUtils.moveToken(
      echoToken,
      [{...echoDestination, action: 'catForce'}],
      commonOptions
    )
  ]);
  return true;
}

export async function destroyEchoAtZeroHp(actor, changes, deps = defaultDeps) {
  const hp = changes?.system?.attributes?.hp?.value;
  if (hp === undefined || Number(hp) > 0) return false;
  const echoToken = actor?.token ?? actor?.getActiveTokens?.(false, true)?.[0];
  const ownerActorUuid = echoToken?.getFlag?.(FLAGS.scope, FLAGS.echo)?.ownerActorUuid;
  const owner = ownerActorUuid ? await deps.fromUuid(ownerActorUuid) : undefined;
  if (!owner) return false;
  await dismissEcho({workflow: {actor: owner}}, deps);
  return true;
}

export async function checkEchoRange({document: effect, token}, deps = defaultDeps) {
  const actor = effect?.parent;
  const echoToken = actor ? await echoTokenFor(actor, deps) : undefined;
  if (!actor || !echoToken) {
    if (effect) await deps.documentUtils.deleteDocument(effect);
    if (actor) await clearEchoState(actor);
    return Boolean(effect);
  }
  if (!shouldDismissEcho(deps.tokenUtils.getDistance(token, echoToken))) return false;
  await deps.documentUtils.deleteDocument(effect);
  await clearEchoState(actor);
  deps.notify('GAC.Echo.TooFar');
  return true;
}

async function onRollFinished({document: item, workflow}) {
  console.info(`${MODULE_ID} | Manifest Echo activity`, workflow.activity?.identifier);
  switch (workflow.activity.identifier) {
    case 'manifestEcho':
      return summonEcho({item, workflow});
    case 'manifestEchoAttack':
      return attackFromEcho({item, workflow});
    case 'manifestEchoSwap':
      return swapWithEcho({item, workflow});
    case 'manifestEchoElevation':
      return moveEchoVertically({item, workflow});
    case 'manifestEchoDismiss':
      return dismissEcho({item, workflow});
    default:
      return undefined;
  }
}

export const manifestEcho = {
  name: 'Manifest Echo',
  version: '0.2.0',
  rules: RULESET,
  roll: [{pass: 'itemRollFinished', macro: onRollFinished, priority: 50}],
  combat: [{pass: 'actorTurnEnd', macro: checkEchoRange, priority: 50}]
};
