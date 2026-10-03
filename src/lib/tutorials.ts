import AsyncStorage from '@react-native-async-storage/async-storage';

const SEEN_KEY = 'fittrack.tutorial.building-workout.v2';

export type TutorialStep = {
  title: string;
  body: string;
};

export const BUILDING_A_WORKOUT_STEPS: TutorialStep[] = [
  {
    title: 'Build a routine',
    body: 'You are on Workouts. Start a new routine. That routine is the plan you follow in the gym.',
  },
  {
    title: 'Add the exercises',
    body: 'Add each exercise. Set the number of sets, the target reps, and an optional weight.',
  },
  {
    title: 'Set the rest',
    body: 'On straight sets, Rest is the pause after each set, in seconds. The same pause runs after the last set, before the next exercise.',
  },
  {
    title: 'Supersets and powersets',
    body: 'Tick two exercises, then Create Superset. Tick three to six, then Create Powerset. Those moves run back to back. Rest after round is the pause before the next round or the next exercise.',
  },
  {
    title: 'Drop sets',
    body: 'On an exercise, Add drop. You can add up to three lighter steps. They run right after the last regular set, with no rest between them.',
  },
  {
    title: 'Countdown in the session',
    body: 'After you log a set that has rest, the session shows Rest and counts down the seconds. Up next names what follows. Skip rest ends it early. There is no countdown while you are lifting, and none between the exercises inside a superset or powerset.',
  },
];

export async function hasSeenBuildingWorkoutTutorial(): Promise<boolean> {
  const value = await AsyncStorage.getItem(SEEN_KEY);
  return value === '1';
}

export async function markBuildingWorkoutTutorialSeen(): Promise<void> {
  await AsyncStorage.setItem(SEEN_KEY, '1');
}
