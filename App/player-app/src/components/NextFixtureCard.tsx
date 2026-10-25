// "Neste kamp" on Dagsoversikt: the next match or training for my team
// (within a week), and the next food tip for it — the same text the
// notification shows. If notifications aren't allowed yet, it offers to turn
// them on, since that's how the tips arrive.
// Hidden when there's nothing in the coming week.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchUpcomingFixtures, fixtureHeading, fixtureRemindersEnabled, getCachedFixtures, reminderText, syncFixtureReminders, type Fixture } from '@/fixtures/fixtures';
import { useI18n } from '@/lib/i18n';
import { colors, font, radius, spacing } from '@/lib/theme';
import { requestReminderPermission } from '@/reminders/reminders';

const WEEK_MS = 7 * 86_400_000;

export function NextFixtureCard({ userId }: { userId: string }) {
  const { t, lang, locale } = useI18n();
  const [fixtures, setFixtures] = useState<Fixture[]>(() => getCachedFixtures(userId) ?? []);
  const [needsPermission, setNeedsPermission] = useState(false);
  // "Now", updated each time the screen comes into view (not read during render).
  const [now, setNow] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setNow(Date.now());
      fetchUpcomingFixtures(userId)
        .then((rows) => !cancelled && setFixtures(rows))
        .catch(() => {});
      Notifications.getPermissionsAsync()
        .then((p) => !cancelled && setNeedsPermission(!p.granted && fixtureRemindersEnabled()))
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  const next = fixtures.find((f) => new Date(f.ends_at).getTime() > now && new Date(f.starts_at).getTime() < now + WEEK_MS);
  if (!next) return null;

  const start = new Date(next.starts_at);
  const tip = next.reminders.find((r) => new Date(r.send_at).getTime() > now) ?? next.reminders[next.reminders.length - 1];
  const when = start.toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const where = [
    next.home_away === 'home' ? t('Hjemme', 'Home') : next.home_away === 'away' ? t('Borte', 'Away') : null,
    next.location,
  ]
    .filter(Boolean)
    .join(' · ');

  async function turnOn() {
    if (await requestReminderPermission()) {
      setNeedsPermission(false);
      void syncFixtureReminders(userId).catch(() => {});
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={[styles.icon, next.kind === 'match' ? styles.iconMatch : styles.iconTraining]}>
          <Ionicons name={next.kind === 'match' ? 'football-outline' : 'barbell-outline'} size={18} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{next.kind === 'match' ? t('Neste kamp', 'Next match') : t('Neste trening', 'Next training')}</Text>
          <Text style={styles.heading}>{fixtureHeading(next, lang)}</Text>
          <Text style={styles.meta}>
            {when}
            {where ? ` · ${where}` : ''}
          </Text>
        </View>
      </View>
      {tip && <Text style={styles.tip}>{reminderText(tip, next, lang)}</Text>}
      {needsPermission && (
        <Pressable onPress={() => void turnOn()} hitSlop={8} style={styles.permission}>
          <Ionicons name="notifications-outline" size={14} color={colors.primary} />
          <Text style={styles.permissionText}>{t('Slå på varsler for å få tipsene', 'Turn on notifications to get the tips')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  top: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconMatch: { backgroundColor: colors.primaryBorder },
  iconTraining: { backgroundColor: colors.pill.green.bg },
  label: { fontSize: 11, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  heading: { fontSize: font.sm, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  meta: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  tip: { fontSize: font.sm, color: colors.textBody, lineHeight: 20, backgroundColor: colors.surfaceRaised, borderRadius: radius.md, padding: spacing.md },
  permission: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  permissionText: { fontSize: font.xs, color: colors.primary, fontWeight: '500' },
});
