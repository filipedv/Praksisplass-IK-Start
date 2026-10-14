// admin-users — Edge Function that lets ADMINS manage login accounts from the
// admin panel: list accounts (with email), create an account, and change an
// account's email or password.
//
// WHY A SERVER FUNCTION? Creating logins and changing emails/passwords needs
// the Supabase SECRET key, which must never be in the admin panel (anyone who
// can open the page could read it). This function runs on Supabase's servers,
// where the secret key is available as ctx.supabaseAdmin.
//
// WHO MAY CALL IT? Three layers:
//   1. Supabase's gateway (verify_jwt = true in config.toml) and
//   2. withSupabase({ auth: 'user' }) both reject requests without a valid
//      login token.
//   3. We then ask the DATABASE whether the caller is an active admin, using
//      the same is_admin() function our RLS policies use. A client-side
//      "I'm an admin" flag is never trusted.
//
// PRIVACY: never log request bodies — they contain emails and passwords.
// Profile fields (name, role, active) are NOT handled here: the admin panel
// updates `profiles` directly, protected by RLS.
//
// Deploy:  npx supabase functions deploy admin-users

import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

const ROLES = ['player', 'coach', 'guardian', 'admin'];
const MIN_PASSWORD_LENGTH = 8;

/** JSON response with a status code. (CORS headers are added by withSupabase.) */
const reply = (body: unknown, status = 200) => Response.json(body, { status });

/** Very simple email check — Supabase Auth validates properly as well. */
const looksLikeEmail = (value: unknown): value is string =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** Turn Supabase Auth errors into Norwegian messages the admin can act on. */
function authErrorMessage(message: string): string {
  if (/already (been )?registered|already exists/i.test(message)) return 'E-postadressen er allerede i bruk.';
  if (/password/i.test(message)) return `Passordet ble avvist: ${message}`;
  return message;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return reply({ error: 'Use POST' }, 405);

    // ---- 3. Is the caller an ACTIVE admin? Ask the database, as the caller. ----
    const { data: isAdmin, error: adminCheckError } = await ctx.supabase.rpc('is_admin');
    if (adminCheckError) return reply({ error: 'Kunne ikke sjekke admintilgang.' }, 500);
    if (isAdmin !== true) return reply({ error: 'Kun aktive administratorer har tilgang.' }, 403);

    const body = await req.json().catch(() => null);
    const admin = ctx.supabaseAdmin.auth.admin;

    switch (body?.action) {
      // ------------------------------------------------------------------
      // list: id, email and last login for every account (profiles has no
      // email column, so the admin panel gets emails from here).
      // ------------------------------------------------------------------
      case 'list': {
        const { data, error } = await admin.listUsers({ page: 1, perPage: 1000 });
        if (error) return reply({ error: error.message }, 500);
        return reply({
          users: data.users.map((u) => ({ id: u.id, email: u.email ?? null, last_sign_in_at: u.last_sign_in_at ?? null })),
        });
      }

      // ------------------------------------------------------------------
      // create: a confirmed account with a password the admin chooses and
      // shares with the person. The profile row is created by our database
      // trigger (handle_new_user), using display_name from the metadata.
      // ------------------------------------------------------------------
      case 'create': {
        const { email, password, display_name, role } = body;
        if (!looksLikeEmail(email)) return reply({ error: 'Ugyldig e-postadresse.' }, 400);
        if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
          return reply({ error: `Passordet må ha minst ${MIN_PASSWORD_LENGTH} tegn.` }, 400);
        }
        if (typeof display_name !== 'string' || !display_name.trim()) return reply({ error: 'Navn er påkrevd.' }, 400);
        if (!ROLES.includes(role)) return reply({ error: 'Ugyldig rolle.' }, 400);

        const { data, error } = await admin.createUser({
          email: email.trim().toLowerCase(),
          password,
          email_confirm: true, // no confirmation email — the admin hands over the login
          user_metadata: { display_name: display_name.trim() },
        });
        if (error || !data.user) return reply({ error: authErrorMessage(error?.message ?? 'Ukjent feil') }, 400);

        // New profiles start as 'player'. Set another role if asked for.
        // (supabaseAdmin uses the secret key, which our protect-columns
        // trigger allows — we've already checked the CALLER is an admin.)
        if (role !== 'player') {
          const { error: roleError } = await ctx.supabaseAdmin.from('profiles').update({ role }).eq('id', data.user.id);
          if (roleError) return reply({ error: `Kontoen ble opprettet, men rollen kunne ikke settes: ${roleError.message}` }, 500);
        }
        return reply({ id: data.user.id });
      }

      // ------------------------------------------------------------------
      // update: change an account's email and/or password.
      // ------------------------------------------------------------------
      case 'update': {
        const { user_id, email, password } = body;
        if (typeof user_id !== 'string') return reply({ error: 'user_id mangler.' }, 400);

        const changes: { email?: string; email_confirm?: boolean; password?: string } = {};
        if (email !== undefined && email !== null && email !== '') {
          if (!looksLikeEmail(email)) return reply({ error: 'Ugyldig e-postadresse.' }, 400);
          changes.email = email.trim().toLowerCase();
          changes.email_confirm = true; // take effect now, no confirmation email
        }
        if (password !== undefined && password !== null && password !== '') {
          if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
            return reply({ error: `Passordet må ha minst ${MIN_PASSWORD_LENGTH} tegn.` }, 400);
          }
          changes.password = password;
        }
        if (Object.keys(changes).length === 0) return reply({ error: 'Ingen endringer.' }, 400);

        const { error } = await admin.updateUserById(user_id, changes);
        if (error) return reply({ error: authErrorMessage(error.message) }, 400);
        return reply({ ok: true });
      }

      default:
        return reply({ error: 'Ukjent handling.' }, 400);
    }
  }),
};
