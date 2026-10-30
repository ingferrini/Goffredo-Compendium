export function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

export function connectedPlayers(users) {
  return [...(users ?? [])].filter(user => user.active && !user.isGM).map(({id, name}) => ({id, name}));
}

export function toggleAllRecipients(users, currentlyAllSelected) {
  return currentlyAllSelected ? new Set() : new Set(users.map(user => user.id));
}

export function canShow({selectedImage, recipients}) {
  return Boolean(selectedImage && recipients?.size);
}

export function renderPresentationBrowser(model, {localize}) {
  const disabled = canShow(model) ? '' : ' disabled';
  const players = model.users.map(user => `<label><input type="checkbox" data-recipient="${escapeHtml(user.id)}"${model.recipients.has(user.id) ? ' checked' : ''}> ${escapeHtml(user.name)}</label>`).join('');
  const images = model.entries.map(entry => `<label class="gac-presentation-card"><input type="radio" name="presentation-image" value="${escapeHtml(entry.url)}"${model.selectedImage === entry.url ? ' checked' : ''}><img src="${escapeHtml(entry.url)}" loading="lazy" alt=""><span>${escapeHtml(entry.relativePath)}</span></label>`).join('');
  return `<section class="gac-presentation-browser">
    <div class="gac-presentation-config"><input data-field="source" value="${escapeHtml(model.config.source)}" aria-label="Source"><input data-field="root" value="${escapeHtml(model.config.root)}" aria-label="Folder"><button type="button" data-action="selectRoot">${localize('GAC.Presentations.Actions.SelectFolder')}</button><button type="button" data-action="refreshLibrary">${localize('GAC.Presentations.Actions.Refresh')}</button></div>
    <input type="search" data-field="query" value="${escapeHtml(model.query)}" placeholder="${localize('GAC.Presentations.Search.Placeholder')}">
    <fieldset><legend>${localize('GAC.Presentations.Audience.Title')}</legend><button type="button" data-action="selectAllPlayers">${localize('GAC.Presentations.Audience.All')}</button>${players || `<p>${localize('GAC.Presentations.Audience.None')}</p>`}</fieldset>
    ${model.warnings.length ? `<p class="notification warning">${localize('GAC.Presentations.Library.Warnings').replace('{count}', model.warnings.length)}</p>` : ''}
    <div class="gac-presentation-grid">${images || `<p>${localize('GAC.Presentations.Library.Empty')}</p>`}</div>
    <footer><button type="button" data-action="showStandard"${disabled}>${localize('GAC.Presentations.Actions.ShowStandard')}</button><button type="button" data-action="showFullscreen"${disabled}>${localize('GAC.Presentations.Actions.ShowFullscreen')}</button>${model.activePresentation ? `<button type="button" data-action="closePresentation">${localize('GAC.Presentations.Actions.CloseEveryone')}</button>` : ''}</footer>
  </section>`;
}

export function createPresentationBrowserClass(controller) {
  const {ApplicationV2} = globalThis.foundry.applications.api;
  return class PresentationBrowser extends ApplicationV2 {
    static DEFAULT_OPTIONS = {id: 'goffredo-compendium-presentations', window: {title: 'GAC.Presentations.Browser.Title', icon: 'fas fa-images'}, position: {width: 800, height: 700}};
    async _renderHTML() { return renderPresentationBrowser(controller.model(), {localize: key => game.i18n.localize(key)}); }
    _replaceHTML(result, content) { content.innerHTML = result; }
    _onRender(context, options) {
      super._onRender(context, options);
      const root = this.element;
      root.querySelector('[data-field="query"]')?.addEventListener('input', event => { controller.setQuery(event.target.value); void this.render(); });
      root.querySelectorAll('[data-recipient]').forEach(input => input.addEventListener('change', () => { controller.setRecipient(input.dataset.recipient, input.checked); void this.render(); }));
      root.querySelectorAll('[name="presentation-image"]').forEach(input => input.addEventListener('change', () => { controller.selectImage(input.value); void this.render(); }));
      for (const button of root.querySelectorAll('[data-action]')) button.addEventListener('click', async () => { await controller.action(button.dataset.action, root); await this.render(); });
    }
  };
}
