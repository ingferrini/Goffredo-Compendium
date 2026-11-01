# Environmental Lingering Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add separate activation and optional lingering Sequencer animations with immediate compact previews and backward-compatible persistence.

**Architecture:** Extend the preset model with one optional path while retaining `animation` as the activation path. Sequence construction decides which phase persists; the Studio owns two independently updated inline preview panes and keeps changes in the unsaved draft until Save.

**Tech Stack:** Foundry VTT 14 ApplicationV2, D&D5e 5.3.3, Sequencer public API, Node test runner, ESLint.

---

### Task 1: Preset data model

**Files:**
- Modify: `scripts/environmental-effects/model.mjs`
- Modify: `scripts/environmental-effects/studio.mjs`
- Test: `tests/environmental-effects-model.test.mjs`
- Test: `tests/environmental-effects-studio.test.mjs`

- [x] **Step 1: Write failing normalization and form tests**

Assert that `normalizePreset` defaults `lingeringAnimation` to `''`, retains a supplied path, and that `parsePresetForm` reads it from the form.

- [x] **Step 2: Verify the focused tests fail**

Run: `node --test tests/environmental-effects-model.test.mjs tests/environmental-effects-studio.test.mjs`

- [x] **Step 3: Implement the optional preset field**

Add `lingeringAnimation: String(raw.lingeringAnimation ?? '').trim()` to preset normalization and pass `values.lingeringAnimation` from `parsePresetForm`.

- [x] **Step 4: Verify the focused tests pass**

Run the same focused command and expect zero failures.

### Task 2: Two-phase Sequencer playback

**Files:**
- Modify: `scripts/environmental-effects/sequencer.mjs`
- Modify: `scripts/environmental-effects/execution.mjs`
- Test: `tests/environmental-effects-sequencer.test.mjs`
- Test: `tests/environmental-effects-execution.test.mjs`

- [x] **Step 1: Write failing playback tests**

Cover: non-persistent activation only; legacy persistence keeps activation; separate lingering path plays activation once and lingering persistently; preview plays both phases without persistence.

- [x] **Step 2: Verify failures describe missing two-phase behavior**

Run: `node --test tests/environmental-effects-sequencer.test.mjs tests/environmental-effects-execution.test.mjs`

- [x] **Step 3: Implement phase selection**

Build one Sequence containing the activation effect and, when configured, a second lingering effect. Apply `.persist(true)` only to the selected persistent phase during execution. Keep preview effects non-persistent. Validate both paths before playback.

- [x] **Step 4: Verify the focused tests pass**

Run the same focused command and expect zero failures.

### Task 3: Dual immediate previews and documentation

**Files:**
- Modify: `scripts/environmental-effects/studio.mjs`
- Modify: `scripts/environmental-effects/runtime.mjs`
- Modify: `styles/environmental-effects.css`
- Modify: `lang/en.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Test: `tests/environmental-effects-studio.test.mjs`
- Test: `tests/environmental-effects-runtime.test.mjs`

- [x] **Step 1: Write failing Studio tests**

Assert two labelled preview containers, an optional lingering input, and independent preview-source resolution for each field.

- [x] **Step 2: Verify the Studio tests fail**

Run: `node --test tests/environmental-effects-studio.test.mjs tests/environmental-effects-runtime.test.mjs`

- [x] **Step 3: Implement compact dual previews**

Render activation and lingering previews side by side. Update only the corresponding pane on input, retain the unsaved draft, and reveal the lingering editor when persistence is enabled. Reduce each panel's minimum height while preserving responsive stacking on narrow windows.

- [x] **Step 4: Update English documentation**

Document activation, optional lingering fallback, immediate previews, canvas-preview behavior, and persistent-effect cleanup in README and the 0.11.1 changelog.

- [x] **Step 5: Run complete verification**

Run: `npm run check`

Expected: lint, all tests, compendium build, and release build succeed with zero failures.
