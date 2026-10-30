export const PRESENTATION_PROTOCOL_VERSION = 1;
export const PRESENTATION_MODES = Object.freeze(['standard', 'fullscreen']);

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function normalizePresentationMessage(value) {
  if (!value || value.version !== PRESENTATION_PROTOCOL_VERSION || !['show', 'close'].includes(value.type)) return null;
  const presentationId = text(value.presentationId);
  const senderId = text(value.senderId);
  const recipients = [...new Set((Array.isArray(value.recipients) ? value.recipients : []).map(text).filter(Boolean))];
  if (!presentationId || !senderId || !recipients.length) return null;
  const base = {version: 1, type: value.type, presentationId, recipients: Object.freeze(recipients), senderId};
  if (value.type === 'close') return Object.freeze(base);
  const mode = PRESENTATION_MODES.includes(value.mode) ? value.mode : null;
  const imageUrl = text(value.imageUrl);
  if (!mode || !imageUrl) return null;
  return Object.freeze({...base, mode, imageUrl});
}

export function isMessageForUser(message, userId) {
  return Boolean(message?.recipients?.includes(userId));
}

export function isActiveGmSender(message, users) {
  return [...(users ?? [])].some(user => user.id === message?.senderId && user.active && user.isGM);
}

function construct(value) {
  const message = normalizePresentationMessage(value);
  if (!message) throw new TypeError('Invalid presentation message');
  return message;
}

export function createShowMessage(value) {
  return construct({...value, version: 1, type: 'show'});
}

export function createCloseMessage(value) {
  return construct({...value, version: 1, type: 'close'});
}
