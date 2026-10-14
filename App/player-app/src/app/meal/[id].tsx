// MEAL DETAIL (sketch: MealDetailScreen), opened by tapping a meal in
// Dagsoversikt. `[id]` in the file name means the meal id comes from the URL
// (/meal/<id>) — Expo Router hands it to us via useLocalSearchParams.
//
// The sketch shows a photo area; since we never store photos, it stays a
// placeholder with the "Bilde ikke lagret" badge — exactly as designed.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Attribution } from '@/components/Attribution';
import { NutritionTotals } from '@/components/NutritionTotals';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, SectionTitle } from '@/components/ui';
import { colors, font, radius, spacing } from '@/lib/theme';
import { mealName } from '@/meals/meal-name';
import { deleteMeal, fetchMeal, getCachedMeal, type Meal } from '@/meals/meals-api';
import { formatNumber, sumNutrition } from '@/nutrition/math';

export default function MealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Dagsoversikt already loaded this meal, so show it straight away (no
  // spinner), then refresh quietly. undefined = not cached → spinner.
  const [meal, setMeal] = useState<Meal | null | undefined>(() => getCachedMeal(id));

  useEffect(() => {
    fetchMeal(id)
      .then(setMeal)
      .catch((e) => {
        console.warn('Load meal failed', e);
        setMeal((current) => current ?? null); // keep the cached meal if we have one
      });
  }, [id]);

  // The sketch's "…" button. Its only action for now: delete the meal.
  function openMenu() {
    Alert.alert('Måltid', undefined, [
      { text: 'Slett måltid', style: 'destructive', onPress: confirmDelete },
      { text: 'Avbryt', style: 'cancel' },
    ]);
  }

  function confirmDelete() {
    Alert.alert('Slett måltid?', 'Dette kan ikke angres.', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Slett',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMeal(id);
            router.back(); // Dagsoversikt reloads when it comes back into view
          } catch {
            Alert.alert('Kunne ikke slette måltidet.');
          }
        },
      },
    ]);
  }

  if (meal === undefined) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (meal === null) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Måltid" onBack={() => router.back()} backIcon="chevron-back" />
        <Text style={styles.notFound}>Fant ikke måltidet.</Text>
      </SafeAreaView>
    );
  }

  const eatenAt = new Date(meal.eaten_at);
  const totals = sumNutrition(meal.meal_items.map((i) => i.nutrition));
  const dateText = eatenAt.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
  const timeText = eatenAt.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader
        title={mealName(eatenAt)}
        onBack={() => router.back()}
        backIcon="chevron-back"
        right={
          <Pressable onPress={openMenu} hitSlop={12} accessibilityLabel="Flere valg">
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Photo placeholder — we never store the photo. */}
        <View style={styles.photo}>
          <Ionicons name="restaurant-outline" size={40} color={colors.muted} />
          <View style={styles.notStoredBadge}>
            <Text style={styles.notStoredText}>Bilde ikke lagret</Text>
          </View>
          <View style={styles.dateBadge}>
            <Ionicons name="calendar-outline" size={12} color="#fff" />
            <Text style={styles.dateBadgeText}>
              {dateText} · {timeText}
            </Text>
          </View>
        </View>

        <View>
          <SectionTitle>Næringsoversikt</SectionTitle>
          <Card style={{ padding: spacing.lg }}>
            <NutritionTotals nutrition={totals} />
          </Card>
        </View>

        <View>
          <SectionTitle>Måltidsvarer</SectionTitle>
          <Card>
            {meal.meal_items.map((item, i) => {
              const tone = colors.avatarTones[i % colors.avatarTones.length];
              return (
                <View key={item.id} style={[styles.itemRow, i > 0 && styles.divider]}>
                  <View style={[styles.avatar, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.avatarText, { color: tone.text }]}>{item.food_name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.food_name}</Text>
                    <Text style={styles.itemGrams}>{formatNumber(item.amount_g)} g</Text>
                  </View>
                  <Text style={styles.itemKcal}>{formatNumber(item.nutrition.energy_kcal)} kcal</Text>
                </View>
              );
            })}
          </Card>
        </View>

        <Attribution />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  notFound: { color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg },
  // Sketch: h-52 rounded-3xl gradient slate-800 → slate-700 (flat colour here).
  photo: {
    height: 208,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  notStoredBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  notStoredText: { fontSize: font.xs, color: colors.mutedLight },
  dateBadge: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  dateBadgeText: { fontSize: font.xs, color: '#fff' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: 14 },
  divider: { borderTopWidth: 1, borderColor: colors.surfaceRaised },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: font.xs, fontWeight: '600' },
  itemName: { fontSize: font.sm, fontWeight: '500', color: colors.textSoft },
  itemGrams: { fontSize: font.xs, color: colors.muted },
  itemKcal: { fontSize: font.sm, fontWeight: '600', color: colors.textBody },
});
