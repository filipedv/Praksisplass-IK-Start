// ENDRE PASSORD — from the Profil menu.
//
// Passwords are first set by an admin (who therefore knows them), so every
// player should be able to choose their own. We check the CURRENT password
// first (by signing in with it again), so someone who picks up an unlocked
// phone can't silently take over the account.

import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

const MIN_LENGTH = 8;

export default function PasswordScreen() {
  const { session } = useSession();
  const { t } = useI18n();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setError(null);
    if (next.length < MIN_LENGTH)
      return setError(t(`Det nye passordet må ha minst ${MIN_LENGTH} tegn.`, `The new password must have at least ${MIN_LENGTH} characters.`));
    if (next !== repeat) return setError(t('De to nye passordene er ikke like.', "The two new passwords don't match."));
    if (next === current) return setError(t('Det nye passordet må være forskjellig fra det gamle.', 'The new password must be different from the old one.'));
    const email = session?.user.email;
    if (!email) return setError(t('Fant ikke e-postadressen din. Logg inn på nytt.', "Couldn't find your email address. Sign in again."));

    setBusy(true);
    // 1. Check the current password.
    const check = await supabase.auth.signInWithPassword({ email, password: current });
    if (check.error) {
      setBusy(false);
      return setError(t('Nåværende passord er feil.', 'The current password is wrong.'));
    }
    // 2. Set the new one.
    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (updateError) return setError(`${t('Kunne ikke endre passordet', "Couldn't change the password")}: ${updateError.message}`);

    Alert.alert(t('Passordet er endret', 'Password changed'), t('Bruk det nye passordet neste gang du logger inn.', 'Use the new password next time you sign in.'));
    router.back();
  }

  const canSave = current && next && repeat && !busy;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title={t('Endre passord', 'Change password')} onBack={() => router.back()} />
      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.label}>{t('Nåværende passord', 'Current password')}</Text>
        <TextInput
          style={styles.input}
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          textContentType="password"
          keyboardAppearance="dark"
          autoFocus
        />
        <Text style={styles.label}>{t(`Nytt passord (minst ${MIN_LENGTH} tegn)`, `New password (at least ${MIN_LENGTH} characters)`)}</Text>
        <TextInput style={styles.input} value={next} onChangeText={setNext} secureTextEntry textContentType="newPassword" keyboardAppearance="dark" />
        <Text style={styles.label}>{t('Gjenta nytt passord', 'Repeat new password')}</Text>
        <TextInput
          style={styles.input}
          value={repeat}
          onChangeText={setRepeat}
          secureTextEntry
          textContentType="newPassword"
          keyboardAppearance="dark"
          onSubmitEditing={() => canSave && void handleSave()}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={[styles.button, !canSave && { opacity: 0.5 }]} onPress={() => void handleSave()} disabled={!canSave}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('Lagre nytt passord', 'Save new password')}</Text>}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  label: { fontSize: font.xs, color: colors.muted, marginTop: spacing.sm },
  input: { backgroundColor: colors.surfaceRaised, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: spacing.md, fontSize: font.sm, color: colors.text, minHeight: 48 },
  error: { color: colors.danger, fontSize: font.sm, marginTop: spacing.sm },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg, minHeight: 48, justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },
});
