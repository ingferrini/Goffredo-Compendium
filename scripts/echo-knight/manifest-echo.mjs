import {MODULE_ID, PACKS, RULESET} from '../constants.mjs';
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
import {echoArmorClass, shouldDismissEcho} from './rules.mjs';
import {clearEchoState, createEchoState, getEchoState, setEchoState} from './state.mjs';

const defaultDeps = {
  actorUtils,
  compendiumUtils,
  dialogUtils,
  documentUtils,
  effectUtils,
  fromUuid: (...args) => globalThis.fromUuid(...args),
  hooks: {
    off: (...args) => globalThis.Hooks.off(...args),
    once: (...args) => globalThis.Hooks.once(...args)
  },
  notify: key => globalThis.ui?.notifications?.warn(globalThis.game?.i18n?.localize?.(key) ?? key),
  summonUtils,
  tokenUtils,
  workflowUtils
};

const controlActivities = ['manifestEchoAttack', 'manifestEchoSwap', 'manifestEchoDismiss'];
const ATTACK_ORIGIN_FLAG = 'flags.midi-qol.rangeOverride.attack.all';
const SWAP_COST = 15;

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

function position(token) {
  return {x: token.x, y: token.y, elevation: token.elevation};
}

function validPosition(value) {
  return ['x', 'y', 'elevation'].every(key => Number.isFinite(Number(value[key])));
}

function movementSpent(token) {
  return collectionValues(token.movementHistory).reduce((total, waypoint) => {
    const cost = Number(waypoint.cost);
    return total + (Number.isFinite(cost) ? cost : 0);
  }, 0);
}

function movementSpeed(token) {
  const speeds = token.actor?.system?.attributes?.movement ?? {};
  const selected = Number(speeds[token.movementAction]);
  if (Number.isFinite(selected) && selected > 0) return selected;
  return Math.max(0, ...Object.values(speeds).map(Number).filter(Number.isFinite));
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

export function eligibleEchoAttacks(actor) {
  return collectionValues(actor?.items).filter(item => (
    item.type === 'weapon'
    && item.system?.equipped === true
    && hasMeleeAttack(item)
  ));
}

function echoName(actor) {
  if (globalThis.game?.i18n?.format) return game.i18n.format('GAC.Echo.Name', {name: actor.name});
  return `Echo of ${actor.name}`;
}

function summonUpdates(workflow, name) {
  const actor = workflow.actor;
  const token = workflow.token.document;
  const tokenImage = token.texture?.src ?? actor.prototypeToken?.texture?.src;
  return {
    actor: {
      name,
      system: {
        abilities: actor.system.abilities,
        attributes: {
          ac: {calc: 'flat', flat: echoArmorClass(actor.system.attributes.prof)},
          hp: {value: 1, max: 1},
          senses: actor.system.attributes.senses
        },
        details: {type: actor.system.details.type},
        traits: {size: actor.system.traits.size}
      },
      prototypeToken: {
        name,
        width: token.width,
        height: token.height,
        sight: actor.prototypeToken.sight,
        texture: {src: tokenImage}
      }
    },
    token: {
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

  await deps.summonUtils.placeSummons([summon], 15, {token: workflow.token.document});
  if (!summon.token) {
    await deps.documentUtils.deleteDocument(marker);
    await clearEchoState(workflow.actor);
    return undefined;
  }

  await setEchoState(workflow.actor, createEchoState({
    ownerActorUuid: workflow.actor.uuid,
    itemUuid: item.uuid,
    tokenUuid: summon.token.uuid,
    sceneId: summon.token.parent?.id
  }));
  return summon;
}

export async function attackFromEcho({item, workflow}, deps = defaultDeps) {
  const echoToken = await echoTokenFor(workflow.actor, deps);
  if (!echoToken) {
    deps.notify('GAC.Echo.NoActive');
    return undefined;
  }

  const attacks = eligibleEchoAttacks(workflow.actor);
  if (!attacks.length) {
    deps.notify('GAC.Echo.NoAttack');
    return undefined;
  }
  const selected = await deps.dialogUtils.selectDocumentDialog(
    item.name,
    'GAC.Echo.ChooseAttack',
    attacks,
    {sort: 'alphabetical'}
  );
  if (!selected) return undefined;

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
    deps.notify('GAC.Echo.NoActive');
    return false;
  }

  if ((movementSpeed(ownerToken) - movementSpent(ownerToken)) < SWAP_COST) {
    deps.notify('GAC.Echo.NotEnoughMovement');
    return false;
  }

  const ownerDestination = position(echoToken);
  const echoDestination = position(ownerToken);
  if (!validPosition(ownerDestination) || !validPosition(echoDestination)) return false;

  const commonOptions = {
    constrainOptions: {ignoreCost: true, ignoreWalls: true},
    goffredoCompendium: {ignoreEchoMovement: true},
    showRuler: false
  };
  await Promise.all([
    deps.tokenUtils.moveToken(
      ownerToken,
      [{...ownerDestination, action: 'displace'}],
      {...commonOptions, measureOptions: {cost: () => SWAP_COST}}
    ),
    deps.tokenUtils.moveToken(
      echoToken,
      [{...echoDestination, action: 'catForce'}],
      {...commonOptions, measureOptions: {cost: () => 0}}
    )
  ]);
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
  return true;
}

async function onRollFinished({document: item, workflow}) {
  switch (workflow.activity.identifier) {
    case 'manifestEcho':
      return summonEcho({item, workflow});
    case 'manifestEchoAttack':
      return attackFromEcho({item, workflow});
    case 'manifestEchoSwap':
      return swapWithEcho({item, workflow});
    case 'manifestEchoDismiss':
      return dismissEcho({item, workflow});
    default:
      return undefined;
  }
}

export const manifestEcho = {
  name: 'Manifest Echo',
  version: '0.1.0',
  rules: RULESET,
  roll: [{pass: 'itemRollFinished', macro: onRollFinished, priority: 50}],
  combat: [{pass: 'actorTurnEnd', macro: checkEchoRange, priority: 50}]
};
