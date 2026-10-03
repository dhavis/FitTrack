import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ActiveGymSwitcher from '../components/ActiveGymSwitcher';
import TrainingCalendar from '../components/TrainingCalendar';
import { Button, Card, EmptyState, ScreenContainer, SectionTitle } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { makeGymProfileSnapshot, resolveActiveGymProfile } from '../lib/gymProfiles';
import { supabase } from '../lib/supabase';
import { displayWeight } from '../lib/units';
import { WorkoutsStackParamList } from '../navigation/types';
import { colors, radii, spacing, typography } from '../theme/theme';
import { Routine, TrainingProgram, Workout, WorkoutSet } from '../types/db';

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'WorkoutsHome'>;

export default function WorkoutsHomeScreen({ navigation }: Props) {
  const { session, profile } = useAuth();
  const unit = profile?.weight_unit ?? 'kg';
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [lastByRoutine, setLastByRoutine] = useState<Record<string, { date: string; summary: string }>>({});
  const [techniquesByRoutine, setTechniquesByRoutine] = useState<Record<string, string[]>>({});
  const [exerciseCountByRoutine, setExerciseCountByRoutine] = useState<Record<string, number>>({});
  const [openWorkouts, setOpenWorkouts] = useState<Workout[]>([]);
  const [startNotice, setStartNotice] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [monthWorkouts, setMonthWorkouts] = useState<{ id: string; name: string; at: string }[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    const [
      { data: routineData },
      { data: workoutData },
      { data: programData },
      { data: blocksData },
      { data: dropsData },
      { data: exerciseRows },
      { data: openWorkoutData },
    ] = await Promise.all([
      supabase.from('routines').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
      supabase
        .from('workouts')
        .select('*')
        .eq('user_id', session.user.id)
        .order('started_at', { ascending: false })
        .limit(10),
      supabase
        .from('training_programs')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false }),
      supabase.from('routine_blocks').select('routine_id, block_type'),
      supabase.from('routine_exercise_drop_steps').select('id, routine_exercise:routine_exercises(routine_id)'),
      supabase.from('routine_exercises').select('routine_id'),
      supabase
        .from('workouts')
        .select('*')
        .eq('user_id', session.user.id)
        .is('completed_at', null)
        .order('started_at', { ascending: false }),
    ]);

    setRoutines(routineData ?? []);
    setRecentWorkouts(workoutData ?? []);
    setPrograms(programData ?? []);
    setOpenWorkouts(openWorkoutData ?? []);
    if ((openWorkoutData ?? []).length === 0) setStartNotice(null);

    const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    const { data: calendarData } = await supabase
      .from('workouts')
      .select('id, name, completed_at')
      .eq('user_id', session.user.id)
      .not('completed_at', 'is', null)
      .gte('completed_at', monthStart.toISOString())
      .lt('completed_at', monthEnd.toISOString());
    setMonthWorkouts(
      (calendarData ?? [])
        .filter((workout) => workout.completed_at)
        .map((workout) => ({ id: workout.id, name: workout.name, at: workout.completed_at as string }))
    );

    const counts: Record<string, number> = {};
    (exerciseRows ?? []).forEach((row: { routine_id: string | null }) => {
      if (!row.routine_id) return;
      counts[row.routine_id] = (counts[row.routine_id] ?? 0) + 1;
    });
    setExerciseCountByRoutine(counts);

    // Build technique badges map
    const techMap: Record<string, Set<string>> = {};
    (blocksData ?? []).forEach((b: any) => {
      if (!b.routine_id) return;
      if (!techMap[b.routine_id]) techMap[b.routine_id] = new Set();
      if (b.block_type === 'superset') techMap[b.routine_id].add('Supersets');
      if (b.block_type === 'powerset') techMap[b.routine_id].add('Powersets');
    });

    (dropsData ?? []).forEach((d: any) => {
      const rId = d.routine_exercise?.routine_id;
      if (rId) {
        if (!techMap[rId]) techMap[rId] = new Set();
        techMap[rId].add('Drop sets');
      }
    });

    const formattedTechMap: Record<string, string[]> = {};
    Object.keys(techMap).forEach((rId) => {
      formattedTechMap[rId] = Array.from(techMap[rId]);
    });
    setTechniquesByRoutine(formattedTechMap);

    const map: Record<string, { date: string; summary: string }> = {};
    for (const routine of routineData ?? []) {
      const { data: last } = await supabase
        .from('workouts')
        .select('*')
        .eq('routine_id', routine.id)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!last) continue;
      const { data: sets } = await supabase.from('workout_sets').select('*').eq('workout_id', last.id);
      const totalSets = (sets as WorkoutSet[] | null)?.length ?? 0;
      const top = Math.max(...((sets as WorkoutSet[] | null)?.map((s) => s.weight_kg ?? 0) ?? [0]), 0);
      map[routine.id] = {
        date: new Date(last.completed_at ?? last.started_at).toLocaleDateString(),
        summary: `${totalSets} sets` + (top > 0 ? `, top ${displayWeight(top, unit).toFixed(1)} ${unit}` : ''),
      };
    }
    setLastByRoutine(map);
  }, [session, unit, visibleMonth]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openWorkoutMessage =
    openWorkouts.length === 0
      ? null
      : openWorkouts.length === 1
        ? 'A workout is still open. End it before starting another.'
        : `${openWorkouts.length} workouts are still open. End them before starting another.`;

  const refuseIfWorkoutOpen = () => {
    if (!openWorkoutMessage) return false;
    setStartNotice(openWorkoutMessage);
    return true;
  };

  const startEmptyWorkout = async () => {
    if (!session) return;
    if (refuseIfWorkoutOpen()) return;
    const activeGym = await resolveActiveGymProfile().catch(() => null);
    const { data, error } = await supabase
      .from('workouts')
      .insert({
        user_id: session.user.id,
        routine_id: null,
        name: 'Workout',
        gym_profile_id: activeGym?.profile?.id ?? null,
        gym_profile_snapshot: activeGym ? makeGymProfileSnapshot(activeGym) : null,
      })
      .select()
      .single();
    if (!error && data) {
      navigation.navigate('ActiveWorkout', { workoutId: data.id });
    }
  };

  const startRoutine = (routineId: string) => {
    if (refuseIfWorkoutOpen()) return;
    navigation.navigate('DailyReadiness', { routineId });
  };

  const renderRoutine = (routine: Routine, nested: boolean) => {
    const techniques = techniquesByRoutine[routine.id] ?? [];
    const exerciseCount = exerciseCountByRoutine[routine.id] ?? 0;

    return (
      <View key={routine.id} style={nested ? styles.dayBlock : undefined}>
        <Pressable onPress={() => navigation.navigate('RoutineBuilder', { routineId: routine.id })}>
          <View style={styles.routineTitleRow}>
            <Text style={typography.h3}>{routine.name}</Text>
            {techniques.length > 0 && (
              <View style={styles.techniqueBadgesRow}>
                {techniques.map((t) => (
                  <View key={t} style={styles.techniqueBadge}>
                    <Text style={styles.techniqueBadgeText}>{t}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          {routine.description ? <Text style={typography.bodyMuted}>{routine.description}</Text> : null}
          <Text style={typography.caption}>
            {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
            {lastByRoutine[routine.id]
              ? ` · Last session ${lastByRoutine[routine.id].date}: ${lastByRoutine[routine.id].summary}`
              : ' · No completed sessions yet'}
          </Text>
        </Pressable>
        <View style={styles.routineActions}>
          <Button title="Start" onPress={() => startRoutine(routine.id)} />
        </View>
      </View>
    );
  };

  const standaloneRoutines = routines.filter((routine) => !routine.program_id);
  const activeProgram = programs[0];
  const recentPreview = recentWorkouts.slice(0, 3);

  return (
    <ScreenContainer>
      <FlatList
        data={recentPreview}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <Text style={typography.h1}>Workouts</Text>
            <ActiveGymSwitcher
              onManageGyms={() => {
                navigation.getParent()?.navigate('Settings', { screen: 'GymProfiles' });
              }}
            />
            <View style={styles.actionsRow}>
              <View style={styles.actionButton}>
                <Button title="Start empty workout" onPress={() => startEmptyWorkout()} />
              </View>
              <View style={styles.actionButton}>
                <Button title="Workout history" variant="secondary" onPress={() => navigation.navigate('WorkoutHistory')} />
              </View>
            </View>
            <View style={styles.actionsRow}>
              <View style={styles.actionButton}>
                <Button title="Generate coach plan" onPress={() => navigation.navigate('GeneratePlan')} />
              </View>
            </View>
            <View style={styles.actionsRow}>
              <View style={styles.actionButton}>
                <Button title="New routine" variant="secondary" onPress={() => navigation.navigate('RoutineBuilder')} />
              </View>
              <View style={styles.actionButton}>
                <Button title="Exercise library" variant="secondary" onPress={() => navigation.navigate('ExerciseLibrary')} />
              </View>
            </View>

            {(openWorkoutMessage || startNotice) && (
              <Card style={styles.openWorkoutCard}>
                <Text style={styles.openWorkoutText}>{startNotice ?? openWorkoutMessage}</Text>
                {openWorkouts[0] && (
                  <View style={styles.routineActions}>
                    <Button
                      title="Resume open workout"
                      onPress={() => navigation.navigate('ActiveWorkout', { workoutId: openWorkouts[0].id })}
                    />
                  </View>
                )}
              </Card>
            )}

            <SectionTitle>Training</SectionTitle>
            <Card>
              <TrainingCalendar
                month={visibleMonth}
                workouts={monthWorkouts}
                onMonthChange={setVisibleMonth}
                onOpen={(workoutId) => navigation.navigate('WorkoutDetail', { workoutId })}
              />
            </Card>

            {activeProgram && (
              <>
                <SectionTitle>Program</SectionTitle>
                {(() => {
                  const days = routines.filter((routine) => routine.program_id === activeProgram.id);
                  return (
                    <Card style={styles.routineCard}>
                      <Text style={typography.h3}>{activeProgram.name}</Text>
                      <Text style={typography.bodyMuted}>
                        {new Date(activeProgram.created_at).toLocaleDateString()} · {days.length}{' '}
                        {days.length === 1 ? 'day' : 'days'}
                      </Text>
                      {days.length === 0 ? (
                        <Text style={typography.caption}>No days were saved for this program.</Text>
                      ) : (
                        days.map((routine) => renderRoutine(routine, true))
                      )}
                    </Card>
                  );
                })()}
              </>
            )}

            <SectionTitle>Your routines</SectionTitle>
            {standaloneRoutines.length === 0 && (
              <EmptyState
                message={
                  programs.length > 0
                    ? 'No routines of your own yet. The days above belong to a program.'
                    : 'No routines yet. Generate a plan or create one.'
                }
              />
            )}
            {standaloneRoutines.map((routine) => (
              <Card key={routine.id} style={styles.routineCard}>
                {renderRoutine(routine, false)}
              </Card>
            ))}

            <View style={styles.recentWorkoutsHeader}>
              <SectionTitle>Recent workouts</SectionTitle>
              {recentWorkouts.length > 0 && (
                <Pressable onPress={() => navigation.navigate('WorkoutHistory')}>
                  <Text style={styles.viewAllHistoryLink}>View all</Text>
                </Pressable>
              )}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isCompleted = Boolean(item.completed_at);
          return (
            <Card style={styles.workoutRow}>
              <Pressable
                onPress={() => {
                  if (isCompleted) {
                    navigation.navigate('WorkoutDetail', { workoutId: item.id });
                  } else {
                    navigation.navigate('ActiveWorkout', { workoutId: item.id });
                  }
                }}
              >
                <View style={styles.workoutRowHeader}>
                  <Text style={typography.body}>{item.name}</Text>
                  <View style={[styles.statusBadge, isCompleted ? styles.completedBadge : styles.inProgressBadge]}>
                    <Text style={[styles.statusBadgeText, isCompleted ? styles.completedBadgeText : styles.inProgressBadgeText]}>
                      {isCompleted ? 'Completed' : 'In Progress'}
                    </Text>
                  </View>
                </View>
                <Text style={typography.bodyMuted}>
                  {new Date(item.started_at).toLocaleString([], {
                    month: 'numeric',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  {isCompleted ? '· Tap for details' : '· Tap to resume and end it'}
                </Text>
              </Pressable>
            </Card>
          );
        }}
        ListEmptyComponent={<EmptyState message="No workouts logged yet." />}
        contentContainerStyle={styles.listContent}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: spacing.xl },
  actionsRow: { flexDirection: 'row', marginTop: spacing.md },
  actionButton: { flex: 1, marginRight: spacing.sm },
  routineCard: { marginBottom: spacing.sm },
  routineTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' },
  techniqueBadgesRow: { flexDirection: 'row', gap: 4, marginTop: 2, marginBottom: 4 },
  techniqueBadge: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  techniqueBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    fontSize: 10,
  },
  routineActions: { marginTop: spacing.sm },
  dayBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  openWorkoutCard: {
    marginTop: spacing.md,
    borderColor: colors.warning,
  },
  openWorkoutText: { ...typography.body, color: colors.warning },
  recentWorkoutsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  viewAllHistoryLink: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    padding: 4,
  },
  workoutRow: { marginBottom: spacing.sm },
  workoutRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  completedBadge: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inProgressBadge: {
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: typography.caption.fontFamily,
    fontWeight: '700',
  },
  completedBadgeText: {
    color: colors.textMuted,
  },
  inProgressBadgeText: {
    color: colors.primary,
  },
});
