// Reading daily summaries and goals. The heavy lifting happens in SQL
// (supabase/migrations/20261015120000_goals_and_summaries.sql), so the admin
// panel never downloads every single meal item just to add up a day.

import { toISODate } from './format';
import { supabase } from './supabase';

/** One player's totals for one day (from daily_summary()). */
export type DaySummary = {
  user_id: string;
  day: string; // "2026-10-14" (Norwegian local day)
  meals: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_ml: number;
};

/** Goals with every field filled in (own value or club default). */
export type Goals = {
  goal_kcal: number;
  goal_protein_g: number;
  goal_carbs_g: number;
  goal_fat_g: number;
  goal_water_ml: number;
};

export const GOAL_FIELDS: { key: keyof Goals; label: string; unit: string }[] = [
  { key: 'goal_kcal', label: 'Energi', unit: 'kcal' },
  { key: 'goal_protein_g', label: 'Protein', unit: 'g' },
  { key: 'goal_carbs_g', label: 'Karbohydrater', unit: 'g' },
  { key: 'goal_fat_g', label: 'Fett', unit: 'g' },
  { key: 'goal_water_ml', label: 'Vann', unit: 'ml' },
];

/** A player's OWN goals as stored — null = follows the club default. */
export type PlayerGoalsRow = { user_id: string } & { [K in keyof Goals]: number | null };

export type LastActivity = { user_id: string; last_meal_at: string | null; last_water_at: string | null };

/** Every day from `from` to `to` (inclusive), as ISO strings. */
export function daysBetween(from: Date, to: Date): string[] {
  const days: string[] = [];
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (d <= to) {
    days.push(toISODate(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export async function fetchDailySummary(from: string, to: string, userId?: string): Promise<DaySummary[]> {
  const { data, error } = await supabase.rpc('daily_summary', { p_from: from, p_to: to, p_user_id: userId ?? null });
  if (error) throw error;
  // numeric columns arrive as strings or numbers depending on size — normalise.
  return (data ?? []).map((r: DaySummary) => ({
    ...r,
    kcal: Number(r.kcal),
    protein_g: Number(r.protein_g),
    carbs_g: Number(r.carbs_g),
    fat_g: Number(r.fat_g),
    water_ml: Number(r.water_ml),
  }));
}

export async function fetchLastActivity(): Promise<LastActivity[]> {
  const { data, error } = await supabase.rpc('last_activity');
  if (error) throw error;
  return data ?? [];
}

/** Club defaults + every player's own goals → effective goals per player. */
export async function fetchAllGoals(): Promise<{ defaults: Goals; byUser: Map<string, PlayerGoalsRow> }> {
  const [club, own] = await Promise.all([
    supabase
      .from('club_settings')
      .select('default_goal_kcal, default_goal_protein_g, default_goal_carbs_g, default_goal_fat_g, default_goal_water_ml')
      .eq('id', 1)
      .single(),
    supabase.from('player_goals').select('user_id, goal_kcal, goal_protein_g, goal_carbs_g, goal_fat_g, goal_water_ml'),
  ]);
  if (club.error) throw club.error;
  if (own.error) throw own.error;
  const c = club.data;
  return {
    defaults: {
      goal_kcal: c.default_goal_kcal,
      goal_protein_g: c.default_goal_protein_g,
      goal_carbs_g: c.default_goal_carbs_g,
      goal_fat_g: c.default_goal_fat_g,
      goal_water_ml: c.default_goal_water_ml,
    },
    byUser: new Map((own.data ?? []).map((g: PlayerGoalsRow) => [g.user_id, g])),
  };
}

/** Own value where set, else the club default — same rule as goals_for() in SQL. */
export function effectiveGoals(defaults: Goals, own: PlayerGoalsRow | undefined): Goals {
  const pick = (key: keyof Goals) => own?.[key] ?? defaults[key];
  return {
    goal_kcal: pick('goal_kcal'),
    goal_protein_g: pick('goal_protein_g'),
    goal_carbs_g: pick('goal_carbs_g'),
    goal_fat_g: pick('goal_fat_g'),
    goal_water_ml: pick('goal_water_ml'),
  };
}

/**
 * Save a player's own goals. A null field = "use the club default". If every
 * field is null we delete the row, so the player simply follows the club.
 */
export async function savePlayerGoals(userId: string, goals: { [K in keyof Goals]: number | null }) {
  const allEmpty = Object.values(goals).every((v) => v === null);
  const { error } = allEmpty
    ? await supabase.from('player_goals').delete().eq('user_id', userId)
    : await supabase.from('player_goals').upsert({ user_id: userId, ...goals });
  if (error) throw error;
}
