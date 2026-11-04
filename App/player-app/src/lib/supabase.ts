// The one Supabase client for the whole app. Import it from here — never
// create a second client somewhere else.
//
// Config comes from .env (see .env.example). Expo only exposes variables that
// start with EXPO_PUBLIC_, and only when written out in full like below.

// Installs a `localStorage` that saves to SQLite on the phone, so the login
// session survives app restarts.
import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

// Generated from the live database (npm run gen:types): makes every table,
// column and function typed, so mistakes show up as TypeScript errors.
import type { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  // Fail loudly and early with a helpful message instead of confusing errors later.
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copy player-app/.env.example to .env, fill it in, and restart `npx expo start`.',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // there is no browser URL on a phone
  },
});

// Only refresh the login token while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
