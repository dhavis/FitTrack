import React, { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import MuscleFilter from './MuscleFilter';
import { supabase } from '../lib/supabase';
import { colors, radii, spacing, typography } from '../theme/theme';
import { Exercise } from '../types/db';
import { EmptyState, TextInput } from './ui';

export default function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
}) {
  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('All');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    const handle = setTimeout(async () => {
      let req = supabase.from('exercises').select('*').order('name');
      if (query.trim()) req = req.ilike('name', `%${query.trim()}%`);
      if (muscleFilter !== 'All') req = req.eq('muscle_group', muscleFilter);
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
  }, [visible, query, muscleFilter]);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setMuscleFilter('All');
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={typography.h2}>Choose an exercise</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        <TextInput
          placeholder="Search exercises..."
          value={query}
          onChangeText={setQuery}
          style={styles.search}
        />
        <MuscleFilter selected={muscleFilter} onSelect={setMuscleFilter} />
        <FlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => {
                onSelect(item);
                onClose();
              }}
            >
              <View>
                <Text style={typography.body}>{item.name}</Text>
                <Text style={typography.bodyMuted}>
                  {[item.muscle_group, item.equipment].filter(Boolean).join(' - ')}
                </Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={!loading ? <EmptyState message="No exercises found for this filter." /> : null}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60, paddingHorizontal: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  close: { color: colors.primary, fontWeight: '700' },
  search: { marginBottom: spacing.sm },
  row: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderRadius: radii.sm,
  },
});
