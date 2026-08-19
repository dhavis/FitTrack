import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import MeasurementsScreen from '../screens/MeasurementsScreen';
import WeightHomeScreen from '../screens/WeightScreen';
import { colors } from '../theme/theme';
import { WeightStackParamList } from './types';

const Stack = createNativeStackNavigator<WeightStackParamList>();

export default function WeightNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="WeightHome" component={WeightHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Measurements" component={MeasurementsScreen} options={{ title: 'Body composition' }} />
    </Stack.Navigator>
  );
}