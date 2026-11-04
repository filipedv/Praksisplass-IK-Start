// How much was eaten — used on "Registrert mat", when editing a saved meal,
// and on "Søk i matvarer":
//
//   (−)  150  g  (+)                       ≈ 1 porsjon
//   [½ porsjon] [1 porsjon] [2 porsjoner]
//
// Tap targets are at least ~44 pt (Apple/Google guidance): the round buttons
// are 36 px with extra hitSlop, and the portion chips are 36 px tall.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, font, radius, spacing } from '@/lib/theme';
import { formatNumber, portionEquivalent, portionName } from '@/nutrition/math';
import type { Portion } from '@/nutrition/types';
import { useI18n } from '@/lib/i18n';

type Props = {
  grams: number;
  onChange: (grams: number) => void;
  portions: Portion[];
  step?: number; // the − / + step in grams
};

const QUICK_MULTIPLES = [0.5, 1, 2];

export function AmountEditor({ grams, onChange, portions, step = 10 }: Props) {
  const { t, lang } = useI18n();
  const portion = portions[0];
  const equivalent = portionEquivalent(grams, portions, lang);

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <View style={styles.stepperGroup}>
          <Pressable
            style={({ pressed }) => [styles.stepper, pressed && styles.pressed]}
            onPress={() => onChange(Math.max(step, grams - step))}
            hitSlop={6}
            accessibilityLabel={t(`${step} gram mindre`, `${step} grams less`)}>
            <Ionicons name="remove" size={18} color={colors.iconSoft} />
          </Pressable>
          <TextInput
            style={styles.gramsInput}
            keyboardType="number-pad"
            keyboardAppearance="dark"
            value={String(grams)}
            // Keep only digits; an empty box counts as 0 until the user types.
            onChangeText={(text) => onChange(Number(text.replace(/[^0-9]/g, '')) || 0)}
            selectTextOnFocus
            accessibilityLabel={t('Mengde i gram', 'Amount in grams')}
          />
          <Text style={styles.unit}>g</Text>
          <Pressable
            style={({ pressed }) => [styles.stepper, pressed && styles.pressed]}
            onPress={() => onChange(grams + step)}
            hitSlop={6}
            accessibilityLabel={t(`${step} gram mer`, `${step} grams more`)}>
            <Ionicons name="add" size={18} color={colors.iconSoft} />
          </Pressable>
        </View>
        <Text style={styles.equivalent}>{equivalent ?? ''}</Text>
      </View>

      {portion && (
        <View style={styles.chips}>
          {QUICK_MULTIPLES.map((m) => {
            const value = Math.round(portion.grams * m);
            const active = value === grams;
            const label = `${m === 0.5 ? '½' : formatNumber(m)} ${portionName(portion.name, m > 1, lang)}`;
            return (
              <Pressable
                key={m}
                style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
                onPress={() => onChange(value)}
                accessibilityLabel={`${label}, ${value} ${t('gram', 'grams')}`}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  gramsInput: {
    width: 56,
    textAlign: 'center',
    fontSize: font.base,
    fontWeight: '600',
    color: colors.text,
    paddingVertical: 6,
  },
  unit: { fontSize: font.xs, color: colors.muted },
  equivalent: { fontSize: font.xs, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.xs, color: colors.textBody },
  chipTextActive: { color: '#fff', fontWeight: '600' },
});
