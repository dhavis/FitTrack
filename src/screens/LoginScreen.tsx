import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Text, View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Label, ScreenContainer, ServerUnreachableNote, TextInput } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { AuthStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const { error: signInError } = await signIn(email.trim(), password);
      if (signInError) setError(signInError);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.logo}>FitTrack</Text>
          <Text style={styles.subtitle}>Track your weight, workouts, and nutrition.</Text>
          <ServerUnreachableNote />

          <View style={styles.field}>
            <Label>Email</Label>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@example.com"
            />
          </View>

          <View style={styles.field}>
            <Label>Password</Label>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              placeholder="••••••••"
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.field}>
            <Button title="Log In" onPress={handleSubmit} loading={loading} />
          </View>

          <Button
            title="Forgot password?"
            variant="ghost"
            onPress={() => navigation.navigate('ForgotPassword')}
          />

          <Button
            title="Create an account"
            variant="ghost"
            onPress={() => navigation.navigate('SignUp')}
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', gap: spacing.sm },
  logo: { ...typography.h1, textAlign: 'center', color: colors.primary },
  subtitle: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  field: { marginBottom: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.md, textAlign: 'center' },
});
