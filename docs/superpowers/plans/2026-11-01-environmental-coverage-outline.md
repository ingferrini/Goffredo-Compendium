# Environmental Effect Coverage and Outline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independently scalable activation and lingering visuals plus an exact, player-visible persistent outline that is removed with its Sequencer effect.

**Architecture:** Preset normalization owns backward-compatible coverage defaults. A focused geometry module converts the ephemeral Foundry v14 Region into Sequencer shape descriptors. Runtime passes bounds and descriptors to Sequencer, which applies phase-specific scale and attaches the outline to the same persistent effect section as the lingering visual.

**Tech Stack:** Foundry VTT 14 Region API, Sequencer 4 effect API, vanilla ES modules, Node built-in test runner, ESLint.

---

## File map

- Create `scripts/environmental-effects/geometry.mjs`: convert Region shapes/polygons into centre-relative Sequencer descriptors.
- Create `tests/environmental-effects-geometry.test.mjs`: cover circles, rectangles and polygon fallback used by cones/lines.
- Modify `scripts/environmental-effects/model.mjs`: normalize and clamp coverage and outline fields.
- Modify `scripts/environmental-effects/studio.mjs`: parse and render the three controls.
- Modify `scripts/environmental-effects/runtime.mjs`: include outline geometry in the canvas playback location.
- Modify `scripts/environmental-effects/sequencer.mjs`: apply coverage and attach outline shapes to the persistent effect.
- Modify `lang/en.json`: add English labels and hints.
- Modify `styles/environmental-effects.css`: keep coverage and outline controls compact.
- Modify the corresponding environmental-effect tests and `README.md`.

### Task 1: Backward-compatible preset fields

**Files:**
- Modify: `scripts/environmental-effects/model.mjs`
- Modify: `tests/environmental-effects-model.test.mjs`

- [ ] **Step 1: Write failing normalization tests**

Add assertions proving missing values become 100/100/false, numeric strings are accepted, percentages clamp to 50–250, and outline is ignored without persistence:

```js
test('normalizes visual coverage and persistent outline settings', () => {
  assert.deepEqual(
    (({activationCoverage, lingeringCoverage, showOutline}) => ({activationCoverage, lingeringCoverage, showOutline}))(normalizePreset({})),
    {activationCoverage: 100, lingeringCoverage: 100, showOutline: false}
  );
  const preset = normalizePreset({persistent: true, activationCoverage: '125', lingeringCoverage: 999, showOutline: true});
  assert.equal(preset.activationCoverage, 125);
  assert.equal(preset.lingeringCoverage, 250);
  assert.equal(preset.showOutline, true);
  assert.equal(normalizePreset({persistent: false, showOutline: true}).showOutline, false);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/environmental-effects-model.test.mjs`

Expected: FAIL because the three normalized fields are absent.

- [ ] **Step 3: Add minimal normalization**

Add a helper and fields in `normalizePreset`:

```js
function coverage(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(250, Math.max(50, number)) : 100;
}

const persistent = raw.persistent === true;
// returned preset fields
activationCoverage: coverage(raw.activationCoverage),
lingeringCoverage: coverage(raw.lingeringCoverage),
showOutline: persistent && raw.showOutline === true,
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/environmental-effects-model.test.mjs`

Expected: all model tests pass.

- [ ] **Step 5: Commit through `git-ops`**

Commit only the two task files with message `feat: store environmental visual coverage`.

### Task 2: Studio controls and serialization

**Files:**
- Modify: `scripts/environmental-effects/studio.mjs`
- Modify: `tests/environmental-effects-studio.test.mjs`
- Modify: `lang/en.json`
- Modify: `styles/environmental-effects.css`

- [ ] **Step 1: Write failing form and rendering tests**

Extend the test preset with the three normalized fields and assert parsing/rendering:

```js
test('parses and renders coverage with a persistent outline', () => {
  const result = parsePresetForm({
    id: 'fire', name: 'Fire', animation: 'jb2a.fire', persistent: 'on',
    activationCoverage: '115', lingeringCoverage: '130', showOutline: 'on',
    placementMode: 'template', templateShape: 'circle', templateDistance: '20', templateWidth: '5', audience: 'everyone'
  });
  assert.equal(result.activationCoverage, 115);
  assert.equal(result.lingeringCoverage, 130);
  assert.equal(result.showOutline, true);
  const html = renderEffectStudio({presets: [{preset: result}], selected: result, query: '', animationPaths: []}, {localize});
  for (const field of ['activationCoverage', 'lingeringCoverage', 'showOutline']) assert.match(html, new RegExp(`name="${field}"`));
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/environmental-effects-studio.test.mjs`

Expected: FAIL because the fields are neither parsed nor rendered.

- [ ] **Step 3: Implement compact controls**

Pass fields into `normalizePreset` from `parsePresetForm`. Render 50–250 number inputs beside activation and lingering animation inputs, and render `showOutline` inside `data-lingering-controls`:

```html
<input type="number" name="activationCoverage" min="50" max="250" step="5" value="...">
<input type="number" name="lingeringCoverage" min="50" max="250" step="5" value="...">
<input type="checkbox" name="showOutline" ...>
```

Add English keys `ActivationCoverage`, `LingeringCoverage`, `ShowOutline`, and a concise coverage hint. Add only layout rules needed to keep the controls compact. Existing persistence change handling already hides every `data-lingering-controls` element.

- [ ] **Step 4: Run studio tests and verify GREEN**

Run: `node --test tests/environmental-effects-studio.test.mjs`

Expected: all studio tests pass.

- [ ] **Step 5: Commit through `git-ops`**

Commit the four task files with message `feat: configure environmental coverage`.

### Task 3: Exact Region geometry transport

**Files:**
- Create: `scripts/environmental-effects/geometry.mjs`
- Create: `tests/environmental-effects-geometry.test.mjs`
- Modify: `scripts/environmental-effects/runtime.mjs`
- Modify: `tests/environmental-effects-runtime.test.mjs`

- [ ] **Step 1: Write failing geometry tests**

Define the desired pure API and test centre-relative output:

```js
import {regionOutline} from '../scripts/environmental-effects/geometry.mjs';

test('converts circle and rectangle Region shapes for Sequencer', () => {
  const bounds = {x: 100, y: 200, width: 80, height: 60};
  assert.deepEqual(regionOutline({shapes: [{type: 'circle', radius: 40}]}, bounds), [
    {type: 'circle', options: {radius: 40}}
  ]);
  assert.deepEqual(regionOutline({shapes: [{type: 'rectangle', width: 80, height: 60}]}, bounds), [
    {type: 'rectangle', options: {width: 80, height: 60}}
  ]);
});

test('converts resolved cone and line polygons relative to the Region centre', () => {
  const shape = {type: 'cone', polygons: [{points: [100, 200, 180, 230, 100, 260]}]};
  assert.deepEqual(regionOutline({shapes: [shape]}, {x: 100, y: 200, width: 80, height: 60}), [
    {type: 'polygon', options: {points: [[-40, -30], [40, 0], [-40, 30]]}}
  ]);
});
```

Add a runtime assertion that `placeTemplate` returns `location.outline` from the placed Region.

- [ ] **Step 2: Run geometry/runtime tests and verify RED**

Run: `node --test tests/environmental-effects-geometry.test.mjs tests/environmental-effects-runtime.test.mjs`

Expected: FAIL because `geometry.mjs` and `location.outline` do not exist.

- [ ] **Step 3: Implement pure conversion and runtime transport**

Implement `regionOutline(region, bounds)` with these rules:

```js
const centre = {x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2};
// circle -> circle descriptor using radius
// rectangle -> rectangle descriptor using width/height
// every resolved polygon -> polygon descriptor with [x-centre.x, y-centre.y] pairs
// malformed or empty geometry -> []
```

In `placeTemplate`, add `outline: regionOutline(region, bounds)` to `location`. For whole-scene placement, add one rectangle descriptor matching the scene rectangle so the same Sequencer path works.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/environmental-effects-geometry.test.mjs tests/environmental-effects-runtime.test.mjs tests/environmental-effects-targeting.test.mjs`

Expected: all focused tests pass and targeting remains unchanged.

- [ ] **Step 5: Commit through `git-ops`**

Commit the four task files with message `feat: map environmental region outlines`.

### Task 4: Sequencer scaling and shared outline lifecycle

**Files:**
- Modify: `scripts/environmental-effects/sequencer.mjs`
- Modify: `tests/environmental-effects-sequencer.test.mjs`

- [ ] **Step 1: Write failing Sequencer chain tests**

Use the existing fake sequence to assert phase-specific scaling and shape attachment:

```js
test('applies independent coverage and attaches outline to the persistent phase', async () => {
  const log = [];
  const configured = {
    ...preset,
    lingeringAnimation: 'jb2a.fire.ground',
    activationCoverage: 115,
    lingeringCoverage: 130,
    showOutline: true
  };
  const location = {x: 10, y: 20, width: 200, height: 150, outline: [{type: 'circle', options: {radius: 100}}]};
  await playEffect(configured, location, {SequenceClass: fakeSequence(log)});
  assert.deepEqual(log.filter(([method]) => method === 'scale').map(([, value]) => value), [1.15, 1.3]);
  assert.equal(log.filter(([method]) => method === 'shape').length, 1);
  assert.ok(log.some(([method, type, options]) => method === 'shape' && type === 'circle' && options.fillAlpha === 0));
});
```

Add tests that preview includes the shape but never persists, and that non-persistent playback adds no outline.

- [ ] **Step 2: Run Sequencer tests and verify RED**

Run: `node --test tests/environmental-effects-sequencer.test.mjs`

Expected: FAIL because coverage and outline descriptors are ignored.

- [ ] **Step 3: Implement scaling and outline on the persistent effect section**

Extend `addEffect` to accept `coverage` and `outline`. After `.size(...)`, call `.scale(coverage / 100)`. Before `.persist(true)`, add each descriptor:

```js
for (const descriptor of outline ?? []) {
  effect = effect.shape(descriptor.type, {
    ...descriptor.options,
    lineSize: 3,
    lineColor: '#ff9f1c',
    fillAlpha: 0,
    alpha: 0.9,
    anchor: {x: 0.5, y: 0.5}
  });
}
```

Pass outline only to the phase that is persistent during normal playback. During preview, pass it to the phase that would be persistent but omit `.persist()`. Activation and lingering receive their own coverage percentages.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/environmental-effects-sequencer.test.mjs tests/environmental-effects-execution.test.mjs`

Expected: all focused tests pass.

- [ ] **Step 5: Commit through `git-ops`**

Commit the two task files with message `feat: outline persistent environmental effects`.

### Task 5: Documentation and complete verification

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md` only when preparing the eventual release, not during local implementation.

- [ ] **Step 1: Document the controls**

Update the Environmental Effect Studio section to explain independent percentages, transparent media padding, exact outline visibility, and removal through Sequencer Effect Manager.

- [ ] **Step 2: Run the complete verification**

Run: `npm run check`

Expected: lint passes, every test passes, packs build, and `dist/goffredo-compendium.zip` is produced successfully.

- [ ] **Step 3: Review scope and generated output**

Through `git-ops`, inspect the complete branch diff, confirm no unrelated files or generated development artifacts are included, and confirm the main repository's pre-existing untracked files remain untouched.

- [ ] **Step 4: Commit through `git-ops`**

Commit README only with message `docs: explain environmental visual coverage`. Do not merge, push, tag, or release without a new explicit user request.

