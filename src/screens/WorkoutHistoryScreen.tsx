import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, EmptyState, ScreenContainer } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { filterRegularCompletedSets, findBestRegularSet } from '../lib/progression';
import { supabase } from '../lib/supabase';
import { displayWeight } from '../lib/units';
import { WorkoutsStackParamList } from '../navigation/types';
import { colors, fonts, radii, spacing, typography } from '../theme/theme';
import { WeightUnit, Workout, WorkoutSet } from '../types/db';

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'WorkoutHistory'>;

interface WorkoutHistoryRow extends Workout {
  routine?: { name: string } | null;
  workout_sets?: WorkoutSet[];
}

export default function WorkoutHistoryScreen({ navigation }: Props) {
  const { session, profile } = useAuth();
  const unit: WeightUnit = profile?.weight_unit ?? 'kg';

  const [workouts, setWorkouts] = useState<WorkoutHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!session) return;
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select('*, routine:routines(name), workout_sets(*)')
        .eq('user_id', session.user.id)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false });

      if (error) {
        console.error('Failed to load workout history:', error.message);
      } else {
        setWorkouts((data as WorkoutHistoryRow[]) ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const computeWorkoutStats = (item: WorkoutHistoryRow) => {
    const rawSets = item.workout_sets ?? [];
    const regularSets = filterRegularCompletedSets(rawSets);
    const exerciseIds = new Set(rawSets.map((s) => s.exercise_id));
    const completedSetCount = rawSets.filter((s) => (s.reps ?? 0) > 0).length;

    // Best regular set / top weight
    const bestSet = findBestRegularSet(regularSets, false);
    const topWeight = bestSet?.weight_kg ?? 0;

    // Calculate duration in minutes if available
    let durationText: string | null = null;
    if (item.started_at && item.completed_at) {
      const start = new Date(item.started_at).getTime();
      const end = new Date(item.completed_at).getTime();
      const diffMinutes = Math.max(1, Math.round((end - start) / 60000));
      if (diffMinutes > 0 && diffMinutes < 1440) {
        durationText = `${diffMinutes} min`;
      }
    }

    const title = item.routine?.name ?? item.name ?? 'Workout';
    const dateFormatted = item.completed_at
      ? new Date(item.completed_at).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '';

    return {
      title,
      dateFormatted,
      durationText,
      exerciseCount: exerciseIds.size,
      completedSetCount,
      topWeight,
    };
  };

  return (
    <ScreenContainer>
      <FlatList
        data={workouts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={typography.h1}>Workout History</Text>
            <Text style={typography.bodyMuted}>
              {workouts.length} completed session{workouts.length === 1 ? '' : 's'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const stats = computeWorkoutStats(item);

          return (
            <Card style={styles.workoutCard}>
              <Pressable
                onPress={() => navigation.navigate('WorkoutDetail', { workoutId: item.id })}
                style={styles.cardPressable}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.titleCol}>
                    <Text style={typography.h3}>{stats.title}</Text>
                    <Text style={typography.caption}>{stats.dateFormatted}</Text>
                  </View>
                  {stats.durationText && (
                    <View style={styles.durationBadge}>
                      <Text style={styles.durationBadgeText}>{stats.durationText}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>EXERCISES</Text>
                    <Text style={styles.metricValue}>{stats.exerciseCount}</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>SETS</Text>
                    <Text style={styles.metricValue}>{stats.completedSetCount}</Text>
                  </View>
                  {stats.topWeight > 0 && (
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>TOP WEIGHT</Text>
                      <Text style={styles.metricValue}>
                        {displayWeight(stats.topWeight, unit).toFixed(1)} {unit}
                      </Text>
                    </View>
                  )}
                </View>

                {item.gym_profile_snapshot && (
                  <View style={styles.gymRow}>
                    <Text style={typography.caption}>
                      Gym: {item.gym_profile_snapshot.name} ({item.gym_profile_snapshot.base_preset.replace('_', ' ')})
                    </Text>
                  </View>
                )}
              </Pressable>
            </Card>
          );
        }}
        ListEmptyComponent={
          !loading ? <EmptyState message="No completed workouts found. Finish a workout to see it here." /> : null
        }
        contentContainerStyle={styles.listContent}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: spacing.xl },
  header: { marginBottom: spacing.md, marginTop: spacing.xs },
  workoutCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  cardPressable: {
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  durationBadge: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  durationBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: fonts.medium,
    color: colors.textFaint,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  gymRow: {
    marginTop: 2,
  },
});
