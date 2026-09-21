import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radii, spacing, typography } from '../theme/theme';

interface Props {
  style?: ViewStyle;
}

export const CANONICAL_DISCLAIMER_TEXT =
  'Educational recommendation only—not medical advice. Always consult a physician.';

export default function RecommendationDisclaimer({ style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>{CANONICAL_DISCLAIMER_TEXT}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginVertical: spacing.sm,
  },
  text: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
