import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Button, Label, ScreenContainer, ServerUnreachableNote, TextInput } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { AuthStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError('Enter the email for your account.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const { error: resetError } = await requestPasswordReset(email.trim());
      if (resetError) {
        setError(resetError);
      } else {
        setInfo(
          'If an account exists for that email, you will get a reset link. Open it in this same browser to choose a new password.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
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
          <Text style={styles.logo}>Reset password</Text>
          <Text style={styles.subtitle}>We will email you a link to choose a new password.</Text>
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

          {error && <Text style={styles.error}>{error}</Text>}
          {info && <Text style={styles.info}>{info}</Text>}

          <View style={styles.field}>
            <Button title="Send reset link" onPress={handleSubmit} loading={loading} />
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
  subtitle: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  field: { marginBottom: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.md, textAlign: 'center' },
  info: { color: colors.accent, marginBottom: spacing.md, textAlign: 'center' },
});
