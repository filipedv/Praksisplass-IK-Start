// Keeps track of "who is logged in" and shares it with every screen.
//
// Usage in a screen:   const { session, signOut } = useSession();

import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';

import { clearCache } from '@/lib/cache';
import { cancelAllReminders } from '@/reminders/reminders';
import { supabase } from '@/lib/supabase';
import { translate } from '@/lib/i18n';

type SessionContextValue = {
  session: Session | null;
  isLoading: boolean; // true until we've checked for a saved session on startup
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. On startup: is there a saved session from last time?
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    // 2. Afterwards: keep `session` in sync with logins, logouts and token refreshes.
    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_OUT') clearCache(); // also covers an expired session
      setSession(newSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? translate('Feil e-post eller passord.', 'Wrong email or password.') : null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    clearCache(); // never show one person's cached data to the next person
    await cancelAllReminders().catch(() => {}); // no meal reminders for a logged-out phone
  }

  return <SessionContext value={{ session, isLoading, signIn, signOut }}>{children}</SessionContext>;
}
