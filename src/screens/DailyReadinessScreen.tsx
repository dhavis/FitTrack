import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Button, Card, Label, ScreenContainer, SectionTitle, TextInput } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { fetchTodayCheckIn, invokeCoachAdapt, upsertDailyCheckIn } from '../lib/adaptationApi';
import { MUSCLE_GROUPS, MuscleGroup } from '../lib/muscles';
import { supabase } from '../lib/supabase';
import { WorkoutsStackParamList } from '../navigation/types';
import { colors, radii, spacing, typography } from '../theme/theme';
import { Routine } from '../types/db';

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'DailyReadiness'>;

const SORENESS_LEVELS = [
  { value: 0, label: '0 None' },
  { value: 1, label: '1 Mild' },
  { value: 2, label: '2 Mod' },
  { value: 3, label: '3 High' },
  { value: 4, label: '4 Severe' },
];

const TIREDNESS_LEVELS = [
  { value: 1, label: '1 Low' },
  { value: 2, label: '2 Mild' },
  { value: 3, label: '3 Mod' },
  { value: 4, label: '4 High' },
  { value: 5, label: '5 Drained' },
];

const ENERGY_LEVELS = [
  { value: 1, label: '1 Low' },
  { value: 2, label: '2 Fair' },
  { value: 3, label: '3 Good' },
  { value: 4, label: '4 Great' },
  { value: 5, label: '5 Peak' },
];

const MINUTE_PRESETS = [20, 30, 45, 60, 75, 90];

export default function DailyReadinessScreen({ route, navigation }: Props) {
  const { routineId } = route.params;
  const { session } = useAuth();

  const [routine, setRoutine] = useState<Routine | null>(null);
  const [overallSoreness, setOverallSoreness] = useState<number>(1);
  const [sorenessByMuscle, setSorenessByMuscle] = useState<Record<string, number>>({});
  const [tiredness, setTiredness] = useState<number>(2);
  const [energy, setEnergy] = useState<number>(4);
  const [availableMinutes, setAvailableMinutes] = useState<string>('60');
  const [painOrNewInjury, setPainOrNewInjury] = useState<boolean>(false);
  const [recoveryNote, setRecoveryNote] = useState<string>('');
  const [selectedMuscleForDetail, setSelectedMuscleForDetail] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        const [{ data: routineData }, checkInData] = await Promise.all([
          supabase.from('routines').select('*').eq('id', routineId).single(),
          fetchTodayCheckIn(session!.user.id),
        ]);

        if (isMounted) {
          if (routineData) setRoutine(routineData as Routine);
          if (checkInData) {
            setOverallSoreness(checkInData.overall_soreness);
            setSorenessByMuscle(checkInData.soreness_by_muscle ?? {});
            setTiredness(checkInData.tiredness);
            setEnergy(checkInData.energy);
            setAvailableMinutes(String(checkInData.available_minutes));
            setPainOrNewInjury(checkInData.pain_or_new_injury);
            setRecoveryNote(checkInData.recovery_note ?? '');
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message ?? 'Failed to load readiness data');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [routineId, session]);

  const toggleMuscleSoreness = (muscle: MuscleGroup) => {
    setSorenessByMuscle((prev) => {
      const current = prev[muscle] ?? 0;
      const next = current >= 3 ? 0 : current + 1;
      const updated = { ...prev };
      if (next === 0) {
        delete updated[muscle];
      } else {
        updated[muscle] = next;
      }
      return updated;
    });
  };

  const handleContinue = async () => {
    if (!session) return;
    setError(null);
    setSubmitting(true);

    const parsedMinutes = Math.min(Math.max(parseInt(availableMinutes, 10) || 60, 10), 180);

    try {
      // 1. Upsert today's check-in
      const checkIn = await upsertDailyCheckIn({
        userId: session.user.id,
        overallSoreness,
        sorenessByMuscle,
        tiredness,
        energy,
        availableMinutes: parsedMinutes,
        painOrNewInjury,
        recoveryNote: recoveryNote.trim() || null,
      });

      // 2. Invoke adaptation edge function / fallback
      const adaptRes = await invokeCoachAdapt(
        {
          check_in_id: checkIn.id,
          routine_id: routineId,
        },
        session.user.id
      );

      // 3. Navigate to adaptation review
      navigation.navigate('SessionAdaptationReview', {
        eventId: adaptRes.event_id,
      });
    } catch (err: any) {
      setError(err.message ?? 'Failed to adapt session');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[typography.bodyMuted, { marginTop: spacing.md }]}>
            Loading readiness check-in...
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.h1}>Daily Readiness</Text>
        <Text style={typography.bodyMuted}>
          {routine ? `Adapting "${routine.name}" based on today's state.` : 'How is your body feeling today?'}
        </Text>

        {/* Safety Alert Toggle */}
        <Card
          style={[
            styles.card,
            painOrNewInjury ? styles.safetyCardActive : styles.safetyCard,
          ]}
        >
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Text style={[typography.h3, painOrNewInjury && { color: colors.danger }]}>
                Pain or New Injury?
              </Text>
              <Text style={typography.caption}>
                Pause adaptation if experiencing acute pain or injury.
              </Text>
            </View>
            <Switch
              value={painOrNewInjury}
              onValueChange={setPainOrNewInjury}
              trackColor={{ false: colors.surfaceAlt, true: colors.danger }}
              thumbColor={colors.text}
            />
          </View>
          {painOrNewInjury && (
            <View style={styles.safetyNotice}>
              <Text style={styles.safetyNoticeText}>
                ⚠️ A safety hold will be placed. You will be advised to consult a physician before proceeding.
              </Text>
            </View>
          )}
        </Card>

        {/* Overall Soreness */}
        <Card style={styles.card}>
          <SectionTitle>Overall Muscle Soreness</SectionTitle>
          <View style={styles.chipsRow}>
            {SORENESS_LEVELS.map((item) => (
              <Pressable
                key={item.value}
                onPress={() => setOverallSoreness(item.value)}
                style={[
                  styles.scaleChip,
                  overallSoreness === item.value && styles.scaleChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.scaleChipText,
                    overallSoreness === item.value && styles.scaleChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Soreness By Muscle */}
        <Card style={styles.card}>
          <SectionTitle>Sore Muscle Groups (Optional)</SectionTitle>
          <Text style={[typography.caption, { marginBottom: spacing.sm }]}>
            Tap to cycle soreness level (1: Mild, 2: Moderate, 3: High)
          </Text>
          <View style={styles.muscleWrap}>
            {MUSCLE_GROUPS.map((muscle) => {
              const level = sorenessByMuscle[muscle] ?? 0;
              const isActive = level > 0;
              return (
                <Pressable
                  key={muscle}
                  onPress={() => toggleMuscleSoreness(muscle)}
                  style={[
                    styles.muscleChip,
                    isActive && styles.muscleChipActive,
                    level >= 3 && styles.muscleChipHigh,
                  ]}
                >
                  <Text
                    style={[
                      styles.muscleChipText,
                      isActive && styles.muscleChipTextActive,
                    ]}
                  >
                    {muscle} {isActive ? `(${level})` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Tiredness & Energy */}
        <Card style={styles.card}>
          <SectionTitle>Fatigue & Energy</SectionTitle>
          
          <Label>Tiredness (1: Rested → 5: Drained)</Label>
          <View style={styles.chipsRow}>
            {TIREDNESS_LEVELS.map((item) => (
              <Pressable
                key={item.value}
                onPress={() => setTiredness(item.value)}
                style={[
                  styles.scaleChip,
                  tiredness === item.value && styles.scaleChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.scaleChipText,
                    tiredness === item.value && styles.scaleChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={{ marginTop: spacing.md }}>
            <Label>Energy Level (1: Low → 5: Peak)</Label>
            <View style={styles.chipsRow}>
              {ENERGY_LEVELS.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => setEnergy(item.value)}
                  style={[
                    styles.scaleChip,
                    energy === item.value && styles.scaleChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.scaleChipText,
                      energy === item.value && styles.scaleChipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Card>

        {/* Available Minutes */}
        <Card style={styles.card}>
          <SectionTitle>Available Time</SectionTitle>
          <View style={styles.chipsRow}>
            {MINUTE_PRESETS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setAvailableMinutes(String(m))}
                style={[
                  styles.minuteChip,
                  availableMinutes === String(m) && styles.minuteChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.minuteChipText,
                    availableMinutes === String(m) && styles.minuteChipTextActive,
                  ]}
                >
                  {m}m
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.field}>
            <Label>Minutes (10 - 180)</Label>
            <TextInput
              keyboardType="number-pad"
              value={availableMinutes}
              onChangeText={setAvailableMinutes}
              placeholder="60"
            />
          </View>
        </Card>

        {/* Recovery Note */}
        <Card style={styles.card}>
          <SectionTitle>Recovery Notes (Optional)</SectionTitle>
          <TextInput
            value={recoveryNote}
            onChangeText={setRecoveryNote}
            placeholder="e.g. Tight lower back from yard work, slept 6 hrs"
            maxLength={280}
            multiline
            style={styles.textArea}
          />
          <Text style={styles.charCount}>{recoveryNote.length}/280</Text>
        </Card>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.actionContainer}>
          <Button
            title={painOrNewInjury ? 'Submit Check-in' : 'Adapt Session'}
            onPress={handleContinue}
            loading={submitting}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { marginTop: spacing.md },
  safetyCard: { borderColor: colors.border },
  safetyCardActive: { borderColor: colors.danger, backgroundColor: '#2A1515' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  safetyNotice: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#3D1515',
    borderRadius: radii.sm,
  },
  safetyNoticeText: { ...typography.caption, color: colors.danger },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
  scaleChip: {
    flex: 1,
    minWidth: 52,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  scaleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  scaleChipText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  scaleChipTextActive: { color: colors.background, fontWeight: '700' },
  muscleWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
  muscleChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  muscleChipActive: { backgroundColor: colors.warning, borderColor: colors.warning },
  muscleChipHigh: { backgroundColor: colors.danger, borderColor: colors.danger },
  muscleChipText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  muscleChipTextActive: { color: colors.background, fontWeight: '700' },
  minuteChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  minuteChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  minuteChipText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  minuteChipTextActive: { color: colors.background, fontWeight: '700' },
  field: { marginTop: spacing.sm },
  textArea: { minHeight: 64, textAlignVertical: 'top' },
  charCount: { ...typography.caption, textAlign: 'right', marginTop: spacing.xs },
  errorText: { color: colors.danger, marginTop: spacing.md, textAlign: 'center' },
  actionContainer: { marginTop: spacing.lg },
});
