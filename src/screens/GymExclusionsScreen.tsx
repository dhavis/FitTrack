import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  Label,
  ScreenContainer,
  SectionTitle,
  TextInput,
} from '../components/ui';
import {
  ALL_EQUIPMENT_TYPES,
  EQUIPMENT_TYPE_LABELS,
  EquipmentType,
} from '../lib/equipmentPolicy';
import { supabase } from '../lib/supabase';
import { SettingsStackParamList } from '../navigation/types';
import { colors, radii, spacing, typography } from '../theme/theme';
import { Exercise } from '../types/db';

type RouteType = RouteProp<SettingsStackParamList, 'GymExclusions'>;
type NavType = NativeStackNavigationProp<SettingsStackParamList, 'GymExclusions'>;

export default function GymExclusionsScreen() {
  const navigation = useNavigation<NavType>();
  const route = useRoute<RouteType>();

  const initialEquipment: EquipmentType[] = route.params?.excludedEquipment ?? [];
  const initialExerciseIds: string[] = route.params?.excludedExerciseIds ?? [];

  const [excludedEquipment, setExcludedEquipment] = useState<EquipmentType[]>(initialEquipment);
  const [excludedExerciseIds, setExcludedExerciseIds] = useState<string[]>(initialExerciseIds);
  const [excludedExercises, setExcludedExercises] = useState<Exercise[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Exercise[]>([]);
  const [searching, setSearching] = useState(false);

  // Load details for initial excluded exercises
  useEffect(() => {
    if (initialExerciseIds.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from('exercises')
        .select('*')
        .in('id', initialExerciseIds);
      if (data) setExcludedExercises(data);
    })();
  }, [initialExerciseIds]);

  // Search exercises
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('exercises')
        .select('*')
        .ilike('name', `%${searchQuery.trim()}%`)
        .limit(20);
      setSearchResults(data ?? []);
      setSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleEquipmentExclusion = (type: EquipmentType) => {
    setExcludedEquipment((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const addExerciseExclusion = (exercise: Exercise) => {
    if (!excludedExerciseIds.includes(exercise.id)) {
      setExcludedExerciseIds((prev) => [...prev, exercise.id]);
      setExcludedExercises((prev) => [...prev, exercise]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeExerciseExclusion = (exerciseId: string) => {
    setExcludedExerciseIds((prev) => prev.filter((id) => id !== exerciseId));
    setExcludedExercises((prev) => prev.filter((ex) => ex.id !== exerciseId));
  };

  const handleApply = () => {
    if (route.params?.onSave) {
      route.params.onSave({
        excludedEquipment,
        excludedExerciseIds,
      });
    }
    navigation.goBack();
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.h1}>Equipment Exclusions</Text>
        <Text style={typography.bodyMuted}>
          Exclude specific equipment types or individual movements unavailable at this gym (e.g. broken machine or no squat rack).
        </Text>

        {/* Equipment Types Exclusion */}
        <Card style={styles.card}>
          <SectionTitle>Exclude Equipment Types</SectionTitle>
          <Text style={styles.helperText}>
            Selected types will be filtered out from workout recommendations for this gym.
          </Text>

          <View style={styles.wrap}>
            {ALL_EQUIPMENT_TYPES.map((type) => {
              const isExcluded = excludedEquipment.includes(type);
              return (
                <Pressable
                  key={type}
                  onPress={() => toggleEquipmentExclusion(type)}
                  style={[
                    styles.chip,
                    isExcluded && styles.chipExcluded,
                  ]}
                >
                  <Ionicons
                    name={isExcluded ? 'close-circle' : 'checkmark-circle-outline'}
                    size={14}
                    color={isExcluded ? colors.danger : colors.textMuted}
                    style={styles.chipIcon}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      isExcluded && styles.chipTextExcluded,
                    ]}
                  >
                    {EQUIPMENT_TYPE_LABELS[type]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Specific Exercise Exclusions */}
        <Card style={styles.card}>
          <SectionTitle>Exclude Specific Exercises</SectionTitle>
          <Label>Search and add exercise to exclude</Label>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by exercise name..."
          />

          {searchResults.length > 0 && (
            <View style={styles.searchDropdown}>
              {searchResults.map((ex) => {
                const isAlreadyExcluded = excludedExerciseIds.includes(ex.id);
                return (
                  <Pressable
                    key={ex.id}
                    style={[styles.searchItem, isAlreadyExcluded && styles.searchItemDisabled]}
                    onPress={() => !isAlreadyExcluded && addExerciseExclusion(ex)}
                  >
                    <View>
                      <Text style={typography.body}>{ex.name}</Text>
                      <Text style={styles.exerciseSub}>
                        {[ex.muscle_group, ex.equipment].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Ionicons
                      name={isAlreadyExcluded ? 'checkmark' : 'add-circle-outline'}
                      size={20}
                      color={isAlreadyExcluded ? colors.accent : colors.primary}
                    />
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Currently Excluded Exercises */}
          <SectionTitle style={styles.subTitle}>Excluded Exercises ({excludedExercises.length})</SectionTitle>
          {excludedExercises.length === 0 && (
            <Text style={styles.emptyNote}>No individual exercises excluded yet.</Text>
          )}
          {excludedExercises.map((ex) => (
            <View key={ex.id} style={styles.excludedRow}>
              <View style={styles.exInfo}>
                <Text style={typography.body}>{ex.name}</Text>
                <Text style={styles.exerciseSub}>
                  {[ex.muscle_group, ex.equipment].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Pressable
                onPress={() => removeExerciseExclusion(ex.id)}
                style={styles.removeBtn}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
          ))}
        </Card>

        <Button title="Apply Exclusions" onPress={handleApply} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  card: { marginTop: spacing.md },
  helperText: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipExcluded: {
    backgroundColor: '#2D1B1E',
    borderColor: colors.danger,
  },
  chipIcon: {
    marginRight: 6,
  },
  chipText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  chipTextExcluded: {
    color: colors.danger,
    fontWeight: '700',
  },
  searchDropdown: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    marginTop: spacing.xs,
    maxHeight: 200,
  },
  searchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchItemDisabled: {
    opacity: 0.5,
  },
  exerciseSub: {
    ...typography.caption,
    color: colors.textMuted,
  },
  subTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyNote: {
    ...typography.caption,
    color: colors.textMuted,
  },
  excludedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exInfo: { flex: 1 },
  removeBtn: { padding: 8 },
});
