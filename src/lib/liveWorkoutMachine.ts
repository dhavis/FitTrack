import { BlockType, Exercise, LiveWorkoutPhase, SetType, WeightUnit, WorkoutSet } from '../types/db';

export interface MachineDropStep {
  id?: string;
  drop_index: number; // 1, 2, or 3
  target_reps: number;
  target_weight_kg: number | null;
  weight_unit?: WeightUnit | null;
}

export interface MachineExercise {
  id: string; // Plan exercise ID or routine exercise ID
  exercise_id: string;
  name: string;
  block_position: number;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number | null;
  weight_unit: WeightUnit | null;
  rest_seconds: number;
  exercise?: Exercise;
  drop_steps: MachineDropStep[];
}

export interface MachineBlock {
  id: string;
  block_type: BlockType;
  name: string;
  order_index: number;
  target_rounds: number;
  rest_seconds: number;
  exercises: MachineExercise[];
}

export interface LiveMachineCursor {
  phase: LiveWorkoutPhase;
  currentBlockOrder: number;
  currentRound: number;
  currentExercisePosition: number;
  currentDropIndex: number | null;
  currentBlock: MachineBlock | null;
  currentExercise: MachineExercise | null;
  currentDropStep: MachineDropStep | null;
  isLastExerciseInRound: boolean;
  isLastRoundInBlock: boolean;
  isFinalStepInBlock: boolean;
  isLastBlock: boolean;
  isComplete: boolean;
  nextActionLabel: string;
  restSeconds: number;
  nextStep: {
    phase: LiveWorkoutPhase;
    blockOrder: number;
    round: number;
    exercisePosition: number;
    dropIndex: number | null;
    restSeconds: number;
  };
}

export function getTechniqueLabel(type: BlockType): string {
  switch (type) {
    case 'straight':
      return 'Straight sets';
    case 'superset':
      return 'Superset';
    case 'powerset':
      return 'Powerset';
    default:
      return 'Straight sets';
  }
}

export function getTechniqueHelperText(type: BlockType): string {
  switch (type) {
    case 'straight':
      return 'Standard sets with rest after each set.';
    case 'superset':
      return '2 exercises performed back-to-back with rest after each round.';
    case 'powerset':
      return '3–6 exercises in a circuit performed back-to-back with rest after the round.';
    default:
      return '';
  }
}

export function getDropSetHelperText(): string {
  return '1–3 lighter weight steps performed immediately after the final regular set.';
}

export function buildMachineCursor(
  blocks: MachineBlock[],
  state: {
    phase: LiveWorkoutPhase;
    currentBlockOrder: number;
    currentRound: number;
    currentExercisePosition: number;
    currentDropIndex: number | null;
  }
): LiveMachineCursor {
  if (blocks.length === 0 || state.phase === 'complete') {
    return {
      phase: 'complete',
      currentBlockOrder: state.currentBlockOrder,
      currentRound: state.currentRound,
      currentExercisePosition: state.currentExercisePosition,
      currentDropIndex: null,
      currentBlock: null,
      currentExercise: null,
      currentDropStep: null,
      isLastExerciseInRound: true,
      isLastRoundInBlock: true,
      isFinalStepInBlock: true,
      isLastBlock: true,
      isComplete: true,
      nextActionLabel: 'Workout complete',
      restSeconds: 0,
      nextStep: {
        phase: 'complete',
        blockOrder: state.currentBlockOrder,
        round: state.currentRound,
        exercisePosition: state.currentExercisePosition,
        dropIndex: null,
        restSeconds: 0,
      },
    };
  }

  // Ensure block index is valid
  const blockIndex = Math.max(0, Math.min(state.currentBlockOrder, blocks.length - 1));
  const currentBlock = blocks[blockIndex] ?? blocks[0];
  const isLastBlock = blockIndex >= blocks.length - 1;

  // Ensure exercise position is valid
  const exercises = currentBlock.exercises ?? [];
  const exercisePos = Math.max(0, Math.min(state.currentExercisePosition, Math.max(0, exercises.length - 1)));
  const currentExercise = exercises[exercisePos] ?? null;
  const isLastExerciseInRound = exercisePos >= exercises.length - 1;

  const currentRound = Math.max(1, Math.min(state.currentRound, currentBlock.target_rounds));
  const isLastRoundInBlock = currentRound >= currentBlock.target_rounds;

  const dropSteps = currentExercise?.drop_steps ?? [];
  const hasDropSteps = dropSteps.length > 0;
  const currentDropStep =
    state.phase === 'drop' && state.currentDropIndex != null
      ? dropSteps.find((d) => d.drop_index === state.currentDropIndex) ?? dropSteps[0] ?? null
      : null;

  const isFinalDropStep =
    state.phase === 'drop'
      ? (state.currentDropIndex ?? 1) >= (dropSteps[dropSteps.length - 1]?.drop_index ?? 1)
      : !hasDropSteps;

  const isFinalStepInBlock = isLastRoundInBlock && isLastExerciseInRound && isFinalDropStep;

  // Calculate next step
  let nextPhase: LiveWorkoutPhase = 'regular';
  let nextBlockOrder = blockIndex;
  let nextRound = currentRound;
  let nextExercisePos = exercisePos;
  let nextDropIndex: number | null = null;
  let restSeconds = 0;
  let nextActionLabel = 'Log set';

  if (state.phase === 'regular') {
    if (isLastRoundInBlock && hasDropSteps) {
      // Transition to drop set step 1
      nextPhase = 'drop';
      nextDropIndex = dropSteps[0].drop_index;
      nextActionLabel = `Log set & drop ${nextDropIndex}`;
      restSeconds = 0;
    } else if (!isLastExerciseInRound) {
      // Continue next exercise in superset / powerset round (no rest!)
      nextPhase = 'regular';
      nextExercisePos = exercisePos + 1;
      nextActionLabel = 'Log set & continue';
      restSeconds = 0;
    } else if (!isLastRoundInBlock) {
      // Finished round of block -> rest before next round
      nextPhase = 'rest';
      nextRound = currentRound + 1;
      nextExercisePos = 0;
      restSeconds = currentBlock.rest_seconds;
      nextActionLabel = 'Log set & rest';
    } else if (!isLastBlock) {
      // Finished final round of block -> rest before next block
      nextPhase = 'rest';
      nextBlockOrder = blockIndex + 1;
      nextRound = 1;
      nextExercisePos = 0;
      restSeconds = currentBlock.rest_seconds;
      nextActionLabel = 'Log set & next block';
    } else {
      // All blocks finished
      nextPhase = 'complete';
      nextActionLabel = 'Log set & finish workout';
      restSeconds = 0;
    }
  } else if (state.phase === 'drop') {
    const curDropIdx = state.currentDropIndex ?? 1;
    const nextDrop = dropSteps.find((d) => d.drop_index > curDropIdx);

    if (nextDrop) {
      // Continue to next drop step
      nextPhase = 'drop';
      nextDropIndex = nextDrop.drop_index;
      nextActionLabel = `Log drop ${curDropIdx} & start drop ${nextDropIndex}`;
      restSeconds = 0;
    } else if (!isLastExerciseInRound) {
      // Drop steps for this exercise complete; continue to next exercise in round
      nextPhase = 'regular';
      nextExercisePos = exercisePos + 1;
      nextDropIndex = null;
      nextActionLabel = `Log drop ${curDropIdx} & continue`;
      restSeconds = 0;
    } else if (!isLastBlock) {
      // Final exercise drop complete; rest before next block
      nextPhase = 'rest';
      nextBlockOrder = blockIndex + 1;
      nextRound = 1;
      nextExercisePos = 0;
      nextDropIndex = null;
      restSeconds = currentBlock.rest_seconds;
      nextActionLabel = `Log drop ${curDropIdx} & rest`;
    } else {
      // Complete workout
      nextPhase = 'complete';
      nextDropIndex = null;
      nextActionLabel = `Log drop ${curDropIdx} & finish workout`;
      restSeconds = 0;
    }
  } else if (state.phase === 'rest') {
    // Already in rest, pressing action means resume
    nextPhase = 'regular';
    nextActionLabel = 'Resume workout';
    restSeconds = 0;
  }

  return {
    phase: state.phase,
    currentBlockOrder: blockIndex,
    currentRound,
    currentExercisePosition: exercisePos,
    currentDropIndex: state.currentDropIndex,
    currentBlock,
    currentExercise,
    currentDropStep,
    isLastExerciseInRound,
    isLastRoundInBlock,
    isFinalStepInBlock,
    isLastBlock,
    isComplete: false,
    nextActionLabel,
    restSeconds: currentBlock.rest_seconds,
    nextStep: {
      phase: nextPhase,
      blockOrder: nextBlockOrder,
      round: nextRound,
      exercisePosition: nextExercisePos,
      dropIndex: nextDropIndex,
      restSeconds,
    },
  };
}

/**
 * Reconstructs the machine cursor by stepping through all logged sets.
 */
export function deriveCursorFromLoggedSets(
  blocks: MachineBlock[],
  loggedSets: WorkoutSet[]
): LiveMachineCursor {
  let state = {
    phase: 'regular' as LiveWorkoutPhase,
    currentBlockOrder: 0,
    currentRound: 1,
    currentExercisePosition: 0,
    currentDropIndex: null as number | null,
  };

  if (blocks.length === 0) {
    return buildMachineCursor(blocks, state);
  }

  const sortedSets = [...loggedSets].sort((a, b) => a.set_index - b.set_index);

  for (const _set of sortedSets) {
    const cursor = buildMachineCursor(blocks, state);
    if (cursor.phase === 'complete') break;

    // Advance to next step (if it was rest, the next action will resume to regular)
    const next = cursor.nextStep;
    state = {
      phase: next.phase === 'rest' ? 'regular' : next.phase,
      currentBlockOrder: next.blockOrder,
      currentRound: next.round,
      currentExercisePosition: next.exercisePosition,
      currentDropIndex: next.dropIndex,
    };
  }

  return buildMachineCursor(blocks, state);
}
