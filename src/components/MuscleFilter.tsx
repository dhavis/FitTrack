import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MUSCLE_FILTER_OPTIONS } from '../lib/muscles';
import { colors, fonts, radii, spacing, typography } from '../theme/theme';

export default function MuscleFilter({
  selected,
  onSelect,
  wrap = false,
}: {
  selected: string;
  onSelect: (value: string) => void;
  wrap?: boolean;
}) {
  const content = (
    <View style={wrap ? styles.wrapRow : styles.row}>
      {MUSCLE_FILTER_OPTIONS.map((option) => {
        const active = selected === option;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            style={[styles.chip, wrap && styles.chipCompact, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            hitSlop={4}
          >
            <Text style={[styles.chipText, wrap && styles.chipTextCompact, active && styles.chipTextActive]}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (wrap) {
    return content;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    marginRight: spacing.sm,
  },
  chipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.chip,
    marginRight: 0,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'none',
    fontWeight: '600',
    fontFamily: fonts.semiBold,
  },
  chipTextCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  chipTextActive: {
    color: colors.primaryForeground,
    fontWeight: '700',
    fontFamily: fonts.bold,
  },
});
