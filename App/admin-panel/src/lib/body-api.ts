// Weight/height measurements and private staff notes (coach dashboard sketch).
//
// Who may do what is decided by RLS (see the measurements_notes migration):
//   - measurements: staff (admin/coach) see and edit everyone's; players
//     see their own and add their own from the app
//   - notes: staff only — players never see them in the app (but they ARE
//     in the GDPR "all data" export: the player has a right of access)

import { supabase } from './supabase';

export type Measurement = {
  id: string;
  user_id: string;
  measured_on: string; // "2026-10-14"
  weight_kg: number | null;
  height_cm: number | null;
  entered_by: string | null;
  entered_by_name: string | null;
  created_at: string;
};

export type Note = {
  id: string;
  body: string;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
  updated_at: string;
};

type MeasurementRow = Omit<Measurement, 'entered_by_name' | 'weight_kg' | 'height_cm'> & {
  weight_kg: number | string | null;
  height_cm: number | string | null;
  entered: { display_name: string } | null;
};

const MEASUREMENT_COLUMNS =
  'id, user_id, measured_on, weight_kg, height_cm, entered_by, created_at, entered:profiles!body_measurements_entered_by_fkey (display_name)';

function toMeasurement(row: MeasurementRow): Measurement {
  const { entered, ...rest } = row;
  return {
    ...rest,
    // numeric columns can arrive as strings
    weight_kg: row.weight_kg === null ? null : Number(row.weight_kg),
    height_cm: row.height_cm === null ? null : Number(row.height_cm),
    entered_by_name: entered?.display_name ?? null,
  };
}

/** One player's measurements, oldest first. */
export async function fetchMeasurements(userId: string): Promise<Measurement[]> {
  const { data, error } = await supabase
    .from('body_measurements')
    .select(MEASUREMENT_COLUMNS)
    .eq('user_id', userId)
    .order('measured_on')
    .order('created_at');
  if (error) throw error;
  return ((data ?? []) as unknown as MeasurementRow[]).map(toMeasurement);
}

/** Every player's WEIGHTS since a day — for the "rapid weight change" flag on Oversikt. */
export async function fetchRecentWeights(sinceIso: string): Promise<Measurement[]> {
  const { data, error } = await supabase
    .from('body_measurements')
    .select(MEASUREMENT_COLUMNS)
    .gte('measured_on', sinceIso)
    .not('weight_kg', 'is', null)
    .order('measured_on')
    .limit(5000);
  if (error) throw error;
  return ((data ?? []) as unknown as MeasurementRow[]).map(toMeasurement);
}

export type MeasurementInput = { measured_on: string; weight_kg: number | null; height_cm: number | null };

export async function saveMeasurement(userId: string, input: MeasurementInput, id?: string) {
  const { error } = id
    ? await supabase.from('body_measurements').update(input).eq('id', id)
    : await supabase.from('body_measurements').insert({ ...input, user_id: userId });
  if (error) throw error;
}

export async function deleteMeasurement(id: string) {
  const { error } = await supabase.from('body_measurements').delete().eq('id', id);
  if (error) throw error;
}

/** Notes about one player, newest first. */
export async function fetchNotes(userId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('player_notes')
    .select('id, body, author_id, created_at, updated_at, author:profiles!player_notes_author_id_fkey (display_name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  type Row = Omit<Note, 'author_name'> & { author: { display_name: string } | null };
  return ((data ?? []) as unknown as Row[]).map(({ author, ...n }) => ({ ...n, author_name: author?.display_name ?? null }));
}

export async function addNote(userId: string, body: string) {
  const { error } = await supabase.from('player_notes').insert({ user_id: userId, body }); // author = me (DB trigger)
  if (error) throw error;
}

export async function updateNote(id: string, body: string) {
  const { error } = await supabase.from('player_notes').update({ body }).eq('id', id);
  if (error) throw error;
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from('player_notes').delete().eq('id', id);
  if (error) throw error;
}

// ---- "Rapid weight change" flag (from the coach dashboard sketch) ----

/** Change of at least this many kg … */
export const WEIGHT_ALERT_KG = 2;
/** … between the latest weigh-in and one 14–35 days earlier (closest to 21). */
const WINDOW = { min: 14, max: 35, ideal: 21 };

export type WeightChange = { diffKg: number; days: number; latestOn: string };

/**
 * Compares the latest weight to the one closest to three weeks earlier.
 * PLACEHOLDER thresholds — what's worrying for a growing athlete should be
 * decided with a sports-medicine professional, not by this number. It's a
 * nudge to check in, never a diagnosis.
 */
export function detectWeightChange(measurements: Measurement[]): WeightChange | null {
  const weights = measurements
    .filter((m) => m.weight_kg !== null)
    .sort((a, b) => (a.measured_on < b.measured_on ? -1 : a.measured_on > b.measured_on ? 1 : 0));
  if (weights.length < 2) return null;
  const latest = weights[weights.length - 1];
  const latestTime = new Date(`${latest.measured_on}T12:00`).getTime();
  let best: { m: Measurement; days: number } | null = null;
  for (const m of weights) {
    const days = Math.round((latestTime - new Date(`${m.measured_on}T12:00`).getTime()) / 86_400_000);
    if (days < WINDOW.min || days > WINDOW.max) continue;
    if (!best || Math.abs(days - WINDOW.ideal) < Math.abs(best.days - WINDOW.ideal)) best = { m, days };
  }
  if (!best) return null;
  const diffKg = Math.round((latest.weight_kg! - best.m.weight_kg!) * 10) / 10;
  return Math.abs(diffKg) >= WEIGHT_ALERT_KG ? { diffKg, days: best.days, latestOn: latest.measured_on } : null;
}
