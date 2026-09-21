import { supabase } from './supabase';
import { displayWeight } from './units';
import {
  BlockType,
  Exercise,
  LiveWorkoutPhase,
  Routine,
  RoutineBlock,
  RoutineExercise,
  RoutineExerciseDropStep,
  WeightUnit,
  WorkoutLiveState,
  WorkoutPlanBlock,
  WorkoutPlanDropStep,
  WorkoutPlanExercise,
  WorkoutSet,
} from '../types/db';
import { MachineBlock, MachineDropStep, MachineExercise } from './liveWorkoutMachine';

export interface RoutineBlockDraft {
  tempId: string;
  block_type: BlockType;
  name: string;
  target_rounds: string;
  rest_seconds: string;
  exercises: RoutineExerciseDraft[];
}

export interface RoutineExerciseDraft {
  tempId: string;
  exercise: Exercise;
  target_sets: string;
  target_reps: string;
  target_weight: string;
  weight_unit: WeightUnit | null;
  rest_seconds: string;
  drop_steps: RoutineDropStepDraft[];
}

export interface RoutineDropStepDraft {
  tempId: string;
  drop_index: number; // 1, 2, or 3
  target_reps: string;
  target_weight: string;
  weight_unit: WeightUnit | null;
}

/**
 * Initializes the snapshot plan for a workout.
 */
export async function initWorkoutPlan(workoutId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('init_workout_plan', {
    p_workout_id: workoutId,
  });
  if (error) {
    console.warn('init_workout_plan RPC warning:', error.message);
    return false;
  }
  return true;
}

/**
 * Loads the active workout plan structure including blocks, exercises, drop steps, and live state.
 */
export async function fetchWorkoutPlan(workoutId: string): Promise<{
  blocks: MachineBlock[];
  liveState: WorkoutLiveState | null;
}> {
  const [
    { data: planBlocks, error: blocksError },
    { data: planExercises, error: exError },
    { data: liveStateData },
  ] = await Promise.all([
    supabase
      .from('workout_plan_blocks')
      .select('*')
      .eq('workout_id', workoutId)
      .order('order_index'),
    supabase
      .from('workout_plan_exercises')
      .select('*, exercise:exercises(*)')
      .eq('workout_id', workoutId)
      .order('block_position'),
    supabase
      .from('workout_live_state')
      .select('*')
      .eq('workout_id', workoutId)
      .maybeSingle(),
  ]);

  if (blocksError) console.warn('Failed to load plan blocks:', blocksError.message);
  if (exError) console.warn('Failed to load plan exercises:', exError.message);

  const planExIds = (planExercises ?? []).map((e) => e.id);
  let dropSteps: WorkoutPlanDropStep[] = [];
  if (planExIds.length > 0) {
    const { data: drops } = await supabase
      .from('workout_plan_drop_steps')
      .select('*')
      .in('workout_plan_exercise_id', planExIds)
      .order('drop_index');
    dropSteps = (drops as WorkoutPlanDropStep[]) ?? [];
  }

  const dropsByExId = new Map<string, MachineDropStep[]>();
  dropSteps.forEach((d) => {
    if (!d.workout_plan_exercise_id) return;
    const list = dropsByExId.get(d.workout_plan_exercise_id) ?? [];
    list.push({
      id: d.id,
      drop_index: d.drop_index,
      target_reps: d.target_reps,
      target_weight_kg: d.target_weight_kg,
      weight_unit: d.weight_unit ?? null,
    });
    dropsByExId.set(d.workout_plan_exercise_id, list);
  });

  const exercisesByBlockId = new Map<string, MachineExercise[]>();
  (planExercises ?? []).forEach((pe: any) => {
    const list = exercisesByBlockId.get(pe.plan_block_id) ?? [];
    list.push({
      id: pe.id,
      exercise_id: pe.exercise_id,
      name: pe.exercise?.name ?? 'Exercise',
      block_position: pe.block_position,
      target_sets: pe.target_sets,
      target_reps: pe.target_reps,
      target_weight_kg: pe.target_weight_kg,
      weight_unit: pe.weight_unit ?? null,
      rest_seconds: pe.rest_seconds,
      exercise: pe.exercise as Exercise,
      drop_steps: dropsByExId.get(pe.id) ?? [],
    });
    exercisesByBlockId.set(pe.plan_block_id, list);
  });

  const blocks: MachineBlock[] = (planBlocks ?? []).map((pb: WorkoutPlanBlock) => ({
    id: pb.id,
    block_type: pb.block_type,
    name: pb.name,
    order_index: pb.order_index,
    target_rounds: pb.target_rounds,
    rest_seconds: pb.rest_seconds,
    exercises: exercisesByBlockId.get(pb.id) ?? [],
  }));

  return {
    blocks,
    liveState: liveStateData as WorkoutLiveState | null,
  };
}

/**
 * Loads a routine along with all its blocks, exercises, and drop steps.
 */
export async function fetchRoutineWithBlocks(
  routineId: string,
  displayUnit: WeightUnit = 'kg'
): Promise<{
  routine: Routine | null;
  blocks: RoutineBlockDraft[];
}> {
  const { data: routine } = await supabase
    .from('routines')
    .select('*')
    .eq('id', routineId)
    .single();

  if (!routine) return { routine: null, blocks: [] };

  const [{ data: dbBlocks }, { data: dbExercises }] = await Promise.all([
    supabase
      .from('routine_blocks')
      .select('*')
      .eq('routine_id', routineId)
      .order('order_index'),
    supabase
      .from('routine_exercises')
      .select('*, exercise:exercises(*)')
      .eq('routine_id', routineId)
      .order('block_position'),
  ]);

  const reIds = (dbExercises ?? []).map((re) => re.id);
  let dbDrops: RoutineExerciseDropStep[] = [];
  if (reIds.length > 0) {
    const { data: drops } = await supabase
      .from('routine_exercise_drop_steps')
      .select('*')
      .in('routine_exercise_id', reIds)
      .order('drop_index');
    dbDrops = (drops as RoutineExerciseDropStep[]) ?? [];
  }

  const exUnitMap = new Map<string, WeightUnit | null>();
  (dbExercises ?? []).forEach((re: any) => {
    exUnitMap.set(re.id, re.weight_unit ?? null);
  });

  const dropsByReId = new Map<string, RoutineDropStepDraft[]>();
  dbDrops.forEach((d) => {
    if (!d.routine_exercise_id) return;
    const list = dropsByReId.get(d.routine_exercise_id) ?? [];
    const reUnit = exUnitMap.get(d.routine_exercise_id) ?? null;
    const dropUnit = d.weight_unit ?? reUnit ?? displayUnit;
    list.push({
      tempId: d.id ?? `drop-${d.drop_index}-${Date.now()}`,
      drop_index: d.drop_index,
      target_reps: String(d.target_reps),
      target_weight: d.target_weight_kg != null ? String(displayWeight(d.target_weight_kg, dropUnit)) : '',
      weight_unit: d.weight_unit ?? null,
    });
    dropsByReId.set(d.routine_exercise_id, list);
  });

  const exercisesByBlockId = new Map<string, RoutineExerciseDraft[]>();
  (dbExercises ?? []).forEach((re: any) => {
    const blockId = re.block_id ?? 'unassigned';
    const list = exercisesByBlockId.get(blockId) ?? [];
    const unit = re.weight_unit ?? displayUnit;
    list.push({
      tempId: re.id,
      exercise: re.exercise as Exercise,
      target_sets: String(re.target_sets),
      target_reps: String(re.target_reps),
      target_weight: re.target_weight_kg != null ? String(displayWeight(re.target_weight_kg, unit)) : '',
      weight_unit: re.weight_unit ?? null,
      rest_seconds: String(re.rest_seconds),
      drop_steps: dropsByReId.get(re.id) ?? [],
    });
    exercisesByBlockId.set(blockId, list);
  });

  if (dbBlocks && dbBlocks.length > 0) {
    const blocks: RoutineBlockDraft[] = dbBlocks.map((b: RoutineBlock) => ({
      tempId: b.id,
      block_type: b.block_type,
      name: b.name,
      target_rounds: String(b.target_rounds),
      rest_seconds: String(b.rest_seconds),
      exercises: exercisesByBlockId.get(b.id) ?? [],
    }));
    return { routine, blocks };
  }

  // Fallback if routine had no blocks (legacy)
  const legacyExercises = dbExercises ?? [];
  const fallbackBlocks: RoutineBlockDraft[] = legacyExercises.map((re: any, idx) => {
    const unit = re.weight_unit ?? displayUnit;
    return {
      tempId: `block-${idx}`,
      block_type: 'straight',
      name: 'Straight sets',
      target_rounds: String(re.target_sets),
      rest_seconds: String(re.rest_seconds),
      exercises: [
        {
          tempId: re.id,
          exercise: re.exercise as Exercise,
          target_sets: String(re.target_sets),
          target_reps: String(re.target_reps),
          target_weight: re.target_weight_kg != null ? String(displayWeight(re.target_weight_kg, unit)) : '',
          weight_unit: re.weight_unit ?? null,
          rest_seconds: String(re.rest_seconds),
          drop_steps: dropsByReId.get(re.id) ?? [],
        },
      ],
    };
  });

  return { routine, blocks: fallbackBlocks };
}

/**
 * Logs a workout set and advances live state.
 */
export async function logWorkoutSet(params: {
  workoutId: string;
  exerciseId: string;
  planExerciseId?: string | null;
  setIndex: number;
  reps: number;
  weightKg: number | null;
  setType: 'regular' | 'drop';
  dropIndex: number | null;
  roundIndex: number;
  nextPhase: LiveWorkoutPhase;
  nextBlockOrder: number;
  nextRound: number;
  nextExercisePosition: number;
  nextDropIndex: number | null;
  restSeconds: number;
  expectedVersion: number;
}): Promise<WorkoutSet | null> {
  const { data: rpcResult, error: rpcError } = await supabase.rpc('log_workout_set_and_advance', {
    p_workout_id: params.workoutId,
    p_exercise_id: params.exerciseId,
    p_plan_exercise_id: params.planExerciseId ?? null,
    p_set_index: params.setIndex,
    p_reps: params.reps,
    p_weight_kg: params.weightKg,
    p_set_type: params.setType,
    p_drop_index: params.dropIndex,
    p_round_index: params.roundIndex,
    p_next_phase: params.nextPhase,
    p_next_block_order: params.nextBlockOrder,
    p_next_round: params.nextRound,
    p_next_exercise_position: params.nextExercisePosition,
    p_next_drop_index: params.nextDropIndex,
    p_rest_seconds: params.restSeconds,
    p_expected_version: params.expectedVersion,
  });

  if (!rpcError && rpcResult?.set_id) {
    const { data: insertedSet } = await supabase
      .from('workout_sets')
      .select('*')
      .eq('id', rpcResult.set_id)
      .single();
    if (insertedSet) return insertedSet as WorkoutSet;
  }

  // Fallback: direct insert if RPC fails or table structure differs
  const { data: fallbackSet, error: fallbackError } = await supabase
    .from('workout_sets')
    .insert({
      workout_id: params.workoutId,
      exercise_id: params.exerciseId,
      workout_plan_exercise_id: params.planExerciseId ?? null,
      set_index: params.setIndex,
      reps: params.reps,
      weight_kg: params.weightKg,
      set_type: params.setType,
      drop_index: params.dropIndex,
      round_index: params.roundIndex,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (fallbackError) {
    console.error('Failed to log set:', fallbackError.message);
    return null;
  }

  // Update live state
  await supabase
    .from('workout_live_state')
    .upsert({
      workout_id: params.workoutId,
      phase: params.nextPhase,
      current_block_order: params.nextBlockOrder,
      current_round: params.nextRound,
      current_exercise_position: params.nextExercisePosition,
      current_drop_index: params.nextDropIndex,
      rest_started_at: params.nextPhase === 'rest' ? new Date().toISOString() : null,
      rest_ends_at:
        params.nextPhase === 'rest' && params.restSeconds > 0
          ? new Date(Date.now() + params.restSeconds * 1000).toISOString()
          : null,
      version: params.expectedVersion + 1,
      updated_at: new Date().toISOString(),
    });

  return fallbackSet as WorkoutSet;
}
