import {MODULE_ID, PACKS, RULESET} from '../constants.mjs';
import {
  actorUtils,
  compendiumUtils,
  documentUtils,
  effectUtils,
  summonUtils
} from '../proxy.mjs';
import {echoArmorClass} from './rules.mjs';
import {clearEchoState, createEchoState, setEchoState} from './state.mjs';

const defaultDeps = {
  actorUtils,
  compendiumUtils,
  documentUtils,
  effectUtils,
  summonUtils
};

const controlActivities = ['manifestEchoAttack', 'manifestEchoSwap', 'manifestEchoDismiss'];

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

async function onRollFinished({document: item, workflow}) {
  switch (workflow.activity.identifier) {
    case 'manifestEcho':
      return summonEcho({item, workflow});
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
  roll: [{pass: 'itemRollFinished', macro: onRollFinished, priority: 50}]
};
