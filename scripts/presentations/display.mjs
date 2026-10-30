const OVERLAY_ID = 'goffredo-compendium-presentation-overlay';

export function createPresentationDisplay({document, openImage, confirmLocalClose, localize, notifyError}) {
  let active = null;
  let popout = null;
  let overlay = null;
  const remove = () => { popout?.close?.(); popout = null; overlay?.remove?.(); overlay = null; active = null; };
  const requestLocalClose = async () => {
    if (!active) return false;
    if (active.mode === 'fullscreen' && !await confirmLocalClose()) return false;
    remove();
    return true;
  };
  const onKey = event => { if (event.key === 'Escape' && active?.mode === 'fullscreen') void requestLocalClose(); };
  document.addEventListener('keydown', onKey);
  return {
    async show(presentation) {
      remove();
      active = {...presentation};
      if (presentation.mode === 'standard') {
        popout = await openImage({url: presentation.imageUrl, title: presentation.filename ?? localize('GAC.Presentations.Standard.Title')});
        return;
      }
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-label', localize('GAC.Presentations.Overlay.Label'));
      const image = document.createElement('img');
      image.src = presentation.imageUrl;
      image.addEventListener('error', () => { notifyError(localize('GAC.Presentations.Errors.Image')); remove(); });
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = localize('GAC.Presentations.Actions.Close');
      button.addEventListener('click', () => void requestLocalClose());
      overlay.append(image, button); document.body.append(overlay);
    },
    async close({presentationId} = {}) { if (!active || (presentationId && active.presentationId !== presentationId)) return false; remove(); return true; },
    requestLocalClose,
    current: () => active ? {...active} : null,
    destroy() { remove(); document.removeEventListener('keydown', onKey); }
  };
}
