// Reading the change log (audit_log). Only admins can read it (RLS), and
// nobody can write it from an app — the database fills it by itself.

import { labels, t } from './i18n';
import { supabase } from './supabase';
import type { AuditEntry } from './types';

export async function fetchAudit(options: { subjectUserId?: string; limit?: number; before?: number } = {}): Promise<AuditEntry[]> {
  let query = supabase
    .from('audit_log')
    .select('id, at, actor_id, actor_name, action, table_name, record_id, subject_user_id, changes')
    .order('id', { ascending: false })
    .limit(options.limit ?? 100);
  if (options.subjectUserId) query = query.eq('subject_user_id', options.subjectUserId);
  if (options.before) query = query.lt('id', options.before); // "show more" paging
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AuditEntry[];
}

/**
 * Bookkeeping fields we never show. `meals.admin_changed_at` is stamped by
 * the database when an admin edits a player's meal (so the player sees
 * "Endret av administrator"); the real change is logged as its own entry.
 */
const HIDDEN_FIELDS = new Set(['admin_changed_at']);

/**
 * Entries as shown: hidden fields removed, and updates that only touched
 * hidden fields dropped. Filter here (not in the query) so paging still
 * counts the raw rows.
 */
export function visibleEntries(entries: AuditEntry[]): AuditEntry[] {
  return entries.flatMap((e) => {
    const changes = Object.fromEntries(Object.entries(e.changes).filter(([field]) => !HIDDEN_FIELDS.has(field)));
    if (e.action === 'update' && Object.keys(changes).length === 0) return [];
    return [{ ...e, changes }];
  });
}

/** Names for what was changed. */
export const TABLE_LABELS: Record<string, string> = labels({
  accounts: ['Konto', 'Account'],
  profiles: ['Profil', 'Profile'],
  player_goals: ['Mål', 'Goals'],
  teams: ['Lag', 'Team'],
  food_aliases: ['Kobling', 'Link'],
  foods: ['Matvare', 'Food'],
  club_settings: ['Klubbinnstillinger', 'Club settings'],
  meals: ['Måltid', 'Meal'],
  meal_items: ['Matvare i måltid', 'Food in meal'],
});

export const ACTION_LABELS: Record<AuditEntry['action'], string> = labels({
  insert: ['Opprettet', 'Created'],
  update: ['Endret', 'Changed'],
  delete: ['Slettet', 'Deleted'],
});

/** Field names in plain words (anything not listed is shown as-is). */
export const FIELD_LABELS: Record<string, string> = labels({
  display_name: ['navn', 'name'],
  role: ['rolle', 'role'],
  is_active: ['aktiv', 'active'],
  team_id: ['lag', 'team'],
  email: ['e-post', 'email'],
  password: ['passord', 'password'],
  goal_kcal: ['energimål', 'energy goal'],
  goal_protein_g: ['proteinmål', 'protein goal'],
  goal_carbs_g: ['karbomål', 'carb goal'],
  goal_fat_g: ['fettmål', 'fat goal'],
  goal_water_ml: ['vannmål', 'water goal'],
  label: ['etikett', 'label'],
  food_id: ['matvare', 'food'],
  name: ['navn', 'name'],
  name_nb: ['navn', 'name'],
  name_en: ['engelsk navn', 'English name'],
  amount_g: ['mengde (g)', 'amount (g)'],
  eaten_at: ['tidspunkt', 'time'],
  club_name: ['klubbnavn', 'club name'],
  fatsecret_trial_started_on: ['FatSecret-prøve startet', 'FatSecret trial started'],
});

/** Short readable value for the log ("ja"/"nei", ids shortened, objects summarised). */
export function formatValue(value: unknown, field?: string): string {
  if (value === null || value === undefined) return '–';
  if (typeof value === 'boolean') return value ? t('ja', 'yes') : t('nei', 'no');
  if (typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value)) return value.slice(0, 8) + '…';
  if (field === 'nutrition' && typeof value === 'object') {
    const kcal = (value as Record<string, number>).energy_kcal;
    return kcal !== undefined ? `${Math.round(kcal)} kcal` : '…';
  }
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 60);
  return String(value);
}
