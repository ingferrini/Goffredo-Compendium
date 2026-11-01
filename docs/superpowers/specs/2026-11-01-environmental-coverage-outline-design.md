# Environmental Effect Coverage and Outline

## Goal

Make Environmental Effect Studio visuals communicate the full mechanical area even when the selected media contains transparent padding. Persistent zones may also show an exact outline that disappears together with the Sequencer effect.

## Preset model

- Add `activationCoverage`, a percentage from 50 to 250 with a default of 100.
- Add `lingeringCoverage`, independently constrained to the same range and default.
- Add `showOutline`, defaulting to false.
- Existing presets migrate through normalization and keep their current 100% appearance.
- The outline control is available only when persistence is enabled; disabling persistence clears or ignores it.

## Studio behavior

- Activation and lingering controls each expose a compact numeric percentage field.
- Canvas preview applies both coverage values immediately without saving.
- When enabled, canvas preview also displays the exact outline without persisting it.
- The stored media preview remains unchanged because coverage is meaningful only on the scene canvas.

## Runtime geometry

- Region placement remains ephemeral and continues to determine targets with `RegionDocument.testPoint`.
- The runtime carries the placed Region's geometry alongside its bounds.
- Circle and rectangle geometry maps directly to Sequencer shapes.
- Cone and line geometry is converted from the placed Region's resolved polygon, preserving rotation and the actual footprint.
- Shape coordinates are translated relative to the effect centre expected by Sequencer.

## Sequencer playback

- Coverage is applied after the base effect has been sized to the Region bounds.
- Activation and lingering use their independent coverage multipliers.
- `showOutline` adds a thin, unfilled, player-visible shape to the same persistent Sequencer effect as the lingering visual.
- If persistence uses the activation animation directly, the outline is attached to that persistent effect instead.
- The outline is never a separate Foundry Region document or a separate cleanup system.
- Removing the persistent effect through Sequencer Effect Manager removes its animation and outline together.
- Non-persistent previews reproduce the same appearance but never persist.

## Defaults and appearance

- Coverage default: 100%.
- Outline: disabled by default, no fill, high-contrast warm colour, thin line.
- The first implementation intentionally has no duration, colour, thickness, or visibility controls.
- The outline is visible to all users whenever enabled.

## Failure handling

- Invalid or missing coverage values normalize to 100%.
- Values outside the supported range are clamped.
- If exact Region geometry cannot be converted, playback continues without an outline and reports a concise GM warning; damage and saving throws are unaffected.

## Verification

- Model tests cover defaults, migration, parsing, clamping, and export-safe serialization.
- Studio tests cover the new controls and persistence-dependent outline behavior.
- Sequencer tests verify independent activation and lingering scaling, exact shape attachment, preview non-persistence, and shared persistent cleanup.
- Runtime/geometry tests cover circle, rectangle, cone, and line conversion.
- The full module check must pass before any release is proposed.

