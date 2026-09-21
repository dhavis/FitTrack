import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import RecommendationDisclaimer from '../components/RecommendationDisclaimer';
import { Button, Card, EmptyState, Label, ScreenContainer, SectionTitle } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { approveAdaptationEvent, fetchAdaptationEvent, rejectAdaptationEvent } from '../lib/adaptationApi';
import { makeGymProfileSnapshot, resolveActiveGymProfile } from '../lib/gymProfiles';
import { supabase } from '../lib/supabase';
import { displayWeight } from '../lib/units';
import { WorkoutsStackParamList } from '../navigation/types';
import { colors, radii, spacing, typography } from '../theme/theme';
import { AdaptationEvent, RoutineExercise } from '../types/db';

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'SessionAdaptationReview'>;

export default function SessionAdaptationReviewScreen({ route, navigation }: Props) {
  const { eventId } = route.params;
  const { profile, session } = useAuth();
  const unit = profile?.weight_unit ?? 'kg';

  const [event, setEvent] = useState<AdaptationEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        const data = await fetchAdaptationEvent(eventId);
        if (isMounted) setEvent(data);
      } catch (err: any) {
        if (isMounted) setError(err.message ?? 'Failed to load adaptation details');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [eventId]);

  const handleApprove = async () => {
    try {
      setActing(true);
      setError(null);
      const workoutId = await approveAdaptationEvent(eventId);
      navigation.navigate('ActiveWorkout', { workoutId });
    } catch (err: any) {
      setError(err.message ?? 'Failed to approve adaptation');
      setActing(false);
    }
  };

  const handleKeepCurrent = async () => {
    if (!session || !event) return;
    try {
      setActing(true);
      setError(null);
      await rejectAdaptationEvent(eventId);

      const activeGym = await resolveActiveGymProfile().catch(() => null);
      const routineSnapshot = event.source_routine_snapshot as { name?: string } | null;
      const workoutName = routineSnapshot?.name ?? 'Workout';

      const { data: workout, error: workoutErr } = await supabase
        .from('workouts')
        .insert({
          user_id: session.user.id,
          routine_id: event.source_routine_id ?? null,
          name: workoutName,
          gym_profile_id: activeGym?.profile?.id ?? null,
          gym_profile_snapshot: activeGym ? makeGymProfileSnapshot(activeGym) : null,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (workoutErr || !workout) {
        throw new Error(workoutErr?.message ?? 'Failed to start workout');
      }

      navigation.navigate('ActiveWorkout', { workoutId: workout.id });
    } catch (err: any) {
      setError(err.message ?? 'Failed to reject adaptation');
      setActing(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[typography.bodyMuted, { marginTop: spacing.md }]}>
            Evaluating session adaptation...
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!event) {
    return (
      <ScreenContainer>
        <EmptyState message="Adaptation event not found." />
        <Button title="Back to Workouts" onPress={() => navigation.navigate('WorkoutsHome')} />
      </ScreenContainer>
    );
  }

  // Safety Hold Screen
  if (event.status === 'safety_hold' || event.check_in_snapshot?.pain_or_new_injury) {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={styles.content}>
          <Card style={styles.safetyCard}>
            <Text style={styles.safetyTitle}>Recommendation paused</Text>
            <Text style={styles.safetyBody}>
              FitTrack can’t assess or treat pain or a new injury. Please consult a physician before continuing.
            </Text>
            <View style={styles.emergencyBox}>
              <Text style={styles.emergencyText}>
                For an emergency, contact your local emergency services now.
              </Text>
            </View>
          </Card>

          <RecommendationDisclaimer />

          <View style={styles.buttonStack}>
            <Button
              title="Dismiss"
              variant="secondary"
              onPress={() => navigation.navigate('WorkoutsHome')}
            />
            <View style={{ marginTop: spacing.sm }}>
              <Button
                title="View current plan"
                variant="ghost"
                onPress={() => navigation.goBack()}
              />
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  const routineSnapshot = event.source_routine_snapshot as {
    name?: string;
    description?: string;
    exercises?: (RoutineExercise & { exercise?: { name: string; muscle_group: string } })[];
  };
  const originalExercises = routineSnapshot?.exercises ?? [];
  const prescription = event.validated_prescription;
  const suggestedExercises = prescription?.exercises ?? [];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.h1}>Review today’s suggested session.</Text>
        <Text style={typography.bodyMuted}>Your plan won’t change unless you approve.</Text>

        {prescription?.coach_message && (
          <Card style={styles.coachCard}>
            <Label>Coach Note</Label>
            <Text style={typography.body}>{prescription.coach_message}</Text>
          </Card>
        )}

        {/* Comparison Section: Current vs Suggested */}
        <View style={styles.sectionHeader}>
          <SectionTitle>Suggested</SectionTitle>
          <Text style={typography.caption}>Adapted for today's check-in</Text>
        </View>

        {suggestedExercises.map((ex, idx) => {
          const matchingOrig = originalExercises.find((o) => o.exercise_id === ex.exercise_id);
          const effectiveUnit = matchingOrig?.weight_unit ?? unit;
          return (
            <Card key={ex.exercise_id + idx} style={styles.suggestedCard}>
              <View style={styles.rowBetween}>
                <Text style={typography.h3}>{ex.name}</Text>
                <Text style={styles.badgeText}>
                  {ex.target_sets} sets × {ex.target_reps} reps
                </Text>
              </View>
              {ex.target_weight_kg != null && (
                <Text style={typography.bodyMuted}>
                  Target: {displayWeight(ex.target_weight_kg, effectiveUnit).toFixed(1)} {effectiveUnit}
                </Text>
              )}
              <Text style={typography.caption}>Rest: {ex.rest_seconds}s</Text>
              {ex.reason ? (
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonText}>💡 {ex.reason}</Text>
                </View>
              ) : null}
            </Card>
          );
        })}

        <View style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
          <SectionTitle>Current</SectionTitle>
          <Text style={typography.caption}>Original routine targets</Text>
        </View>

        {originalExercises.map((re, idx) => {
          const effectiveUnit = re.weight_unit ?? unit;
          return (
            <Card key={re.id ?? idx} style={styles.currentCard}>
              <View style={styles.rowBetween}>
                <Text style={[typography.body, { fontWeight: '600' }]}>
                  {re.exercise?.name ?? 'Exercise'}
                </Text>
                <Text style={typography.bodyMuted}>
                  {re.target_sets} sets × {re.target_reps} reps
                </Text>
              </View>
              {re.target_weight_kg != null && (
                <Text style={typography.caption}>
                  Target: {displayWeight(re.target_weight_kg, effectiveUnit).toFixed(1)} {effectiveUnit}
                </Text>
              )}
            </Card>
          );
        })}

        <RecommendationDisclaimer />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.buttonStack}>
          <Button
            title="Approve change"
            onPress={handleApprove}
            loading={acting}
          />
          <View style={{ marginTop: spacing.sm }}>
            <Button
              title="Keep current"
              variant="secondary"
              onPress={handleKeepCurrent}
              disabled={acting}
            />
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  coachCard: {
    marginTop: spacing.md,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  sectionHeader: { marginTop: spacing.md, marginBottom: spacing.xs },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  suggestedCard: {
    marginTop: spacing.sm,
    borderColor: colors.accent,
    borderWidth: 1,
  },
  badgeText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.accent,
  },
  reasonBox: {
    marginTop: spacing.sm,
    padding: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
  },
  reasonText: {
    ...typography.caption,
    color: colors.text,
  },
  currentCard: {
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    opacity: 0.8,
  },
  safetyCard: {
    marginTop: spacing.lg,
    borderColor: colors.danger,
    borderWidth: 2,
    backgroundColor: '#261214',
    padding: spacing.lg,
  },
  safetyTitle: {
    ...typography.h1,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  safetyBody: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  emergencyBox: {
    backgroundColor: '#3E181B',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  emergencyText: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFA3A3',
    textAlign: 'center',
  },
  buttonStack: {
    marginTop: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
