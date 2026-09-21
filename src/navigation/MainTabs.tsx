import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import DashboardScreen from '../screens/DashboardScreen';
import GoalsScreen from '../screens/GoalsScreen';
import SettingsNavigator from './SettingsNavigator';
import { colors } from '../theme/theme';
import NutritionNavigator from './NutritionNavigator';
import { MainTabParamList } from './types';
import WeightNavigator from './WeightNavigator';
import WorkoutsNavigator from './WorkoutsNavigator';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'home',
  Weight: 'trending-down',
  Workouts: 'barbell',
  Nutrition: 'restaurant',
  Goals: 'flag',
  Settings: 'settings',
};

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name as keyof MainTabParamList]} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Weight" component={WeightNavigator} />
      <Tab.Screen name="Workouts" component={WorkoutsNavigator} />
      <Tab.Screen name="Nutrition" component={NutritionNavigator} />
      <Tab.Screen name="Goals" component={GoalsScreen} />
      <Tab.Screen name="Settings" component={SettingsNavigator} />
    </Tab.Navigator>
  );
}