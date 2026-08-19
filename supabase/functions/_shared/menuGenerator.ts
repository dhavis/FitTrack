import { NutritionPreferences } from './nutritionPreferences.ts';

export interface MenuMealIdea {
  name: string;
  components: string[];
  prep_friendly: boolean;
  notes?: string;
}

export interface MenuDay {
  label: string;
  breakfast: MenuMealIdea;
  lunch: MenuMealIdea;
  dinner: MenuMealIdea;
  snack: MenuMealIdea;
}

export interface GeneratedMenu {
  generated_at: string;
  days: MenuDay[];
  prep_batch: string[];
  shopping_staples: string[];
  guidance: string;
}

type FoodItem = {
  name: string;
  tags: string[]; // protein group tags: seafood, poultry, beef, pork, dairy, eggs, soy, gluten, nuts, spicy
  category: 'protein' | 'carb' | 'veg' | 'condiment' | 'snack';
  prep_friendly: boolean;
};

const FOODS: FoodItem[] = [
  { name: 'Chicken breast', tags: ['poultry'], category: 'protein', prep_friendly: true },
  { name: 'Turkey mince', tags: ['poultry'], category: 'protein', prep_friendly: true },
  { name: 'Lean beef', tags: ['beef'], category: 'protein', prep_friendly: true },
  { name: 'Eggs', tags: ['eggs'], category: 'protein', prep_friendly: false },
  { name: 'Greek yogurt', tags: ['dairy'], category: 'protein', prep_friendly: false },
  { name: 'Cottage cheese', tags: ['dairy'], category: 'protein', prep_friendly: false },
  { name: 'Tofu', tags: ['soy'], category: 'protein', prep_friendly: true },
  { name: 'Tempeh', tags: ['soy'], category: 'protein', prep_friendly: true },
  { name: 'Lentils', tags: [], category: 'protein', prep_friendly: true },
  { name: 'Chickpeas', tags: [], category: 'protein', prep_friendly: true },
  { name: 'Black beans', tags: [], category: 'protein', prep_friendly: true },
  { name: 'Salmon', tags: ['seafood'], category: 'protein', prep_friendly: false },
  { name: 'Tuna', tags: ['seafood'], category: 'protein', prep_friendly: false },
  { name: 'White fish', tags: ['seafood'], category: 'protein', prep_friendly: false },
  { name: 'Shrimp', tags: ['seafood', 'shellfish'], category: 'protein', prep_friendly: false },
  { name: 'Rice', tags: [], category: 'carb', prep_friendly: true },
  { name: 'Oats', tags: ['gluten'], category: 'carb', prep_friendly: true },
  { name: 'Pasta', tags: ['gluten'], category: 'carb', prep_friendly: true },
  { name: 'Potatoes', tags: [], category: 'carb', prep_friendly: true },
  { name: 'Sweet potatoes', tags: [], category: 'carb', prep_friendly: true },
  { name: 'Quinoa', tags: [], category: 'carb', prep_friendly: true },
  { name: 'Tortillas', tags: ['gluten'], category: 'carb', prep_friendly: false },
  { name: 'Bread', tags: ['gluten'], category: 'carb', prep_friendly: false },
  { name: 'Broccoli', tags: [], category: 'veg', prep_friendly: true },
  { name: 'Spinach', tags: [], category: 'veg', prep_friendly: false },
  { name: 'Bell pepper', tags: [], category: 'veg', prep_friendly: true },
  { name: 'Zucchini', tags: [], category: 'veg', prep_friendly: true },
  { name: 'Carrot', tags: [], category: 'veg', prep_friendly: true },
  { name: 'Cucumber', tags: [], category: 'veg', prep_friendly: false },
  { name: 'Tomato', tags: [], category: 'veg', prep_friendly: false },
  { name: 'Green beans', tags: [], category: 'veg', prep_friendly: true },
  { name: 'Cauliflower', tags: [], category: 'veg', prep_friendly: true },
  { name: 'Lettuce', tags: [], category: 'veg', prep_friendly: false },
  { name: 'Mushroom', tags: [], category: 'veg', prep_friendly: true },
  { name: 'Onion', tags: [], category: 'veg', prep_friendly: true },
  { name: 'Avocado', tags: [], category: 'veg', prep_friendly: false },
  { name: 'Olive oil + salt/pepper', tags: [], category: 'condiment', prep_friendly: true },
  { name: 'Lemon juice', tags: [], category: 'condiment', prep_friendly: true },
  { name: 'Garlic powder', tags: [], category: 'condiment', prep_friendly: true },
  { name: 'Salsa', tags: [], category: 'condiment', prep_friendly: true },
  { name: 'Hummus', tags: [], category: 'condiment', prep_friendly: true },
  { name: 'Mustard', tags: [], category: 'condiment', prep_friendly: true },
  { name: 'Soy sauce', tags: ['soy'], category: 'condiment', prep_friendly: true },
  { name: 'Hot sauce', tags: ['spicy'], category: 'condiment', prep_friendly: true },
  { name: 'Pesto', tags: ['nuts', 'dairy'], category: 'condiment', prep_friendly: true },
  { name: 'Ranch', tags: ['dairy'], category: 'condiment', prep_friendly: true },
  { name: 'Mayonnaise', tags: ['eggs'], category: 'condiment', prep_friendly: true },
  { name: 'Ketchup', tags: [], category: 'condiment', prep_friendly: true },
  { name: 'Apple + peanut butter', tags: ['nuts'], category: 'snack', prep_friendly: false },
  { name: 'Rice cakes + cottage cheese', tags: ['dairy'], category: 'snack', prep_friendly: false },
  { name: 'Protein shake + banana', tags: ['dairy'], category: 'snack', prep_friendly: false },
  { name: 'Carrot sticks + hummus', tags: [], category: 'snack', prep_friendly: true },
  { name: 'Greek yogurt + berries', tags: ['dairy'], category: 'snack', prep_friendly: false },
  { name: 'Handful of almonds', tags: ['nuts'], category: 'snack', prep_friendly: false },
];

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function isAvoided(item: FoodItem, prefs: NutritionPreferences): boolean {
  if (item.tags.some((t) => prefs.avoided_groups.includes(t))) return true;
  const name = normalize(item.name);
  const custom = prefs.custom_avoids.map(normalize).filter(Boolean);
  if (custom.some((c) => name.includes(c) || c.includes(name))) return true;
  if (item.category === 'veg' && prefs.disliked_vegetables.some((v) => normalize(v) === name || name.includes(normalize(v)))) {
    return true;
  }
  if (item.category === 'condiment' && prefs.disliked_condiments.some((c) => normalize(c) === name || name.includes(normalize(c)))) {
    return true;
  }
  return false;
}

function preferBoost(item: FoodItem, prefs: NutritionPreferences): number {
  let score = 0;
  const name = normalize(item.name);
  const matchList = (list: string[]) => list.some((p) => name.includes(normalize(p)) || normalize(p).includes(name));
  if (item.category === 'protein' && matchList(prefs.preferred_proteins)) score += 3;
  if (item.category === 'carb' && matchList(prefs.preferred_carbs)) score += 3;
  if (item.category === 'veg' && matchList(prefs.preferred_vegetables)) score += 3;
  if (prefs.meal_prep_style !== 'fresh_daily' && item.prep_friendly) score += 1;
  if (prefs.cooking_complexity === 'simple' && item.prep_friendly) score += 1;
  return score;
}

function pickPool(category: FoodItem['category'], prefs: NutritionPreferences): FoodItem[] {
  return FOODS.filter((f) => f.category === category && !isAvoided(f, prefs)).sort(
    (a, b) => preferBoost(b, prefs) - preferBoost(a, prefs)
  );
}

function pick(pool: FoodItem[], index: number, fallback: string): FoodItem {
  if (!pool.length) {
    return { name: fallback, tags: [], category: 'protein', prep_friendly: true };
  }
  return pool[index % pool.length];
}

function meal(
  name: string,
  components: string[],
  prep_friendly: boolean,
  notes?: string
): MenuMealIdea {
  return { name, components, prep_friendly, notes };
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function generateMenu(
  prefs: NutritionPreferences,
  opts?: { hardTrainingDayIndexes?: number[] }
): GeneratedMenu {
  const hardDays = new Set(opts?.hardTrainingDayIndexes ?? []);
  const proteins = pickPool('protein', prefs);
  const carbs = pickPool('carb', prefs);
  const vegs = pickPool('veg', prefs);
  const condiments = pickPool('condiment', prefs);
  const snacks = pickPool('snack', prefs);

  const days: MenuDay[] = DAY_LABELS.map((label, i) => {
    const p = pick(proteins, i, 'Protein of choice');
    const p2 = pick(proteins, i + 2, 'Protein of choice');
    const c = pick(carbs, i, 'Carb of choice');
    const c2 = pick(carbs, i + 1, 'Carb of choice');
    const v = pick(vegs, i, 'Veg of choice');
    const v2 = pick(vegs, i + 1, 'Veg of choice');
    const sauce = pick(condiments, i, 'Salt & pepper');
    const snackItem = pick(snacks, i, 'Fruit');

    const breakfast =
      !prefs.avoided_groups.includes('eggs') && preferBoost({ name: 'Eggs', tags: ['eggs'], category: 'protein', prep_friendly: false }, prefs) >= 0 &&
      proteins.some((x) => x.name === 'Eggs')
        ? meal('Eggs + toast + fruit', ['Eggs', pick(carbs, 0, 'Bread').name, 'Fruit'], false)
        : !prefs.avoided_groups.includes('dairy') && proteins.some((x) => x.name.includes('yogurt'))
          ? meal('Yogurt bowl', ['Greek yogurt', 'Fruit', pick(carbs, 1, 'Oats').name], false)
          : meal(`${c.name} breakfast bowl`, [c.name, p.name, 'Fruit'], true, 'Swap protein if needed');

    // Prefer batchable lunch/dinner for meal prep styles
    const lunchCarb = hardDays.has(i) ? pick(carbs, 0, c.name) : c;
    const lunch = meal(`${p.name} plate`, [p.name, lunchCarb.name, v.name, sauce.name], p.prep_friendly && lunchCarb.prep_friendly, hardDays.has(i) ? 'Training day — keep carbs a bit higher' : 'Same base works for leftovers');
    const dinner = meal(`${p2.name} dinner`, [p2.name, c2.name, v2.name, pick(condiments, i + 1, 'Olive oil + salt/pepper').name], p2.prep_friendly);

    return {
      label,
      breakfast,
      lunch,
      dinner,
      snack: meal(snackItem.name, [snackItem.name], snackItem.prep_friendly),
    };
  });

  const prepBatch: string[] = [];
  if (prefs.meal_prep_style === 'batch_2_3' || prefs.meal_prep_style === 'full_week') {
    const topP = proteins.filter((p) => p.prep_friendly).slice(0, 2).map((p) => p.name);
    const topC = carbs.filter((c) => c.prep_friendly).slice(0, 2).map((c) => c.name);
    const topV = vegs.filter((v) => v.prep_friendly).slice(0, 3).map((v) => v.name);
    if (topP.length) prepBatch.push(`Cook ${topP.join(' + ')} in bulk`);
    if (topC.length) prepBatch.push(`Batch cook ${topC.join(' + ')}`);
    if (topV.length) prepBatch.push(`Chop / roast ${topV.join(', ')}`);
    prepBatch.push('Portion into containers for grab-and-go lunches');
    if (prefs.meal_prep_style === 'full_week') {
      prepBatch.push('Prep once for ~5 days; freeze 1–2 portions if needed');
    } else {
      prepBatch.push('Reprep mid-week so food stays fresh');
    }
  } else {
    prepBatch.push('Keep staples ready: washed veg, cooked carb base, one protein');
    prepBatch.push('Assemble meals in under your prep-time budget');
  }

  const staples = Array.from(
    new Set([
      ...proteins.slice(0, 4).map((x) => x.name),
      ...carbs.slice(0, 3).map((x) => x.name),
      ...vegs.slice(0, 5).map((x) => x.name),
      ...condiments.slice(0, 3).map((x) => x.name),
      'Olive oil',
      'Salt & pepper',
    ])
  );

  const guidanceParts = [
    'Flexible plate method: protein + carb + veg + simple seasoning.',
    `Cooking: ${prefs.cooking_complexity}, ~${prefs.prep_time_minutes} min.`,
    prefs.meal_prep_style === 'fresh_daily'
      ? 'Cook fresh each day; reuse the same templates so decisions stay easy.'
      : prefs.meal_prep_style === 'full_week'
        ? 'Weekly prep: cook bases once, remix seasons/sides for variety.'
        : 'Batch every 2–3 days for easy meal prep without week-old food.',
  ];
  if (prefs.avoided_groups.includes('seafood')) {
    guidanceParts.push('No seafood used in this menu.');
  }
  if (prefs.disliked_vegetables.length || prefs.disliked_condiments.length) {
    guidanceParts.push('Disliked veg/condiments were filtered out.');
  }
  if (prefs.custom_notes.trim()) {
    guidanceParts.push(`Your note: ${prefs.custom_notes.trim()}`);
  }

  return {
    generated_at: new Date().toISOString(),
    days,
    prep_batch: prepBatch,
    shopping_staples: staples,
    guidance: guidanceParts.join(' '),
  };
}