// INNSTILLINGER (sketch: InnstillingerScreen) — the "Varsler" switch, a time
// per meal, match/training reminders on/off, and the language (Norsk /
// English). Reminders are local to this phone (see src/reminders and
// src/fixtures).

import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { DateTimeField } from '@/components/DateTimeField';
import { fixtureRemindersEnabled, setFixtureRemindersEnabled, syncFixtureReminders } from '@/fixtures/fixtures';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, SectionTitle } from '@/components/ui';
import { setLanguage, useI18n, type Language } from '@/lib/i18n';
import { colors, font, radius, spacing } from '@/lib/theme';
import {
  loadReminderSettings,
  mealLabel,
  requestReminderPermission,
  saveReminderSettings,
  type MealKey,
  type ReminderSettings,
} from '@/reminders/reminders';

// Sketch Toggle: indigo when on, slate when off.
const SWITCH_COLORS = { trackColor: { false: colors.border, true: colors.primary }, thumbColor: '#fff' };

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'nb', label: 'Norsk' },
  { value: 'en', label: 'English' },
];

export default function SettingsScreen() {
  const { t, lang } = useI18n();
  const [settings, setSettings] = useState<ReminderSettings>(() => loadReminderSettings());
  const userId = useSession().session?.user.id ?? '';
  const [fixturesOn, setFixturesOn] = useState(() => fixtureRemindersEnabled());

  async function toggleFixtures(on: boolean) {
    if (on && !(await requestReminderPermission())) return showPermissionHelp();
    setFixturesOn(on);
    await setFixtureRemindersEnabled(on, userId).catch(() => {});
  }

  function showPermissionHelp() {
    Alert.alert(
      t('Varsler er slått av', 'Notifications are off'),
      t(
        'Gi appen lov til å sende varsler i telefonens innstillinger for å få påminnelser.',
        "Allow the app to send notifications in your phone's settings to get reminders.",
      ),
      [
        { text: t('Avbryt', 'Cancel'), style: 'cancel' },
        { text: t('Åpne innstillinger', 'Open settings'), onPress: () => Linking.openSettings() },
      ],
    );
  }

  async function update(next: ReminderSettings) {
    setSettings(next);
    try {
      await saveReminderSettings(next);
    } catch {
      Alert.alert(t('Kunne ikke lagre påminnelsene', "Couldn't save the reminders"));
    }
  }

  async function toggleEnabled(on: boolean) {
    if (on && !(await requestReminderPermission())) return showPermissionHelp();
    await update({ ...settings, enabled: on });
  }

  function updateMeal(key: MealKey, changes: Partial<ReminderSettings['meals'][MealKey]>) {
    void update({ ...settings, meals: { ...settings.meals, [key]: { ...settings.meals[key], ...changes } } });
  }

  function chooseLanguage(next: Language) {
    if (next === lang) return;
    setLanguage(next);
    // Scheduled reminders keep the text they were made with — make them again.
    if (settings.enabled) void saveReminderSettings(settings).catch(() => {});
    if (userId) void syncFixtureReminders(userId).catch(() => {});
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title={t('Innstillinger', 'Settings')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('Varsler', 'Notifications')}</Text>
            <Text style={styles.hint}>{t('Påminnelse om å logge måltidene dine', 'Reminders to log your meals')}</Text>
          </View>
          <Switch value={settings.enabled} onValueChange={(on) => void toggleEnabled(on)} {...SWITCH_COLORS} />
        </Card>

        {settings.enabled && (
          <Card>
            {(Object.keys(settings.meals) as MealKey[]).map((key, i) => {
              const meal = settings.meals[key];
              const time = new Date();
              time.setHours(meal.hour, meal.minute, 0, 0);
              const name = mealLabel(key, lang);
              return (
                <View key={key} style={[styles.mealRow, i > 0 && styles.divider]}>
                  <Switch
                    value={meal.on}
                    onValueChange={(on) => updateMeal(key, { on })}
                    accessibilityLabel={t(`Påminnelse for ${name}`, `Reminder for ${name}`)}
                    {...SWITCH_COLORS}
                  />
                  <Text style={[styles.label, { flex: 1, opacity: meal.on ? 1 : 0.5 }]}>{name}</Text>
                  <DateTimeField
                    mode="time"
                    value={time}
                    accessibilityLabel={t(`Tidspunkt for ${name}`, `Time for ${name}`)}
                    onChange={(d) => updateMeal(key, { hour: d.getHours(), minute: d.getMinutes() })}
                  />
                </View>
              );
            })}
          </Card>
        )}

        <Text style={styles.footnote}>
          {t(
            'Påminnelsene lages på telefonen din og sendes ikke via noen server. De kommer på samme tid hver dag.',
            "Reminders are made on your phone and aren't sent through any server. They come at the same time every day.",
          )}
        </Text>

        <Card style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('Kamp og trening', 'Matches and training')}</Text>
            <Text style={styles.hint}>
              {t('Tips om mat og drikke før og etter kamper og treninger', 'Food and drink tips before and after matches and training')}
            </Text>
          </View>
          <Switch value={fixturesOn} onValueChange={(on) => void toggleFixtures(on)} {...SWITCH_COLORS} />
        </Card>

        <View>
          <SectionTitle>{t('Språk', 'Language')}</SectionTitle>
          {/* Sketch: segmented "Gram | 1 porsjon"-style control */}
          <View style={styles.segment}>
            {LANGUAGES.map((option) => (
              <Pressable
                key={option.value}
                style={[styles.segmentButton, lang === option.value && styles.segmentActive]}
                onPress={() => chooseLanguage(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: lang === option.value }}>
                <Text style={[styles.segmentText, lang === option.value && styles.segmentTextActive]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.footnote, { marginTop: spacing.sm }]}>
            {t(
              'Matvarenavn kommer fra Matvaretabellen og vises på norsk.',
              'Food names come from Matvaretabellen and are shown in Norwegian.',
            )}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 56 },
  divider: { borderTopWidth: 1, borderColor: colors.surfaceRaised },
  label: { fontSize: font.sm, color: colors.textBody },
  hint: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  footnote: { fontSize: font.xs, color: colors.muted, lineHeight: 17 },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceRaised, borderRadius: radius.sm, padding: 4 },
  segmentButton: { flex: 1, minHeight: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.border },
  segmentText: { fontSize: font.sm, fontWeight: '500', color: colors.muted },
  segmentTextActive: { color: colors.text },
});
