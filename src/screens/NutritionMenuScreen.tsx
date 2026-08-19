import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, EmptyState, ScreenContainer, SectionTitle } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { GeneratedMenu, MenuMealIdea, generateMenu } from '../lib/menuGenerator';
import {
  DEFAULT_PREFERENCES,
  NutritionPreferences,
  preferencesSummary,
} from '../lib/nutritionPreferences';
import { supabase } from '../lib/supabase';
import { NutritionStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';

type Props = NativeStackScreenProps<NutritionStackParamList, 'NutritionMenu'>;

function MealBlock({ title, meal }: { title: string; meal: MenuMealIdea }) {
  return (
    <View style={styles.mealBlock}>
      <Text style={styles.mealTitle}>
        {title}: {meal.name}
      </Text>
      <Text style={typography.caption}>{meal.components.join(' · ')}</Text>
      {meal.notes ? <Text style={styles.mealNote}>{meal.notes}</Text> : null}
      {meal.prep_friendly ? <Text style={styles.prepTag}>Meal-prep friendly</Text> : null}
    </View>
  );
}

export default function NutritionMenuScreen({ navigation }: Props) {
  const { session } = useAuth();
  const [menu, setMenu] = useState<GeneratedMenu | null>(null);
  const [prefs, setPrefs] = useState<NutritionPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from('nutrition_plans')
      .select('preferences, meal_menu')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (data?.preferences) {
      setPrefs({ ...DEFAULT_PREFERENCES, ...(data.preferences as NutritionPreferences) });
    }
    if (data?.meal_menu) {
      setMenu(data.meal_menu as GeneratedMenu);
    } else {
      setMenu(null);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const regenerate = async () => {
    if (!session) return;
    setRegenerating(true);
    setError(null);
    const current = prefs ?? DEFAULT_PREFERENCES;
    const next = generateMenu(current);
    const { data: existing } = await supabase
      .from('nutrition_plans')
      .select('meals_per_day')
      .eq('user_id', session.user.id)
      .maybeSingle();
    const { error: upsertError } = await supabase.from('nutrition_plans').upsert({
      user_id: session.user.id,
      meals_per_day: existing?.meals_per_day ?? 4,
      preferences: current,
      meal_menu: next,
      updated_at: new Date().toISOString(),
    });
    setRegenerating(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setMenu(next);
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.h1}>Your menu</Text>
        <Text style={typography.bodyMuted}>
          Flexible templates filtered by your tastes — easy to follow and meal-prep when needed.
        </Text>

        {prefs && <Text style={[typography.caption, styles.summary]}>{preferencesSummary(prefs)}</Text>}

        <View style={styles.actions}>
          <Button title="Edit preferences" variant="secondary" onPress={() => navigation.navigate('NutritionPreferences')} />
        </View>
        <View style={styles.actions}>
          <Button title="Regenerate menu" onPress={regenerate} loading={regenerating} />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {!menu && (
          <Card style={styles.card}>
            <EmptyState message="No menu yet. Answer the preferences questionnaire to build one." />
            <View style={styles.actions}>
              <Button title="Start questionnaire" onPress={() => navigation.navigate('NutritionPreferences')} />
            </View>
          </Card>
        )}

        {menu && (
          <>
            <Card style={styles.card}>
              <SectionTitle>How to follow it</SectionTitle>
              <Text style={typography.bodyMuted}>{menu.guidance}</Text>
            </Card>

            <Card style={styles.card}>
              <SectionTitle>Meal prep checklist</SectionTitle>
              {menu.prep_batch.map((item) => (
                <Text key={item} style={styles.bullet}>
                  • {item}
                </Text>
              ))}
            </Card>

            <Card style={styles.card}>
              <SectionTitle>Shopping staples</SectionTitle>
              <Text style={typography.bodyMuted}>{menu.shopping_staples.join(' · ')}</Text>
            </Card>

            {menu.days.map((day) => (
              <Card key={day.label} style={styles.card}>
                <SectionTitle>{day.label}</SectionTitle>
                <MealBlock title="Breakfast" meal={day.breakfast} />
                <MealBlock title="Lunch" meal={day.lunch} />
                <MealBlock title="Dinner" meal={day.dinner} />
                <MealBlock title="Snack" meal={day.snack} />
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  summary: { marginTop: spacing.sm, color: colors.textMuted },
  actions: { marginTop: spacing.sm },
  card: { marginTop: spacing.md },
  bullet: { ...typography.body, marginTop: spacing.xs },
  mealBlock: { marginTop: spacing.sm },
  mealTitle: { ...typography.body, fontWeight: '600' },
  mealNote: { ...typography.caption, marginTop: 2 },
  prepTag: { ...typography.caption, color: colors.accent, marginTop: 2 },
  error: { color: colors.danger, textAlign: 'center', marginTop: spacing.sm },
});