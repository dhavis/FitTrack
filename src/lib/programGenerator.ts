import { supabase } from './supabase';
import { fetchExercisesByMuscle } from './exercises';
import {
  EquipmentPref,
  ExperienceLevel,
  PrimaryGoalType,
} from '../types/db';

export interface ProgramGeneratorInput {
  userId: string;
  goalType: PrimaryGoalType;
  experience: ExperienceLevel;
  daysPerWeek: number;
  equipment: EquipmentPref;
  sessionMinutes: number;
  injuryNotes?: string | null;
}

type DayTemplate = {
  name: string;
  description: string;
  muscles: string[];
};

function templatesFor(goal: PrimaryGoalType, days: number): DayTemplate[] {
  const d = Math.min(Math.max(days, 2), 6);
  if (d <= 3) {
    return [
      { name: 'Full Body A', description: 'Squat focus full body', muscles: ['Legs', 'Chest', 'Back', 'Core'] },
      { name: 'Full Body B', description: 'Hinge focus full body', muscles: ['Legs', 'Glutes', 'Shoulders', 'Arms'] },
      { name: 'Full Body C', description: 'Push/pull balance', muscles: ['Chest', 'Back', 'Legs', 'Core'] },
    ].slice(0, d);
  }
  if (d === 4) {
    return [
      { name: 'Upper A', description: 'Horizontal push/pull', muscles: ['Chest', 'Back', 'Shoulders', 'Arms'] },
      { name: 'Lower A', description: 'Squat + posterior chain', muscles: ['Legs', 'Glutes', 'Core'] },
      { name: 'Upper B', description: 'Vertical push/pull', muscles: ['Shoulders', 'Back', 'Chest', 'Arms'] },
      { name: 'Lower B', description: 'Hinge + single-leg', muscles: ['Legs', 'Glutes', 'Core'] },
    ];
  }
  if (goal === 'strength') {
    return [
      { name: 'Squat Day', description: 'Squat emphasis', muscles: ['Legs', 'Core'] },
      { name: 'Bench Day', description: 'Press emphasis', muscles: ['Chest', 'Shoulders', 'Arms'] },
      { name: 'Deadlift Day', description: 'Hinge emphasis', muscles: ['Back', 'Legs', 'Glutes'] },
      { name: 'Upper Volume', description: 'Accessory upper', muscles: ['Back', 'Shoulders', 'Arms'] },
      { name: 'Lower Volume', description: 'Accessory lower', muscles: ['Legs', 'Glutes', 'Core'] },
    ].slice(0, d);
  }
  return [
    { name: 'Push', description: 'Chest, shoulders, triceps', muscles: ['Chest', 'Shoulders', 'Arms'] },
    { name: 'Pull', description: 'Back and biceps', muscles: ['Back', 'Arms', 'Core'] },
    { name: 'Legs', description: 'Quads, glutes, hamstrings', muscles: ['Legs', 'Glutes', 'Core'] },
    { name: 'Upper', description: 'Upper body volume', muscles: ['Chest', 'Back', 'Shoulders'] },
    { name: 'Lower', description: 'Lower body volume', muscles: ['Legs', 'Glutes'] },
    { name: 'Full Body', description: 'Mixed conditioning', muscles: ['Chest', 'Back', 'Legs', 'Core', 'Cardio'] },
  ].slice(0, d);
}

function defaultsForExperience(experience: ExperienceLevel) {
  if (experience === 'beginner') return { sets: 3, reps: 10, rest: 90 };
  if (experience === 'advanced') return { sets: 4, reps: 6, rest: 120 };
  return { sets: 3, reps: 8, rest: 90 };
}

function equipmentAllowed(pref: EquipmentPref, equipment: string | null) {
  if (pref === 'mixed' || pref === 'full_gym') return true;
  const eq = (equipment ?? '').toLowerCase();
  if (pref === 'bodyweight') return !eq || eq.includes('body') || eq.includes('band');
  if (pref === 'dumbbells') {
    return !eq || eq.includes('dumbbell') || eq.includes('kettle') || eq.includes('body') || eq.includes('band');
  }
  return true;
}

export async function generateTrainingProgram(input: ProgramGeneratorInput) {
  const days = templatesFor(input.goalType, input.daysPerWeek);
  const allMuscles = Array.from(new Set(days.flatMap((d) => d.muscles)));
  const byMuscle = await fetchExercisesByMuscle(allMuscles, 10);
  const defaults = defaultsForExperience(input.experience);
  const exercisesPerDay = Math.max(4, Math.min(8, Math.floor(input.sessionMinutes / 12)));

  const { data: program, error: programError } = await supabase
    .from('training_programs')
    .insert({
      user_id: input.userId,
      name: `${input.goalType.replace('_', ' ')} ${input.daysPerWeek}-day plan`,
      goal_type: input.goalType,
      generated_from: input,
    })
    .select()
    .single();

  if (programError || !program) {
    throw new Error(programError?.message ?? 'Failed to create program');
  }

  for (const day of days) {
    const pool = day.muscles
      .flatMap((m) => byMuscle[m] ?? [])
      .filter((ex, idx, arr) => arr.findIndex((x) => x.id === ex.id) === idx)
      .filter((ex) => equipmentAllowed(input.equipment, ex.equipment));

    const selected = pool.slice(0, exercisesPerDay);
    if (!selected.length) continue;

    const { data: routine, error: routineError } = await supabase
      .from('routines')
      .insert({
        user_id: input.userId,
        program_id: program.id,
        name: day.name,
        description: day.description,
      })
      .select()
      .single();

    if (routineError || !routine) {
      throw new Error(routineError?.message ?? 'Failed to create routine');
    }

    const rows = selected.map((ex, index) => ({
      routine_id: routine.id,
      exercise_id: ex.id,
      order_index: index,
      target_sets: defaults.sets,
      target_reps: defaults.reps,
      rest_seconds: defaults.rest,
      target_weight_kg: null,
    }));

    const { error: reError } = await supabase.from('routine_exercises').insert(rows);
    if (reError) throw new Error(reError.message);
  }

  return program;
}