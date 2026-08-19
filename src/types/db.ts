export type WeightUnit = 'kg' | 'lb';
export type LengthUnit = 'cm' | 'in';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type EquipmentPref = 'full_gym' | 'dumbbells' | 'bodyweight' | 'mixed';
export type PrimaryGoalType = 'fat_loss' | 'muscle_gain' | 'recomp' | 'strength' | 'general';
export type Gender = 'male' | 'female' | 'other';

export interface Profile {
  id: string;
  display_name: string | null;
  weight_unit: WeightUnit;
  length_unit: LengthUnit;
  age: number | null;
  gender: Gender | null;
  height_cm: number | null;
  onboarding_completed_at: string | null;
  created_at: string;
}

export interface WeightLog {
  id: string;
  user_id: string;
  weight_kg: number;
  logged_at: string;
  note: string | null;
  created_at: string;
}

export interface BodyMeasurement {
  id: string;
  user_id: string;
  logged_at: string;
  body_fat_pct: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  hips_cm: number | null;
  arm_left_cm: number | null;
  arm_right_cm: number | null;
  thigh_left_cm: number | null;
  thigh_right_cm: number | null;
  note: string | null;
  created_at: string;
}

export interface Exercise {
  id: string;
  user_id: string | null;
  name: string;
  muscle_group: string | null;
  equipment: string | null;
  instructions: string | null;
  howto_image_path: string | null;
  howto_cues: string | null;
  created_at: string;
}

export interface TrainingProgram {
  id: string;
  user_id: string;
  name: string;
  goal_type: string | null;
  generated_from: Record<string, unknown> | null;
  created_at: string;
}

export interface Routine {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  program_id: string | null;
  created_at: string;
}

export interface RoutineExercise {
  id: string;
  routine_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number | null;
  rest_seconds: number;
  exercise?: Exercise;
}

export interface Workout {
  id: string;
  user_id: string;
  routine_id: string | null;
  name: string;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_index: number;
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
  completed_at: string | null;
  exercise?: Exercise;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodLog {
  id: string;
  user_id: string;
  logged_at: string;
  meal_type: MealType;
  food_name: string;
  brand: string | null;
  serving_qty: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: string | null;
  external_id: string | null;
  created_at: string;
}

export interface Goals {
  user_id: string;
  target_weight_kg: number | null;
  weekly_workout_target: number;
  daily_calorie_target: number | null;
  daily_protein_target_g: number | null;
  daily_carbs_target_g: number | null;
  daily_fat_target_g: number | null;
  primary_goal_type: PrimaryGoalType | null;
  experience: ExperienceLevel | null;
  days_per_week: number | null;
  equipment_pref: EquipmentPref | null;
  session_minutes: number | null;
  injury_notes: string | null;
  updated_at: string;
}

export interface NutritionPlan {
  user_id: string;
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
  preferences: Record<string, unknown>;
  meal_menu: Record<string, unknown> | null;
  updated_at: string;
}

export interface CoachPlan {
  id: string;
  user_id: string;
  generated_at: string;
  is_active: boolean;
  goal_snapshot: Record<string, unknown>;
  context_snapshot: Record<string, unknown>;
  training_summary: Record<string, unknown> | null;
  nutrition_summary: Record<string, unknown> | null;
  coaching_copy: {
    weekly_coaching: string;
    training_tips: string[];
    nutrition_tips: string[];
    disclaimer: string;
  } | null;
  model: string | null;
  prompt_version: string | null;
  created_at: string;
}
