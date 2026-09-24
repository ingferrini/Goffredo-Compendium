import {FLAGS} from '../constants.mjs';
import {attackFromEcho} from '../echo-knight/manifest-echo.mjs';
import {canSee, rollItem} from '../platform/midi.mjs';
import {collectionValues, isIncapacitated, localize} from '../shared/foundry.mjs';
import {getGeneralConfig, getReactionConfig} from './config.mjs';
import {requestReaction} from './prompt.mjs';
import {hasUsedReaction, markReactionUsed, publicName, withReactionReach} from './usage.mjs';

const POLEARMS = new Set(['glaive', 'halberd', 'pike', 'quarterstaff', 'spear']);
const TELEPORT_ACTIONS = new Set(['displace', 'blink', 'catForce']);
const DISPOSITIONS = {FRIENDLY: 1, HOSTILE: -1};

// ---------- pure helpers ----------

function attackActivity(item) {
  return collectionValues(item?.system?.activities).find(activity => activity.type === 'attack');
}

function isMeleeAttack(item) {
  const activity = attackActivity(item);
  if (!activity) return false;
  const attackType = activity.attack?.type?.value;
  if (attackType) return attackType === 'melee';
  return String(item.system?.type?.value ?? '').endsWith('M');
}

// PCs use equipped melee weapons. NPC natural attacks are often unequipped or
// imported as features, so every melee attack an NPC has counts.
export function isMeleeWeapon(item, actor = item?.actor) {
  if (!isMeleeAttack(item)) return false;
  if (actor?.type === 'npc') return item.type === 'weapon' || item.type === 'feat';
  return item.type === 'weapon' && item.system?.equipped === true;
}

export function weaponReach(item) {
  const range = attackActivity(item)?.range ?? item.system?.range ?? {};
  const reach = Number(range.reach ?? item.system?.range?.reach);
  return Number.isFinite(reach) && reach > 0 ? reach : 5;
}

export function meleeWeapons(actor) {
  return collectionValues(actor?.items).filter(item => isMeleeWeapon(item, actor));
}

export function isPolearm(item) {
  return POLEARMS.has(String(item?.system?.type?.baseItem ?? '').toLowerCase());
}

export function hasFeature(actor, identifier, name) {
  return collectionValues(actor?.items).some(item => (
    item.system?.identifier === identifier || item.name?.toLowerCase() === name.toLowerCase()
  ));
}

export function hasDisengaged(actor) {
  if (actor?.statuses?.has?.('disengage') || actor?.statuses?.has?.('disengaged')) return true;
  return collectionValues(actor?.appliedEffects ?? actor?.effects).some(effect => /disengage/i.test(effect.name ?? ''));
}

export function isHostilePair(a, b) {
  const first = Number(a?.disposition);
  const second = Number(b?.disposition);
  return (first === DISPOSITIONS.FRIENDLY && second <= DISPOSITIONS.HOSTILE)
    || (second === DISPOSITIONS.FRIENDLY && first <= DISPOSITIONS.HOSTILE);
}

export function isForcedOrTeleport(movement, operation) {
  if (operation?.forced || operation?.goffredoCompendium?.ignoreEchoMovement) return true;
  return (movement?.passed?.waypoints ?? []).some(waypoint => TELEPORT_ACTIONS.has(waypoint.action));
}

// Distance in scene units between two token footprints, 5e style: squares of gap plus one,
// taking the larger of the horizontal and vertical gaps (height counted like Midi).
export function footprintDistance(a, b, grid) {
  const size = Number(grid?.size) || 100;
  const unit = Number(grid?.distance) || 5;
  const box = token => ({
    x: Number(token.x) || 0,
    y: Number(token.y) || 0,
    w: (Number(token.width) || 1) * size,
    h: (Number(token.height) || 1) * size,
    bottom: Number(token.elevation) || 0,
    tall: (Number(token.width) || 1) * unit
  });
  const first = box(a);
  const second = box(b);
  const gapX = Math.max(0, first.x - (second.x + second.w), second.x - (first.x + first.w));
  const gapY = Math.max(0, first.y - (second.y + second.h), second.y - (first.y + first.h));
  const horizontal = Math.round(Math.max(gapX, gapY) / size) * unit;
  const [low, high] = first.bottom <= second.bottom ? [first, second] : [second, first];
  const vertical = Math.max(0, high.bottom - (low.bottom + low.tall));
  return Math.max(horizontal, vertical) + unit;
}

export function pathPoints(movement, token) {
  const dims = {width: token.width, height: token.height};
  const points = [movement?.origin, ...(movement?.passed?.waypoints ?? [])].filter(Boolean);
  return points.map(point => ({...dims, ...point}));
}

// 'leave' when the path goes from inside reach to outside, 'enter' when it comes inside.
export function reachEvent(distances, reach) {
  let wasInside = distances[0] <= reach;
  let entered = false;
  for (const value of distances.slice(1)) {
    const inside = value <= reach;
    if (wasInside && !inside) return {type: 'leave'};
    if (!wasInside && inside) entered = true;
    wasInside = inside;
  }
  return entered ? {type: 'enter'} : null;
}

export function lastInsidePoint(points, distances, reach) {
  let last;
  for (let index = 0; index < points.length; index += 1) {
    if (distances[index] <= reach) last = points[index];
    else if (last) break;
  }
  return last;
}

export function warCasterSpells(actor) {
  return collectionValues(actor?.items).filter(item => {
    if (item.type !== 'spell') return false;
    const system = item.system ?? {};
    const prepared = Number(system.level) === 0 || Number(system.prepared) > 0 || ['atwill', 'innate', 'pact', 'always'].includes(system.method);
    if (!prepared) return false;
    return collectionValues(system.activities).some(activity => (
      activity.activation?.type === 'action'
      && ['attack', 'save', 'damage'].includes(activity.type)
      && activity.target?.affects?.type !== 'self'
      && (Number(activity.target?.affects?.count) || 1) === 1
    ));
  });
}

// ---------- reactors ----------

function tokensOf(scene) {
  return collectionValues(scene?.tokens);
}

export function reactorsFor(mover, scene, deps) {
  return tokensOf(scene).flatMap(token => {
    if (token.id === mover.id || !token.actor) return [];
    const echo = token.getFlag?.(FLAGS.scope, FLAGS.echo);
    if (echo?.ownerActorUuid) {
      const owner = deps.fromUuidSync(echo.ownerActorUuid);
      const ownerToken = tokensOf(scene).find(other => other.actor?.uuid === owner?.uuid && !other.getFlag?.(FLAGS.scope, FLAGS.echo));
      if (!owner || !ownerToken) return [];
      return [{token, actor: owner, sightToken: ownerToken, disposition: ownerToken.disposition, isEcho: true}];
    }
    return [{token, actor: token.actor, sightToken: token, disposition: token.disposition, isEcho: false}];
  });
}

// ---------- engine ----------

const defaultDeps = {
  attackFromEcho,
  canSee,
  chat: content => globalThis.ChatMessage?.create?.({content}),
  fromUuidSync: uuid => globalThis.fromUuidSync?.(uuid),
  general: () => getGeneralConfig(),
  hasUsedReaction,
  isResponsibleGM: () => Boolean(globalThis.game?.user?.isActiveGM),
  reactionConfig: id => getReactionConfig(id),
  requestReaction,
  rollItem,
  setReactionUsed: markReactionUsed,
  withReactionReach,
  publicName,
  applySentinel: async (mover, stopAt) => {
    const effect = {
      name: localize('GAC.Reactions.Sentinel.Stopped'),
      img: 'icons/magic/control/debuff-chains-shackle-movement-red.webp',
      duration: {turns: 1},
      flags: {dae: {specialDuration: ['turnEnd']}},
      system: {changes: ['walk', 'fly', 'swim', 'climb', 'burrow'].map(key => ({
        key: `system.attributes.movement.${key}`, type: 'override', value: '0', priority: 50
      }))}
    };
    await mover.actor?.createEmbeddedDocuments?.('ActiveEffect', [effect]);
    if (stopAt) {
      await mover.move?.([{x: stopAt.x, y: stopAt.y, elevation: stopAt.elevation, action: 'displace'}], {
        goffredoCompendium: {ignoreEchoMovement: true}
      });
    }
  }
};

function choiceLabel(item, kind) {
  return kind === 'spell' ? `${localize('GAC.Reactions.Prompt.Spell')}: ${item.name}` : item.name;
}

function buildChoices(reactor, deps) {
  const weapons = meleeWeapons(reactor.actor).map(item => ({value: `weapon|${item.uuid}`, label: choiceLabel(item, 'weapon'), item}));
  const spells = !reactor.isEcho && deps.reactionConfig('warCaster').enabled && hasFeature(reactor.actor, 'war-caster', 'War Caster')
    ? warCasterSpells(reactor.actor).map(item => ({value: `spell|${item.uuid}`, label: choiceLabel(item, 'spell'), item}))
    : [];
  return [...weapons, ...spells];
}

async function performReaction({reactor, mover, choice, choices, deps}) {
  const selected = choices.find(entry => entry.value === choice);
  if (!selected) return undefined;
  if (reactor.isEcho) {
    const echoState = reactor.actor.getFlag?.(FLAGS.scope, FLAGS.echo);
    const feature = echoState?.itemUuid ? deps.fromUuidSync(echoState.itemUuid) : undefined;
    return deps.attackFromEcho({
      item: feature,
      weapon: selected.item,
      meleeOnly: true,
      checkRange: false,
      asReaction: true,
      workflow: {
        id: `gac-reaction-${mover.uuid}`,
        actor: reactor.actor,
        token: {document: reactor.sightToken},
        targets: new Set([mover]),
        activity: {identifier: 'manifestEchoAttack'}
      }
    });
  }
  return deps.rollItem(selected.item, [mover], {asReaction: true});
}

function hitMover(workflow, mover) {
  return collectionValues(workflow?.hitTargets).some(target => (target.document ?? target).id === mover.id);
}

export async function resolveMovementReactions({mover, movement, operation}, deps = defaultDeps) {
  if (!deps.isResponsibleGM() || isForcedOrTeleport(movement, operation)) return [];
  // The echo is not a creature: moving it never provokes.
  if (mover.getFlag?.(FLAGS.scope, FLAGS.echo)) return [];
  if (deps.general().combatOnly && !mover.inCombat) return [];
  const scene = mover.parent;
  const points = pathPoints(movement, mover);
  if (points.length < 2) return [];

  const results = [];
  const reacted = new Set();
  for (const reactor of reactorsFor(mover, scene, deps)) {
    if (reacted.has(reactor.actor.uuid) || !isHostilePair(reactor, mover)) continue;
    const weapons = meleeWeapons(reactor.actor);
    if (!weapons.length) continue;
    const reach = Math.max(...weapons.map(weaponReach));
    const distances = points.map(point => footprintDistance(reactor.token, point, scene?.grid));
    const event = reachEvent(distances, reach);
    if (!event) continue;

    const sentinel = hasFeature(reactor.actor, 'sentinel', 'Sentinel') && deps.reactionConfig('sentinel').enabled;
    let reactionId;
    if (event.type === 'leave') {
      if (hasDisengaged(mover.actor) && !sentinel) continue;
      reactionId = 'opportunityAttack';
    } else {
      if (reactor.isEcho || !hasFeature(reactor.actor, 'polearm-master', 'Polearm Master')) continue;
      if (!weapons.some(isPolearm)) continue;
      reactionId = 'polearmMaster';
    }
    if (!deps.reactionConfig(reactionId).enabled) continue;
    if (deps.hasUsedReaction(reactor.actor) || isIncapacitated(reactor.actor)) continue;
    if (!deps.canSee(reactor.sightToken, mover)) continue;

    const choices = buildChoices(reactor, deps)
      .filter(entry => reactionId !== 'polearmMaster' || !entry.value.startsWith('weapon|') || isPolearm(entry.item));
    if (!choices.length) continue;

    const choice = await deps.requestReaction({
      reactionId,
      actor: reactor.actor,
      title: `${reactor.actor.name}: ${localize(`GAC.Reactions.Types.${reactionId}`)}`,
      content: `${deps.publicName(mover)}: ${localize(reactor.isEcho ? 'GAC.Reactions.Prompt.FromEcho' : `GAC.Reactions.Prompt.${reactionId}`)}`,
      choices: choices.map(({value, label}) => ({value, label}))
    });
    if (!choice) continue;

    reacted.add(reactor.actor.uuid);
    // The mover has already left reach when the reaction resolves.
    let workflow;
    try {
      workflow = await deps.withReactionReach(reactor.actor, () => performReaction({reactor, mover, choice, choices, deps}));
    } catch (error) {
      console.error('goffredo-compendium | reaction roll failed', error);
    }
    if (!workflow) continue;
    await deps.setReactionUsed(reactor.actor);
    if (sentinel && event.type === 'leave' && hitMover(workflow, mover)) {
      await deps.applySentinel(mover, lastInsidePoint(points, distances, reach));
    }
    if (deps.general().chatSummary) {
      const reactorToken = reactor.sightToken ?? reactor.token;
      await deps.chat(`<p><strong>${deps.publicName(reactorToken)}</strong>: ${localize(`GAC.Reactions.Types.${reactionId}`)} → ${deps.publicName(mover)}</p>`);
    }
    results.push({reactor: reactor.actor.uuid, reactionId, choice});
  }
  return results;
}

export function registerMovementReactions(hooks = globalThis.Hooks, deps = defaultDeps) {
  return hooks.on('moveToken', (mover, movement, operation) => {
    void resolveMovementReactions({mover, movement, operation}, deps).catch(error => {
      console.error('goffredo-compendium | movement reactions failed', error);
    });
  });
}
