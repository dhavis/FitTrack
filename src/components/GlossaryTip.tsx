import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlossaryKey, getGlossaryEntry } from '../lib/glossary';
import { colors, radii, spacing, typography } from '../theme/theme';

export interface GlossaryTipProps {
  term: GlossaryKey;
  title?: string;
  body?: string;
  style?: ViewStyle;
  iconColor?: string;
  iconSize?: number;
  accessibilityLabel?: string;
}

export default function GlossaryTip({
  term,
  title,
  body,
  style,
  iconColor = colors.textMuted,
  iconSize = 20,
  accessibilityLabel = 'What this means',
}: GlossaryTipProps) {
  const [visible, setVisible] = useState(false);
  const entry = getGlossaryEntry(term);
  const displayTitle = title || entry.title;
  const displayBody = body || entry.body;

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        style={[styles.hitTarget, style]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Opens a short definition popover"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="information-circle-outline" size={iconSize} color={iconColor} />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.popover} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.title}>{displayTitle}</Text>
              <Pressable
                onPress={() => setVisible(false)}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.body}>{displayBody}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hitTarget: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  popover: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
});
