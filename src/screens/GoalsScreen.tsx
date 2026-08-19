import { NavigationProp, useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Label, ScreenContainer, SectionTitle, TextInput } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { goalExplanation } from '../lib/goalExplanations';
import { suggestGoals } from '../lib/goalSuggestions';
import { supabase } from '../lib/supabase';
import { displayWeight, toStorageWeightKg } from '../lib/units';
import { MainTabParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';
import {
  BodyMeasurement,
  EquipmentPref,
  ExperienceLevel,
  Goals,
  PrimaryGoalType,
  WeightLog,
} from '../types/db';

const GOALS: PrimaryGoalType[] = ['fat_loss', 'muscle_gain', 'recomp', 'strength', 'general'];
const EXPERIENCE: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
const EQUIPMENT: EquipmentPref[] = ['full_gym', 'dumbbells', 'bodyweight', 'mixed'];

export default function GoalsScreen() {
  const navigation = useNavigation<NavigationProp<MainTabParamList>>();
  const { session, profile } = useAuth();
  const unit = profile?.weight_unit ?? 'kg';
  const [goals, setGoals] = useState<Goals | null>(null);
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [measurement, setMeasurement] = useState<BodyMeasurement | null>(null);
  const [targetWeight, setTargetWeight] = useState('');
  const [weeklyWorkouts, setWeeklyWorkouts] = useState('3');
  const [calorieTarget, setCalorieTarget] = useState('');
  const [proteinTarget, setProteinTarget] = useState('');
  const [carbsTarget, setCarbsTarget] = useState('');
  const [fatTarget, setFatTarget] = useState('');
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoalType>('general');
  const [experience, setExperience] = useState<ExperienceLevel>('beginner');
  const [daysPerWeek, setDaysPerWeek] = useState('3');
  const [equipment, setEquipment] = useState<EquipmentPref>('full_gym');
  const [sessionMinutes, setSessionMinutes] = useState('60');
  const [injuryNotes, setInjuryNotes] = useState('');
  const [suggestionNote, setSuggestionNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const [{ data: goalsData }, { data: weightData }, { data: mData }] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', session.user.id).maybeSingle(),
        supabase
          .from('weight_logs')
          .select('*')
          .eq('user_id', session.user.id)
          .order('logged_at', { ascending: false })
          .limit(7),
        supabase
          .from('body_measurements')
          .select('*')
          .eq('user_id', session.user.id)
          .order('logged_at', { ascending: false })
          .limit(1),
      ]);
      setGoals(goalsData ?? null);
      setWeights(weightData ?? []);
      setMeasurement(mData?.[0] ?? null);
      if (goalsData) {
        if (goalsData.target_weight_kg) setTargetWeight(displayWeight(goalsData.target_weight_kg, unit).toFixed(1));
        setWeeklyWorkouts(String(goalsData.weekly_workout_target ?? 3));
        setCalorieTarget(goalsData.daily_calorie_target ? String(Math.round(goalsData.daily_calorie_target)) : '');
        setProteinTarget(goalsData.daily_protein_target_g ? String(Math.round(goalsData.daily_protein_target_g)) : '');
        setCarbsTarget(goalsData.daily_carbs_target_g ? String(Math.round(goalsData.daily_carbs_target_g)) : '');
        setFatTarget(goalsData.daily_fat_target_g ? String(Math.round(goalsData.daily_fat_target_g)) : '');
        if (goalsData.primary_goal_type) setPrimaryGoal(goalsData.primary_goal_type);
        if (goalsData.experience) setExperience(goalsData.experience);
        if (goalsData.days_per_week) setDaysPerWeek(String(goalsData.days_per_week));
        if (goalsData.equipment_pref) setEquipment(goalsData.equipment_pref);
        if (goalsData.session_minutes) setSessionMinutes(String(goalsData.session_minutes));
        if (goalsData.injury_notes) setInjuryNotes(goalsData.injury_notes);
      }
    })();
  }, [session, unit]);

  const applySuggestion = () => {
    const s = suggestGoals({
      current: goals,
      latestWeightKg: weights[0]?.weight_kg,
      recentWeights: [...weights].reverse(),
      latestMeasurement: measurement,
      age: profile?.age,
      gender: profile?.gender,
      heightCm: profile?.height_cm,
    });
    setPrimaryGoal(s.primary_goal_type);
    setWeeklyWorkouts(String(s.weekly_workout_target));
    setDaysPerWeek(String(s.days_per_week));
    if (s.target_weight_kg != null) setTargetWeight(displayWeight(s.target_weight_kg, unit).toFixed(1));
    if (s.daily_calorie_target != null) setCalorieTarget(String(s.daily_calorie_target));
    if (s.daily_protein_target_g != null) setProteinTarget(String(s.daily_protein_target_g));
    if (s.daily_carbs_target_g != null) setCarbsTarget(String(s.daily_carbs_target_g));
    if (s.daily_fat_target_g != null) setFatTarget(String(s.daily_fat_target_g));
    setSuggestionNote(`${s.rationale} ${s.disclaimer}`);
  };

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    setSavedMessage(null);
    const parsedTargetWeight = parseFloat(targetWeight);
    const calorie = calorieTarget ? parseFloat(calorieTarget) : null;
    const protein = proteinTarget ? parseFloat(proteinTarget) : null;
    const carbs = carbsTarget ? parseFloat(carbsTarget) : null;
    const fat = fatTarget ? parseFloat(fatTarget) : null;

    await supabase.from('goals').upsert({
      user_id: session.user.id,
      target_weight_kg: Number.isNaN(parsedTargetWeight) ? null : toStorageWeightKg(parsedTargetWeight, unit),
      weekly_workout_target: parseInt(weeklyWorkouts, 10) || 3,
      daily_calorie_target: calorie,
      daily_protein_target_g: protein,
      daily_carbs_target_g: carbs,
      daily_fat_target_g: fat,
      primary_goal_type: primaryGoal,
      experience,
      days_per_week: parseInt(daysPerWeek, 10) || 3,
      equipment_pref: equipment,
      session_minutes: parseInt(sessionMinutes, 10) || 60,
      injury_notes: injuryNotes || null,
      updated_at: new Date().toISOString(),
    });

    // Keep existing nutrition plan macros in sync when edited from Goals.
    const { data: existingPlan } = await supabase
      .from('nutrition_plans')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (existingPlan) {
      await supabase
        .from('nutrition_plans')
        .update({
          daily_calorie_target: calorie,
          daily_protein_g: protein,
          daily_carbs_g: carbs,
          daily_fat_g: fat,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', session.user.id);
    }

    setSaving(false);
    setSavedMessage('Goals saved.');
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.h1}>Goals</Text>

        <Card style={styles.card}>
          <SectionTitle>Suggestions from metrics</SectionTitle>
          <Text style={typography.bodyMuted}>Uses recent weight, body composition, and your age/gender from Settings when available.</Text>
          <View style={styles.field}>
            <Button title="Suggest targets" variant="secondary" onPress={applySuggestion} />
          </View>
          {suggestionNote && <Text style={styles.suggestNote}>{suggestionNote}</Text>}
        </Card>

        <Card style={styles.card}>
          <SectionTitle>Primary goal</SectionTitle>
          <View style={styles.wrap}>
            {GOALS.map((g) => (
              <Pressable key={g} onPress={() => setPrimaryGoal(g)} style={[styles.chip, primaryGoal === g && styles.chipActive]}>
                <Text style={[styles.chipText, primaryGoal === g && styles.chipTextActive]}>{g.replace('_', ' ')}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.goalExplain}>{goalExplanation(primaryGoal)}</Text>
        </Card>

        <Card style={styles.card}>
          <SectionTitle>Training profile</SectionTitle>
          <Label>Experience</Label>
          <View style={styles.wrap}>
            {EXPERIENCE.map((e) => (
              <Pressable key={e} onPress={() => setExperience(e)} style={[styles.chip, experience === e && styles.chipActive]}>
                <Text style={[styles.chipText, experience === e && styles.chipTextActive]}>{e}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.field}>
            <Label>Days per week</Label>
            <TextInput keyboardType="number-pad" value={daysPerWeek} onChangeText={setDaysPerWeek} />
          </View>
          <View style={styles.field}>
            <Label>Session minutes</Label>
            <TextInput keyboardType="number-pad" value={sessionMinutes} onChangeText={setSessionMinutes} />
          </View>
          <Label>Equipment</Label>
          <View style={styles.wrap}>
            {EQUIPMENT.map((e) => (
              <Pressable key={e} onPress={() => setEquipment(e)} style={[styles.chip, equipment === e && styles.chipActive]}>
                <Text style={[styles.chipText, equipment === e && styles.chipTextActive]}>{e.replace('_', ' ')}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.field}>
            <Label>Injuries / notes</Label>
            <TextInput value={injuryNotes} onChangeText={setInjuryNotes} placeholder="Optional" />
          </View>
        </Card>

        <Card style={styles.card}>
          <SectionTitle>Weight & Training</SectionTitle>
          <View style={styles.field}>
            <Label>Target weight ({unit})</Label>
            <TextInput keyboardType="decimal-pad" value={targetWeight} onChangeText={setTargetWeight} />
          </View>
          <View style={styles.field}>
            <Label>Weekly workout target</Label>
            <TextInput keyboardType="number-pad" value={weeklyWorkouts} onChangeText={setWeeklyWorkouts} />
          </View>
        </Card>

        <Card style={styles.card}>
          <SectionTitle>Supporting nutrition plan</SectionTitle>
          <Text style={typography.bodyMuted}>
            Full plan with meal splits, fiber, water, and every parameter editable. Saves sync back to these daily targets.
          </Text>
          <View style={styles.field}>
            <Button
              title="Open nutrition plan"
              variant="secondary"
              onPress={() => navigation.navigate('Nutrition', { screen: 'NutritionPlan' })}
            />
          </View>
        </Card>
        <Card style={styles.card}>
          <SectionTitle>Daily Nutrition</SectionTitle>
          <View style={styles.field}>
            <Label>Calories (kcal)</Label>
            <TextInput keyboardType="number-pad" value={calorieTarget} onChangeText={setCalorieTarget} />
          </View>
          <View style={styles.row}>
            <View style={styles.smallField}>
              <Label>Protein (g)</Label>
              <TextInput keyboardType="number-pad" value={proteinTarget} onChangeText={setProteinTarget} />
            </View>
            <View style={styles.smallField}>
              <Label>Carbs (g)</Label>
              <TextInput keyboardType="number-pad" value={carbsTarget} onChangeText={setCarbsTarget} />
            </View>
            <View style={styles.smallField}>
              <Label>Fat (g)</Label>
              <TextInput keyboardType="number-pad" value={fatTarget} onChangeText={setFatTarget} />
            </View>
          </View>
        </Card>

        {savedMessage && <Text style={styles.savedMessage}>{savedMessage}</Text>}
        <Button title="Save goals" onPress={handleSave} loading={saving} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  card: { marginTop: spacing.md },
  field: { marginTop: spacing.sm },
  row: { flexDirection: 'row', marginTop: spacing.sm },
  smallField: { flex: 1, marginRight: spacing.sm },
  savedMessage: { color: colors.accent, textAlign: 'center', marginBottom: spacing.sm },
  suggestNote: { ...typography.bodyMuted, marginTop: spacing.sm },
  goalExplain: { ...typography.bodyMuted, marginTop: spacing.md, lineHeight: 20 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: colors.background },
});