// Water visuals from the sketch: a glass that fills up, a row of glasses
// (1 glass = 500 ml), and the circular progress ring on the Vann screen.
// Drawn with react-native-svg (SVG = shapes described as code).

import Ionicons from '@expo/vector-icons/Ionicons';
import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Path, Rect } from 'react-native-svg';

import { colors, font } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

export const GLASS_ML = 500;

// The glass outline from the sketch, on a 20 × 26 grid.
const GLASS_PATH = 'M2.5 2H17.5L15.3 23C15.2 24.1 14.3 25 13.2 25H6.8C5.7 25 4.8 24.1 4.7 23L2.5 2Z';
const WATER_BLUE = '#3B82F6'; // blue-500

/** One glass. `fill` is 0 (empty) to 1 (full). */
export function WaterGlass({ fill, size = 16 }: { fill: number; size?: number }) {
  // Each glass needs its own clip id; useId gives a unique one (minus symbols SVG dislikes).
  const clipId = 'glass' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const f = Math.max(0, Math.min(1, fill));

  return (
    <Svg width={size} height={size * 1.3} viewBox="0 0 20 26" fill="none">
      <Defs>
        {/* Only the bottom `f` part of the glass is painted blue. */}
        <ClipPath id={clipId}>
          <Rect x="0" y={26 - 26 * f} width="20" height={26 * f} />
        </ClipPath>
      </Defs>
      <Path d={GLASS_PATH} fill={colors.surface} stroke={colors.faint} strokeWidth={1.5} />
      {f > 0 && <Path d={GLASS_PATH} fill={WATER_BLUE} clipPath={`url(#${clipId})`} />}
      <Path d={GLASS_PATH} stroke={colors.faint} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}

/** A row of glasses for the daily goal, filled in order: 600 ml → 1 full + ⅕ of the next. */
export function GlassRow({ totalMl, goalMl, size }: { totalMl: number; goalMl: number; size?: number }) {
  const glassCount = Math.max(1, Math.round(goalMl / GLASS_ML));
  return (
    <View style={styles.glassRow}>
      {Array.from({ length: glassCount }, (_, i) => (
        <WaterGlass key={i} size={size} fill={Math.min(Math.max(totalMl - i * GLASS_ML, 0), GLASS_ML) / GLASS_ML} />
      ))}
    </View>
  );
}

/** The ring on the Vann screen: blue arc = share of the goal reached. */
export function WaterRing({ totalMl, goalMl }: { totalMl: number; goalMl: number }) {
  const { t } = useI18n();
  const pct = Math.min(100, Math.round((totalMl / goalMl) * 100));
  const CIRCUMFERENCE = 2 * Math.PI * 44; // ≈ 276, as in the sketch

  return (
    <View style={styles.ring}>
      {/* rotate -90° so the arc starts at the top, like a clock */}
      <Svg width={128} height={128} viewBox="0 0 100 100" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx="50" cy="50" r="44" fill="none" stroke="#EEF2F6" strokeWidth={10} />
        <Circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke={WATER_BLUE}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Ionicons name="water-outline" size={16} color={WATER_BLUE} />
        <Text style={styles.ringValue}>{totalMl} ml</Text>
        <Text style={styles.ringGoal}>
          {t('av', 'of')} {goalMl} ml
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glassRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ring: { width: 128, height: 128 },
  ringCenter: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontSize: font.base, fontWeight: '600', color: colors.text },
  ringGoal: { fontSize: font.xs, color: colors.muted },
});
