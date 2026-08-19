import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Button, Card, EmptyState, Label, ScreenContainer, SectionTitle, TextInput } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { displayWeight, formatWeight, toStorageWeightKg } from '../lib/units';
import { WeightStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';
import { WeightLog } from '../types/db';

type Props = NativeStackScreenProps<WeightStackParamList, 'WeightHome'>;

export default function WeightScreen({ navigation }: Props) {
  const { session, profile } = useAuth();
  const unit = profile?.weight_unit ?? 'kg';
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [weightInput, setWeightInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const { data } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', session.user.id)
      .order('logged_at', { ascending: false })
      .limit(60);
    setLogs(data ?? []);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSave = async () => {
    if (!session) return;
    const parsed = parseFloat(weightInput);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid weight.');
      return;
    }
    setError(null);
    setSaving(true);
    const weight_kg = toStorageWeightKg(parsed, unit);
    const today = new Date().toISOString().slice(0, 10);

    const { error: upsertError } = await supabase
      .from('weight_logs')
      .upsert(
        { user_id: session.user.id, weight_kg, logged_at: today, note: noteInput || null },
        { onConflict: 'user_id,logged_at' }
      );

    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setWeightInput('');
    setNoteInput('');
    fetchLogs();
  };

  const chartData = useMemo(() => {
    const chronological = [...logs].reverse().slice(-14);
    return {
      labels: chronological.map((l) => l.logged_at.slice(5)),
      datasets: [{ data: chronological.map((l) => displayWeight(l.weight_kg, unit)) }],
    };
  }, [logs, unit]);

  const latest = logs[0];
  const trend = logs.length > 1 ? logs[0].weight_kg - logs[1].weight_kg : 0;

  return (
    <ScreenContainer>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <Text style={typography.h1}>Weight</Text>
            <View style={styles.measureBtn}>
              <Button title="Body composition" variant="secondary" onPress={() => navigation.navigate('Measurements')} />
            </View>

            <Card style={styles.statsCard}>
              <View style={styles.statRow}>
                <View>
                  <Label>Latest</Label>
                  <Text style={typography.stat}>
                    {latest ? formatWeight(latest.weight_kg, unit) : '—'}
                  </Text>
                </View>
                <View>
                  <Label>Trend</Label>
                  <Text
                    style={[
                      typography.h2,
                      { color: trend > 0 ? colors.warning : trend < 0 ? colors.accent : colors.textMuted },
                    ]}
                  >
                    {trend === 0 ? '—' : `${trend > 0 ? '+' : ''}${formatWeight(trend, unit)}`}
                  </Text>
                </View>
              </View>
            </Card>

            {logs.length > 1 && (
              <Card style={styles.chartCard}>
                <LineChart
                  data={chartData}
                  width={Dimensions.get('window').width - spacing.md * 4}
                  height={180}
                  withInnerLines={false}
                  chartConfig={{
                    backgroundColor: colors.surface,
                    backgroundGradientFrom: colors.surface,
                    backgroundGradientTo: colors.surface,
                    decimalPlaces: 1,
                    color: () => colors.primary,
                    labelColor: () => colors.textMuted,
                    propsForDots: { r: '3', fill: colors.primary },
                  }}
                  bezier
                  style={{ borderRadius: 12 }}
                />
              </Card>
            )}

            <Card style={styles.formCard}>
              <SectionTitle>Log today's weight</SectionTitle>
              <View style={styles.row}>
                <View style={styles.flexInput}>
                  <TextInput
                    keyboardType="decimal-pad"
                    placeholder={`Weight (${unit})`}
                    value={weightInput}
                    onChangeText={setWeightInput}
                  />
                </View>
              </View>
              <View style={styles.field}>
                <TextInput placeholder="Note (optional)" value={noteInput} onChangeText={setNoteInput} />
              </View>
              {error && <Text style={styles.error}>{error}</Text>}
              <Button title="Save" onPress={handleSave} loading={saving} />
            </Card>

            <SectionTitle>History</SectionTitle>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.historyRow}>
            <Text style={typography.body}>{item.logged_at}</Text>
            <Text style={typography.body}>{formatWeight(item.weight_kg, unit)}</Text>
          </View>
        )}
        ListEmptyComponent={!loading ? <EmptyState message="No weight logs yet. Add your first one above." /> : null}
        contentContainerStyle={styles.listContent}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: spacing.xl },
  measureBtn: { marginTop: spacing.md },
  statsCard: { marginTop: spacing.md },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  chartCard: { marginTop: spacing.md, alignItems: 'center' },
  formCard: { marginTop: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flexInput: { flex: 1 },
  field: { marginTop: spacing.sm, marginBottom: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.sm },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
