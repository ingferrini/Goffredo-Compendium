import {MODULE_ID, MODULE_TITLE, REQUIRED_MODULES} from './constants.mjs';

function versionParts(version) {
  return String(version ?? '0').split(/[.-]/).map(part => Number.parseInt(part, 10) || 0);
}

export function versionAtLeast(actual, minimum) {
  const left = versionParts(actual);
  const right = versionParts(minimum);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return true;
}

export function compatibilityIssues(modules) {
  return REQUIRED_MODULES.flatMap(({id, minimum}) => {
    const module = modules.get(id);
    if (!module) return [{id, reason: 'missing'}];
    if (!module.active) return [{id, reason: 'inactive'}];
    if (!versionAtLeast(module.version, minimum)) {
      return [{id, reason: 'version', minimum, actual: module.version}];
    }
    return [];
  });
}

export function registerFunctionMacros(catApi, entries) {
  const identifiers = entries.map(([identifier]) => identifier);
  const duplicate = identifiers.find((identifier, index) => identifiers.indexOf(identifier) !== index);
  if (duplicate) throw new Error(`Duplicate automation identifier: ${duplicate}`);

  for (const [identifier, automation] of entries) {
    catApi.registerFnMacro({
      source: MODULE_ID,
      identifier,
      ...automation
    });
  }
}

export function registerAutomationSource(catApi) {
  catApi.registerSourceName(MODULE_ID, MODULE_TITLE);
  catApi.registerAutomationModule(MODULE_ID, {ignoredPackIds: []});
}

export function registerAll(catApi, entries) {
  registerFunctionMacros(catApi, entries);
  registerAutomationSource(catApi);
}

