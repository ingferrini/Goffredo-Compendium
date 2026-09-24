function createProxy(targetPath) {
  const cache = new Map();
  const getTarget = () => {
    let context = globalThis.cat;
    if (!context) throw new Error("CAT is not ready.");
    for (const part of targetPath) context = context?.[part];
    return context;
  };

  return new Proxy(function () {}, {
    get(_target, property) {
      if (property === 'then' || typeof property === 'symbol') return undefined;
      if (!globalThis.game?.modules?.get('cat')?.active) return undefined;
      if (cache.has(property)) return cache.get(property);
      const context = getTarget();
      if (context?.[property] === undefined) {
        throw new Error(`CAT API property is unavailable: ${targetPath.join('.')}.${String(property)}`);
      }
      const value = context[property];
      if (typeof value === 'object' && value !== null) {
        const child = createProxy([...targetPath, property]);
        cache.set(property, child);
        return child;
      }
      if (typeof value === 'function') {
        const bound = value.bind(context);
        cache.set(property, bound);
        return bound;
      }
      return value;
    }
  });
}

export const api = createProxy(['api']);
export const actorUtils = createProxy(['utils', 'actorUtils']);
export const automationUtils = createProxy(['utils', 'automationUtils']);
export const compendiumUtils = createProxy(['utils', 'compendiumUtils']);
export const dialogUtils = createProxy(['utils', 'dialogUtils']);
export const documentUtils = createProxy(['utils', 'documentUtils']);
export const effectUtils = createProxy(['utils', 'effectUtils']);
export const genericUtils = createProxy(['utils', 'genericUtils']);
export const queryUtils = createProxy(['utils', 'queryUtils']);
export const summonUtils = createProxy(['utils', 'summonUtils']);
export const tokenUtils = createProxy(['utils', 'tokenUtils']);
export const workflowUtils = createProxy(['utils', 'workflowUtils']);

