// The sketch's `TopBar`: optional back arrow on the left, a centred title,
// and an optional button on the right (e.g. "…" on the meal detail screen).

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, spacing } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

type Props = {
  title: string;
  onBack?: () => void; // no back arrow when omitted
  backIcon?: 'arrow-back' | 'chevron-back'; // the sketch uses both
  right?: ReactNode;
};

export function ScreenHeader({ title, onBack, backIcon = 'arrow-back', right }: Props) {
  const { t } = useI18n();
  return (
    <View style={styles.row}>
      {/* Fixed-width sides keep the title centred whether or not there's an arrow. */}
      <View style={styles.side}>
        {onBack && (
          <Pressable onPress={onBack} hitSlop={12} accessibilityLabel={t('Tilbake', 'Back')}>
            <Ionicons name={backIcon} size={backIcon === 'arrow-back' ? 20 : 22} color={colors.iconSoft} />
          </Pressable>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  // px-4 pt-3 pb-2
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  side: { width: 32 },
  right: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center', fontSize: font.base, fontWeight: '600', color: colors.text },
});
