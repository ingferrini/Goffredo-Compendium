export const MODULE_ID = 'goffredo-compendium';
export const MODULE_TITLE = "Goffredo's Automation Compendium";
export const RULESET = '2014';

export const PACKS = Object.freeze({
  features: `${MODULE_ID}.GACFeatures2014`,
  summons: `${MODULE_ID}.GACSummons2014`
});

export const REQUIRED_MODULES = Object.freeze([
  {id: 'midi-qol', minimum: '14.0.12'},
  {id: 'dae', minimum: '14.0.14'},
  {id: 'cat', minimum: '0.0.8'}
]);

export const FLAGS = Object.freeze({
  scope: MODULE_ID,
  echo: 'echo',
  movement: 'echoMovement'
});

