import assert from 'node:assert/strict';
import test from 'node:test';
import {canShow, connectedPlayers, escapeHtml, renderPresentationBrowser, toggleAllRecipients} from '../scripts/presentations/browser.mjs';

test('selects only connected non-GM users', () => {
  const players = connectedPlayers([
    {id: 'gm', name: 'GM', active: true, isGM: true},
    {id: 'a', name: 'Alice', active: true, isGM: false},
    {id: 'b', name: 'Bob', active: false, isGM: false}
  ]);
  assert.deepEqual(players, [{id: 'a', name: 'Alice'}]);
  assert.deepEqual([...toggleAllRecipients(players, false)], ['a']);
  assert.equal(canShow({selectedImage: '/view.webp', recipients: new Set(['a'])}), true);
});

test('renders safe lazy thumbnails and presentation actions', () => {
  const html = renderPresentationBrowser({
    entries: [{url: '/x.webp', filename: '<View>', relativePath: 'A/<View>'}],
    users: [{id: 'a', name: '<Alice>'}], recipients: new Set(['a']), selectedImage: '/x.webp',
    query: '', warnings: [], config: {source: 'forgevtt', root: 'assets/wildemount/presentations'}, activePresentation: null
  }, {localize: key => key});
  assert.match(html, /loading="lazy"/);
  assert.match(html, /showStandard/);
  assert.match(html, /showFullscreen/);
  assert.doesNotMatch(html, /<Alice>/);
  assert.equal(escapeHtml('<&"'), '&lt;&amp;&quot;');
});
