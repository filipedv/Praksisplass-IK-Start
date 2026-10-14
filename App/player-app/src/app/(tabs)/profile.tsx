// PROFIL (sketch: ProfileScreen): a profile card, then a menu card.
//
// Not built yet (designed in the sketch, later sessions): Profilinnstillinger
// (weight/height/age, opened from the profile card), Innstillinger (varsler,
// måleenhet), and the "Forhåndsvis som" toggle — that one belongs to the
// age-based safeguarding work.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, MenuRow } from '@/components/ui';
import { getCached, setCached } from '@/lib/cache';
import { supabase } from '@/lib/supabase';
import { colors, font, spacing } from '@/lib/theme';

type Profile = { display_name: string; role: 'player' | 'coach' | 'guardian' | 'admin' };

const ROLE_LABELS: Record<Profile['role'], string> = {
  player: 'Spiller',
  coach: 'Trener',
  guardian: 'Foresatt',
  admin: 'Administrator',
};

export default function ProfileScreen() {
  const { session, signOut } = useSession();
  const userId = session?.user.id;
  // undefined = still loading. Cached so the name doesn't pop in on every visit.
  const [profile, setProfile] = useState<Profile | null | undefined>(() =>
    userId ? getCached<Profile | null>(`profile:${userId}`) : undefined,
  );

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('display_name, role')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => setProfile(setCached(`profile:${userId}`, data)));
  }, [userId]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Profil" />

      <View style={styles.content}>
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={18} color={colors.iconSoft} />
          </View>
          <View style={{ flex: 1 }}>
            {/* Wait for the profile instead of showing the email and then swapping it. */}
            <Text style={styles.name}>
              {profile === undefined ? ' ' : profile?.display_name || session?.user.email}
            </Text>
            <Text style={styles.meta}>{profile ? ROLE_LABELS[profile.role] : ' '}</Text>
          </View>
        </Card>

        {profile === null && (
          // RLS hides a deactivated user's own profile, so "no profile" here
          // most likely means the account has been deactivated.
          <Text style={styles.warning}>Fant ingen aktiv profil. Kontakt en administrator.</Text>
        )}

        <Card style={{ overflow: 'hidden' }}>
          <MenuRow label="Personvernnotater" onPress={() => router.push('/privacy')} />
          <MenuRow label="Logg ut" onPress={signOut} divider />
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
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
