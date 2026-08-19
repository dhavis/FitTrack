import { GeneratedMenu } from './menuGenerator.ts';

export const PROMPT_VERSION = 'coach-v1';

export interface CoachingCopy {
  weekly_coaching: string;
  training_tips: string[];
  nutrition_tips: string[];
  disclaimer: string;
}

export interface LlmInput {
  goalType: string;
  daysPerWeek: number;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  routineNames: string[];
  avoidedGroups: string[];
  mealPrepStyle: string;
  shoppingStaples: string[];
  age?: number | null;
  gender?: string | null;
}

const DEFAULT_DISCLAIMER =
  'Educational coaching only — not medical or dietary advice. Adjust with a professional if needed.';

export function fallbackCoaching(input: LlmInput): CoachingCopy {
  return {
    weekly_coaching: `This week focuses on ${input.goalType.replace(/_/g, ' ')} with ${input.daysPerWeek} training days and nutrition targets synced to that load${
      input.calories != null ? ` (~${input.calories} kcal)` : ''
    }. Follow the plate method, hit protein first, and keep meals simple.`,
    training_tips: [
      input.routineNames.length
        ? `Rotate: ${input.routineNames.slice(0, 4).join(', ')}.`
        : 'Complete your scheduled routines; leave 1–2 reps in reserve on most sets.',
      'Progress when you hit the top of the rep range with good form.',
    ],
    nutrition_tips: [
      input.protein_g != null ? `Anchor each meal around protein (daily ~${input.protein_g}g).` : 'Prioritize protein at each meal.',
      input.avoidedGroups.includes('seafood')
        ? 'Menu excludes seafood per your preferences.'
        : 'Use the shopping staples list to stay consistent.',
      `Meal prep style: ${input.mealPrepStyle.replace(/_/g, ' ')}.`,
    ],
    disclaimer: DEFAULT_DISCLAIMER,
  };
}

function collectAllowedFoods(menu: GeneratedMenu): Set<string> {
  const set = new Set<string>();
  for (const day of menu.days) {
    for (const meal of [day.breakfast, day.lunch, day.dinner, day.snack]) {
      set.add(meal.name.toLowerCase());
      for (const c of meal.components) set.add(c.toLowerCase());
    }
  }
  for (const s of menu.shopping_staples) set.add(s.toLowerCase());
  return set;
}

/** Apply optional LLM meal label renames only if all components stay in allowlist. */
export function applyMenuLabels(
  menu: GeneratedMenu,
  labels: { day: string; meal: string; name: string }[] | undefined
): GeneratedMenu {
  if (!labels?.length) return menu;
  const allowed = collectAllowedFoods(menu);
  const next = structuredClone(menu) as GeneratedMenu;
  for (const lab of labels) {
    const day = next.days.find((d) => d.label === lab.day);
    if (!day) continue;
    const key = lab.meal as 'breakfast' | 'lunch' | 'dinner' | 'snack';
    if (!day[key]) continue;
    const words = lab.name.toLowerCase().split(/[^a-z0-9+]+/).filter(Boolean);
    // Only accept rename if it doesn't introduce unknown food tokens beyond filler words
    const fillers = new Set(['and', 'with', 'bowl', 'plate', 'meal', 'simple', 'easy', 'plus', 'the', 'a']);
    const unknown = words.filter((w) => !fillers.has(w) && ![...allowed].some((a) => a.includes(w) || w.includes(a)));
    if (unknown.length > 2) continue; // too inventive
    day[key] = { ...day[key], name: lab.name };
  }
  return next;
}

export async function generateCoachingWithLlm(
  input: LlmInput,
  menu: GeneratedMenu
): Promise<{ copy: CoachingCopy; menu: GeneratedMenu; model: string | null }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return { copy: fallbackCoaching(input), menu, model: null };
  }

  const allowedFoods = [...collectAllowedFoods(menu)].slice(0, 80);
  const system = `You are FitTrack's coaching assistant. Return ONLY valid JSON matching:
{"weekly_coaching":"string","training_tips":["string"],"nutrition_tips":["string"],"menu_labels":[{"day":"Mon","meal":"lunch","name":"string"}]}
Rules: never invent foods outside the allowlist; never change calorie/macro numbers; keep tips short; educational only.`;

  const user = JSON.stringify({
    profile: { age: input.age, gender: input.gender, goal: input.goalType, daysPerWeek: input.daysPerWeek },
    nutrition_targets: {
      calories: input.calories,
      protein_g: input.protein_g,
      carbs_g: input.carbs_g,
      fat_g: input.fat_g,
    },
    routines: input.routineNames,
    avoids: input.avoidedGroups,
    meal_prep: input.mealPrepStyle,
    allowlist_foods: allowedFoods,
    menu_day_labels: menu.days.map((d) => d.label),
  });

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!resp.ok) {
      console.error('OpenAI error', await resp.text());
      return { copy: fallbackCoaching(input), menu, model: null };
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw);
    const copy: CoachingCopy = {
      weekly_coaching: String(parsed.weekly_coaching ?? fallbackCoaching(input).weekly_coaching),
      training_tips: Array.isArray(parsed.training_tips)
        ? parsed.training_tips.map(String).slice(0, 5)
        : fallbackCoaching(input).training_tips,
      nutrition_tips: Array.isArray(parsed.nutrition_tips)
        ? parsed.nutrition_tips.map(String).slice(0, 5)
        : fallbackCoaching(input).nutrition_tips,
      disclaimer: DEFAULT_DISCLAIMER,
    };
    const labeled = applyMenuLabels(menu, parsed.menu_labels);
    return { copy, menu: labeled, model: data.model ?? 'gpt-4o-mini' };
  } catch (e) {
    console.error('LLM failed', e);
    return { copy: fallbackCoaching(input), menu, model: null };
  }
}