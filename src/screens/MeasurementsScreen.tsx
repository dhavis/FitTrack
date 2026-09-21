import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState, Label, ScreenContainer, SectionTitle, TextInput } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { displayLength, toStorageLengthCm } from '../lib/units';
import { colors, spacing, typography } from '../theme/theme';
import { BodyMeasurement } from '../types/db';

export default function MeasurementsScreen() {
  const { session, profile } = useAuth();
  const unit = profile?.length_unit ?? 'cm';
  const [logs, setLogs] = useState<BodyMeasurement[]>([]);
  const [bodyFat, setBodyFat] = useState('');
  const [waist, setWaist] = useState('');
  const [chest, setChest] = useState('');
  const [hips, setHips] = useState('');
  const [armL, setArmL] = useState('');
  const [armR, setArmR] = useState('');
  const [thighL, setThighL] = useState('');
  const [thighR, setThighR] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', session.user.id)
      .order('logged_at', { ascending: false })
      .limit(30);
    setLogs(data ?? []);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const parseLen = (v: string) => {
    const n = parseFloat(v);
    if (Number.isNaN(n)) return null;
    return toStorageLengthCm(n, unit);
  };

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    setError(null);
    const today = new Date().toISOString().slice(0, 10);
    const bf = bodyFat ? parseFloat(bodyFat) : null;
    const { error: upsertError } = await supabase.from('body_measurements').upsert(
      {
        user_id: session.user.id,
        logged_at: today,
        body_fat_pct: bf != null && !Number.isNaN(bf) ? bf : null,
        waist_cm: parseLen(waist),
        chest_cm: parseLen(chest),
        hips_cm: parseLen(hips),
        arm_left_cm: parseLen(armL),
        arm_right_cm: parseLen(armR),
        thigh_left_cm: parseLen(thighL),
        thigh_right_cm: parseLen(thighR),
      },
      { onConflict: 'user_id,logged_at' }
    );
    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setBodyFat('');
    setWaist('');
    setChest('');
    setHips('');
    setArmL('');
    setArmR('');
    setThighL('');
    setThighR('');
    load();
  };

  const fmt = (cm: number | null) => (cm == null ? '-' : `${displayLength(cm, unit).toFixed(1)} ${unit}`);

  return (
    <ScreenContainer>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <Text style={typography.h1}>Body composition</Text>
            <Card style={styles.card}>
              <SectionTitle>Log today</SectionTitle>
              <View style={styles.field}>
                <Label>Body fat %</Label>
                <TextInput keyboardType="decimal-pad" value={bodyFat} onChangeText={setBodyFat} />
              </View>
              <View style={styles.row}>
                <View style={styles.half}>
                  <Label>Waist ({unit})</Label>
                  <TextInput keyboardType="decimal-pad" value={waist} onChangeText={setWaist} />
                </View>
                <View style={styles.half}>
                  <Label>Chest ({unit})</Label>
                  <TextInput keyboardType="decimal-pad" value={chest} onChangeText={setChest} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.half}>
                  <Label>Hips ({unit})</Label>
                  <TextInput keyboardType="decimal-pad" value={hips} onChangeText={setHips} />
                </View>
                <View style={styles.half}>
                  <Label>Arm L / R ({unit})</Label>
                  <View style={styles.row}>
                    <View style={styles.half}>
                      <TextInput keyboardType="decimal-pad" value={armL} onChangeText={setArmL} />
                    </View>
                    <View style={styles.half}>
                      <TextInput keyboardType="decimal-pad" value={armR} onChangeText={setArmR} />
                    </View>
                  </View>
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.half}>
                  <Label>Thigh L ({unit})</Label>
                  <TextInput keyboardType="decimal-pad" value={thighL} onChangeText={setThighL} />
                </View>
                <View style={styles.half}>
                  <Label>Thigh R ({unit})</Label>
                  <TextInput keyboardType="decimal-pad" value={thighR} onChangeText={setThighR} />
                </View>
              </View>
              {error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.field}>
                <Button title="Save measurements" onPress={handleSave} loading={saving} />
              </View>
            </Card>
            <Card style={styles.connectedCard}>
              <Text style={typography.h3}>Connected devices — coming later</Text>
              <Text style={styles.connectedBody}>
                In the future, you’ll be able to bring in readings from home smart scales and gym or clinic machines. HealthKit and Google Fit may also serve as connection hubs.
              </Text>
              <Text style={styles.connectedDisclaimer}>
                Device readings are estimates, not medical advice.
              </Text>
            </Card>
            <SectionTitle>History</SectionTitle>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.historyCard}>
            <Text style={typography.h3}>{item.logged_at}</Text>
            <Text style={typography.bodyMuted}>
              BF {item.body_fat_pct != null ? `${item.body_fat_pct}%` : '-'} | Waist {fmt(item.waist_cm)} | Chest{' '}
              {fmt(item.chest_cm)}
            </Text>
            <Text style={typography.bodyMuted}>
              Hips {fmt(item.hips_cm)} | Arms {fmt(item.arm_left_cm)}/{fmt(item.arm_right_cm)} | Thighs{' '}
              {fmt(item.thigh_left_cm)}/{fmt(item.thigh_right_cm)}
            </Text>
          </Card>
        )}
        ListEmptyComponent={<EmptyState message="No measurements yet." />}
        contentContainerStyle={styles.content}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  card: { marginTop: spacing.md, marginBottom: spacing.md },
  connectedCard: { marginBottom: spacing.md },
  connectedBody: {
    ...typography.body,
    marginTop: spacing.sm,
    lineHeight: 21,
  },
  connectedDisclaimer: {
    ...typography.caption,
    marginTop: spacing.sm,
    color: colors.textMuted,
    lineHeight: 16,
  },
  field: { marginTop: spacing.sm },
  row: { flexDirection: 'row', marginTop: spacing.sm },
  half: { flex: 1, marginRight: spacing.sm },
  historyCard: { marginBottom: spacing.sm },
  error: { color: colors.danger, marginTop: spacing.sm },
});