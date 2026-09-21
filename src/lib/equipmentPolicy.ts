export type EquipmentType =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'cable'
  | 'machine'
  | 'bodyweight'
  | 'band';

export type EquipmentPref =
  | 'full_gym'
  | 'dumbbells'
  | 'free_weights'
  | 'bodyweight'
  | 'mixed';

export const ALL_EQUIPMENT_TYPES: EquipmentType[] = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'cable',
  'machine',
  'bodyweight',
  'band',
];

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  kettlebell: 'Kettlebell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
  band: 'Resistance Band',
};

export const PRESET_ALLOWED_EQUIPMENT: Record<EquipmentPref, EquipmentType[]> = {
  full_gym: ['barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'bodyweight', 'band'],
  mixed: ['barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'bodyweight', 'band'],
  free_weights: ['barbell', 'dumbbell', 'kettlebell', 'bodyweight', 'band'],
  dumbbells: ['dumbbell', 'kettlebell', 'bodyweight', 'band'],
  bodyweight: ['bodyweight', 'band'],
};

/**
 * Classifies an arbitrary equipment string into one of the canonical 7 EquipmentTypes.
 * Uses deny-first logic: machine/cable keywords are matched before barbell/dumbbell.
 */
export function classifyEquipment(equipment: string | null | undefined): EquipmentType | null {
  if (!equipment) return null;
  const eq = equipment.toLowerCase().trim();
  if (!eq) return null;

  // 1. Cables
  if (eq.includes('cable')) {
    return 'cable';
  }

  // 2. Machines / Smiths / selectors / cardio machines
  if (
    eq.includes('machine') ||
    eq.includes('smith') ||
    eq.includes('selector') ||
    eq.includes('stack') ||
    eq.includes('treadmill') ||
    eq.includes('elliptical') ||
    eq.includes('bike') ||
    eq.includes('rower') ||
    eq.includes('ergometer')
  ) {
    return 'machine';
  }

  // 3. Kettlebells
  if (eq.includes('kettle')) {
    return 'kettlebell';
  }

  // 4. Dumbbells
  if (eq.includes('dumbbell') || eq.includes('db')) {
    return 'dumbbell';
  }

  // 5. Barbells & plate/bar variants
  if (
    eq.includes('barbell') ||
    eq.includes('ez bar') ||
    eq.includes('ez-bar') ||
    eq.includes('trap bar') ||
    eq.includes('trapbar') ||
    eq.includes('olympic') ||
    eq.includes('plate') ||
    eq.includes('bb')
  ) {
    return 'barbell';
  }

  // 6. Bands
  if (eq.includes('band')) {
    return 'band';
  }

  // 7. Bodyweight / calisthenics
  if (eq.includes('body') || eq.includes('calisthenic') || eq.includes('none')) {
    return 'bodyweight';
  }

  return null;
}

export interface GymPolicyTarget {
  base_preset: EquipmentPref;
  excluded_equipment?: (EquipmentType | string)[] | null;
  excluded_exercise_ids?: string[] | null;
}

/**
 * Evaluates whether an exercise is allowed under a given gym profile policy.
 * An exercise is allowed if:
 * 1. Its ID is not in excluded_exercise_ids
 * 2. Its classified equipment type is not in excluded_equipment
 * 3. Its classified equipment type is supported by the gym base_preset
 */
export function isExerciseAllowed(
  exercise: { id: string; equipment?: string | null } | null | undefined,
  gym: GymPolicyTarget | null | undefined
): boolean {
  if (!exercise) return false;
  if (!gym) return true;

  if (gym.excluded_exercise_ids && gym.excluded_exercise_ids.includes(exercise.id)) {
    return false;
  }

  const classified = classifyEquipment(exercise.equipment);
  if (classified) {
    if (gym.excluded_equipment && gym.excluded_equipment.includes(classified)) {
      return false;
    }

    const allowedInPreset = PRESET_ALLOWED_EQUIPMENT[gym.base_preset] ?? PRESET_ALLOWED_EQUIPMENT.full_gym;
    if (!allowedInPreset.includes(classified)) {
      return false;
    }
    return true;
  }

  // If unclassified string, fallback to preset check
  return equipmentAllowed(gym.base_preset, exercise.equipment ?? null);
}

/**
 * Legacy helper for checking equipment string directly against an EquipmentPref preset.
 */
export function equipmentAllowed(pref: EquipmentPref, equipment: string | null): boolean {
  if (pref === 'mixed' || pref === 'full_gym') return true;
  const eq = (equipment ?? '').toLowerCase().trim();
  if (!eq) return true;

  const classified = classifyEquipment(eq);
  if (classified) {
    const allowedTypes = PRESET_ALLOWED_EQUIPMENT[pref] ?? PRESET_ALLOWED_EQUIPMENT.full_gym;
    return allowedTypes.includes(classified);
  }

  if (pref === 'bodyweight') return eq.includes('body') || eq.includes('band');
  if (pref === 'dumbbells') {
    if (eq.includes('barbell')) return false;
    return (
      eq.includes('dumbbell') ||
      eq.includes('kettle') ||
      eq.includes('body') ||
      eq.includes('band')
    );
  }
  if (pref === 'free_weights') {
    const isMachineOrCable =
      eq.includes('cable') ||
      eq.includes('machine') ||
      eq.includes('smith') ||
      eq.includes('selector') ||
      eq.includes('stack');
    if (isMachineOrCable) return false;
    return (
      eq.includes('barbell') ||
      eq.includes('dumbbell') ||
      eq.includes('kettle') ||
      eq.includes('body') ||
      eq.includes('band') ||
      eq.includes('ez bar') ||
      eq.includes('ez-bar') ||
      eq.includes('trap bar') ||
      eq.includes('trapbar') ||
      eq.includes('olympic') ||
      eq.includes('plate')
    );
  }
  return true;
}
