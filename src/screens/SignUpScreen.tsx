import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Text, View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Label, ScreenContainer, ServerUnreachableNote, TextInput } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { AuthStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export default function SignUpScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setInfo(null);

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const { error: signUpError } = await signUp(email.trim(), password);
      if (signUpError) {
        setError(signUpError);
      } else {
        setInfo(
          'Account created. If email confirmation is on, check your inbox, then log in. Otherwise you will set up your profile next.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed.');
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
          <Text style={styles.logo}>Create account</Text>
          <Text style={styles.subtitle}>Start tracking your progress today.</Text>
          <ServerUnreachableNote />

          <View style={styles.field}>
            <Label>Email</Label>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
          </View>

          <View style={styles.field}>
            <Label>Password</Label>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
          </View>

          <View style={styles.field}>
            <Label>Confirm password</Label>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="••••••••"
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}
          {info && <Text style={styles.info}>{info}</Text>}

          <View style={styles.field}>
            <Button title="Sign Up" onPress={handleSubmit} loading={loading} />
          </View>

          <Button title="Back to log in" variant="ghost" onPress={() => navigation.navigate('Login')} />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', gap: spacing.sm },
  logo: { ...typography.h1, textAlign: 'center', color: colors.primary },
  subtitle: { ...typography.bodyMuted, textAlign: 'center', marginBottom: spacing.xl },
  field: { marginBottom: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.md, textAlign: 'center' },
  info: { color: colors.accent, marginBottom: spacing.md, textAlign: 'center' },
});
