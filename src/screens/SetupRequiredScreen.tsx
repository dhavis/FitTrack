import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Card, ScreenContainer } from '../components/ui';
import { colors, spacing, typography } from '../theme/theme';

export default function SetupRequiredScreen() {
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.h1}>Setup required</Text>
        <Text style={styles.paragraph}>
          FitTrack needs a Supabase project before it can run. This only takes a couple of minutes:
        </Text>

        <Card style={styles.card}>
          <Text style={styles.step}>1. Create a free project at supabase.com</Text>
          <Text style={styles.step}>
            2. In the SQL Editor, run the migration at{' '}
            <Text style={styles.code}>supabase/migrations/0001_init.sql</Text>
          </Text>
          <Text style={styles.step}>
            3. Copy your Project URL and anon key from Settings → API
          </Text>
          <Text style={styles.step}>
            4. Paste them into the <Text style={styles.code}>.env</Text> file at the project root
            (copy from <Text style={styles.code}>.env.example</Text> if you haven't)
          </Text>
          <Text style={styles.step}>5. Restart the Expo dev server (stop it and run npm start again)</Text>
        </Card>

        <Text style={styles.paragraph}>Full details are in the project README.</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
  paragraph: { ...typography.bodyMuted, marginTop: spacing.md },
  card: { marginTop: spacing.lg, gap: spacing.sm },
  step: { ...typography.body, marginBottom: spacing.sm },
  code: { color: colors.primary, fontFamily: 'monospace' },
});
