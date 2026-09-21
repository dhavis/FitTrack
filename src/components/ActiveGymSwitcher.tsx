import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useActiveGymProfile } from '../hooks/useActiveGymProfile';
import { equipmentLabel } from '../lib/goalExplanations';
import { colors, radii, spacing, typography } from '../theme/theme';
import { GymProfile } from '../types/db';

export interface ActiveGymSwitcherProps {
  onManageGyms?: () => void;
  compact?: boolean;
  style?: object;
  onGymSwitched?: (gym: GymProfile) => void;
}

export default function ActiveGymSwitcher({
  onManageGyms,
  compact = false,
  style,
  onGymSwitched,
}: ActiveGymSwitcherProps) {
  const { activeGym, userGyms, loading, switchActiveGym, refresh } = useActiveGymProfile();
  const [modalVisible, setModalVisible] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const currentProfile = activeGym?.profile;

  const handleOpen = () => {
    refresh();
    setModalVisible(true);
  };

  const handleSelect = async (gym: GymProfile) => {
    if (gym.id === currentProfile?.id) {
      setModalVisible(false);
      return;
    }
    setSwitchingId(gym.id);
    try {
      await switchActiveGym(gym.id);
      onGymSwitched?.(gym);
      setModalVisible(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSwitchingId(null);
    }
  };

  const formatDaysLeft = (expiresAt: string | null) => {
    if (!expiresAt) return '';
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Expired';
    if (days === 1) return '1 day left';
    return `${days} days left`;
  };

  return (
    <>
      <Pressable
        onPress={handleOpen}
        style={[
          styles.container,
          compact ? styles.containerCompact : styles.containerFull,
          style,
        ]}
      >
        <View style={styles.leftRow}>
          <Ionicons
            name={currentProfile?.kind === 'temporary' ? 'time-outline' : 'barbell-outline'}
            size={compact ? 14 : 16}
            color={currentProfile?.kind === 'temporary' ? colors.warning : colors.primary}
            style={styles.icon}
          />
          <View style={styles.textWrap}>
            <Text
              style={[styles.title, compact && styles.titleCompact]}
              numberOfLines={1}
            >
              {currentProfile?.name ?? (loading ? 'Loading gym...' : 'No active gym')}
            </Text>
            {!compact && currentProfile && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {equipmentLabel(currentProfile.base_preset)}
                {currentProfile.kind === 'temporary' && currentProfile.expires_at
                  ? ` · Temp (${formatDaysLeft(currentProfile.expires_at)})`
                  : currentProfile.is_main
                  ? ' · Main gym'
                  : ''}
              </Text>
            )}
          </View>
        </View>
        <Ionicons name="swap-horizontal" size={14} color={colors.textMuted} />
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={typography.h3}>Switch Active Gym</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.modalSub}>
              Select which gym profile applies to equipment filtering & workout generation.
            </Text>

            <View style={styles.gymList}>
              {userGyms.map((gym) => {
                const isActive = gym.id === currentProfile?.id;
                const isBusy = switchingId === gym.id;

                return (
                  <Pressable
                    key={gym.id}
                    onPress={() => handleSelect(gym)}
                    disabled={isBusy}
                    style={[
                      styles.gymOption,
                      isActive && styles.gymOptionActive,
                    ]}
                  >
                    <View style={styles.gymOptionLeft}>
                      <View style={styles.gymTitleRow}>
                        <Text
                          style={[
                            styles.gymOptionName,
                            isActive && styles.gymOptionNameActive,
                          ]}
                        >
                          {gym.name}
                        </Text>
                        {gym.is_main && (
                          <View style={styles.badgeMain}>
                            <Text style={styles.badgeMainText}>MAIN</Text>
                          </View>
                        )}
                        {gym.kind === 'temporary' && (
                          <View style={styles.badgeTemp}>
                            <Text style={styles.badgeTempText}>
                              {formatDaysLeft(gym.expires_at)}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.gymOptionPreset}>
                        {equipmentLabel(gym.base_preset)}
                      </Text>
                    </View>

                    {isBusy ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : isActive ? (
                      <View style={styles.activeCheck}>
                        <Text style={styles.activeCheckText}>Active</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            {onManageGyms && (
              <Pressable
                style={styles.manageBtn}
                onPress={() => {
                  setModalVisible(false);
                  onManageGyms();
                }}
              >
                <Ionicons name="settings-outline" size={16} color={colors.primary} />
                <Text style={styles.manageBtnText}>Manage gym profiles</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  containerFull: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    marginVertical: spacing.xs,
  },
  containerCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.xs,
  },
  icon: {
    marginRight: 6,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    fontSize: 13,
  },
  titleCompact: {
    fontSize: 12,
    fontWeight: '600',
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  gymList: {
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  gymOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gymOptionActive: {
    borderColor: colors.primary,
    backgroundColor: '#1C2920',
  },
  gymOptionLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  gymTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  gymOptionName: {
    ...typography.body,
    fontWeight: '700',
  },
  gymOptionNameActive: {
    color: colors.primary,
  },
  gymOptionPreset: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  badgeMain: {
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgeMainText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
    fontSize: 9,
  },
  badgeTemp: {
    backgroundColor: '#332B14',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgeTempText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '700',
    fontSize: 9,
  },
  activeCheck: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  activeCheckText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '800',
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  manageBtnText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
});
