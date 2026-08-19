import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Button, Label, ScreenContainer, TextInput } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing, typography } from '../theme/theme';

export default function UpdatePasswordScreen() {
  const { updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await updatePassword(password);
      if (updateError) setError(updateError);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password.');
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
          <Text style={styles.logo}>Choose a new password</Text>
          <Text style={styles.subtitle}>You opened a password reset link. Set a password you will remember.</Text>

          <View style={styles.field}>
            <Label>New password</Label>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="••••••••"
            />
          </View>

          <View style={styles.field}>
            <Label>Confirm password</Label>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="••••••••"
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.field}>
            <Button title="Save password" onPress={handleSubmit} loading={loading} />
          </View>

          <Button title="Cancel and sign out" variant="ghost" onPress={() => signOut()} />
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
