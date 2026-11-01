export const AUDIENCE = Object.freeze({
  ALLIES: 'allies',
  PCS: 'pcs',
  ENEMIES: 'enemies',
  EVERYONE: 'everyone'
});

export const SAVE_MODE = Object.freeze({HALF: 'half', NEGATES: 'negates'});
export const PRESET_FLAG = 'environmentalEffect';

const PLACEMENT_MODES = new Set(['template', 'scene']);
const TEMPLATE_SHAPES = new Set(['circle', 'cone', 'line', 'square']);
const LEGACY_TEMPLATE_SHAPES = Object.freeze({ray: 'line', rect: 'square'});
const DURATION_UNITS = new Set(['turn', 'round', 'minute', 'hour']);

function optionalNumber(value) {
  return value === '' || value === null || value === undefined ? null : Number(value);
}

function coverage(value) {
  const number = Number(value);
  if (value === '' || value === null || value === undefined || !Number.isFinite(number)) return 100;
  return Math.min(250, Math.max(50, number));
}

export function normalizeMechanics(raw = {}) {
  return {
    damage: String(raw.damage ?? '').trim(),
    damageType: String(raw.damageType ?? '').trim(),
    condition: String(raw.condition ?? '').trim(),
    saveAbility: String(raw.saveAbility ?? '').trim(),
    dc: optionalNumber(raw.dc),
    saveMode: raw.saveMode === SAVE_MODE.NEGATES ? SAVE_MODE.NEGATES : SAVE_MODE.HALF,
    duration: {
      value: optionalNumber(raw.duration?.value),
      unit: DURATION_UNITS.has(raw.duration?.unit) ? raw.duration.unit : 'round'
    }
  };
}

export function normalizePreset(raw = {}) {
  const mode = PLACEMENT_MODES.has(raw.placement?.mode) ? raw.placement.mode : 'template';
  const rawShape = LEGACY_TEMPLATE_SHAPES[raw.placement?.shape] ?? raw.placement?.shape;
  const shape = TEMPLATE_SHAPES.has(rawShape) ? rawShape : 'circle';
  const persistent = raw.persistent === true;
  return {
    id: String(raw.id ?? '').trim(),
    name: String(raw.name ?? '').trim(),
    icon: String(raw.icon ?? 'icons/svg/explosion.svg').trim(),
    animation: String(raw.animation ?? '').trim(),
    lingeringAnimation: String(raw.lingeringAnimation ?? '').trim(),
    sound: String(raw.sound ?? '').trim(),
    persistent,
    activationCoverage: coverage(raw.activationCoverage),
    lingeringCoverage: coverage(raw.lingeringCoverage),
    showOutline: persistent && raw.showOutline === true,
    placement: {
      mode,
      shape,
      distance: Number.isFinite(Number(raw.placement?.distance)) && Number(raw.placement.distance) > 0 ? Number(raw.placement.distance) : 10,
      width: Number.isFinite(Number(raw.placement?.width)) && Number(raw.placement.width) > 0 ? Number(raw.placement.width) : 5
    },
    audience: Object.values(AUDIENCE).includes(raw.audience) ? raw.audience : AUDIENCE.EVERYONE,
    mechanics: normalizeMechanics(raw.mechanics)
  };
}

export function validatePreset(preset) {
  if (!preset.id) throw new Error('Environmental effect identifier is required.');
  if (!preset.name) throw new Error('Environmental effect name is required.');
  if (!preset.animation) throw new Error('Environmental effect animation is required.');
  if (preset.placement.mode === 'template' && (!(preset.placement.distance > 0) || !(preset.placement.width > 0))) {
    throw new Error('Template distance and width must be positive.');
  }
  return preset;
}

export function validateMechanics(raw, {visualOnly = false} = {}) {
  const mechanics = normalizeMechanics(raw);
  const hasSave = Boolean(mechanics.saveAbility || mechanics.dc !== null);
  if (hasSave && (!mechanics.saveAbility || !Number.isFinite(mechanics.dc) || mechanics.dc <= 0)) {
    throw new Error('A saving throw requires an ability and a positive DC.');
  }
  if (mechanics.duration.value !== null && (!Number.isFinite(mechanics.duration.value) || mechanics.duration.value <= 0)) {
    throw new Error('Condition duration must be a positive number.');
  }
  if (!mechanics.damage && !mechanics.condition && !visualOnly) {
    throw new Error('Confirm visual-only execution when damage and condition are empty.');
  }
  return mechanics;
}

export function saveOutcome({hasSave, succeeded, mode}) {
  if (!hasSave || !succeeded) return {damage: 'full', condition: true};
  return mode === SAVE_MODE.NEGATES
    ? {damage: 'none', condition: false}
    : {damage: 'half', condition: false};
}
