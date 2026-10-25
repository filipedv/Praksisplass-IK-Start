// Reading and writing water intake (table: water_logs).
// Like meals: RLS limits players to their own rows, but admins can read
// everyone's — so we always filter on our own user id explicitly.

import { fetchMyGoals, getCachedGoals } from '@/goals/goals-api';
import { getCached, setCached } from '@/lib/cache';
import { dayRange, toISODate } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

export type WaterLog = { id: string; amount_ml: number; logged_at: string };

/** The day's water entries, newest first (as in the sketch's "Registreringer"). */
export async function fetchWaterForDay(userId: string, day: Date): Promise<WaterLog[]> {
  const { start, end } = dayRange(day);
  const { data, error } = await supabase
    .from('water_logs')
    .select('id, amount_ml, logged_at')
    .eq('user_id', userId)
    .gte('logged_at', start)
    .lt('logged_at', end)
    .order('logged_at', { ascending: false });
  if (error) throw error;
  return setCachedWater(userId, day, data ?? []);
}

const waterKey = (userId: string, day: Date) => `water:${userId}:${toISODate(day)}`;

/** What we last fetched (or changed) for this day, or undefined. */
export const getCachedWater = (userId: string, day: Date) => getCached<WaterLog[]>(waterKey(userId, day));

/** Keep the cache in step after adding/deleting an entry. */
export const setCachedWater = (userId: string, day: Date, logs: WaterLog[]) => setCached(waterKey(userId, day), logs);

export const getCachedWaterGoal = () => getCachedGoals()?.goal_water_ml;

export async function addWater(amountMl: number): Promise<WaterLog> {
  // user_id and logged_at are filled in by the database (auth.uid(), now()).
  const { data, error } = await supabase
    .from('water_logs')
    .insert({ amount_ml: amountMl })
    .select('id, amount_ml, logged_at')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWater(id: string) {
  const { error } = await supabase.from('water_logs').delete().eq('id', id);
  if (error) throw error;
}

/** My daily water goal — part of my goals (see src/goals/goals-api.ts). */
export async function fetchWaterGoal(): Promise<number> {
  return (await fetchMyGoals()).goal_water_ml;
}

export const sumWater = (logs: WaterLog[]) => logs.reduce((sum, l) => sum + l.amount_ml, 0);
