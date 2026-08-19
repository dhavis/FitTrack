import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import ExercisePickerModal from '../components/ExercisePickerModal';
import HowToPanel from '../components/HowToPanel';
import { Button, Card, EmptyState, Label, ScreenContainer, SectionTitle, TextInput } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { WorkoutsStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';
import { Exercise, RoutineExercise } from '../types/db';

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'RoutineBuilder'>;

interface DraftExercise {
  tempId: string;
  exercise: Exercise;
  target_sets: string;
  target_reps: string;
  rest_seconds: string;
}

export default function RoutineBuilderScreen({ route, navigation }: Props) {
  const { session } = useAuth();
  const routineId = route.params?.routineId;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!routineId) return;
    (async () => {
      const { data: routine } = await supabase.from('routines').select('*').eq('id', routineId).single();
      if (routine) {
        setName(routine.name);
        setDescription(routine.description ?? '');
      }
      const { data: exercises } = await supabase
        .from('routine_exercises')
        .select('*, exercise:exercises(*)')
        .eq('routine_id', routineId)
        .order('order_index');
      setDraftExercises(
        (exercises ?? []).map((re: RoutineExercise) => ({
          tempId: re.id,
          exercise: re.exercise as Exercise,
          target_sets: String(re.target_sets),
          target_reps: String(re.target_reps),
          rest_seconds: String(re.rest_seconds),
        }))
      );
    })();
  }, [routineId]);

  const addExercise = (exercise: Exercise) => {
    setDraftExercises((prev) => [
      ...prev,
      { tempId: `${exercise.id}-${Date.now()}`, exercise, target_sets: '3', target_reps: '10', rest_seconds: '90' },
    ]);
  };

  const updateDraft = (tempId: string, field: keyof DraftExercise, value: string) => {
    setDraftExercises((prev) =>
      prev.map((d) => (d.tempId === tempId ? { ...d, [field]: value } : d))
    );
  };

  const removeDraft = (tempId: string) => {
    setDraftExercises((prev) => prev.filter((d) => d.tempId !== tempId));
  };

  const handleSave = async () => {
    if (!session) return;
    if (!name.trim()) {
      setError('Give your routine a name.');
      return;
    }
    setSaving(true);
    setError(null);

    let currentRoutineId = routineId;
    if (currentRoutineId) {
      await supabase.from('routines').update({ name, description }).eq('id', currentRoutineId);
      await supabase.from('routine_exercises').delete().eq('routine_id', currentRoutineId);
    } else {
      const { data, error: insertError } = await supabase
        .from('routines')
        .insert({ user_id: session.user.id, name, description })
        .select()
        .single();
      if (insertError || !data) {
        setSaving(false);
        setError(insertError?.message ?? 'Failed to create routine.');
        return;
      }
      currentRoutineId = data.id;
    }

    if (draftExercises.length > 0) {
      const rows = draftExercises.map((d, index) => ({
        routine_id: currentRoutineId,
        exercise_id: d.exercise.id,
        order_index: index,
        target_sets: parseInt(d.target_sets, 10) || 3,
        target_reps: parseInt(d.target_reps, 10) || 10,
        rest_seconds: parseInt(d.rest_seconds, 10) || 90,
      }));
      await supabase.from('routine_exercises').insert(rows);
    }

    setSaving(false);
    navigation.goBack();
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.h1}>{routineId ? 'Edit routine' : 'New routine'}</Text>

        <View style={styles.field}>
          <Label>Name</Label>
          <TextInput value={name} onChangeText={setName} placeholder="e.g. Push Day" />
        </View>
        <View style={styles.field}>
          <Label>Description (optional)</Label>
          <TextInput value={description} onChangeText={setDescription} placeholder="Notes about this routine" />
        </View>

        <SectionTitle>Exercises</SectionTitle>
        {draftExercises.length === 0 && <EmptyState message="No exercises added yet." />}
        {draftExercises.map((d) => (
          <Card key={d.tempId} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={typography.h3}>{d.exercise.name}</Text>
              <Text style={styles.remove} onPress={() => removeDraft(d.tempId)}>
                Remove
              </Text>
            </View>
            <HowToPanel exercise={d.exercise} />
            <View style={styles.row}>
              <View style={styles.smallInput}>
                <Label>Sets</Label>
                <TextInput
                  keyboardType="number-pad"
                  value={d.target_sets}
                  onChangeText={(v) => updateDraft(d.tempId, 'target_sets', v)}
                />
              </View>
              <View style={styles.smallInput}>
                <Label>Reps</Label>
                <TextInput
                  keyboardType="number-pad"
                  value={d.target_reps}
                  onChangeText={(v) => updateDraft(d.tempId, 'target_reps', v)}
                />
              </View>
              <View style={styles.smallInput}>
                <Label>Rest (s)</Label>
                <TextInput
                  keyboardType="number-pad"
                  value={d.rest_seconds}
                  onChangeText={(v) => updateDraft(d.tempId, 'rest_seconds', v)}
                />
              </View>
            </View>
          </Card>
        ))}

        <View style={styles.field}>
          <Button title="Add exercise" variant="secondary" onPress={() => setPickerVisible(true)} />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        <Button title="Save routine" onPress={handleSave} loading={saving} />
      </ScrollView>

      <ExercisePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={addExercise}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  field: { marginTop: spacing.md },
  exerciseCard: { marginTop: spacing.sm },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  remove: { color: colors.danger, fontWeight: '600' },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  smallInput: { flex: 1 },
  error: { color: colors.danger, marginTop: spacing.sm, marginBottom: spacing.sm },
});
