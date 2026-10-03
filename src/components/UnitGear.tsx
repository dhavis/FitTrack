import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WeightUnit } from '../types/db';
import { colors, radii, spacing, typography } from '../theme/theme';

export default function UnitGear({
  unit,
  onChange,
}: {
  unit: WeightUnit;
  onChange: (unit: WeightUnit) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.gear}
        onPress={() => setOpen((value) => !value)}
        accessibilityLabel="Change units"
      >
        <Text style={styles.gearText}>⚙</Text>
      </Pressable>
      {open && (
        <View style={styles.choices}>
          {(['kg', 'lb'] as WeightUnit[]).map((choice) => (
            <Pressable
              key={choice}
              style={[styles.choice, unit === choice && styles.choiceOn]}
              onPress={() => onChange(choice)}
            >
              <Text style={[styles.choiceText, unit === choice && styles.choiceTextOn]}>{choice}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end' },
  gear: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearText: { color: colors.text, fontSize: 16 },
  choices: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  choice: { paddingHorizontal: 14, paddingVertical: 8 },
  choiceOn: { backgroundColor: colors.primary },
  choiceText: { ...typography.button, textTransform: 'uppercase' },
  choiceTextOn: { color: colors.primaryForeground },
});
