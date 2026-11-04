// "Legg til mat" sheet (sketch: KameraTab picker): search over the cached
// Matvaretabellen list, to add a food the recognizer missed or swap a wrong match.
// With an empty search box it shows "Nylig brukt": my most-used foods, which
// are added with MY usual amount (quick logging for repeat meals).

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, radius, spacing } from '@/lib/theme';
import { fetchRecentFoods, type RecentFood } from '@/meals/meals-api';
import { searchFoods } from '@/nutrition/foods-api';
import { formatNumber, portionName } from '@/nutrition/math';
import type { FoodSearchResult } from '@/nutrition/types';

import { Attribution } from './Attribution';
import { type Language, useI18n } from '@/lib/i18n';

type Props = {
  visible: boolean;
  initialQuery?: string;
  /** `amountG` is set when a recent food was picked (my usual amount). */
  onSelect: (food: FoodSearchResult, amountG?: number) => void;
  onClose: () => void;
};

/** Right-hand hint in each result, e.g. "1 porsjon = 150 g" (as in the sketch). */
function portionHint(food: FoodSearchResult, lang: Language): string {
  const portion = food.portions[0];
  if (portion) return `1 ${portionName(portion.name, false, lang)} = ${formatNumber(portion.grams)} g`;
  return `${formatNumber(food.nutrition.energy_kcal)} kcal / 100 g`;
}

// Tip: the parent gives this component a `key` that changes each time it
// opens, so React creates it fresh and the search box starts from
// `initialQuery` again.
export function FoodSearchModal({ visible, initialQuery = '', onSelect, onClose }: Props) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<RecentFood[]>([]);

  // My most-used foods, shown while the search box is empty.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    fetchRecentFoods(8)
      .then((foods) => !cancelled && setRecent(foods))
      .catch(() => {}); // not essential: search still works
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const showRecent = !query.trim() && recent.length > 0;

  // Search 300 ms after the user stops typing ("debounce"), so we don't send
  // one request per keystroke.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await searchFoods(query, 25);
        if (!cancelled) setResults(found);
      } catch (e) {
        console.warn('Search failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('Legg til mat', 'Add food')}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel={t('Lukk', 'Close')}>
            <Ionicons name="close" size={18} color={colors.muted} />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={14} color={colors.muted} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder={t('Søk i matvarer…', 'Search foods… (Norwegian or English)')}
            placeholderTextColor={colors.muted}
            autoFocus
            autoCorrect={false}
            clearButtonMode="while-editing"
            keyboardAppearance="dark"
          />
        </View>

        {loading && <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.primary} />}

        {showRecent && <Text style={styles.sectionLabel}>{t('Nylig brukt', 'Recently used')}</Text>}
        <FlatList<FoodSearchResult | RecentFood>
          data={showRecent ? recent : results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            !loading && query.trim() ? <Text style={styles.empty}>{t('Ingen treff i Matvaretabellen.', 'No results in Matvaretabellen.')}</Text> : null
          }
          renderItem={({ item }) => {
            const isRecent = 'timesUsed' in item;
            return (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() =>
                  isRecent ? onSelect({ ...item, score: 1 }, item.typicalAmountG) : onSelect(item as FoodSearchResult)
                }>
                <Text style={styles.name} numberOfLines={2}>
                  {item.name_nb}
                  {item.source === 'custom' ? <Text style={styles.custom}> · {t('egendefinert', 'custom')}</Text> : null}
                </Text>
                <Text style={styles.hint}>
                  {isRecent
                    ? t(`${formatNumber(item.typicalAmountG)} g · brukt ${item.timesUsed}×`, `${formatNumber(item.typicalAmountG)} g · used ${item.timesUsed}×`)
                    : portionHint(item as FoodSearchResult, lang)}
                </Text>
              </Pressable>
            );
          }}
        />

        <Attribution />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: font.sm, fontWeight: '600', color: colors.textSoft },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, paddingVertical: spacing.sm + 2, fontSize: font.sm, color: colors.text },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: 6 },
  sectionLabel: { fontSize: font.xs, fontWeight: '600', color: colors.muted, paddingHorizontal: spacing.lg, paddingBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 52, // comfortable tap target
  },
  rowPressed: { backgroundColor: colors.surfaceRaised },
  name: { flex: 1, fontSize: font.sm, color: colors.textBody },
  custom: { color: colors.muted },
  hint: { fontSize: font.xs, color: colors.muted },
  empty: { paddingTop: spacing.xl, color: colors.muted, textAlign: 'center', fontSize: font.xs },
});
