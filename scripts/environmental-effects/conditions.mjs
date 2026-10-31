export function conditionDuration(duration = {}) {
  const value = duration.value;
  if (value === null || value === undefined || value === '') return {};
  if (duration.unit === 'turn') return {turns: Number(value)};
  if (duration.unit === 'round') return {rounds: Number(value)};
  if (duration.unit === 'hour') return {seconds: Number(value) * 3600};
  return {seconds: Number(value) * 60};
}

export async function applyCondition(actor, conditionId, duration, {
  status = id => Array.from(globalThis.CONFIG.statusEffects ?? []).find(effect => effect.id === id),
  create = (target, data) => target.createEmbeddedDocuments('ActiveEffect', [data])
} = {}) {
  if (!conditionId) return null;
  const definition = status(conditionId);
  if (!definition) throw new Error(`Unknown condition: ${conditionId}`);
  const data = {
    name: definition.name,
    img: definition.img,
    type: 'base',
    statuses: [definition.id],
    duration: conditionDuration(duration),
    changes: []
  };
  const result = await create(actor, data);
  return Array.isArray(result) ? result[0] : result;
}

export async function applyConditionToTokens(tokens, conditionId, duration, deps) {
  if (!conditionId) return [];
  return Promise.all(Array.from(tokens ?? []).map(token => applyCondition(token.actor, conditionId, duration, deps)));
}
