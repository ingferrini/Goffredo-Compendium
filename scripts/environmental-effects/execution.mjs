export async function previewEnvironmentalEffect(preset, location, deps) {
  await deps.assertAnimation(preset.animation);
  if (preset.persistent && preset.lingeringAnimation) await deps.assertAnimation(preset.lingeringAnimation);
  await deps.previewEffect(preset, location);
}

export async function executeEnvironmentalEffect(preset, deps) {
  const placement = await deps.configurePlacement(preset.placement);
  if (!placement) return {status: 'cancelled'};
  const area = preset.placement.mode === 'scene'
    ? deps.sceneArea()
    : await deps.placeTemplate(placement);
  if (!area) return {status: 'cancelled'};

  try {
    const candidates = deps.filterAudience(deps.collectTokens(area), preset.audience);
    const selection = await deps.chooseTargets(candidates, preset.mechanics);
    if (!selection) return {status: 'cancelled'};

    const mechanics = deps.validateMechanics(selection.mechanics, {visualOnly: selection.visualOnly});
    await deps.assertAnimation(preset.animation);
    if (preset.persistent && preset.lingeringAnimation) await deps.assertAnimation(preset.lingeringAnimation);
    await deps.playEffect(preset, area.location);

    if (selection.visualOnly || !selection.targets.length) return {status: 'visual-only'};

    const result = await deps.resolveMidi({preset, mechanics, targets: selection.targets});
    if (mechanics.condition) {
      const hasSave = Boolean(mechanics.saveAbility && mechanics.dc !== null);
      const conditionTargets = hasSave ? result.failed : new Set(selection.targets);
      await deps.applyConditions(conditionTargets, mechanics.condition, mechanics.duration);
    }
    await deps.saveMechanics(preset.id, mechanics);
    return {status: 'resolved', result};
  } finally {
    await area.template?.delete?.();
  }
}
