import {MODULE_ID} from '../constants.mjs';
import {escapeHtml} from '../presentations/browser.mjs';
import {normalizeMechanics, normalizePreset} from './model.mjs';

export const STUDIO_OPTIONS = Object.freeze({
  id: `${MODULE_ID}-environmental-effects`,
  window: {title: 'GAC.EnvironmentalEffects.Title', icon: 'fa-solid fa-explosion', resizable: true},
  position: {width: 1100, height: 760}
});

function options(values, selected) {
  return values.map(({id, name}) => `<option value="${escapeHtml(id)}"${id === selected ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('');
}

export function parsePresetForm(values, mechanics = {}) {
  return normalizePreset({
    id: values.id,
    name: values.name,
    icon: values.icon || 'icons/svg/explosion.svg',
    animation: values.animation,
    lingeringAnimation: values.lingeringAnimation,
    activationCoverage: values.activationCoverage,
    lingeringCoverage: values.lingeringCoverage,
    showOutline: values.showOutline === true || values.showOutline === 'on',
    sound: values.sound,
    persistent: values.persistent === true || values.persistent === 'on',
    placement: {mode: values.placementMode, shape: values.templateShape, distance: values.templateDistance, width: values.templateWidth},
    audience: values.audience,
    mechanics
  });
}

export function parseMechanicsForm(values) {
  const nestedTargets = values.target && typeof values.target === 'object'
    ? Object.entries(values.target)
    : [];
  const flatTargets = Object.entries(values)
    .filter(([key]) => key.startsWith('target.'))
    .map(([key, value]) => [key.slice(7), value]);
  return {
    targets: [...new Set([...nestedTargets, ...flatTargets]
      .filter(([, value]) => value === true || value === 'on')
      .map(([id]) => id))],
    visualOnly: values.visualOnly === true || values.visualOnly === 'on',
    mechanics: normalizeMechanics({
      damage: values.damage,
      damageType: values.damageType,
      condition: values.condition,
      saveAbility: values.saveAbility,
      dc: values.dc,
      saveMode: values.saveMode,
      duration: {value: values.durationValue, unit: values.durationUnit}
    })
  };
}

export function renderEffectStudio(model, {localize}) {
  const selected = model.selected;
  const cards = model.presets.map(({preset}) => `<button type="button" class="gac-environment-card${selected?.id === preset.id ? ' selected' : ''}" data-action="select" data-preset-id="${escapeHtml(preset.id)}"><img src="${escapeHtml(preset.icon)}" alt=""><span>${escapeHtml(preset.name)}</span></button>`).join('');
  const paths = model.animationPaths.map(path => `<option value="${escapeHtml(path)}"></option>`).join('');
  return `<section class="gac-environment-studio">
    <aside class="gac-environment-list">
      <header><h2>${localize('GAC.EnvironmentalEffects.Catalog')}</h2><button type="button" data-action="new">+</button></header>
      <input type="search" data-field="query" value="${escapeHtml(model.query)}" placeholder="${localize('GAC.EnvironmentalEffects.Search')}">
      <div class="gac-environment-cards">${cards || `<p>${localize('GAC.EnvironmentalEffects.Empty')}</p>`}</div>
    </aside>
    <main class="gac-environment-visual">
      ${selected ? `<form data-form="preset">
        <input type="hidden" name="id" value="${escapeHtml(selected.id)}">
        <label>${localize('GAC.EnvironmentalEffects.Name')}<input name="name" value="${escapeHtml(selected.name)}"></label>
        <label>${localize('GAC.EnvironmentalEffects.Icon')}<input name="icon" value="${escapeHtml(selected.icon)}"></label>
        <label>${localize('GAC.EnvironmentalEffects.ActivationAnimation')}<input name="animation" data-animation-field="animation" list="gac-animation-paths" value="${escapeHtml(selected.animation)}"></label>
        <label class="gac-environment-coverage">${localize('GAC.EnvironmentalEffects.ActivationCoverage')}<input type="number" name="activationCoverage" min="50" max="250" step="5" value="${selected.activationCoverage}"><span class="hint">${localize('GAC.EnvironmentalEffects.CoverageHint')}</span></label>
        <label data-lingering-controls${selected.persistent ? '' : ' hidden'}>${localize('GAC.EnvironmentalEffects.LingeringAnimation')}<input name="lingeringAnimation" data-animation-field="lingeringAnimation" list="gac-animation-paths" value="${escapeHtml(selected.lingeringAnimation)}"></label>
        <label class="gac-environment-coverage" data-lingering-controls${selected.persistent ? '' : ' hidden'}>${localize('GAC.EnvironmentalEffects.LingeringCoverage')}<input type="number" name="lingeringCoverage" min="50" max="250" step="5" value="${selected.lingeringCoverage}"><span class="hint">${localize('GAC.EnvironmentalEffects.CoverageHint')}</span></label>
        <datalist id="gac-animation-paths">${paths}</datalist>
        <label>${localize('GAC.EnvironmentalEffects.Sound')}<input name="sound" value="${escapeHtml(selected.sound)}"></label>
        <div class="gac-environment-preview-grid">
          <figure><figcaption>${localize('GAC.EnvironmentalEffects.Activation')}</figcaption><div class="gac-environment-preview" data-preview="activation">${model.activationPreviewSrc ? `<video src="${escapeHtml(model.activationPreviewSrc)}" autoplay loop muted></video>` : `<i class="fa-solid fa-film"></i>`}</div></figure>
          <figure data-lingering-controls${selected.persistent ? '' : ' hidden'}><figcaption>${localize('GAC.EnvironmentalEffects.Lingering')}</figcaption><div class="gac-environment-preview" data-preview="lingering">${model.lingeringPreviewSrc ? `<video src="${escapeHtml(model.lingeringPreviewSrc)}" autoplay loop muted></video>` : `<i class="fa-solid fa-film"></i>`}</div></figure>
        </div>
        <div class="gac-environment-fields">
          <label>${localize('GAC.EnvironmentalEffects.Placement')}<select name="placementMode"><option value="template"${selected.placement.mode === 'template' ? ' selected' : ''}>Template</option><option value="scene"${selected.placement.mode === 'scene' ? ' selected' : ''}>Whole scene</option></select></label>
          <label>${localize('GAC.EnvironmentalEffects.Shape')}<select name="templateShape">${options([{id: 'circle', name: 'Circle'}, {id: 'cone', name: 'Cone'}, {id: 'line', name: 'Line'}, {id: 'square', name: 'Square'}], selected.placement.shape)}</select></label>
          <label>${localize('GAC.EnvironmentalEffects.TemplateSize')}<input type="number" name="templateDistance" min="1" value="${selected.placement.distance}"><span class="hint">${localize('GAC.EnvironmentalEffects.TemplateSizeHint')}</span></label>
          <label data-template-width${selected.placement.shape === 'line' ? '' : ' hidden'}>${localize('GAC.EnvironmentalEffects.RayWidth')}<input type="number" name="templateWidth" min="1" value="${selected.placement.width}"></label>
          <label>${localize('GAC.EnvironmentalEffects.Audience')}<select name="audience">${options([{id: 'allies', name: 'Allies'}, {id: 'pcs', name: 'Player Characters'}, {id: 'enemies', name: 'Enemies'}, {id: 'everyone', name: 'Everyone'}], selected.audience)}</select></label>
          <label><input type="checkbox" name="persistent" data-field="persistent"${selected.persistent ? ' checked' : ''}> ${localize('GAC.EnvironmentalEffects.Persistent')}</label>
          <label data-lingering-controls${selected.persistent ? '' : ' hidden'}><input type="checkbox" name="showOutline"${selected.showOutline ? ' checked' : ''}> ${localize('GAC.EnvironmentalEffects.ShowOutline')}</label>
        </div>
      </form>` : `<p>${localize('GAC.EnvironmentalEffects.Select')}</p>`}
    </main>
    <aside class="gac-environment-actions">
      <button type="button" data-action="previewCanvas"${selected ? '' : ' disabled'}>${localize('GAC.EnvironmentalEffects.PreviewCanvas')}</button>
      <button type="button" data-action="save"${selected ? '' : ' disabled'}>${localize('GAC.EnvironmentalEffects.Save')}</button>
      <button type="button" data-action="run"${selected ? '' : ' disabled'}>${localize('GAC.EnvironmentalEffects.Run')}</button>
      <button type="button" data-action="duplicate"${selected ? '' : ' disabled'}>${localize('GAC.EnvironmentalEffects.Duplicate')}</button>
      <button type="button" data-action="delete"${selected ? '' : ' disabled'}>${localize('GAC.EnvironmentalEffects.Delete')}</button>
      <button type="button" data-action="manageEffects">${localize('GAC.EnvironmentalEffects.Manage')}</button>
      ${selected ? `<hr><h3>${localize('GAC.EnvironmentalEffects.LastMechanics')}</h3><p>${escapeHtml(selected.mechanics.damage || '—')} ${escapeHtml(selected.mechanics.damageType)}<br>${escapeHtml(selected.mechanics.condition || '—')}</p>` : ''}
    </aside>
  </section>`;
}

export function renderMechanicsDialog(model, {localize}) {
  const mechanics = normalizeMechanics(model.mechanics);
  const targets = model.targets.map(target => `<label><input type="checkbox" name="target.${escapeHtml(target.id)}" checked> ${escapeHtml(target.name)}</label>`).join('');
  return `<form class="gac-environment-mechanics">
    <fieldset><legend>${localize('GAC.EnvironmentalEffects.Targets')}</legend>${targets}</fieldset>
    <label>${localize('GAC.EnvironmentalEffects.Damage')}<input name="damage" value="${escapeHtml(mechanics.damage)}"></label>
    <label>${localize('GAC.EnvironmentalEffects.DamageType')}<select name="damageType"><option value=""></option>${options(model.damageTypes, mechanics.damageType)}</select></label>
    <label>${localize('GAC.EnvironmentalEffects.Condition')}<select name="condition"><option value=""></option>${options(model.conditions, mechanics.condition)}</select></label>
    <label>${localize('GAC.EnvironmentalEffects.SaveAbility')}<select name="saveAbility">${options([{id: '', name: 'None'}, {id: 'str', name: 'Strength'}, {id: 'dex', name: 'Dexterity'}, {id: 'con', name: 'Constitution'}, {id: 'int', name: 'Intelligence'}, {id: 'wis', name: 'Wisdom'}, {id: 'cha', name: 'Charisma'}], mechanics.saveAbility)}</select></label>
    <label>${localize('GAC.EnvironmentalEffects.DC')}<input type="number" name="dc" min="1" value="${mechanics.dc ?? ''}"></label>
    <label>${localize('GAC.EnvironmentalEffects.SaveMode')}<select name="saveMode">${options([{id: 'half', name: 'Save halves'}, {id: 'negates', name: 'Save negates'}], mechanics.saveMode)}</select></label>
    <label>${localize('GAC.EnvironmentalEffects.Duration')}<input type="number" name="durationValue" min="1" value="${mechanics.duration.value ?? ''}"><select name="durationUnit">${options([{id: 'turn', name: 'Turns'}, {id: 'round', name: 'Rounds'}, {id: 'minute', name: 'Minutes'}, {id: 'hour', name: 'Hours'}], mechanics.duration.unit)}</select></label>
    <label><input type="checkbox" name="visualOnly"> ${localize('GAC.EnvironmentalEffects.VisualOnly')}</label>
  </form>`;
}

export function createEffectStudioClass(controller) {
  const {ApplicationV2} = globalThis.foundry.applications.api;
  return class EffectStudio extends ApplicationV2 {
    static DEFAULT_OPTIONS = STUDIO_OPTIONS;
    async _renderHTML() { return renderEffectStudio(controller.model(), {localize: key => game.i18n.localize(key)}); }
    _replaceHTML(result, content) { content.innerHTML = result; }
    _onRender(context, options_) {
      super._onRender(context, options_);
      const root = this.element;
      for (const input of root.querySelectorAll('[data-animation-field]')) input.addEventListener('input', () => {
        const field = input.dataset.animationField;
        const target = field === 'lingeringAnimation' ? 'lingering' : 'activation';
        const src = controller.previewAnimation(root, field);
        const preview = root.querySelector(`[data-preview="${target}"]`);
        if (!preview) return;
        preview.replaceChildren();
        const media = globalThis.document.createElement(src ? 'video' : 'i');
        if (src) {
          media.src = src;
          media.autoplay = true;
          media.loop = true;
          media.muted = true;
        } else media.className = 'fa-solid fa-film';
        preview.append(media);
      });
      root.querySelector('[data-field="persistent"]')?.addEventListener('change', event => {
        for (const element of root.querySelectorAll('[data-lingering-controls]')) element.hidden = !event.target.checked;
      });
      const shape = root.querySelector('[name="templateShape"]');
      shape?.addEventListener('change', () => {
        const width = root.querySelector('[data-template-width]');
        if (width) width.hidden = shape.value !== 'line';
      });
      root.querySelector('[data-field="query"]')?.addEventListener('input', event => { controller.setQuery(event.target.value); void this.render(); });
      for (const button of root.querySelectorAll('[data-action]')) button.addEventListener('click', async () => {
        await controller.action(button.dataset.action, root, button.dataset);
        await this.render();
      });
    }
  };
}
