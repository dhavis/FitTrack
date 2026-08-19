import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import ActiveWorkoutScreen from '../screens/ActiveWorkoutScreen';
import CoachResultScreen from '../screens/CoachResultScreen';
import ExerciseLibraryScreen from '../screens/ExerciseLibraryScreen';
import GeneratePlanScreen from '../screens/GeneratePlanScreen';
import RoutineBuilderScreen from '../screens/RoutineBuilderScreen';
import WorkoutsHomeScreen from '../screens/WorkoutsHomeScreen';
import { colors } from '../theme/theme';
import { WorkoutsStackParamList } from './types';

const Stack = createNativeStackNavigator<WorkoutsStackParamList>();

export default function WorkoutsNavigator() {
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
      <Stack.Screen name="ExerciseLibrary" component={ExerciseLibraryScreen} options={{ title: 'Exercises' }} />
      <Stack.Screen name="GeneratePlan" component={GeneratePlanScreen} options={{ title: 'Generate plan' }} />
      <Stack.Screen name="CoachResult" component={CoachResultScreen} options={{ title: 'Coach plan' }} />
    </Stack.Navigator>
  );
}