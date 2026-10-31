export const effectName = id => `GAC.Environment.${id}`;

export function listAnimationPaths(database) {
  return Array.from(database?.publicModules ?? []).flatMap(module => (
    database.getPathsUnder(module, {fullyQualified: true, ranges: true, arrays: true}) ?? []
  )).sort((left, right) => left.localeCompare(right));
}

export function searchAnimationPaths(paths, query) {
  const needle = String(query ?? '').trim().toLocaleLowerCase();
  if (!needle) return [...paths];
  return paths.filter(path => path.toLocaleLowerCase().includes(needle));
}

export function assertAnimation(database, path) {
  const entry = database?.getEntry?.(path, {softFail: true});
  if (!entry) throw new Error(`Sequencer animation not found: ${path}`);
  return entry;
}

function configureEffect(sequence, preset, location, {preview = false} = {}) {
  let effect = sequence.effect()
    .file(preset.animation)
    .atLocation(location)
    .name(effectName(preset.id));
  if (location?.width && location?.height) {
    effect = effect.size({width: location.width, height: location.height}, {gridUnits: false});
  }
  if (preset.persistent && !preview) effect.persist(true);
  if (preset.sound) sequence.sound().file(preset.sound);
  return sequence;
}

export function previewEffect(preset, location, {SequenceClass = globalThis.Sequence} = {}) {
  return configureEffect(new SequenceClass(), preset, location, {preview: true}).play();
}

export function playEffect(preset, location, {SequenceClass = globalThis.Sequence} = {}) {
  return configureEffect(new SequenceClass(), preset, location).play();
}

export function openEffectManager(manager = globalThis.Sequencer?.EffectManager) {
  return manager?.show?.();
}
