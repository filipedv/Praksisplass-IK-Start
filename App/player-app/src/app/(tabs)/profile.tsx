// PROFIL (sketch: ProfileScreen): a profile card (tap → Profilinnstillinger:
// weight and height), my team and its coaches (who can see my data — or,
// without a team, why there are no match tips), then a menu card with
// Innstillinger (reminders), Endre passord, Personvernnotater and Logg ut.
//
// Not built yet (designed in the sketch): the "Forhåndsvis som" toggle —
// that belongs to the age-based safeguarding work.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { fetchMyMeasurements, getCachedMeasurements, latestValues, type Measurement } from '@/body/body-api';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, MenuRow } from '@/components/ui';
import { getCached, setCached } from '@/lib/cache';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import { formatNumber } from '@/nutrition/math';

type Profile = { display_name: string; role: 'player' | 'coach' | 'guardian' | 'admin' };

/** From my_team_info(): my team (null = no team) and its active coaches. */
type TeamInfo = { team_name: string | null; coach_names: string[] };

const ROLE_LABELS: Record<Profile['role'], [nb: string, en: string]> = {
  player: ['Spiller', 'Player'],
  coach: ['Trener', 'Coach'],
  guardian: ['Foresatt', 'Guardian'],
  admin: ['Administrator', 'Administrator'],
};

export default function ProfileScreen() {
  const { session, signOut } = useSession();
  const { t, lang } = useI18n();
  const userId = session?.user.id;
  // undefined = still loading. Cached so the name doesn't pop in on every visit.
  const [profile, setProfile] = useState<Profile | null | undefined>(() =>
    userId ? getCached<Profile | null>(`profile:${userId}`) : undefined,
  );

  const [team, setTeam] = useState<TeamInfo | null | undefined>(() =>
    userId ? getCached<TeamInfo | null>(`team-info:${userId}`) : undefined,
  );

  const [measurements, setMeasurements] = useState<Measurement[] | undefined>(() =>
    userId ? getCachedMeasurements(userId) : undefined,
  );

  // Refresh whenever Profil comes into view (e.g. back from Profilinnstillinger).
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      supabase
        .from('profiles')
        .select('display_name, role')
        .eq('id', userId)
        .maybeSingle()
        .then(({ data }) => !cancelled && setProfile(setCached(`profile:${userId}`, data)));
      supabase
        .rpc('my_team_info')
        .maybeSingle()
        .then(({ data, error }) => {
          if (cancelled || error) return;
          setTeam(setCached(`team-info:${userId}`, data ? { team_name: data.team_name, coach_names: data.coach_names ?? [] } : null));
        });
      fetchMyMeasurements(userId)
        .then((rows) => !cancelled && setMeasurements(rows))
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  const latest = latestValues(measurements ?? []);
  const bodyText = [
    latest.weight ? `${formatNumber(latest.weight.weight_kg ?? undefined, Number.isInteger(latest.weight.weight_kg) ? 0 : 1, lang)} kg` : null,
    latest.height ? `${formatNumber(latest.height.height_cm ?? undefined, Number.isInteger(latest.height.height_cm) ? 0 : 1, lang)} cm` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={t('Profil', 'Profile')} />

      <View style={styles.content}>
        <Pressable
          onPress={() => router.push('/profile-settings')}
          style={({ pressed }) => [styles.profileCard, pressed && styles.pressed]}
          accessibilityLabel={t('Profilinnstillinger', 'Profile settings')}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={18} color={colors.iconSoft} />
          </View>
          <View style={{ flex: 1 }}>
            {/* Wait for the profile instead of showing the email and then swapping it. */}
            <Text style={styles.name}>
              {profile === undefined ? ' ' : profile?.display_name || session?.user.email}
            </Text>
            <Text style={styles.meta}>{profile ? t(...ROLE_LABELS[profile.role]) : ' '}</Text>
            <Text style={styles.meta}>{measurements === undefined ? ' ' : bodyText || t('Legg til vekt og høyde', 'Add weight and height')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={colors.faint} />
        </Pressable>

        {/* My team — players only (staff use the panel). */}
        {profile?.role === 'player' && team && (
          <Card style={styles.teamCard}>
            <View style={styles.teamIcon}>
              <Ionicons name={team.team_name ? 'people-outline' : 'alert-circle-outline'} size={18} color={team.team_name ? colors.iconSoft : colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              {team.team_name ? (
                <>
                  <Text style={styles.name}>{team.team_name}</Text>
                  <Text style={styles.meta}>
                    {team.coach_names.length
                      ? `${t(team.coach_names.length === 1 ? 'Trener' : 'Trenere', team.coach_names.length === 1 ? 'Coach' : 'Coaches')}: ${team.coach_names.join(', ')}`
                      : t('Ingen trener lagt inn ennå', 'No coach added yet')}
                  </Text>
                  <Text style={styles.meta}>
                    {t(
                      'Trenerne og administratorer kan se måltidene, vannet og målingene dine.',
                      'Your coaches and administrators can see your meals, water and measurements.',
                    )}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.name}>{t('Du er ikke på et lag ennå', "You're not on a team yet")}</Text>
                  <Text style={styles.meta}>
                    {t(
                      'Til da får du ikke lagets kamper og treninger, eller tips før kamp. Be treneren din eller en administrator om å legge deg på laget.',
                      "Until then you won't get your team's matches and training, or tips before matches. Ask your coach or an administrator to put you on the team.",
                    )}
                  </Text>
                </>
              )}
            </View>
          </Card>
        )}

        {profile === null && (
          // RLS hides a deactivated user's own profile, so "no profile" here
          // most likely means the account has been deactivated.
          <Text style={styles.warning}>{t('Fant ingen aktiv profil. Kontakt en administrator.', 'No active profile found. Contact an administrator.')}</Text>
        )}

        <Card style={{ overflow: 'hidden' }}>
          <MenuRow label={t('Innstillinger', 'Settings')} onPress={() => router.push('/settings')} />
          <MenuRow label={t('Endre passord', 'Change password')} onPress={() => router.push('/password')} divider />
          <MenuRow label={t('Personvernnotater', 'Privacy notes')} onPress={() => router.push('/privacy')} divider />
          <MenuRow label={t('Logg ut', 'Sign out')} onPress={signOut} divider />
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  // Same look as the shared Card, but pressable.
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  teamCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.lg },
  teamIcon: { width: 44, alignItems: 'center', paddingTop: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.border, // slate-700
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: font.sm, fontWeight: '500', color: colors.textSoft },
  meta: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  warning: { color: colors.warning, fontSize: font.xs },
});
