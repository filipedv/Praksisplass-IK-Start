// Teams (A-lag, G19 …). Only admins may write (RLS); everyone signed in may read.

import { t } from './i18n';
import { supabase } from './supabase';
import type { Team } from './types';

export const TEAM_COLUMNS = 'id, name, sort_order, goal_kcal, goal_protein_g, goal_carbs_g, goal_fat_g, goal_water_ml';

export async function listTeams(): Promise<Team[]> {
  const { data, error } = await supabase.from('teams').select(TEAM_COLUMNS).order('sort_order').order('name');
  if (error) throw error;
  return (data ?? []) as Team[];
}

/** Create (no id) or update (with id) a team. */
export async function saveTeam(team: Omit<Team, 'id'> & { id?: string }) {
  const { id, ...fields } = team;
  const { error } = id
    ? await supabase.from('teams').update(fields).eq('id', id)
    : await supabase.from('teams').insert(fields);
  if (error) throw error;
}

/** Deleting a team keeps its players — they just end up without a team. */
export async function deleteTeam(id: string) {
  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) throw error;
}

/** Put a user on a team (null = no team). Blocked for non-admins by a DB trigger. */
export async function setUserTeam(userId: string, teamId: string | null) {
  const { data, error } = await supabase.from('profiles').update({ team_id: teamId }).eq('id', userId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error(t('ingen tilgang', 'no access'));
}
