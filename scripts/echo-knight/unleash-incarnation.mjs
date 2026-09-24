import {MODULE_ID, RULESET} from '../constants.mjs';
import {attackFromEcho} from './manifest-echo.mjs';
import {unleashUses} from './rules.mjs';

const defaultDeps = {
  attackFromEcho,
  notify: key => globalThis.ui?.notifications?.warn(globalThis.game?.i18n?.localize?.(key) ?? key)
};

const WORKFLOW_STATE = `${MODULE_ID}.unleashIncarnation`;

export function availableUnleashUses(actor, item) {
  const maximum = unleashUses(actor?.system?.abilities?.con?.mod);
  const spent = Math.max(0, Number(item?.system?.uses?.spent) || 0);
  return Math.max(0, maximum - spent);
}

export async function useUnleash({document: item, workflow}, deps = defaultDeps) {
  if (workflow?.[WORKFLOW_STATE]) return undefined;
  if (!workflow?.targets?.size) {
    deps.notify('GAC.Echo.ChooseTarget');
    return undefined;
  }
  if (!availableUnleashUses(workflow.actor, item)) {
    deps.notify('GAC.Echo.NoUnleashUses');
    return undefined;
  }

  const result = await deps.attackFromEcho({item, workflow, meleeOnly: true});
  if (!result) return undefined;

  workflow[WORKFLOW_STATE] = true;
  const spent = Math.max(0, Number(item.system?.uses?.spent) || 0);
  await item.update({'system.uses.spent': spent + 1});
  return result;
}

async function onRollFinished(context) {
  if (context.workflow?.activity?.identifier !== 'unleashIncarnation') return undefined;
  return useUnleash(context);
}

export const unleashIncarnation = {
  name: 'Unleash Incarnation',
  version: '0.1.0',
  rules: RULESET,
  roll: [{pass: 'itemRollFinished', macro: onRollFinished, priority: 50}]
};
