// Who is logged in, and their own profile (to know whether they're an admin
// or a coach — and for a coach, which teams they coach).
//
// NOTE: `isAdmin` / `isCoach` here only decide which SCREENS to show — a
// convenience, not security. If someone bypassed this check, the database
// would still only return what RLS allows: a coach only their own teams'
// players, a player only their own rows.

import type { Session } from '@supabase/supabase-js';
import { useEffect, useState, type PropsWithChildren } from 'react';

import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { PROFILE_COLUMNS, type Profile } from '../lib/types';

import { AuthContext } from './auth-context';

// One shared empty list, so screens don't see a "new" list on every render.
const NO_TEAMS: string[] = [];

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [coachTeamIds, setCoachTeamIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load the profile for whoever is logged in (or clear it on logout).
    async function loadProfile(newSession: Session | null) {
      setSession(newSession);
      if (!newSession) {
        setProfile(null);
        setCoachTeamIds([]);
        setIsLoading(false);
        return;
      }
      await loadRole(newSession.user.id);
      setIsLoading(false);
    }

    // Role, active status and a coach's teams. Only stored if something
    // changed, so coming back to the tab doesn't redraw every page.
    async function loadRole(userId: string) {
      const [{ data }, assignments] = await Promise.all([
        supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle(),
        // Only a coach has rows here (RLS: a coach reads their own assignments).
        supabase.from('coach_teams').select('team_id').eq('coach_id', userId),
      ]);
      const teamIds = (assignments.data ?? []).map((a) => a.team_id).sort();
      setProfile((old) => (JSON.stringify(old) === JSON.stringify(data) ? old : data));
      setCoachTeamIds((old) => (old.join() === teamIds.join() ? old : teamIds));
    }

    // onAuthStateChange also fires once at startup with the saved session.
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // Supabase advises not to await other Supabase calls inside this
      // callback, so we schedule the profile load right after it.
      setTimeout(() => loadProfile(newSession), 0);
    });

    // Coming back to the panel: check again, so a team an admin just
    // assigned (or a role change) shows up without reloading the page.
    function onVisible() {
      if (document.visibilityState !== 'visible') return;
      void supabase.auth.getSession().then(({ data: { session: current } }) => {
        if (current) void loadRole(current.user.id);
      });
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible); // another window was in front

    return () => {
      data.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? t('Feil e-post eller passord.', 'Wrong email or password.') : null;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const isAdmin = profile?.role === 'admin' && profile.is_active;
  const isCoach = profile?.role === 'coach' && profile.is_active;

  return (
    <AuthContext value={{ session, profile, isAdmin, isCoach, coachTeamIds: isCoach ? coachTeamIds : NO_TEAMS, isLoading, signIn, signOut }}>
      {children}
    </AuthContext>
  );
}
