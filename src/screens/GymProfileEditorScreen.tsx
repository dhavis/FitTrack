import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Button,
  Card,
  Label,
  ScreenContainer,
  SectionTitle,
  TextInput,
} from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { EQUIPMENT_HINT, EQUIPMENT_OPTIONS } from '../lib/goalExplanations';
import {
  fetchGymProfileDetails,
  saveGymProfile,
  setActiveGymProfile,
  setMainGymProfile,
} from '../lib/gymProfiles';
import { SettingsStackParamList } from '../navigation/types';
import { colors, radii, spacing, typography } from '../theme/theme';
import {
  EquipmentPref,
  EquipmentType,
  GymProfileKind,
} from '../types/db';

type RouteType = RouteProp<SettingsStackParamList, 'GymProfileEditor'>;
type NavType = NativeStackNavigationProp<SettingsStackParamList, 'GymProfileEditor'>;

const DURATION_OPTIONS = [
  { days: 3, label: '3 days' },
  { days: 7, label: '7 days (1 week)' },
  { days: 14, label: '14 days (2 weeks)' },
  { days: 30, label: '30 days (1 month)' },
];

export default function GymProfileEditorScreen() {
  const navigation = useNavigation<NavType>();
  const route = useRoute<RouteType>();

  const profileId = route.params?.profileId;
  const isInitialTemp = route.params?.isTemporary ?? false;

  const [name, setName] = useState('');
  const [kind, setKind] = useState<GymProfileKind>(isInitialTemp ? 'temporary' : 'permanent');
  const [basePreset, setBasePreset] = useState<EquipmentPref>('full_gym');
  const [durationDays, setDurationDays] = useState(7);
  const [customDays, setCustomDays] = useState('');
  const [isMain, setIsMain] = useState(false);
  const [setAsMain, setSetAsMain] = useState(false);
  const [useNow, setUseNow] = useState(true);

  const [excludedEquipment, setExcludedEquipment] = useState<EquipmentType[]>([]);
  const [excludedExerciseIds, setExcludedExerciseIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId) return;
    setLoading(true);
    (async () => {
      try {
        const details = await fetchGymProfileDetails(profileId);
        setName(details.profile.name);
        setKind(details.profile.kind);
        setBasePreset(details.profile.base_preset);
        setIsMain(details.profile.is_main);
        setSetAsMain(details.profile.is_main);
        setExcludedEquipment(details.excluded_equipment);
        setExcludedExerciseIds(details.excluded_exercise_ids);

        if (details.profile.expires_at) {
          const diff = new Date(details.profile.expires_at).getTime() - Date.now();
          const daysLeft = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
          setDurationDays(daysLeft);
        }
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load profile details');
      } finally {
        setLoading(false);
      }
    })();
  }, [profileId]);

  const handleOpenExclusions = () => {
    navigation.navigate('GymExclusions', {
      excludedEquipment,
      excludedExerciseIds,
      onSave: (result) => {
        setExcludedEquipment(result.excludedEquipment);
        setExcludedExerciseIds(result.excludedExerciseIds);
      },
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a gym name.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let expiresAt: string | null = null;
      if (kind === 'temporary') {
        const totalDays = parseInt(customDays, 10) || durationDays || 7;
        expiresAt = new Date(Date.now() + totalDays * 24 * 60 * 60 * 1000).toISOString();
      }

      const result = await saveGymProfile({
        profileId,
        name: name.trim(),
        basePreset,
        kind,
        expiresAt,
        excludedEquipment,
        excludedExerciseIds,
      });

      const savedId = result.profile.id;

      if (kind === 'permanent' && setAsMain && !isMain) {
        await setMainGymProfile(savedId);
      }

      if (useNow) {
        await setActiveGymProfile(savedId);
      }

      setSaving(false);
      navigation.goBack();
    } catch (err: any) {
      setSaving(false);
      setError(err?.message ?? 'Failed to save gym profile');
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.h1}>
          {profileId ? 'Edit Gym Profile' : kind === 'temporary' ? 'New Temporary Visit' : 'New Gym Profile'}
        </Text>

        {/* Profile Kind Selector */}
        {!isMain && (
          <View style={styles.kindTabs}>
            <Pressable
              style={[styles.kindTab, kind === 'permanent' && styles.kindTabActive]}
              onPress={() => {
                setKind('permanent');
                setError(null);
              }}
            >
              <Text style={[styles.kindTabText, kind === 'permanent' && styles.kindTabTextActive]}>
                Permanent Gym
              </Text>
            </Pressable>
            <Pressable
              style={[styles.kindTab, kind === 'temporary' && styles.kindTabActive]}
              onPress={() => {
                setKind('temporary');
                setSetAsMain(false);
                setError(null);
              }}
            >
              <Text style={[styles.kindTabText, kind === 'temporary' && styles.kindTabTextActive]}>
                Temporary Visit
              </Text>
            </Pressable>
          </View>
        )}

        {/* Basic Info */}
        <Card style={styles.card}>
          <Label>Gym Name</Label>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={kind === 'temporary' ? 'e.g. Hotel Gym - Chicago' : 'e.g. Main Fitness Center'}
          />

          {/* Base Preset Chips */}
          <SectionTitle style={styles.subTitle}>Equipment Preset</SectionTitle>
          <View style={styles.wrap}>
            {EQUIPMENT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => setBasePreset(opt.id)}
                style={[styles.chip, basePreset === opt.id && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, basePreset === opt.id && styles.chipTextActive]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>{EQUIPMENT_HINT}</Text>
        </Card>

        {/* Temporary Visit Expiration */}
        {kind === 'temporary' && (
          <Card style={styles.card}>
            <SectionTitle>Visit Duration</SectionTitle>
            <Text style={styles.helperText}>
              Temporary visits automatically expire and revert your Active gym to your Main gym.
            </Text>

            <View style={styles.wrap}>
              {DURATION_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.days}
                  onPress={() => {
                    setDurationDays(opt.days);
                    setCustomDays('');
                  }}
                  style={[
                    styles.chip,
                    durationDays === opt.days && !customDays && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      durationDays === opt.days && !customDays && styles.chipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.field}>
              <Label>Or custom days</Label>
              <TextInput
                keyboardType="number-pad"
                value={customDays}
                onChangeText={(v) => {
                  setCustomDays(v);
                  if (v) setDurationDays(parseInt(v, 10) || 7);
                }}
                placeholder="e.g. 10"
              />
            </View>
          </Card>
        )}

        {/* Exclusions Card */}
        <Card style={styles.card}>
          <SectionTitle>Exclusions</SectionTitle>
          <Text style={styles.helperText}>
            {excludedEquipment.length === 0 && excludedExerciseIds.length === 0
              ? 'No equipment or exercises excluded yet.'
              : `${excludedEquipment.length} equipment types and ${excludedExerciseIds.length} exercises excluded.`}
          </Text>

          <Button
            title="Choose Exclusions"
            variant="secondary"
            onPress={handleOpenExclusions}
          />
        </Card>

        {/* Options / Main Gym */}
        <Card style={styles.card}>
          <SectionTitle>Activation & Settings</SectionTitle>

          {kind === 'permanent' && (
            <Pressable
              style={styles.checkboxRow}
              onPress={() => !isMain && setSetAsMain(!setAsMain)}
            >
              <View style={[styles.checkbox, (isMain || setAsMain) && styles.checkboxActive]}>
                {(isMain || setAsMain) && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.checkboxLabelWrap}>
                <Text style={styles.checkboxLabel}>Set as Main gym</Text>
                <Text style={styles.checkboxSub}>
                  {isMain
                    ? 'This is currently your Main baseline gym.'
                    : 'Your baseline default gym profile.'}
                </Text>
              </View>
            </Pressable>
          )}

          <Pressable
            style={styles.checkboxRow}
            onPress={() => setUseNow(!useNow)}
          >
            <View style={[styles.checkbox, useNow && styles.checkboxActive]}>
              {useNow && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={styles.checkboxLabelWrap}>
              <Text style={styles.checkboxLabel}>Use this gym now</Text>
              <Text style={styles.checkboxSub}>
                Set as Active gym for workout generation and tracking immediately.
              </Text>
            </View>
          </Pressable>
        </Card>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Button
          title={profileId ? 'Save Changes' : 'Create Gym Profile'}
          onPress={handleSave}
          loading={saving || loading}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  card: { marginTop: spacing.md },
  kindTabs: {
    flexDirection: 'row',
    marginTop: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kindTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  kindTabActive: {
    backgroundColor: colors.surface,
  },
  kindTabText: {
    ...typography.body,
    color: colors.textMuted,
    fontWeight: '600',
  },
  kindTabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  subTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.background,
    fontWeight: '700',
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  helperText: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  field: {
    marginTop: spacing.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.background,
    fontWeight: '800',
    fontSize: 13,
  },
  checkboxLabelWrap: {
    flex: 1,
  },
  checkboxLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  checkboxSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  errorText: {
    color: colors.danger,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
});
