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

export function showFormDialog({title, content, confirmLabel}) {
  const {DialogV2} = globalThis.foundry.applications.api;
  return new Promise(resolve => {
    let settled = false;
    let submittedValue = null;
    const finish = value => { if (!settled) { settled = true; resolve(value); } };
    const dialog = new DialogV2({
      window: {title},
      content,
      buttons: [
        {action: 'confirm', label: confirmLabel, default: true, callback: (_event, _button, app) => formValues(app)},
        {action: 'cancel', label: game.i18n.localize('Cancel'), callback: () => null}
      ],
      // DialogV2 invokes submit before it has finished closing. Resolving here
      // lets callers open a canvas preview while the modal backdrop is still
      // active, which makes measured-template placement appear to hang.
      submit: value => { submittedValue = value; }
    });
    dialog.addEventListener?.('close', () => finish(submittedValue));
    void dialog.render({force: true});
  });
}

async function configurePlacement(placement) {
  if (placement.mode === 'scene') return placement;
  const widthField = placement.shape === 'line'
    ? `<label>${game.i18n.localize('GAC.EnvironmentalEffects.RayWidth')}<input type="number" name="width" min="1" value="${placement.width}"></label>`
    : `<input type="hidden" name="width" value="${placement.width}">`;
  const content = `<form class="gac-environment-placement"><label>${game.i18n.localize('GAC.EnvironmentalEffects.TemplateSize')}<input type="number" name="distance" min="1" value="${placement.distance}"><span class="hint">${game.i18n.localize('GAC.EnvironmentalEffects.TemplateSizeHint')}</span></label>${widthField}</form>`;
  const values = await showFormDialog({title: game.i18n.localize('GAC.EnvironmentalEffects.Placement'), content, confirmLabel: game.i18n.localize('GAC.EnvironmentalEffects.Place')});
  if (!values) return null;
  const distance = Number(values.distance);
  const width = Number(values.width);
  if (!(distance > 0) || !(width > 0)) throw new Error('Template distance and width must be positive.');
  return {...placement, distance, width};
}

function regionShape(placement, distancePixels) {
  const distance = placement.distance * distancePixels;
  const width = placement.width * distancePixels;
  if (placement.shape === 'cone') return {type: 'cone', x: 0, y: 0, radius: distance, angle: 53.13, rotation: 0, gridBased: true};
  if (placement.shape === 'line') return {type: 'line', x: 0, y: 0, distance, width, rotation: 0, gridBased: true};
  if (placement.shape === 'square') return {type: 'rectangle', x: 0, y: 0, width: distance, height: distance, rotation: 0, gridBased: true};
  return {type: 'circle', x: 0, y: 0, radius: distance, gridBased: true};
}

export function buildRegionPlacementData(placement, dimensions, user) {
  return {
    name: 'Environmental Effect Area',
    shapes: [regionShape(placement, dimensions.distancePixels)],
    color: user.color,
    restriction: {enabled: false},
    highlightMode: 'coverage',
    displayMeasurements: true,
    ownership: {[user.id]: 3}
  };
}

export async function placeTemplate(placement) {
  const regionData = buildRegionPlacementData(placement, globalThis.canvas.dimensions, globalThis.game.user);
  const region = await globalThis.canvas.regions.placeRegion(regionData, {create: false});
  if (!region) return null;
  const bounds = region.bounds;
  return {
    type: 'region',
    region,
    location: {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
      width: bounds.width,
      height: bounds.height
    }
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

function previewFile(entry, path) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry;
  if (Array.isArray(entry)) {
    for (const value of entry) {
      const file = previewFile(value, path);
      if (file) return file;
    }
    return '';
  }
  const clone = entry.clone?.() ?? entry;
  const preview = clone.getPreviewFile?.(path);
  if (preview) return previewFile(preview, path);
  if (entry.file) return previewFile(entry.file, path);
  const files = entry.getAllFiles?.();
  return previewFile(files, path);
}

export function previewSource(database, path) {
  if (!path) return '';
  const entry = database.getEntry(path, {softFail: true});
  return previewFile(entry, path);
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
      placeTemplate,
      sceneArea: () => sceneArea(globalThis.canvas.scene),
      collectTokens: area => area.type === 'scene' ? collectSceneTokens(globalThis.canvas.scene.tokens) : collectTemplateTokens(globalThis.canvas.scene.tokens, area.region),
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
      return {
        presets: rows,
        selected,
        query,
        animationPaths: searchAnimationPaths(allPaths(), query),
        activationPreviewSrc: selected && database ? previewSource(database, selected.animation) : '',
        lingeringPreviewSrc: selected && database ? previewSource(database, selected.lingeringAnimation) : ''
      };
    },
    setQuery(value) { query = value; },
    previewAnimation(root, field = 'animation') {
      const form = root.querySelector('[data-form="preset"]');
      if (!form || !database) return '';
      const values = new globalThis.foundry.applications.ux.FormDataExtended(form).object;
      draft = parsePresetForm(values, selectedPreset()?.mechanics);
      selectedId = draft.id;
      return previewSource(database, field === 'lingeringAnimation' ? draft.lingeringAnimation : draft.animation);
    },
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
        const placement = await configurePlacement(current.placement);
        if (!placement) return;
        const area = placement.mode === 'scene' ? sceneArea(globalThis.canvas.scene) : await placeTemplate(placement);
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
