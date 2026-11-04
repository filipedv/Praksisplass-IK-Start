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
import { useI18n } from '@/lib/i18n';
import { colors, font, spacing } from '@/lib/theme';
import { activeRecognizer } from '@/recognition';

export default function PrivacyScreen() {
  const { t } = useI18n();
  const recognizerText =
    activeRecognizer.id === 'mock'
      ? t('Testmodus: bilder sendes ikke noe sted, og forslagene er eksempler.', "Test mode: photos aren't sent anywhere, and the suggestions are examples.")
      : t(
          `Bildet sendes til ${activeRecognizer.id} for å gjenkjenne maten, og slettes deretter.`,
          `The photo is sent to ${activeRecognizer.id} to recognize the food, and then deleted.`,
        );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title={t('Personvernnotater', 'Privacy notes')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title={t('Bilder', 'Photos')}>
          {t(
            'Bilder av måltider lagres aldri — verken på telefonen eller hos oss.',
            'Meal photos are never stored — neither on your phone nor by us.',
          )}{' '}
          {recognizerText}
        </Section>
        <Section title={t('Hva vi lagrer', 'What we store')}>
          {t(
            'Matvarene du bekrefter, mengden i gram, næringsverdiene og tidspunktet, vannet du logger, og vekt og høyde hvis du eller en trener registrerer det. Dataene lagres i EU.',
            'The foods you confirm, the amount in grams, the nutrition values and the time, the water you log, and weight and height if you or a coach enter them. The data is stored in the EU.',
          )}
        </Section>
        <Section title={t('Hvem kan se dataene', 'Who can see the data')}>
          {t(
            'Bare du og administratorer. Trenere kan i tillegg se vekt og høyde. Foresatte har ikke tilgang i denne testversjonen.',
            'Only you and administrators. Coaches can also see weight and height. Guardians have no access in this test version.',
          )}
        </Section>
        <Section title={t('Notater fra trenere', 'Notes from coaches')}>
          {t(
            'Trenere og administratorer kan skrive korte notater om deg, for eksempel «nevnte en kneplage — følg opp». Notatene vises ikke i appen, men du har rett til å se dem: be en administrator om å laste ned alle dataene dine.',
            'Coaches and administrators can write short notes about you, for example “mentioned a knee problem — follow up”. The notes are not shown in the app, but you have the right to see them: ask an administrator to download all your data.',
          )}
        </Section>
        <Section title={t('Når en administrator endrer noe', 'When an administrator changes something')}>
          {t(
            'En administrator kan rette åpenbare feil i måltidene dine, for eksempel en mengde som er skrevet feil. Måltidet blir da merket «Endret av administrator», og hvem som endret hva lagres i en logg som bare administratorer kan se.',
            'An administrator can correct obvious mistakes in your meals, for example a mistyped amount. The meal is then marked “Changed by an administrator”, and who changed what is saved in a log only administrators can see.',
          )}
        </Section>
        <Section title={t('Hvor lenge vi lagrer', 'How long we keep it')}>
          {t(
            'Så lenge du har en konto. Ber du om det, kan en administrator laste ned alt vi har om deg, eller slette kontoen og alle dataene for godt.',
            'As long as you have an account. If you ask, an administrator can download everything we have about you, or delete the account and all the data for good.',
          )}
        </Section>
        <Section title={t('Påminnelser', 'Reminders')}>
          {t(
            'Påminnelser om å logge måltider, og tips før kamper og treninger, lages på telefonen din og sendes ikke via noen server. Appen henter lagets kamper og treninger når du åpner den. Vi lagrer ingen varslings-ID for telefonen din. Du kan slå påminnelsene av under Innstillinger.',
            "Reminders to log meals, and tips before matches and training, are made on your phone and aren't sent through any server. The app fetches your team's matches and training when you open it. We store no notification ID for your phone. You can turn the reminders off under Settings.",
          )}
        </Section>
        <Section title={t('Næringsdata', 'Nutrition data')}>
          {t(
            'Næringsdata fra Matvaretabellen (Mattilsynet), matvaretabellen.no.',
            'Nutrition data from Matvaretabellen (Norwegian Food Safety Authority), matvaretabellen.no.',
          )}
          {activeRecognizer.attribution ? `\n\n${t('Matgjenkjenning', 'Food recognition')}: ${activeRecognizer.attribution}.` : ''}
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
