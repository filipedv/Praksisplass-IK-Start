// SØK I MATVARER (sketch: SearchScreen) — look up any food outside the
// capture flow: how much energy/protein/… is in X grams or one portion?
// "Legg til i logg" opens Kamera's "Registrert mat" with the food filled in.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountEditor } from '@/components/AmountEditor';
import { Attribution } from '@/components/Attribution';
import { NutritionTotals } from '@/components/NutritionTotals';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/ui';
import { colors, font, radius, spacing } from '@/lib/theme';
import { fetchRecentFoods, type RecentFood } from '@/meals/meals-api';
import { searchFoods } from '@/nutrition/foods-api';
import { defaultAmountGrams, formatNumber, portionName, scaleNutrition } from '@/nutrition/math';
import type { Food } from '@/nutrition/types';
import { useI18n } from '@/lib/i18n';

type Mode = 'grams' | 'portion';

export default function SearchScreen() {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [recent, setRecent] = useState<RecentFood[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Food | null>(null);
  const [mode, setMode] = useState<Mode>('grams');
  const [grams, setGrams] = useState(100);

  useEffect(() => {
    let cancelled = false;
    fetchRecentFoods(8)
      .then((foods) => !cancelled && setRecent(foods))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Search 300 ms after typing stops.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        if (!cancelled) setResults([]);
        return;
      }
      setLoading(true);
      try {
        const found = await searchFoods(query, 25);
        if (!cancelled) setResults(found);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function choose(food: Food, usualAmount?: number) {
    setSelected(food);
    setMode('grams');
    setGrams(usualAmount ?? 100);
  }

  const portion = selected?.portions[0];
  const amount = selected ? (mode === 'portion' && portion ? portion.grams : grams) : 0;
  const totals = selected ? scaleNutrition(selected.nutrition, amount) : {};

  function addToLog() {
    if (!selected) return;
    const prefill = JSON.stringify([{ f: selected.id, g: Math.round(amount || defaultAmountGrams(selected)) }]);
    router.navigate({ pathname: '/', params: { prefill } }); // Kamera → "Registrert mat"
  }

  const showRecent = !query.trim() && recent.length > 0;
  const list: (Food | RecentFood)[] = showRecent ? recent : results;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title={t('Søk i matvarer', 'Search foods')} onBack={() => (selected ? setSelected(null) : router.back())} />

      {!selected ? (
        <View style={{ flex: 1 }}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={15} color={colors.muted} />
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder={t('Søk, f.eks. kylling, havregryn…', 'Search, e.g. chicken, oats…')}
              placeholderTextColor={colors.muted}
              autoFocus
              autoCorrect={false}
              clearButtonMode="while-editing"
              keyboardAppearance="dark"
            />
          </View>
          {showRecent && <Text style={styles.sectionLabel}>{t('Nylig brukt', 'Recently used')}</Text>}
          {loading && <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.primary} />}
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={!loading && query.trim() ? <Text style={styles.empty}>{t('Ingen treff i Matvaretabellen.', 'No results in Matvaretabellen.')}</Text> : null}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => choose(item, 'typicalAmountG' in item ? item.typicalAmountG : undefined)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name_nb}</Text>
                  <Text style={styles.meta}>
                    {'timesUsed' in item
                      ? t(
                          `Vanligvis ${formatNumber(item.typicalAmountG)} g · brukt ${item.timesUsed}×`,
                          `Usually ${formatNumber(item.typicalAmountG)} g · used ${item.timesUsed}×`,
                        )
                      : `${formatNumber(item.nutrition.energy_kcal)} kcal / 100 g`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.faint} />
              </Pressable>
            )}
          />
        </View>
      ) : (
        <View style={styles.detail}>
          <Card style={styles.card}>
            <Text style={styles.detailName}>{selected.name_nb}</Text>

            {/* Sketch: "Gram | 1 porsjon" */}
            {portion && (
              <View style={styles.segment}>
                {(['grams', 'portion'] as Mode[]).map((m) => (
                  <Pressable
                    key={m}
                    style={[styles.segmentButton, mode === m && styles.segmentActive]}
                    onPress={() => setMode(m)}
                    accessibilityState={{ selected: mode === m }}>
                    <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                      {m === 'grams' ? t('Gram', 'Grams') : `1 ${portionName(portion.name, false, lang)}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {mode === 'grams' || !portion ? (
              <AmountEditor grams={grams} onChange={setGrams} portions={selected.portions} step={25} />
            ) : (
              <Text style={styles.portionInfo}>
                1 {portionName(portion.name, false, lang)} = {formatNumber(portion.grams)} g
              </Text>
            )}

            <View style={styles.divider}>
              <NutritionTotals nutrition={totals} />
            </View>
          </Card>

          <Pressable style={styles.addButton} onPress={addToLog} disabled={amount <= 0}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addButtonText}>{t('Legg til i logg', 'Add to log')}</Text>
          </Pressable>
        </View>
      )}

      <Attribution />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, paddingVertical: spacing.md, fontSize: font.sm, color: colors.text },
  sectionLabel: { fontSize: font.xs, fontWeight: '600', color: colors.muted, paddingHorizontal: spacing.lg, paddingBottom: 6 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 52,
  },
  rowPressed: { backgroundColor: colors.surfaceRaised },
  name: { fontSize: font.sm, color: colors.textBody },
  meta: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.muted, paddingTop: spacing.xl, fontSize: font.sm },
  detail: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.lg },
  card: { padding: spacing.lg, gap: spacing.lg },
  detailName: { fontSize: font.base, fontWeight: '600', color: colors.textSoft, textAlign: 'center' },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceRaised, borderRadius: radius.sm, padding: 4 },
  segmentButton: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center', minHeight: 36, justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.border },
  segmentText: { fontSize: font.xs, fontWeight: '500', color: colors.muted },
  segmentTextActive: { color: colors.text },
  portionInfo: { textAlign: 'center', fontSize: font.xs, color: colors.muted },
  divider: { borderTopWidth: 1, borderColor: colors.surfaceRaised, paddingTop: spacing.md },
  addButton: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },
});
