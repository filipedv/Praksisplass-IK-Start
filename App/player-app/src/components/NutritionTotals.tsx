// The sketch's `NutritionStatGrid`: four big numbers (kcal, protein, carbs,
// fat), each with a label and a coloured dot. Used in "Dagens oversikt" and
// in the meal detail's "Næringsoversikt".

import { StyleSheet, Text, View } from 'react-native';

import { colors, font } from '@/lib/theme';
import { formatNumber } from '@/nutrition/math';
import type { Nutrition } from '@/nutrition/types';

export function NutritionTotals({ nutrition }: { nutrition: Nutrition }) {
  const cells = [
    { label: 'kcal', value: nutrition.energy_kcal, unit: '', dot: colors.macro.kcal },
    { label: 'Protein', value: nutrition.protein_g, unit: 'g', dot: colors.macro.protein },
    { label: 'Karbo', value: nutrition.carbs_g, unit: 'g', dot: colors.macro.carbs },
    { label: 'Fett', value: nutrition.fat_g, unit: 'g', dot: colors.macro.fat },
  ];

  return (
    <View style={styles.row}>
      {cells.map((c) => (
        <View key={c.label} style={styles.cell}>
          <Text style={styles.value}>
            {formatNumber(c.value ?? 0)}
            {c.unit ? <Text style={styles.unit}>{c.unit}</Text> : null}
          </Text>
          <Text style={styles.label}>{c.label}</Text>
          <View style={[styles.dot, { backgroundColor: c.dot }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { flex: 1, alignItems: 'center', gap: 6 },
  value: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  unit: { fontSize: font.xs, fontWeight: '500', color: colors.muted },
  label: { fontSize: font.xs, color: colors.muted },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
