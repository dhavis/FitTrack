import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  ScreenContainer,
  SectionTitle,
} from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { equipmentLabel } from '../lib/goalExplanations';
import {
  archiveGymProfile,
  convertGymProfileToPermanent,
  endTemporaryGymProfile,
  fetchUserGymProfiles,
  resolveActiveGymProfile,
  setActiveGymProfile,
  setMainGymProfile,
} from '../lib/gymProfiles';
import { SettingsStackParamList } from '../navigation/types';
import { colors, radii, spacing, typography } from '../theme/theme';
import { GymProfile, ResolvedGymProfile } from '../types/db';

type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'GymProfiles'>;

export default function GymProfilesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { session } = useAuth();

  const [activeGym, setActiveGym] = useState<ResolvedGymProfile | null>(null);
  const [profiles, setProfiles] = useState<GymProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    setActionError(null);
    try {
      const [resolved, allProfiles] = await Promise.all([
        resolveActiveGymProfile(),
        fetchUserGymProfiles(false),
      ]);
      setActiveGym(resolved);
      setProfiles(allProfiles);
    } catch (err: any) {
      setActionError(err?.message ?? 'Failed to load gym profiles');
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleSetActive = async (profileId: string) => {
    try {
      await setActiveGymProfile(profileId);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to switch active gym');
    }
  };

  const handleSetMain = async (profileId: string) => {
    try {
      await setMainGymProfile(profileId);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to set main gym profile');
    }
  };

  const handleConvertToPermanent = async (profileId: string) => {
    try {
      await convertGymProfileToPermanent(profileId);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to convert profile');
    }
  };

  const handleEndTemporary = async (profileId: string) => {
    Alert.alert(
      'End Temporary Visit',
      'This will archive this temporary visit and revert your active gym to your Main gym.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Visit',
          style: 'destructive',
          onPress: async () => {
            try {
              await endTemporaryGymProfile(profileId);
              await load();
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Failed to end temporary visit');
            }
          },
        },
      ]
    );
  };

  const handleArchive = async (profileId: string, name: string) => {
    Alert.alert(
      'Archive Gym Profile',
      `Are you sure you want to archive "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveGymProfile(profileId);
              await load();
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Failed to archive profile');
            }
          },
        },
      ]
    );
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return '';
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Expired';
    if (days === 1) return '1 day remaining';
    return `${days} days remaining`;
  };

  const activeId = activeGym?.profile?.id;
  const permanentProfiles = profiles.filter((p) => p.kind === 'permanent');
  const temporaryProfiles = profiles.filter((p) => p.kind === 'temporary');

  return (
    <ScreenContainer>
      <FlatList
        data={[]}
        keyExtractor={() => ''}
        renderItem={null}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <Text style={typography.h1}>Gym Profiles</Text>
            <Text style={typography.bodyMuted}>
              Manage multiple gym setups with custom equipment presets and exclusions.
            </Text>

            {/* Active Gym Banner */}
            {activeGym?.profile && (
              <Card style={styles.activeBanner}>
                <View style={styles.bannerHeader}>
                  <View style={styles.bannerBadge}>
                    <Ionicons name="flash" size={14} color={colors.primary} />
                    <Text style={styles.bannerBadgeText}>ACTIVE GYM</Text>
                  </View>
                  {activeGym.profile.is_main && (
                    <View style={styles.mainBadge}>
                      <Text style={styles.mainBadgeText}>MAIN</Text>
                    </View>
                  )}
                  {activeGym.profile.kind === 'temporary' && (
                    <View style={styles.tempBadge}>
                      <Text style={styles.tempBadgeText}>
                        {formatExpiry(activeGym.profile.expires_at)}
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={typography.h2}>{activeGym.profile.name}</Text>
                <Text style={styles.bannerSub}>
                  Preset: {equipmentLabel(activeGym.profile.base_preset)}
                  {activeGym.excluded_equipment.length > 0 &&
                    ` · ${activeGym.excluded_equipment.length} equipment excluded`}
                  {activeGym.excluded_exercise_ids.length > 0 &&
                    ` · ${activeGym.excluded_exercise_ids.length} exercises excluded`}
                </Text>
              </Card>
            )}

            {/* Action Buttons */}
            <View style={styles.buttonRow}>
              <View style={styles.flexBtn}>
                <Button
                  title="+ Add gym profile"
                  onPress={() => navigation.navigate('GymProfileEditor', { isTemporary: false })}
                />
              </View>
              <View style={styles.flexBtn}>
                <Button
                  title="+ Temporary visit"
                  variant="secondary"
                  onPress={() => navigation.navigate('GymProfileEditor', { isTemporary: true })}
                />
              </View>
            </View>

            {actionError && <Text style={styles.errorText}>{actionError}</Text>}

            {/* Permanent Gyms */}
            <SectionTitle>Permanent Gyms</SectionTitle>
            {permanentProfiles.length === 0 && !loading && (
              <EmptyState message="No permanent gyms found." />
            )}
            {permanentProfiles.map((gym) => {
              const isActive = gym.id === activeId;

              return (
                <Card
                  key={gym.id}
                  style={[styles.profileCard, isActive && styles.profileCardActive]}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.titleWrap}>
                      <Text style={typography.h3}>{gym.name}</Text>
                      {gym.is_main && (
                        <View style={styles.mainBadge}>
                          <Text style={styles.mainBadgeText}>MAIN GYM</Text>
                        </View>
                      )}
                      {isActive && (
                        <View style={styles.activePill}>
                          <Text style={styles.activePillText}>ACTIVE</Text>
                        </View>
                      )}
                    </View>
                    <Pressable
                      onPress={() =>
                        navigation.navigate('GymProfileEditor', { profileId: gym.id })
                      }
                      style={styles.iconEditBtn}
                    >
                      <Ionicons name="pencil" size={18} color={colors.primary} />
                    </Pressable>
                  </View>

                  <Text style={typography.bodyMuted}>
                    Preset: {equipmentLabel(gym.base_preset)}
                  </Text>

                  <View style={styles.cardActions}>
                    {!isActive && (
                      <Button
                        title="Use this gym now"
                        variant="secondary"
                        onPress={() => handleSetActive(gym.id)}
                      />
                    )}
                    {!gym.is_main && (
                      <Button
                        title="Set as Main gym"
                        variant="ghost"
                        onPress={() => handleSetMain(gym.id)}
                      />
                    )}
                    {!gym.is_main && (
                      <Button
                        title="Archive"
                        variant="danger"
                        onPress={() => handleArchive(gym.id, gym.name)}
                      />
                    )}
                  </View>
                </Card>
              );
            })}

            {/* Temporary Visits */}
            <SectionTitle>Temporary Visits</SectionTitle>
            {temporaryProfiles.length === 0 && !loading && (
              <Text style={styles.emptyNote}>
                No temporary gym visits active. Add one when traveling or visiting another gym.
              </Text>
            )}
            {temporaryProfiles.map((gym) => {
              const isActive = gym.id === activeId;

              return (
                <Card
                  key={gym.id}
                  style={[styles.profileCard, isActive && styles.profileCardActive]}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.titleWrap}>
                      <Text style={typography.h3}>{gym.name}</Text>
                      <View style={styles.tempBadge}>
                        <Text style={styles.tempBadgeText}>
                          {formatExpiry(gym.expires_at)}
                        </Text>
                      </View>
                      {isActive && (
                        <View style={styles.activePill}>
                          <Text style={styles.activePillText}>ACTIVE</Text>
                        </View>
                      )}
                    </View>
                    <Pressable
                      onPress={() =>
                        navigation.navigate('GymProfileEditor', { profileId: gym.id })
                      }
                      style={styles.iconEditBtn}
                    >
                      <Ionicons name="pencil" size={18} color={colors.primary} />
                    </Pressable>
                  </View>

                  <Text style={typography.bodyMuted}>
                    Preset: {equipmentLabel(gym.base_preset)}
                  </Text>

                  <View style={styles.cardActions}>
                    {!isActive && (
                      <Button
                        title="Use this gym now"
                        variant="secondary"
                        onPress={() => handleSetActive(gym.id)}
                      />
                    )}
                    <Button
                      title="Convert to permanent"
                      variant="ghost"
                      onPress={() => handleConvertToPermanent(gym.id)}
                    />
                    <Button
                      title="End visit"
                      variant="danger"
                      onPress={() => handleEndTemporary(gym.id)}
                    />
                  </View>
                </Card>
              );
            })}
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  activeBanner: {
    marginTop: spacing.md,
    backgroundColor: '#1B2C21',
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
    flexWrap: 'wrap',
  },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  bannerBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
    fontSize: 10,
  },
  bannerSub: {
    ...typography.bodyMuted,
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  flexBtn: { flex: 1 },
  profileCard: {
    marginTop: spacing.sm,
  },
  profileCardActive: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    flexWrap: 'wrap',
  },
  iconEditBtn: {
    padding: 6,
  },
  mainBadge: {
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  mainBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
    fontSize: 10,
  },
  tempBadge: {
    backgroundColor: '#332B14',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  tempBadgeText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '700',
    fontSize: 10,
  },
  activePill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  activePillText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '800',
    fontSize: 10,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  emptyNote: {
    ...typography.bodyMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    marginTop: spacing.sm,
  },
});
