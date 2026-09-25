import {MODULE_ID} from '../constants.mjs';
import {activeGM, activeOwner} from '../platform/midi.mjs';
import {localize} from '../shared/foundry.mjs';
import {getReactionConfig} from './config.mjs';

export const REACTION_QUERY = `${MODULE_ID}.reaction`;
export const CANCEL_QUERY = `${MODULE_ID}.reactionCancel`;
export const NOTICE_QUERY = `${MODULE_ID}.notice`;

const openDialogs = new Map();
const TIMED_OUT = Object.freeze({choice: null, timedOut: true});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char]);
}

// Client side: a dialog with a countdown; closing it by timeout counts as no answer.
export function showReactionDialog({requestId, title, content, choices, timeout}) {
  const {DialogV2} = globalThis.foundry.applications.api;
  return new Promise(resolve => {
    let settled = false;
    let remaining = timeout;
    const finish = result => {
      if (settled) return;
      settled = true;
      globalThis.clearInterval(timer);
      openDialogs.delete(requestId);
      resolve(result);
      if (dialog.rendered) void dialog.close();
    };
    const select = choices.length > 1
      ? `<select name="choice">${choices.map(choice => `<option value="${escapeHtml(choice.value)}">${escapeHtml(choice.label)}</option>`).join('')}</select>`
      : `<p><strong>${escapeHtml(choices[0]?.label)}</strong></p>`;
    const dialog = new DialogV2({
      window: {title},
      content: `<p>${escapeHtml(content)}</p>${select}${timeout > 0 ? `<p class="hint">${escapeHtml(localize('GAC.Reactions.Prompt.Countdown'))} <span data-gac-countdown>${remaining}</span>s</p>` : ''}`,
      buttons: [
        {
          action: 'use',
          label: localize('GAC.Reactions.Prompt.Use'),
          default: true,
          callback: (_event, _button, app) => app.element.querySelector('[name="choice"]')?.value ?? choices[0]?.value
        },
        {action: 'decline', label: localize('GAC.Reactions.Prompt.Decline'), callback: () => null}
      ],
      submit: choice => finish({choice: choice ?? null, timedOut: false})
    });
    dialog.addEventListener?.('close', () => finish({choice: null, timedOut: false}));
    // A timeout of 0 waits for the answer without a countdown.
    const timer = timeout > 0 && globalThis.setInterval(() => {
      remaining -= 1;
      const counter = dialog.element?.querySelector('[data-gac-countdown]');
      if (counter) counter.textContent = String(Math.max(0, remaining));
      if (remaining <= 0) finish(TIMED_OUT);
    }, 1000);
    openDialogs.set(requestId, () => finish({choice: null, timedOut: false, cancelled: true}));
    void dialog.render({force: true});
  });
}

export function registerReactionQueries(queries = globalThis.CONFIG.queries) {
  queries[REACTION_QUERY] = data => showReactionDialog(data);
  queries[CANCEL_QUERY] = ({requestId}) => {
    openDialogs.get(requestId)?.();
    return true;
  };
  queries[NOTICE_QUERY] = ({text}) => {
    globalThis.ui?.notifications?.info(text);
    return true;
  };
}

// A short on-screen notice for every connected player.
export function noticeToPlayers(text, users = globalThis.game?.users) {
  for (const user of Array.from(users ?? [])) {
    if (!user.active || user.isGM) continue;
    void user.query?.(NOTICE_QUERY, {text}).catch(() => undefined);
  }
}

const defaultDeps = {
  config: id => getReactionConfig(id),
  currentUserId: () => globalThis.game?.user?.id,
  gm: () => activeGM(),
  owner: actor => activeOwner(actor),
  showDialog: data => showReactionDialog(data),
  randomId: () => globalThis.foundry?.utils?.randomID?.() ?? String(Math.random()).slice(2)
};

async function askUser(user, data, deps) {
  if (!user) return TIMED_OUT;
  if (user.id === deps.currentUserId()) return deps.showDialog(data);
  try {
    const options = data.timeout > 0 ? {timeout: (data.timeout + 5) * 1000} : {};
    return await user.query(REACTION_QUERY, data, options);
  } catch {
    return TIMED_OUT;
  }
}

// First real answer wins; the other dialogs are closed.
async function askUsers(users, data, deps) {
  const targets = users.filter(Boolean).filter((user, index, list) => list.findIndex(other => other.id === user.id) === index);
  if (!targets.length) return TIMED_OUT;
  const answers = targets.map(user => askUser(user, data, deps).then(answer => ({user, answer})));
  const first = await new Promise(resolve => {
    let pending = answers.length;
    for (const promise of answers) {
      void promise.then(({user, answer}) => {
        if (!answer?.timedOut) return resolve({user, answer});
        pending -= 1;
        if (!pending) resolve({answer: TIMED_OUT});
      });
    }
  });
  // Nothing to close when every dialog already ran out of time.
  if (!first.user) return first.answer;
  for (const user of targets) {
    if (user.id === first.user.id) continue;
    if (user.id === deps.currentUserId()) openDialogs.get(data.requestId)?.();
    else void user.query?.(CANCEL_QUERY, {requestId: data.requestId}).catch(() => undefined);
  }
  return first.answer;
}

// Resolves to the chosen value, or null when the reaction is not taken.
export async function requestReaction({reactionId, actor, title, content, choices}, deps = defaultDeps) {
  const config = deps.config(reactionId);
  if (!config.enabled || !choices?.length) return null;
  const data = {requestId: deps.randomId(), title, content, choices, timeout: config.timeout};
  const automatic = choices[0].value;

  if (!actor?.hasPlayerOwner) {
    if (config.npcMode === 'off') return null;
    if (config.npcMode === 'auto') return automatic;
    const answer = await askUsers([deps.gm()], data, deps);
    if (!answer.timedOut) return answer.choice;
    return config.onTimeout === 'accept' ? automatic : null;
  }

  const owner = deps.owner(actor);
  const gm = deps.gm();
  const recipients = {owner: [owner], ownerAndGm: [owner, gm], gm: [gm]}[config.audience];
  const answer = await askUsers(recipients, data, deps);
  if (!answer.timedOut) return answer.choice;

  if (config.onTimeout === 'accept') return automatic;
  if (config.onTimeout === 'gm' && !recipients.some(user => user?.id === gm?.id)) {
    const second = await askUsers([gm], {...data, requestId: deps.randomId()}, deps);
    return second.timedOut ? null : second.choice;
  }
  return null;
}

// GM decisions outside the reaction rows (legendary and lair actions, Legendary
// Resistance). Resolves to the chosen value, or null.
export async function askGM({title, content, choices, timeout = 0, onTimeout = 'decline'}, deps = defaultDeps) {
  if (!choices?.length) return null;
  const data = {requestId: deps.randomId(), title, content, choices, timeout};
  const answer = await askUsers([deps.gm()], data, deps);
  if (!answer.timedOut) return answer.choice;
  return onTimeout === 'accept' ? choices[0].value : null;
}
