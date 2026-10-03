import { WeightUnit, WorkoutSet } from '../types/db';
import { findBestRegularSet, filterRegularCompletedSets, roundProgressedWeight } from './progression';

export interface WarmupStep {
  reps: number;
  weightKg: number | null;
}

export function buildWarmupSets(params: {
  isBodyweight: boolean;
  lastSets: WorkoutSet[];
  unit: WeightUnit;
}): WarmupStep[] {
  if (params.isBodyweight) {
    return [
      { reps: 10, weightKg: null },
      { reps: 5, weightKg: null },
    ];
  }

  const regular = filterRegularCompletedSets(params.lastSets);
  const best = findBestRegularSet(regular, false);
  const working = best?.weight_kg ?? null;
  if (working == null || working <= 0) return [];

  return [
    { reps: 5, weightKg: roundProgressedWeight(working * 0.5, params.unit) },
    { reps: 3, weightKg: roundProgressedWeight(working * 0.7, params.unit) },
    { reps: 1, weightKg: roundProgressedWeight(working * 0.85, params.unit) },
  ];
}
