import {MODULE_ID} from './constants.mjs';
import {manifestEcho} from './echo-knight/manifest-echo.mjs';
import {registerMovementHooks} from './echo-knight/movement.mjs';
import {registerOpportunityHooks} from './echo-knight/opportunity-attack.mjs';
import {unleashIncarnation} from './echo-knight/unleash-incarnation.mjs';
import {api} from './proxy.mjs';
import {compatibilityIssues, registerAll} from './registry.mjs';

const automations = [
  ['manifest-echo', manifestEcho],
  ['unleash-incarnation', unleashIncarnation]
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
});
