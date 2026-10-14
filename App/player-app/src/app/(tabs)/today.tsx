// DAGSOVERSIKT (sketch: MealsScreen) — one day's water, totals and meals.
//
// WHICH DAY is shown lives in the URL: /today?date=2026-10-14 (no date = today).
// Keeping it in the URL instead of in component state means that coming back
// from a meal or the Vann screen keeps you on the same day, and the Kamera
// screen can jump here to today after saving by navigating to ?date=<today>.
//
// SMOOTHNESS: we never blank the screen while loading.
//   - Days we've seen before show instantly from the in-memory cache.
//   - A new day keeps the previous content, slightly dimmed, until it arrives.
//   - Coming back to the tab refreshes quietly; the spinner only appears when
//     the user pulls down to refresh.
//
// Not built yet (designed in the sketch): the "Søk i matvarer" page.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { LayoutAnimation, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { DateHeader, MonthCalendar } from '@/components/DateNavigation';
import { NutritionTotals } from '@/components/NutritionTotals';
import { Card, SectionTitle } from '@/components/ui';
import { GlassRow } from '@/components/water';
import { addDays, formatTime, isToday, parseISODate, startOfMonth, toISODate } from '@/lib/dates';
import { colors, font, radius, spacing } from '@/lib/theme';
import { mealName } from '@/meals/meal-name';
import { fetchMealsForDay, getCachedMealsForDay, type Meal } from '@/meals/meals-api';
import { formatNumber, sumNutrition } from '@/nutrition/math';
import { fetchWaterForDay, fetchWaterGoal, getCachedWater, getCachedWaterGoal, sumWater } from '@/water/water-api';

type DayData = { iso: string; meals: Meal[]; waterMl: number; waterGoal: number };

/** Everything Dagsoversikt shows for one day, fetched in parallel. */
async function loadDay(userId: string, day: Date): Promise<DayData> {
  const [meals, water, waterGoal] = await Promise.all([
    fetchMealsForDay(userId, day),
    fetchWaterForDay(userId, day),
    fetchWaterGoal(),
  ]);
  // .slice() copies before reversing, so the cached list isn't changed.
  return { iso: toISODate(day), meals: meals.slice().reverse(), waterMl: sumWater(water), waterGoal };
}

/** The same thing from the cache, if we've loaded this day before. */
function cachedDay(userId: string, day: Date): DayData | null {
  const meals = getCachedMealsForDay(userId, day);
  const water = getCachedWater(userId, day);
  if (!meals || !water) return null;
  return {
    iso: toISODate(day),
    meals: meals.slice().reverse(),
    waterMl: sumWater(water),
    waterGoal: getCachedWaterGoal() ?? 2500,
  };
}

// Open/close the calendar with a short ease, pushing the content smoothly.
const animateLayout = () => LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity'));

export default function TodayScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const selectedDate = parseISODate(dateParam);
  const selectedIso = toISODate(selectedDate);

  // `() => …` = only computed on the first render (a "lazy" initial value).
  const [data, setData] = useState<DayData | null>(() => (userId ? cachedDay(userId, selectedDate) : null));
  const [refreshing, setRefreshing] = useState(false); // only for pull-to-refresh
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(selectedDate));

  // The day we most recently asked for. If you tap ‹ quickly several times,
  // an older (slower) answer must not overwrite a newer one.
  const latestRequest = useRef<string | undefined>(undefined);

  const load = useCallback(async () => {
    if (!userId) return;
    latestRequest.current = dateParam;
    try {
      const result = await loadDay(userId, parseISODate(dateParam));
      if (latestRequest.current !== dateParam) return; // a newer day was requested meanwhile
      setData(result);
      setError(null);
    } catch (e) {
      console.warn('Load failed', e);
      setError('Kunne ikke hente data for denne dagen.');
    }
  }, [userId, dateParam]);

  // Reload quietly whenever this tab comes into view, and whenever the day changes.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handlePullToRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // ---- Changing the day: update the URL; the focus effect then reloads ----
  function goToDay(date: Date) {
    // Show the new day instantly if we've seen it before.
    const cached = userId ? cachedDay(userId, date) : null;
    if (cached) setData(cached);
    router.setParams({ date: toISODate(date) });
    setCalendarMonth(startOfMonth(date));
  }

  function toggleCalendar() {
    animateLayout();
    if (!calendarOpen) setCalendarMonth(startOfMonth(selectedDate));
    setCalendarOpen(!calendarOpen);
  }

  function closeCalendar() {
    if (calendarOpen) {
      animateLayout();
      setCalendarOpen(false);
    }
  }

  // Until the selected day has loaded we keep showing the previous one, dimmed.
  const isStale = data?.iso !== selectedIso;
  const meals = data?.meals ?? [];
  const waterMl = data?.waterMl ?? 0;
  const waterGoal = data?.waterGoal ?? 2500;
  const dayTotals = sumNutrition(meals.flatMap((m) => m.meal_items.map((i) => i.nutrition)));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DateHeader
        selectedDate={selectedDate}
        calendarOpen={calendarOpen}
        onPrevDay={() => goToDay(addDays(selectedDate, -1))}
        onNextDay={() => !isToday(selectedDate) && goToDay(addDays(selectedDate, 1))}
        onToggleCalendar={toggleCalendar}
      />
      {calendarOpen && (
        <MonthCalendar
          viewMonth={calendarMonth}
          selectedDate={selectedDate}
          onChangeMonth={setCalendarMonth}
          onSelectDate={(date) => {
            goToDay(date);
            closeCalendar();
          }}
        />
      )}

      <ScrollView
        contentContainerStyle={[styles.scroll, isStale && data && styles.stale]}
        // iOS otherwise adds its own automatic inset at the top → extra gap.
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handlePullToRefresh} tintColor={colors.muted} />}>
        {/* Water card → Vann screen for the same day */}
        <Pressable
          style={({ pressed }) => [styles.waterCard, pressed && styles.waterCardPressed]}
          onPress={() => {
            closeCalendar();
            router.push({ pathname: '/water', params: { date: selectedIso } });
          }}
          accessibilityLabel="Vann">
          <View style={styles.waterLeft}>
            <Ionicons name="water-outline" size={18} color="#3B82F6" />
            <Text style={styles.waterText}>
              {waterMl}/{waterGoal} ml
            </Text>
          </View>
          <GlassRow totalMl={waterMl} goalMl={waterGoal} size={20} />
        </Pressable>

        <View>
          <SectionTitle>Dagens oversikt</SectionTitle>
          <Card style={styles.statsCard}>
            <NutritionTotals nutrition={dayTotals} />
          </Card>
        </View>

        <View>
          <SectionTitle>Måltider</SectionTitle>
          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <Card>
              {meals.map((meal, index) => {
                const totals = sumNutrition(meal.meal_items.map((i) => i.nutrition));
                const eatenAt = new Date(meal.eaten_at);
                return (
                  <Pressable
                    key={meal.id}
                    style={({ pressed }) => [styles.mealRow, index > 0 && styles.divider, pressed && styles.pressed]}
                    onPress={() => {
                      closeCalendar();
                      router.push({ pathname: '/meal/[id]', params: { id: meal.id } });
                    }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mealName}>
                        {mealName(eatenAt)} <Text style={styles.mealTime}>· {formatTime(eatenAt)}</Text>
                      </Text>
                      <Text style={styles.mealFoods}>{meal.meal_items.map((i) => i.food_name).join(', ')}</Text>
                    </View>
                    <Text style={styles.mealKcal}>{formatNumber(totals.energy_kcal)} kcal</Text>
                  </Pressable>
                );
              })}
              {/* Only say "no meals" once we actually know (not while loading). */}
              {meals.length === 0 && data && !isStale && (
                <Text style={styles.empty}>Ingen måltider registrert denne dagen.</Text>
              )}
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  // Small top padding: the date header already has space below it.
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.lg, gap: spacing.lg },
  stale: { opacity: 0.5 },
  waterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  waterCardPressed: { transform: [{ scale: 0.98 }], backgroundColor: colors.surfaceRaised },
  waterLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  waterText: { fontSize: font.sm, fontWeight: '500', color: colors.textBody },
  statsCard: { padding: spacing.lg },
  error: { color: colors.danger, fontSize: font.sm },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: 14 },
  divider: { borderTopWidth: 1, borderColor: colors.surfaceRaised },
  pressed: { backgroundColor: colors.surfaceRaised },
  mealName: { fontSize: font.sm, fontWeight: '500', color: colors.textSoft },
  mealTime: { fontWeight: '400', color: colors.muted },
  mealFoods: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  mealKcal: { fontSize: font.sm, fontWeight: '600', color: colors.textBody },
  empty: { textAlign: 'center', fontSize: font.sm, color: colors.muted, paddingVertical: spacing.xl },
});
