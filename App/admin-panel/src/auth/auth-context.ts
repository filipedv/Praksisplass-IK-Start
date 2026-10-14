// The auth context and the useAuth() hook, in their own file so that
// AuthProvider.tsx only exports a component (needed for fast refresh in Vite).

import type { Session } from '@supabase/supabase-js';
import { createContext, use } from 'react';

import type { Profile } from '../lib/types';

export type AuthValue = {
  session: Session | null;
  profile: Profile | null; // null = not logged in, or no active profile
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>; // returns an error message or null
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth() {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

