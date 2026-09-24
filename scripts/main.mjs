import {MODULE_ID} from './constants.mjs';
import {destroyEchoAtZeroHp, manifestEcho} from './echo-knight/manifest-echo.mjs';
import {registerMovementHooks} from './echo-knight/movement.mjs';
import {registerOpportunityHooks} from './echo-knight/opportunity-attack.mjs';
import {unleashIncarnation} from './echo-knight/unleash-incarnation.mjs';
import {greatWeaponFightingAutomation} from './features/great-weapon-fighting.mjs';
import {packTacticsAutomation} from './features/pack-tactics.mjs';
import {frammentoRunico, unattuneBacklash} from './items/frammento-runico.mjs';
import {piumaReginaCorvo} from './items/piuma-regina-corvo.mjs';
import {vengefulAssaultAutomation} from './species/vengeful-assault.mjs';
import {manifestMind} from './wizard/manifest-mind.mjs';
import {api} from './proxy.mjs';
import {compatibilityIssues, registerAll} from './registry.mjs';

const automations = [
  ['manifest-echo', manifestEcho],
  ['unleash-incarnation', unleashIncarnation],
  ['manifest-mind', manifestMind],
  ['vengeful-assault', vengefulAssaultAutomation],
  ['pack-tactics-companion', packTacticsAutomation],
  ['great-weapon-fighting', greatWeaponFightingAutomation],
  ['frammento-runico-instabile', frammentoRunico],
  ['piuma-regina-corvo', piumaReginaCorvo]
];

Hooks.once('init', () => {
  console.info(`${MODULE_ID} | Initializing`);
});

Hooks.once('catReady', () => {
  const issues = compatibilityIssues(game.modules);
  if (issues.length) {
    const details = issues.map(issue => {
      if (issue.reason === 'version') return `${issue.id} ${issue.actual} (< ${issue.minimum})`;
      return `${issue.id} (${issue.reason})`;
    }).join(', ');
    ui.notifications.error(`${MODULE_ID}: incompatible automation stack: ${details}`, {permanent: true});
    return;
  }
  registerAll(api, automations);
  console.info(`${MODULE_ID} | CAT automations registered`);
});

Hooks.once('ready', () => {
  registerMovementHooks();
  registerOpportunityHooks();
  Hooks.on('updateActor', (actor, changes) => {
    if (game.user.isActiveGM) void destroyEchoAtZeroHp(actor, changes);
  });
  Hooks.on('updateItem', (item, changes) => {
    if (game.user.isActiveGM) void unattuneBacklash(item, changes);
  });
});
