import assert from 'node:assert/strict';
import test from 'node:test';
import {confirmOverlayClose} from '../scripts/presentations/display.mjs';

class FakeElement {
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.removed = false; }
  setAttribute() {}
  addEventListener(type, callback) { this.listeners[type] = callback; }
  append(...children) { this.children.push(...children); }
  remove() { this.removed = true; }
  focus() { this.focused = true; }
}

test('renders player close confirmation inside the fullscreen overlay', async () => {
  const overlay = new FakeElement('overlay');
  const promise = confirmOverlayClose({
    document: {createElement: tag => new FakeElement(tag)},
    overlay,
    localize: key => key
  });
  const prompt = overlay.children[0];
  assert.equal(prompt.className, 'gac-presentation-confirm');
  assert.equal(prompt.children[2].focused, true);
  prompt.children[3].listeners.click();
  assert.equal(await promise, true);
  assert.equal(prompt.removed, true);
});
