// Exports for one player:
//   - day totals for the chosen period (CSV) — for meetings with a coach/nutritionist
//   - every meal item in the period (CSV)
//   - ALL data we hold about the player (JSON) — GDPR "right of access"
// Files are generated in the browser; nothing is uploaded.

import { listAccounts } from './admin-users';
import { downloadFile, fileSafe, toCsv } from './download';
import { addDaysIso } from './format';
import { locale, t } from './i18n';
import { supabase } from './supabase';
import type { DaySummary } from './summary-api';
import { PROFILE_COLUMNS, type Meal } from './types';

export function exportDaysCsv(name: string, fromIso: string, toIso: string, days: { day: string; s?: DaySummary; status: string }[]) {
  const csv = toCsv(days, [
    { header: t('Dato', 'Date'), value: (d) => d.day },
    { header: 'Status', value: (d) => d.status },
    { header: t('Måltider', 'Meals'), value: (d) => d.s?.meals ?? 0 },
    { header: t('Energi (kcal)', 'Energy (kcal)'), value: (d) => d.s?.kcal ?? 0 },
    { header: 'Protein (g)', value: (d) => d.s?.protein_g ?? 0 },
    { header: t('Karbohydrater (g)', 'Carbohydrates (g)'), value: (d) => d.s?.carbs_g ?? 0 },
    { header: t('Fett (g)', 'Fat (g)'), value: (d) => d.s?.fat_g ?? 0 },
    { header: t('Vann (ml)', 'Water (ml)'), value: (d) => d.s?.water_ml ?? 0 },
  ]);
  downloadFile(`${fileSafe(name)}_${t('dager', 'days')}_${fromIso}_${toIso}.csv`, csv, 'csv');
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
    { header: t('Tidspunkt', 'Time'), value: (r) => new Date(r.meal.eaten_at).toLocaleString(locale()) },
    { header: t('Matvare', 'Food'), value: (r) => r.item.food_name },
    { header: t('Mengde (g)', 'Amount (g)'), value: (r) => Number(r.item.amount_g) },
    { header: t('Energi (kcal)', 'Energy (kcal)'), value: (r) => r.item.nutrition.energy_kcal ?? '' },
    { header: 'Protein (g)', value: (r) => r.item.nutrition.protein_g ?? '' },
    { header: t('Karbohydrater (g)', 'Carbohydrates (g)'), value: (r) => r.item.nutrition.carbs_g ?? '' },
    { header: t('Fett (g)', 'Fat (g)'), value: (r) => r.item.nutrition.fat_g ?? '' },
    { header: t('Kilde', 'Source'), value: (r) => (r.item.detected_label ? (r.meal.recognizer ?? t('gjenkjent', 'recognized')) : t('manuelt', 'manual')) },
  ]);
  downloadFile(`${fileSafe(name)}_${t('maltider', 'meals')}_${fromIso}_${toIso}.csv`, csv, 'csv');
}

/** Everything about one person, for a GDPR access request. */
export async function exportAllDataJson(userId: string, name: string) {
  const [profile, goals, meals, water, events, measurements, notes, accounts] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle(),
    supabase.from('player_goals').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('meals')
      .select('id, eaten_at, recognizer, created_at, meal_items (food_name, amount_g, nutrition, detected_label, created_at)')
      .eq('user_id', userId)
      .order('eaten_at'),
    supabase.from('water_logs').select('amount_ml, logged_at').eq('user_id', userId).order('logged_at'),
    supabase.from('recognition_events').select('provider, labels, unmatched_labels, created_at').eq('user_id', userId).order('created_at'),
    supabase.from('body_measurements').select('measured_on, weight_kg, height_cm, entered_by, created_at').eq('user_id', userId).order('measured_on'),
    // Staff notes are hidden in the app, but the person has a right to see them.
    supabase.from('player_notes').select('body, author_id, created_at, updated_at').eq('user_id', userId).order('created_at'),
    listAccounts(),
  ]);
  const firstError = profile.error ?? goals.error ?? meals.error ?? water.error ?? events.error ?? measurements.error ?? notes.error;
  if (firstError) throw firstError;
  const account = accounts.data?.find((a) => a.id === userId);

  // Keys follow the chosen language too (the file is for the person to read).
  const payload = {
    [t('eksportert', 'exported')]: new Date().toISOString(),
    [t('merknad', 'note')]: t(
      'Alle opplysninger IK Start Ernæring lagrer om denne personen. Bilder av måltider lagres aldri. Næringsdata fra Matvaretabellen (Mattilsynet).',
      'All information IK Start Ernæring stores about this person. Meal photos are never stored. Nutrition data from Matvaretabellen (Norwegian Food Safety Authority).',
    ),
    [t('konto', 'account')]: {
      [t('e_post', 'email')]: account?.email ?? null,
      [t('sist_innlogget', 'last_sign_in')]: account?.last_sign_in_at ?? null,
    },
    [t('profil', 'profile')]: profile.data,
    [t('egne_mal', 'own_goals')]: goals.data,
    [t('maltider', 'meals')]: meals.data,
    [t('vann', 'water')]: water.data,
    [t('gjenkjenning', 'recognition')]: events.data,
    [t('malinger', 'measurements')]: measurements.data,
    [t('notater_fra_trenere', 'staff_notes')]: notes.data,
  };
  downloadFile(`${fileSafe(name)}_${t('alle-data', 'all-data')}_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'json');
}
