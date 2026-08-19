import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import HowToPanel from '../components/HowToPanel';
import MuscleFilter from '../components/MuscleFilter';
import { Button, Card, EmptyState, Label, ScreenContainer, SectionTitle, TextInput } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { MUSCLE_GROUPS } from '../lib/muscles';
import { supabase } from '../lib/supabase';
import { colors, spacing, typography } from '../theme/theme';
import { Exercise } from '../types/db';

export default function ExerciseLibraryScreen() {
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('All');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscleGroup, setNewMuscleGroup] = useState('Chest');
  const [newEquipment, setNewEquipment] = useState('');

  const load = async () => {
    let req = supabase.from('exercises').select('*').order('name');
    if (query.trim()) req = req.ilike('name', `%${query.trim()}%`);
    if (muscleFilter !== 'All') req = req.eq('muscle_group', muscleFilter);
    const { data } = await req;
    setExercises(data ?? []);
  };

  useEffect(() => {
    const handle = setTimeout(load, 200);
    return () => clearTimeout(handle);
  }, [query, muscleFilter]);

  const handleAddCustom = async () => {
    if (!session || !newName.trim()) return;
    await supabase.from('exercises').insert({
      user_id: session.user.id,
      name: newName.trim(),
      muscle_group: newMuscleGroup.trim() || null,
      equipment: newEquipment.trim() || null,
    });
    setNewName('');
    setNewMuscleGroup('Chest');
    setNewEquipment('');
    setShowAddForm(false);
    load();
  };

  return (
    <ScreenContainer>
      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <Text style={typography.h1}>Exercise Library</Text>
            <View style={styles.field}>
              <TextInput placeholder="Search exercises..." value={query} onChangeText={setQuery} />
            </View>
            <Text style={styles.filterLabel}>Filter by muscle</Text>
            <MuscleFilter selected={muscleFilter} onSelect={setMuscleFilter} />
            {!showAddForm ? (
              <View style={styles.field}>
                <Button title="Add custom exercise" variant="secondary" onPress={() => setShowAddForm(true)} />
              </View>
            ) : (
              <Card style={styles.field}>
                <SectionTitle>New custom exercise</SectionTitle>
                <View style={styles.formField}>
                  <Label>Name</Label>
                  <TextInput value={newName} onChangeText={setNewName} placeholder="e.g. Cable Fly" />
                </View>
                <View style={styles.formField}>
                  <Label>Muscle group</Label>
                  <View style={styles.musclePickerRow}>
                    {MUSCLE_GROUPS.map((group) => {
                      const active = newMuscleGroup === group;
                      return (
                        <Pressable key={group} onPress={() => setNewMuscleGroup(group)}>
                          <Text style={[styles.muscleOption, active && styles.muscleOptionActive]}>{group}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <View style={styles.formField}>
                  <Label>Equipment</Label>
                  <TextInput value={newEquipment} onChangeText={setNewEquipment} placeholder="e.g. Cable" />
                </View>
                <View style={styles.row}>
                  <View style={styles.flexButton}>
                    <Button title="Cancel" variant="ghost" onPress={() => setShowAddForm(false)} />
                  </View>
                  <View style={styles.flexButton}>
                    <Button title="Save" onPress={handleAddCustom} />
                  </View>
                </View>
              </Card>
            )}
            <Text style={styles.count}>
              {exercises.length} exercise{exercises.length === 1 ? '' : 's'}
              {muscleFilter !== 'All' ? ` in ${muscleFilter}` : ''}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.exerciseCard}>
            <Text style={typography.h3}>{item.name}</Text>
            <Text style={typography.bodyMuted}>
              {[item.muscle_group, item.equipment].filter(Boolean).join(' - ')}
            </Text>
            {item.instructions ? <Text style={styles.instructions}>{item.instructions}</Text> : null}
            <HowToPanel exercise={item} />
          </Card>
        )}
        ListEmptyComponent={<EmptyState message="No exercises found for this filter." />}
        contentContainerStyle={styles.listContent}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: spacing.md },
  formField: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', marginTop: spacing.sm },
  flexButton: { flex: 1, marginRight: spacing.sm },
  exerciseCard: { marginBottom: spacing.sm },
  instructions: { ...typography.bodyMuted, marginTop: spacing.xs },
  listContent: { paddingBottom: spacing.xl },
  count: { ...typography.caption, marginTop: spacing.sm, marginBottom: spacing.sm },
  filterLabel: { ...typography.caption, marginTop: spacing.md, marginBottom: spacing.xs },
  musclePickerRow: { flexDirection: 'row', flexWrap: 'wrap' },
  muscleOption: {
    ...typography.caption,
    color: colors.textMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  muscleOptionActive: {
    color: colors.background,
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});