import {RULESET} from '../constants.mjs';
import {actorUtils, dialogUtils, documentUtils, effectUtils, itemUtils, workflowUtils} from '../proxy.mjs';
import {collectionValues, localize} from '../shared/foundry.mjs';

export const BREATH_TYPES = ['acid', 'cold', 'fire', 'lightning', 'poison'];
const EFFECT = 'dragonsBreath';
const EXHALE_ID = 'GACDragonExhale1';
const BASE_LEVEL = 2;

const defaultDeps = {actorUtils, dialogUtils, documentUtils, effectUtils, itemUtils, workflowUtils};

// 3d6 at 2nd level, one more die for each slot level above it.
export function breathDice(castLevel) {
  return Math.max(BASE_LEVEL, Number(castLevel) || BASE_LEVEL) + 1;
}

// The action granted to the touched creature: a 15-foot cone, Dexterity save
// against the caster's spell save DC, half damage on a success.
export function exhaleData({name, img, dc, dice, damageType}) {
  return {
    name,
    type: 'feat',
    img,
    system: {
      description: {value: `<p>${localize('GAC.DragonsBreath.ExhaleSummary')}</p>`, chat: ''},
      identifier: 'dragons-breath-exhale',
      type: {value: '', subtype: ''},
      activities: {
        [EXHALE_ID]: {
          _id: EXHALE_ID,
          type: 'save',
          name,
          activation: {type: 'action', value: 1, condition: '', override: false},
          consumption: {targets: [], scaling: {allowed: false, max: ''}, spellSlot: false},
          duration: {concentration: false, units: 'inst', override: false},
          range: {units: 'self', special: '', override: false},
          target: {
            template: {count: '', contiguous: false, type: 'cone', size: '15', width: '', height: '', units: 'ft'},
            affects: {count: '', type: 'creature', choice: false, special: ''},
            prompt: true,
            override: false
          },
          damage: {
            onSave: 'half',
            parts: [{number: dice, denomination: 6, bonus: '', types: [damageType], custom: {enabled: false, formula: ''}, scaling: {mode: '', number: null, formula: ''}}]
          },
          save: {ability: ['dex'], dc: {calculation: '', formula: String(dc)}},
          effects: []
        }
      }
    }
  };
}

export async function castDragonsBreath({document: item, workflow}, deps = defaultDeps) {
  if (workflow?.activity?.identifier !== EFFECT) return undefined;
  const concentration = deps.effectUtils.getConcentrationEffect(workflow.actor, item);
  const targets = collectionValues(workflow.targets);
  if (!targets.length) {
    if (concentration) await deps.documentUtils.deleteDocument(concentration);
    return undefined;
  }
  const damageType = await deps.dialogUtils.selectDamageType(
    BREATH_TYPES, item.name, localize('GAC.DragonsBreath.ChooseType')
  ) || 'fire';
  const exhale = exhaleData({
    name: `${item.name}: ${localize('GAC.DragonsBreath.Exhale')}`,
    img: item.img,
    dc: deps.itemUtils.getSaveDC(item),
    dice: breathDice(deps.workflowUtils.getCastLevel(workflow)),
    damageType
  });
  for (const target of targets) {
    const actor = target.actor ?? target.document?.actor;
    if (!actor) continue;
    // A new casting replaces the breath from an earlier one.
    const previous = deps.actorUtils.getEffectByIdentifier(actor, EFFECT);
    if (previous) await deps.documentUtils.deleteDocument(previous);
    // The effect ends with the caster's concentration and takes the action with it.
    const effectData = deps.documentUtils.getBaseEffectData(item, {
      name: item.name,
      img: item.img,
      origin: item.uuid,
      identifier: EFFECT,
      duration: {seconds: 60},
      parentEntity: concentration
    });
    const [effect] = await deps.effectUtils.createEffects(actor, [effectData]) ?? [];
    if (!effect) continue;
    await deps.itemUtils.createItems(actor, [exhale], {favorite: true, parentEntity: effect});
  }
  return undefined;
}

export const dragonsBreath = {
  name: "Dragon's Breath",
  version: '0.8.0',
  rules: RULESET,
  roll: [{pass: 'itemRollFinished', macro: castDragonsBreath, priority: 50}]
};
