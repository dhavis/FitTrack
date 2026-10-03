import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { MainTabParamList } from '../navigation/types';

export interface TabIconProps {
  color?: string;
  size?: number;
  strokeWidth?: number;
}

export function DashboardTabIcon({ color = 'currentColor', size = 24 }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M12 3 3 11h2v9h5v-6h4v6h5v-9h2z" />
    </Svg>
  );
}

export function WeightTabIcon({ color = 'currentColor', size = 24 }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M3 17h18v2H3z" />
      <Path fill={color} d="M4 16l5-6 4 3 7-8 1.5 1.2L13.2 15 9 11 5 16z" />
    </Svg>
  );
}

export function WorkoutsTabIcon({ color = 'currentColor', size = 24 }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M2 9h4v6H2zM18 9h4v6h-4zM6 10.5h3v3H6zM15 10.5h3v3h-3zM9 11.2h6v1.6H9z" />
    </Svg>
  );
}

export function NutritionTabIcon({ color = 'currentColor', size = 24 }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M7 3h2.2v18H7zM5.5 6.5h5.2v2H5.5zM5.5 11h5.2v2H5.5z" />
      <Path fill={color} d="M14 4.5 18.2 6.2 16.8 20h-2.2z" />
    </Svg>
  );
}

export function GoalsTabIcon({ color = 'currentColor', size = 24 }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M6 3h2v18H6z" />
      <Path fill={color} d="M8 4h9l-2.2 3.2L17 10.5H8z" />
    </Svg>
  );
}

export function SettingsTabIcon({ color = 'currentColor', size = 24 }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M3 6h18v2.2H3zM3 11h18v2.2H3zM3 16h18v2.2H3z" />
      <Circle fill={color} cx="8" cy="7.1" r="1.7" />
      <Circle fill={color} cx="15" cy="12.1" r="1.7" />
      <Circle fill={color} cx="11" cy="17.1" r="1.7" />
    </Svg>
  );
}

export const TAB_ICONS: Record<keyof MainTabParamList, React.ComponentType<TabIconProps>> = {
  Dashboard: DashboardTabIcon,
  Weight: WeightTabIcon,
  Workouts: WorkoutsTabIcon,
  Nutrition: NutritionTabIcon,
  Goals: GoalsTabIcon,
  Settings: SettingsTabIcon,
};

export function TabIcon({
  name,
  color,
  size,
}: TabIconProps & { name: keyof MainTabParamList }) {
  const IconComponent = TAB_ICONS[name];
  if (!IconComponent) return null;
  return <IconComponent color={color} size={size} />;
}
