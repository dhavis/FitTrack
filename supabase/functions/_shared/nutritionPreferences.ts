export type EatingStyle = 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'custom';
export type MealPrepStyle = 'fresh_daily' | 'batch_2_3' | 'full_week';
export type CookingComplexity = 'simple' | 'moderate';

export interface NutritionPreferences {
  eating_style: EatingStyle;
  avoided_groups: string[];
  disliked_vegetables: string[];
  disliked_condiments: string[];
  preferred_proteins: string[];
  preferred_carbs: string[];
  preferred_vegetables: string[];
  meal_prep_style: MealPrepStyle;
  prep_time_minutes: number;
  cooking_complexity: CookingComplexity;
  custom_avoids: string[];
  custom_notes: string;
}

export const DEFAULT_PREFERENCES: NutritionPreferences = {
  eating_style: 'omnivore',
  avoided_groups: [],
  disliked_vegetables: [],
  disliked_condiments: [],
  preferred_proteins: [],
  preferred_carbs: [],
  preferred_vegetables: [],
  meal_prep_style: 'batch_2_3',
  prep_time_minutes: 45,
  cooking_complexity: 'simple',
  custom_avoids: [],
  custom_notes: '',
};