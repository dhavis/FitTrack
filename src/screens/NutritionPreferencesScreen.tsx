import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Label, ScreenContainer, SectionTitle, TextInput } from '../components/ui';
import GlossaryTip from '../components/GlossaryTip';
import { useAuth } from '../hooks/useAuth';
import { generateMenu } from '../lib/menuGenerator';
import { displayLength, toStorageLengthCm } from '../lib/units';
import {
  AVOID_GROUPS,
  CARB_OPTIONS,
  COMPLEXITY_OPTIONS,
  CONDIMENTS,
  DEFAULT_PREFERENCES,
  EATING_STYLES,
  MEAL_PREP_STYLES,
  NutritionPreferences,
  PREP_TIME_OPTIONS,
  PROTEIN_OPTIONS,
  VEGETABLES,
  applyEatingStyleDefaults,
  preferencesSummary,
  toggleListItem,
} from '../lib/nutritionPreferences';
import { supabase } from '../lib/supabase';
import { NutritionStackParamList } from '../navigation/types';
import { colors, radii, spacing, typography } from '../theme/theme';
import { Gender } from '../types/db';

type Props = NativeStackScreenProps<NutritionStackParamList, 'NutritionPreferences'>;

const STEPS = [
  'About you',
  'Eating style',
  'Foods to avoid',
  'Vegetables',
  'Condiments',
  'Preferred proteins',
  'Preferred carbs',
  'Liked vegetables',
  'Meal prep',
  'Cooking style',
  'Extras',
  'Review',
] as const;

function Chip({
  label,
  active,
  onPress,
  hint,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  hint?: string;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      {hint ? <Text style={[styles.chipHint, active && styles.chipHintActive]}>{hint}</Text> : null}
    </Pressable>
  );
}

export default function NutritionPreferencesScreen({ navigation }: Props) {
  const { session, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<NutritionPreferences>(DEFAULT_PREFERENCES);
  const lengthUnit = profile?.length_unit ?? 'cm';
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [height, setHeight] = useState('');
  const [customAvoidText, setCustomAvoidText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    (async () => {
      if (profile?.age != null) setAge(String(profile.age));
      if (profile?.gender) setGender(profile.gender);
      if (profile?.height_cm != null) {
        setHeight(String(Math.round(displayLength(profile.height_cm, profile.length_unit ?? 'cm') * 10) / 10));
      }

      const { data } = await supabase
        .from('nutrition_plans')
        .select('preferences')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (data?.preferences && typeof data.preferences === 'object') {
        setPrefs({ ...DEFAULT_PREFERENCES, ...(data.preferences as NutritionPreferences) });
        const custom = (data.preferences as NutritionPreferences).custom_avoids ?? [];
        setCustomAvoidText(custom.join(', '));
      }
    })();
  }, [session, profile]);

  const progress = useMemo(() => (step + 1) / STEPS.length, [step]);

  const setList = (key: keyof NutritionPreferences, item: string) => {
    setPrefs((prev) => {
      const list = (prev[key] as string[]) ?? [];
      return { ...prev, [key]: toggleListItem(list, item) };
    });
  };

  const saveAndGenerate = async () => {
    if (!session) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    const cleaned: NutritionPreferences = {
      ...prefs,
      custom_avoids: customAvoidText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      custom_notes: prefs.custom_notes.trim(),
    };

    const parsedAge = parseInt(age, 10);
    const parsedHeight = parseFloat(height);
    await supabase
      .from('profiles')
      .update({
        age: Number.isNaN(parsedAge) ? null : Math.min(100, Math.max(13, parsedAge)),
        gender,
        height_cm: Number.isNaN(parsedHeight) ? null : toStorageLengthCm(parsedHeight, lengthUnit),
      })
      .eq('id', session.user.id);
    await refreshProfile();

    const menu = generateMenu(cleaned);

    const { data: existing } = await supabase
      .from('nutrition_plans')
      .select('user_id, meals_per_day')
      .eq('user_id', session.user.id)
      .maybeSingle();

    const payload = {
      user_id: session.user.id,
      meals_per_day: existing?.meals_per_day ?? 4,
      preferences: cleaned,
      meal_menu: menu,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase.from('nutrition_plans').upsert(payload);
    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setPrefs(cleaned);
    setMessage('Preferences saved and menu generated.');
    setTimeout(() => navigation.navigate('NutritionMenu'), 500);
  };

  const renderStep = () => {
        switch (step) {
      case 0:
        return (
          <>
            <SectionTitle>About you</SectionTitle>
            <View style={styles.explainRow}>
              <Text style={styles.explainText}>
                Age and gender help estimate how much energy your body uses each day. Height improves accuracy.
              </Text>
              <GlossaryTip term="calorie_estimate" />
            </View>
            <View style={styles.field}>
              <Label>Age</Label>
              <TextInput keyboardType="number-pad" value={age} onChangeText={setAge} placeholder="Years" />
            </View>
            <View style={styles.field}>
              <Label>Gender</Label>
              <View style={styles.wrap}>
                {(
                  [
                    { id: 'male' as Gender, label: 'Male' },
                    { id: 'female' as Gender, label: 'Female' },
                    { id: 'other' as Gender, label: 'Other' },
                  ] as { id: Gender; label: string }[]
                ).map((g) => (
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
                placeholder="Optional but recommended"
              />
            </View>
            {(!age || !gender) && (
              <Text style={[typography.caption, styles.hint]}>Age and gender are required to continue.</Text>
            )}
          </>
        );
      case 1:
        return (
          <>
            <SectionTitle>How do you eat?</SectionTitle>
            <Text style={typography.bodyMuted}>Pick the closest match. You can refine avoids next.</Text>
            <View style={styles.wrap}>
              {EATING_STYLES.map((s) => (
                <Chip
                  key={s.id}
                  label={s.label}
                  hint={s.hint}
                  active={prefs.eating_style === s.id}
                  onPress={() => setPrefs((p) => applyEatingStyleDefaults(s.id, p))}
                />
              ))}
            </View>
          </>
        );
      case 2:
        return (
          <>
            <SectionTitle>What should we never include?</SectionTitle>
            <Text style={typography.bodyMuted}>Tap anything you don’t eat — e.g. seafood.</Text>
            <View style={styles.wrap}>
              {AVOID_GROUPS.map((g) => (
                <Chip
                  key={g.id}
                  label={g.label}
                  active={prefs.avoided_groups.includes(g.id)}
                  onPress={() => setList('avoided_groups', g.id)}
                />
              ))}
            </View>
          </>
        );
      case 3:
        return (
          <>
            <SectionTitle>Vegetables you dislike</SectionTitle>
            <Text style={typography.bodyMuted}>We’ll leave these out of your menu.</Text>
            <View style={styles.wrap}>
              {VEGETABLES.map((v) => (
                <Chip
                  key={v}
                  label={v}
                  active={prefs.disliked_vegetables.includes(v)}
                  onPress={() => setList('disliked_vegetables', v)}
                />
              ))}
            </View>
          </>
        );
      case 4:
        return (
          <>
            <SectionTitle>Condiments / sauces you dislike</SectionTitle>
            <Text style={typography.bodyMuted}>Menus will stick to simple seasoning if you skip most sauces.</Text>
            <View style={styles.wrap}>
              {CONDIMENTS.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={prefs.disliked_condiments.includes(c)}
                  onPress={() => setList('disliked_condiments', c)}
                />
              ))}
            </View>
          </>
        );
      case 5:
        return (
          <>
            <SectionTitle>Preferred proteins</SectionTitle>
            <Text style={typography.bodyMuted}>Optional — we’ll prioritize these when building meals.</Text>
            <View style={styles.wrap}>
              {PROTEIN_OPTIONS.filter((p) => {
                const lower = p.toLowerCase();
                if (prefs.avoided_groups.includes('seafood') && /(salmon|tuna|fish|shrimp)/.test(lower)) return false;
                if (prefs.avoided_groups.includes('poultry') && /(chicken|turkey)/.test(lower)) return false;
                if (prefs.avoided_groups.includes('beef') && /beef/.test(lower)) return false;
                if (prefs.avoided_groups.includes('dairy') && /(yogurt|cottage)/.test(lower)) return false;
                if (prefs.avoided_groups.includes('eggs') && /eggs/.test(lower)) return false;
                if (prefs.avoided_groups.includes('soy') && /(tofu|tempeh)/.test(lower)) return false;
                return true;
              }).map((p) => (
                <Chip
                  key={p}
                  label={p}
                  active={prefs.preferred_proteins.includes(p)}
                  onPress={() => setList('preferred_proteins', p)}
                />
              ))}
            </View>
          </>
        );
      case 6:
        return (
          <>
            <SectionTitle>Preferred carbs / staples</SectionTitle>
            <Text style={typography.bodyMuted}>Rice, oats, potatoes — whatever is easy for you to repeat.</Text>
            <View style={styles.wrap}>
              {CARB_OPTIONS.filter((c) => !(prefs.avoided_groups.includes('gluten') && /(oats|pasta|bread|tortilla)/i.test(c))).map(
                (c) => (
                  <Chip
                    key={c}
                    label={c}
                    active={prefs.preferred_carbs.includes(c)}
                    onPress={() => setList('preferred_carbs', c)}
                  />
                )
              )}
            </View>
          </>
        );
      case 7:
        return (
          <>
            <SectionTitle>Vegetables you actually like</SectionTitle>
            <Text style={typography.bodyMuted}>Helps the menu stay enjoyable and repeatable.</Text>
            <View style={styles.wrap}>
              {VEGETABLES.filter((v) => !prefs.disliked_vegetables.includes(v)).map((v) => (
                <Chip
                  key={v}
                  label={v}
                  active={prefs.preferred_vegetables.includes(v)}
                  onPress={() => setList('preferred_vegetables', v)}
                />
              ))}
            </View>
          </>
        );
      case 8:
        return (
          <>
            <SectionTitle>Meal prep style</SectionTitle>
            <Text style={typography.bodyMuted}>Choose how you want the menu structured for real life.</Text>
            <View style={styles.stack}>
              {MEAL_PREP_STYLES.map((s) => (
                <Chip
                  key={s.id}
                  label={s.label}
                  hint={s.hint}
                  active={prefs.meal_prep_style === s.id}
                  onPress={() => setPrefs((p) => ({ ...p, meal_prep_style: s.id }))}
                />
              ))}
            </View>
          </>
        );
      case 9:
        return (
          <>
            <SectionTitle>Cooking time & complexity</SectionTitle>
            <Label>Typical prep/cook time</Label>
            <View style={styles.wrap}>
              {PREP_TIME_OPTIONS.map((m) => (
                <Chip
                  key={m}
                  label={`${m} min`}
                  active={prefs.prep_time_minutes === m}
                  onPress={() => setPrefs((p) => ({ ...p, prep_time_minutes: m }))}
                />
              ))}
            </View>
            <Label>Complexity</Label>
            <View style={styles.stack}>
              {COMPLEXITY_OPTIONS.map((c) => (
                <Chip
                  key={c.id}
                  label={c.label}
                  hint={c.hint}
                  active={prefs.cooking_complexity === c.id}
                  onPress={() => setPrefs((p) => ({ ...p, cooking_complexity: c.id }))}
                />
              ))}
            </View>
          </>
        );
      case 10:
        return (
          <>
            <SectionTitle>Anything else to avoid?</SectionTitle>
            <Text style={typography.bodyMuted}>Comma-separated extras (e.g. cilantro, olives, cottage cheese).</Text>
            <TextInput
              value={customAvoidText}
              onChangeText={setCustomAvoidText}
              placeholder="cilantro, olives, ..."
              style={styles.notes}
            />
            <View style={styles.field}>
              <Label>Notes for your menu</Label>
              <TextInput
                value={prefs.custom_notes}
                onChangeText={(t) => setPrefs((p) => ({ ...p, custom_notes: t }))}
                placeholder="e.g. keep lunches microwave-friendly"
                multiline
                style={styles.notes}
              />
            </View>
          </>
        );
      default:
        return (
          <>
            <SectionTitle>Review</SectionTitle>
            <Text style={typography.bodyMuted}>{preferencesSummary(prefs)}</Text>
            <Card style={styles.reviewCard}>
              <Text style={styles.reviewLine}>
                You: {gender ?? '—'}{age ? `, ${age}y` : ''}{height ? `, ${height} ${lengthUnit}` : ''}
              </Text>
              <Text style={styles.reviewLine}>Style: {prefs.eating_style}</Text>
              <Text style={styles.reviewLine}>
                Avoids: {prefs.avoided_groups.length ? prefs.avoided_groups.join(', ') : 'none'}
              </Text>
              <Text style={styles.reviewLine}>
                Disliked veg: {prefs.disliked_vegetables.length ? prefs.disliked_vegetables.join(', ') : 'none'}
              </Text>
              <Text style={styles.reviewLine}>
                Disliked sauces: {prefs.disliked_condiments.length ? prefs.disliked_condiments.join(', ') : 'none'}
              </Text>
              <Text style={styles.reviewLine}>
                Proteins: {prefs.preferred_proteins.length ? prefs.preferred_proteins.join(', ') : 'any allowed'}
              </Text>
              <Text style={styles.reviewLine}>
                Carbs: {prefs.preferred_carbs.length ? prefs.preferred_carbs.join(', ') : 'any allowed'}
              </Text>
              <Text style={styles.reviewLine}>
                Prep: {prefs.meal_prep_style.replace(/_/g, ' ')} · {prefs.prep_time_minutes} min · {prefs.cooking_complexity}
              </Text>
              {(customAvoidText.trim() || prefs.custom_notes.trim()) && (
                <Text style={styles.reviewLine}>
                  Extra: {[customAvoidText.trim(), prefs.custom_notes.trim()].filter(Boolean).join(' — ')}
                </Text>
              )}
            </Card>
            <Text style={[typography.caption, styles.hint]}>
              Saving generates a flexible 7-day menu filtered by these preferences.
            </Text>
          </>
        );
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={typography.h1}>Food preferences</Text>
        <Text style={typography.bodyMuted}>
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>

        <Card style={styles.card}>{renderStep()}</Card>

        {error && <Text style={styles.error}>{error}</Text>}
        {message && <Text style={styles.message}>{message}</Text>}

        <View style={styles.navRow}>
          <View style={styles.navBtn}>
            <Button title="Back" variant="secondary" onPress={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} />
          </View>
          <View style={styles.navBtn}>
            {step < STEPS.length - 1 ? (
              <Button
                title="Next"
                onPress={() => {
                  if (step === 0 && (!age.trim() || !gender)) {
                    setError('Please enter your age and select a gender to continue.');
                    return;
                  }
                  setError(null);
                  setStep((s) => Math.min(STEPS.length - 1, s + 1));
                }}
              />
            ) : (
              <Button title="Save & build menu" onPress={saveAndGenerate} loading={saving} />
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  progressTrack: {
    height: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: colors.primary },
  card: { marginTop: spacing.md },
  explainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, marginBottom: spacing.xs },
  explainText: { ...typography.bodyMuted, flex: 1, lineHeight: 20 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  stack: { marginTop: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    maxWidth: '100%',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: colors.background },
  chipHint: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  chipHintActive: { color: colors.background, opacity: 0.85 },
  field: { marginTop: spacing.md },
  notes: { minHeight: 72, textAlignVertical: 'top', marginTop: spacing.sm },
  reviewCard: { marginTop: spacing.md, backgroundColor: colors.surfaceAlt },
  reviewLine: { ...typography.body, marginBottom: spacing.xs },
  hint: { marginTop: spacing.sm, color: colors.textMuted },
  navRow: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm },
  navBtn: { flex: 1 },
  message: { color: colors.accent, textAlign: 'center', marginTop: spacing.sm },
  error: { color: colors.danger, textAlign: 'center', marginTop: spacing.sm },
});