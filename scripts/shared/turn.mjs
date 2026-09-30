// A key for the current combat turn; undefined outside combat, where "once per
// turn" limits do not apply.
export function turnKey(combat) {
  if (!combat?.started) return undefined;
  return `${combat.id}.${combat.round}.${combat.turn}`;
}

export const currentCombat = () => globalThis.game?.combat;
