// One food card on the "Registrert mat" screen (sketch: KameraTab, step "overview"):
//
//   Kyllingfilet, stekt                         🗑
//   (91% sikker)
//   (−)  150  g  (+)                  ≈ 1 porsjon
//
// The user can tap the name to swap the food (opens search), change the grams
// (typing, or − / +), or remove it.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, font, radius, spacing } from '@/lib/theme';
import { portionEquivalent } from '@/nutrition/math';
import type { Food } from '@/nutrition/types';

import { Card, Pill } from './ui';

/** An item in the meal being built, before it's saved. */
export type DraftItem = {
  key: string; // local id for React lists
  food: Food | null; // null = recognizer label we couldn't match
  amountG: number;
  detectedLabel: string | null; // what the recognizer said; null = added by hand
  storableId: string | null; // what we save as meal_items.detected_label
  confidence: number | null; // 0–1 from the recognizer; null if unknown / added by hand
};

type Props = {
  item: DraftItem;
  onChangeAmount: (grams: number) => void;
  onPickFood: () => void;
  onRemove: () => void;
};

const STEP_G = 10;
/** Above this the badge is green, otherwise amber — same rule as the sketch. */
const HIGH_CONFIDENCE = 0.85;

export function DraftItemRow({ item, onChangeAmount, onPickFood, onRemove }: Props) {
  // Unmatched: ask the user to pick the right food themselves.
  if (!item.food) {
    return (
      <Card style={[styles.card, styles.unmatchedCard]}>
        <View style={styles.topRow}>
          <Text style={styles.unmatchedText}>Fant ikke «{item.detectedLabel}» i Matvaretabellen.</Text>
          <RemoveButton onPress={onRemove} />
        </View>
        <Pressable style={styles.pickButton} onPress={onPickFood}>
          <Text style={styles.pickButtonText}>Velg matvare</Text>
        </Pressable>
      </Card>
    );
  }

  const portion = portionEquivalent(item.amountG, item.food.portions);

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <Pressable style={styles.nameArea} onPress={onPickFood} accessibilityHint="Bytt matvare">
          <Text style={styles.name}>{item.food.name_nb}</Text>
          <ItemPill item={item} />
        </Pressable>
        <RemoveButton onPress={onRemove} />
      </View>

      <View style={styles.amountRow}>
        <View style={styles.stepperGroup}>
          <Pressable style={styles.stepper} onPress={() => onChangeAmount(Math.max(STEP_G, item.amountG - STEP_G))}>
            <Ionicons name="remove" size={12} color={colors.iconSoft} />
          </Pressable>
          <TextInput
            style={styles.gramsInput}
            keyboardType="number-pad"
            keyboardAppearance="dark"
            value={String(item.amountG)}
            // Keep only digits; an empty box counts as 0 until the user types.
            onChangeText={(text) => onChangeAmount(Number(text.replace(/[^0-9]/g, '')) || 0)}
            selectTextOnFocus
          />
          <Text style={styles.unit}>g</Text>
          <Pressable style={styles.stepper} onPress={() => onChangeAmount(item.amountG + STEP_G)}>
            <Ionicons name="add" size={12} color={colors.iconSoft} />
          </Pressable>
        </View>
        <Text style={styles.portion}>{portion ?? ''}</Text>
      </View>
    </Card>
  );
}

/** "91% sikker" (recognizer), "Lagt til manuelt" (search), or nothing (FatSecret gives no score). */
function ItemPill({ item }: { item: DraftItem }) {
  if (item.detectedLabel === null) return <Pill tone="slate">Lagt til manuelt</Pill>;
  if (item.confidence === null) return null;
  return (
    <Pill tone={item.confidence > HIGH_CONFIDENCE ? 'green' : 'amber'}>{Math.round(item.confidence * 100)}% sikker</Pill>
  );
}

function RemoveButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityLabel="Fjern">
      <Ionicons name="trash-outline" size={15} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.md },
  unmatchedCard: { borderColor: colors.warning, backgroundColor: colors.warningBg },
  unmatchedText: { flex: 1, color: colors.warning, fontSize: font.sm },
  pickButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  pickButtonText: { color: '#fff', fontWeight: '500', fontSize: font.xs },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  nameArea: { flex: 1, gap: spacing.xs },
  name: { fontSize: font.sm, fontWeight: '500', color: colors.textSoft },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gramsInput: { width: 48, textAlign: 'center', fontSize: font.sm, color: colors.text, paddingVertical: 2 },
  unit: { fontSize: font.xs, color: colors.muted },
  portion: { fontSize: font.xs, color: colors.muted },
});
