// One food card on the "Registrert mat" screen (sketch: KameraTab, step "overview"):
//
//   Kyllingfilet, stekt                         🗑
//   (91% sikker)
//   (−)  150  g  (+)                  ≈ 1 porsjon
//
// The user can tap the name to swap the food (opens search), change the grams
// (typing, or − / +), or remove it.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from '@/lib/theme';
import type { Food } from '@/nutrition/types';

import { AmountEditor } from './AmountEditor';
import { Card, Pill } from './ui';
import { useI18n } from '@/lib/i18n';

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

/** Above this the badge is green, otherwise amber — same rule as the sketch. */
const HIGH_CONFIDENCE = 0.85;

export function DraftItemRow({ item, onChangeAmount, onPickFood, onRemove }: Props) {
  const { t } = useI18n();
  // Unmatched: ask the user to pick the right food themselves.
  if (!item.food) {
    return (
      <Card style={[styles.card, styles.unmatchedCard]}>
        <View style={styles.topRow}>
          <Text style={styles.unmatchedText}>
            {t(`Fant ikke «${item.detectedLabel}» i Matvaretabellen.`, `Couldn't find “${item.detectedLabel}” in Matvaretabellen.`)}
          </Text>
          <RemoveButton onPress={onRemove} />
        </View>
        <Pressable style={styles.pickButton} onPress={onPickFood}>
          <Text style={styles.pickButtonText}>{t('Velg matvare', 'Choose food')}</Text>
        </Pressable>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <Pressable style={styles.nameArea} onPress={onPickFood} accessibilityHint={t('Bytt matvare', 'Change food')}>
          <Text style={styles.name}>{item.food.name_nb}</Text>
          <ItemPill item={item} />
        </Pressable>
        <RemoveButton onPress={onRemove} />
      </View>

      <AmountEditor grams={item.amountG} onChange={onChangeAmount} portions={item.food.portions} />
    </Card>
  );
}

/** "91% sikker" (recognizer), "Lagt til manuelt" (search), or nothing (FatSecret gives no score). */
function ItemPill({ item }: { item: DraftItem }) {
  const { t } = useI18n();
  if (item.detectedLabel === null) return <Pill tone="slate">{t('Lagt til manuelt', 'Added by hand')}</Pill>;
  if (item.confidence === null) return null;
  return (
    <Pill tone={item.confidence > HIGH_CONFIDENCE ? 'green' : 'amber'}>{t(`${Math.round(item.confidence * 100)}% sikker`, `${Math.round(item.confidence * 100)}% sure`)}</Pill>
  );
}

function RemoveButton({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <Pressable onPress={onPress} hitSlop={14} accessibilityLabel={t('Fjern', 'Remove')}>
      <Ionicons name="trash-outline" size={18} color={colors.faint} />
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
});
