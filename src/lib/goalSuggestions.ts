import { BodyMeasurement, Gender, Goals, PrimaryGoalType, WeightLog } from '../types/db';
import { estimateMaintenance, goalCalorieAdjustment, proteinPerKgForGoal } from './energy';

export interface GoalSuggestion {
  primary_goal_type: PrimaryGoalType;
  target_weight_kg: number | null;
  weekly_workout_target: number;
  daily_calorie_target: number | null;
  daily_protein_target_g: number | null;
  daily_carbs_target_g: number | null;
  daily_fat_target_g: number | null;
  days_per_week: number;
  rationale: string;
  disclaimer: string;
}

export function suggestGoals(opts: {
  current?: Goals | null;
  latestWeightKg?: number | null;
  recentWeights?: WeightLog[];
  latestMeasurement?: BodyMeasurement | null;
  age?: number | null;
  gender?: Gender | null;
  heightCm?: number | null;
}): GoalSuggestion {
  const weight = opts.latestWeightKg ?? opts.recentWeights?.[0]?.weight_kg ?? null;
  const bf = opts.latestMeasurement?.body_fat_pct ?? null;
  const trend =
    opts.recentWeights && opts.recentWeights.length >= 2
      ? opts.recentWeights[0].weight_kg - opts.recentWeights[opts.recentWeights.length - 1].weight_kg
      : 0;

  let primary: PrimaryGoalType = opts.current?.primary_goal_type ?? 'general';
  let rationale = 'Balanced general fitness targets based on your profile.';

  // Body-fat thresholds differ slightly by typical sex norms
  const highBf = opts.gender === 'female' ? 32 : 25;
  const lowBf = opts.gender === 'female' ? 20 : 15;

  if (bf != null && bf >= highBf) {
    primary = 'fat_loss';
    rationale = 'Body fat is elevated — a fat-loss focus is suggested.';
  } else if (bf != null && bf <= lowBf && trend <= 0) {
    primary = 'muscle_gain';
    rationale = 'Lower body fat with stable/falling weight — muscle gain is suggested.';
  } else if (Math.abs(trend) < 0.5 && bf != null && bf > lowBf && bf < highBf) {
    primary = 'recomp';
    rationale = 'Weight is stable with mid-range body fat — recomposition is suggested.';
  } else if (opts.current?.primary_goal_type === 'strength') {
    primary = 'strength';
    rationale = 'Keeping your existing strength goal.';
  }

  if (opts.age != null && opts.gender != null) {
    rationale += ` Adjusted for ${opts.gender}, age ${opts.age}.`;
  } else {
    rationale += ' Add age and gender in Settings for more accurate calories.';
  }

  const days = opts.current?.days_per_week ?? opts.current?.weekly_workout_target ?? 3;
  const weekly = Math.min(Math.max(days, 3), 6);

  let calories: number | null = null;
  let protein: number | null = null;
  let carbs: number | null = null;
  let fat: number | null = null;
  let targetWeight = opts.current?.target_weight_kg ?? null;

  if (weight) {
    const maintenance =
      estimateMaintenance({
        age: opts.age,
        gender: opts.gender,
        heightCm: opts.heightCm,
        weightKg: weight,
        daysPerWeek: weekly,
      }) ?? Math.round(weight * 33);
    const adj = goalCalorieAdjustment(primary, opts.age);
    calories = Math.round(maintenance * (1 + adj / 100));

    if (primary === 'fat_loss') {
      targetWeight = Math.round(weight * 0.95 * 10) / 10;
    } else if (primary === 'muscle_gain') {
      targetWeight = Math.round(weight * 1.03 * 10) / 10;
    } else if (primary === 'recomp' || primary === 'general') {
      targetWeight = weight;
    }

    protein = Math.round(weight * proteinPerKgForGoal(primary, opts.gender));
    fat = Math.round((calories * 0.25) / 9);
    carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  }

  return {
    primary_goal_type: primary,
    target_weight_kg: targetWeight,
    weekly_workout_target: weekly,
    daily_calorie_target: calories,
    daily_protein_target_g: protein,
    daily_carbs_target_g: carbs,
    daily_fat_target_g: fat,
    days_per_week: weekly,
    rationale,
    disclaimer: 'Suggestions are educational estimates only — not medical advice.',
  };
}