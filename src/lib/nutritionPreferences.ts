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

export const EATING_STYLES: { id: EatingStyle; label: string; hint: string }[] = [
  { id: 'omnivore', label: 'Omnivore', hint: 'Meat, fish, dairy, plants' },
  { id: 'pescatarian', label: 'Pescatarian', hint: 'Fish + plants (+ dairy/eggs if you like)' },
  { id: 'vegetarian', label: 'Vegetarian', hint: 'No meat or fish' },
  { id: 'vegan', label: 'Vegan', hint: 'Plant-only' },
  { id: 'custom', label: 'Custom', hint: 'I pick avoids myself' },
];

export const AVOID_GROUPS: { id: string; label: string }[] = [
  { id: 'seafood', label: 'Seafood' },
  { id: 'shellfish', label: 'Shellfish' },
  { id: 'pork', label: 'Pork' },
  { id: 'beef', label: 'Beef' },
  { id: 'poultry', label: 'Poultry' },
  { id: 'dairy', label: 'Dairy' },
  { id: 'eggs', label: 'Eggs' },
  { id: 'gluten', label: 'Gluten' },
  { id: 'nuts', label: 'Nuts' },
  { id: 'soy', label: 'Soy' },
  { id: 'spicy', label: 'Spicy food' },
];

export const VEGETABLES = [
  'Broccoli',
  'Spinach',
  'Kale',
  'Lettuce',
  'Cucumber',
  'Tomato',
  'Bell pepper',
  'Onion',
  'Garlic',
  'Mushroom',
  'Zucchini',
  'Carrot',
  'Celery',
  'Cauliflower',
  'Cabbage',
  'Brussels sprouts',
  'Asparagus',
  'Eggplant',
  'Beets',
  'Sweet potato',
  'Potato',
  'Corn',
  'Peas',
  'Green beans',
  'Avocado',
];

export const CONDIMENTS = [
  'Ketchup',
  'Mustard',
  'Mayonnaise',
  'Hot sauce',
  'Soy sauce',
  'BBQ sauce',
  'Ranch',
  'Vinaigrette',
  'Pesto',
  'Hummus',
  'Salsa',
  'Guacamole',
  'Relish',
  'Pickles',
  'Vinegar',
  'Tahini',
  'Sriracha',
  'Worcestershire',
  'Fish sauce',
  'Curry paste',
];

export const PROTEIN_OPTIONS = [
  'Chicken',
  'Turkey',
  'Lean beef',
  'Ground turkey',
  'Eggs',
  'Greek yogurt',
  'Cottage cheese',
  'Tofu',
  'Tempeh',
  'Beans',
  'Lentils',
  'Chickpeas',
  'Whey / protein powder',
  'Salmon',
  'Tuna',
  'White fish',
  'Shrimp',
];

export const CARB_OPTIONS = [
  'Rice',
  'Oats',
  'Pasta',
  'Bread',
  'Tortillas',
  'Quinoa',
  'Potatoes',
  'Sweet potatoes',
  'Couscous',
  'Fruit',
  'Crackers',
];

export const MEAL_PREP_STYLES: { id: MealPrepStyle; label: string; hint: string }[] = [
  {
    id: 'fresh_daily',
    label: 'Cook daily',
    hint: 'Simple same-day meals, minimal leftovers',
  },
  {
    id: 'batch_2_3',
    label: 'Batch 2–3 days',
    hint: 'Cook larger portions for a few days',
  },
  {
    id: 'full_week',
    label: 'Weekly meal prep',
    hint: 'One prep session; reheat through the week',
  },
];

export const COMPLEXITY_OPTIONS: { id: CookingComplexity; label: string; hint: string }[] = [
  { id: 'simple', label: 'Simple', hint: 'Few ingredients, 1-pan / one-pot' },
  { id: 'moderate', label: 'Moderate', hint: 'A bit more variety is fine' },
];

export const PREP_TIME_OPTIONS = [20, 30, 45, 60, 90];

export function applyEatingStyleDefaults(style: EatingStyle, current: NutritionPreferences): NutritionPreferences {
  const next = { ...current, eating_style: style };
  const baseAvoids = new Set(current.avoided_groups.filter((g) => !['seafood', 'shellfish', 'pork', 'beef', 'poultry'].includes(g)));
  if (style === 'vegetarian' || style === 'vegan') {
    ['seafood', 'shellfish', 'pork', 'beef', 'poultry'].forEach((g) => baseAvoids.add(g));
  }
  if (style === 'vegan') {
    baseAvoids.add('dairy');
    baseAvoids.add('eggs');
  }
  if (style === 'pescatarian') {
    ['pork', 'beef', 'poultry'].forEach((g) => baseAvoids.add(g));
  }
  next.avoided_groups = Array.from(baseAvoids);
  return next;
}

export function toggleListItem(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function preferencesSummary(prefs: NutritionPreferences): string {
  const bits: string[] = [];
  bits.push(prefs.eating_style.replace('_', ' '));
  if (prefs.avoided_groups.length) bits.push(`avoid ${prefs.avoided_groups.slice(0, 3).join(', ')}${prefs.avoided_groups.length > 3 ? '…' : ''}`);
  if (prefs.disliked_vegetables.length) bits.push(`${prefs.disliked_vegetables.length} veg disliked`);
  if (prefs.disliked_condiments.length) bits.push(`${prefs.disliked_condiments.length} condiments disliked`);
  bits.push(prefs.meal_prep_style.replace(/_/g, ' '));
  return bits.join(' · ');
}