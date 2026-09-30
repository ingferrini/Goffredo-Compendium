import {RULESET} from '../constants.mjs';
import {dialogUtils, documentUtils, tokenUtils} from '../proxy.mjs';
import {localize} from '../shared/foundry.mjs';

const RANGE = 30;

const defaultDeps = {
  dialogUtils,
  documentUtils,
  tokenUtils,
  roll: async (formula, data) => new globalThis.Roll(formula, data).evaluate()
};

export function paladinLevel(actor) {
  return Number(actor?.classes?.paladin?.system?.levels) || 0;
}

// Temporary hit points don't stack: a creature keeps the higher amount.
export function tempHpUpdate(actor, amount) {
  const current = Number(actor?.system?.attributes?.hp?.temp) || 0;
  return amount > current ? {'system.attributes.hp.temp': amount} : undefined;
}

// 2d8 + paladin level temporary hit points, split among creatures of the
// paladin's choice within 30 feet, the paladin included.
export async function inspiringSmite({workflow}, deps = defaultDeps) {
  const actor = workflow?.actor;
  const token = workflow?.token?.document ?? workflow?.token;
  if (!actor || !token) return undefined;
  const roll = await deps.roll(`2d8 + ${paladinLevel(actor)}`, actor.getRollData?.() ?? {});
  await roll.toMessage?.({speaker: {actor: actor.id, token: token.id}, flavor: workflow.item?.name});
  const candidates = [token, ...deps.tokenUtils.findNearby(token, RANGE, {disposition: 'ally'})];
  const selection = await deps.dialogUtils.selectTargetDialog(
    workflow.item.name,
    localize('GAC.InspiringSmite.Distribute').replace('{total}', roll.total),
    candidates,
    {type: 'selectAmount', maxAmount: roll.total, skipDeadAndUnconscious: false}
  );
  for (const {document, value} of selection?.result ?? []) {
    const update = tempHpUpdate(document.actor, Number(value) || 0);
    if (update) await deps.documentUtils.update(document.actor, update);
  }
  return undefined;
}

export const inspiringSmiteAutomation = {
  name: 'Channel Divinity: Inspiring Smite',
  version: '0.9.0',
  rules: RULESET,
  roll: [{pass: 'itemRollFinished', macro: inspiringSmite, priority: 50}]
};
