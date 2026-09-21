import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Label, ScreenContainer, TextInput } from '../components/ui';
import GlossaryTip from '../components/GlossaryTip';
import { useAuth } from '../hooks/useAuth';
import { GOAL_OPTIONS, EQUIPMENT_OPTIONS, EQUIPMENT_HINT, goalExplanation } from '../lib/goalExplanations';
import { buildNutritionPlanFromGoals } from '../lib/nutritionPlan';
import { supabase } from '../lib/supabase';
import { toStorageLengthCm, toStorageWeightKg } from '../lib/units';
import { colors, radii, spacing, typography } from '../theme/theme';
import {
  EquipmentPref,
  ExperienceLevel,
  Gender,
  LengthUnit,
  PrimaryGoalType,
  WeightUnit,
} from '../types/db';

const STEPS = ['Welcome', 'You', 'Weight', 'Goals', 'Ready'] as const;

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'other', label: 'Other / prefer not to say' },
];

const EXPERIENCE: { id: ExperienceLevel; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

const DAYS = [2, 3, 4, 5, 6];

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(profile?.weight_unit ?? 'kg');
  const [lengthUnit, setLengthUnit] = useState<LengthUnit>(profile?.length_unit ?? 'cm');
  const [age, setAge] = useState(profile?.age != null ? String(profile.age) : '');
  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);
  const [height, setHeight] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoalType>('general');
  const [experience, setExperience] = useState<ExperienceLevel>('beginner');
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [equipment, setEquipment] = useState<EquipmentPref>('full_gym');

  const parsedAge = useMemo(() => {
    const n = parseInt(age, 10);
    return Number.isNaN(n) ? null : Math.min(100, Math.max(13, n));
  }, [age]);

  const parsedHeightCm = useMemo(() => {
    const n = parseFloat(height);
    if (Number.isNaN(n)) return null;
    const cm = toStorageLengthCm(n, lengthUnit);
    if (cm < 100 || cm > 250) return null;
    return cm;
  }, [height, lengthUnit]);

  const parsedWeightKg = useMemo(() => {
    const n = parseFloat(currentWeight);
    return Number.isNaN(n) || n <= 0 ? null : toStorageWeightKg(n, weightUnit);
  }, [currentWeight, weightUnit]);

  const parsedTargetKg = useMemo(() => {
    const n = parseFloat(targetWeight);
    return Number.isNaN(n) || n <= 0 ? null : toStorageWeightKg(n, weightUnit);
  }, [targetWeight, weightUnit]);

  const markComplete = async (fullSetup: boolean) => {
    if (!session) return;
    setSaving(true);
    setError(null);
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const userId = session.user.id;

    try {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        display_name: displayName.trim() || profile?.display_name || null,
        weight_unit: weightUnit,
        length_unit: lengthUnit,
        age: fullSetup ? parsedAge : profile?.age ?? null,
        gender: fullSetup ? gender : profile?.gender ?? null,
        height_cm: fullSetup ? parsedHeightCm : profile?.height_cm ?? null,
        onboarding_completed_at: now,
      });
      if (profileError) throw profileError;

      if (fullSetup) {
        if (parsedWeightKg != null) {
          const { error: weightError } = await supabase.from('weight_logs').upsert(
            {
              user_id: userId,
              weight_kg: parsedWeightKg,
              logged_at: today,
            },
            { onConflict: 'user_id,logged_at' }
          );
          if (weightError) throw weightError;
        }

        const draft = buildNutritionPlanFromGoals({
          goals: {
            user_id: userId,
            target_weight_kg: parsedTargetKg,
            weekly_workout_target: daysPerWeek,
            daily_calorie_target: null,
            daily_protein_target_g: null,
            daily_carbs_target_g: null,
            daily_fat_target_g: null,
            primary_goal_type: primaryGoal,
            experience,
            days_per_week: daysPerWeek,
            equipment_pref: equipment,
            session_minutes: 60,
            injury_notes: null,
            updated_at: now,
          },
          weightKg: parsedWeightKg ?? parsedTargetKg,
          age: parsedAge,
          gender,
          heightCm: parsedHeightCm,
        });

        const { error: goalsError } = await supabase.from('goals').upsert({
          user_id: userId,
          target_weight_kg: parsedTargetKg,
          weekly_workout_target: daysPerWeek,
          daily_calorie_target: draft.daily_calorie_target,
          daily_protein_target_g: draft.daily_protein_g,
          daily_carbs_target_g: draft.daily_carbs_g,
          daily_fat_target_g: draft.daily_fat_g,
          primary_goal_type: primaryGoal,
          experience,
          days_per_week: daysPerWeek,
          equipment_pref: equipment,
          session_minutes: 60,
          injury_notes: null,
          updated_at: now,
        });
        if (goalsError) throw goalsError;

        // Update or create Main gym profile from chosen onboarding equipment preset
        const { data: existingMain } = await supabase
          .from('gym_profiles')
          .select('id')
          .eq('user_id', userId)
          .eq('is_main', true)
          .is('archived_at', null)
          .maybeSingle();

        if (existingMain) {
          await supabase
            .from('gym_profiles')
            .update({ base_preset: equipment })
            .eq('id', existingMain.id);
        } else {
          const { data: newMain } = await supabase
            .from('gym_profiles')
            .insert({
              user_id: userId,
              name: 'Main gym',
              base_preset: equipment,
              kind: 'permanent',
              is_main: true,
            })
            .select()
            .single();

          if (newMain) {
            await supabase
              .from('profiles')
              .update({ active_gym_profile_id: newMain.id })
              .eq('id', userId);
          }
        }

        const { error: planError } = await supabase.from('nutrition_plans').upsert({
          user_id: userId,
          ...draft,
          preferences: {},
          meal_menu: null,
          updated_at: now,
        });
        if (planError) throw planError;
      }

      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your setup.');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.kicker}>Getting started</Text>
        <View style={styles.dots}>
          {STEPS.map((label, i) => (
            <View key={label} style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]} />
          ))}
        </View>
        <Text style={styles.stepLabel}>
          Step {step + 1} of {STEPS.length}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <View>
            <Text style={styles.title}>Welcome to FitTrack</Text>
            <Text style={styles.lede}>
              A few quick questions set up your profile, goals, and a starting nutrition plan. You can change anything later.
            </Text>
            <Card style={styles.card}>
              <Text style={styles.tourItem}>Dashboard — today&apos;s snapshot of weight, workouts, and food</Text>
              <Text style={styles.tourItem}>Weight — log weigh-ins and see the trend</Text>
              <Text style={styles.tourItem}>Workouts — routines, sets, and a coach when you want a plan</Text>
              <Text style={styles.tourItem}>Nutrition — log meals against daily targets</Text>
              <Text style={styles.tourItem}>Goals — the targets this wizard starts for you</Text>
            </Card>
          </View>
        )}

        {step === 1 && (
          <View>
            <Text style={styles.title}>About you</Text>
            <View style={styles.ledeRow}>
              <Text style={styles.ledeText}>
                Age and gender help estimate how much energy your body uses each day. Skip any field you would rather fill in later.
              </Text>
              <GlossaryTip term="calorie_estimate" />
            </View>

            <View style={styles.field}>
              <Label>Display name</Label>
              <TextInput value={displayName} onChangeText={setDisplayName} placeholder="What should we call you?" />
            </View>

            <View style={styles.field}>
              <Label>Units</Label>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button
                    title="kg / cm"
                    variant={weightUnit === 'kg' ? 'primary' : 'secondary'}
                    onPress={() => {
                      setWeightUnit('kg');
                      setLengthUnit('cm');
                    }}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    title="lb / in"
                    variant={weightUnit === 'lb' ? 'primary' : 'secondary'}
                    onPress={() => {
                      setWeightUnit('lb');
                      setLengthUnit('in');
                    }}
                  />
                </View>
              </View>
            </View>

            <View style={styles.field}>
              <Label>Age</Label>
              <TextInput
                keyboardType="number-pad"
                value={age}
                onChangeText={setAge}
                placeholder="13–100"
              />
            </View>

            <View style={styles.field}>
              <Label>Gender</Label>
              <View style={styles.wrap}>
                {GENDERS.map((g) => (
                  <Chip key={g.id} label={g.label} active={gender === g.id} onPress={() => setGender(g.id)} />
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Label>Height ({lengthUnit})</Label>
              <TextInput
                keyboardType="decimal-pad"
                value={height}
                onChangeText={setHeight}
                placeholder={lengthUnit === 'cm' ? 'e.g. 175' : 'e.g. 69'}
              />
              {height.length > 0 && parsedHeightCm == null && (
                <Text style={styles.hint}>Height should be between 100–250 cm (about 39–98 in).</Text>
              )}
            </View>
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.title}>Starting weight</Text>
            <Text style={styles.lede}>
              Optional. Logging today&apos;s weight gives the dashboard and nutrition plan a baseline.
            </Text>
            <View style={styles.field}>
              <Label>Current weight ({weightUnit})</Label>
              <TextInput
                keyboardType="decimal-pad"
                value={currentWeight}
                onChangeText={setCurrentWeight}
                placeholder={weightUnit === 'kg' ? 'e.g. 80' : 'e.g. 176'}
              />
            </View>
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={styles.title}>Your goals</Text>
            <Text style={styles.lede}>This drives workout suggestions and a starting calorie target.</Text>

            <View style={styles.field}>
              <Label>Primary goal</Label>
              <View style={styles.wrap}>
                {GOAL_OPTIONS.map((g) => (
                  <Chip
                    key={g.id}
                    label={g.label}
                    active={primaryGoal === g.id}
                    onPress={() => setPrimaryGoal(g.id)}
                  />
                ))}
              </View>
              <View style={styles.explainRow}>
                <Text style={styles.explain}>{goalExplanation(primaryGoal)}</Text>
                <GlossaryTip term={primaryGoal} />
              </View>
            </View>

            <View style={styles.field}>
              <Label>Experience</Label>
              <View style={styles.wrap}>
                {EXPERIENCE.map((e) => (
                  <Chip
                    key={e.id}
                    label={e.label}
                    active={experience === e.id}
                    onPress={() => setExperience(e.id)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Label>Days per week</Label>
              <View style={styles.wrap}>
                {DAYS.map((d) => (
                  <Chip key={d} label={String(d)} active={daysPerWeek === d} onPress={() => setDaysPerWeek(d)} />
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Label>Equipment</Label>
              <View style={styles.wrap}>
                {EQUIPMENT_OPTIONS.map((e) => (
                  <Chip
                    key={e.id}
                    label={e.label}
                    active={equipment === e.id}
                    onPress={() => setEquipment(e.id)}
                  />
                ))}
              </View>
              <Text style={styles.hint}>{EQUIPMENT_HINT}</Text>
            </View>

            <View style={styles.field}>
              <Label>Target weight ({weightUnit}) — optional</Label>
              <TextInput
                keyboardType="decimal-pad"
                value={targetWeight}
                onChangeText={setTargetWeight}
                placeholder="Leave blank if you are not aiming at a number"
              />
            </View>
          </View>
        )}

        {step === 4 && (
          <View>
            <Text style={styles.title}>You are ready</Text>
            <Text style={styles.lede}>
              We will save this profile, set your goals, and start a nutrition plan you can edit anytime.
            </Text>
            <Card style={styles.card}>
              <Text style={styles.summaryLine}>{displayName.trim() || 'No display name yet'}</Text>
              <Text style={styles.summaryMuted}>
                {GOAL_OPTIONS.find((g) => g.id === primaryGoal)?.label} · {daysPerWeek} days/week ·{' '}
                {EQUIPMENT_OPTIONS.find((e) => e.id === equipment)?.label}
              </Text>
              {parsedWeightKg != null && (
                <Text style={styles.summaryMuted}>
                  Starting weight logged in {weightUnit}
                </Text>
              )}
              <Text style={styles.summaryMuted}>Change any of this later in Goals or Settings.</Text>
            </Card>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        {step === 0 ? (
          <>
            <Button title="Get started" onPress={next} />
            <Button title="Skip setup" variant="ghost" onPress={() => markComplete(false)} loading={saving} />
          </>
        ) : (
          <>
            {step < STEPS.length - 1 ? (
              <Button title="Continue" onPress={next} />
            ) : (
              <Button title="Enter FitTrack" onPress={() => markComplete(true)} loading={saving} />
            )}
            <Button title="Back" variant="ghost" onPress={back} disabled={saving} />
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.sm, paddingBottom: spacing.md },
  kicker: { ...typography.caption, textTransform: 'uppercase', letterSpacing: 1 },
  dots: { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.primary, width: 18 },
  dotDone: { backgroundColor: colors.accent },
  stepLabel: { ...typography.caption, marginTop: spacing.xs },
  content: { paddingBottom: spacing.lg, flexGrow: 1 },
  title: { ...typography.h1, marginBottom: spacing.sm },
  lede: { ...typography.bodyMuted, marginBottom: spacing.lg, lineHeight: 20 },
  ledeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg, gap: spacing.xs },
  ledeText: { ...typography.bodyMuted, flex: 1, lineHeight: 20 },
  card: { gap: spacing.sm },
  tourItem: { ...typography.body, lineHeight: 22 },
  field: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
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
  chipText: { color: colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: colors.background },
  explainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, gap: spacing.xs },
  explain: { ...typography.bodyMuted, flex: 1, lineHeight: 20 },
  hint: { color: colors.warning, marginTop: spacing.xs },
  summaryLine: { ...typography.h3 },
  summaryMuted: { ...typography.bodyMuted, lineHeight: 20 },
  error: { color: colors.danger, marginTop: spacing.md, textAlign: 'center' },
  footer: { paddingVertical: spacing.md, gap: spacing.sm },
});
