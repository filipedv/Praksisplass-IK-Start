// VANN (sketch: WaterScreen), opened from the water card on Dagsoversikt.
// Shows the chosen day (?date=2026-10-14). Water can only be ADDED for today;
// past days are read-only, exactly as in the sketch.
//
// Extra (not in the sketch): long-press an entry to delete it, for mis-taps.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/ui';
import { GlassRow, WaterRing } from '@/components/water';
import { formatDayDate, formatTime, isToday, parseISODate } from '@/lib/dates';
import { colors, font, radius, spacing } from '@/lib/theme';
import {
  addWater,
  deleteWater,
  fetchWaterForDay,
  fetchWaterGoal,
  getCachedWater,
  getCachedWaterGoal,
  setCachedWater,
  sumWater,
  type WaterLog,
} from '@/water/water-api';
import { useI18n } from '@/lib/i18n';

const QUICK_AMOUNTS = [200, 330, 500];

export default function WaterScreen() {
  const { session } = useSession();
  const { t, locale } = useI18n();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const day = parseISODate(dateParam);
  const readOnly = !isToday(day);

  const userId = session?.user.id;

  // Start from what Dagsoversikt already loaded for this day (no "0 ml" flash),
  // then refresh quietly. null = nothing cached yet → show a spinner.
  const [logs, setLogs] = useState<WaterLog[] | null>(() => (userId ? (getCachedWater(userId, day) ?? null) : null));
  const [goal, setGoal] = useState(() => getCachedWaterGoal() ?? 2500);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [dayLogs, waterGoal] = await Promise.all([
        fetchWaterForDay(userId, parseISODate(dateParam)),
        fetchWaterGoal(),
      ]);
      setLogs(dayLogs);
      setGoal(waterGoal);
    } catch (e) {
      console.warn('Load water failed', e);
      setLogs([]);
    }
  }, [userId, dateParam]);

  // Load when the screen comes into view.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Update the screen AND the cache, so Dagsoversikt is right when we go back.
  function updateLogs(next: WaterLog[]) {
    setLogs(next);
    if (userId) setCachedWater(userId, parseISODate(dateParam), next);
  }

  async function handleAdd(ml: number) {
    if (readOnly || adding) return;
    setAdding(true);
    try {
      const entry = await addWater(ml);
      updateLogs([entry, ...(logs ?? [])]); // newest first
    } catch (e) {
      console.warn('Add water failed', e);
      Alert.alert(t('Kunne ikke registrere vann', "Couldn't log water"), t('Sjekk nettforbindelsen og prøv igjen.', 'Check your connection and try again.'));
    } finally {
      setAdding(false);
    }
  }

  function confirmDelete(entry: WaterLog) {
    Alert.alert(t('Slette registreringen?', 'Delete this entry?'), `+${entry.amount_ml} ml · ${formatTime(new Date(entry.logged_at), locale)}`, [
      { text: t('Avbryt', 'Cancel'), style: 'cancel' },
      {
        text: t('Slett', 'Delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWater(entry.id);
            updateLogs((logs ?? []).filter((l) => l.id !== entry.id));
          } catch {
            Alert.alert(t('Kunne ikke slette registreringen.', "Couldn't delete the entry."));
          }
        },
      },
    ]);
  }

  const total = sumWater(logs ?? []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title={t('Vann', 'Water')} onBack={() => router.back()} />
      <Text style={styles.dateLabel}>{readOnly ? formatDayDate(day, locale) : t('I dag', 'Today')}</Text>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.mainCard}>
          <WaterRing totalMl={total} goalMl={goal} />
          <GlassRow totalMl={total} goalMl={goal} size={28} />

          {readOnly ? (
            <Text style={styles.readOnly}>{t('Kan bare registrere vann for i dag.', 'You can only log water for today.')}</Text>
          ) : (
            <View style={styles.buttons}>
              {QUICK_AMOUNTS.map((ml) => (
                <Pressable
                  key={ml}
                  style={({ pressed }) => [styles.addButton, (pressed || adding) && { opacity: 0.7 }]}
                  onPress={() => handleAdd(ml)}
                  disabled={adding}
                  accessibilityLabel={t(`Legg til ${ml} milliliter`, `Add ${ml} millilitres`)}>
                  <Ionicons name="add" size={13} color={BLUE_TEXT} />
                  <Text style={styles.addButtonText}>+{ml} ml</Text>
                </Pressable>
              ))}
            </View>
          )}
        </Card>

        <View style={styles.logSection}>
          <Text style={styles.logTitle}>{t('Registreringer', 'Entries')}</Text>
          {logs === null ? (
            <ActivityIndicator color={colors.primary} />
          ) : logs.length === 0 ? (
            <Text style={styles.noLogs}>{t('Ingen registreringer denne dagen.', 'No entries this day.')}</Text>
          ) : (
            logs.map((entry) => (
              <Pressable key={entry.id} onLongPress={() => confirmDelete(entry)} delayLongPress={400}>
                <Card style={styles.logRow}>
                  <Text style={styles.logTime}>{formatTime(new Date(entry.logged_at), locale)}</Text>
                  <Text style={styles.logAmount}>+{entry.amount_ml} ml</Text>
                </Card>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Sketch quick-add buttons: bg-blue-950 / text-blue-300.
const BLUE_BG = '#172554';
const BLUE_TEXT = '#93C5FD';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  dateLabel: { fontSize: font.xs, color: colors.muted, textAlign: 'center', marginTop: -4, marginBottom: spacing.md },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg },
  mainCard: { padding: spacing.xl, alignItems: 'center', gap: spacing.lg },
  readOnly: { fontSize: font.xs, color: colors.muted, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' },
  addButton: {
    flex: 1,
    backgroundColor: BLUE_BG,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: { fontSize: font.xs, fontWeight: '500', color: BLUE_TEXT },
  logSection: { gap: 6 },
  logTitle: { fontSize: font.xs, fontWeight: '500', color: colors.mutedLight, marginBottom: 2 },
  noLogs: { fontSize: font.xs, color: colors.muted },
  logRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10 },
  logTime: { fontSize: font.xs, color: colors.mutedLight },
  logAmount: { fontSize: font.sm, fontWeight: '500', color: colors.textBody },
});
