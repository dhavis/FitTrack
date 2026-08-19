import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { parseHowtoCues, resolveHowtoImageSource } from '../lib/exercises';
import { colors, radii, spacing, typography } from '../theme/theme';
import { Exercise } from '../types/db';
import { Card } from './ui';

export default function HowToPanel({ exercise }: { exercise: Exercise | null | undefined }) {
  const [open, setOpen] = useState(false);
  if (!exercise) return null;

  const imageSource = resolveHowtoImageSource(exercise.howto_image_path);
  const cues = parseHowtoCues(exercise.howto_cues);
  const hasContent = Boolean(imageSource || cues.length || exercise.instructions);

  if (!hasContent) return null;

  return (
    <Card style={styles.card}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.header}>
        <Text style={typography.h3}>How to</Text>
        <Text style={styles.toggle}>{open ? 'Hide' : 'Show'}</Text>
      </Pressable>
      {open && (
        <View style={styles.body}>
          {imageSource ? (
            <Image source={imageSource} style={styles.image} resizeMode="contain" />
          ) : (
            <View style={styles.placeholder}>
              <Text style={typography.bodyMuted}>Illustration coming soon</Text>
            </View>
          )}
          {cues.length > 0 ? (
            cues.map((cue, i) => (
              <Text key={`${cue}-${i}`} style={styles.cue}>
                {i + 1}. {cue}
              </Text>
            ))
          ) : exercise.instructions ? (
            <Text style={typography.bodyMuted}>{exercise.instructions}</Text>
          ) : null}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggle: { color: colors.primary, fontWeight: '700' },
  body: { marginTop: spacing.sm },
  image: {
    width: '100%',
    height: 180,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.sm,
  },
  placeholder: {
    height: 100,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  cue: { ...typography.bodyMuted, marginBottom: spacing.xs },
});