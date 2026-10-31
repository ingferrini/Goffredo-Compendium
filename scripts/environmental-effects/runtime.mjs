import {MODULE_ID} from '../constants.mjs';
import {applyConditionToTokens} from './conditions.mjs';
import {executeEnvironmentalEffect, previewEnvironmentalEffect} from './execution.mjs';
import {createPresetMacro, deletePresetMacro, discoverPresets, duplicatePresetMacro, foundryMacroRepository, updatePresetMacro} from './macros.mjs';
import {buildEnvironmentalItemData, ensureEnvironmentalActor, resolveEnvironmentalWorkflow} from './midi.mjs';
import {normalizePreset, validateMechanics, validatePreset} from './model.mjs';
import {assertAnimation, listAnimationPaths, openEffectManager, playEffect, previewEffect, searchAnimationPaths} from './sequencer.mjs';
import {createEffectStudioClass, parseMechanicsForm, parsePresetForm, renderMechanicsDialog} from './studio.mjs';
import {collectSceneTokens, collectTemplateTokens, filterAudience, sceneArea} from './targeting.mjs';

function formValues(app) {
  const form = app.element.querySelector('form');
  return new globalThis.foundry.applications.ux.FormDataExtended(form).object;
}

function showFormDialog({title, content, confirmLabel}) {
  const {DialogV2} = globalThis.foundry.applications.api;
  return new Promise(resolve => {
    let settled = false;
    const finish = value => { if (!settled) { settled = true; resolve(value); } };
    const dialog = new DialogV2({
      window: {title},
      content,
      buttons: [
        {action: 'confirm', label: confirmLabel, default: true, callback: (_event, _button, app) => formValues(app)},
        {action: 'cancel', label: game.i18n.localize('Cancel'), callback: () => null}
      ],
      submit: finish
    });
    dialog.addEventListener?.('close', () => finish(null));
    void dialog.render({force: true});
  });
}

async function configurePlacement(placement) {
  if (placement.mode === 'scene') return placement;
  const content = `<form class="gac-environment-placement"><label>${game.i18n.localize('GAC.EnvironmentalEffects.Distance')}<input type="number" name="distance" min="1" value="${placement.distance}"></label><label>${game.i18n.localize('GAC.EnvironmentalEffects.Width')}<input type="number" name="width" min="1" value="${placement.width}"></label></form>`;
  const values = await showFormDialog({title: game.i18n.localize('GAC.EnvironmentalEffects.Placement'), content, confirmLabel: game.i18n.localize('GAC.EnvironmentalEffects.Place')});
  if (!values) return null;
  const distance = Number(values.distance);
  const width = Number(values.width);
  if (!(distance > 0) || !(width > 0)) throw new Error('Template distance and width must be positive.');
  return {...placement, distance, width};
}

async function placeTemplate(placement, actor) {
  const itemData = buildEnvironmentalItemData({damage: '', damageType: '', saveAbility: '', dc: null, saveMode: 'half'});
  const activityId = Object.keys(itemData.system.activities)[0];
  itemData.name = 'Environmental Effect Area';
  itemData.system.activities[activityId].name = 'Environmental Effect Area';
  itemData.system.activities[activityId].target = {
    template: {type: placement.shape, size: placement.distance, width: placement.width, units: 'ft'},
    affects: {type: 'creature'},
    prompt: true,
    override: true
  };
  const item = new globalThis.CONFIG.Item.documentClass(itemData, {parent: actor});
  const activity = item.system.activities?.get?.(activityId) ?? item.system.activities?.[activityId];
  const AbilityTemplate = globalThis.game.dnd5e.canvas.AbilityTemplate;
  const preview = await (AbilityTemplate.fromActivity
    ? AbilityTemplate.fromActivity(activity)
    : AbilityTemplate.fromItem(item));
  const template = await preview?.drawPreview?.();
  if (!template) return null;
  const document = template.document ?? template;
  return {
    template: document,
    location: {x: document.x, y: document.y, width: placement.distance, height: placement.distance}
  };
}

function namedTokens(tokens) {
  return tokens.map(token => ({id: token.id, name: token.name ?? token.actor?.name ?? 'Token'}));
}

function choiceData() {
  const conditions = Array.from(globalThis.CONFIG.statusEffects ?? []).map(effect => ({id: effect.id, name: game.i18n.localize(effect.name)}));
  const damageTypes = Object.entries(globalThis.CONFIG.DND5E?.damageTypes ?? {}).map(([id, data]) => ({id, name: game.i18n.localize(data.label ?? data)}));
  return {conditions, damageTypes};
}

async function chooseTargets(targets, mechanics) {
  const choices = choiceData();
  const content = renderMechanicsDialog({targets: namedTokens(targets), mechanics, ...choices}, {localize: key => game.i18n.localize(key)});
  const values = await showFormDialog({title: game.i18n.localize('GAC.EnvironmentalEffects.Resolve'), content, confirmLabel: game.i18n.localize('GAC.EnvironmentalEffects.Resolve')});
  if (!values) return null;
  const parsed = parseMechanicsForm(values);
  const selected = new Set(parsed.targets);
  return {...parsed, targets: targets.filter(token => selected.has(token.id))};
}

function previewSource(database, path) {
  if (!path) return '';
  const entry = database.getEntry(path, {softFail: true});
  const file = entry?.file ?? entry;
  if (typeof file === 'string') return file;
  if (Array.isArray(file)) return file.find(value => typeof value === 'string') ?? '';
  return '';
}

export function createEnvironmentalRuntime() {
  const repository = foundryMacroRepository();
  const database = globalThis.Sequencer?.Database;
  let studio;
  let query = '';
  let selectedId = null;
  let draft = null;

  const list = () => discoverPresets(game.macros);
  const selectedRow = () => {
    const rows = list();
    const id = selectedId ?? rows[0]?.preset.id;
    return rows.find(row => row.preset.id === id);
  };
  const selectedPreset = () => draft ?? selectedRow()?.preset ?? null;
  const allPaths = () => database ? listAnimationPaths(database) : [];

  async function executePreset(preset) {
    if (!game.user.isGM) throw new Error('Only a GM can resolve environmental effects.');
    if (!database) throw new Error('Sequencer is required.');
    const sourceActor = await ensureEnvironmentalActor(game.actors);
    return executeEnvironmentalEffect(preset, {
      configurePlacement,
      placeTemplate: placement => placeTemplate(placement, sourceActor),
      sceneArea: () => sceneArea(globalThis.canvas.scene),
      collectTokens: area => area.type === 'scene' ? collectSceneTokens(globalThis.canvas.scene.tokens) : collectTemplateTokens(globalThis.canvas.scene.tokens, area.template),
      filterAudience,
      chooseTargets,
      validateMechanics,
      assertAnimation: path => assertAnimation(database, path),
      playEffect: (value, location) => playEffect(value, location),
      resolveMidi: async ({mechanics, targets}) => resolveEnvironmentalWorkflow({itemData: buildEnvironmentalItemData(mechanics), actor: sourceActor, targets}),
      applyConditions: (tokens, condition, duration) => applyConditionToTokens(tokens, condition, duration),
      saveMechanics: async (id, mechanics) => {
        const row = list().find(entry => entry.preset.id === id);
        if (row) await updatePresetMacro(row.macro, {...row.preset, mechanics}, repository);
      }
    });
  }

  const controller = {
    list,
    model() {
      const selected = selectedPreset();
      const rows = list().filter(row => row.preset.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
      return {presets: rows, selected, query, animationPaths: searchAnimationPaths(allPaths(), query), previewSrc: selected && database ? previewSource(database, selected.animation) : ''};
    },
    setQuery(value) { query = value; },
    async run(id) {
      const row = list().find(entry => entry.preset.id === id);
      if (!row) throw new Error(`Environmental effect preset not found: ${id}`);
      return executePreset(row.preset);
    },
    async action(action, root, data) {
      if (action === 'select') { selectedId = data.presetId; draft = null; return; }
      if (action === 'new') {
        draft = normalizePreset({id: globalThis.foundry.utils.randomID(), name: 'New Environmental Effect', animation: '', placement: {distance: 10, width: 5}});
        selectedId = draft.id;
        return;
      }
      if (action === 'manageEffects') return openEffectManager();
      const form = root.querySelector('[data-form="preset"]');
      if (!form) return;
      const values = new globalThis.foundry.applications.ux.FormDataExtended(form).object;
      const current = validatePreset(parsePresetForm(values, selectedPreset()?.mechanics));
      if (action === 'save') {
        const row = selectedRow();
        if (row) await updatePresetMacro(row.macro, current, repository); else await createPresetMacro(current, repository);
        selectedId = current.id; draft = null;
      }
      if (action === 'run') {
        const row = selectedRow();
        if (row) await updatePresetMacro(row.macro, current, repository); else await createPresetMacro(current, repository);
        selectedId = current.id; draft = null;
        await executePreset(current);
      }
      if (action === 'duplicate') { const created = await duplicatePresetMacro(current, repository, () => globalThis.foundry.utils.randomID()); selectedId = created.flags[MODULE_ID].environmentalEffect.id; draft = null; }
      if (action === 'delete') {
        const row = selectedRow();
        const confirmed = row && await globalThis.foundry.applications.api.DialogV2.confirm({window: {title: 'Delete preset?'}, content: '<p>Delete this environmental effect preset?</p>'});
        if (confirmed) {
          await deletePresetMacro(row.macro, repository);
          selectedId = null;
          draft = null;
        }
      }
      if (action === 'previewCanvas') {
        const sourceActor = await ensureEnvironmentalActor(game.actors);
        const placement = await configurePlacement(current.placement);
        if (!placement) return;
        const area = placement.mode === 'scene' ? sceneArea(globalThis.canvas.scene) : await placeTemplate(placement, sourceActor);
        if (!area) return;
        try { await previewEnvironmentalEffect(current, area.location, {assertAnimation: path => assertAnimation(database, path), previewEffect: (value, location) => previewEffect(value, location)}); }
        finally { await area.template?.delete?.(); }
      }
    }
  };

  const Studio = createEffectStudioClass(controller);
  return {
    controller,
    open: async () => { studio ??= new Studio(); await studio.render({force: true}); }
  };
}
