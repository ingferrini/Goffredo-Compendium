import {FLAGS, MODULE_ID, PACKS, RULESET} from '../constants.mjs';
import {
  actorUtils,
  compendiumUtils,
  documentUtils,
  effectUtils,
  summonUtils,
  tokenUtils
} from '../proxy.mjs';
import {forceTokenOrigin, notify, tokenDistance} from '../shared/foundry.mjs';

const MIND_RANGE = 60;
const MIND_LEASH = 300;
const MARKER = 'manifestMind';
const CAST_MARKER = 'manifestMindCast';
const ATTACK_ORIGIN_FLAG = 'flags.midi-qol.rangeOverride.attack.all';
const controlActivities = ['manifestMindCast', 'manifestMindMove', 'manifestMindDismiss'];

const defaultDeps = {
  actorUtils,
  compendiumUtils,
  documentUtils,
  effectUtils,
  fromUuid: (...args) => globalThis.fromUuid(...args),
  notify,
  summonUtils,
  tokenDistance,
  tokenUtils,
  userTargets: () => Array.from(globalThis.game?.user?.targets ?? [])
};

function mindName(actor) {
  if (globalThis.game?.i18n?.format) return game.i18n.format('GAC.Mind.Name', {name: actor.name});
  return `Spectral Mind of ${actor.name}`;
}

// The mind token is recorded on the owner at summon time; CAT's summon lookup
// can return a stale summon without a token.
export async function mindTokenFor(actor, deps = defaultDeps) {
  const tokenUuid = actor?.getFlag?.(FLAGS.scope, FLAGS.mind)?.tokenUuid;
  return tokenUuid ? deps.fromUuid(tokenUuid) : undefined;
}

export function isWizardSpell(item) {
  if (item?.type !== 'spell') return false;
  const sourceClass = item.system?.sourceClass ?? item.system?.classIdentifier;
  return !sourceClass || sourceClass === 'wizard';
}

// Range in feet a spell reaches from its origin; undefined when range does not apply.
export function spellRange(activity) {
  const range = activity?.range ?? {};
  if (range.units === 'touch') return 5;
  if (range.units !== 'ft') return undefined;
  const value = Number(range.value);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export async function dismissMind({workflow}, deps = defaultDeps) {
  const marker = deps.actorUtils.getEffectByIdentifier(workflow.actor, MARKER);
  if (marker) await deps.documentUtils.deleteDocument(marker);
  await workflow.actor?.unsetFlag?.(FLAGS.scope, FLAGS.mind);
  return Boolean(marker);
}

export async function summonMind({item, workflow}, deps = defaultDeps) {
  await dismissMind({workflow}, deps);
  const sourceActor = await deps.compendiumUtils.getDocumentByIdentifier(PACKS.summons, MARKER);
  if (!sourceActor) return undefined;

  const effectData = deps.documentUtils.getBaseEffectData(item, {
    name: item.name,
    img: item.img,
    origin: item.uuid,
    identifier: MARKER,
    activityUuid: workflow.activity.uuid,
    unhideActivities: controlActivities,
    unhideActivitiesFavorite: true,
    macros: [{
      type: 'combat',
      macros: [{source: MODULE_ID, rules: RULESET, identifier: 'manifest-mind'}]
    }]
  });
  const [marker] = await deps.effectUtils.createEffects(workflow.actor, [effectData]);
  if (!marker) return undefined;

  const name = mindName(workflow.actor);
  const summon = await deps.summonUtils.createSummon(workflow.actor, sourceActor, {
    name,
    disposition: workflow.token.document.disposition,
    parent: marker,
    sourceDocument: item,
    updates: {name, prototypeToken: {name}}
  });
  if (!summon) {
    await deps.documentUtils.deleteDocument(marker);
    return undefined;
  }

  const [placed] = await deps.summonUtils.placeSummons([summon], MIND_RANGE, {token: workflow.token.document}) ?? [];
  const mindToken = placed ?? summon.token;
  if (!mindToken) {
    await deps.documentUtils.deleteDocument(marker);
    return undefined;
  }
  await workflow.actor.setFlag(FLAGS.scope, FLAGS.mind, {schema: 1, tokenUuid: mindToken.uuid});
  return summon;
}

export async function moveMind({workflow}, deps = defaultDeps) {
  const mindToken = await mindTokenFor(workflow.actor, deps);
  if (!mindToken) {
    deps.notify('GAC.Mind.NoActive');
    return false;
  }
  // Crosshair within 30 feet of the mind; walls block it, creatures do not.
  await deps.tokenUtils.displaceToken(mindToken, {sourceToken: mindToken, range: 30});
  return true;
}

// Arms the next wizard spell: both the caster and the mind carry Midi's range
// override, so Midi measures range from whichever of them reaches the target.
export async function armCastFromMind({item, workflow}, deps = defaultDeps) {
  const mindToken = await mindTokenFor(workflow.actor, deps);
  if (!mindToken) {
    deps.notify('GAC.Mind.NoActive');
    return false;
  }
  const effectData = deps.documentUtils.getBaseEffectData(item, {
    name: `${item.name}: ${globalThis.game?.i18n?.localize?.('GAC.Mind.CastLabel') ?? 'Cast'}`,
    img: item.img,
    origin: item.uuid,
    identifier: CAST_MARKER,
    duration: {seconds: 6},
    changes: [{key: ATTACK_ORIGIN_FLAG, type: 'custom', value: 1, priority: 20}]
  });
  const [casterEffect] = await deps.effectUtils.createEffects(workflow.actor, [effectData]);
  const [mindEffect] = await deps.effectUtils.createEffects(mindToken.actor, [effectData]);
  if (!casterEffect || !mindEffect) {
    await Promise.allSettled([casterEffect, mindEffect].filter(Boolean).map(effect => deps.documentUtils.deleteDocument(effect)));
    return false;
  }
  await deps.documentUtils.makeDependent(casterEffect, [mindEffect]);
  return true;
}

function armedFor(actor, deps) {
  return deps.actorUtils.getEffectByIdentifier(actor, CAST_MARKER);
}

function castsFromMind(activity, actor, deps) {
  const item = activity?.item;
  if (!isWizardSpell(item) || activity.activation?.type === 'reaction') return false;
  return Boolean(armedFor(actor, deps));
}

// Before any slot is spent: every current target must be in range of the mind.
export async function checkMindRange({activity, actor}, deps = defaultDeps) {
  if (!castsFromMind(activity, actor, deps)) return undefined;
  const mindToken = await mindTokenFor(actor, deps);
  if (!mindToken) {
    deps.notify('GAC.Mind.NoActive');
    return true;
  }
  const range = spellRange(activity);
  if (range === undefined) return undefined;
  const outOfRange = deps.userTargets().some(target => {
    const distance = deps.tokenDistance(mindToken, target);
    return distance < 0 || distance > range;
  });
  if (!outOfRange) return undefined;
  deps.notify('GAC.Mind.OutOfRange');
  return true;
}

export async function castFromMind({workflow}, deps = defaultDeps) {
  if (!castsFromMind(workflow.activity, workflow.actor, deps)) return undefined;
  const mindToken = await mindTokenFor(workflow.actor, deps);
  const marker = armedFor(workflow.actor, deps);
  if (mindToken) await forceTokenOrigin(workflow, mindToken);
  // One armed use covers exactly one spell.
  await deps.documentUtils.deleteDocument(marker);
  return undefined;
}

export async function checkMindLeash({document: effect, token}, deps = defaultDeps) {
  const actor = effect?.parent;
  const mindToken = await mindTokenFor(actor, deps);
  if (!mindToken) {
    await deps.documentUtils.deleteDocument(effect);
    await actor?.unsetFlag?.(FLAGS.scope, FLAGS.mind);
    return true;
  }
  if (deps.tokenDistance(token, mindToken) <= MIND_LEASH) return false;
  await deps.documentUtils.deleteDocument(effect);
  await actor?.unsetFlag?.(FLAGS.scope, FLAGS.mind);
  deps.notify('GAC.Mind.TooFar');
  return true;
}

async function onRollFinished({document: item, workflow}) {
  switch (workflow.activity?.identifier) {
    case 'manifestMind':
    case 'manifestMindSlot':
      return summonMind({item, workflow});
    case 'manifestMindCast':
      return armCastFromMind({item, workflow});
    case 'manifestMindMove':
      return moveMind({item, workflow});
    case 'manifestMindDismiss':
      return dismissMind({workflow});
    default:
      return undefined;
  }
}

export const manifestMind = {
  name: 'Manifest Mind',
  version: '0.2.3',
  rules: RULESET,
  roll: [
    {pass: 'itemRollFinished', macro: onRollFinished, priority: 50},
    {pass: 'actorPreTargeting', macro: checkMindRange, priority: 50},
    {pass: 'actorPreambleComplete', macro: castFromMind, priority: 50}
  ],
  combat: [{pass: 'actorTurnEnd', macro: checkMindLeash, priority: 50}]
};
