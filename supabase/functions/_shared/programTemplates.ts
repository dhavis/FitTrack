import {
  EquipmentPref,
  equipmentAllowed,
  isExerciseAllowed,
} from './equipmentPolicy.ts';

export type { EquipmentPref };
export { equipmentAllowed, isExerciseAllowed };

export type PrimaryGoalType = 'fat_loss' | 'muscle_gain' | 'recomp' | 'strength' | 'general';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export type DayTemplate = {
  name: string;
  description: string;
  muscles: string[];
};

export function templatesFor(goal: PrimaryGoalType, days: number): DayTemplate[] {
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

export function defaultsForExperience(experience: ExperienceLevel) {
  if (experience === 'beginner') return { sets: 3, reps: 10, rest: 90 };
  if (experience === 'advanced') return { sets: 4, reps: 6, rest: 120 };
  return { sets: 3, reps: 8, rest: 90 };
}