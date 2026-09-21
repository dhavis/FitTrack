import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ActiveGymSwitcher from '../components/ActiveGymSwitcher';
import { Button, Card, Label, ScreenContainer, SectionTitle, TextInput } from '../components/ui';
import GlossaryTip from '../components/GlossaryTip';
import { useAuth } from '../hooks/useAuth';
import { invokeCoachGenerate } from '../lib/coachApi';
import {
  goalExplanation,
  goalLabel,
} from '../lib/goalExplanations';
import { makeGymProfileSnapshot, resolveActiveGymProfile } from '../lib/gymProfiles';
import { generateTrainingProgram } from '../lib/programGenerator';
import { buildNutritionPlanFromGoals } from '../lib/nutritionPlan';
import { generateMenu } from '../lib/menuGenerator';
import { DEFAULT_PREFERENCES, NutritionPreferences } from '../lib/nutritionPreferences';
import { supabase } from '../lib/supabase';
import { WorkoutsStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';
import {
  EquipmentPref,
  ExperienceLevel,
  PrimaryGoalType,
  ResolvedGymProfile,
} from '../types/db';

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'GeneratePlan'>;

const GOALS: PrimaryGoalType[] = ['fat_loss', 'muscle_gain', 'recomp', 'strength', 'general'];
const EXPERIENCE: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];

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

async function localFallbackCoach(opts: {
  userId: string;
  goalType: PrimaryGoalType;
  experience: ExperienceLevel;
  daysPerWeek: number;
  equipment: EquipmentPref;
  sessionMinutes: number;
  injuryNotes: string | null;
  activeGym?: ResolvedGymProfile | null;
  age?: number | null;
  gender?: 'male' | 'female' | 'other' | null;
  heightCm?: number | null;
}) {
  const gymSnapshot = opts.activeGym ? makeGymProfileSnapshot(opts.activeGym) : null;

  const program = await generateTrainingProgram({
    userId: opts.userId,
    goalType: opts.goalType,
    experience: opts.experience,
    daysPerWeek: opts.daysPerWeek,
    equipment: opts.equipment,
    sessionMinutes: opts.sessionMinutes,
    injuryNotes: opts.injuryNotes,
    gymProfileId: opts.activeGym?.profile.id ?? null,
    gymProfileSnapshot: gymSnapshot,
    gymPolicy: opts.activeGym
      ? {
          base_preset: opts.activeGym.profile.base_preset,
          excluded_equipment: opts.activeGym.excluded_equipment,
          excluded_exercise_ids: opts.activeGym.excluded_exercise_ids,
        }
      : null,
  });

  const [{ data: goalsData }, { data: weightData }, { data: planData }, { data: profile }] = await Promise.all([
    supabase.from('goals').select('*').eq('user_id', opts.userId).maybeSingle(),
    supabase
      .from('weight_logs')
      .select('weight_kg')
      .eq('user_id', opts.userId)
      .order('logged_at', { ascending: false })
      .limit(1),
    supabase.from('nutrition_plans').select('preferences').eq('user_id', opts.userId).maybeSingle(),
    supabase.from('profiles').select('age,gender,height_cm').eq('id', opts.userId).maybeSingle(),
  ]);

  const draft = buildNutritionPlanFromGoals({
    goals: { ...(goalsData ?? {}), primary_goal_type: opts.goalType, days_per_week: opts.daysPerWeek } as any,
    weightKg: weightData?.[0]?.weight_kg ?? null,
    age: opts.age ?? profile?.age,
    gender: opts.gender ?? profile?.gender,
    heightCm: opts.heightCm ?? profile?.height_cm,
  });

  const prefs: NutritionPreferences = {
    ...DEFAULT_PREFERENCES,
    ...((planData?.preferences as NutritionPreferences) ?? {}),
  };
  const menu = generateMenu(prefs);

  await supabase.from('nutrition_plans').upsert({
    user_id: opts.userId,
    ...draft,
    preferences: prefs,
    meal_menu: menu,
    updated_at: new Date().toISOString(),
  });

  await supabase.from('goals').upsert({
    user_id: opts.userId,
    weekly_workout_target: opts.daysPerWeek,
    primary_goal_type: opts.goalType,
    experience: opts.experience,
    days_per_week: opts.daysPerWeek,
    equipment_pref: opts.equipment,
    session_minutes: opts.sessionMinutes,
    injury_notes: opts.injuryNotes,
    daily_calorie_target: draft.daily_calorie_target,
    daily_protein_target_g: draft.daily_protein_g,
    daily_carbs_target_g: draft.daily_carbs_g,
    daily_fat_target_g: draft.daily_fat_g,
    updated_at: new Date().toISOString(),
  });

  return {
    coaching: {
      weekly_coaching: `Offline coach fallback: ${opts.goalType.replace('_', ' ')} training (${opts.daysPerWeek} days) synced with nutrition targets${
        draft.daily_calorie_target != null ? ` (~${draft.daily_calorie_target} kcal)` : ''
      }.`,
      training_tips: [`Program "${program.name}" created.`, 'Use Workouts tab to run routines.'],
      nutrition_tips: [
        draft.daily_protein_g != null ? `Protein target ~${draft.daily_protein_g}g.` : 'Set age/gender for better calories.',
        'Menu updated from your food preferences.',
      ],
      disclaimer: 'Educational estimate only — not medical advice. (Local fallback — deploy coach-generate for AI notes.)',
    },
    training: {
      program_id: program.id,
      program_name: program.name,
      routine_names: [],
    },
    nutrition: {
      daily_calorie_target: draft.daily_calorie_target,
      daily_protein_g: draft.daily_protein_g,
      daily_carbs_g: draft.daily_carbs_g,
      daily_fat_g: draft.daily_fat_g,
    },
    usedLlm: false,
  };
}

export default function GeneratePlanScreen({ navigation }: Props) {
  const { session, profile } = useAuth();
  const [goalType, setGoalType] = useState<PrimaryGoalType>('general');
  const [experience, setExperience] = useState<ExperienceLevel>('beginner');
  const [days, setDays] = useState('4');
  const [minutes, setMinutes] = useState('60');
  const [injuryNotes, setInjuryNotes] = useState('');
  const [activeGym, setActiveGym] = useState<ResolvedGymProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const loadActiveGym = useCallback(async () => {
    try {
      const resolved = await resolveActiveGymProfile();
      setActiveGym(resolved);
    } catch {
      // Ignore background load error
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    loadActiveGym();
    (async () => {
      const { data } = await supabase.from('goals').select('*').eq('user_id', session.user.id).maybeSingle();
      if (data?.primary_goal_type) setGoalType(data.primary_goal_type);
      if (data?.experience) setExperience(data.experience);
      if (data?.days_per_week) setDays(String(data.days_per_week));
      if (data?.session_minutes) setMinutes(String(data.session_minutes));
      if (data?.injury_notes) setInjuryNotes(data.injury_notes);
    })();
  }, [session, loadActiveGym]);

  const handleGenerate = async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    const daysPerWeek = Math.min(Math.max(parseInt(days, 10) || 3, 2), 6);
    const sessionMinutes = parseInt(minutes, 10) || 60;
    const currentEquipment: EquipmentPref = activeGym?.profile.base_preset ?? 'full_gym';

    try {
      await supabase.from('goals').upsert({
        user_id: session.user.id,
        primary_goal_type: goalType,
        experience,
        days_per_week: daysPerWeek,
        equipment_pref: currentEquipment,
        session_minutes: sessionMinutes,
        injury_notes: injuryNotes || null,
        weekly_workout_target: daysPerWeek,
        updated_at: new Date().toISOString(),
      });

      try {
        const result = await invokeCoachGenerate({
          mode: 'full',
          goalType,
          experience,
          daysPerWeek,
          sessionMinutes,
          injuryNotes: injuryNotes || null,
        });
        setInfo('Coach plan ready.');
        navigation.navigate('CoachResult', {
          coaching: result.coaching!,
          training: result.training ?? null,
          nutrition: result.nutrition ?? null,
          usedLlm: Boolean(result.used_llm),
        });
      } catch (edgeErr: any) {
        setInfo('Cloud coach unavailable — using local fallback…');
        const fallback = await localFallbackCoach({
          userId: session.user.id,
          goalType,
          experience,
          daysPerWeek,
          equipment: currentEquipment,
          sessionMinutes,
          injuryNotes: injuryNotes || null,
          activeGym,
          age: profile?.age,
          gender: profile?.gender,
          heightCm: profile?.height_cm,
        });
        navigation.navigate('CoachResult', fallback);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to generate plan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.h1}>Generate coach plan</Text>
        <Text style={typography.bodyMuted}>
          Builds workouts and nutrition together from your goals, active gym equipment, and food preferences.
        </Text>

        <Card style={styles.card}>
          <SectionTitle>Primary goal</SectionTitle>
          <View style={styles.wrap}>
            {GOALS.map((g) => (
              <Chip key={g} label={goalLabel(g)} active={goalType === g} onPress={() => setGoalType(g)} />
            ))}
          </View>
          <View style={styles.goalExplainRow}>
            <Text style={styles.goalExplain}>{goalExplanation(goalType)}</Text>
            <GlossaryTip term={goalType} />
          </View>
        </Card>

        <Card style={styles.card}>
          <SectionTitle>Experience</SectionTitle>
          <View style={styles.wrap}>
            {EXPERIENCE.map((e) => (
              <Chip key={e} label={e} active={experience === e} onPress={() => setExperience(e)} />
            ))}
          </View>
        </Card>

        <Card style={styles.card}>
          <SectionTitle>Gym & Schedule</SectionTitle>
          <Label>Active Gym Profile</Label>
          <ActiveGymSwitcher
            onManageGyms={() => {
              navigation.getParent()?.navigate('Settings', { screen: 'GymProfiles' });
            }}
            onGymSwitched={(gym) => {
              loadActiveGym();
            }}
          />

          <View style={styles.field}>
            <Label>Days per week</Label>
            <TextInput keyboardType="number-pad" value={days} onChangeText={setDays} />
          </View>
          <View style={styles.field}>
            <Label>Session minutes</Label>
            <TextInput keyboardType="number-pad" value={minutes} onChangeText={setMinutes} />
          </View>
          <View style={styles.field}>
            <Label>Injuries / limits (optional)</Label>
            <TextInput value={injuryNotes} onChangeText={setInjuryNotes} placeholder="e.g. avoid overhead pressing" />
          </View>
        </Card>

        {error && <Text style={styles.error}>{error}</Text>}
        {info && <Text style={styles.info}>{info}</Text>}
        <Button title="Generate coach plan" onPress={handleGenerate} loading={loading} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  goalExplainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, gap: spacing.xs },
  goalExplain: { ...typography.bodyMuted, flex: 1, lineHeight: 20 },
  content: { paddingBottom: spacing.xl },
  card: { marginTop: spacing.md },
  field: { marginTop: spacing.sm, marginBottom: spacing.sm },
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
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.sm },
  error: { color: colors.danger, marginVertical: spacing.sm },
  info: { color: colors.accent, marginVertical: spacing.sm },
});