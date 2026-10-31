import {MODULE_ID} from '../constants.mjs';
import {PRESET_FLAG, normalizePreset, validatePreset} from './model.mjs';

export const macroCommand = id => (
  `await game.modules.get(${JSON.stringify(MODULE_ID)}).api.runEnvironmentalEffect(${JSON.stringify(id)});`
);

function macroData(raw) {
  const preset = validatePreset(normalizePreset(raw));
  return {
    name: preset.name,
    img: preset.icon,
    type: 'script',
    scope: 'global',
    command: macroCommand(preset.id),
    flags: {[MODULE_ID]: {[PRESET_FLAG]: preset}}
  };
}

export function discoverPresets(macros) {
  return Array.from(macros ?? []).flatMap(macro => {
    const raw = macro.flags?.[MODULE_ID]?.[PRESET_FLAG];
    if (!raw) return [];
    try {
      return [{macro, preset: validatePreset(normalizePreset(raw))}];
    } catch {
      return [];
    }
  });
}

export function createPresetMacro(preset, repository) {
  return repository.create(macroData(preset));
}

export function updatePresetMacro(macro, preset, repository) {
  return repository.update(macro, macroData({...preset, id: preset.id}));
}

export function duplicatePresetMacro(preset, repository, randomID) {
  const copy = JSON.parse(JSON.stringify(preset));
  copy.id = randomID();
  copy.name = `${copy.name} Copy`;
  return createPresetMacro(copy, repository);
}

export function deletePresetMacro(macro, repository) {
  return repository.delete(macro);
}

export function foundryMacroRepository() {
  return {
    create: data => globalThis.Macro.create(data),
    update: (macro, changes) => macro.update(changes),
    delete: macro => macro.delete()
  };
}
