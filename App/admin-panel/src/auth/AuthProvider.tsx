// Who is logged in, and their own profile (to know whether they're an admin).
//
// NOTE: `isAdmin` here only decides which SCREENS to show — it's a
// convenience, not security. If a non-admin bypassed this check, the database
// would still only return their own rows, because RLS checks the role itself.

import type { Session } from '@supabase/supabase-js';
import { useEffect, useState, type PropsWithChildren } from 'react';

import { supabase } from '../lib/supabase';
import { PROFILE_COLUMNS, type Profile } from '../lib/types';

import { AuthContext } from './auth-context';

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load the profile for whoever is logged in (or clear it on logout).
    async function loadProfile(newSession: Session | null) {
      setSession(newSession);
      if (!newSession) {
        setProfile(null);
        setIsLoading(false);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', newSession.user.id)
        .maybeSingle();
      setProfile(data);
      setIsLoading(false);
    }

    // onAuthStateChange also fires once at startup with the saved session.
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // Supabase advises not to await other Supabase calls inside this
      // callback, so we schedule the profile load right after it.
      setTimeout(() => loadProfile(newSession), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? 'Feil e-post eller passord.' : null;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const isAdmin = profile?.role === 'admin' && profile.is_active;

  return (
    <AuthContext value={{ session, profile, isAdmin, isLoading, signIn, signOut }}>{children}</AuthContext>
  );
}
