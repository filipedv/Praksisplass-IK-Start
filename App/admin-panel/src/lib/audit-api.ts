// Reading the change log (audit_log). Only admins can read it (RLS), and
// nobody can write it from an app — the database fills it by itself.

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

/** Norwegian names for what was changed. */
export const TABLE_LABELS: Record<string, string> = {
  accounts: 'Konto',
  profiles: 'Profil',
  player_goals: 'Mål',
  teams: 'Lag',
  food_aliases: 'Kobling',
  foods: 'Matvare',
  club_settings: 'Klubbinnstillinger',
  meals: 'Måltid',
  meal_items: 'Matvare i måltid',
};

export const ACTION_LABELS: Record<AuditEntry['action'], string> = {
  insert: 'Opprettet',
  update: 'Endret',
  delete: 'Slettet',
};

/** Field names in plain Norwegian (anything not listed is shown as-is). */
export const FIELD_LABELS: Record<string, string> = {
  display_name: 'navn',
  role: 'rolle',
  is_active: 'aktiv',
  team_id: 'lag',
  email: 'e-post',
  password: 'passord',
  goal_kcal: 'energimål',
  goal_protein_g: 'proteinmål',
  goal_carbs_g: 'karbomål',
  goal_fat_g: 'fettmål',
  goal_water_ml: 'vannmål',
  label: 'etikett',
  food_id: 'matvare',
  name: 'navn',
  name_nb: 'navn',
  name_en: 'engelsk navn',
  amount_g: 'mengde (g)',
  club_name: 'klubbnavn',
  fatsecret_trial_started_on: 'FatSecret-prøve startet',
};

/** Short readable value for the log ("ja"/"nei", ids shortened, objects summarised). */
export function formatValue(value: unknown, field?: string): string {
  if (value === null || value === undefined) return '–';
  if (typeof value === 'boolean') return value ? 'ja' : 'nei';
  if (typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value)) return value.slice(0, 8) + '…';
  if (field === 'nutrition' && typeof value === 'object') {
    const kcal = (value as Record<string, number>).energy_kcal;
    return kcal !== undefined ? `${Math.round(kcal)} kcal` : '…';
  }
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 60);
  return String(value);
}
