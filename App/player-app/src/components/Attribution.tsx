// Data-source credits. Matvaretabellen must be credited in the app (shown in
// the food search and on the Personvernnotater screen); FatSecret requires
// "Powered by fatsecret" wherever its results are used.

import { StyleSheet, Text } from 'react-native';

import { colors, spacing } from '@/lib/theme';

type Props = {
  recognizer?: string | null; // e.g. "Powered by fatsecret"
  showMatvaretabellen?: boolean;
};

export function Attribution({ recognizer, showMatvaretabellen = true }: Props) {
  return (
    <>
      {recognizer ? <Text style={styles.text}>{recognizer}</Text> : null}
      {showMatvaretabellen ? <Text style={styles.text}>Næringsdata: Matvaretabellen (Mattilsynet)</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 11, color: colors.faint, textAlign: 'center', marginTop: spacing.xs },
});
