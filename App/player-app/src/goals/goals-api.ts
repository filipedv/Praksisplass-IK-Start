// My daily goals: my own goal if an admin set one for me, else my team's,
// else the club default — worked out by the database (effective_goals()).
//
// SAFEGUARDING NOTE: showing goals and numbers is fine for the adults in
// the internal test. Before youth players join, this must follow the
// age-based rule (date of birth decides whether numbers are shown, with a
// coach override) — see the roadmap in CLAUDE.md.

import { getCached, setCached } from '@/lib/cache';
import { supabase } from '@/lib/supabase';

export type Goals = {
  goal_kcal: number;
  goal_protein_g: number;
  goal_carbs_g: number;
  goal_fat_g: number;
  goal_water_ml: number;
};

const FALLBACK: Goals = { goal_kcal: 2800, goal_protein_g: 130, goal_carbs_g: 380, goal_fat_g: 90, goal_water_ml: 2500 };

export async function fetchMyGoals(): Promise<Goals> {
  const { data, error } = await supabase.rpc('effective_goals').maybeSingle();
  if (error) throw error;
  return setCached('goals', data ?? FALLBACK);
}

/** The goals we fetched last time (or undefined) — for instant display. */
export const getCachedGoals = () => getCached<Goals>('goals');
