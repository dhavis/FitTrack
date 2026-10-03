import { WeightUnit, WorkoutSet } from '../types/db';
import { displayWeight } from './units';

export interface ProgressionSuggestion {
  sets: number;
  reps: number;
  weightKg: number | null;
  note: string;
  reason: string;
}

export interface SuggestProgressionParams {
  targetSets: number;
  targetReps: number;
  targetWeightKg: number | null;
  displayUnit?: WeightUnit;
  lastSets?: WorkoutSet[];
  isBodyweight?: boolean;
}

export type TrendDirection = 'up' | 'down' | 'unchanged' | 'none';

export interface ExerciseTrend {
  direction: TrendDirection;
  diffWeightKg: number | null;
  diffReps: number | null;
  label: string;
}

export interface SessionHistoryItem {
  workoutId: string;
  workoutName: string;
  completedAt: string;
  targetSets?: number;
  targetReps?: number;
  targetWeightKg?: number | null;
  targetWeightUnit?: WeightUnit | null;
  sets: WorkoutSet[];
  bestRegularSet: WorkoutSet | null;
  isBodyweight: boolean;
}

const KG_PER_LB = 0.45359237;

/**
 * Rounds weight according to progression rules:
 * - If display unit is kg: nearest 0.5 kg
 * - If display unit is lb: nearest 2.5 lb, converted to canonical kg
 */
export function roundProgressedWeight(rawKg: number, unitHint: WeightUnit = 'kg'): number {
  if (unitHint === 'lb') {
    const rawLb = rawKg / KG_PER_LB;
    const roundedLb = Math.round(rawLb / 2.5) * 2.5;
    return roundedLb * KG_PER_LB;
  }
  return Math.round(rawKg * 2) / 2;
}

/**
 * Working sets only. Warm-ups and drops do not move the next-session suggestion.
 */
export function filterRegularCompletedSets(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.filter((s) => {
    const isDrop = s.set_type === 'drop' || (s.drop_index != null && s.drop_index > 0);
    const isWarmup = s.set_type === 'warmup';
    const isIncomplete = s.reps == null || s.reps <= 0;
    return !isDrop && !isWarmup && !isIncomplete;
  });
}

/**
 * Finds the best regular set in a session:
 * - Loaded: highest weight_kg (reps break ties)
 * - Bodyweight: highest reps
 */
export function findBestRegularSet(
  regularSets: WorkoutSet[],
  isBodyweight: boolean = false
): WorkoutSet | null {
  if (regularSets.length === 0) return null;

  if (isBodyweight) {
    let best = regularSets[0];
    for (let i = 1; i < regularSets.length; i++) {
      if ((regularSets[i].reps ?? 0) > (best.reps ?? 0)) {
        best = regularSets[i];
      }
    }
    return best;
  }

  let best = regularSets[0];
  for (let i = 1; i < regularSets.length; i++) {
    const cur = regularSets[i];
    const curWeight = cur.weight_kg ?? 0;
    const bestWeight = best.weight_kg ?? 0;
    if (curWeight > bestWeight) {
      best = cur;
    } else if (curWeight === bestWeight && (cur.reps ?? 0) > (best.reps ?? 0)) {
      best = cur;
    }
  }
  return best;
}

export function summarizeLastSets(sets: WorkoutSet[]): Map<string, WorkoutSet[]> {
  const byExercise = new Map<string, WorkoutSet[]>();
  sets.forEach((s) => {
    const list = byExercise.get(s.exercise_id) ?? [];
    list.push(s);
    byExercise.set(s.exercise_id, list);
  });
  return byExercise;
}

/**
 * Deterministic progression suggestion function.
 *
 * Rules:
 * - Ignore drop sets and incomplete sets.
 * - Working weight = highest-weight regular set; reps break ties. Bodyweight: highest completed reps.
 * - If at least the planned number of regular sets were logged AND every regular set met planned reps:
 *   - loaded: workingWeight * 1.025, round to nearest 0.5 kg or nearest 2.5 lb, store/compare in kg
 *   - bodyweight: planned reps + 2, weightKg null
 * - Otherwise repeat working weight and planned reps.
 * - No history: keep current target, reason "No prior sessions."
 */
export function suggestProgression(params: SuggestProgressionParams): ProgressionSuggestion {
  const {
    targetSets,
    targetReps,
    targetWeightKg,
    displayUnit = 'kg',
    lastSets = [],
    isBodyweight: explicitBodyweight,
  } = params;

  const regularSets = filterRegularCompletedSets(lastSets);

  if (regularSets.length === 0) {
    return {
      sets: targetSets,
      reps: targetReps,
      weightKg: targetWeightKg,
      note: 'No prior sessions.',
      reason: 'No prior sessions.',
    };
  }

  const isBodyweight =
    explicitBodyweight ??
    (targetWeightKg == null && regularSets.every((s) => s.weight_kg == null || s.weight_kg === 0));

  const bestSet = findBestRegularSet(regularSets, isBodyweight);
  const metTargetSets = regularSets.length >= targetSets;
  const metAllReps = regularSets.every((s) => (s.reps ?? 0) >= targetReps);
  const success = metTargetSets && metAllReps;

  if (isBodyweight) {
    if (success) {
      return {
        sets: targetSets,
        reps: targetReps + 2,
        weightKg: null,
        note: 'Hit last targets — suggested +2 reps.',
        reason: 'Hit last targets — suggested +2 reps.',
      };
    }
    return {
      sets: targetSets,
      reps: targetReps,
      weightKg: null,
      note: 'Repeat planned reps.',
      reason: 'Repeat planned reps.',
    };
  }

  // Loaded exercise
  const workingWeight = bestSet?.weight_kg ?? targetWeightKg ?? 0;

  if (success && workingWeight > 0) {
    const nextWeightKg = roundProgressedWeight(workingWeight * 1.025, displayUnit);
    return {
      sets: targetSets,
      reps: targetReps,
      weightKg: nextWeightKg,
      note: 'Hit last targets — suggested +2.5% weight.',
      reason: 'Hit last targets — suggested +2.5% weight.',
    };
  }

  return {
    sets: targetSets,
    reps: targetReps,
    weightKg: workingWeight > 0 ? workingWeight : targetWeightKg,
    note: 'Repeat last working weight.',
    reason: 'Repeat last working weight.',
  };
}

/**
 * Computes trend across up to 5 sessions (ordered newest first).
 * Compares latest session highest regular-set weight to the earliest of the sessions shown.
 * Bodyweight compares reps.
 * Drop sets do not affect trend.
 */
export function computeExerciseTrend(
  sessions: { bestRegularSet: WorkoutSet | null; isBodyweight: boolean }[],
  displayUnit: WeightUnit = 'kg'
): ExerciseTrend {
  if (sessions.length < 2) {
    return { direction: 'none', diffWeightKg: null, diffReps: null, label: '—' };
  }

  const latest = sessions[0]?.bestRegularSet;
  const earliest = sessions[sessions.length - 1]?.bestRegularSet;

  if (!latest || !earliest) {
    return { direction: 'none', diffWeightKg: null, diffReps: null, label: '—' };
  }

  const isBodyweight = sessions[0].isBodyweight || (latest.weight_kg == null && earliest.weight_kg == null);

  if (isBodyweight) {
    const latestReps = latest.reps ?? 0;
    const earliestReps = earliest.reps ?? 0;
    const diff = latestReps - earliestReps;
    if (diff > 0) {
      return { direction: 'up', diffWeightKg: null, diffReps: diff, label: `+${diff} reps` };
    }
    if (diff < 0) {
      return { direction: 'down', diffWeightKg: null, diffReps: diff, label: `${diff} reps` };
    }
    return { direction: 'unchanged', diffWeightKg: null, diffReps: 0, label: 'Unchanged' };
  }

  const latestKg = latest.weight_kg ?? 0;
  const earliestKg = earliest.weight_kg ?? 0;
  const diffKg = latestKg - earliestKg;

  if (Math.abs(diffKg) < 0.001) {
    return { direction: 'unchanged', diffWeightKg: 0, diffReps: null, label: 'Unchanged' };
  }

  if (diffKg > 0) {
    const diffDisplay = displayWeight(diffKg, displayUnit);
    return {
      direction: 'up',
      diffWeightKg: diffKg,
      diffReps: null,
      label: `+${diffDisplay.toFixed(1)} ${displayUnit}`,
    };
  }

  const diffDisplay = displayWeight(Math.abs(diffKg), displayUnit);
  return {
    direction: 'down',
    diffWeightKg: diffKg,
    diffReps: null,
    label: `-${diffDisplay.toFixed(1)} ${displayUnit}`,
  };
}
