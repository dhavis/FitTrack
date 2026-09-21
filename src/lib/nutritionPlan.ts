import { Goals, Gender, PrimaryGoalType } from '../types/db';
import {
  demographicsLabel,
  estimateMaintenance,
  goalCalorieAdjustment,
  proteinPerKgForGoal,
} from './energy';

export interface NutritionPlanDraft {
  daily_calorie_target: number | null;
  daily_protein_g: number | null;
  daily_carbs_g: number | null;
  daily_fat_g: number | null;
  daily_fiber_g: number | null;
  water_ml: number | null;
  meals_per_day: number;
  breakfast_kcal: number | null;
  lunch_kcal: number | null;
  dinner_kcal: number | null;
  snack_kcal: number | null;
  protein_g_per_kg: number | null;
  calorie_adjustment_pct: number | null;
  notes: string | null;
}

function splitMeals(calories: number, mealsPerDay: number) {
  if (mealsPerDay <= 3) {
    return {
      breakfast_kcal: Math.round(calories * 0.3),
      lunch_kcal: Math.round(calories * 0.35),
      dinner_kcal: Math.round(calories * 0.35),
      snack_kcal: 0,
    };
  }
  return {
    breakfast_kcal: Math.round(calories * 0.25),
    lunch_kcal: Math.round(calories * 0.3),
    dinner_kcal: Math.round(calories * 0.3),
    snack_kcal: Math.round(calories * 0.15),
  };
}

export function buildNutritionPlanFromGoals(opts: {
  goals?: Goals | null;
  weightKg?: number | null;
  age?: number | null;
  gender?: Gender | null;
  heightCm?: number | null;
}): NutritionPlanDraft {
  const goalType: PrimaryGoalType = opts.goals?.primary_goal_type ?? 'general';
  const weight = opts.weightKg ?? opts.goals?.target_weight_kg ?? null;
  const days = opts.goals?.days_per_week ?? opts.goals?.weekly_workout_target ?? 3;
  const adjustment = goalCalorieAdjustment(goalType, opts.age);
  const proteinPerKg = proteinPerKgForGoal(goalType, opts.gender);

  const maintenance = estimateMaintenance({
    age: opts.age,
    gender: opts.gender,
    heightCm: opts.heightCm,
    weightKg: weight,
    daysPerWeek: days,
  });

  let calories: number | null = null;
  // Prefer freshly calculated from demographics over stale goal calories when age/gender present
  if (maintenance != null && opts.age != null && opts.gender != null) {
    calories = Math.round(maintenance * (1 + adjustment / 100));
  } else if (opts.goals?.daily_calorie_target != null) {
    calories = Math.round(opts.goals.daily_calorie_target);
  } else if (maintenance != null) {
    calories = Math.round(maintenance * (1 + adjustment / 100));
  } else if (weight) {
    calories = Math.round(weight * 33 * (1 + adjustment / 100));
  }

  const protein =
    weight != null ? Math.round(weight * proteinPerKg) : opts.goals?.daily_protein_target_g != null
      ? Math.round(opts.goals.daily_protein_target_g)
      : null;

  const fat =
    calories != null
      ? Math.round((calories * 0.25) / 9)
      : opts.goals?.daily_fat_target_g != null
        ? Math.round(opts.goals.daily_fat_target_g)
        : null;

  const carbs =
    calories != null && protein != null && fat != null
      ? Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))
      : opts.goals?.daily_carbs_target_g != null
        ? Math.round(opts.goals.daily_carbs_target_g)
        : null;

  const meals = 4;
  const mealSplit = calories
    ? splitMeals(calories, meals)
    : { breakfast_kcal: null, lunch_kcal: null, dinner_kcal: null, snack_kcal: null };

  const noteByGoal: Record<PrimaryGoalType, string> = {
    fat_loss: 'Slight calorie deficit with higher protein to preserve muscle while losing body fat.',
    muscle_gain: 'Calorie surplus with high protein to support muscle recovery and growth.',
    recomp: 'Near-maintenance calories with high protein to build muscle and lose body fat.',
    strength: 'Steady calories and protein to fuel heavy training and recovery.',
    general: 'Balanced maintenance calories and solid protein for overall fitness.',
  };

  const demo = demographicsLabel({
    age: opts.age,
    gender: opts.gender,
    heightCm: opts.heightCm,
  });
  const method =
    opts.age != null && opts.gender != null
      ? `Estimated daily energy needs ~${maintenance ?? '—'} kcal based on your age, gender, and activity (${demo}).`
      : 'Set age and gender in Settings for a more accurate calorie estimate.';

  return {
    daily_calorie_target: calories,
    daily_protein_g: protein,
    daily_carbs_g: carbs,
    daily_fat_g: fat,
    daily_fiber_g: 30,
    water_ml: weight ? Math.round(weight * 35) : 2500,
    meals_per_day: meals,
    breakfast_kcal: mealSplit.breakfast_kcal,
    lunch_kcal: mealSplit.lunch_kcal,
    dinner_kcal: mealSplit.dinner_kcal,
    snack_kcal: mealSplit.snack_kcal,
    protein_g_per_kg: proteinPerKg,
    calorie_adjustment_pct: adjustment,
    notes: `${noteByGoal[goalType]} ${method} Educational estimate only — not medical advice.`,
  };
}

export function redistributeMealCalories(
  totalCalories: number,
  mealsPerDay: number
): Pick<NutritionPlanDraft, 'breakfast_kcal' | 'lunch_kcal' | 'dinner_kcal' | 'snack_kcal'> {
  return splitMeals(totalCalories, mealsPerDay);
}