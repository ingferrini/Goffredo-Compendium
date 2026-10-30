import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCloseMessage,
  createShowMessage,
  isActiveGmSender,
  isMessageForUser,
  normalizePresentationMessage
} from '../scripts/presentations/protocol.mjs';

const show = {
  version: 1, type: 'show', presentationId: 'p-123', mode: 'fullscreen',
  imageUrl: 'https://assets.forge-vtt.com/view.webp', recipients: ['player-a'], senderId: 'gm-a'
};

test('normalizes valid messages and filters recipients', () => {
  const result = normalizePresentationMessage(show);
  assert.ok(Object.isFrozen(result));
  assert.equal(isMessageForUser(result, 'player-a'), true);
  assert.equal(isMessageForUser(result, 'player-b'), false);
});

test('rejects malformed messages', () => {
  assert.equal(normalizePresentationMessage({...show, version: 2}), null);
  assert.equal(normalizePresentationMessage({...show, mode: 'giant'}), null);
  assert.equal(normalizePresentationMessage({...show, recipients: []}), null);
});

test('recognizes only an active GM sender and constructs messages', () => {
  assert.equal(isActiveGmSender(show, [{id: 'gm-a', active: true, isGM: true}]), true);
  assert.equal(isActiveGmSender(show, [{id: 'gm-a', active: false, isGM: true}]), false);
  assert.equal(createShowMessage(show).type, 'show');
  assert.equal(createCloseMessage({...show}).type, 'close');
});
