import {MODULE_ID} from '../constants.mjs';
import {connectedPlayers, createPresentationBrowserClass, toggleAllRecipients} from './browser.mjs';
import {createPresentationDisplay} from './display.mjs';
import {defaultPresentationRoot, indexPresentationLibrary, normalizeLibraryConfig, searchPresentationLibrary} from './library.mjs';
import {createCloseMessage, createShowMessage, isActiveGmSender, isMessageForUser, normalizePresentationMessage} from './protocol.mjs';

export const LIBRARY_SETTING = 'presentationLibrary';
export const ACTIVE_PRESENTATION_SETTING = 'activePresentation';
export const PRESENTATION_SOCKET = `module.${MODULE_ID}`;
let openPresentationBrowser = () => {};

export function registerPresentationSettings(settings, worldId) {
  settings.register(MODULE_ID, LIBRARY_SETTING, {scope: 'world', config: false, type: Object, default: {source: 'forgevtt', root: defaultPresentationRoot(worldId)}});
  settings.register(MODULE_ID, ACTIVE_PRESENTATION_SETTING, {scope: 'world', config: false, type: Object, default: {}});
}

export function registerPresentationControl(hooks, deps = {}) {
  hooks.on('getSceneControlButtons', controls => {
    const isGM = deps.isGM?.() ?? globalThis.game?.user?.isGM;
    if (!isGM || !controls.tokens?.tools) return;
    controls.tokens.tools['gac-presentations'] = {
      name: 'gac-presentations',
      title: 'GAC.Presentations.Control.Title',
      icon: 'fa-solid fa-images',
      order: Object.keys(controls.tokens.tools).length,
      button: true,
      visible: true,
      onChange: deps.open ?? (() => openPresentationBrowser())
    };
  });
}

export function registerPresentations() {
  if (!globalThis.document) return;
  const display = createPresentationDisplay({
    document: globalThis.document,
    openImage: async ({url, title}) => {
      const Popout = globalThis.foundry?.applications?.apps?.ImagePopout ?? globalThis.ImagePopout;
      const app = new Popout(url, {title, shareable: false}); await app.render(true); return app;
    },
    confirmLocalClose: () => globalThis.Dialog.confirm({title: game.i18n.localize('GAC.Presentations.Actions.Close'), content: `<p>${game.i18n.localize('GAC.Presentations.Overlay.Confirm')}</p>`}),
    localize: key => game.i18n.localize(key), notifyError: message => ui.notifications.error(message)
  });
  let entries = [], warnings = [], query = '', selectedImage = null, recipients = new Set(), browser = null, activePresentation = null;
  const users = () => connectedPlayers(game.users);
  const controller = {
    model: () => ({entries: searchPresentationLibrary(entries, query), warnings, query, selectedImage, recipients, users: users(), config: normalizeLibraryConfig(game.settings.get(MODULE_ID, LIBRARY_SETTING), game.world.id), activePresentation}),
    setQuery: value => { query = value; }, selectImage: value => { selectedImage = value; },
    setRecipient: (id, checked) => { checked ? recipients.add(id) : recipients.delete(id); },
    async action(action, element) {
      if (action === 'selectAllPlayers') recipients = toggleAllRecipients(users(), users().every(user => recipients.has(user.id)));
      if (action === 'refreshLibrary') {
        const config = normalizeLibraryConfig({source: element.querySelector('[data-field="source"]').value, root: element.querySelector('[data-field="root"]').value}, game.world.id);
        await game.settings.set(MODULE_ID, LIBRARY_SETTING, config);
        ({entries, warnings} = await indexPresentationLibrary(config, {browse: (source, path) => globalThis.FilePicker.browse(source, path)}));
      }
      if (action === 'selectRoot') {
        const current = element.querySelector('[data-field="root"]').value;
        new globalThis.FilePicker({type: 'folder', current, callback: async path => { element.querySelector('[data-field="root"]').value = path; await controller.action('refreshLibrary', element); void browser.render(); }}).browse();
      }
      if (action === 'showStandard') await show('standard');
      if (action === 'showFullscreen') await show('fullscreen');
      if (action === 'closePresentation') await close();
    }
  };
  async function emit(message) { game.socket.emit(PRESENTATION_SOCKET, message); if (isMessageForUser(message, game.user.id)) await receive(message); }
  async function show(mode) {
    if (!game.user.isActiveGM || !selectedImage || !recipients.size) return;
    if (activePresentation) await close();
    const message = createShowMessage({presentationId: globalThis.foundry.utils.randomID(), mode, imageUrl: selectedImage, recipients: [...recipients], senderId: game.user.id});
    activePresentation = message;
    await game.settings.set(MODULE_ID, ACTIVE_PRESENTATION_SETTING, mode === 'fullscreen' ? message : {});
    await emit(message);
  }
  async function close() {
    if (!game.user.isActiveGM || !activePresentation) return;
    const message = createCloseMessage(activePresentation); activePresentation = null;
    await game.settings.set(MODULE_ID, ACTIVE_PRESENTATION_SETTING, {}); await emit(message);
  }
  async function receive(raw) {
    const message = normalizePresentationMessage(raw);
    if (!message || !isActiveGmSender(message, game.users) || !isMessageForUser(message, game.user.id)) return;
    if (message.type === 'close') await display.close({presentationId: message.presentationId}); else await display.show(message);
  }
  game.socket.on(PRESENTATION_SOCKET, receive);
  const stored = normalizePresentationMessage(game.settings.get(MODULE_ID, ACTIVE_PRESENTATION_SETTING));
  if (stored?.mode === 'fullscreen') { activePresentation = stored; void receive(stored); }
  const Browser = createPresentationBrowserClass(controller);
  openPresentationBrowser = async () => {
    browser ??= new Browser();
    await browser.render({force: true});
    if (!entries.length) {
      await controller.action('refreshLibrary', browser.element);
      await browser.render();
    }
  };
}
