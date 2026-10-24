// Exports for one player:
//   - day totals for the chosen period (CSV) — for meetings with a coach/nutritionist
//   - every meal item in the period (CSV)
//   - ALL data we hold about the player (JSON) — GDPR "right of access"
// Files are generated in the browser; nothing is uploaded.

import { listAccounts } from './admin-users';
import { downloadFile, fileSafe, toCsv } from './download';
import { addDaysIso } from './format';
import { supabase } from './supabase';
import type { DaySummary } from './summary-api';
import { PROFILE_COLUMNS, type Meal } from './types';

export function exportDaysCsv(name: string, fromIso: string, toIso: string, days: { day: string; s?: DaySummary; status: string }[]) {
  const csv = toCsv(days, [
    { header: 'Dato', value: (d) => d.day },
    { header: 'Status', value: (d) => d.status },
    { header: 'Måltider', value: (d) => d.s?.meals ?? 0 },
    { header: 'Energi (kcal)', value: (d) => d.s?.kcal ?? 0 },
    { header: 'Protein (g)', value: (d) => d.s?.protein_g ?? 0 },
    { header: 'Karbohydrater (g)', value: (d) => d.s?.carbs_g ?? 0 },
    { header: 'Fett (g)', value: (d) => d.s?.fat_g ?? 0 },
    { header: 'Vann (ml)', value: (d) => d.s?.water_ml ?? 0 },
  ]);
  downloadFile(`${fileSafe(name)}_dager_${fromIso}_${toIso}.csv`, csv, 'csv');
}

export async function exportMealsCsv(userId: string, name: string, fromIso: string, toIso: string) {
  const { data, error } = await supabase
    .from('meals')
    .select('eaten_at, recognizer, meal_items (food_name, amount_g, nutrition, detected_label)')
    .eq('user_id', userId)
    .gte('eaten_at', new Date(`${fromIso}T00:00:00`).toISOString())
    .lt('eaten_at', new Date(`${addDaysIso(toIso, 1)}T00:00:00`).toISOString())
    .order('eaten_at');
  if (error) throw error;
  const rows = ((data ?? []) as Omit<Meal, 'id'>[]).flatMap((m) => m.meal_items.map((i) => ({ meal: m, item: i })));
  const csv = toCsv(rows, [
    { header: 'Tidspunkt', value: (r) => new Date(r.meal.eaten_at).toLocaleString('nb-NO') },
    { header: 'Matvare', value: (r) => r.item.food_name },
    { header: 'Mengde (g)', value: (r) => Number(r.item.amount_g) },
    { header: 'Energi (kcal)', value: (r) => r.item.nutrition.energy_kcal ?? '' },
    { header: 'Protein (g)', value: (r) => r.item.nutrition.protein_g ?? '' },
    { header: 'Karbohydrater (g)', value: (r) => r.item.nutrition.carbs_g ?? '' },
    { header: 'Fett (g)', value: (r) => r.item.nutrition.fat_g ?? '' },
    { header: 'Kilde', value: (r) => (r.item.detected_label ? (r.meal.recognizer ?? 'gjenkjent') : 'manuelt') },
  ]);
  downloadFile(`${fileSafe(name)}_maltider_${fromIso}_${toIso}.csv`, csv, 'csv');
}

/** Everything about one person, for a GDPR access request. */
export async function exportAllDataJson(userId: string, name: string) {
  const [profile, goals, meals, water, events, accounts] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle(),
    supabase.from('player_goals').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('meals')
      .select('id, eaten_at, recognizer, created_at, meal_items (food_name, amount_g, nutrition, detected_label, created_at)')
      .eq('user_id', userId)
      .order('eaten_at'),
    supabase.from('water_logs').select('amount_ml, logged_at').eq('user_id', userId).order('logged_at'),
    supabase.from('recognition_events').select('provider, labels, unmatched_labels, created_at').eq('user_id', userId).order('created_at'),
    listAccounts(),
  ]);
  const firstError = profile.error ?? goals.error ?? meals.error ?? water.error ?? events.error;
  if (firstError) throw firstError;
  const account = accounts.data?.find((a) => a.id === userId);

  const payload = {
    eksportert: new Date().toISOString(),
    merknad:
      'Alle opplysninger IK Start Ernæring lagrer om denne personen. Bilder av måltider lagres aldri. ' +
      'Næringsdata fra Matvaretabellen (Mattilsynet).',
    konto: { e_post: account?.email ?? null, sist_innlogget: account?.last_sign_in_at ?? null },
    profil: profile.data,
    egne_mal: goals.data,
    maltider: meals.data,
    vann: water.data,
    gjenkjenning: events.data,
  };
  downloadFile(`${fileSafe(name)}_alle-data_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'json');
}
