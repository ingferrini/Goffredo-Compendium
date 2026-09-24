import {FLAGS} from '../constants.mjs';
import {dialogUtils, tokenUtils} from '../proxy.mjs';
import {movementCost3d} from './rules.mjs';
import {getEchoState} from './state.mjs';

const MOVEMENT_LIMIT = 30;

const defaultDeps = {
  currentUserId: () => globalThis.game?.user?.id,
  dialogUtils,
  fromUuid: (...args) => globalThis.fromUuid(...args),
  getCombat: token => token.combatant?.combat ?? globalThis.game?.combat,
  notify: key => globalThis.ui?.notifications?.warn(globalThis.game?.i18n?.localize?.(key) ?? key),
  tokenUtils
};

function currentUserId(deps) {
  return typeof deps.currentUserId === 'function' ? deps.currentUserId() : deps.currentUserId;
}

function turnState(combat, spent = 0) {
  return {
    schema: 1,
    combatId: combat.id,
    round: combat.round,
    turn: combat.turn,
    spent
  };
}

function isCurrentTurn(state, combat) {
  return state?.combatId === combat?.id
    && state?.round === combat?.round
    && state?.turn === combat?.turn;
}

function movementPoints(movement) {
  const waypoints = movement.passed?.waypoints;
  if (waypoints?.length > 1) return waypoints;
  return [movement.origin, movement.destination].filter(Boolean);
}

function scenePoint(point, scene) {
  const pixelsPerUnit = Number(scene?.grid?.size) / Number(scene?.grid?.distance);
  const scale = Number.isFinite(pixelsPerUnit) && pixelsPerUnit > 0 ? 1 / pixelsPerUnit : 1;
  return {
    x: Number(point.x) * scale,
    y: Number(point.y) * scale,
    elevation: Number(point.elevation) || 0
  };
}

function movementIgnored(movement, operation) {
  if (operation?.forced || operation?.goffredoCompendium?.ignoreEchoMovement) return true;
  return movementPoints(movement).slice(1).every(point => point.action === 'catForce');
}

function rollbackDestination(origin) {
  const destination = {
    x: origin.x,
    y: origin.y,
    elevation: origin.elevation,
    action: 'catForce'
  };
  if (origin.level !== undefined) destination.level = origin.level;
  return destination;
}

async function rollback(token, movement, deps) {
  await movement.animation?.ended;
  await deps.tokenUtils.moveToken(token, [rollbackDestination(movement.origin)], {
    constrainOptions: {ignoreCost: true, ignoreWalls: true},
    goffredoCompendium: {ignoreEchoMovement: true},
    showRuler: false
  });
}

export function isOwnerTurn(owner, combat) {
  const activeActor = combat?.combatant?.actor;
  return Boolean(owner && activeActor && (
    activeActor.uuid === owner.uuid
    || activeActor.id === owner.id
    || combat.combatant.actorId === owner.id
  ));
}

export function echoMovementDistance(movement, scene) {
  const points = movementPoints(movement).map(point => scenePoint(point, scene));
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += movementCost3d(points[index - 1], points[index]);
  }
  return total;
}

export async function handleEchoMovement(token, movement, operation, user, deps = defaultDeps) {
  if (user?.id !== currentUserId(deps)) return 'ignored';
  const echo = token.getFlag?.(FLAGS.scope, FLAGS.echo);
  if (!echo?.ownerActorUuid || movementIgnored(movement, operation)) return 'ignored';

  const owner = await deps.fromUuid(echo.ownerActorUuid);
  const combat = deps.getCombat(token);
  if (!owner || !combat) return 'ignored';
  if (!isOwnerTurn(owner, combat)) {
    await rollback(token, movement, deps);
    deps.notify('GAC.Echo.OwnerTurnOnly');
    return 'rolled-back';
  }

  const previous = token.getFlag(FLAGS.scope, FLAGS.movement);
  const spent = isCurrentTurn(previous, combat) ? Number(previous.spent) || 0 : 0;
  const projected = spent + echoMovementDistance(movement, token.parent);
  if (projected > MOVEMENT_LIMIT) {
    await rollback(token, movement, deps);
    deps.notify('GAC.Echo.MovementExceeded');
    return 'rolled-back';
  }

  await token.setFlag(FLAGS.scope, FLAGS.movement, turnState(combat, projected));
  return 'recorded';
}

export async function moveEchoVertically({workflow}, deps = defaultDeps) {
  const state = getEchoState(workflow.actor);
  const echoToken = state?.tokenUuid ? await deps.fromUuid(state.tokenUuid) : undefined;
  if (!echoToken) {
    deps.notify('GAC.Echo.NoActive');
    return false;
  }

  const combat = deps.getCombat(echoToken);
  const saved = echoToken.getFlag?.(FLAGS.scope, FLAGS.movement);
  const spent = combat && isCurrentTurn(saved, combat) ? Number(saved.spent) || 0 : 0;
  const remaining = Math.max(0, MOVEMENT_LIMIT - spent);
  const current = Number(echoToken.elevation) || 0;
  const step = Number(echoToken.parent?.grid?.distance) || 5;
  const elevation = await deps.dialogUtils.numberDialog(
    workflow.activity?.name ?? 'Manifest Echo',
    'GAC.Echo.ElevationPrompt',
    {
      label: 'GAC.Echo.ElevationLabel',
      name: 'elevation',
      options: {value: current, min: current - remaining, max: current + remaining, step}
    }
  );
  if (elevation === undefined) return false;
  const destination = Number(elevation);
  if (!Number.isFinite(destination) || Math.abs(destination - current) > remaining) {
    deps.notify('GAC.Echo.MovementExceeded');
    return false;
  }

  await deps.tokenUtils.moveToken(echoToken, [{
    x: echoToken.x,
    y: echoToken.y,
    elevation: destination,
    action: 'fly'
  }], {showRuler: false});
  return true;
}

export function registerMovementHooks(hooks = globalThis.Hooks, deps = defaultDeps) {
  return hooks.on('moveToken', (token, movement, operation, user) => {
    void handleEchoMovement(token, movement, operation, user, deps);
  });
}
