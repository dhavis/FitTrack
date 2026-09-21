import { EquipmentType } from '../types/db';

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

export type NutritionStackParamList = {
  NutritionHome: undefined;
  NutritionPlan: undefined;
  NutritionPreferences: undefined;
  NutritionMenu: undefined;
  FoodSearch: { mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' };
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
  GymProfiles: undefined;
  GymProfileEditor: { profileId?: string; isTemporary?: boolean } | undefined;
  GymExclusions:
    | {
        profileId?: string;
        excludedEquipment?: EquipmentType[];
        excludedExerciseIds?: string[];
        onSave?: (result: {
          excludedEquipment: EquipmentType[];
          excludedExerciseIds: string[];
        }) => void;
      }
    | undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Weight: undefined;
  Workouts: undefined;
  Nutrition: { screen: keyof NutritionStackParamList; params?: object } | undefined;
  Goals: undefined;
  Settings: { screen: keyof SettingsStackParamList; params?: object } | undefined;
};

export type WorkoutsStackParamList = {
  WorkoutsHome: undefined;
  RoutineBuilder: { routineId?: string } | undefined;
  ActiveWorkout: { workoutId: string };
  ExerciseLibrary: undefined;
  GeneratePlan: undefined;
  DailyReadiness: { routineId: string };
  SessionAdaptationReview: { eventId: string };
  CoachResult: {
    coaching: {
      weekly_coaching: string;
      training_tips: string[];
      nutrition_tips: string[];
      disclaimer: string;
    };
    training: Record<string, unknown> | null;
    nutrition: Record<string, unknown> | null;
    usedLlm: boolean;
  };
};

export type WeightStackParamList = {
  WeightHome: undefined;
  Measurements: undefined;
};