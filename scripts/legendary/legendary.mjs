import {MODULE_ID} from '../constants.mjs';
import {activeGM, rollItem} from '../platform/midi.mjs';
import {getLegendaryConfig} from '../reactions/config.mjs';
import {askGM, noticeToPlayers} from '../reactions/prompt.mjs';
import {publicName} from '../reactions/usage.mjs';
import {collectionValues, localize} from '../shared/foundry.mjs';

export const BETWEEN_TURNS_QUERY = `${MODULE_ID}.betweenTurns`;
export const SPEND_QUERY = `${MODULE_ID}.spendResource`;
const SPENDABLE = new Set(['legact', 'legres']);
const PROMPTED_FLAG = 'legendaryPrompted';
const LAIR_FLAG = 'lastLairAction';
const DEFAULT_LAIR_INITIATIVE = 20;

// ---------- pure helpers ----------

function activitiesOf(item) {
  return collectionValues(item?.system?.activities);
}

function resource(actor, key) {
  return actor?.system?.resources?.[key] ?? {};
}

export function remainingLegendaryActions(actor) {
  const legact = resource(actor, 'legact');
  const value = Number(legact.value);
  if (Number.isFinite(value)) return value;
  return Math.max(0, (Number(legact.max) || 0) - (Number(legact.spent) || 0));
}

export function legendaryCost(item) {
  const activity = activitiesOf(item).find(entry => entry.activation?.type === 'legendary');
  return Math.max(1, Number(activity?.activation?.value) || 1);
}

export function legendaryActions(actor) {
  const remaining = remainingLegendaryActions(actor);
  return collectionValues(actor?.items).filter(item => (
    activitiesOf(item).some(activity => activity.activation?.type === 'legendary') && legendaryCost(item) <= remaining
  ));
}

export function lairInitiative(actor) {
  const lair = resource(actor, 'lair');
  const value = Number(lair.initiative);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_LAIR_INITIATIVE;
}

export function hasLair(actor) {
  return Boolean(resource(actor, 'lair').value);
}

export function lairActions(actor, round) {
  const last = actor?.getFlag?.(MODULE_ID, LAIR_FLAG);
  return collectionValues(actor?.items).filter(item => {
    if (!activitiesOf(item).some(activity => activity.activation?.type === 'lair')) return false;
    // The same lair action can't be used two rounds in a row.
    return !(last?.itemId === item.id && last?.round === round - 1);
  });
}

export function remainingLegendaryResistances(actor) {
  const legres = resource(actor, 'legres');
  const value = Number(legres.value);
  if (Number.isFinite(value)) return value;
  return Math.max(0, (Number(legres.max) || 0) - (Number(legres.spent) || 0));
}

// Where the combat is heading on this advance, and whether initiative count 20
// (losing ties) is crossed on the way: that is when lair actions happen.
export function nextStep(combat, changes) {
  const round = changes.round ?? combat.round;
  const turn = changes.turn ?? combat.turn;
  const newRound = round > combat.round;
  const current = combat.combatant;
  const next = combat.turns?.[turn];
  return {round, turn, newRound, current, next};
}

export function crossesLairCount(step, count) {
  const nextInit = Number(step.next?.initiative);
  if (!Number.isFinite(nextInit) || nextInit >= count) return false;
  if (step.newRound) return true;
  return Number(step.current?.initiative) >= count;
}

export function legendaryCandidates(combat) {
  const currentId = combat.combatant?.id;
  return collectionValues(combat.combatants).filter(combatant => (
    combatant.id !== currentId
    && !combatant.defeated
    && combatant.actor
    && remainingLegendaryActions(combatant.actor) > 0
    && legendaryActions(combatant.actor).length
  ));
}

export function lairCandidates(combat, step) {
  return collectionValues(combat.combatants).filter(combatant => (
    !combatant.defeated
    && hasLair(combatant.actor)
    && crossesLairCount(step, lairInitiative(combatant.actor))
    && lairActions(combatant.actor, step.round).length
  ));
}

export async function spendResource(actor, key, amount) {
  if (!SPENDABLE.has(key)) return false;
  const {spent = 0, max} = resource(actor, key);
  // Never spend past the maximum: a manual recharge from the sheet must work at once.
  const cap = Number(max);
  const next = (Number(spent) || 0) + amount;
  await actor.update({[`system.resources.${key}.spent`]: Number.isFinite(cap) && cap > 0 ? Math.min(cap, next) : next});
  return true;
}

// ---------- GM flow ----------

const defaultDeps = {
  askGM,
  chat: content => globalThis.ChatMessage?.create?.({content}),
  config: id => getLegendaryConfig(id),
  gm: () => activeGM(),
  isGM: () => Boolean(globalThis.game?.user?.isActiveGM),
  notice: noticeToPlayers,
  pause: async paused => { if (globalThis.game?.paused !== paused) await globalThis.game?.togglePause?.(paused, {broadcast: true}); },
  rollItem,
  // Players can't update NPC sheets: the GM spends the resource for them.
  spend: async (actor, key, amount) => {
    if (actor.isOwner) return spendResource(actor, key, amount);
    return activeGM()?.query?.(SPEND_QUERY, {uuid: actor.uuid, key, amount});
  },
  targets: () => Array.from(globalThis.game?.user?.targets ?? []).map(token => token.document ?? token)
};

function choiceFor(item, extra = '') {
  return {value: item.uuid, label: `${item.name}${extra}`};
}

// dnd5e usually spends legendary actions itself; spend only when it didn't.
async function spendLegendary(actor, item, before, deps) {
  if (remainingLegendaryActions(actor) < before) return;
  await deps.spend(actor, 'legact', legendaryCost(item));
}

async function offerLegendary(combatant, deps) {
  const actor = combatant.actor;
  const config = deps.config('legendaryActions');
  const actions = legendaryActions(actor);
  const remaining = remainingLegendaryActions(actor);
  const choice = await deps.askGM({
    title: `${actor.name}: ${localize('GAC.Legendary.Actions')} (${remaining}/${Number(resource(actor, 'legact').max) || remaining})`,
    content: localize('GAC.Legendary.ChooseAction'),
    choices: actions.map(item => choiceFor(item, ` (${legendaryCost(item)})`)),
    timeout: config.timeout
  });
  const item = actions.find(entry => entry.uuid === choice);
  if (!item) return false;
  const rolled = await deps.rollItem(item, deps.targets());
  if (rolled) await spendLegendary(actor, item, remaining, deps);
  return Boolean(rolled);
}

async function offerLair(combatant, round, deps) {
  const actor = combatant.actor;
  const config = deps.config('lairActions');
  const actions = lairActions(actor, round);
  const choice = await deps.askGM({
    title: `${actor.name}: ${localize('GAC.Legendary.Lair')}`,
    content: localize('GAC.Legendary.ChooseAction'),
    choices: actions.map(item => choiceFor(item)),
    timeout: config.timeout
  });
  const item = actions.find(entry => entry.uuid === choice);
  if (!item) return false;
  const rolled = await deps.rollItem(item, deps.targets());
  if (rolled) await actor.setFlag(MODULE_ID, LAIR_FLAG, {itemId: item.id, round});
  return Boolean(rolled);
}

// Runs on the active GM before the turn advances; the advance resumes afterwards.
export async function runBetweenTurns(combat, changes, deps = defaultDeps) {
  const step = nextStep(combat, changes);
  const useLegendary = deps.config('legendaryActions').enabled;
  const useLair = deps.config('lairActions').enabled;
  const legendary = useLegendary ? legendaryCandidates(combat) : [];
  const lair = useLair ? lairCandidates(combat, step) : [];
  await combat.setFlag(MODULE_ID, PROMPTED_FLAG, {round: combat.round, turn: combat.turn});

  if (legendary.length || lair.length) {
    const pause = (legendary.length && deps.config('legendaryActions').pause) || (lair.length && deps.config('lairActions').pause);
    if (pause) await deps.pause(true);
    deps.notice(localize(legendary.length ? 'GAC.Legendary.PlayerNotice' : 'GAC.Legendary.PlayerNoticeLair'));
    try {
      for (const combatant of legendary) await offerLegendary(combatant, deps);
      for (const combatant of lair) await offerLair(combatant, step.round, deps);
    } finally {
      if (pause) await deps.pause(false);
    }
  }
  // The prompted flag matches the current turn, so this advance is not held again.
  if (step.newRound && changes.turn === 0 && combat.turn !== (combat.turns?.length ?? 0) - 1) await combat.nextRound();
  else await combat.nextTurn();
}

// Any client may advance the turn; only the GM decides, so the advance is
// held here and handed to the GM when something legendary could happen.
export function shouldHoldTurn(combat, changes, options, deps = defaultDeps) {
  if (options?.direction !== 1 || options?.goffredoCompendium?.bypassLegendary) return false;
  if (!('turn' in changes) && !('round' in changes)) return false;
  const prompted = combat.getFlag?.(MODULE_ID, PROMPTED_FLAG);
  if (prompted?.round === combat.round && prompted?.turn === combat.turn) return false;
  const step = nextStep(combat, changes);
  const legendary = deps.config('legendaryActions').enabled && legendaryCandidates(combat).length > 0;
  const lair = deps.config('lairActions').enabled && lairCandidates(combat, step).length > 0;
  return legendary || lair;
}

export function registerLegendaryTurns(hooks = globalThis.Hooks, queries = globalThis.CONFIG?.queries, deps = defaultDeps) {
  if (queries) {
    queries[BETWEEN_TURNS_QUERY] = async ({combatId, changes}) => {
      const combat = globalThis.game?.combats?.get(combatId);
      if (combat) await runBetweenTurns(combat, changes, deps);
      return true;
    };
    queries[SPEND_QUERY] = async ({uuid, key, amount}) => {
      const actor = await globalThis.fromUuid?.(uuid);
      return actor ? spendResource(actor, key, Number(amount) || 1) : false;
    };
  }
  return hooks.on('preUpdateCombat', (combat, changes, options) => {
    if (!shouldHoldTurn(combat, changes, options, deps)) return undefined;
    const held = {turn: changes.turn, round: changes.round};
    Object.keys(held).forEach(key => held[key] === undefined && delete held[key]);
    if (deps.isGM()) void runBetweenTurns(combat, held, deps);
    else void deps.gm()?.query?.(BETWEEN_TURNS_QUERY, {combatId: combat.id, changes: held}).catch(() => undefined);
    return false;
  });
}

// ---------- Legendary Resistance ----------

function tokenOf(token) {
  return token?.document ?? token;
}

// After Midi collects saves and before it applies them: a failed save of a
// creature with Legendary Resistance left can be turned into a success.
export async function offerLegendaryResistance(workflow, deps = defaultDeps) {
  const config = deps.config('legendaryResistance');
  if (!config.enabled) return [];
  const used = [];
  for (const token of collectionValues(workflow?.failedSaves)) {
    const actor = token.actor;
    const remaining = remainingLegendaryResistances(actor);
    if (!actor || actor.hasPlayerOwner || remaining <= 0) continue;
    const choice = await deps.askGM({
      title: `${actor.name}: ${localize('GAC.Legendary.Resistance')} (${remaining}/${Number(resource(actor, 'legres').max) || remaining})`,
      content: `${localize('GAC.Legendary.ResistancePrompt')} ${workflow.item?.name ?? ''}`.trim(),
      choices: [{value: 'use', label: localize('GAC.Legendary.UseResistance')}],
      timeout: config.timeout,
      onTimeout: config.onTimeout
    });
    if (choice !== 'use') continue;
    workflow.failedSaves = new Set(collectionValues(workflow.failedSaves).filter(entry => entry !== token));
    workflow.saves = new Set([...collectionValues(workflow.saves), token]);
    await deps.spend(actor, 'legres', 1);
    await deps.chat(`<p><strong>${publicName(tokenOf(token))}</strong>: ${localize('GAC.Legendary.Resistance')}</p>`);
    used.push(actor.uuid);
  }
  return used;
}

export function registerLegendaryResistance(hooks = globalThis.Hooks, deps = defaultDeps) {
  return hooks.on('midi-qol.postCheckSaves', workflow => offerLegendaryResistance(workflow, deps));
}
