// PERSONVERNNOTATER (from the Profil menu — the sketch has the row but no
// screen behind it): a plain-language summary of what the app stores, plus
// the data-source credits.
//
// This describes the INTERNAL TEST version. It must be rewritten together
// with the real GDPR work (DPIA, guardian consent) before any academy player
// uses the app.

import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/ui';
import { colors, font, spacing } from '@/lib/theme';
import { activeRecognizer } from '@/recognition';

export default function PrivacyScreen() {
  const recognizerText =
    activeRecognizer.id === 'mock'
      ? 'Testmodus: bilder sendes ikke noe sted, og forslagene er eksempler.'
      : `Bildet sendes til ${activeRecognizer.id} for å gjenkjenne maten, og slettes deretter.`;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="Personvernnotater" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Bilder">
          Bilder av måltider lagres aldri — verken på telefonen eller hos oss. {recognizerText}
        </Section>
        <Section title="Hva vi lagrer">
          Kun matvarene du bekrefter, mengden i gram, næringsverdiene og tidspunktet. Dataene lagres i EU.
        </Section>
        <Section title="Hvem kan se dataene">
          Bare du og administratorer. Trenere og foresatte har ikke tilgang i denne testversjonen.
        </Section>
        <Section title="Næringsdata">
          Næringsdata fra Matvaretabellen (Mattilsynet), matvaretabellen.no.
          {activeRecognizer.attribution ? `\n\nMatgjenkjenning: ${activeRecognizer.attribution}.` : ''}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{children}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  card: { padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: font.sm, fontWeight: '500', color: colors.textSoft },
  text: { fontSize: font.xs, color: colors.mutedLight, lineHeight: 18 },
});
