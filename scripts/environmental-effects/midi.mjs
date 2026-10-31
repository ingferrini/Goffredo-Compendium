import {MODULE_ID} from '../constants.mjs';

export const ENVIRONMENTAL_SOURCE_FLAG = 'environmentalSource';

function damagePart(mechanics) {
  if (!mechanics.damage) return [];
  return [{
    number: null,
    denomination: null,
    bonus: '',
    types: mechanics.damageType ? [mechanics.damageType] : [],
    custom: {enabled: true, formula: mechanics.damage},
    scaling: {mode: '', number: null, formula: ''}
  }];
}

export function buildEnvironmentalItemData(mechanics) {
  const hasSave = Boolean(mechanics.saveAbility && mechanics.dc !== null && mechanics.dc !== undefined);
  const activityId = 'GACEnvironment001';
  const activity = {
    _id: activityId,
    type: hasSave ? 'save' : 'damage',
    name: 'Environmental Effect',
    activation: {type: '', value: null, condition: '', override: false},
    consumption: {targets: [], scaling: {allowed: false, max: ''}, spellSlot: false},
    description: {chatFlavor: ''},
    duration: {concentration: false, value: '', units: 'inst', override: false},
    effects: [],
    range: {value: null, units: 'self', special: '', override: false},
    target: {template: {count: '', contiguous: false, type: '', size: '', width: '', height: '', units: 'ft'}, affects: {count: '', type: 'creature', choice: false, special: ''}, prompt: false, override: true},
    uses: {spent: 0, max: '', recovery: []},
    damage: {onSave: hasSave && mechanics.saveMode === 'half' ? 'half' : 'none', parts: damagePart(mechanics)},
    midiProperties: {displayActivityName: true, confirmTargets: 'never', autoCEEffects: 'none'}
  };
  if (hasSave) activity.save = {ability: [mechanics.saveAbility], dc: {calculation: 'custom', formula: String(mechanics.dc)}};
  return {
    name: 'Environmental Effect',
    type: 'feat',
    img: 'icons/svg/explosion.svg',
    system: {
      description: {value: '', chat: ''},
      activation: {type: '', value: null, condition: ''},
      activities: {[activityId]: activity},
      identifier: 'environmental-effect',
      type: {value: 'monster', subtype: ''},
      properties: []
    },
    effects: [],
    flags: {[MODULE_ID]: {environmentalWorkflow: true}}
  };
}

export async function resolveEnvironmentalWorkflow({itemData, actor, targets}, {
  createItem = (data, parent) => new globalThis.CONFIG.Item.documentClass(data, {parent}),
  completeItemUse = (...args) => globalThis.MidiQOL.completeItemUse(...args)
} = {}) {
  const item = createItem(itemData, actor);
  const midiOptions = {
    targetUuids: targets.map(target => target.uuid),
    configureDialog: false,
    workflowOptions: {autoRollDamage: 'always', autoFastDamage: true}
  };
  let result = await completeItemUse(item, {consumeUsage: false, midiOptions}, {}, {});
  result = result?.workflow ?? result;
  if (!result) throw new Error('Environmental Midi workflow did not complete.');
  return {
    workflow: result,
    failed: new Set(result.failedSaves ?? []),
    succeeded: new Set(result.saves ?? [])
  };
}

export async function ensureEnvironmentalActor(actors, {
  createActor = data => globalThis.Actor.create(data)
} = {}) {
  const existing = Array.from(actors ?? []).find(actor => actor.flags?.[MODULE_ID]?.[ENVIRONMENTAL_SOURCE_FLAG] === true);
  if (existing) return existing;
  return createActor({
    name: 'Environmental Effects',
    type: 'npc',
    img: 'icons/svg/explosion.svg',
    prototypeToken: {name: 'Environmental Effect', hidden: true, displayName: 0},
    ownership: {default: 0},
    flags: {[MODULE_ID]: {[ENVIRONMENTAL_SOURCE_FLAG]: true}}
  });
}
