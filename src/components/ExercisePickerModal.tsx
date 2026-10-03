import React, { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import ActiveGymSwitcher from './ActiveGymSwitcher';
import EquipmentFilter from './EquipmentFilter';
import MuscleFilter from './MuscleFilter';
import { useActiveGymProfile } from '../hooks/useActiveGymProfile';
import { isExerciseAllowed } from '../lib/equipmentPolicy';
import { supabase } from '../lib/supabase';
import { colors, radii, spacing, typography } from '../theme/theme';
import { Exercise } from '../types/db';
import { EmptyState, Label, TextInput } from './ui';

export default function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
}) {
  const { activeGym, refresh } = useActiveGymProfile();
  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('All');
  const [equipmentFilter, setEquipmentFilter] = useState('All');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      refresh();
    }
  }, [visible, refresh]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    const handle = setTimeout(async () => {
      let req = supabase.from('exercises').select('*').order('name');
      if (query.trim()) req = req.ilike('name', `%${query.trim()}%`);
      if (muscleFilter !== 'All') req = req.eq('muscle_group', muscleFilter);
      if (equipmentFilter !== 'All') req = req.ilike('equipment', equipmentFilter);
      const { data } = await req;
      if (active) {
        setExercises(data ?? []);
        setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [visible, query, muscleFilter, equipmentFilter]);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setMuscleFilter('All');
      setEquipmentFilter('All');
    }
  }, [visible]);

  const hasActiveFilters = query.trim().length > 0 || muscleFilter !== 'All' || equipmentFilter !== 'All';

  const handleClearFilters = () => {
    setQuery('');
    setMuscleFilter('All');
    setEquipmentFilter('All');
  };

  const gymPolicy = activeGym
    ? {
        base_preset: activeGym.profile.base_preset,
        excluded_equipment: activeGym.excluded_equipment,
        excluded_exercise_ids: activeGym.excluded_exercise_ids,
      }
    : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.controls}>
          <View style={styles.header}>
            <Text style={typography.h2}>Choose an exercise</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close exercise picker">
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.switcherWrap}>
            <ActiveGymSwitcher compact />
          </View>

          <TextInput
            placeholder="Search exercises..."
            value={query}
            onChangeText={setQuery}
            style={styles.search}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />

          <View style={styles.filterSection}>
            <Label>Muscle</Label>
            <MuscleFilter selected={muscleFilter} onSelect={setMuscleFilter} wrap />
          </View>

          <View style={styles.filterSection}>
            <Label>Equipment</Label>
            <EquipmentFilter selected={equipmentFilter} onSelect={setEquipmentFilter} wrap />
          </View>

          <View style={styles.statusBar}>
            <Text style={styles.countText}>
              {loading ? 'Searching...' : `${exercises.length} exercise${exercises.length === 1 ? '' : 's'}`}
            </Text>
            {hasActiveFilters && (
              <Pressable
                onPress={handleClearFilters}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear all filters"
              >
                <Text style={styles.clearText}>Clear filters</Text>
              </Pressable>
            )}
          </View>
        </View>

        <FlatList
          style={styles.list}
          data={exercises}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const allowed = isExerciseAllowed(item, gymPolicy);

            return (
              <Pressable
                style={[styles.row, !allowed && styles.rowUnavailable]}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <View style={styles.rowContent}>
                  <View style={styles.nameRow}>
                    <Text style={[typography.body, !allowed && styles.textMuted]}>
                      {item.name}
                    </Text>
                    {!allowed && (
                      <View style={styles.unavailableBadge}>
                        <Text style={styles.unavailableBadgeText}>Unavailable at gym</Text>
                      </View>
                    )}
                  </View>
                  <Text style={typography.bodyMuted}>
                    {[item.muscle_group, item.equipment].filter(Boolean).join(' - ')}
                  </Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={!loading ? <EmptyState message="No exercises found for this filter." /> : null}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.background,
    paddingTop: 60,
    paddingHorizontal: spacing.md,
  },
  controls: {
    flexGrow: 0,
    flexShrink: 0,
    zIndex: 2,
    backgroundColor: colors.background,
  },
  list: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  close: {
    color: colors.primary,
    fontWeight: '700',
  },
  switcherWrap: {
    marginBottom: spacing.xs,
  },
  search: {
    marginBottom: spacing.xs,
  },
  filterSection: {
    marginBottom: spacing.xs,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
  },
  countText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  clearText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  row: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderRadius: radii.sm,
  },
  rowUnavailable: {
    opacity: 0.85,
  },
  rowContent: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  textMuted: {
    color: colors.textMuted,
  },
  unavailableBadge: {
    backgroundColor: '#331F21',
    borderColor: colors.danger,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  unavailableBadgeText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
    fontSize: 9,
  },
});
