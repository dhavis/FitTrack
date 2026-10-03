import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import HowToPanel from '../components/HowToPanel';
import { Button, Card, EmptyState, ScreenContainer, SectionTitle } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { isBodyweightEquipment } from '../lib/exercises';
import {
  computeExerciseTrend,
  ExerciseTrend,
  filterRegularCompletedSets,
  findBestRegularSet,
  ProgressionSuggestion,
  suggestProgression,
} from '../lib/progression';
import { supabase } from '../lib/supabase';
import { displayWeight } from '../lib/units';
import { WorkoutsStackParamList } from '../navigation/types';
import { colors, fonts, radii, spacing, typography } from '../theme/theme';
import {
  Exercise,
  WeightUnit,
  WorkoutPlanDropStep,
  WorkoutPlanExercise,
  WorkoutSet,
} from '../types/db';

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'ExerciseHistory'>;

interface WorkoutSessionRow {
  workoutId: string;
  workoutName: string;
  completedAt: string;
  planExercise: (WorkoutPlanExercise & { drop_steps?: WorkoutPlanDropStep[] }) | null;
  sets: WorkoutSet[];
  bestRegularSet: WorkoutSet | null;
  isBodyweight: boolean;
}

export default function ExerciseHistoryScreen({ route, navigation }: Props) {
  const { exerciseId, workoutId } = route.params;
  const { profile, session } = useAuth();
  const defaultUnit: WeightUnit = profile?.weight_unit ?? 'kg';

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [sessions, setSessions] = useState<WorkoutSessionRow[]>([]);
  const [trend, setTrend] = useState<ExerciseTrend>({ direction: 'none', diffWeightKg: null, diffReps: null, label: '—' });
  const [suggestion, setSuggestion] = useState<ProgressionSuggestion | null>(null);
  const [effectiveUnit, setEffectiveUnit] = useState<WeightUnit>(defaultUnit);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!session) return;
    try {
      // 1. Fetch exercise details
      const { data: exData } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .single();
      if (exData) setExercise(exData);

      const isBodyweight = isBodyweightEquipment(exData?.equipment);

      // 2. Fetch all sets for this exercise from user's workouts
      const { data: userSetsData } = await supabase
        .from('workout_sets')
        .select('*, workout:workouts(id, user_id, name, started_at, completed_at, routine_id, routine:routines(name))')
        .eq('exercise_id', exerciseId)
        .order('completed_at', { ascending: false });

      const allSets = (userSetsData as (WorkoutSet & { workout?: any })[]) ?? [];

      // Filter for completed workouts owned by user
      const completedSets = allSets.filter(
        (s) => s.workout && s.workout.completed_at && s.workout.user_id === session.user.id
      );

      // Collect the newest 5 unique completed workouts
      const workoutMap = new Map<string, { workout: any; sets: WorkoutSet[] }>();
      for (const s of completedSets) {
        const wId = s.workout_id;
        if (!workoutMap.has(wId)) {
          if (workoutMap.size >= 5) continue;
          workoutMap.set(wId, { workout: s.workout, sets: [] });
        }
        workoutMap.get(wId)!.sets.push(s);
      }

      const top5WorkoutIds = Array.from(workoutMap.keys());

      // 3. Fetch workout plan exercises and drop steps for the 5 workouts
      let planExercises: WorkoutPlanExercise[] = [];
      let planDrops: WorkoutPlanDropStep[] = [];
      if (top5WorkoutIds.length > 0) {
        const [{ data: peData }, { data: pdData }] = await Promise.all([
          supabase
            .from('workout_plan_exercises')
            .select('*')
            .in('workout_id', top5WorkoutIds)
            .eq('exercise_id', exerciseId),
          supabase.from('workout_plan_drop_steps').select('*'),
        ]);
        planExercises = peData ?? [];
        planDrops = pdData ?? [];
      }

      const dropsByPlanExId = new Map<string, WorkoutPlanDropStep[]>();
      planDrops.forEach((d) => {
        if (!d.workout_plan_exercise_id) return;
        const list = dropsByPlanExId.get(d.workout_plan_exercise_id) ?? [];
        list.push(d);
        dropsByPlanExId.set(d.workout_plan_exercise_id, list);
      });

      const planMap = new Map<string, WorkoutPlanExercise & { drop_steps?: WorkoutPlanDropStep[] }>();
      planExercises.forEach((pe) => {
        planMap.set(pe.workout_id, {
          ...pe,
          drop_steps: dropsByPlanExId.get(pe.id) ?? [],
        });
      });

      // 4. Build session history rows
      const sessionRows: WorkoutSessionRow[] = top5WorkoutIds.map((wId) => {
        const entry = workoutMap.get(wId)!;
        const w = entry.workout;
        const sortedSets = entry.sets.sort((a, b) => a.set_index - b.set_index);
        const regularSets = filterRegularCompletedSets(sortedSets);
        const bestRegularSet = findBestRegularSet(regularSets, isBodyweight);
        const planEx = planMap.get(wId) ?? null;

        const routineName = (w.routine as any)?.name ?? w.routines?.name;
        const workoutName = routineName ?? w.name ?? 'Workout';

        return {
          workoutId: wId,
          workoutName,
          completedAt: w.completed_at,
          planExercise: planEx,
          sets: sortedSets,
          bestRegularSet,
          isBodyweight,
        };
      });

      setSessions(sessionRows);

      // 5. Check if there is an active workout plan target
      let activePlanEx: WorkoutPlanExercise | null = null;
      if (workoutId) {
        const { data: currentPe } = await supabase
          .from('workout_plan_exercises')
          .select('*')
          .eq('workout_id', workoutId)
          .eq('exercise_id', exerciseId)
          .maybeSingle();
        activePlanEx = currentPe;
      }

      // Determine unit
      const resolvedUnit: WeightUnit =
        activePlanEx?.weight_unit ??
        sessionRows[0]?.planExercise?.weight_unit ??
        defaultUnit;
      setEffectiveUnit(resolvedUnit);

      // 6. Compute Trend across the 5 sessions
      const trendResult = computeExerciseTrend(sessionRows, resolvedUnit);
      setTrend(trendResult);

      // 7. Compute Suggestion
      // Active-workout targets come from already resolved current exercise, or latest session's target, or fallback
      const latestSession = sessionRows[0];
      const targetSets = activePlanEx?.target_sets ?? latestSession?.planExercise?.target_sets ?? 3;
      const targetReps = activePlanEx?.target_reps ?? latestSession?.planExercise?.target_reps ?? 10;
      const targetWeightKg = activePlanEx ? activePlanEx.target_weight_kg : (latestSession?.planExercise?.target_weight_kg ?? null);

      const progSuggestion = suggestProgression({
        targetSets,
        targetReps,
        targetWeightKg,
        displayUnit: resolvedUnit,
        lastSets: latestSession?.sets ?? [],
        isBodyweight,
      });

      setSuggestion(progSuggestion);
    } catch (e) {
      console.error('Failed to load exercise history:', e);
    } finally {
      setLoading(false);
    }
  }, [exerciseId, workoutId, session, defaultUnit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApplySuggestion = () => {
    if (!workoutId || !suggestion) return;
    navigation.navigate('ActiveWorkout', {
      workoutId,
      suggestion: {
        exerciseId,
        reps: suggestion.reps,
        weightKg: suggestion.weightKg,
      },
    });
  };

  const exerciseName = exercise?.name ?? 'Exercise';

  return (
    <ScreenContainer>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.workoutId}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={typography.h1}>{exerciseName}</Text>
            <Text style={typography.bodyMuted}>
              {[exercise?.muscle_group, exercise?.equipment].filter(Boolean).join(' · ')}
            </Text>

            {/* Trend & Suggestion Cards */}
            <View style={styles.cardsRow}>
              {/* Trend card */}
              <Card style={styles.trendCard}>
                <Text style={styles.cardHeaderLabel}>5-SESSION TREND</Text>
                <View style={styles.trendValueRow}>
                  <Text style={styles.trendValue}>{trend.label}</Text>
                </View>
                <Text style={typography.caption}>
                  {sessions.length <= 1
                    ? 'Need 2+ sessions for trend'
                    : `Compared over past ${sessions.length} sessions`}
                </Text>
              </Card>

              {/* Suggestion Card */}
              {suggestion && (
                <Card style={styles.suggestionCard}>
                  <Text style={styles.cardHeaderLabel}>NEXT TARGET SUGGESTION</Text>
                  <View style={styles.suggestionTargetRow}>
                    <Text style={styles.suggestionTargetText}>
                      {suggestion.sets} sets × {suggestion.reps} reps
                      {suggestion.weightKg != null
                        ? ` @ ${displayWeight(suggestion.weightKg, effectiveUnit).toFixed(1)} ${effectiveUnit}`
                        : ' (bodyweight)'}
                    </Text>
                  </View>
                  <Text style={styles.suggestionReasonText}>{suggestion.note}</Text>

                  {workoutId ? (
                    <View style={styles.useSuggestionBtnWrapper}>
                      <Button
                        title="Use suggestion"
                        variant="secondary"
                        onPress={handleApplySuggestion}
                      />
                    </View>
                  ) : null}
                </Card>
              )}
            </View>

            {exercise && <HowToPanel exercise={exercise} />}

            <SectionTitle style={styles.sectionTitle}>
              Past Sessions ({sessions.length})
            </SectionTitle>
          </View>
        }
        renderItem={({ item }) => {
          const sessionUnit: WeightUnit = item.planExercise?.weight_unit ?? effectiveUnit;

          return (
            <Card style={styles.sessionCard}>
              <Pressable
                onPress={() => navigation.navigate('WorkoutDetail', { workoutId: item.workoutId })}
              >
                <View style={styles.sessionHeaderRow}>
                  <View style={styles.sessionTitleCol}>
                    <Text style={typography.h3}>{item.workoutName}</Text>
                    <Text style={typography.caption}>
                      {new Date(item.completedAt).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={styles.viewWorkoutBadge}>
                    <Text style={styles.viewWorkoutBadgeText}>View workout</Text>
                  </View>
                </View>

                {item.planExercise && (
                  <View style={styles.sessionPlanTargetBox}>
                    <Text style={styles.sessionPlanTargetText}>
                      Target: {item.planExercise.target_sets} × {item.planExercise.target_reps}
                      {item.planExercise.target_weight_kg != null
                        ? ` @ ${displayWeight(item.planExercise.target_weight_kg, sessionUnit).toFixed(1)} ${sessionUnit}`
                        : ''}
                    </Text>
                  </View>
                )}

                {item.bestRegularSet && (
                  <View style={styles.bestSetRow}>
                    <Text style={styles.bestSetLabel}>Best regular set:</Text>
                    <Text style={styles.bestSetValue}>
                      {item.bestRegularSet.reps} reps
                      {item.bestRegularSet.weight_kg != null
                        ? ` @ ${displayWeight(item.bestRegularSet.weight_kg, sessionUnit).toFixed(1)} ${sessionUnit}`
                        : ' (bodyweight)'}
                    </Text>
                  </View>
                )}

                {/* Logged sets in this session */}
                <View style={styles.setsList}>
                  {item.sets.map((s, idx) => {
                    const isDrop = s.set_type === 'drop' || (s.drop_index != null && s.drop_index > 0);
                    const label = s.set_type === 'warmup' ? 'Warm-up' : isDrop ? `Drop ${s.drop_index ?? 1}` : `Set ${s.round_index ?? s.set_index ?? idx + 1}`;

                    return (
                      <View key={s.id ?? idx} style={[styles.setRow, isDrop && styles.dropSetRow]}>
                        <View style={[styles.setTag, isDrop && styles.dropSetTag]}>
                          <Text style={[styles.setTagText, isDrop && styles.dropSetTagText]}>{label}</Text>
                        </View>
                        <Text style={typography.body}>
                          {s.reps ?? 0} reps
                          {s.weight_kg != null
                            ? ` @ ${displayWeight(s.weight_kg, sessionUnit).toFixed(1)} ${sessionUnit}`
                            : ' (bodyweight)'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Pressable>
            </Card>
          );
        }}
        ListEmptyComponent={
          !loading ? <EmptyState message="No previous completed sessions for this exercise." /> : null
        }
        contentContainerStyle={styles.listContent}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: spacing.xl },
  header: { marginBottom: spacing.sm, marginTop: spacing.xs },
  cardsRow: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  trendCard: {
    backgroundColor: colors.surface,
  },
  cardHeaderLabel: {
    fontSize: 10,
    fontFamily: fonts.medium,
    color: colors.textFaint,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  trendValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  trendValue: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  suggestionCard: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.accent,
  },
  suggestionTargetRow: {
    marginVertical: 4,
  },
  suggestionTargetText: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  suggestionReasonText: {
    ...typography.bodyMuted,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  useSuggestionBtnWrapper: {
    marginTop: spacing.xs,
  },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sessionCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sessionTitleCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  viewWorkoutBadge: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  viewWorkoutBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  sessionPlanTargetBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: spacing.xs,
  },
  sessionPlanTargetText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  bestSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  bestSetLabel: {
    ...typography.caption,
    color: colors.textFaint,
    fontWeight: '600',
  },
  bestSetValue: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  setsList: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dropSetRow: {
    backgroundColor: 'rgba(255, 194, 75, 0.05)',
  },
  setTag: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dropSetTag: {
    backgroundColor: '#332B14',
    borderColor: colors.warning,
    borderWidth: 1,
  },
  setTagText: {
    fontSize: 10,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  dropSetTagText: {
    color: colors.warning,
    fontWeight: '700',
  },
});
