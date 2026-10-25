// Small building blocks copied from the sketch's shared components
// (Card, Pill, MenuRow), so every screen uses the same look.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, font, radius, spacing } from '@/lib/theme';

/** Sketch `Card`: slate-900, rounded-2xl, slate-700 border. */
export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Sketch `Pill`: small rounded-full badge. */
export function Pill({ children, tone = 'slate' }: PropsWithChildren<{ tone?: keyof typeof colors.pill }>) {
  const palette = colors.pill[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Text style={[styles.pillText, { color: palette.text }]}>{children}</Text>
    </View>
  );
}

/** A row in a menu card ("Personvernnotater ›"). Pass `divider` for every row but the first. */
export function MenuRow({ label, onPress, divider }: { label: string; onPress: () => void; divider?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuRow, divider && styles.divider, pressed && styles.pressed]}
      onPress={onPress}>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color={colors.faint} />
    </Pressable>
  );
}

/** Bold section heading above a card ("Oversikt", "Måltider"). */
export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  pillText: { fontSize: font.xs, fontWeight: '500' },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  divider: { borderTopWidth: 1, borderColor: colors.surfaceRaised },
  pressed: { backgroundColor: colors.surfaceRaised },
  menuLabel: { fontSize: font.sm, color: colors.textBody },
  sectionTitle: { fontSize: font.sm, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
});
