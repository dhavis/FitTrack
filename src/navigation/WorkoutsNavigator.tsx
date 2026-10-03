import { useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { useTutorial } from '../components/TutorialProvider';
import ActiveWorkoutScreen from '../screens/ActiveWorkoutScreen';
import CoachResultScreen from '../screens/CoachResultScreen';
import DailyReadinessScreen from '../screens/DailyReadinessScreen';
import ExerciseHistoryScreen from '../screens/ExerciseHistoryScreen';
import ExerciseLibraryScreen from '../screens/ExerciseLibraryScreen';
import GeneratePlanScreen from '../screens/GeneratePlanScreen';
import RoutineBuilderScreen from '../screens/RoutineBuilderScreen';
import SessionAdaptationReviewScreen from '../screens/SessionAdaptationReviewScreen';
import WorkoutDetailScreen from '../screens/WorkoutDetailScreen';
import WorkoutHistoryScreen from '../screens/WorkoutHistoryScreen';
import WorkoutsHomeScreen from '../screens/WorkoutsHomeScreen';
import { colors } from '../theme/theme';
import { WorkoutsStackParamList } from './types';

const Stack = createNativeStackNavigator<WorkoutsStackParamList>();

export default function WorkoutsNavigator() {
  const { openTutorialIfUnseen, setTutorialHostFocused } = useTutorial();

  useFocusEffect(
    useCallback(() => {
      setTutorialHostFocused(true);
      openTutorialIfUnseen();
      return () => setTutorialHostFocused(false);
    }, [openTutorialIfUnseen, setTutorialHostFocused])
  );

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="WorkoutsHome" component={WorkoutsHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RoutineBuilder" component={RoutineBuilderScreen} options={{ title: 'Routine' }} />
      <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutScreen} options={{ title: 'Workout' }} />
      <Stack.Screen name="WorkoutHistory" component={WorkoutHistoryScreen} options={{ title: 'Workout History' }} />
      <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} options={{ title: 'Workout Details' }} />
      <Stack.Screen name="ExerciseHistory" component={ExerciseHistoryScreen} options={{ title: 'Exercise History' }} />
      <Stack.Screen name="DailyReadiness" component={DailyReadinessScreen} options={{ title: 'Check-in & Readiness' }} />
      <Stack.Screen name="SessionAdaptationReview" component={SessionAdaptationReviewScreen} options={{ title: 'Adaptation Review' }} />
      <Stack.Screen name="ExerciseLibrary" component={ExerciseLibraryScreen} options={{ title: 'Exercises' }} />
      <Stack.Screen name="GeneratePlan" component={GeneratePlanScreen} options={{ title: 'Generate plan' }} />
      <Stack.Screen name="CoachResult" component={CoachResultScreen} options={{ title: 'Coach plan' }} />
    </Stack.Navigator>
  );
}
