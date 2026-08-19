import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../lib/supabase';
import OnboardingScreen from '../screens/OnboardingScreen';
import SetupRequiredScreen from '../screens/SetupRequiredScreen';
import UpdatePasswordScreen from '../screens/UpdatePasswordScreen';
import { colors } from '../theme/theme';
import AuthNavigator from './AuthNavigator';
import MainTabs from './MainTabs';

export default function RootNavigator() {
  const { session, profile, loading, passwordRecovery } = useAuth();

  if (!isSupabaseConfigured) {
    return <SetupRequiredScreen />;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!session) {
    return <AuthNavigator />;
  }

  if (passwordRecovery) {
    return <UpdatePasswordScreen />;
  }

  if (!profile?.onboarding_completed_at) {
    return <OnboardingScreen />;
  }

  return <MainTabs />;
}
