export type WeightUnit = 'kg' | 'lb';
export type LengthUnit = 'cm' | 'in';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type EquipmentPref = 'full_gym' | 'dumbbells' | 'free_weights' | 'bodyweight' | 'mixed';
export type PrimaryGoalType = 'fat_loss' | 'muscle_gain' | 'recomp' | 'strength' | 'general';
export type Gender = 'male' | 'female' | 'other';

export type EquipmentType =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'cable'
  | 'machine'
  | 'bodyweight'
  | 'band';

export type GymProfileKind = 'permanent' | 'temporary';

export interface GymProfile {
  id: string;
  user_id: string;
  name: string;
  base_preset: EquipmentPref;
  kind: GymProfileKind;
  is_main: boolean;
  expires_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GymProfileExcludedEquipment {
  gym_profile_id: string;
  equipment_type: EquipmentType;
}

export interface GymProfileExcludedExercise {
  gym_profile_id: string;
  exercise_id: string;
}

export interface ResolvedGymProfile {
  profile: GymProfile;
  excluded_equipment: EquipmentType[];
  excluded_exercise_ids: string[];
}

export interface GymProfileSnapshot {
  id: string;
  name: string;
  base_preset: EquipmentPref;
  kind: GymProfileKind;
  is_main: boolean;
  excluded_equipment: EquipmentType[];
  excluded_exercise_ids: string[];
}

export type BlockType = 'straight' | 'superset' | 'powerset';
export type SetType = 'regular' | 'drop';
export type LiveWorkoutPhase = 'regular' | 'drop' | 'rest' | 'complete';

export interface Profile {
  id: string;
  display_name: string | null;
  weight_unit: WeightUnit;
  length_unit: LengthUnit;
  age: number | null;
  gender: Gender | null;
  height_cm: number | null;
  active_gym_profile_id?: string | null;
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
  gym_profile_id?: string | null;
  gym_profile_snapshot?: GymProfileSnapshot | null;
  created_at: string;
}

export interface Routine {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  program_id: string | null;
  created_at: string;
  blocks?: RoutineBlock[];
  exercises?: RoutineExercise[];
}

export interface RoutineBlock {
  id: string;
  routine_id: string;
  block_type: BlockType;
  name: string;
  order_index: number;
  target_rounds: number;
  rest_seconds: number;
  created_at?: string;
  exercises?: RoutineExercise[];
}

export interface RoutineExerciseDropStep {
  id?: string;
  routine_exercise_id?: string;
  drop_index: number; // 1, 2, or 3
  target_reps: number;
  target_weight_kg: number | null;
  weight_unit?: WeightUnit | null;
  created_at?: string;
}

export interface RoutineExercise {
  id: string;
  routine_id: string;
  exercise_id: string;
  block_id?: string;
  block_position?: number;
  order_index: number;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number | null;
  weight_unit?: WeightUnit | null;
  rest_seconds: number;
  exercise?: Exercise;
  drop_steps?: RoutineExerciseDropStep[];
}

export interface WorkoutPlanBlock {
  id: string;
  workout_id: string;
  source_block_id: string | null;
  block_type: BlockType;
  name: string;
  order_index: number;
  target_rounds: number;
  rest_seconds: number;
  created_at?: string;
  exercises?: WorkoutPlanExercise[];
}

export interface WorkoutPlanDropStep {
  id?: string;
  workout_plan_exercise_id?: string;
  drop_index: number; // 1, 2, or 3
  target_reps: number;
  target_weight_kg: number | null;
  weight_unit?: WeightUnit | null;
  created_at?: string;
}

export interface WorkoutPlanExercise {
  id: string;
  workout_id: string;
  plan_block_id: string;
  source_routine_exercise_id: string | null;
  exercise_id: string;
  block_position: number;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number | null;
  weight_unit: WeightUnit | null;
  rest_seconds: number;
  exercise?: Exercise;
  drop_steps?: WorkoutPlanDropStep[];
}

export interface WorkoutLiveState {
  workout_id: string;
  phase: LiveWorkoutPhase;
  current_block_order: number;
  current_round: number;
  current_exercise_position: number;
  current_drop_index: number | null;
  rest_started_at: string | null;
  rest_ends_at: string | null;
  version: number;
  updated_at: string;
}

export interface Workout {
  id: string;
  user_id: string;
  routine_id: string | null;
  adaptation_event_id?: string | null;
  gym_profile_id?: string | null;
  gym_profile_snapshot?: GymProfileSnapshot | null;
  name: string;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  plan_blocks?: WorkoutPlanBlock[];
  live_state?: WorkoutLiveState;
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string;
  workout_plan_exercise_id?: string | null;
  set_index: number;
  set_type?: SetType;
  drop_index?: number | null;
  round_index?: number | null;
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
  gym_profile_snapshot?: GymProfileSnapshot | null;
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

export interface DailyCheckIn {
  id: string;
  user_id: string;
  check_in_date: string;
  timezone: string | null;
  overall_soreness: number;
  soreness_by_muscle: Record<string, number>;
  tiredness: number;
  energy: number;
  available_minutes: number;
  pain_or_new_injury: boolean;
  sleep_hours: number | null;
  recovery_note: string | null;
  created_at: string;
  updated_at: string;
}

export type AdaptationStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'safety_hold';
export type AdaptationGenerationSource = 'model' | 'deterministic_fallback' | 'safety_rules';

export interface PrescribedExercise {
  exercise_id: string;
  name: string;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number | null;
  rest_seconds: number;
  reason?: string;
}

export interface ValidatedPrescription {
  exercises: PrescribedExercise[];
  session_action: 'full' | 'reduced' | 'skipped' | 'rest';
  coach_message: string;
  nutrition_emphasis: 'normal' | 'recovery' | 'carb_focus';
}

export interface AdaptationEvent {
  id: string;
  user_id: string;
  check_in_id: string;
  source_routine_id: string | null;
  status: AdaptationStatus;
  check_in_snapshot: Record<string, unknown>;
  source_routine_snapshot: Record<string, unknown>;
  context_snapshot: Record<string, unknown>;
  model_proposal: Record<string, unknown> | null;
  validated_prescription: ValidatedPrescription | null;
  generation_source: AdaptationGenerationSource;
  provider: string | null;
  model: string | null;
  prompt_version: string;
  schema_version: string;
  validator_version: string;
  validation_reason: string | null;
  disclaimer_version: string;
  created_at: string;
  decided_at: string | null;
}
