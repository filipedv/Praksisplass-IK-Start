// The one Supabase client for the admin panel. Same project as the player app.
//
// IMPORTANT — the admin panel is NOT trusted. Everything here uses the public
// publishable key, exactly like the player app. What an admin may see or change
// is decided by Row Level Security in the database (is_admin() in
// supabase/migrations), never by what this web page chooses to show.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copy admin-panel/.env.example to .env, fill it in, and restart `npm run dev`.',
  );
}

export const supabase = createClient(url, key);
