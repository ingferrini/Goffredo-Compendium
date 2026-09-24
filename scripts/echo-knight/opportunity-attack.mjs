import {FLAGS} from '../constants.mjs';
import {actorUtils, dialogUtils, queryUtils, tokenUtils} from '../proxy.mjs';
import {attackFromEcho} from './manifest-echo.mjs';
import {leftEchoReach} from './rules.mjs';

const defaultDeps = {
  actorUtils,
  attackFromEcho,
  currentUserId: () => globalThis.game?.user?.id,
  dialogUtils,
  fromUuid: (...args) => globalThis.fromUuid(...args),
  queryUtils,
  tokenUtils
};

function currentUserId(deps) {
  return typeof deps.currentUserId === 'function' ? deps.currentUserId() : deps.currentUserId;
}

function collectionValues(collection) {
  if (!collection) return [];
  if (typeof collection.values === 'function') return Array.from(collection.values());
  return Array.from(collection);
}

function movementWaypoints(movement) {
  return movement?.passed?.waypoints ?? [];
}

function isForcedOrTeleport(movement, operation) {
  if (operation?.forced || operation?.goffredoCompendium?.ignoreEchoMovement) return true;
  return movementWaypoints(movement).slice(1).some(waypoint => (
    waypoint.action === 'displace'
    || waypoint.action === 'blink'
    || waypoint.action === 'catForce'
  ));
}

function ownerTokenFor(actor, sceneId) {
  return collectionValues(actor?.getActiveTokens?.()).map(token => token.document ?? token)
    .find(token => token.parent?.id === sceneId);
}

function activeEchoesFor(movedToken, deps) {
  return collectionValues(movedToken.parent?.tokens).filter(token => {
    const marker = token.getFlag?.(FLAGS.scope, FLAGS.echo);
    return marker?.ownerActorUuid && deps.tokenUtils.isEnemy(token, movedToken);
  });
}

function reactionWorkflow(owner, ownerToken, movedToken) {
  return {
    id: `echo-opportunity-${movedToken.uuid}`,
    actor: owner,
    token: {document: ownerToken},
    targets: new Set([movedToken]),
    activity: {identifier: 'manifestEchoAttack'}
  };
}

export function createOpportunityController(deps = defaultDeps) {
  const pending = new Map();

  function preMoveToken(token, movement, operation) {
    if (!movement?.id || isForcedOrTeleport(movement, operation)) return;
    const candidates = activeEchoesFor(token, deps).map(echo => ({
      echo,
      ownerActorUuid: echo.getFlag(FLAGS.scope, FLAGS.echo).ownerActorUuid,
      startDistance: deps.tokenUtils.getDistance(echo, token)
    })).filter(candidate => candidate.startDistance <= 5);
    if (candidates.length) pending.set(movement.id, candidates);
  }

  async function moveToken(token, movement, operation, user) {
    const candidates = pending.get(movement?.id) ?? [];
    pending.delete(movement?.id);
    if (user?.id !== currentUserId(deps) || isForcedOrTeleport(movement, operation)) return undefined;

    for (const candidate of candidates) {
      const endDistance = deps.tokenUtils.getDistance(candidate.echo, token);
      if (!leftEchoReach({
        startDistance: candidate.startDistance,
        endDistance,
        movedDistance: movement?.passed?.distance,
        forced: false,
        teleport: false
      })) continue;

      const owner = await deps.fromUuid(candidate.ownerActorUuid);
      if (!owner || deps.actorUtils.hasUsedReaction(owner)) continue;
      const ownerToken = ownerTokenFor(owner, token.parent?.id);
      if (!ownerToken || !deps.tokenUtils.canSee(ownerToken, token)) continue;

      const state = owner.getFlag?.(FLAGS.scope, FLAGS.echo);
      const feature = state?.itemUuid ? await deps.fromUuid(state.itemUuid) : undefined;
      if (!feature) continue;

      const confirmed = await deps.dialogUtils.confirm(
        feature.name,
        'GAC.Echo.ReactionPrompt',
        {userId: deps.queryUtils.firstOwner(owner, true)}
      );
      if (!confirmed) continue;

      const result = await deps.attackFromEcho({
        item: feature,
        workflow: reactionWorkflow(owner, ownerToken, token),
        meleeOnly: true
      });
      if (!result) continue;
      await deps.actorUtils.setReactionUsed(owner);
      return result;
    }
    return undefined;
  }

  return {moveToken, preMoveToken};
}

export function registerOpportunityHooks(hooks = globalThis.Hooks, deps = defaultDeps) {
  const controller = createOpportunityController(deps);
  return [
    hooks.on('preMoveToken', controller.preMoveToken),
    hooks.on('moveToken', (token, movement, operation, user) => {
      void controller.moveToken(token, movement, operation, user);
    })
  ];
}
