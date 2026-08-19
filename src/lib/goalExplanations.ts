import { PrimaryGoalType } from '../types/db';

/** One-liner: what the goal is + workout focus + nutrition focus. */
export const GOAL_EXPLANATIONS: Record<PrimaryGoalType, string> = {
  fat_loss:
    'Lose body fat: higher-rep training with cardio density, plus a calorie deficit and high protein.',
  muscle_gain:
    'Build muscle: progressive overload with moderate volume, plus a calorie surplus and high protein.',
  recomp:
    'Recomposition: strength + hypertrophy work at maintenance calories with high protein to reshape body composition.',
  strength:
    'Get stronger: heavy low-rep compounds with longer rest, plus near-maintenance calories to fuel heavy lifts.',
  general:
    'Overall fitness: balanced strength and conditioning, plus maintenance-style calories and solid protein.',
};

export function goalExplanation(goal: PrimaryGoalType): string {
  return GOAL_EXPLANATIONS[goal];
}