import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { WeightUnit } from '../types/db';
import { colors, radii, spacing, typography } from '../theme/theme';
import { Label, TextInput } from './ui';

export interface SetRowItem {
  key: string;
  label: string;
  detail: string;
  reps: string;
  weight: string;
  canRemove: boolean;
}

export default function SetRowList({
  rows,
  unit,
  hint,
  onAdd,
  onCommit,
  onRemove,
}: {
  rows: SetRowItem[];
  unit: WeightUnit;
  hint?: string;
  onAdd: () => void;
  onCommit: (key: string, reps: string, weight: string) => void;
  onRemove: (key: string) => void;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const editing = rows.find((row) => row.key === editingKey) ?? null;

  const open = (row: SetRowItem) => {
    setNotice(null);
    setEditingKey(row.key);
    setReps(row.reps);
    setWeight(row.weight);
  };

  return (
    <View>
      <Text style={styles.hint}>{notice ?? hint ?? 'Hold a set to change it. Drag left to remove.'}</Text>
      {rows.map((row) => (
        <Swipeable
          key={row.key}
          overshootRight={false}
          rightThreshold={48}
          enabled={row.canRemove}
          renderRightActions={() => (
            <Pressable
              style={styles.remove}
              onPress={() => {
                if (!row.canRemove) {
                  setNotice('Keep one working set, or remove the exercise.');
                  return;
                }
                setNotice(null);
                if (editingKey === row.key) setEditingKey(null);
                onRemove(row.key);
              }}
            >
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          )}
        >
          <Pressable style={styles.row} onLongPress={() => open(row)} delayLongPress={450}>
            <Text style={styles.label}>{row.label}</Text>
            <Text style={styles.detail}>{row.detail}</Text>
          </Pressable>
        </Swipeable>
      ))}
      <Pressable style={styles.add} onPress={onAdd}>
        <Text style={styles.addText}>Add set</Text>
      </Pressable>
      {editing && (
        <View style={styles.sheet}>
          <Text style={styles.sheetLabel}>{editing.label}</Text>
          <Label>Reps</Label>
          <TextInput keyboardType="number-pad" value={reps} onChangeText={setReps} />
          <Label>Weight</Label>
          <TextInput keyboardType="decimal-pad" value={weight} onChangeText={setWeight} placeholder={unit} />
          <Pressable
            style={styles.save}
            onPress={() => {
              onCommit(editing.key, reps, weight);
              setEditingKey(null);
            }}
          >
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, marginTop: spacing.sm, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  label: { ...typography.bodyMuted },
  detail: { ...typography.body },
  remove: {
    width: 88,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    ...typography.button,
    color: colors.text,
    textTransform: 'uppercase',
  },
  add: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addText: { ...typography.button, textTransform: 'uppercase' },
  sheet: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  sheetLabel: { ...typography.caption, marginBottom: spacing.xs, textTransform: 'uppercase' },
  save: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: { ...typography.button, color: colors.primaryForeground, textTransform: 'uppercase' },
});
