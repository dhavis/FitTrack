import { ExperienceLevel, WorkoutSet } from '../types/db';

export interface ProgressionSuggestion {
  sets: number;
  reps: number;
  weightKg: number | null;
  note: string;
}

export interface LastSessionSummary {
  workoutId: string;
  completedAt: string;
  sets: WorkoutSet[];
}

function roundWeight(kg: number, unitHint: 'kg' | 'lb' = 'kg'): number {
  if (unitHint === 'lb') {
    const lb = kg / 0.45359237;
    return Math.round(lb / 2.5) * 2.5 * 0.45359237;
  }
  return Math.round(kg * 2) / 2;
}

export function summarizeLastSets(sets: WorkoutSet[]) {
  const byExercise = new Map<string, WorkoutSet[]>();
  sets.forEach((s) => {
    const list = byExercise.get(s.exercise_id) ?? [];
    list.push(s);
    byExercise.set(s.exercise_id, list);
  });
  return byExercise;
}

export function suggestProgression(opts: {
  targetSets: number;
  targetReps: number;
  targetWeightKg: number | null;
  lastSets: WorkoutSet[];
  experience?: ExperienceLevel | null;
}): ProgressionSuggestion {
  const { targetSets, targetReps, targetWeightKg, lastSets, experience } = opts;

  if (!lastSets.length) {
    const beginnerDefaults: Record<ExperienceLevel, { sets: number; reps: number }> = {
      beginner: { sets: 3, reps: 10 },
      intermediate: { sets: 4, reps: 8 },
      advanced: { sets: 5, reps: 5 },
    };
    const d = beginnerDefaults[experience ?? 'beginner'];
    return {
      sets: targetSets || d.sets,
      reps: targetReps || d.reps,
      weightKg: targetWeightKg,
      note: 'No prior session — using routine targets.',
    };
  }

  const completed = lastSets.filter((s) => (s.reps ?? 0) > 0);
  const avgReps =
    completed.reduce((sum, s) => sum + (s.reps ?? 0), 0) / Math.max(completed.length, 1);
  const topWeight = Math.max(...completed.map((s) => s.weight_kg ?? 0), 0);
  const hitTargets =
    completed.length >= targetSets && completed.every((s) => (s.reps ?? 0) >= targetReps);

  if (hitTargets && topWeight > 0) {
    const next = roundWeight(topWeight * 1.025);
    return {
      sets: targetSets,
      reps: targetReps,
      weightKg: next,
      note: 'Hit last targets — suggested +2.5% weight.',
    };
  }

  if (hitTargets && topWeight === 0) {
    return {
      sets: targetSets,
      reps: Math.min(targetReps + 2, 20),
      weightKg: null,
      note: 'Hit bodyweight targets — suggested +2 reps.',
    };
  }

  if (avgReps < targetReps * 0.8) {
    return {
      sets: targetSets,
      reps: Math.max(targetReps - 2, 5),
      weightKg: topWeight > 0 ? topWeight : targetWeightKg,
      note: 'Missed targets — keep weight, slightly fewer reps.',
    };
  }

  return {
    sets: targetSets,
    reps: targetReps,
    weightKg: topWeight > 0 ? topWeight : targetWeightKg,
    note: 'Repeat last working weight.',
  };
}