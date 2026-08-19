// USDA FoodData Central API client.
// Get a free API key at https://fdc.nal.usda.gov/api-key-signup.html
// and set EXPO_PUBLIC_USDA_API_KEY in your .env file.
// Falls back to the shared "DEMO_KEY" (heavily rate-limited) if unset.

const API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY || 'DEMO_KEY';
const BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

export interface FoodSearchResult {
  fdcId: number;
  description: string;
  brandOwner?: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  servingSize?: number;
  servingSizeUnit?: string;
}

interface UsdaNutrient {
  nutrientId: number;
  nutrientName: string;
  value: number;
}

const NUTRIENT_IDS = {
  calories: [1008, 2047, 2048],
  protein: [1003],
  fat: [1004],
  carbs: [1005],
};

function pickNutrient(nutrients: UsdaNutrient[], ids: number[]): number {
  const match = nutrients.find((n) => ids.includes(n.nutrientId));
  return match?.value ?? 0;
}

export async function searchFoods(query: string): Promise<FoodSearchResult[]> {
  if (!query.trim()) return [];

  const url = `${BASE_URL}/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(
    query
  )}&pageSize=25&dataType=Foundation,SR%20Legacy,Branded`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Food search failed (${res.status}). Check your USDA API key.`);
  }
  const json = await res.json();

  return (json.foods ?? []).map((food: any) => {
    const nutrients: UsdaNutrient[] = (food.foodNutrients ?? []).map((n: any) => ({
      nutrientId: n.nutrientId,
      nutrientName: n.nutrientName,
      value: n.value ?? 0,
    }));

    return {
      fdcId: food.fdcId,
      description: food.description,
      brandOwner: food.brandOwner,
      calories: pickNutrient(nutrients, NUTRIENT_IDS.calories),
      protein_g: pickNutrient(nutrients, NUTRIENT_IDS.protein),
      carbs_g: pickNutrient(nutrients, NUTRIENT_IDS.carbs),
      fat_g: pickNutrient(nutrients, NUTRIENT_IDS.fat),
      servingSize: food.servingSize,
      servingSizeUnit: food.servingSizeUnit,
    } as FoodSearchResult;
  });
}
