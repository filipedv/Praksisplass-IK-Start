// The player's own weight and height (Profilinnstillinger).
//
// Measurements can come from the player (here) or from a coach's weigh-in
// in the admin panel; the player sees both (it's their data) but can only
// change what they entered themselves (RLS).
//
// SAFEGUARDING NOTE: weight is sensitive, especially for youth players.
// Fine for the adults in the internal test; before youth players join this
// must be part of the age-based safeguarding work (see CLAUDE.md roadmap).

import { getCached, setCached } from '@/lib/cache';
import { toISODate } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

export type Measurement = {
  id: string;
  measured_on: string; // "2026-10-14"
  weight_kg: number | null;
  height_cm: number | null;
  entered_by: string | null;
};

/** My latest measurements, newest first. Filtered on MY id: staff can read everyone's. */
export async function fetchMyMeasurements(userId: string, limit = 10): Promise<Measurement[]> {
  const { data, error } = await supabase
    .from('body_measurements')
    .select('id, measured_on, weight_kg, height_cm, entered_by')
    .eq('user_id', userId)
    .order('measured_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []).map((m) => ({
    ...m,
    weight_kg: m.weight_kg === null ? null : Number(m.weight_kg),
    height_cm: m.height_cm === null ? null : Number(m.height_cm),
  }));
  return setCached(`measurements:${userId}`, rows);
}

export const getCachedMeasurements = (userId: string) => getCached<Measurement[]>(`measurements:${userId}`);

/** The newest weight and the newest height (they may come from different days). */
export function latestValues(list: Measurement[]) {
  return {
    weight: list.find((m) => m.weight_kg !== null) ?? null,
    height: list.find((m) => m.height_cm !== null) ?? null,
  };
}

/**
 * Save today's values. If I already entered something today, that entry is
 * updated (so fixing a typo doesn't add a second point to the coach's
 * chart); otherwise a new one is added. null = not changed.
 */
export async function saveMyMeasurement(userId: string, values: { weight_kg: number | null; height_cm: number | null }, mine: Measurement[]) {
  const today = toISODate(new Date());
  const existing = mine.find((m) => m.measured_on === today && m.entered_by === userId);
  const { error } = existing
    ? await supabase
        .from('body_measurements')
        .update({
          weight_kg: values.weight_kg ?? existing.weight_kg,
          height_cm: values.height_cm ?? existing.height_cm,
        })
        .eq('id', existing.id)
    : await supabase.from('body_measurements').insert({ user_id: userId, measured_on: today, ...values });
  if (error) throw error;
}
