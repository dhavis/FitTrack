import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ActiveGymSwitcher from '../components/ActiveGymSwitcher';
import { Button, Card, EmptyState, ScreenContainer, SectionTitle } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { makeGymProfileSnapshot, resolveActiveGymProfile } from '../lib/gymProfiles';
import { supabase } from '../lib/supabase';
import { displayWeight } from '../lib/units';
import { MainTabParamList, WorkoutsStackParamList } from '../navigation/types';
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

  const load = useCallback(async () => {
    if (!session) return;
    const [
      { data: routineData },
      { data: workoutData },
      { data: programData },
      { data: blocksData },
      { data: dropsData },
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
    ]);

    setRoutines(routineData ?? []);
    setRecentWorkouts(workoutData ?? []);
    setPrograms(programData ?? []);

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
  }, [session, unit]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const startEmptyWorkout = async () => {
    if (!session) return;
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

  return (
    <ScreenContainer>
      <FlatList
        data={recentWorkouts}
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

            {programs.length > 0 && (
              <>
                <SectionTitle>Programs</SectionTitle>
                {programs.map((p) => (
                  <Card key={p.id} style={styles.routineCard}>
                    <Text style={typography.h3}>{p.name}</Text>
                    <Text style={typography.bodyMuted}>{p.goal_type?.replace('_', ' ') ?? 'custom'}</Text>
                  </Card>
                ))}
              </>
            )}

            <SectionTitle>Your routines</SectionTitle>
            {routines.length === 0 && <EmptyState message="No routines yet. Generate a plan or create one." />}
            {routines.map((routine) => {
              const techniques = techniquesByRoutine[routine.id] ?? [];

              return (
                <Card key={routine.id} style={styles.routineCard}>
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
                    {routine.description && <Text style={typography.bodyMuted}>{routine.description}</Text>}
                    {lastByRoutine[routine.id] ? (
                      <Text style={typography.caption}>
                        Last session {lastByRoutine[routine.id].date}: {lastByRoutine[routine.id].summary}
                      </Text>
                    ) : (
                      <Text style={typography.caption}>No completed sessions yet</Text>
                    )}
                  </Pressable>
                  <View style={styles.routineActions}>
                    <Button
                      title="Start"
                      onPress={() => navigation.navigate('DailyReadiness', { routineId: routine.id })}
                    />
                  </View>
                </Card>
              );
            })}

            <SectionTitle>Recent workouts</SectionTitle>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.workoutRow}>
            <Text style={typography.body}>{item.name}</Text>
            <Text style={typography.bodyMuted}>
              {new Date(item.started_at).toLocaleDateString()} {item.completed_at ? 'Completed' : '(in progress)'}
            </Text>
          </Card>
        )}
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
  workoutRow: { marginBottom: spacing.sm },
});
