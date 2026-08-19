import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Label, ScreenContainer, SectionTitle, TextInput } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { invokeCoachGenerate } from '../lib/coachApi';
import {
  NutritionPlanDraft,
  buildNutritionPlanFromGoals,
  redistributeMealCalories,
} from '../lib/nutritionPlan';
import { supabase } from '../lib/supabase';
import { NutritionStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';
import { Goals } from '../types/db';

type Props = NativeStackScreenProps<NutritionStackParamList, 'NutritionPlan'>;

function numOrEmpty(v: number | null | undefined) {
  return v == null || Number.isNaN(v) ? '' : String(Math.round(v * 100) / 100);
}

function parseOptional(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isNaN(n) ? null : n;
}

export default function NutritionPlanScreen({ navigation }: Props) {
  const { session, profile } = useAuth();
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [water, setWater] = useState('');
  const [mealsPerDay, setMealsPerDay] = useState('4');
  const [breakfast, setBreakfast] = useState('');
  const [lunch, setLunch] = useState('');
  const [dinner, setDinner] = useState('');
  const [snack, setSnack] = useState('');
  const [proteinPerKg, setProteinPerKg] = useState('');
  const [adjustmentPct, setAdjustmentPct] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyDraft = (draft: NutritionPlanDraft) => {
    setCalories(numOrEmpty(draft.daily_calorie_target));
    setProtein(numOrEmpty(draft.daily_protein_g));
    setCarbs(numOrEmpty(draft.daily_carbs_g));
    setFat(numOrEmpty(draft.daily_fat_g));
    setFiber(numOrEmpty(draft.daily_fiber_g));
    setWater(numOrEmpty(draft.water_ml));
    setMealsPerDay(String(draft.meals_per_day ?? 4));
    setBreakfast(numOrEmpty(draft.breakfast_kcal));
    setLunch(numOrEmpty(draft.lunch_kcal));
    setDinner(numOrEmpty(draft.dinner_kcal));
    setSnack(numOrEmpty(draft.snack_kcal));
    setProteinPerKg(numOrEmpty(draft.protein_g_per_kg));
    setAdjustmentPct(numOrEmpty(draft.calorie_adjustment_pct));
    setNotes(draft.notes ?? '');
  };

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data } = await supabase
        .from('nutrition_plans')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (data) {
        applyDraft({
          daily_calorie_target: data.daily_calorie_target,
          daily_protein_g: data.daily_protein_g,
          daily_carbs_g: data.daily_carbs_g,
          daily_fat_g: data.daily_fat_g,
          daily_fiber_g: data.daily_fiber_g,
          water_ml: data.water_ml,
          meals_per_day: data.meals_per_day,
          breakfast_kcal: data.breakfast_kcal,
          lunch_kcal: data.lunch_kcal,
          dinner_kcal: data.dinner_kcal,
          snack_kcal: data.snack_kcal,
          protein_g_per_kg: data.protein_g_per_kg,
          calorie_adjustment_pct: data.calorie_adjustment_pct,
          notes: data.notes,
        } as NutritionPlanDraft);
      } else {
        const [{ data: goalsData }, { data: weightData }] = await Promise.all([
          supabase.from('goals').select('*').eq('user_id', session.user.id).maybeSingle(),
          supabase
            .from('weight_logs')
            .select('weight_kg')
            .eq('user_id', session.user.id)
            .order('logged_at', { ascending: false })
            .limit(1),
        ]);
        if (goalsData?.daily_calorie_target || weightData?.[0]?.weight_kg) {
          applyDraft(
            buildNutritionPlanFromGoals({
              goals: goalsData as Goals | null,
              weightKg: weightData?.[0]?.weight_kg ?? null,
              age: profile?.age,
              gender: profile?.gender,
              heightCm: profile?.height_cm,
            })
          );
        }
      }
    })();
  }, [session]);

  const generateFromGoals = async () => {
    if (!session) return;
    setError(null);
    setMessage(null);
    try {
      const result = await invokeCoachGenerate({ mode: 'nutrition_only' });
      const { data } = await supabase
        .from('nutrition_plans')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (data) {
        applyDraft({
          daily_calorie_target: data.daily_calorie_target,
          daily_protein_g: data.daily_protein_g,
          daily_carbs_g: data.daily_carbs_g,
          daily_fat_g: data.daily_fat_g,
          daily_fiber_g: data.daily_fiber_g,
          water_ml: data.water_ml,
          meals_per_day: data.meals_per_day,
          breakfast_kcal: data.breakfast_kcal,
          lunch_kcal: data.lunch_kcal,
          dinner_kcal: data.dinner_kcal,
          snack_kcal: data.snack_kcal,
          protein_g_per_kg: data.protein_g_per_kg,
          calorie_adjustment_pct: data.calorie_adjustment_pct,
          notes: data.notes,
        });
      }
      setMessage(
        result.used_llm
          ? 'Coach updated nutrition + menu from your goals.'
          : 'Nutrition updated from goals (deterministic coach).'
      );
    } catch {
      const [{ data: goalsData }, { data: weightData }] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', session.user.id).maybeSingle(),
        supabase
          .from('weight_logs')
          .select('weight_kg')
          .eq('user_id', session.user.id)
          .order('logged_at', { ascending: false })
          .limit(1),
      ]);
      const draft = buildNutritionPlanFromGoals({
        goals: goalsData as Goals | null,
        weightKg: weightData?.[0]?.weight_kg ?? null,
        age: profile?.age,
        gender: profile?.gender,
        heightCm: profile?.height_cm,
      });
      applyDraft(draft);
      setMessage('Cloud coach unavailable — filled locally from goals. Review and save.');
    }
  };

  const redistribute = () => {
    const kcal = parseOptional(calories);
    const meals = Math.min(Math.max(parseInt(mealsPerDay, 10) || 4, 1), 8);
    if (kcal == null) {
      setError('Set daily calories first to redistribute meals.');
      return;
    }
    const split = redistributeMealCalories(kcal, meals);
    setBreakfast(numOrEmpty(split.breakfast_kcal));
    setLunch(numOrEmpty(split.lunch_kcal));
    setDinner(numOrEmpty(split.dinner_kcal));
    setSnack(numOrEmpty(split.snack_kcal));
    setMessage('Meal calories redistributed from daily total.');
  };

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const meals = Math.min(Math.max(parseInt(mealsPerDay, 10) || 4, 1), 8);

    const { data: existingPlan } = await supabase
      .from('nutrition_plans')
      .select('preferences, meal_menu')
      .eq('user_id', session.user.id)
      .maybeSingle();

    const plan = {
      user_id: session.user.id,
      daily_calorie_target: parseOptional(calories),
      daily_protein_g: parseOptional(protein),
      daily_carbs_g: parseOptional(carbs),
      daily_fat_g: parseOptional(fat),
      daily_fiber_g: parseOptional(fiber),
      water_ml: parseOptional(water),
      meals_per_day: meals,
      breakfast_kcal: parseOptional(breakfast),
      lunch_kcal: parseOptional(lunch),
      dinner_kcal: parseOptional(dinner),
      snack_kcal: parseOptional(snack),
      protein_g_per_kg: parseOptional(proteinPerKg),
      calorie_adjustment_pct: parseOptional(adjustmentPct),
      notes: notes.trim() || null,
      preferences: existingPlan?.preferences ?? {},
      meal_menu: existingPlan?.meal_menu ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error: planError } = await supabase.from('nutrition_plans').upsert(plan);
    if (planError) {
      setSaving(false);
      setError(planError.message);
      return;
    }

    // Keep Goals daily targets in sync so Nutrition home and dashboard stay consistent.
    const { data: existingGoals } = await supabase
      .from('goals')
      .select('weekly_workout_target')
      .eq('user_id', session.user.id)
      .maybeSingle();

    await supabase.from('goals').upsert({
      user_id: session.user.id,
      weekly_workout_target: existingGoals?.weekly_workout_target ?? 3,
      daily_calorie_target: plan.daily_calorie_target,
      daily_protein_target_g: plan.daily_protein_g,
      daily_carbs_target_g: plan.daily_carbs_g,
      daily_fat_target_g: plan.daily_fat_g,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    setMessage('Nutrition plan saved. Daily targets updated.');
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={typography.h1}>Nutrition plan</Text>
        <Text style={typography.bodyMuted}>
          Supporting targets for your goals. Every parameter is editable.
        </Text>

        <Card style={styles.card}>
          <SectionTitle>Preferences & menu</SectionTitle>
          <Text style={typography.bodyMuted}>
            Interactive questionnaire for dislikes, avoids (like seafood), and meal-prep style — then a flexible weekly menu.
          </Text>
          <View style={styles.field}>
            <Button title="Food preferences questionnaire" variant="secondary" onPress={() => navigation.navigate('NutritionPreferences')} />
          </View>
          <View style={styles.field}>
            <Button title="View menu" variant="ghost" onPress={() => navigation.navigate('NutritionMenu')} />
          </View>
        </Card>
        <Card style={styles.card}>
          <SectionTitle>From goals</SectionTitle>
          <Text style={typography.bodyMuted}>
            Builds calories, macros, fiber, water, and meal splits from your primary goal and latest weight.
          </Text>
          <View style={styles.field}>
            <Button title="Generate from goals" variant="secondary" onPress={generateFromGoals} />
          </View>
        </Card>

        <Card style={styles.card}>
          <SectionTitle>Daily targets</SectionTitle>
          <View style={styles.field}>
            <Label>Calories (kcal)</Label>
            <TextInput keyboardType="number-pad" value={calories} onChangeText={setCalories} />
          </View>
          <View style={styles.row}>
            <View style={styles.smallField}>
              <Label>Protein (g)</Label>
              <TextInput keyboardType="decimal-pad" value={protein} onChangeText={setProtein} />
            </View>
            <View style={styles.smallField}>
              <Label>Carbs (g)</Label>
              <TextInput keyboardType="decimal-pad" value={carbs} onChangeText={setCarbs} />
            </View>
            <View style={styles.smallField}>
              <Label>Fat (g)</Label>
              <TextInput keyboardType="decimal-pad" value={fat} onChangeText={setFat} />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.smallField}>
              <Label>Fiber (g)</Label>
              <TextInput keyboardType="decimal-pad" value={fiber} onChangeText={setFiber} />
            </View>
            <View style={styles.smallField}>
              <Label>Water (ml)</Label>
              <TextInput keyboardType="number-pad" value={water} onChangeText={setWater} />
            </View>
          </View>
        </Card>

        <Card style={styles.card}>
          <SectionTitle>Plan parameters</SectionTitle>
          <View style={styles.row}>
            <View style={styles.smallField}>
              <Label>Meals / day</Label>
              <TextInput keyboardType="number-pad" value={mealsPerDay} onChangeText={setMealsPerDay} />
            </View>
            <View style={styles.smallField}>
              <Label>Protein g/kg</Label>
              <TextInput keyboardType="decimal-pad" value={proteinPerKg} onChangeText={setProteinPerKg} />
            </View>
            <View style={styles.smallField}>
              <Label>Cal adj %</Label>
              <TextInput keyboardType="decimal-pad" value={adjustmentPct} onChangeText={setAdjustmentPct} />
            </View>
          </View>
          <Text style={[typography.caption, styles.hint]}>
            Cal adj % is relative to maintenance (negative = deficit, positive = surplus).
          </Text>
        </Card>

        <Card style={styles.card}>
          <SectionTitle>Meal calorie split</SectionTitle>
          <View style={styles.field}>
            <Button title="Redistribute from daily calories" variant="ghost" onPress={redistribute} />
          </View>
          <View style={styles.row}>
            <View style={styles.smallField}>
              <Label>Breakfast</Label>
              <TextInput keyboardType="number-pad" value={breakfast} onChangeText={setBreakfast} />
            </View>
            <View style={styles.smallField}>
              <Label>Lunch</Label>
              <TextInput keyboardType="number-pad" value={lunch} onChangeText={setLunch} />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.smallField}>
              <Label>Dinner</Label>
              <TextInput keyboardType="number-pad" value={dinner} onChangeText={setDinner} />
            </View>
            <View style={styles.smallField}>
              <Label>Snacks</Label>
              <TextInput keyboardType="number-pad" value={snack} onChangeText={setSnack} />
            </View>
          </View>
        </Card>

        <Card style={styles.card}>
          <SectionTitle>Notes</SectionTitle>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional guidance for this plan"
            multiline
            style={styles.notes}
          />
        </Card>

        {error && <Text style={styles.error}>{error}</Text>}
        {message && <Text style={styles.message}>{message}</Text>}
        <Button title="Save nutrition plan" onPress={handleSave} loading={saving} />
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
  hint: { marginTop: spacing.sm, color: colors.textMuted },
  notes: { minHeight: 88, textAlignVertical: 'top', marginTop: spacing.sm },
  message: { color: colors.accent, textAlign: 'center', marginVertical: spacing.sm },
  error: { color: colors.danger, textAlign: 'center', marginVertical: spacing.sm },
});