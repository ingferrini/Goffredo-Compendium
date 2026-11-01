# Environmental activation and lingering animations

## Goal

Allow an environmental-effect preset to use one animation for its initial activation and a different animation for the visual that remains on the scene.

## Preset data

- `animation` remains the required activation animation for backward compatibility.
- `lingeringAnimation` is an optional Sequencer database path.
- Existing presets without `lingeringAnimation` remain valid without migration.
- When persistence is disabled, `lingeringAnimation` is retained in the preset but is not played.

## Studio interface

- Label the existing field **Activation animation**.
- Add **Lingering animation** when **Persistent visual effect** is enabled.
- Show two compact preview panels side by side, labelled **Activation** and **Lingering**.
- Selecting or typing a valid Sequencer path updates the corresponding preview immediately, without saving the preset.
- Invalid or incomplete paths show the empty preview state and do not modify the saved macro.
- Reduce preview height from the current large panel so both previews fit without crowding the rest of the editor.

## Playback

- Activation plays once for every execution.
- If persistence is enabled and `lingeringAnimation` is set, the lingering animation starts persistently after activation and only it remains.
- If persistence is enabled and `lingeringAnimation` is empty, activation remains persistent, preserving the 0.11.0 behavior.
- If persistence is disabled, no animation persists.
- Persistent effects keep the preset's stable Sequencer effect name and remain removable through Sequencer Effect Manager.

## Canvas preview

- **Preview on canvas** plays activation and then lingering when present.
- Canvas preview never creates a persistent effect, even if the preset has persistence enabled.
- With no lingering animation, canvas preview plays activation only once.

## Validation and compatibility

- Activation remains required.
- Lingering is optional but, when supplied, must resolve to a valid Sequencer database entry before playback.
- Existing macros and presets require no manual changes.
- Saving remains explicit: changing either animation updates only the draft and preview until **Save preset** is pressed.

## Tests

- Preset normalization retains and defaults `lingeringAnimation`.
- Studio rendering includes both animation fields and compact preview panels.
- Immediate preview resolution distinguishes activation and lingering fields.
- Playback covers non-persistent, legacy persistent, and separate lingering persistent paths.
- Canvas preview plays both phases without persistence.
