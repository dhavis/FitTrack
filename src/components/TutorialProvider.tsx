import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BUILDING_A_WORKOUT_STEPS,
  hasSeenBuildingWorkoutTutorial,
  markBuildingWorkoutTutorialSeen,
} from '../lib/tutorials';
import { colors, fonts, radii, spacing, typography } from '../theme/theme';
import { Button } from './ui';

type TutorialContextValue = {
  openTutorial: () => void;
  openTutorialIfUnseen: () => void;
  setTutorialHostFocused: (focused: boolean) => void;
};

const TutorialContext = createContext<TutorialContextValue>({
  openTutorial: () => {},
  openTutorialIfUnseen: () => {},
  setTutorialHostFocused: () => {},
});

export function useTutorial() {
  return useContext(TutorialContext);
}

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [seen, setSeen] = useState(true);
  const [requested, setRequested] = useState(false);
  const [hostFocused, setHostFocused] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    hasSeenBuildingWorkoutTutorial()
      .then((alreadySeen) => {
        if (cancelled) return;
        setSeen(alreadySeen);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openTutorial = useCallback(() => {
    setStepIndex(0);
    setRequested(true);
  }, []);

  const openTutorialIfUnseen = useCallback(() => {
    if (!loaded || seen) return;
    setStepIndex(0);
    setRequested(true);
  }, [loaded, seen]);

  const setTutorialHostFocused = useCallback((focused: boolean) => {
    setHostFocused(focused);
  }, []);

  const closeTutorial = useCallback(() => {
    setRequested(false);
    setSeen(true);
    markBuildingWorkoutTutorialSeen().catch(() => {});
  }, []);

  const step = BUILDING_A_WORKOUT_STEPS[stepIndex];
  const isLast = stepIndex >= BUILDING_A_WORKOUT_STEPS.length - 1;

  const visible = requested && hostFocused;

  return (
    <TutorialContext.Provider value={{ openTutorial, openTutorialIfUnseen, setTutorialHostFocused }}>
      {children}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={closeTutorial}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.kicker}>
              Tutorial {stepIndex + 1} of {BUILDING_A_WORKOUT_STEPS.length}
            </Text>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>
            <View style={styles.actions}>
              <Pressable onPress={closeTutorial} style={styles.skip}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
              {isLast ? (
                <View style={styles.next}>
                  <Button title="Done" onPress={closeTutorial} />
                </View>
              ) : (
                <View style={styles.next}>
                  <Button title="Next" onPress={() => setStepIndex((i) => i + 1)} />
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </TutorialContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 8, 12, 0.72)',
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  kicker: {
    ...typography.caption,
    fontFamily: fonts.medium,
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  skip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  skipText: {
    ...typography.body,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  next: { flex: 1 },
});
