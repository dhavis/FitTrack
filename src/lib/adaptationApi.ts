import {
  AdaptationEvent,
  DailyCheckIn,
  PrescribedExercise,
  Routine,
  RoutineExercise,
  ValidatedPrescription,
} from '../types/db';
import { supabase } from './supabase';

export interface UpsertCheckInParams {
  userId: string;
  checkInDate?: string; // YYYY-MM-DD
  timezone?: string | null;
  overallSoreness: number; // 0-4
  sorenessByMuscle?: Record<string, number>;
  tiredness: number; // 1-5
  energy: number; // 1-5
  availableMinutes: number; // 10-180
  painOrNewInjury: boolean;
  sleepHours?: number | null;
  recoveryNote?: string | null;
}

export interface CoachAdaptResponse {
  ok: boolean;
  status: 'pending' | 'safety_hold' | 'approved' | 'rejected' | 'expired';
  event_id: string;
  disclaimer_version: string;
  event?: AdaptationEvent;
  original?: {
    routine: Routine;
    exercises: RoutineExercise[];
  };
  adapted?: ValidatedPrescription;
  error?: string;
}

export function getLocalTodayDateString(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function fetchTodayCheckIn(
  userId: string,
  dateStr = getLocalTodayDateString()
): Promise<DailyCheckIn | null> {
  const { data, error } = await supabase
    .from('daily_check_ins')
    .select('*')
    .eq('user_id', userId)
    .eq('check_in_date', dateStr)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as DailyCheckIn | null;
}

export async function upsertDailyCheckIn(params: UpsertCheckInParams): Promise<DailyCheckIn> {
  const checkInDate = params.checkInDate ?? getLocalTodayDateString();
  const timezone =
    params.timezone !== undefined
      ? params.timezone
      : typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : null;

  const { data, error } = await supabase
    .from('daily_check_ins')
    .upsert(
      {
        user_id: params.userId,
        check_in_date: checkInDate,
        timezone,
        overall_soreness: params.overallSoreness,
        soreness_by_muscle: params.sorenessByMuscle ?? {},
        tiredness: params.tiredness,
        energy: params.energy,
        available_minutes: params.availableMinutes,
        pain_or_new_injury: params.painOrNewInjury,
        sleep_hours: params.sleepHours ?? null,
        recovery_note: params.recoveryNote ? params.recoveryNote.slice(0, 280) : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,check_in_date' }
    )
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to save daily check-in');
  }

  return data as DailyCheckIn;
}

async function localFallbackAdapt(
  userId: string,
  checkInId: string,
  routineId: string
): Promise<CoachAdaptResponse> {
  const [
    { data: checkIn, error: checkInError },
    { data: routine, error: routineError },
    { data: routineExercises, error: reError },
    { data: profile },
    { data: goals },
  ] = await Promise.all([
    supabase.from('daily_check_ins').select('*').eq('id', checkInId).eq('user_id', userId).single(),
    supabase.from('routines').select('*').eq('id', routineId).eq('user_id', userId).single(),
    supabase
      .from('routine_exercises')
      .select('*, exercise:exercises(*)')
      .eq('routine_id', routineId)
      .order('order_index'),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('goals').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  if (checkInError || !checkIn) {
    throw new Error('Check-in not found');
  }
  if (routineError || !routine) {
    throw new Error('Routine not found');
  }
  if (reError) {
    throw new Error(reError.message);
  }

  const checkInSnapshot = checkIn as DailyCheckIn;
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

  if (checkInSnapshot.pain_or_new_injury) {
    const { data: event, error: insertError } = await supabase
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
      throw new Error(insertError?.message ?? 'Failed to create safety hold');
    }

    return {
      ok: true,
      status: 'safety_hold',
      event_id: event.id,
      disclaimer_version: 'rec-v1',
      event: event as AdaptationEvent,
      original: {
        routine,
        exercises: routineExercises ?? [],
      },
    };
  }

  const exercisesList = (routineExercises ?? []) as (RoutineExercise & { exercise?: any })[];
  const highFatigue =
    checkInSnapshot.tiredness >= 4 || checkInSnapshot.energy <= 2 || checkInSnapshot.overall_soreness >= 3;
  const isOlder = profile?.age != null && profile.age >= 50;
  const isBeginner = goals?.experience === 'beginner';
  const availableMinutes = checkInSnapshot.available_minutes ?? 60;
  const isShortTime = availableMinutes < 45;
  const isVeryShortTime = availableMinutes <= 30;

  let selectedExercises = exercisesList;
  if (isVeryShortTime && exercisesList.length > 2) {
    selectedExercises = exercisesList.slice(0, Math.min(3, exercisesList.length));
  } else if (isShortTime && exercisesList.length > 4) {
    selectedExercises = exercisesList.slice(0, 4);
  }

  const sorenessByMuscle: Record<string, number> = checkInSnapshot.soreness_by_muscle ?? {};
  let hasReducedVolume = selectedExercises.length < exercisesList.length;
  let soreMuscleImpacted = false;

  const prescribedExercises: PrescribedExercise[] = selectedExercises.map((re) => {
    const exerciseName = re.exercise?.name ?? 'Exercise';
    const muscleGroup = (re.exercise?.muscle_group ?? '').toLowerCase();

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
    coachMessage =
      'Readiness is low and muscles are sore. We trimmed volume and eased load so you can recover without missing your session.';
  } else if (soreMuscleImpacted) {
    coachMessage = 'We reduced volume on your sore muscle groups while keeping the rest of your session on track.';
  } else if (highFatigue) {
    coachMessage = 'Higher fatigue detected today. We reduced total sets by ~30% to keep movement quality high.';
  } else if (isShortTime) {
    coachMessage = `Streamlined to fit your ${availableMinutes}-minute window, keeping your key compound lifts.`;
  }

  const validatedPrescription: ValidatedPrescription = {
    exercises: prescribedExercises,
    session_action: sessionAction,
    coach_message: coachMessage,
    nutrition_emphasis: 'normal',
  };

  const { data: event, error: insertError } = await supabase
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
      validation_reason: 'Deterministic readiness adaptation applied (client fallback).',
      disclaimer_version: 'rec-v1',
    })
    .select()
    .single();

  if (insertError || !event) {
    throw new Error(insertError?.message ?? 'Failed to create adaptation event');
  }

  return {
    ok: true,
    status: 'pending',
    event_id: event.id,
    disclaimer_version: 'rec-v1',
    event: event as AdaptationEvent,
    original: {
      routine,
      exercises: routineExercises ?? [],
    },
    adapted: validatedPrescription,
  };
}

export async function invokeCoachAdapt(
  body: {
    check_in_id: string;
    routine_id: string;
  },
  userId?: string
): Promise<CoachAdaptResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('coach-adapt', {
      body,
    });

    if (!error && data?.ok) {
      return data as CoachAdaptResponse;
    }
  } catch (err) {
    console.warn('Edge function coach-adapt invocation failed, falling back locally', err);
  }

  if (userId) {
    return localFallbackAdapt(userId, body.check_in_id, body.routine_id);
  }

  const { data: authData } = await supabase.auth.getUser();
  if (authData?.user) {
    return localFallbackAdapt(authData.user.id, body.check_in_id, body.routine_id);
  }

  throw new Error('Coach adapt failed and user is unauthenticated');
}

export async function fetchAdaptationEvent(eventId: string): Promise<AdaptationEvent | null> {
  const { data, error } = await supabase
    .from('adaptation_events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error) throw new Error(error.message);
  return data as AdaptationEvent | null;
}

export async function approveAdaptationEvent(eventId: string): Promise<string> {
  const { data, error } = await supabase.rpc('approve_adaptation_event', {
    p_event_id: eventId,
  });

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to approve adaptation');
  }

  return data as string;
}

export async function rejectAdaptationEvent(eventId: string): Promise<void> {
  const { error } = await supabase.rpc('reject_adaptation_event', {
    p_event_id: eventId,
  });

  if (error) {
    throw new Error(error.message ?? 'Failed to reject adaptation');
  }
}
