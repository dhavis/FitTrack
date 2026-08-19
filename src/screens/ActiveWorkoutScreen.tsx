import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import ExercisePickerModal from '../components/ExercisePickerModal';
import HowToPanel from '../components/HowToPanel';
import { Button, Card, EmptyState, Label, ScreenContainer, TextInput } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { suggestProgression, summarizeLastSets } from '../lib/progression';
import { supabase } from '../lib/supabase';
import { displayWeight, toStorageWeightKg } from '../lib/units';
import { WorkoutsStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';
import { Exercise, ExperienceLevel, RoutineExercise, WorkoutSet } from '../types/db';

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'ActiveWorkout'>;

interface ExerciseBlock {
  exercise: Exercise;
  targetSets: number;
  targetReps: number;
  targetWeightKg: number | null;
  restSeconds: number;
  loggedSets: WorkoutSet[];
  lastSets: WorkoutSet[];
  suggestionNote: string;
}

export default function ActiveWorkoutScreen({ route, navigation }: Props) {
  const { workoutId } = route.params;
  const { profile, session } = useAuth();
  const unit = profile?.weight_unit ?? 'kg';
  const [blocks, setBlocks] = useState<ExerciseBlock[]>([]);
  const [reps, setReps] = useState<Record<string, string>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [pickerVisible, setPickerVisible] = useState(false);
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const [lastSessionLabel, setLastSessionLabel] = useState<string | null>(null);
  const [experience, setExperience] = useState<ExperienceLevel | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const { data: workout } = await supabase.from('workouts').select('*').eq('id', workoutId).single();
    const { data: sets } = await supabase
      .from('workout_sets')
      .select('*')
      .eq('workout_id', workoutId)
      .order('set_index');

    let experienceLevel: ExperienceLevel | null = null;
    if (session) {
      const { data: goals } = await supabase.from('goals').select('experience').eq('user_id', session.user.id).maybeSingle();
      experienceLevel = goals?.experience ?? null;
      setExperience(experienceLevel);
    }

    let routineExercises: RoutineExercise[] = [];
    let lastSetsByExercise = new Map<string, WorkoutSet[]>();
    if (workout?.routine_id) {
      const { data } = await supabase
        .from('routine_exercises')
        .select('*, exercise:exercises(*)')
        .eq('routine_id', workout.routine_id)
        .order('order_index');
      routineExercises = data ?? [];

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
        setLastSessionLabel(new Date(lastWorkout.completed_at ?? lastWorkout.started_at).toLocaleString());
        const { data: lastSets } = await supabase
          .from('workout_sets')
          .select('*')
          .eq('workout_id', lastWorkout.id)
          .order('set_index');
        lastSetsByExercise = summarizeLastSets(lastSets ?? []);
      } else {
        setLastSessionLabel(null);
      }
    }

    const exerciseMap = new Map<string, ExerciseBlock>();
    const nextReps: Record<string, string> = {};
    const nextWeights: Record<string, string> = {};

    routineExercises.forEach((re) => {
      if (!re.exercise) return;
      const last = lastSetsByExercise.get(re.exercise_id) ?? [];
      const suggestion = suggestProgression({
        targetSets: re.target_sets,
        targetReps: re.target_reps,
        targetWeightKg: re.target_weight_kg,
        lastSets: last,
        experience: experienceLevel,
      });
      exerciseMap.set(re.exercise_id, {
        exercise: re.exercise as Exercise,
        targetSets: suggestion.sets,
        targetReps: suggestion.reps,
        targetWeightKg: suggestion.weightKg,
        restSeconds: re.rest_seconds,
        loggedSets: [],
        lastSets: last,
        suggestionNote: suggestion.note,
      });
      nextReps[re.exercise_id] = String(suggestion.reps);
      if (suggestion.weightKg != null) {
        nextWeights[re.exercise_id] = displayWeight(suggestion.weightKg, unit).toFixed(1);
      }
    });

    const extraExerciseIds = Array.from(new Set((sets ?? []).map((s) => s.exercise_id))).filter(
      (id) => !exerciseMap.has(id)
    );
    if (extraExerciseIds.length > 0) {
      const { data: extraExercises } = await supabase.from('exercises').select('*').in('id', extraExerciseIds);
      (extraExercises ?? []).forEach((ex) => {
        exerciseMap.set(ex.id, {
          exercise: ex,
          targetSets: 3,
          targetReps: 10,
          targetWeightKg: null,
          restSeconds: 90,
          loggedSets: [],
          lastSets: [],
          suggestionNote: 'Added mid-session.',
        });
      });
    }

    (sets ?? []).forEach((set) => {
      const block = exerciseMap.get(set.exercise_id);
      if (block) block.loggedSets.push(set);
    });

    setReps((prev) => ({ ...nextReps, ...prev }));
    setWeights((prev) => ({ ...nextWeights, ...prev }));
    setBlocks(Array.from(exerciseMap.values()));
  }, [workoutId, session, unit]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (restSecondsLeft === null) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRestSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [restSecondsLeft !== null]);

  const addExtraExercise = (exercise: Exercise) => {
    setBlocks((prev) => [
      ...prev,
      {
        exercise,
        targetSets: 3,
        targetReps: 10,
        targetWeightKg: null,
        restSeconds: 90,
        loggedSets: [],
        lastSets: [],
        suggestionNote: 'Added mid-session.',
      },
    ]);
    setReps((prev) => ({ ...prev, [exercise.id]: '10' }));
  };

  const logSet = async (block: ExerciseBlock) => {
    const repsVal = parseInt(reps[block.exercise.id] ?? '', 10);
    const weightVal = parseFloat(weights[block.exercise.id] ?? '');
    if (Number.isNaN(repsVal)) return;

    const weight_kg = Number.isNaN(weightVal) ? null : toStorageWeightKg(weightVal, unit);
    const { data, error } = await supabase
      .from('workout_sets')
      .insert({
        workout_id: workoutId,
        exercise_id: block.exercise.id,
        set_index: block.loggedSets.length + 1,
        reps: repsVal,
        weight_kg,
      })
      .select()
      .single();

    if (!error && data) {
      setBlocks((prev) =>
        prev.map((b) => (b.exercise.id === block.exercise.id ? { ...b, loggedSets: [...b.loggedSets, data] } : b))
      );
      setRestSecondsLeft(block.restSeconds);
    }
  };

  const finishWorkout = async () => {
    await supabase.from('workouts').update({ completed_at: new Date().toISOString() }).eq('id', workoutId);
    navigation.popToTop();
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.h1}>Active Workout</Text>
        {lastSessionLabel && (
          <Text style={typography.bodyMuted}>Last session for this routine: {lastSessionLabel}</Text>
        )}
        {experience && <Text style={styles.caption}>Experience: {experience}</Text>}

        {restSecondsLeft !== null && (
          <Card style={styles.restBanner}>
            <Text style={typography.h2}>Rest: {restSecondsLeft}s</Text>
            <Button title="Skip" variant="ghost" onPress={() => setRestSecondsLeft(null)} />
          </Card>
        )}

        {blocks.length === 0 && <EmptyState message="No exercises yet. Add one below." />}

        {blocks.map((block) => (
          <Card key={block.exercise.id} style={styles.exerciseCard}>
            <Text style={typography.h3}>{block.exercise.name}</Text>
            <Text style={typography.bodyMuted}>
              Suggested: {block.targetSets} x {block.targetReps}
              {block.targetWeightKg != null
                ? ` @ ${displayWeight(block.targetWeightKg, unit).toFixed(1)} ${unit}`
                : ''}
            </Text>
            <Text style={styles.caption}>{block.suggestionNote}</Text>

            {block.lastSets.length > 0 && (
              <View style={styles.lastSessionBox}>
                <Text style={styles.caption}>Last session</Text>
                {block.lastSets.map((s) => (
                  <Text key={s.id} style={typography.bodyMuted}>
                    Set {s.set_index}: {s.reps} reps
                    {s.weight_kg != null ? ` @ ${displayWeight(s.weight_kg, unit).toFixed(1)} ${unit}` : ''}
                  </Text>
                ))}
              </View>
            )}

            <HowToPanel exercise={block.exercise} />

            {block.loggedSets.map((s) => (
              <View key={s.id} style={styles.loggedSetRow}>
                <Text style={typography.bodyMuted}>Set {s.set_index}</Text>
                <Text style={typography.body}>
                  {s.reps} reps
                  {s.weight_kg != null ? ` @ ${displayWeight(s.weight_kg, unit).toFixed(1)} ${unit}` : ''}
                </Text>
              </View>
            ))}

            <View style={styles.setInputRow}>
              <View style={styles.smallInput}>
                <Label>Reps</Label>
                <TextInput
                  keyboardType="number-pad"
                  value={reps[block.exercise.id] ?? ''}
                  onChangeText={(v) => setReps((prev) => ({ ...prev, [block.exercise.id]: v }))}
                />
              </View>
              <View style={styles.smallInput}>
                <Label>Weight ({unit})</Label>
                <TextInput
                  keyboardType="decimal-pad"
                  value={weights[block.exercise.id] ?? ''}
                  onChangeText={(v) => setWeights((prev) => ({ ...prev, [block.exercise.id]: v }))}
                />
              </View>
              <View style={styles.logButton}>
                <Button title="Log set" onPress={() => logSet(block)} />
              </View>
            </View>
          </Card>
        ))}

        <View style={styles.field}>
          <Button title="Add exercise" variant="secondary" onPress={() => setPickerVisible(true)} />
        </View>
        <Button title="Finish workout" variant="primary" onPress={finishWorkout} />
      </ScrollView>

      <ExercisePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={addExtraExercise}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  caption: { ...typography.caption, marginTop: spacing.xs },
  restBanner: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  exerciseCard: { marginTop: spacing.md },
  lastSessionBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
  },
  loggedSetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  setInputRow: { flexDirection: 'row', marginTop: spacing.sm, alignItems: 'flex-end' },
  smallInput: { flex: 1, marginRight: spacing.sm },
  logButton: { flex: 1 },
  field: { marginTop: spacing.md, marginBottom: spacing.md },
});