import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, EmptyState, ScreenContainer, SectionTitle } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { displayWeight } from '../lib/units';
import { WorkoutsStackParamList } from '../navigation/types';
import { spacing, typography } from '../theme/theme';
import { Routine, TrainingProgram, Workout, WorkoutSet } from '../types/db';

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'WorkoutsHome'>;

export default function WorkoutsHomeScreen({ navigation }: Props) {
  const { session, profile } = useAuth();
  const unit = profile?.weight_unit ?? 'kg';
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [lastByRoutine, setLastByRoutine] = useState<Record<string, { date: string; summary: string }>>({});

  const load = useCallback(async () => {
    if (!session) return;
    const [{ data: routineData }, { data: workoutData }, { data: programData }] = await Promise.all([
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
    ]);
    setRoutines(routineData ?? []);
    setRecentWorkouts(workoutData ?? []);
    setPrograms(programData ?? []);

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

  const startWorkout = async (routine?: Routine) => {
    if (!session) return;
    const { data, error } = await supabase
      .from('workouts')
      .insert({
        user_id: session.user.id,
        routine_id: routine?.id ?? null,
        name: routine?.name ?? 'Workout',
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
            <View style={styles.actionsRow}>
              <View style={styles.actionButton}>
                <Button title="Start empty workout" onPress={() => startWorkout()} />
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
            {routines.map((routine) => (
              <Card key={routine.id} style={styles.routineCard}>
                <Pressable onPress={() => navigation.navigate('RoutineBuilder', { routineId: routine.id })}>
                  <Text style={typography.h3}>{routine.name}</Text>
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
                  <Button title="Start" onPress={() => startWorkout(routine)} />
                </View>
              </Card>
            ))}

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
  routineActions: { marginTop: spacing.sm },
  workoutRow: { marginBottom: spacing.sm },
});