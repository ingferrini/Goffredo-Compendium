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

function addEffect(sequence, {file, location, name, persistent, coverage = 100, outline = []}) {
  let effect = sequence.effect()
    .file(file)
    .atLocation(location)
    .name(name);
  if (location?.width && location?.height) {
    effect = effect.size({width: location.width, height: location.height}, {gridUnits: false});
  }
  effect = effect.spriteScale(coverage / 100);
  for (const descriptor of outline) {
    effect = effect.shape(descriptor.type, {
      ...descriptor.options,
      lineSize: 3,
      lineColor: '#ff9f1c',
      fillAlpha: 0,
      alpha: 0.9,
      anchor: {x: 0.5, y: 0.5}
    });
  }
  if (persistent) effect.persist(true);
}

function configureEffect(sequence, preset, location, {preview = false} = {}) {
  const lingering = preset.persistent ? preset.lingeringAnimation : '';
  const outline = preset.persistent && preset.showOutline ? (location?.outline ?? []) : [];
  addEffect(sequence, {
    file: preset.animation,
    location,
    name: lingering ? `${effectName(preset.id)}.Activation` : effectName(preset.id),
    persistent: preset.persistent && !lingering && !preview,
    coverage: preset.activationCoverage ?? 100,
    outline: lingering ? [] : outline
  });
  if (lingering) {
    addEffect(sequence, {
      file: lingering,
      location,
      name: effectName(preset.id),
      persistent: !preview,
      coverage: preset.lingeringCoverage ?? 100,
      outline
    });
  }
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
