const SUMMON_RANGE = 15;
const ECHO_RANGE = 30;
const ECHO_REACH = 5;

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function echoArmorClass(proficiency) {
  return 14 + number(proficiency);
}

export function unleashUses(constitutionModifier) {
  return Math.max(1, Math.trunc(number(constitutionModifier)));
}

export function movementCost3d(origin, destination) {
  return Math.hypot(
    number(destination.x) - number(origin.x),
    number(destination.y) - number(origin.y),
    number(destination.elevation) - number(origin.elevation)
  );
}

export function accumulateMovement(current, origin, destination) {
  return number(current) + movementCost3d(origin, destination);
}

export function isWithinSummonRange(distance) {
  return number(distance) <= SUMMON_RANGE;
}

export function shouldDismissEcho(distance) {
  return number(distance) > ECHO_RANGE;
}

export function leftEchoReach({
  startDistance,
  endDistance,
  movedDistance,
  forced = false,
  teleport = false
}) {
  if (forced || teleport) return false;
  return number(startDistance) <= ECHO_REACH
    && number(endDistance) > ECHO_REACH
    && number(movedDistance) >= ECHO_REACH;
}

export function isMeleeAttack({hasAttack, equipped = true, attackType}) {
  return Boolean(hasAttack && equipped && attackType === 'melee');
}

export const limits = Object.freeze({
  summonRange: SUMMON_RANGE,
  echoRange: ECHO_RANGE,
  echoReach: ECHO_REACH
});
