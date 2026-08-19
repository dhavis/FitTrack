import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState, Label, ScreenContainer, TextInput } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { searchFoods, FoodSearchResult } from '../lib/nutrition';
import { supabase } from '../lib/supabase';
import { NutritionStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';

type Props = NativeStackScreenProps<NutritionStackParamList, 'FoodSearch'>;

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function FoodSearchScreen({ route, navigation }: Props) {
  const { mealType } = route.params;
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FoodSearchResult | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchFoods(query);
      setResults(data);
    } catch (e: any) {
      setError(e.message ?? 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLog = async () => {
    if (!session || !selected) return;
    const qty = parseFloat(quantity) || 1;
    setSaving(true);
    await supabase.from('food_logs').insert({
      user_id: session.user.id,
      logged_at: todayString(),
      meal_type: mealType,
      food_name: selected.description,
      brand: selected.brandOwner ?? null,
      serving_qty: qty,
      serving_unit: selected.servingSizeUnit ?? 'serving',
      calories: selected.calories * qty,
      protein_g: selected.protein_g * qty,
      carbs_g: selected.carbs_g * qty,
      fat_g: selected.fat_g * qty,
      source: 'usda',
      external_id: String(selected.fdcId),
    });
    setSaving(false);
    setSelected(null);
    navigation.goBack();
  };

  return (
    <ScreenContainer>
      <Text style={typography.h1}>Add food</Text>
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <TextInput
            placeholder="Search foods (e.g. chicken breast)"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>
        <Button title="Search" onPress={handleSearch} loading={loading} />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.fdcId)}
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelected(item)}>
            <Card style={styles.resultCard}>
              <Text style={typography.body}>{item.description}</Text>
              {item.brandOwner && <Text style={typography.caption}>{item.brandOwner}</Text>}
              <Text style={typography.bodyMuted}>
                {Math.round(item.calories)} kcal • P {Math.round(item.protein_g)}g • C {Math.round(item.carbs_g)}g • F{' '}
                {Math.round(item.fat_g)}g (per serving)
              </Text>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={!loading ? <EmptyState message="Search for a food to get started." /> : null}
        contentContainerStyle={styles.listContent}
      />

      <Modal visible={!!selected} animationType="fade" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            {selected && (
              <>
                <Text style={typography.h3}>{selected.description}</Text>
                <View style={styles.field}>
                  <Label>Servings</Label>
                  <TextInput keyboardType="decimal-pad" value={quantity} onChangeText={setQuantity} />
                </View>
                <Text style={typography.bodyMuted}>
                  {Math.round(selected.calories * (parseFloat(quantity) || 1))} kcal total
                </Text>
                <View style={styles.modalActions}>
                  <View style={styles.flexButton}>
                    <Button title="Cancel" variant="ghost" onPress={() => setSelected(null)} />
                  </View>
                  <View style={styles.flexButton}>
                    <Button title="Log it" onPress={handleLog} loading={saving} />
                  </View>
                </View>
              </>
            )}
          </Card>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, alignItems: 'center' },
  searchInput: { flex: 1 },
  error: { color: colors.danger, marginTop: spacing.sm },
  resultCard: { marginTop: spacing.sm },
  listContent: { paddingBottom: spacing.xl },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.lg },
  modalCard: {},
  field: { marginTop: spacing.md, marginBottom: spacing.md },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  flexButton: { flex: 1 },
});
