// Calls the `admin-users` Edge Function (supabase/functions/admin-users),
// which can create login accounts and change emails/passwords. Those need the
// Supabase SECRET key, so they can't be done from this web page directly.
//
// The function checks on the server that WE are an active admin — this file
// just sends the request (with our login token, added by supabase-js).

import { FunctionRegion, FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from './supabase';
import type { Role } from './types';

export type AccountInfo = { id: string; email: string | null; last_sign_in_at: string | null };

type Result<T> = { data: T; error: null } | { data: null; error: string };

async function call<T>(body: Record<string, unknown>): Promise<Result<T>> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body,
    // Run in an EU data centre (GDPR) — names, emails and passwords pass
    // through this function. Our database is in Stockholm (eu-north-1), which
    // isn't a function region; Frankfurt is the nearest EU option.
    region: FunctionRegion.EuCentral1,
  });
  if (error) {
    // For HTTP errors, the function's own message is in the response body.
    if (error instanceof FunctionsHttpError) {
      const details = await error.context.json().catch(() => null);
      return { data: null, error: details?.error ?? error.message };
    }
    return { data: null, error: error.message };
  }
  return { data: data as T, error: null };
}

/** Email + last login for every account. */
export async function listAccounts() {
  const result = await call<{ users: AccountInfo[] }>({ action: 'list' });
  if (result.error !== null) return result;
  return { data: result.data.users, error: null };
}

export function createAccount(input: { email: string; password: string; display_name: string; role: Role }) {
  return call<{ id: string }>({ action: 'create', ...input });
}

/** Change email and/or password. Leave a field empty to keep it unchanged. */
export function updateAccount(userId: string, changes: { email?: string; password?: string }) {
  return call<{ ok: true }>({ action: 'update', user_id: userId, ...changes });
}

/** A random, readable temporary password (no look-alike characters such as 0/O, 1/l). */
export function generatePassword(length = 12): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const random = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(random, (n) => alphabet[n % alphabet.length]).join('');
}

/** PERMANENTLY delete an account and all its data (GDPR right to erasure). */
export function deleteAccount(userId: string) {
  return call<{ ok: true }>({ action: 'delete', user_id: userId });
}
