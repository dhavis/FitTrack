import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import HowToPanel from '../components/HowToPanel';
import { Card, EmptyState, ScreenContainer, SectionTitle } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { isBodyweightEquipment } from '../lib/exercises';
import { filterRegularCompletedSets, findBestRegularSet } from '../lib/progression';
import { supabase } from '../lib/supabase';
import { displayWeight } from '../lib/units';
import { WorkoutsStackParamList } from '../navigation/types';
import { colors, fonts, radii, spacing, typography } from '../theme/theme';
import {
  Exercise,
  WeightUnit,
  Workout,
  WorkoutPlanDropStep,
  WorkoutPlanExercise,
  WorkoutSet,
} from '../types/db';

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'WorkoutDetail'>;

interface ExerciseDetailGroup {
  exerciseId: string;
  exercise: Exercise | null;
  planExercise: (WorkoutPlanExercise & { drop_steps?: WorkoutPlanDropStep[] }) | null;
  sets: WorkoutSet[];
  bestSet: WorkoutSet | null;
}

export default function WorkoutDetailScreen({ route, navigation }: Props) {
  const { workoutId } = route.params;
  const { profile } = useAuth();
  const defaultUnit: WeightUnit = profile?.weight_unit ?? 'kg';

  const [workout, setWorkout] = useState<(Workout & { routine?: { name: string } | null }) | null>(null);
  const [exerciseGroups, setExerciseGroups] = useState<ExerciseDetailGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWorkoutDetail = useCallback(async () => {
    try {
      const [
        { data: workoutData },
        { data: setsData },
        { data: planExData },
        { data: planDropsData },
      ] = await Promise.all([
        supabase
          .from('workouts')
          .select('*, routine:routines(name)')
          .eq('id', workoutId)
          .single(),
        supabase
          .from('workout_sets')
          .select('*, exercise:exercises(*)')
          .eq('workout_id', workoutId)
          .order('set_index'),
        supabase
          .from('workout_plan_exercises')
          .select('*, exercise:exercises(*)')
          .eq('workout_id', workoutId)
          .order('block_position'),
        supabase
          .from('workout_plan_drop_steps')
          .select('*'),
      ]);

      if (workoutData) {
        setWorkout(workoutData);
      }

      const allSets = (setsData as WorkoutSet[]) ?? [];
      const allPlanEx = (planExData as WorkoutPlanExercise[]) ?? [];
      const allDrops = (planDropsData as WorkoutPlanDropStep[]) ?? [];

      // Map drops to plan exercises
      const dropsByPlanExId = new Map<string, WorkoutPlanDropStep[]>();
      allDrops.forEach((d) => {
        if (!d.workout_plan_exercise_id) return;
        const list = dropsByPlanExId.get(d.workout_plan_exercise_id) ?? [];
        list.push(d);
        dropsByPlanExId.set(d.workout_plan_exercise_id, list);
      });

      // Map plan exercises by exercise_id
      const planByExerciseId = new Map<string, WorkoutPlanExercise & { drop_steps?: WorkoutPlanDropStep[] }>();
      allPlanEx.forEach((pe) => {
        planByExerciseId.set(pe.exercise_id, {
          ...pe,
          drop_steps: dropsByPlanExId.get(pe.id) ?? [],
        });
      });

      // Group sets by exercise_id in order of appearance
      const groupsMap = new Map<string, ExerciseDetailGroup>();

      // First add exercises from plan if any
      allPlanEx.forEach((pe) => {
        if (!groupsMap.has(pe.exercise_id)) {
          groupsMap.set(pe.exercise_id, {
            exerciseId: pe.exercise_id,
            exercise: pe.exercise ?? null,
            planExercise: planByExerciseId.get(pe.exercise_id) ?? null,
            sets: [],
            bestSet: null,
          });
        }
      });

      // Add sets to their group (or create group if ad-hoc set)
      allSets.forEach((s) => {
        let group = groupsMap.get(s.exercise_id);
        if (!group) {
          group = {
            exerciseId: s.exercise_id,
            exercise: s.exercise ?? null,
            planExercise: planByExerciseId.get(s.exercise_id) ?? null,
            sets: [],
            bestSet: null,
          };
          groupsMap.set(s.exercise_id, group);
        }
        group.sets.push(s);
        if (s.exercise && !group.exercise) {
          group.exercise = s.exercise;
        }
      });

      // Calculate best regular set per group
      const groupsList: ExerciseDetailGroup[] = Array.from(groupsMap.values()).map((g) => {
        const regularSets = filterRegularCompletedSets(g.sets);
        const isBodyweight = isBodyweightEquipment(g.exercise?.equipment);
        const best = findBestRegularSet(regularSets, isBodyweight);
        return {
          ...g,
          bestSet: best,
        };
      });

      setExerciseGroups(groupsList);
    } catch (e) {
      console.error('Failed to load workout detail:', e);
    } finally {
      setLoading(false);
    }
  }, [workoutId]);

  useEffect(() => {
    loadWorkoutDetail();
  }, [loadWorkoutDetail]);

  const workoutTitle = workout?.routine?.name ?? workout?.name ?? 'Workout';

  let durationText: string | null = null;
  if (workout?.started_at && workout?.completed_at) {
    const start = new Date(workout.started_at).getTime();
    const end = new Date(workout.completed_at).getTime();
    const diffMinutes = Math.max(1, Math.round((end - start) / 60000));
    durationText = `${diffMinutes} mins`;
  }

  const totalSetsCount = exerciseGroups.reduce((acc, g) => acc + g.sets.length, 0);

  return (
    <ScreenContainer>
      <FlatList
        data={exerciseGroups}
        keyExtractor={(item) => item.exerciseId}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={typography.h1}>{workoutTitle}</Text>

            <View style={styles.metaRow}>
              {workout?.completed_at && (
                <Text style={typography.bodyMuted}>
                  Completed on {new Date(workout.completed_at).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}{' '}
                  at {new Date(workout.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
              {durationText && (
                <View style={styles.pillBadge}>
                  <Text style={styles.pillBadgeText}>⏱ {durationText}</Text>
                </View>
              )}
            </View>

            {workout?.gym_profile_snapshot && (
              <View style={styles.gymInfoBox}>
                <Text style={styles.gymInfoText}>
                  Gym: {workout.gym_profile_snapshot.name} ({workout.gym_profile_snapshot.base_preset.replace('_', ' ')})
                </Text>
              </View>
            )}

            {workout?.notes && (
              <Card style={styles.notesCard}>
                <Text style={styles.notesLabel}>Notes</Text>
                <Text style={typography.body}>{workout.notes}</Text>
              </Card>
            )}

            <View style={styles.summaryStatsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>EXERCISES</Text>
                <Text style={styles.statNumber}>{exerciseGroups.length}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>TOTAL SETS</Text>
                <Text style={styles.statNumber}>{totalSetsCount}</Text>
              </View>
            </View>

            <SectionTitle style={styles.sectionHeader}>Exercises & Sets</SectionTitle>
          </View>
        }
        renderItem={({ item }) => {
          const effectiveUnit: WeightUnit = item.planExercise?.weight_unit ?? defaultUnit;
          const exName = item.exercise?.name ?? 'Exercise';

          return (
            <Card style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <View style={styles.exTitleCol}>
                  <Text style={typography.h3}>{exName}</Text>
                  <Text style={typography.bodyMuted}>
                    {[item.exercise?.muscle_group, item.exercise?.equipment].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Pressable
                  style={styles.historyBtn}
                  onPress={() =>
                    navigation.navigate('ExerciseHistory', {
                      exerciseId: item.exerciseId,
                      workoutId: workout?.id,
                    })
                  }
                >
                  <Text style={styles.historyBtnText}>History</Text>
                </Pressable>
              </View>

              {/* Target metadata from plan snapshot */}
              {item.planExercise && (
                <View style={styles.targetBanner}>
                  <Text style={styles.targetBannerText}>
                    Planned Target: {item.planExercise.target_sets} sets × {item.planExercise.target_reps} reps
                    {item.planExercise.target_weight_kg != null
                      ? ` @ ${displayWeight(item.planExercise.target_weight_kg, effectiveUnit).toFixed(1)} ${effectiveUnit}`
                      : ''}
                  </Text>
                  {item.planExercise.drop_steps && item.planExercise.drop_steps.length > 0 && (
                    <Text style={styles.targetDropText}>
                      ⚡ {item.planExercise.drop_steps.length} Drop step{item.planExercise.drop_steps.length > 1 ? 's' : ''} planned
                    </Text>
                  )}
                </View>
              )}

              {/* Best set pill */}
              {item.bestSet && (
                <View style={styles.bestSetRow}>
                  <Text style={styles.bestSetLabel}>Best Set:</Text>
                  <Text style={styles.bestSetValue}>
                    {item.bestSet.reps} reps
                    {item.bestSet.weight_kg != null
                      ? ` @ ${displayWeight(item.bestSet.weight_kg, effectiveUnit).toFixed(1)} ${effectiveUnit}`
                      : ' (bodyweight)'}
                  </Text>
                </View>
              )}

              {/* Logged Sets List */}
              <View style={styles.setsList}>
                {item.sets.length === 0 ? (
                  <Text style={typography.caption}>No sets logged for this exercise.</Text>
                ) : (
                  item.sets.map((s, idx) => {
                    const isDrop = s.set_type === 'drop' || (s.drop_index != null && s.drop_index > 0);
                    const setLabel = s.set_type === 'warmup' ? 'Warm-up' : isDrop ? `Drop ${s.drop_index ?? 1}` : `Set ${s.round_index ?? s.set_index ?? idx + 1}`;

                    return (
                      <View key={s.id ?? idx} style={[styles.setRow, isDrop && styles.dropSetRow]}>
                        <View style={[styles.setTag, isDrop && styles.dropSetTag]}>
                          <Text style={[styles.setTagText, isDrop && styles.dropSetTagText]}>{setLabel}</Text>
                        </View>
                        <View style={styles.setPerformance}>
                          <Text style={typography.body}>
                            {s.reps ?? 0} reps
                            {s.weight_kg != null
                              ? ` @ ${displayWeight(s.weight_kg, effectiveUnit).toFixed(1)} ${effectiveUnit}`
                              : ' (bodyweight)'}
                          </Text>
                          {s.rpe != null && <Text style={styles.rpeText}>RPE {s.rpe}</Text>}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {item.exercise && <HowToPanel exercise={item.exercise} />}
            </Card>
          );
        }}
        ListEmptyComponent={
          !loading ? <EmptyState message="No exercise data recorded for this workout." /> : null
        }
        contentContainerStyle={styles.listContent}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: spacing.xl },
  header: { marginBottom: spacing.md, marginTop: spacing.xs },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  pillBadge: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  pillBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  gymInfoBox: {
    marginTop: spacing.xs,
  },
  gymInfoText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  notesCard: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceAlt,
  },
  notesLabel: {
    ...typography.caption,
    color: colors.textFaint,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  summaryStatsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: fonts.medium,
    color: colors.textFaint,
    letterSpacing: 0.8,
  },
  statNumber: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.text,
    marginTop: 2,
  },
  sectionHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  exerciseCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  exTitleCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  historyBtn: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  historyBtnText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  targetBanner: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginTop: spacing.xs,
  },
  targetBannerText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  targetDropText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '600',
    marginTop: 2,
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
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropSetRow: {
    backgroundColor: 'rgba(255, 194, 75, 0.05)',
  },
  setTag: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dropSetTag: {
    backgroundColor: '#332B14',
    borderColor: colors.warning,
    borderWidth: 1,
  },
  setTagText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  dropSetTagText: {
    color: colors.warning,
    fontWeight: '700',
  },
  setPerformance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rpeText: {
    ...typography.caption,
    color: colors.textFaint,
  },
});
