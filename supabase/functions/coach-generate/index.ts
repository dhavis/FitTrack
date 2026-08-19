import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { generateMenu } from '../_shared/menuGenerator.ts';
import { DEFAULT_PREFERENCES, NutritionPreferences } from '../_shared/nutritionPreferences.ts';
import { buildNutritionPlanFromGoals } from '../_shared/nutritionPlan.ts';
import {
  defaultsForExperience,
  equipmentAllowed,
  templatesFor,
  type EquipmentPref,
  type ExperienceLevel,
  type PrimaryGoalType,
} from '../_shared/programTemplates.ts';
import { generateCoachingWithLlm, PROMPT_VERSION } from '../_shared/llm.ts';

type Mode = 'full' | 'nutrition_only' | 'training_only';

interface RequestBody {
  mode?: Mode;
  goalType?: PrimaryGoalType;
  experience?: ExperienceLevel;
  daysPerWeek?: number;
  equipment?: EquipmentPref;
  sessionMinutes?: number;
  injuryNotes?: string | null;
}

const RATE_LIMIT_MS = 3 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing authorization' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: 'Unauthorized' }, 401);
    const userId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const mode: Mode = body.mode ?? 'full';

    // Rate limit
    const { data: lastPlan } = await admin
      .from('coach_plans')
      .select('generated_at')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastPlan?.generated_at) {
      const elapsed = Date.now() - new Date(lastPlan.generated_at).getTime();
      if (elapsed < RATE_LIMIT_MS) {
        return jsonResponse(
          {
            error: 'Please wait a few minutes before generating again.',
            retry_after_seconds: Math.ceil((RATE_LIMIT_MS - elapsed) / 1000),
          },
          429
        );
      }
    }

    const [
      { data: profile },
      { data: goalsExisting },
      { data: weightRows },
      { data: nutritionPlanExisting },
      { data: recentWorkouts },
    ] = await Promise.all([
      admin.from('profiles').select('*').eq('id', userId).maybeSingle(),
      admin.from('goals').select('*').eq('user_id', userId).maybeSingle(),
      admin
        .from('weight_logs')
        .select('weight_kg, logged_at')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(1),
      admin.from('nutrition_plans').select('*').eq('user_id', userId).maybeSingle(),
      admin
        .from('workouts')
        .select('id, completed_at, name')
        .eq('user_id', userId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(7),
    ]);

    const goalType: PrimaryGoalType =
      body.goalType ?? goalsExisting?.primary_goal_type ?? 'general';
    const experience: ExperienceLevel =
      body.experience ?? goalsExisting?.experience ?? 'beginner';
    const daysPerWeek = Math.min(
      Math.max(body.daysPerWeek ?? goalsExisting?.days_per_week ?? goalsExisting?.weekly_workout_target ?? 4, 2),
      6
    );
    const equipment: EquipmentPref =
      body.equipment ?? goalsExisting?.equipment_pref ?? 'full_gym';
    const sessionMinutes = body.sessionMinutes ?? goalsExisting?.session_minutes ?? 60;
    const injuryNotes = body.injuryNotes ?? goalsExisting?.injury_notes ?? null;
    const weightKg = weightRows?.[0]?.weight_kg ?? goalsExisting?.target_weight_kg ?? null;

    // Upsert goals training fields when generating
    await admin.from('goals').upsert({
      user_id: userId,
      weekly_workout_target: daysPerWeek,
      primary_goal_type: goalType,
      experience,
      days_per_week: daysPerWeek,
      equipment_pref: equipment,
      session_minutes: sessionMinutes,
      injury_notes: injuryNotes,
      target_weight_kg: goalsExisting?.target_weight_kg ?? null,
      daily_calorie_target: goalsExisting?.daily_calorie_target ?? null,
      daily_protein_target_g: goalsExisting?.daily_protein_target_g ?? null,
      daily_carbs_target_g: goalsExisting?.daily_carbs_target_g ?? null,
      daily_fat_target_g: goalsExisting?.daily_fat_target_g ?? null,
      updated_at: new Date().toISOString(),
    });

    const goalsForNutrition = {
      ...(goalsExisting ?? {}),
      primary_goal_type: goalType,
      days_per_week: daysPerWeek,
      weekly_workout_target: daysPerWeek,
    };

    const nutritionDraft = buildNutritionPlanFromGoals({
      goals: goalsForNutrition,
      weightKg,
      age: profile?.age,
      gender: profile?.gender,
      heightCm: profile?.height_cm,
    });

    const prefs: NutritionPreferences = {
      ...DEFAULT_PREFERENCES,
      ...((nutritionPlanExisting?.preferences as NutritionPreferences) ?? {}),
    };

    // Mon=0 ... map first N weekdays as training days for carb bias
    const hardTrainingDayIndexes = Array.from({ length: daysPerWeek }, (_, i) => i);

    let menu = generateMenu(prefs, { hardTrainingDayIndexes });

    // --- Training program ---
    let trainingSummary: Record<string, unknown> | null = null;
    const routineNames: string[] = [];

    if (mode === 'full' || mode === 'training_only') {
      const days = templatesFor(goalType, daysPerWeek);
      const allMuscles = Array.from(new Set(days.flatMap((d) => d.muscles)));
      const { data: exercises } = await admin
        .from('exercises')
        .select('id, name, muscle_group, equipment')
        .or(`user_id.is.null,user_id.eq.${userId}`)
        .in('muscle_group', allMuscles)
        .limit(200);

      const byMuscle: Record<string, typeof exercises> = {};
      for (const m of allMuscles) byMuscle[m] = [];
      for (const ex of exercises ?? []) {
        const m = ex.muscle_group;
        if (m && byMuscle[m]) byMuscle[m].push(ex);
      }

      const defaults = defaultsForExperience(experience);
      const exercisesPerDay = Math.max(4, Math.min(8, Math.floor(sessionMinutes / 12)));

      const { data: program, error: programError } = await admin
        .from('training_programs')
        .insert({
          user_id: userId,
          name: `${goalType.replace('_', ' ')} ${daysPerWeek}-day coach plan`,
          goal_type: goalType,
          generated_from: {
            source: 'coach-generate',
            goalType,
            experience,
            daysPerWeek,
            equipment,
            sessionMinutes,
            injuryNotes,
          },
        })
        .select()
        .single();

      if (programError || !program) {
        throw new Error(programError?.message ?? 'Failed to create program');
      }

      const routineIds: string[] = [];
      for (const day of days) {
        const pool = day.muscles
          .flatMap((m) => byMuscle[m] ?? [])
          .filter((ex, idx, arr) => arr.findIndex((x) => x.id === ex.id) === idx)
          .filter((ex) => equipmentAllowed(equipment, ex.equipment));

        // Light injury filter: drop names matching keywords in injury notes
        const injury = (injuryNotes ?? '').toLowerCase();
        const filtered = injury
          ? pool.filter((ex) => {
              const n = ex.name.toLowerCase();
              if (injury.includes('overhead') && n.includes('overhead')) return false;
              if (injury.includes('shoulder') && (n.includes('shoulder') || n.includes('press'))) return false;
              return true;
            })
          : pool;

        const selected = (filtered.length ? filtered : pool).slice(0, exercisesPerDay);
        if (!selected.length) continue;

        const { data: routine, error: routineError } = await admin
          .from('routines')
          .insert({
            user_id: userId,
            program_id: program.id,
            name: day.name,
            description: day.description,
          })
          .select()
          .single();

        if (routineError || !routine) {
          throw new Error(routineError?.message ?? 'Failed to create routine');
        }

        routineIds.push(routine.id);
        routineNames.push(routine.name);

        const rows = selected.map((ex, index) => ({
          routine_id: routine.id,
          exercise_id: ex.id,
          order_index: index,
          target_sets: defaults.sets,
          target_reps: defaults.reps,
          rest_seconds: defaults.rest,
          target_weight_kg: null,
        }));
        const { error: reError } = await admin.from('routine_exercises').insert(rows);
        if (reError) throw new Error(reError.message);
      }

      trainingSummary = {
        program_id: program.id,
        program_name: program.name,
        routine_ids: routineIds,
        routine_names: routineNames,
        days_per_week: daysPerWeek,
        goal_type: goalType,
      };
    }

    // --- Nutrition persist + coaching ---
    let nutritionSummary: Record<string, unknown> | null = null;

    const llmResult = await generateCoachingWithLlm(
      {
        goalType,
        daysPerWeek,
        calories:
          mode === 'training_only'
            ? nutritionPlanExisting?.daily_calorie_target ?? nutritionDraft.daily_calorie_target
            : nutritionDraft.daily_calorie_target,
        protein_g:
          mode === 'training_only'
            ? nutritionPlanExisting?.daily_protein_g ?? nutritionDraft.daily_protein_g
            : nutritionDraft.daily_protein_g,
        carbs_g:
          mode === 'training_only'
            ? nutritionPlanExisting?.daily_carbs_g ?? nutritionDraft.daily_carbs_g
            : nutritionDraft.daily_carbs_g,
        fat_g:
          mode === 'training_only'
            ? nutritionPlanExisting?.daily_fat_g ?? nutritionDraft.daily_fat_g
            : nutritionDraft.daily_fat_g,
        routineNames,
        avoidedGroups: prefs.avoided_groups,
        mealPrepStyle: prefs.meal_prep_style,
        shoppingStaples: menu.shopping_staples,
        age: profile?.age,
        gender: profile?.gender,
      },
      menu
    );
    menu = llmResult.menu;
    const coachingCopy = llmResult.copy;
    const modelUsed = llmResult.model;

    if (mode === 'full' || mode === 'nutrition_only') {
      await admin.from('nutrition_plans').upsert({
        user_id: userId,
        daily_calorie_target: nutritionDraft.daily_calorie_target,
        daily_protein_g: nutritionDraft.daily_protein_g,
        daily_carbs_g: nutritionDraft.daily_carbs_g,
        daily_fat_g: nutritionDraft.daily_fat_g,
        daily_fiber_g: nutritionDraft.daily_fiber_g,
        water_ml: nutritionDraft.water_ml,
        meals_per_day: nutritionDraft.meals_per_day,
        breakfast_kcal: nutritionDraft.breakfast_kcal,
        lunch_kcal: nutritionDraft.lunch_kcal,
        dinner_kcal: nutritionDraft.dinner_kcal,
        snack_kcal: nutritionDraft.snack_kcal,
        protein_g_per_kg: nutritionDraft.protein_g_per_kg,
        calorie_adjustment_pct: nutritionDraft.calorie_adjustment_pct,
        notes: nutritionDraft.notes,
        preferences: prefs,
        meal_menu: menu,
        updated_at: new Date().toISOString(),
      });

      await admin.from('goals').upsert({
        user_id: userId,
        weekly_workout_target: daysPerWeek,
        primary_goal_type: goalType,
        experience,
        days_per_week: daysPerWeek,
        equipment_pref: equipment,
        session_minutes: sessionMinutes,
        injury_notes: injuryNotes,
        target_weight_kg: goalsExisting?.target_weight_kg ?? null,
        daily_calorie_target: nutritionDraft.daily_calorie_target,
        daily_protein_target_g: nutritionDraft.daily_protein_g,
        daily_carbs_target_g: nutritionDraft.daily_carbs_g,
        daily_fat_target_g: nutritionDraft.daily_fat_g,
        updated_at: new Date().toISOString(),
      });

      nutritionSummary = {
        daily_calorie_target: nutritionDraft.daily_calorie_target,
        daily_protein_g: nutritionDraft.daily_protein_g,
        daily_carbs_g: nutritionDraft.daily_carbs_g,
        daily_fat_g: nutritionDraft.daily_fat_g,
        meal_prep_style: prefs.meal_prep_style,
        shopping_staples: menu.shopping_staples,
      };
    }

    // Deactivate previous active plans
    await admin.from('coach_plans').update({ is_active: false }).eq('user_id', userId).eq('is_active', true);

    const contextSnapshot = {
      age: profile?.age ?? null,
      gender: profile?.gender ?? null,
      height_cm: profile?.height_cm ?? null,
      weight_kg: weightKg,
      recent_workouts: (recentWorkouts ?? []).length,
      mode,
    };

    const { data: coachPlan, error: coachError } = await admin
      .from('coach_plans')
      .insert({
        user_id: userId,
        is_active: true,
        goal_snapshot: {
          goal_type: goalType,
          experience,
          days_per_week: daysPerWeek,
          equipment,
          session_minutes: sessionMinutes,
        },
        context_snapshot: contextSnapshot,
        training_summary: trainingSummary,
        nutrition_summary: nutritionSummary,
        coaching_copy: coachingCopy,
        model: modelUsed,
        prompt_version: PROMPT_VERSION,
      })
      .select()
      .single();

    if (coachError) throw new Error(coachError.message);

    return jsonResponse({
      ok: true,
      coach_plan: coachPlan,
      training: trainingSummary,
      nutrition: nutritionSummary,
      coaching: coachingCopy,
      used_llm: Boolean(modelUsed),
    });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: e instanceof Error ? e.message : 'Coach generate failed' }, 500);
  }
});