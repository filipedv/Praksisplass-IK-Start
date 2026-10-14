// "Legg til mat" sheet (sketch: KameraTab picker): search over the cached
// Matvaretabellen list, to add a food the recognizer missed or swap a wrong match.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, radius, spacing } from '@/lib/theme';
import { searchFoods } from '@/nutrition/foods-api';
import { formatNumber } from '@/nutrition/math';
import type { FoodSearchResult } from '@/nutrition/types';

import { Attribution } from './Attribution';

type Props = {
  visible: boolean;
  initialQuery?: string;
  onSelect: (food: FoodSearchResult) => void;
  onClose: () => void;
};

/** Right-hand hint in each result, e.g. "1 porsjon = 150 g" (as in the sketch). */
function portionHint(food: FoodSearchResult): string {
  const portion = food.portions[0];
  if (portion) return `1 ${portion.name} = ${formatNumber(portion.grams)} g`;
  return `${formatNumber(food.nutrition.energy_kcal)} kcal / 100 g`;
}

// Tip: the parent gives this component a `key` that changes each time it
// opens, so React creates it fresh and the search box starts from
// `initialQuery` again.
export function FoodSearchModal({ visible, initialQuery = '', onSelect, onClose }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

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
          <Text style={styles.title}>Legg til mat</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Lukk">
            <Ionicons name="close" size={18} color={colors.muted} />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={14} color={colors.muted} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Søk i matvarer…"
            placeholderTextColor={colors.muted}
            autoFocus
            autoCorrect={false}
            clearButtonMode="while-editing"
            keyboardAppearance="dark"
          />
        </View>

        {loading && <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.primary} />}

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            !loading && query.trim() ? <Text style={styles.empty}>Ingen treff i Matvaretabellen.</Text> : null
          }
          renderItem={({ item }) => (
            <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => onSelect(item)}>
              <Text style={styles.name} numberOfLines={2}>
                {item.name_nb}
                {item.source === 'custom' ? <Text style={styles.custom}> · egendefinert</Text> : null}
              </Text>
              <Text style={styles.hint}>{portionHint(item)}</Text>
            </Pressable>
          )}
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
  },
  rowPressed: { backgroundColor: colors.surfaceRaised },
  name: { flex: 1, fontSize: font.sm, color: colors.textBody },
  custom: { color: colors.muted },
  hint: { fontSize: font.xs, color: colors.muted },
  empty: { paddingTop: spacing.xl, color: colors.muted, textAlign: 'center', fontSize: font.xs },
});
