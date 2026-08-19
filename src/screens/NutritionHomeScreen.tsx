import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState, ScreenContainer, SectionTitle } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { NutritionStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';
import { FoodLog, Goals, MealType, NutritionPlan } from '../types/db';

type Props = NativeStackScreenProps<NutritionStackParamList, 'NutritionHome'>;

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function macroRow(label: string, value: number, target: number | null, unit: string) {
  return (
    <View style={styles.macroRow} key={label}>
      <Text style={typography.bodyMuted}>{label}</Text>
      <Text style={typography.body}>
        {Math.round(value)}
        {unit}
        {target ? ` / ${Math.round(target)}${unit}` : ''}
      </Text>
    </View>
  );
}

function mealTarget(plan: NutritionPlan | null, mealType: MealType): number | null {
  if (!plan) return null;
  if (mealType === 'breakfast') return plan.breakfast_kcal;
  if (mealType === 'lunch') return plan.lunch_kcal;
  if (mealType === 'dinner') return plan.dinner_kcal;
  return plan.snack_kcal;
}

export default function NutritionHomeScreen({ navigation }: Props) {
  const { session } = useAuth();
  const [date] = useState(todayString());
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [plan, setPlan] = useState<NutritionPlan | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const [{ data: logData }, { data: goalsData }, { data: planData }] = await Promise.all([
      supabase.from('food_logs').select('*').eq('user_id', session.user.id).eq('logged_at', date),
      supabase.from('goals').select('*').eq('user_id', session.user.id).maybeSingle(),
      supabase.from('nutrition_plans').select('*').eq('user_id', session.user.id).maybeSingle(),
    ]);
    setLogs(logData ?? []);
    setGoals(goalsData ?? null);
    setPlan(planData ?? null);
  }, [session, date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const removeLog = async (id: string) => {
    await supabase.from('food_logs').delete().eq('id', id);
    load();
  };

  const totals = logs.reduce(
    (acc, l) => ({
      calories: acc.calories + l.calories,
      protein_g: acc.protein_g + l.protein_g,
      carbs_g: acc.carbs_g + l.carbs_g,
      fat_g: acc.fat_g + l.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  const calorieTarget = plan?.daily_calorie_target ?? goals?.daily_calorie_target ?? null;
  const proteinTarget = plan?.daily_protein_g ?? goals?.daily_protein_target_g ?? null;
  const carbsTarget = plan?.daily_carbs_g ?? goals?.daily_carbs_target_g ?? null;
  const fatTarget = plan?.daily_fat_g ?? goals?.daily_fat_target_g ?? null;

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <View style={styles.flexShrink}>
          <Text style={typography.h1}>Nutrition</Text>
          <Text style={typography.bodyMuted}>{date}</Text>
        </View>
        <View style={styles.headerActions}>
          <Button title="Plan" variant="secondary" onPress={() => navigation.navigate('NutritionPlan')} />
          <View style={styles.headerBtnGap} />
          <Button title="Menu" variant="secondary" onPress={() => navigation.navigate('NutritionMenu')} />
        </View>
      </View>

      <Card style={styles.totalsCard}>
        <View style={styles.calorieRow}>
          <Text style={typography.stat}>{Math.round(totals.calories)}</Text>
          <Text style={typography.bodyMuted}>
            {' '}
            / {calorieTarget != null ? Math.round(calorieTarget) : '—'} kcal
          </Text>
        </View>
        {macroRow('Protein', totals.protein_g, proteinTarget, 'g')}
        {macroRow('Carbs', totals.carbs_g, carbsTarget, 'g')}
        {macroRow('Fat', totals.fat_g, fatTarget, 'g')}
        {plan?.daily_fiber_g != null && (
          <Text style={[typography.caption, styles.extraTarget]}>Fiber target: {Math.round(plan.daily_fiber_g)}g</Text>
        )}
        {plan?.water_ml != null && (
          <Text style={[typography.caption, styles.extraTarget]}>Water target: {Math.round(plan.water_ml)} ml</Text>
        )}
      </Card>

      <FlatList
        data={MEAL_TYPES}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          !plan ? (
            <Card style={styles.planPrompt}>
              <Text style={typography.bodyMuted}>No nutrition plan yet. Generate one from your goals.</Text>
              <View style={styles.planPromptBtn}>
                <Button title="Set up nutrition plan" onPress={() => navigation.navigate('NutritionPlan')} />
              </View>
            </Card>
          ) : null
        }
        renderItem={({ item: mealType }) => {
          const mealLogs = logs.filter((l) => l.meal_type === mealType);
          const mealCals = mealLogs.reduce((sum, l) => sum + l.calories, 0);
          const target = mealTarget(plan, mealType);
          return (
            <View style={styles.mealSection}>
              <View style={styles.mealHeader}>
                <View>
                  <SectionTitle>{MEAL_LABELS[mealType]}</SectionTitle>
                  {target != null && (
                    <Text style={typography.caption}>
                      {Math.round(mealCals)} / {Math.round(target)} kcal
                    </Text>
                  )}
                </View>
                <Pressable onPress={() => navigation.navigate('FoodSearch', { mealType })}>
                  <Text style={styles.addLink}>+ Add food</Text>
                </Pressable>
              </View>
              {mealLogs.length === 0 && <EmptyState message="Nothing logged yet." />}
              {mealLogs.map((log) => (
                <Card key={log.id} style={styles.foodCard}>
                  <Pressable onLongPress={() => removeLog(log.id)} style={styles.foodRow}>
                    <View style={styles.flexShrink}>
                      <Text style={typography.body}>{log.food_name}</Text>
                      <Text style={typography.caption}>
                        {log.serving_qty} {log.serving_unit}
                      </Text>
                    </View>
                    <Text style={typography.body}>{Math.round(log.calories)} kcal</Text>
                  </Pressable>
                </Card>
              ))}
            </View>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerBtnGap: { width: spacing.sm },
  totalsCard: { marginTop: spacing.md },
  calorieRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: spacing.sm },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  extraTarget: { marginTop: spacing.xs, color: colors.textMuted },
  listContent: { paddingBottom: spacing.xl },
  planPrompt: { marginTop: spacing.md },
  planPromptBtn: { marginTop: spacing.sm },
  mealSection: { marginTop: spacing.lg },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addLink: { color: colors.primary, fontWeight: '700' },
  foodCard: { marginBottom: spacing.sm },
  foodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flexShrink: { flexShrink: 1 },
});