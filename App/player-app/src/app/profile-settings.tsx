// PROFILINNSTILLINGER (sketch: ProfilinnstillingerScreen) — opened by tapping
// the profile card on Profil. The player enters their own weight and height.
//
// Not built from the sketch: profile picture (we store no photos) and age
// (date of birth is reserved for the age-based safeguarding work).
//
// The history shows coach weigh-ins too ("Trener") — it's the player's data.
// SAFEGUARDING: see src/body/body-api.ts.

import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { fetchMyMeasurements, getCachedMeasurements, latestValues, saveMyMeasurement, type Measurement } from '@/body/body-api';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, SectionTitle } from '@/components/ui';
import { colors, font, radius, spacing } from '@/lib/theme';
import { getLanguage, type Language, useI18n } from '@/lib/i18n';

/** "72,4" → 72.4, empty → null, nonsense → NaN. */
function parseDecimal(text: string): number | null {
  const t = text.trim().replace(',', '.');
  return t === '' ? null : Number(t);
}

/** 72.4 → "72,4" (Norwegian) or "72.4" (English); missing → "". */
const show = (v: number | null | undefined, lang: Language = getLanguage()) =>
  v === null || v === undefined ? '' : lang === 'en' ? String(v) : String(v).replace('.', ',');

export default function ProfileSettingsScreen() {
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const { t, lang, locale } = useI18n();
  const [list, setList] = useState<Measurement[] | undefined>(() => getCachedMeasurements(userId));
  // What's in the boxes. Starts with the latest values (lazy, from the cache).
  const [weight, setWeight] = useState(() => show(latestValues(list ?? []).weight?.weight_kg));
  const [height, setHeight] = useState(() => show(latestValues(list ?? []).height?.height_cm));
  const touched = useRef(false); // has the user started typing? (a ref: no re-render needed)
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchMyMeasurements(userId)
      .then((rows) => {
        if (cancelled) return;
        setList(rows);
        // Fill the boxes with fresh values unless the user has started typing.
        if (!touched.current) {
          const latest = latestValues(rows);
          setWeight(show(latest.weight?.weight_kg));
          setHeight(show(latest.height?.height_cm));
        }
      })
      .catch(() => !cancelled && setList((current) => current ?? []));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleSave() {
    const w = parseDecimal(weight);
    const h = parseDecimal(height);
    if (w !== null && !(w >= 20 && w <= 250))
      return Alert.alert(t('Sjekk vekten', 'Check the weight'), t('Vekten må være mellom 20 og 250 kg.', 'Weight must be between 20 and 250 kg.'));
    if (h !== null && !(h >= 100 && h <= 230))
      return Alert.alert(t('Sjekk høyden', 'Check the height'), t('Høyden må være mellom 100 og 230 cm.', 'Height must be between 100 and 230 cm.'));

    // Only save what actually changed, so the charts don't fill up with copies.
    const latest = latestValues(list ?? []);
    const changed = {
      weight_kg: w !== null && w !== latest.weight?.weight_kg ? w : null,
      height_cm: h !== null && h !== latest.height?.height_cm ? h : null,
    };
    if (changed.weight_kg === null && changed.height_cm === null) return router.back();

    setSaving(true);
    try {
      await saveMyMeasurement(userId, changed, list ?? []);
      await fetchMyMeasurements(userId).catch(() => {}); // refresh the cache for Profil
      router.back();
    } catch (e) {
      Alert.alert(t('Kunne ikke lagre', "Couldn't save"), (e as Error).message);
      setSaving(false);
    }
  }

  const history = list ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title={t('Profilinnstillinger', 'Profile settings')} onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card style={styles.form}>
            <View>
              <Text style={styles.label}>{t('Vekt (kg)', 'Weight (kg)')}</Text>
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={(t) => {
                  touched.current = true;
                  setWeight(t);
                }}
                keyboardType="decimal-pad"
                keyboardAppearance="dark"
                placeholder="–"
                placeholderTextColor={colors.muted}
                accessibilityLabel={t('Vekt i kilo', 'Weight in kilograms')}
              />
            </View>
            <View>
              <Text style={styles.label}>{t('Høyde (cm)', 'Height (cm)')}</Text>
              <TextInput
                style={styles.input}
                value={height}
                onChangeText={(t) => {
                  touched.current = true;
                  setHeight(t);
                }}
                keyboardType="decimal-pad"
                keyboardAppearance="dark"
                placeholder="–"
                placeholderTextColor={colors.muted}
                accessibilityLabel={t('Høyde i centimeter', 'Height in centimetres')}
              />
            </View>
          </Card>

          <Pressable style={[styles.button, saving && { opacity: 0.6 }]} onPress={() => void handleSave()} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('Lagre', 'Save')}</Text>}
          </Pressable>

          <Text style={styles.footnote}>
            {t(
              'Lagres med dagens dato. Trenerne og administratorene i klubben kan se målingene dine, og kan også registrere veiinger fra trening.',
              "Saved with today's date. The club's coaches and administrators can see your measurements, and can also enter weigh-ins from training.",
            )}
          </Text>

          {history.length > 0 && (
            <View>
              <SectionTitle>{t('Siste målinger', 'Latest measurements')}</SectionTitle>
              <Card>
                {history.map((m, i) => (
                  <View key={m.id} style={[styles.historyRow, i > 0 && styles.divider]}>
                    <Text style={styles.historyDate}>
                      {new Date(`${m.measured_on}T12:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                    <Text style={styles.historyValues}>
                      {[m.weight_kg !== null ? `${show(m.weight_kg, lang)} kg` : null, m.height_cm !== null ? `${show(m.height_cm, lang)} cm` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    {m.entered_by !== userId && <Text style={styles.coachTag}>{t('Trener', 'Coach')}</Text>}
                  </View>
                ))}
              </Card>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  form: { padding: spacing.lg, gap: spacing.lg },
  label: { fontSize: font.xs, color: colors.muted, marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: font.sm,
    color: colors.text,
    minHeight: 44,
  },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },
  footnote: { fontSize: font.xs, color: colors.muted, lineHeight: 17 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  divider: { borderTopWidth: 1, borderColor: colors.surfaceRaised },
  historyDate: { fontSize: font.xs, color: colors.muted, width: 92 },
  historyValues: { flex: 1, fontSize: font.sm, color: colors.textBody },
  coachTag: { fontSize: 11, color: colors.mutedLight, backgroundColor: colors.surfaceRaised, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
});
