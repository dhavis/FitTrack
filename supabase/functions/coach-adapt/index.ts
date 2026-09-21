import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

interface RequestBody {
  check_in_id: string;
  routine_id: string;
}

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
    const { check_in_id, routine_id } = body;

    if (!check_in_id || !routine_id) {
      return jsonResponse({ error: 'check_in_id and routine_id are required' }, 400);
    }

    // Load check-in, routine, routine exercises with exercises, profile, and goals
    const [
      { data: checkIn, error: checkInError },
      { data: routine, error: routineError },
      { data: routineExercises, error: reError },
      { data: profile },
      { data: goals },
    ] = await Promise.all([
      admin.from('daily_check_ins').select('*').eq('id', check_in_id).eq('user_id', userId).single(),
      admin.from('routines').select('*').eq('id', routine_id).eq('user_id', userId).single(),
      admin
        .from('routine_exercises')
        .select('*, exercise:exercises(*)')
        .eq('routine_id', routine_id)
        .order('order_index'),
      admin.from('profiles').select('*').eq('id', userId).maybeSingle(),
      admin.from('goals').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    if (checkInError || !checkIn) {
      return jsonResponse({ error: 'Check-in not found or not owned' }, 404);
    }
    if (routineError || !routine) {
      return jsonResponse({ error: 'Routine not found or not owned' }, 404);
    }
    if (reError) {
      return jsonResponse({ error: reError.message }, 500);
    }

    const checkInSnapshot = checkIn;
    const routineSnapshot = {
      ...routine,
      exercises: routineExercises ?? [],
    };
    const contextSnapshot = {
      age: profile?.age ?? null,
      gender: profile?.gender ?? null,
      experience: goals?.experience ?? null,
      primary_goal_type: goals?.primary_goal_type ?? null,
      session_minutes: goals?.session_minutes ?? null,
    };

    // 1. Safety Hold: If pain or new injury reported
    if (checkIn.pain_or_new_injury) {
      const { data: event, error: insertError } = await userClient
        .from('adaptation_events')
        .insert({
          user_id: userId,
          check_in_id: checkIn.id,
          source_routine_id: routine.id,
          status: 'safety_hold',
          check_in_snapshot: checkInSnapshot,
          source_routine_snapshot: routineSnapshot,
          context_snapshot: contextSnapshot,
          model_proposal: null,
          validated_prescription: null,
          generation_source: 'safety_rules',
          provider: null,
          model: null,
          prompt_version: 'adapt-v1',
          schema_version: 'adapt-v1',
          validator_version: 'adapt-v1',
          validation_reason: 'Safety hold triggered by pain or new injury report.',
          disclaimer_version: 'rec-v1',
        })
        .select()
        .single();

      if (insertError || !event) {
        console.error('Failed to insert safety hold event:', insertError);
        return jsonResponse({ error: insertError?.message ?? 'Failed to create adaptation event' }, 500);
      }

      return jsonResponse({
        ok: true,
        status: 'safety_hold',
        event_id: event.id,
        disclaimer_version: 'rec-v1',
        event,
        original: {
          routine,
          exercises: routineExercises ?? [],
        },
      });
    }

    // 2. Deterministic Adaptation
    const exercisesList = routineExercises ?? [];
    const highFatigue =
      checkIn.tiredness >= 4 || checkIn.energy <= 2 || checkIn.overall_soreness >= 3;
    const isOlder = profile?.age != null && profile.age >= 50;
    const isBeginner = goals?.experience === 'beginner';
    const availableMinutes = checkIn.available_minutes ?? 60;
    const isShortTime = availableMinutes < 45;
    const isVeryShortTime = availableMinutes <= 30;

    // Time-based filtering: trim accessory movements if short on time
    let selectedExercises = exercisesList;
    if (isVeryShortTime && exercisesList.length > 2) {
      selectedExercises = exercisesList.slice(0, Math.min(3, exercisesList.length));
    } else if (isShortTime && exercisesList.length > 4) {
      selectedExercises = exercisesList.slice(0, 4);
    }

    const sorenessByMuscle: Record<string, number> = checkIn.soreness_by_muscle ?? {};
    let hasReducedVolume = selectedExercises.length < exercisesList.length;
    let soreMuscleImpacted = false;

    const prescribedExercises = selectedExercises.map((re) => {
      const exerciseName = re.exercise?.name ?? 'Exercise';
      const muscleGroup = (re.exercise?.muscle_group ?? '').toLowerCase();
      
      // Find soreness score for this exercise muscle group
      let muscleSoreness = 0;
      for (const [group, score] of Object.entries(sorenessByMuscle)) {
        if (group.toLowerCase() === muscleGroup || muscleGroup.includes(group.toLowerCase())) {
          muscleSoreness = Math.max(muscleSoreness, Number(score) || 0);
        }
      }

      const isSore = muscleSoreness >= 3;
      if (isSore) soreMuscleImpacted = true;

      let targetSets = re.target_sets;
      const reasons: string[] = [];

      if (isSore) {
        targetSets = Math.max(1, Math.round(targetSets * 0.5));
        hasReducedVolume = true;
        reasons.push(`Reduced sets (${re.target_sets} → ${targetSets}) for sore ${re.exercise?.muscle_group ?? 'muscle'}`);
      } else if (highFatigue) {
        targetSets = Math.max(1, Math.round(targetSets * 0.7));
        if (targetSets < re.target_sets) {
          hasReducedVolume = true;
          reasons.push(`Reduced sets (${re.target_sets} → ${targetSets}) for fatigue recovery`);
        }
      }

      if ((isOlder || isBeginner) && targetSets > 3) {
        targetSets = Math.min(targetSets, 3);
        if (reasons.length === 0) {
          reasons.push('Capped volume for steady recovery');
        }
      }

      let restSeconds = re.rest_seconds;
      if (isOlder || highFatigue) {
        restSeconds = Math.min(180, restSeconds + 15);
      }
      if (isShortTime && restSeconds > 60) {
        restSeconds = Math.max(45, restSeconds - 15);
      }

      if (reasons.length === 0) {
        if (isShortTime && selectedExercises.length < exercisesList.length) {
          reasons.push('Kept primary movement for shortened session');
        } else {
          reasons.push('Full target preserved');
        }
      }

      return {
        exercise_id: re.exercise_id,
        name: exerciseName,
        target_sets: targetSets,
        target_reps: re.target_reps,
        target_weight_kg: re.target_weight_kg ?? null,
        rest_seconds: restSeconds,
        reason: reasons.join('. '),
      };
    });

    const sessionAction: 'full' | 'reduced' = hasReducedVolume ? 'reduced' : 'full';

    let coachMessage = 'Readiness is looking strong today! We kept your routine at full target volume.';
    if (highFatigue && soreMuscleImpacted) {
      coachMessage = "Readiness is low and muscles are sore. We trimmed volume and eased load so you can recover without missing your session.";
    } else if (soreMuscleImpacted) {
      coachMessage = 'We reduced volume on your sore muscle groups while keeping the rest of your session on track.';
    } else if (highFatigue) {
      coachMessage = 'Higher fatigue detected today. We reduced total sets by ~30% to keep movement quality high.';
    } else if (isShortTime) {
      coachMessage = `Streamlined to fit your ${availableMinutes}-minute window, keeping your key compound lifts.`;
    }

    const validatedPrescription = {
      exercises: prescribedExercises,
      session_action: sessionAction,
      coach_message: coachMessage,
      nutrition_emphasis: 'normal' as const,
    };

    // Insert pending adaptation event as the user
    const { data: event, error: insertError } = await userClient
      .from('adaptation_events')
      .insert({
        user_id: userId,
        check_in_id: checkIn.id,
        source_routine_id: routine.id,
        status: 'pending',
        check_in_snapshot: checkInSnapshot,
        source_routine_snapshot: routineSnapshot,
        context_snapshot: contextSnapshot,
        model_proposal: null,
        validated_prescription: validatedPrescription,
        generation_source: 'deterministic_fallback',
        provider: null,
        model: null,
        prompt_version: 'adapt-v1',
        schema_version: 'adapt-v1',
        validator_version: 'adapt-v1',
        validation_reason: 'Deterministic readiness adaptation applied.',
        disclaimer_version: 'rec-v1',
      })
      .select()
      .single();

    if (insertError || !event) {
      console.error('Failed to insert adaptation event:', insertError);
      return jsonResponse({ error: insertError?.message ?? 'Failed to create adaptation event' }, 500);
    }

    return jsonResponse({
      ok: true,
      status: 'pending',
      event_id: event.id,
      disclaimer_version: 'rec-v1',
      event,
      original: {
        routine,
        exercises: routineExercises ?? [],
      },
      adapted: validatedPrescription,
    });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: e instanceof Error ? e.message : 'Coach adapt failed' }, 500);
  }
});
