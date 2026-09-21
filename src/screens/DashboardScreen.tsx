import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Label, ScreenContainer } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { fetchTodayCheckIn } from '../lib/adaptationApi';
import { fetchActiveCoachPlan } from '../lib/coachApi';
import { supabase } from '../lib/supabase';
import { displayLength, formatWeight } from '../lib/units';
import { colors, radii, spacing, typography } from '../theme/theme';
import { BodyMeasurement, CoachPlan, DailyCheckIn, Goals, WeightLog } from '../types/db';

function startOfWeekISO(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function DashboardScreen() {
  const { session, profile } = useAuth();
  const unit = profile?.weight_unit ?? 'kg';
  const lengthUnit = profile?.length_unit ?? 'cm';
  const [latestWeight, setLatestWeight] = useState<WeightLog | null>(null);
  const [latestMeasurement, setLatestMeasurement] = useState<BodyMeasurement | null>(null);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [workoutsThisWeek, setWorkoutsThisWeek] = useState(0);
  const [caloriesToday, setCaloriesToday] = useState(0);
  const [coachPlan, setCoachPlan] = useState<CoachPlan | null>(null);
  const [todayCheckIn, setTodayCheckIn] = useState<DailyCheckIn | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const [
      { data: weightData },
      { data: goalsData },
      { count },
      { data: foodData },
      { data: mData },
      checkInRes,
    ] = await Promise.all([
      supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .order('logged_at', { ascending: false })
        .limit(1),
      supabase.from('goals').select('*').eq('user_id', session.user.id).maybeSingle(),
      supabase
        .from('workouts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .not('completed_at', 'is', null)
        .gte('started_at', startOfWeekISO()),
      supabase.from('food_logs').select('calories').eq('user_id', session.user.id).eq('logged_at', todayString()),
      supabase
        .from('body_measurements')
        .select('*')
        .eq('user_id', session.user.id)
        .order('logged_at', { ascending: false })
        .limit(1),
      fetchTodayCheckIn(session.user.id).catch(() => null),
    ]);

    setLatestWeight(weightData?.[0] ?? null);
    setGoals(goalsData ?? null);
    setWorkoutsThisWeek(count ?? 0);
    setCaloriesToday((foodData ?? []).reduce((sum, f) => sum + f.calories, 0));
    setLatestMeasurement(mData?.[0] ?? null);
    setTodayCheckIn(checkInRes ?? null);

    try {
      const plan = await fetchActiveCoachPlan();
      setCoachPlan((plan as CoachPlan) ?? null);
    } catch {
      setCoachPlan(null);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const displayGreeting = profile?.display_name ? `Hey, ${profile.display_name}` : 'Welcome back';
  const coaching = coachPlan?.coaching_copy;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.h1}>{displayGreeting}</Text>
        <Text style={typography.bodyMuted}>Here is your progress at a glance.</Text>

        {coaching?.weekly_coaching ? (
          <Card style={styles.coachCard}>
            <Label>Coach</Label>
            <Text style={typography.body}>{coaching.weekly_coaching}</Text>
            {coaching.training_tips?.[0] ? (
              <Text style={[typography.caption, styles.coachTip]}>{coaching.training_tips[0]}</Text>
            ) : null}
            {coaching.nutrition_tips?.[0] ? (
              <Text style={typography.caption}>{coaching.nutrition_tips[0]}</Text>
            ) : null}
          </Card>
        ) : null}

        {todayCheckIn && (
          <Card
            style={[
              styles.readinessCard,
              todayCheckIn.pain_or_new_injury && styles.safetyReadinessCard,
            ]}
          >
            <Label>Today's Readiness</Label>
            {todayCheckIn.pain_or_new_injury ? (
              <Text style={[typography.body, { color: colors.danger, fontWeight: '600' }]}>
                ⚠️ Safety hold active (pain or injury flagged)
              </Text>
            ) : (
              <Text style={typography.body}>
                Soreness: {todayCheckIn.overall_soreness}/4 • Energy: {todayCheckIn.energy}/5 • Tiredness: {todayCheckIn.tiredness}/5
              </Text>
            )}
            {todayCheckIn.recovery_note && (
              <Text style={typography.caption}>Note: {todayCheckIn.recovery_note}</Text>
            )}
          </Card>
        )}

        <View style={styles.grid}>
          <Card style={styles.gridCard}>
            <Label>Current weight</Label>
            <Text style={typography.stat}>{latestWeight ? formatWeight(latestWeight.weight_kg, unit) : '-'}</Text>
            {goals?.target_weight_kg != null && (
              <Text style={typography.caption}>Target: {formatWeight(goals.target_weight_kg, unit)}</Text>
            )}
          </Card>

          <Card style={styles.gridCard}>
            <Label>Body composition</Label>
            <Text style={typography.stat}>
              {latestMeasurement?.body_fat_pct != null ? `${latestMeasurement.body_fat_pct}%` : '-'}
            </Text>
            {latestMeasurement?.waist_cm != null && (
              <Text style={typography.caption}>
                Waist: {displayLength(latestMeasurement.waist_cm, lengthUnit).toFixed(1)} {lengthUnit}
              </Text>
            )}
          </Card>

          <Card style={styles.gridCard}>
            <Label>Workouts this week</Label>
            <Text style={typography.stat}>
              {workoutsThisWeek}
              <Text style={typography.bodyMuted}>/{goals?.weekly_workout_target ?? 3}</Text>
            </Text>
            {goals?.primary_goal_type && (
              <Text style={typography.caption}>Goal: {goals.primary_goal_type.replace('_', ' ')}</Text>
            )}
          </Card>

          <Card style={styles.gridCard}>
            <Label>Calories today</Label>
            <Text style={typography.stat}>{Math.round(caloriesToday)}</Text>
            {goals?.daily_calorie_target != null && (
              <Text style={typography.caption}>Target: {Math.round(goals.daily_calorie_target)} kcal</Text>
            )}
          </Card>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  coachCard: { marginTop: spacing.md, borderColor: colors.primary },
  coachTip: { marginTop: spacing.sm },
  readinessCard: {
    marginTop: spacing.md,
    borderColor: colors.accent,
    backgroundColor: colors.surfaceAlt,
  },
  safetyReadinessCard: {
    borderColor: colors.danger,
    backgroundColor: '#261214',
  },
  grid: { marginTop: spacing.lg },
  gridCard: { marginBottom: spacing.md },
});
