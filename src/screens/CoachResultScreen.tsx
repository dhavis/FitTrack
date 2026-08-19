import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ScreenContainer, SectionTitle } from '../components/ui';
import { CoachingCopy } from '../lib/coachApi';
import { WorkoutsStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'CoachResult'>;

export default function CoachResultScreen({ route, navigation }: Props) {
  const { coaching, training, nutrition, usedLlm } = route.params;
  const copy = coaching as CoachingCopy;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.h1}>Coach plan</Text>
        <Text style={typography.bodyMuted}>
          Training and nutrition generated together{usedLlm ? ' (with AI coaching notes)' : ''}.
        </Text>

        <Card style={styles.card}>
          <SectionTitle>This week</SectionTitle>
          <Text style={typography.body}>{copy.weekly_coaching}</Text>
        </Card>

        {training && (
          <Card style={styles.card}>
            <SectionTitle>Training</SectionTitle>
            <Text style={typography.body}>
              {(training.program_name as string) ?? 'Program created'}
            </Text>
            {Array.isArray(training.routine_names) && (
              <Text style={[typography.bodyMuted, styles.mt]}>
                {(training.routine_names as string[]).join(' · ')}
              </Text>
            )}
            {copy.training_tips?.map((t) => (
              <Text key={t} style={styles.bullet}>
                • {t}
              </Text>
            ))}
          </Card>
        )}

        {nutrition && (
          <Card style={styles.card}>
            <SectionTitle>Nutrition</SectionTitle>
            <Text style={typography.body}>
              {nutrition.daily_calorie_target != null
                ? `${Math.round(Number(nutrition.daily_calorie_target))} kcal`
                : 'Targets updated'}
              {nutrition.daily_protein_g != null
                ? ` · P ${Math.round(Number(nutrition.daily_protein_g))}g`
                : ''}
              {nutrition.daily_carbs_g != null ? ` · C ${Math.round(Number(nutrition.daily_carbs_g))}g` : ''}
              {nutrition.daily_fat_g != null ? ` · F ${Math.round(Number(nutrition.daily_fat_g))}g` : ''}
            </Text>
            {copy.nutrition_tips?.map((t) => (
              <Text key={t} style={styles.bullet}>
                • {t}
              </Text>
            ))}
          </Card>
        )}

        <Text style={styles.disclaimer}>{copy.disclaimer}</Text>

        <View style={styles.actions}>
          <Button title="Go to workouts" onPress={() => navigation.navigate('WorkoutsHome')} />
        </View>
        <View style={styles.actions}>
          <Button title="Done" variant="secondary" onPress={() => navigation.popToTop()} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  card: { marginTop: spacing.md },
  mt: { marginTop: spacing.xs },
  bullet: { ...typography.bodyMuted, marginTop: spacing.sm },
  disclaimer: { ...typography.caption, marginTop: spacing.md, color: colors.textMuted },
  actions: { marginTop: spacing.sm },
});