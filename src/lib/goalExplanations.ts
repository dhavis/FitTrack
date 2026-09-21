import { EquipmentPref, PrimaryGoalType } from '../types/db';

export const GOAL_LABELS: Record<PrimaryGoalType, string> = {
  fat_loss: 'Lose body fat',
  muscle_gain: 'Build muscle',
  recomp: 'Build muscle + lose fat',
  strength: 'Get stronger',
  general: 'Improve overall fitness',
};

export const GOAL_OPTIONS: { id: PrimaryGoalType; label: string }[] = [
  { id: 'fat_loss', label: 'Lose body fat' },
  { id: 'muscle_gain', label: 'Build muscle' },
  { id: 'recomp', label: 'Build muscle + lose fat' },
  { id: 'strength', label: 'Get stronger' },
  { id: 'general', label: 'Improve overall fitness' },
];

export const EQUIPMENT_LABELS: Record<EquipmentPref, string> = {
  bodyweight: 'Bodyweight only',
  dumbbells: 'Dumbbells only',
  free_weights: 'Free weights',
  full_gym: 'Full gym',
  mixed: 'Mixed equipment',
};

export const EQUIPMENT_OPTIONS: { id: EquipmentPref; label: string }[] = [
  { id: 'bodyweight', label: 'Bodyweight only' },
  { id: 'dumbbells', label: 'Dumbbells only' },
  { id: 'free_weights', label: 'Free weights' },
  { id: 'full_gym', label: 'Full gym' },
  { id: 'mixed', label: 'Mixed equipment' },
];

export const EQUIPMENT_HINT =
  'Dumbbells only excludes barbells. Free weights includes dumbbells, kettlebells, and barbells; Full gym also includes cables and machines.';

export function equipmentLabel(pref: EquipmentPref): string {
  return EQUIPMENT_LABELS[pref] ?? pref;
}

/** UX one-liners: plain-language explanation of each primary goal. */
export const GOAL_EXPLANATIONS: Record<PrimaryGoalType, string> = {
  fat_loss: 'Train to keep your strength while eating slightly less energy than your body uses.',
  muscle_gain: 'Build muscle with gradually harder workouts and enough food to support recovery.',
  recomp: 'Use strength training, steady calories, and enough protein to change your body composition.',
  strength: 'Focus on heavier lifts, fewer repetitions, and more rest between efforts.',
  general: 'Mix strength and conditioning to improve fitness, energy, and consistency.',
};

export function goalExplanation(goal: PrimaryGoalType): string {
  return GOAL_EXPLANATIONS[goal];
}

export function goalLabel(goal: PrimaryGoalType): string {
  return GOAL_LABELS[goal] ?? goal;
}
