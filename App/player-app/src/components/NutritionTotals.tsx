// The sketch's `NutritionStatGrid`: four big numbers (kcal, protein, carbs,
// fat), each with a label and a coloured dot. Used in "Dagens oversikt" and
// in the meal detail's "Næringsoversikt".
//
// With `goals` (Dagens oversikt only) each number also shows "av <goal>" and
// a thin progress bar. The bar stops at full; going over the goal is shown
// by the number, not by a red warning — this is a log, not a score.

import { StyleSheet, Text, View } from 'react-native';

import { colors, font } from '@/lib/theme';
import { formatNumber } from '@/nutrition/math';
import type { Nutrition } from '@/nutrition/types';
import { useI18n } from '@/lib/i18n';

export type MacroGoals = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };

export function NutritionTotals({ nutrition, goals }: { nutrition: Nutrition; goals?: MacroGoals }) {
  const { t } = useI18n();
  const cells = [
    { label: 'kcal', value: nutrition.energy_kcal, goal: goals?.kcal, unit: '', dot: colors.macro.kcal },
    { label: 'Protein', value: nutrition.protein_g, goal: goals?.protein_g, unit: 'g', dot: colors.macro.protein },
    { label: t('Karbo', 'Carbs'), value: nutrition.carbs_g, goal: goals?.carbs_g, unit: 'g', dot: colors.macro.carbs },
    { label: t('Fett', 'Fat'), value: nutrition.fat_g, goal: goals?.fat_g, unit: 'g', dot: colors.macro.fat },
  ];

  return (
    <View style={styles.row}>
      {cells.map((c) => {
        const value = c.value ?? 0;
        const share = c.goal ? Math.min(1, value / c.goal) : 0;
        return (
          <View
            key={c.label}
            style={styles.cell}
            accessibilityLabel={`${c.label}: ${formatNumber(value)}${c.unit}${c.goal ? ` ${t('av', 'of')} ${formatNumber(c.goal)}${c.unit}` : ''}`}>
            <Text style={styles.value}>
              {formatNumber(value)}
              {c.unit ? <Text style={styles.unit}>{c.unit}</Text> : null}
            </Text>
            <Text style={styles.label}>{c.label}</Text>
            {c.goal ? (
              <>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: c.dot }]} />
                </View>
                <Text style={styles.goal}>
                  {t('av', 'of')} {formatNumber(c.goal)}
                  {c.unit}
                </Text>
              </>
            ) : (
              <View style={[styles.dot, { backgroundColor: c.dot }]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  cell: { flex: 1, alignItems: 'center', gap: 6 },
  value: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  unit: { fontSize: font.xs, fontWeight: '500', color: colors.muted },
  label: { fontSize: font.xs, color: colors.muted },
  dot: { width: 8, height: 8, borderRadius: 4 },
  track: { alignSelf: 'stretch', height: 4, borderRadius: 2, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  goal: { fontSize: 11, color: colors.muted },
});
