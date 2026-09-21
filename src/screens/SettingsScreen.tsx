import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Label, ScreenContainer, SectionTitle, TextInput } from '../components/ui';
import GlossaryTip from '../components/GlossaryTip';
import { useAuth } from '../hooks/useAuth';
import { equipmentLabel } from '../lib/goalExplanations';
import { fetchUserGymProfiles, resolveActiveGymProfile } from '../lib/gymProfiles';
import { displayLength, toStorageLengthCm } from '../lib/units';
import { supabase } from '../lib/supabase';
import { SettingsStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';
import { Gender, GymProfile, LengthUnit, ResolvedGymProfile, WeightUnit } from '../types/db';

type NavProp = NativeStackNavigationProp<SettingsStackParamList, 'SettingsHome'>;

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'other', label: 'Other / prefer not to say' },
];

export default function SettingsScreen() {
  const navigation = useNavigation<NavProp>();
  const { session, profile, refreshProfile, signOut } = useAuth();
  const unit = profile?.weight_unit ?? 'kg';
  const lengthUnit = profile?.length_unit ?? 'cm';
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [age, setAge] = useState(profile?.age != null ? String(profile.age) : '');
  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);
  const [height, setHeight] = useState(
    profile?.height_cm != null ? String(displayLength(profile.height_cm, lengthUnit)) : ''
  );
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const [activeGym, setActiveGym] = useState<ResolvedGymProfile | null>(null);
  const [mainGym, setMainGym] = useState<GymProfile | null>(null);

  const loadGyms = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const [resolved, allGyms] = await Promise.all([
        resolveActiveGymProfile(),
        fetchUserGymProfiles(false),
      ]);
      setActiveGym(resolved);
      setMainGym(allGyms.find((g) => g.is_main) ?? null);
    } catch {
      // Ignore background error
    }
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadGyms();
    }, [loadGyms])
  );

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '');
    setAge(profile?.age != null ? String(profile.age) : '');
    setGender(profile?.gender ?? null);
    setHeight(profile?.height_cm != null ? String(displayLength(profile.height_cm, lengthUnit)) : '');
  }, [profile, lengthUnit]);

  const updateUnits = async (weight_unit?: WeightUnit, length_unit?: LengthUnit) => {
    if (!session) return;
    await supabase
      .from('profiles')
      .update({ ...(weight_unit && { weight_unit }), ...(length_unit && { length_unit }) })
      .eq('id', session.user.id);
    refreshProfile();
  };

  const saveProfile = async () => {
    if (!session) return;
    setSaving(true);
    setSavedMessage(null);
    const parsedAge = parseInt(age, 10);
    const parsedHeight = parseFloat(height);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName || null,
        age: Number.isNaN(parsedAge) ? null : Math.min(100, Math.max(13, parsedAge)),
        gender,
        height_cm: Number.isNaN(parsedHeight) ? null : toStorageLengthCm(parsedHeight, lengthUnit),
      })
      .eq('id', session.user.id);
    setSaving(false);
    if (error) {
      setSavedMessage(error.message);
      return;
    }
    await refreshProfile();
    setSavedMessage('Profile saved. Nutrition targets can use age and gender.');
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.h1}>Settings</Text>

        <Card style={styles.card}>
          <SectionTitle>Profile</SectionTitle>
          <Label>Display name</Label>
          <TextInput value={displayName} onChangeText={setDisplayName} />

          <View style={styles.field}>
            <Label>Age</Label>
            <TextInput
              keyboardType="number-pad"
              value={age}
              onChangeText={setAge}
              placeholder="Used for calorie estimates"
            />
          </View>

          <View style={styles.field}>
            <Label>Gender</Label>
            <View style={styles.explainRow}>
              <Text style={styles.explainText}>Age and gender help estimate how much energy your body uses each day.</Text>
              <GlossaryTip term="calorie_estimate" />
            </View>
            <View style={styles.wrap}>
              {GENDERS.map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => setGender(g.id)}
                  style={[styles.chip, gender === g.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, gender === g.id && styles.chipTextActive]}>{g.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Label>Height ({lengthUnit})</Label>
            <TextInput
              keyboardType="decimal-pad"
              value={height}
              onChangeText={setHeight}
              placeholder="Improves calorie accuracy"
            />
          </View>

          <View style={styles.field}>
            <Button title="Save profile" onPress={saveProfile} loading={saving} />
          </View>
          {savedMessage && <Text style={styles.saved}>{savedMessage}</Text>}
        </Card>

        <Card style={styles.card}>
          <SectionTitle>Gyms & equipment</SectionTitle>
          <Text style={styles.gymInfoLine}>
            Main gym:{' '}
            <Text style={styles.gymInfoValue}>
              {mainGym ? `${mainGym.name} (${equipmentLabel(mainGym.base_preset)})` : 'Not set'}
            </Text>
          </Text>
          <Text style={styles.gymInfoLine}>
            Active gym:{' '}
            <Text style={styles.gymInfoValue}>
              {activeGym?.profile
                ? `${activeGym.profile.name} (${equipmentLabel(activeGym.profile.base_preset)})${
                    activeGym.profile.kind === 'temporary' ? ' · Temporary visit' : ''
                  }`
                : 'Resolving...'}
            </Text>
          </Text>
          <View style={styles.field}>
            <Button
              title="Manage gym profiles"
              variant="secondary"
              onPress={() => navigation.navigate('GymProfiles')}
            />
          </View>
        </Card>

        <Card style={styles.card}>
          <SectionTitle>Units</SectionTitle>
          <Label>Weight</Label>
          <View style={styles.row}>
            <View style={styles.flexButton}>
              <Button
                title="kg"
                variant={unit === 'kg' ? 'primary' : 'secondary'}
                onPress={() => updateUnits('kg')}
              />
            </View>
            <View style={styles.flexButton}>
              <Button
                title="lb"
                variant={unit === 'lb' ? 'primary' : 'secondary'}
                onPress={() => updateUnits('lb')}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Label>Length</Label>
            <View style={styles.row}>
              <View style={styles.flexButton}>
                <Button
                  title="cm"
                  variant={lengthUnit === 'cm' ? 'primary' : 'secondary'}
                  onPress={() => updateUnits(undefined, 'cm')}
                />
              </View>
              <View style={styles.flexButton}>
                <Button
                  title="in"
                  variant={lengthUnit === 'in' ? 'primary' : 'secondary'}
                  onPress={() => updateUnits(undefined, 'in')}
                />
              </View>
            </View>
          </View>
        </Card>

        <View style={styles.field}>
          <Text style={typography.bodyMuted}>Signed in as {session?.user.email}</Text>
        </View>
        <View style={styles.field}>
          <Button title="Sign out" variant="danger" onPress={signOut} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  card: { marginTop: spacing.md },
  field: { marginTop: spacing.md },
  explainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, marginBottom: spacing.xs },
  explainText: { ...typography.bodyMuted, flex: 1, lineHeight: 20 },
  row: { flexDirection: 'row', gap: spacing.sm },
  flexButton: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: colors.background },
  saved: { color: colors.accent, marginTop: spacing.sm },
  gymInfoLine: { ...typography.body, color: colors.textMuted, marginBottom: 4 },
  gymInfoValue: { color: colors.text, fontWeight: '600' },
});