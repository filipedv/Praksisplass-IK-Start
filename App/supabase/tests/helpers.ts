// Test harness: a fresh Postgres (PGlite, in WebAssembly) with every migration
// in ../migrations applied, plus a tiny stand-in for Supabase's `auth` schema.
//
// How "logging in" works here: Supabase decides who you are from your login
// token; in SQL that's auth.uid(). We fake it by setting a setting that our
// stub auth.uid() reads, and switching to the `authenticated` role — exactly
// the role real app requests run as, so RLS policies apply for real.
//
// Usage:
//   const t = await createTestDb();
//   const anna = await t.addUser('anna@x');           // a player
//   const carl = await t.addUser('carl@x', 'admin');  // an admin
//   const r = await t.as(anna, 'select * from meals'); // { ok, rows, error }

import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readdirSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const MIGRATIONS = new URL('../migrations/', import.meta.url);

export type Result = { ok: boolean; rows: Record<string, any>[]; error?: string };

export async function createTestDb() {
  const db = new PGlite({ extensions: { pg_trgm } });

  // Minimal stand-in for what Supabase provides.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  `);

  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
  }

  // Supabase grants table/function access to these roles; RLS then restricts it.
  await db.exec(`
    grant usage on schema auth, public, extensions to anon, authenticated;
    grant all on all tables in schema public to anon, authenticated;
    grant execute on all functions in schema public, auth, extensions to anon, authenticated;
  `);

  /** Run SQL as a logged-in user (null = logged-out visitor). Errors are returned, not thrown. */
  async function as(userId: string | null, sql: string, params: unknown[] = []): Promise<Result> {
    await db.exec(
      userId
        ? `set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`
        : `set role anon; select set_config('request.jwt.claim.sub', '', false);`,
    );
    try {
      return { ok: true, rows: (await db.query(sql, params)).rows as Record<string, any>[] };
    } catch (e) {
      return { ok: false, rows: [], error: (e as Error).message };
    } finally {
      await db.exec('reset role;');
    }
  }

  /** Run SQL as the database owner (like the Supabase dashboard / seed script). */
  async function asOwner(sql: string, params: unknown[] = []) {
    return (await db.query(sql, params)).rows as Record<string, any>[];
  }

  /** Create a login (the trigger creates its profile). Role is set "from the dashboard". */
  async function addUser(email: string, role: 'player' | 'coach' | 'guardian' | 'admin' = 'player') {
    const id = randomUUID();
    await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
    if (role !== 'player') await db.query('update profiles set role = $1 where id = $2', [role, id]);
    return id;
  }

  /** Insert a food directly (like the seed script) and return its id. */
  async function addFood(nameNb: string, nutrition: Record<string, number>, extra: Record<string, unknown> = {}) {
    const rows = await asOwner(
      `insert into foods (source, source_id, name_nb, name_en, nutrition, portions)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [
        extra.source ?? 'matvaretabellen',
        extra.source === 'custom' ? null : (extra.source_id ?? randomUUID()),
        nameNb,
        extra.name_en ?? null,
        JSON.stringify(nutrition),
        JSON.stringify(extra.portions ?? []),
      ],
    );
    return rows[0].id as string;
  }

  return { db, as, asOwner, addUser, addFood };
}
