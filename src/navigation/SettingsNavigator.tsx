import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import GymExclusionsScreen from '../screens/GymExclusionsScreen';
import GymProfileEditorScreen from '../screens/GymProfileEditorScreen';
import GymProfilesScreen from '../screens/GymProfilesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { colors } from '../theme/theme';
import { SettingsStackParamList } from './types';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export default function SettingsNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="SettingsHome"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GymProfiles"
        component={GymProfilesScreen}
        options={{ title: 'Gym Profiles' }}
      />
      <Stack.Screen
        name="GymProfileEditor"
        component={GymProfileEditorScreen}
        options={{ title: 'Gym Profile' }}
      />
      <Stack.Screen
        name="GymExclusions"
        component={GymExclusionsScreen}
        options={{ title: 'Exclusions' }}
      />
    </Stack.Navigator>
  );
}
