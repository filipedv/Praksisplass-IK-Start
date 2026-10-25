// Email + password login, styled like the sketch. There's no sign-up here on
// purpose: for this internal test, accounts are created in the Supabase dashboard.
// The language can be chosen here too (Norsk / English), before signing in.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSession } from '@/auth/session-context';
import { colors, font, radius, spacing } from '@/lib/theme';
import { setLanguage, useI18n } from '@/lib/i18n';

export default function LoginScreen() {
  const { signIn } = useSession();
  const { t, lang } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setBusy(true);
    setError(null);
    const result = await signIn(email.trim(), password);
    setBusy(false);
    // On success the session changes and the root layout swaps to the tabs.
    if (result.error) setError(result.error);
  }

  const disabled = !email || !password || busy;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <View style={styles.logo}>
          <Ionicons name="restaurant-outline" size={24} color="#fff" />
        </View>
        <Text style={styles.title}>{t('Logg inn', 'Sign in')}</Text>
        <Text style={styles.subtitle}>{t('Fyll inn relevant innloggingsdata for å fortsette', 'Enter your login details to continue')}</Text>

        <TextInput
          style={styles.input}
          placeholder={t('E-post', 'Email')}
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          keyboardAppearance="dark"
        />
        <TextInput
          style={styles.input}
          placeholder={t('Passord', 'Password')}
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          keyboardAppearance="dark"
          onSubmitEditing={handleLogin}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.button, disabled && styles.buttonDisabled]} onPress={handleLogin} disabled={disabled}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('Logg inn', 'Sign in')}</Text>}
        </Pressable>

        <View style={styles.languages}>
          {(['nb', 'en'] as const).map((l) => (
            <Pressable key={l} onPress={() => setLanguage(l)} hitSlop={10} accessibilityState={{ selected: lang === l }}>
              <Text style={[styles.language, lang === l && styles.languageActive]}>{l === 'nb' ? 'Norsk' : 'English'}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// Values from the sketch's LoginScreen (px-8, gap-6, rounded-xl inputs/button).
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, gap: spacing.md },
  logo: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: font.xs, color: colors.muted, textAlign: 'center', marginBottom: spacing.md },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    fontSize: font.sm,
    color: colors.text,
  },
  error: { color: colors.danger, textAlign: 'center', fontSize: font.sm },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: font.sm, fontWeight: '500' },
  languages: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.lg },
  language: { fontSize: font.xs, color: colors.muted },
  languageActive: { color: colors.text, fontWeight: '600' },
});
