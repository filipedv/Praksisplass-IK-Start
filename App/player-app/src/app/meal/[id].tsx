// MEAL DETAIL (sketch: MealDetailScreen), opened by tapping a meal in
// Dagsoversikt. `[id]` in the file name means the meal id comes from the URL
// (/meal/<id>) — Expo Router hands it to us via useLocalSearchParams.
//
// The sketch shows a photo area; since we never store photos, it stays a
// placeholder with the "Bilde ikke lagret" badge — exactly as designed.
//
// Beyond the sketch:
//   - "Endret av administrator" notice when an admin corrected this meal
//   - Rediger: change grams, remove a food, add a food, change the time
//     (changes are collected and saved together with "Lagre endringer")
//   - Logg igjen: open Kamera with the same foods and amounts, timed now

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountEditor } from '@/components/AmountEditor';
import { Attribution } from '@/components/Attribution';
import { DateTimeField } from '@/components/DateTimeField';
import { FoodSearchModal } from '@/components/FoodSearchModal';
import { NutritionTotals } from '@/components/NutritionTotals';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, SectionTitle } from '@/components/ui';
import { colors, font, radius, spacing } from '@/lib/theme';
import { mealName } from '@/meals/meal-name';
import {
  addItem,
  deleteItem,
  deleteMeal,
  fetchFoodsByIds,
  fetchMeal,
  getCachedMeal,
  updateItemAmount,
  updateMealTime,
  type Meal,
} from '@/meals/meals-api';
import { defaultAmountGrams, formatNumber, sumNutrition } from '@/nutrition/math';
import type { Food, Portion } from '@/nutrition/types';
import { useI18n } from '@/lib/i18n';

export default function MealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang, locale } = useI18n();
  // Dagsoversikt already loaded this meal, so show it straight away (no
  // spinner), then refresh quietly. undefined = not cached → spinner.
  const [meal, setMeal] = useState<Meal | null | undefined>(() => getCachedMeal(id));
  const [reloadKey, setReloadKey] = useState(0);

  // Edit mode: drafts are applied together on "Lagre endringer".
  const [editing, setEditing] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, number>>({}); // item id → grams
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [eatenAt, setEatenAt] = useState<Date | null>(null);
  const [portions, setPortions] = useState<Map<string, Portion[]>>(new Map()); // food id → portions
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMeal(id)
      .then((m) => !cancelled && setMeal(m))
      .catch((e) => {
        console.warn('Load meal failed', e);
        if (!cancelled) setMeal((current) => current ?? null); // keep the cached meal if we have one
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  async function startEditing() {
    if (!meal) return;
    setAmounts(Object.fromEntries(meal.meal_items.map((i) => [i.id, i.amount_g])));
    setRemoved(new Set());
    setEatenAt(new Date(meal.eaten_at));
    setEditing(true);
    // Portions make the ½ / 1 / 2 buttons work.
    const ids = meal.meal_items.map((i) => i.food_id).filter((x): x is string => !!x);
    const foods = await fetchFoodsByIds(ids).catch(() => new Map<string, Food>());
    setPortions(new Map([...foods].map(([fid, f]) => [fid, f.portions])));
  }

  async function saveChanges() {
    if (!meal) return;
    const kept = meal.meal_items.filter((i) => !removed.has(i.id));
    if (kept.length === 0) {
      // Removing every food = deleting the meal; ask first.
      return confirmDelete();
    }
    setSaving(true);
    try {
      for (const itemId of removed) await deleteItem(itemId);
      for (const item of kept) {
        const grams = amounts[item.id];
        if (grams !== item.amount_g) {
          if (!(grams > 0)) throw new Error(t('Mengden må være over 0 g', 'The amount must be above 0 g'));
          await updateItemAmount(item.id, grams);
        }
      }
      if (eatenAt && eatenAt.getTime() !== new Date(meal.eaten_at).getTime()) await updateMealTime(meal.id, eatenAt);
      setEditing(false);
      setReloadKey((k) => k + 1);
    } catch (e) {
      Alert.alert(t('Kunne ikke lagre', "Couldn't save"), (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Adding a food is saved right away (it needs a database id to be edited).
  async function handleAdd(food: Food, usualAmount?: number) {
    setAdding(false);
    if (!meal) return;
    try {
      await addItem(meal.id, food.id, usualAmount ?? defaultAmountGrams(food));
      const fresh = await fetchMeal(meal.id);
      if (fresh) {
        setMeal(fresh);
        const added = fresh.meal_items.filter((i) => !(i.id in amounts));
        setAmounts((prev) => ({ ...prev, ...Object.fromEntries(added.map((i) => [i.id, i.amount_g])) }));
        setPortions((prev) => new Map([...prev, [food.id, food.portions]]));
      }
    } catch (e) {
      Alert.alert(t('Kunne ikke legge til', "Couldn't add"), (e as Error).message);
    }
  }

  function logAgain() {
    if (!meal) return;
    const prefill = JSON.stringify(
      meal.meal_items.filter((i) => i.food_id).map((i) => ({ f: i.food_id, g: Math.round(i.amount_g) })),
    );
    router.navigate({ pathname: '/', params: { prefill } }); // Kamera → "Registrert mat", timed now
  }

  // The sketch's "…" button.
  function openMenu() {
    Alert.alert(t('Måltid', 'Meal'), undefined, [
      { text: t('Rediger måltid', 'Edit meal'), onPress: () => void startEditing() },
      { text: t('Logg igjen', 'Log again'), onPress: logAgain },
      { text: t('Slett måltid', 'Delete meal'), style: 'destructive', onPress: confirmDelete },
      { text: t('Avbryt', 'Cancel'), style: 'cancel' },
    ]);
  }

  function confirmDelete() {
    Alert.alert(t('Slett måltid?', 'Delete meal?'), t('Dette kan ikke angres.', 'This cannot be undone.'), [
      { text: t('Avbryt', 'Cancel'), style: 'cancel' },
      {
        text: t('Slett', 'Delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMeal(id);
            router.back(); // Dagsoversikt reloads when it comes back into view
          } catch {
            Alert.alert(t('Kunne ikke slette måltidet.', "Couldn't delete the meal."));
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
        <ScreenHeader title={t('Måltid', 'Meal')} onBack={() => router.back()} backIcon="chevron-back" />
        <Text style={styles.notFound}>{t('Fant ikke måltidet.', 'Meal not found.')}</Text>
      </SafeAreaView>
    );
  }

  const eatenAtDate = new Date(meal.eaten_at);
  const totals = sumNutrition(meal.meal_items.map((i) => i.nutrition));
  const dateText = eatenAtDate.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const timeText = eatenAtDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader
        title={editing ? t('Rediger måltid', 'Edit meal') : mealName(eatenAtDate, lang)}
        onBack={() => (editing ? setEditing(false) : router.back())}
        backIcon={editing ? 'arrow-back' : 'chevron-back'}
        right={
          editing ? null : (
            <Pressable onPress={openMenu} hitSlop={14} accessibilityLabel={t('Flere valg', 'More options')}>
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.muted} />
            </Pressable>
          )
        }
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {meal.admin_changed_at && (
          <View style={styles.adminNotice}>
            <Ionicons name="information-circle-outline" size={18} color={colors.iconSoft} />
            <Text style={styles.adminNoticeText}>
              {t('Endret av administrator', 'Changed by an administrator')}{' '}
              {new Date(meal.admin_changed_at).toLocaleDateString(locale, { day: 'numeric', month: 'long' })}.{' '}
              {t('Ser noe feil ut? Ta kontakt med en administrator.', 'Does something look wrong? Contact an administrator.')}
            </Text>
          </View>
        )}

        {editing ? (
          <>
            <Card style={styles.editRow}>
              <Ionicons name="time-outline" size={16} color={colors.muted} />
              <Text style={styles.editLabel}>{t('Tidspunkt', 'Time')}</Text>
              {eatenAt && (
                <DateTimeField
                  mode="datetime"
                  value={eatenAt}
                  onChange={setEatenAt}
                  maximumDate={new Date()}
                  accessibilityLabel={t('Når ble måltidet spist', 'When the meal was eaten')}
                />
              )}
            </Card>

            {meal.meal_items
              .filter((item) => !removed.has(item.id))
              .map((item) => (
                <Card key={item.id} style={styles.editCard}>
                  <View style={styles.editTop}>
                    <Text style={styles.itemName}>{item.food_name}</Text>
                    <Pressable
                      hitSlop={14}
                      onPress={() => setRemoved((prev) => new Set([...prev, item.id]))}
                      accessibilityLabel={`${t('Fjern', 'Remove')} ${item.food_name}`}>
                      <Ionicons name="trash-outline" size={18} color={colors.faint} />
                    </Pressable>
                  </View>
                  <AmountEditor
                    grams={amounts[item.id] ?? item.amount_g}
                    onChange={(g) => setAmounts((prev) => ({ ...prev, [item.id]: g }))}
                    portions={(item.food_id && portions.get(item.food_id)) || []}
                  />
                </Card>
              ))}

            <Pressable style={styles.addButton} onPress={() => setAdding(true)}>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={styles.addButtonText}>{t('Legg til matvare', 'Add food')}</Text>
            </Pressable>

            <Pressable style={[styles.primaryButton, saving && { opacity: 0.6 }]} onPress={() => void saveChanges()} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{t('Lagre endringer', 'Save changes')}</Text>}
            </Pressable>
            <Pressable onPress={() => setEditing(false)} hitSlop={8} style={{ alignSelf: 'center', padding: spacing.sm }}>
              <Text style={styles.cancel}>{t('Avbryt', 'Cancel')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            {/* Photo placeholder — we never store the photo. */}
            <View style={styles.photo}>
              <Ionicons name="restaurant-outline" size={40} color={colors.muted} />
              <View style={styles.notStoredBadge}>
                <Text style={styles.notStoredText}>{t('Bilde ikke lagret', 'Photo not stored')}</Text>
              </View>
              <View style={styles.dateBadge}>
                <Ionicons name="calendar-outline" size={12} color="#fff" />
                <Text style={styles.dateBadgeText}>
                  {dateText} · {timeText}
                </Text>
              </View>
            </View>

            <View>
              <SectionTitle>{t('Næringsoversikt', 'Nutrition overview')}</SectionTitle>
              <Card style={{ padding: spacing.lg }}>
                <NutritionTotals nutrition={totals} />
              </Card>
            </View>

            <View>
              <SectionTitle>{t('Måltidsvarer', 'Foods in this meal')}</SectionTitle>
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

            <View style={styles.actions}>
              <Pressable style={styles.secondaryButton} onPress={() => void startEditing()}>
                <Ionicons name="create-outline" size={16} color={colors.textBody} />
                <Text style={styles.secondaryButtonText}>{t('Rediger', 'Edit')}</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={logAgain}>
                <Ionicons name="repeat-outline" size={16} color={colors.textBody} />
                <Text style={styles.secondaryButtonText}>{t('Logg igjen', 'Log again')}</Text>
              </Pressable>
            </View>

            <Attribution />
          </>
        )}
      </ScrollView>

      <FoodSearchModal key={adding ? 'open' : 'closed'} visible={adding} onSelect={(f, g) => void handleAdd(f, g)} onClose={() => setAdding(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  notFound: { color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg },
  adminNotice: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  adminNoticeText: { flex: 1, fontSize: font.xs, color: colors.textBody, lineHeight: 17 },
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
  itemName: { flex: 1, fontSize: font.sm, fontWeight: '500', color: colors.textSoft },
  itemGrams: { fontSize: font.xs, color: colors.muted },
  itemKcal: { fontSize: font.sm, fontWeight: '600', color: colors.textBody },
  actions: { flexDirection: 'row', gap: spacing.md },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 48,
  },
  secondaryButtonText: { fontSize: font.sm, fontWeight: '500', color: colors.textBody },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, minHeight: 56 },
  editLabel: { flex: 1, fontSize: font.sm, color: colors.textBody },
  editCard: { padding: spacing.md, gap: spacing.md },
  editTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  addButton: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primaryBorder,
    borderRadius: radius.md,
    minHeight: 48,
  },
  addButtonText: { color: colors.primary, fontWeight: '500', fontSize: font.sm },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },
  cancel: { color: colors.muted, fontSize: font.sm },
});
