import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import FoodSearchScreen from '../screens/FoodSearchScreen';
import NutritionHomeScreen from '../screens/NutritionHomeScreen';
import NutritionMenuScreen from '../screens/NutritionMenuScreen';
import NutritionPlanScreen from '../screens/NutritionPlanScreen';
import NutritionPreferencesScreen from '../screens/NutritionPreferencesScreen';
import { colors } from '../theme/theme';
import { NutritionStackParamList } from './types';

const Stack = createNativeStackNavigator<NutritionStackParamList>();

export default function NutritionNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="NutritionHome" component={NutritionHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="NutritionPlan" component={NutritionPlanScreen} options={{ title: 'Nutrition plan' }} />
      <Stack.Screen
        name="NutritionPreferences"
        component={NutritionPreferencesScreen}
        options={{ title: 'Food preferences' }}
      />
      <Stack.Screen name="NutritionMenu" component={NutritionMenuScreen} options={{ title: 'Your menu' }} />
      <Stack.Screen name="FoodSearch" component={FoodSearchScreen} options={{ title: 'Add Food' }} />
    </Stack.Navigator>
  );
}