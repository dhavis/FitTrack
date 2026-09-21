import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ActiveGymSwitcher from '../components/ActiveGymSwitcher';
import ExercisePickerModal from '../components/ExercisePickerModal';
import HowToPanel from '../components/HowToPanel';
import { Button, Card, EmptyState, Label, ScreenContainer, TextInput } from '../components/ui';
import { useActiveGymProfile } from '../hooks/useActiveGymProfile';
import { useAuth } from '../hooks/useAuth';
import { isExerciseAllowed } from '../lib/equipmentPolicy';
import {
  buildMachineCursor,
  deriveCursorFromLoggedSets,
  getDropSetHelperText,
  getTechniqueHelperText,
  getTechniqueLabel,
  LiveMachineCursor,
  MachineBlock,
  MachineExercise,
} from '../lib/liveWorkoutMachine';
import { suggestProgression, summarizeLastSets } from '../lib/progression';
import { supabase } from '../lib/supabase';
import { displayWeight, toStorageWeightKg } from '../lib/units';
import { fetchWorkoutPlan, initWorkoutPlan, logWorkoutSet } from '../lib/workoutPlan';
import { WorkoutsStackParamList } from '../navigation/types';
import { colors, radii, spacing, typography } from '../theme/theme';
import {
  AdaptationEvent,
  Exercise,
  ExperienceLevel,
  RoutineExercise,
  WeightUnit,
  WorkoutLiveState,
  WorkoutSet,
} from '../types/db';

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'ActiveWorkout'>;

export default function ActiveWorkoutScreen({ route, navigation }: Props) {
  const { workoutId } = route.params;
  const { profile, session } = useAuth();
  const { activeGym } = useActiveGymProfile();
  const defaultUnit: WeightUnit = profile?.weight_unit ?? 'kg';

  const [routineId, setRoutineId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<MachineBlock[]>([]);
  const [loggedSets, setLoggedSets] = useState<WorkoutSet[]>([]);
  const [liveState, setLiveState] = useState<WorkoutLiveState | null>(null);
  const [reps, setReps] = useState<Record<string, string>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [unitOverrides, setUnitOverrides] = useState<Record<string, WeightUnit | null>>({});
  const [pickerVisible, setPickerVisible] = useState(false);
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const [lastSessionLabel, setLastSessionLabel] = useState<string | null>(null);
  const [lastSetsByExercise, setLastSetsByExercise] = useState<Map<string, WorkoutSet[]>>(new Map());
  const [experience, setExperience] = useState<ExperienceLevel | null>(null);
  const [isAdaptedWorkout, setIsAdaptedWorkout] = useState<boolean>(false);
  const [logging, setLogging] = useState<boolean>(false);

  // Substitute modal state
  const [substituteTarget, setSubstituteTarget] = useState<MachineExercise | null>(null);
  const [substituteCandidates, setSubstituteCandidates] = useState<Exercise[]>([]);
  const [substituteLoading, setSubstituteLoading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    // 1. Ensure workout plan snapshot is initialized
    await initWorkoutPlan(workoutId);

    const { data: workout } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', workoutId)
      .single();

    const { data: sets } = await supabase
      .from('workout_sets')
      .select('*')
      .eq('workout_id', workoutId)
      .order('set_index');

    const activeRoutineId = workout?.routine_id ?? null;
    setRoutineId(activeRoutineId);
    setLoggedSets((sets as WorkoutSet[]) ?? []);
    setIsAdaptedWorkout(Boolean(workout?.adaptation_event_id));

    let experienceLevel: ExperienceLevel | null = null;
    if (session) {
      const { data: goals } = await supabase
        .from('goals')
        .select('experience')
        .eq('user_id', session.user.id)
        .maybeSingle();
      experienceLevel = goals?.experience ?? null;
      setExperience(experienceLevel);
    }

    let lastSetsMap = new Map<string, WorkoutSet[]>();
    if (workout?.routine_id) {
      const { data: lastWorkout } = await supabase
        .from('workouts')
        .select('*')
        .eq('routine_id', workout.routine_id)
        .not('completed_at', 'is', null)
        .neq('id', workoutId)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastWorkout) {
        setLastSessionLabel(
          new Date(lastWorkout.completed_at ?? lastWorkout.started_at).toLocaleString()
        );
        const { data: lastSets } = await supabase
          .from('workout_sets')
          .select('*')
          .eq('workout_id', lastWorkout.id)
          .order('set_index');
        lastSetsMap = summarizeLastSets(lastSets ?? []);
        setLastSetsByExercise(lastSetsMap);
      } else {
        setLastSessionLabel(null);
      }
    }

    // Load workout plan
    const { blocks: planBlocks, liveState: planLiveState } = await fetchWorkoutPlan(workoutId);
    setLiveState(planLiveState);
    if (planLiveState?.phase === 'rest' && planLiveState.rest_ends_at) {
      const endsAt = new Date(planLiveState.rest_ends_at).getTime();
      const now = Date.now();
      const left = Math.max(0, Math.round((endsAt - now) / 1000));
      if (left > 0) {
        setRestSecondsLeft(left);
      } else {
        setRestSecondsLeft(0);
      }
    }

    const initialReps: Record<string, string> = {};
    const initialWeights: Record<string, string> = {};
    const initialUnits: Record<string, WeightUnit | null> = {};

    if (planBlocks.length > 0) {
      setBlocks(planBlocks);
      planBlocks.forEach((b) => {
        b.exercises.forEach((ex) => {
          const effectiveUnit = ex.weight_unit ?? defaultUnit;
          initialUnits[ex.exercise_id] = ex.weight_unit ?? null;
          initialReps[ex.exercise_id] = String(ex.target_reps);
          if (ex.target_weight_kg != null) {
            initialWeights[ex.exercise_id] = displayWeight(
              ex.target_weight_kg,
              effectiveUnit
            ).toFixed(1);
          }
          ex.drop_steps.forEach((d) => {
            const dropKey = `drop-${ex.exercise_id}-${d.drop_index}`;
            initialReps[dropKey] = String(d.target_reps);
            if (d.target_weight_kg != null) {
              initialWeights[dropKey] = displayWeight(d.target_weight_kg, effectiveUnit).toFixed(1);
            }
          });
        });
      });
    } else if (workout?.adaptation_event_id) {
      // Fallback for adapted workout without pre-populated plan blocks
      setIsAdaptedWorkout(true);
      const { data: adaptEvent } = await supabase
        .from('adaptation_events')
        .select('*')
        .eq('id', workout.adaptation_event_id)
        .single();

      const adaptation = adaptEvent as AdaptationEvent | null;
      const prescribedList = adaptation?.validated_prescription?.exercises ?? [];

      const exerciseIds = prescribedList.map((p) => p.exercise_id);
      let dbExercises: Exercise[] = [];
      if (exerciseIds.length > 0) {
        const { data } = await supabase.from('exercises').select('*').in('id', exerciseIds);
        dbExercises = data ?? [];
      }
      const exLookup = new Map(dbExercises.map((e) => [e.id, e]));

      const fallbackBlocks: MachineBlock[] = prescribedList.map((p, idx) => {
        const fullEx: Exercise = exLookup.get(p.exercise_id) ?? {
          id: p.exercise_id,
          user_id: null,
          name: p.name,
          muscle_group: null,
          equipment: null,
          instructions: null,
          howto_image_path: null,
          howto_cues: null,
          created_at: '',
        };
        initialReps[p.exercise_id] = String(p.target_reps);
        if (p.target_weight_kg != null) {
          initialWeights[p.exercise_id] = displayWeight(p.target_weight_kg, defaultUnit).toFixed(1);
        }
        return {
          id: `adapt-block-${idx}`,
          block_type: 'straight',
          name: 'Straight sets',
          order_index: idx,
          target_rounds: p.target_sets,
          rest_seconds: p.rest_seconds,
          exercises: [
            {
              id: `adapt-ex-${idx}`,
              exercise_id: p.exercise_id,
              name: p.name,
              block_position: 0,
              target_sets: p.target_sets,
              target_reps: p.target_reps,
              target_weight_kg: p.target_weight_kg,
              weight_unit: null,
              rest_seconds: p.rest_seconds,
              exercise: fullEx,
              drop_steps: [],
            },
          ],
        };
      });
      setBlocks(fallbackBlocks);
    } else if (workout?.routine_id) {
      // Fallback: load directly from routine_exercises
      const { data: reData } = await supabase
        .from('routine_exercises')
        .select('*, exercise:exercises(*)')
        .eq('routine_id', workout.routine_id)
        .order('order_index');
      const routineExercises: RoutineExercise[] = reData ?? [];

      const fallbackBlocks: MachineBlock[] = routineExercises.map((re, idx) => {
        const effectiveUnit = re.weight_unit ?? defaultUnit;
        initialUnits[re.exercise_id] = re.weight_unit ?? null;
        const last = lastSetsMap.get(re.exercise_id) ?? [];
        const suggestion = suggestProgression({
          targetSets: re.target_sets,
          targetReps: re.target_reps,
          targetWeightKg: re.target_weight_kg,
          lastSets: last,
          experience: experienceLevel,
        });
        initialReps[re.exercise_id] = String(suggestion.reps);
        if (suggestion.weightKg != null) {
          initialWeights[re.exercise_id] = displayWeight(suggestion.weightKg, effectiveUnit).toFixed(1);
        }
        return {
          id: re.block_id ?? `block-${idx}`,
          block_type: 'straight',
          name: 'Straight sets',
          order_index: idx,
          target_rounds: re.target_sets,
          rest_seconds: re.rest_seconds,
          exercises: [
            {
              id: re.id,
              exercise_id: re.exercise_id,
              name: re.exercise?.name ?? 'Exercise',
              block_position: re.block_position ?? 0,
              target_sets: re.target_sets,
              target_reps: re.target_reps,
              target_weight_kg: re.target_weight_kg,
              weight_unit: re.weight_unit ?? null,
              rest_seconds: re.rest_seconds,
              exercise: re.exercise as Exercise,
              drop_steps: [],
            },
          ],
        };
      });
      setBlocks(fallbackBlocks);
    }

    setReps((prev) => ({ ...initialReps, ...prev }));
    setWeights((prev) => ({ ...initialWeights, ...prev }));
    setUnitOverrides((prev) => ({ ...initialUnits, ...prev }));
  }, [workoutId, session, defaultUnit]);

  useEffect(() => {
    load();
  }, [load]);

  // Machine Cursor Calculation
  const cursor: LiveMachineCursor = React.useMemo(() => {
    if (blocks.length === 0) {
      return buildMachineCursor([], {
        phase: 'regular',
        currentBlockOrder: 0,
        currentRound: 1,
        currentExercisePosition: 0,
        currentDropIndex: null,
      });
    }

    if (liveState) {
      return buildMachineCursor(blocks, {
        phase: liveState.phase,
        currentBlockOrder: liveState.current_block_order,
        currentRound: liveState.current_round,
        currentExercisePosition: liveState.current_exercise_position,
        currentDropIndex: liveState.current_drop_index,
      });
    }

    return deriveCursorFromLoggedSets(blocks, loggedSets);
  }, [blocks, liveState, loggedSets]);

  const finishRest = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRestSecondsLeft(null);

    const nextBlockOrder = liveState?.current_block_order ?? cursor.currentBlockOrder;
    const nextRound = liveState?.current_round ?? cursor.currentRound;
    const nextExercisePosition = liveState?.current_exercise_position ?? cursor.currentExercisePosition;
    const nextDropIndex = liveState?.current_drop_index ?? cursor.currentDropIndex;
    const nextVersion = (liveState?.version ?? 1) + 1;

    const updatedState: WorkoutLiveState = {
      workout_id: workoutId,
      phase: 'regular',
      current_block_order: nextBlockOrder,
      current_round: nextRound,
      current_exercise_position: nextExercisePosition,
      current_drop_index: nextDropIndex,
      rest_started_at: null,
      rest_ends_at: null,
      version: nextVersion,
      updated_at: new Date().toISOString(),
    };

    setLiveState(updatedState);

    await supabase
      .from('workout_live_state')
      .upsert(updatedState);
  }, [liveState, cursor, workoutId]);

  // Rest Timer
  useEffect(() => {
    if (restSecondsLeft === null) return;
    if (restSecondsLeft <= 0) {
      finishRest();
      return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRestSecondsLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [restSecondsLeft, finishRest]);

  const handleExerciseUnitChange = (exerciseId: string, newUnit: WeightUnit | null) => {
    const prevUnit = unitOverrides[exerciseId] ?? defaultUnit;
    const nextUnit = newUnit ?? defaultUnit;

    const currentWeightStr = weights[exerciseId] ?? '';
    if (prevUnit !== nextUnit && currentWeightStr.trim() !== '') {
      const val = parseFloat(currentWeightStr);
      if (!Number.isNaN(val)) {
        const kg = toStorageWeightKg(val, prevUnit);
        const converted = displayWeight(kg, nextUnit);
        const newStr = String(Math.round(converted * 10) / 10);
        setWeights((prev) => ({ ...prev, [exerciseId]: newStr }));
      }
    }

    setUnitOverrides((prev) => ({ ...prev, [exerciseId]: newUnit }));
  };

  const logCurrentStep = async () => {
    if (liveState?.phase === 'rest' || restSecondsLeft !== null) {
      await finishRest();
      return;
    }
    if (!cursor.currentExercise || logging) return;

    const activeExercise = cursor.currentExercise;
    const isDrop = cursor.phase === 'drop' && cursor.currentDropIndex != null;
    const dropKey = isDrop ? `drop-${activeExercise.exercise_id}-${cursor.currentDropIndex}` : '';

    const effectiveUnit = unitOverrides[activeExercise.exercise_id] ?? activeExercise.weight_unit ?? defaultUnit;

    const repsInput = isDrop ? reps[dropKey] || reps[activeExercise.exercise_id] || '' : reps[activeExercise.exercise_id] || '';
    const weightInput = isDrop ? weights[dropKey] || weights[activeExercise.exercise_id] || '' : weights[activeExercise.exercise_id] || '';

    const repsVal = parseInt(repsInput, 10);
    if (Number.isNaN(repsVal) || repsVal <= 0) return;

    const parsedWeight = parseFloat(weightInput);
    const weight_kg = Number.isNaN(parsedWeight) || parsedWeight <= 0 ? null : toStorageWeightKg(parsedWeight, effectiveUnit);

    setLogging(true);

    const nextStep = cursor.nextStep;
    const currentSetIndex = loggedSets.length + 1;

    const newSet = await logWorkoutSet({
      workoutId,
      exerciseId: activeExercise.exercise_id,
      planExerciseId: activeExercise.id.startsWith('adapt-') ? null : activeExercise.id,
      setIndex: currentSetIndex,
      reps: repsVal,
      weightKg: weight_kg,
      setType: isDrop ? 'drop' : 'regular',
      dropIndex: isDrop ? cursor.currentDropIndex : null,
      roundIndex: cursor.currentRound,
      nextPhase: nextStep.phase,
      nextBlockOrder: nextStep.blockOrder,
      nextRound: nextStep.round,
      nextExercisePosition: nextStep.exercisePosition,
      nextDropIndex: nextStep.dropIndex,
      restSeconds: nextStep.restSeconds,
      expectedVersion: liveState?.version ?? 1,
    });

    setLogging(false);

    if (newSet) {
      setLoggedSets((prev) => [...prev, newSet]);

      setLiveState({
        workout_id: workoutId,
        phase: nextStep.phase,
        current_block_order: nextStep.blockOrder,
        current_round: nextStep.round,
        current_exercise_position: nextStep.exercisePosition,
        current_drop_index: nextStep.dropIndex,
        rest_started_at: nextStep.phase === 'rest' ? new Date().toISOString() : null,
        rest_ends_at:
          nextStep.phase === 'rest' && nextStep.restSeconds > 0
            ? new Date(Date.now() + nextStep.restSeconds * 1000).toISOString()
            : null,
        version: (liveState?.version ?? 1) + 1,
        updated_at: new Date().toISOString(),
      });

      if (nextStep.phase === 'rest' && nextStep.restSeconds > 0) {
        setRestSecondsLeft(nextStep.restSeconds);
      } else {
        setRestSecondsLeft(null);
      }
    }
  };

  const addExtraExercise = (exercise: Exercise) => {
    const newEx: MachineExercise = {
      id: `adhoc-${Date.now()}`,
      exercise_id: exercise.id,
      name: exercise.name,
      block_position: 0,
      target_sets: 3,
      target_reps: 10,
      target_weight_kg: null,
      weight_unit: null,
      rest_seconds: 90,
      exercise,
      drop_steps: [],
    };

    const newBlock: MachineBlock = {
      id: `adhoc-block-${Date.now()}`,
      block_type: 'straight',
      name: 'Straight sets',
      order_index: blocks.length,
      target_rounds: 3,
      rest_seconds: 90,
      exercises: [newEx],
    };

    setBlocks((prev) => [...prev, newBlock]);
    setReps((prev) => ({ ...prev, [exercise.id]: '10' }));
  };

  const gymPolicy = activeGym
    ? {
        base_preset: activeGym.profile.base_preset,
        excluded_equipment: activeGym.excluded_equipment,
        excluded_exercise_ids: activeGym.excluded_exercise_ids,
      }
    : null;

  const handleFindSubstitute = async (targetEx: MachineExercise) => {
    setSubstituteTarget(targetEx);
    setSubstituteLoading(true);
    try {
      let query = supabase.from('exercises').select('*').order('name');
      if (targetEx.exercise?.muscle_group) {
        query = query.eq('muscle_group', targetEx.exercise.muscle_group);
      }
      const { data } = await query;
      const allowed = (data ?? []).filter(
        (ex) => ex.id !== targetEx.exercise_id && isExerciseAllowed(ex, gymPolicy)
      );
      setSubstituteCandidates(allowed);
    } catch (e) {
      console.error(e);
    } finally {
      setSubstituteLoading(false);
    }
  };

  const handleSelectSubstitute = (replacement: Exercise) => {
    if (!substituteTarget) return;

    setBlocks((prev) =>
      prev.map((b) => ({
        ...b,
        exercises: b.exercises.map((e) =>
          e.id === substituteTarget.id
            ? {
                ...e,
                exercise_id: replacement.id,
                name: replacement.name,
                exercise: replacement,
              }
            : e
        ),
      }))
    );

    setSubstituteTarget(null);
    setSubstituteCandidates([]);
  };

  const finishWorkout = async () => {
    await supabase.from('workouts').update({ completed_at: new Date().toISOString() }).eq('id', workoutId);
    navigation.popToTop();
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.h1}>Active Workout</Text>

        <ActiveGymSwitcher
          compact
          onManageGyms={() => {
            navigation.getParent()?.navigate('Settings', { screen: 'GymProfiles' });
          }}
        />

        {isAdaptedWorkout && (
          <View style={styles.adaptedBadge}>
            <Text style={styles.adaptedBadgeText}>✨ Adapted for Today’s Readiness</Text>
          </View>
        )}

        {lastSessionLabel && (
          <Text style={typography.bodyMuted}>Last session: {lastSessionLabel}</Text>
        )}
        {experience && <Text style={styles.caption}>Experience: {experience}</Text>}

        {/* Rest Timer Card */}
        {restSecondsLeft !== null && (
          <Card style={styles.restBanner}>
            <View>
              <Text style={typography.h2}>Rest: {restSecondsLeft}s</Text>
              {cursor.currentExercise && (
                <Text style={styles.upNextText}>
                  Up next: {cursor.currentExercise.name} (Round {cursor.currentRound} of{' '}
                  {cursor.currentBlock?.target_rounds})
                </Text>
              )}
            </View>
            <Button title="Skip rest" variant="ghost" onPress={finishRest} />
          </Card>
        )}

        {blocks.length === 0 && <EmptyState message="No exercises yet. Add one below." />}

        {blocks.map((block, bIdx) => {
          const isCurrentBlock = cursor.currentBlockOrder === bIdx && !cursor.isComplete;
          const isGroup = block.block_type === 'superset' || block.block_type === 'powerset';

          return (
            <Card
              key={block.id}
              style={[
                styles.blockContainer,
                isCurrentBlock && styles.activeBlockContainer,
                isGroup && styles.groupedBlockContainer,
              ]}
            >
              {/* Block Header */}
              <View style={styles.blockHeader}>
                <View style={styles.blockBadge}>
                  <Text style={styles.blockBadgeText}>{getTechniqueLabel(block.block_type)}</Text>
                </View>
                <Text style={styles.blockRoundText}>
                  {isCurrentBlock ? `Round ${cursor.currentRound} / ${block.target_rounds}` : `${block.target_rounds} rounds`}
                </Text>
              </View>

              <Text style={styles.blockHelperText}>{getTechniqueHelperText(block.block_type)}</Text>

              {/* Exercises in Block */}
              {block.exercises.map((ex, eIdx) => {
                const isCurrentExercise =
                  isCurrentBlock && cursor.currentExercisePosition === eIdx;
                const effectiveUnit = unitOverrides[ex.exercise_id] ?? ex.weight_unit ?? defaultUnit;

                const exLoggedSets = loggedSets.filter((s) => s.exercise_id === ex.exercise_id);
                const last = lastSetsByExercise.get(ex.exercise_id) ?? [];

                const isAllowed = isExerciseAllowed(ex.exercise, gymPolicy);

                return (
                  <Card
                    key={ex.id}
                    style={[
                      styles.exerciseCard,
                      isCurrentExercise && styles.activeExerciseCard,
                    ]}
                  >
                    <View style={styles.exerciseHeader}>
                      <View style={styles.titleWithBadge}>
                        <Text style={typography.h3}>
                          {isGroup ? `${eIdx + 1}. ` : ''}
                          {ex.name}
                        </Text>
                        {!isAllowed && (
                          <View style={styles.unavailableBadge}>
                            <Text style={styles.unavailableBadgeText}>Unavailable at gym</Text>
                          </View>
                        )}
                      </View>
                      {isCurrentExercise && (
                        <View style={styles.activeNowBadge}>
                          <Text style={styles.activeNowText}>ACTIVE NOW</Text>
                        </View>
                      )}
                    </View>

                    {!isAllowed && (
                      <View style={styles.substitutePromptRow}>
                        <Text style={styles.substitutePromptText}>
                          Movement not supported by current active gym preset/exclusions.
                        </Text>
                        <Pressable
                          style={styles.substituteBtn}
                          onPress={() => handleFindSubstitute(ex)}
                        >
                          <Text style={styles.substituteBtnText}>Find substitute</Text>
                        </Pressable>
                      </View>
                    )}

                    <Text style={typography.bodyMuted}>
                      Target: {block.target_rounds} x {ex.target_reps}
                      {ex.target_weight_kg != null
                        ? ` @ ${displayWeight(ex.target_weight_kg, effectiveUnit).toFixed(1)} ${effectiveUnit}`
                        : ''}
                    </Text>

                    {last.length > 0 && (
                      <View style={styles.lastSessionBox}>
                        <Text style={styles.caption}>Last session</Text>
                        {last.map((s) => (
                          <Text key={s.id} style={typography.bodyMuted}>
                            {s.set_type === 'drop' ? `Drop ${s.drop_index}` : `Set ${s.set_index}`}: {s.reps} reps
                            {s.weight_kg != null
                              ? ` @ ${displayWeight(s.weight_kg, effectiveUnit).toFixed(1)} ${effectiveUnit}`
                              : ''}
                          </Text>
                        ))}
                      </View>
                    )}

                    {ex.exercise && <HowToPanel exercise={ex.exercise} />}

                    {/* Logged Sets Display */}
                    {exLoggedSets.map((s) => (
                      <View key={s.id} style={styles.loggedSetRow}>
                        <View style={styles.loggedSetType}>
                          <Text
                            style={[
                              styles.loggedSetLabel,
                              s.set_type === 'drop' && styles.loggedDropLabel,
                            ]}
                          >
                            {s.set_type === 'drop'
                              ? `Drop ${s.drop_index ?? 1}`
                              : `Set ${s.round_index ?? s.set_index}`}
                          </Text>
                        </View>
                        <Text style={typography.body}>
                          {s.reps} reps
                          {s.weight_kg != null
                            ? ` @ ${displayWeight(s.weight_kg, effectiveUnit).toFixed(1)} ${effectiveUnit}`
                            : ''}
                        </Text>
                      </View>
                    ))}

                    {/* Drop Sets Plan Badge */}
                    {ex.drop_steps.length > 0 && (
                      <View style={styles.dropSetsPlanBadge}>
                        <Text style={styles.dropPlanTitle}>
                          ⚡ Drop sets planned ({ex.drop_steps.length} step{ex.drop_steps.length > 1 ? 's' : ''} on final round)
                        </Text>
                      </View>
                    )}

                    {/* Active Set / Drop Step Inputs */}
                    {isCurrentExercise && (
                      <View style={styles.activeInputsContainer}>
                        {cursor.phase === 'drop' && cursor.currentDropIndex != null && (
                          <View style={styles.activeDropAlert}>
                            <Text style={styles.activeDropAlertText}>
                              ⚡ Performing Drop Step {cursor.currentDropIndex} of {ex.drop_steps.length}
                            </Text>
                            {cursor.currentDropStep && (
                              <Text style={styles.activeDropSubText}>
                                Target: {cursor.currentDropStep.target_reps} reps
                                {cursor.currentDropStep.target_weight_kg != null
                                  ? ` @ ${displayWeight(cursor.currentDropStep.target_weight_kg, effectiveUnit).toFixed(1)} ${effectiveUnit}`
                                  : ''}
                              </Text>
                            )}
                          </View>
                        )}

                        {/* Unit selector */}
                        <View style={styles.unitSelectorRow}>
                          <Text style={styles.unitSelectorLabel}>Unit:</Text>
                          <Pressable
                            onPress={() => handleExerciseUnitChange(ex.exercise_id, null)}
                            style={[
                              styles.unitChip,
                              (unitOverrides[ex.exercise_id] ?? null) === null && styles.unitChipActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.unitChipText,
                                (unitOverrides[ex.exercise_id] ?? null) === null && styles.unitChipTextActive,
                              ]}
                            >
                              Default ({defaultUnit})
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleExerciseUnitChange(ex.exercise_id, 'kg')}
                            style={[
                              styles.unitChip,
                              (unitOverrides[ex.exercise_id] ?? null) === 'kg' && styles.unitChipActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.unitChipText,
                                (unitOverrides[ex.exercise_id] ?? null) === 'kg' && styles.unitChipTextActive,
                              ]}
                            >
                              kg
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleExerciseUnitChange(ex.exercise_id, 'lb')}
                            style={[
                              styles.unitChip,
                              (unitOverrides[ex.exercise_id] ?? null) === 'lb' && styles.unitChipActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.unitChipText,
                                (unitOverrides[ex.exercise_id] ?? null) === 'lb' && styles.unitChipTextActive,
                              ]}
                            >
                              lb
                            </Text>
                          </Pressable>
                        </View>

                        {/* Reps & Weight Input */}
                        <View style={styles.setInputRow}>
                          <View style={styles.smallInput}>
                            <Label>Reps</Label>
                            <TextInput
                              keyboardType="number-pad"
                              value={
                                cursor.phase === 'drop' && cursor.currentDropIndex != null
                                  ? reps[`drop-${ex.exercise_id}-${cursor.currentDropIndex}`] ?? reps[ex.exercise_id] ?? ''
                                  : reps[ex.exercise_id] ?? ''
                              }
                              onChangeText={(v) => {
                                if (cursor.phase === 'drop' && cursor.currentDropIndex != null) {
                                  setReps((prev) => ({
                                    ...prev,
                                    [`drop-${ex.exercise_id}-${cursor.currentDropIndex}`]: v,
                                  }));
                                } else {
                                  setReps((prev) => ({ ...prev, [ex.exercise_id]: v }));
                                }
                              }}
                            />
                          </View>
                          <View style={styles.smallInput}>
                            <Label>Weight ({effectiveUnit})</Label>
                            <TextInput
                              keyboardType="decimal-pad"
                              value={
                                cursor.phase === 'drop' && cursor.currentDropIndex != null
                                  ? weights[`drop-${ex.exercise_id}-${cursor.currentDropIndex}`] ?? weights[ex.exercise_id] ?? ''
                                  : weights[ex.exercise_id] ?? ''
                              }
                              onChangeText={(v) => {
                                if (cursor.phase === 'drop' && cursor.currentDropIndex != null) {
                                  setWeights((prev) => ({
                                    ...prev,
                                    [`drop-${ex.exercise_id}-${cursor.currentDropIndex}`]: v,
                                  }));
                                } else {
                                  setWeights((prev) => ({ ...prev, [ex.exercise_id]: v }));
                                }
                              }}
                            />
                          </View>
                        </View>

                        {/* Action Button */}
                        <View style={styles.logActionButton}>
                          <Button
                            title={cursor.nextActionLabel}
                            onPress={logCurrentStep}
                            loading={logging}
                          />
                        </View>
                      </View>
                    )}
                  </Card>
                );
              })}
            </Card>
          );
        })}

        <View style={styles.field}>
          <Button title="+ Add extra exercise" variant="secondary" onPress={() => setPickerVisible(true)} />
        </View>

        <Button title="Finish workout" variant="primary" onPress={finishWorkout} />
      </ScrollView>

      <ExercisePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={addExtraExercise}
      />

      {/* Session Substitute Modal */}
      <Modal
        visible={substituteTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSubstituteTarget(null)}
      >
        <Pressable
          style={styles.subModalOverlay}
          onPress={() => setSubstituteTarget(null)}
        >
          <Pressable style={styles.subModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.subModalHeader}>
              <View>
                <Text style={typography.h3}>Find Substitute Movement</Text>
                <Text style={styles.subModalTargetText}>
                  Replacing: {substituteTarget?.name} ({substituteTarget?.exercise?.muscle_group ?? 'Any muscle'})
                </Text>
              </View>
              <Pressable onPress={() => setSubstituteTarget(null)}>
                <Text style={styles.closeBtnText}>Cancel</Text>
              </Pressable>
            </View>

            <Text style={styles.subModalExplain}>
              Showing movements allowed at your active gym that target the same muscle group. This substitution applies to today's workout only.
            </Text>

            <FlatList
              data={substituteCandidates}
              keyExtractor={(item) => item.id}
              style={styles.candidateList}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.candidateItem}
                  onPress={() => handleSelectSubstitute(item)}
                >
                  <View style={styles.candidateInfo}>
                    <Text style={typography.body}>{item.name}</Text>
                    <Text style={typography.bodyMuted}>
                      {[item.muscle_group, item.equipment].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <View style={styles.chooseBadge}>
                    <Text style={styles.chooseBadgeText}>Select</Text>
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                !substituteLoading ? (
                  <EmptyState message="No allowed substitute exercises found for this muscle group." />
                ) : null
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  caption: { ...typography.caption, marginTop: spacing.xs },
  adaptedBadge: {
    backgroundColor: '#1E2D24',
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
  adaptedBadgeText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
  },
  restBanner: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  upNextText: { ...typography.caption, color: colors.text, marginTop: 4 },
  blockContainer: { marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  activeBlockContainer: { borderColor: colors.accent, backgroundColor: colors.surface },
  groupedBlockContainer: { borderColor: colors.primary },
  blockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  blockBadge: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  blockBadgeText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  blockRoundText: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  blockHelperText: { ...typography.caption, color: colors.textMuted, marginTop: 4, marginBottom: spacing.xs },
  exerciseCard: { marginTop: spacing.sm, backgroundColor: colors.surfaceAlt },
  activeExerciseCard: { borderColor: colors.accent, borderWidth: 1.5, backgroundColor: '#17241C' },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  activeNowBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  activeNowText: { ...typography.caption, color: colors.background, fontWeight: '800', fontSize: 10 },
  lastSessionBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  loggedSetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  loggedSetType: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.surface,
    borderRadius: 4,
  },
  loggedSetLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  loggedDropLabel: { color: colors.warning, fontWeight: '700' },
  dropSetsPlanBadge: {
    marginTop: spacing.xs,
    padding: 6,
    backgroundColor: '#2A2617',
    borderRadius: 4,
  },
  dropPlanTitle: { ...typography.caption, color: colors.warning, fontWeight: '600', fontSize: 11 },
  activeInputsContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  activeDropAlert: {
    padding: spacing.xs,
    backgroundColor: '#332B14',
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: 6,
    marginBottom: spacing.xs,
  },
  activeDropAlertText: { ...typography.caption, color: colors.warning, fontWeight: '700' },
  activeDropSubText: { ...typography.caption, color: colors.text, marginTop: 2 },
  unitSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  unitSelectorLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginRight: 2,
  },
  unitChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  unitChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  unitChipText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  unitChipTextActive: { color: colors.background, fontWeight: '700' },
  setInputRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  smallInput: { flex: 1 },
  logActionButton: { marginTop: spacing.sm },
  field: { marginTop: spacing.md, marginBottom: spacing.md },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  unavailableBadge: {
    backgroundColor: '#331F21',
    borderColor: colors.danger,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  unavailableBadgeText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
    fontSize: 9,
  },
  substitutePromptRow: {
    backgroundColor: '#2A1F1A',
    borderColor: '#593B26',
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.xs,
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  substitutePromptText: {
    ...typography.caption,
    color: '#FFB87A',
    fontSize: 11,
  },
  substituteBtn: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  substituteBtnText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  subModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  subModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.md,
    maxHeight: '80%',
  },
  subModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  subModalTargetText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeBtnText: {
    color: colors.primary,
    fontWeight: '700',
    padding: 4,
  },
  subModalExplain: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  candidateList: {
    marginTop: spacing.xs,
  },
  candidateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  candidateInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  chooseBadge: {
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chooseBadgeText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '700',
  },
});
