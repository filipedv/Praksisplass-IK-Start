// Teams (A-lag, G19 …) and which coaches coach them. Everyone signed in may
// read teams. Admins write everything; a coach may only change the GOALS of
// their own teams (RLS + the protect_team_columns trigger).

import { t } from './i18n';
import { supabase } from './supabase';
import type { Team } from './types';

export const TEAM_COLUMNS = 'id, name, sort_order, goal_kcal, goal_protein_g, goal_carbs_g, goal_fat_g, goal_water_ml';

export async function listTeams(): Promise<Team[]> {
  const { data, error } = await supabase.from('teams').select(TEAM_COLUMNS).order('sort_order').order('name');
  if (error) throw error;
  return (data ?? []) as Team[];
}

/** Create (no id) or update (with id) a team. Returns the team's id. */
export async function saveTeam(team: Omit<Team, 'id'> & { id?: string }): Promise<string> {
  const { id, ...fields } = team;
  const { data, error } = id
    ? await supabase.from('teams').update(fields).eq('id', id).select('id').single()
    : await supabase.from('teams').insert(fields).select('id').single();
  if (error) throw error;
  return data.id;
}

type TeamGoals = Pick<Team, 'goal_kcal' | 'goal_protein_g' | 'goal_carbs_g' | 'goal_fat_g' | 'goal_water_ml'>;

/** Change only a team's goals (what a coach may do for their own teams). */
export async function saveTeamGoals(teamId: string, goals: TeamGoals) {
  const { data, error } = await supabase.from('teams').update(goals).eq('id', teamId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error(t('ingen tilgang', 'no access'));
}

/** Every coach assignment as [coach id, team id] (a coach only gets their own). */
export async function listCoachTeams(): Promise<{ coach_id: string; team_id: string }[]> {
  const { data, error } = await supabase.from('coach_teams').select('coach_id, team_id');
  if (error) throw error;
  return data ?? [];
}

/** Make a coach's teams exactly `teamIds` (admins only). */
export async function setCoachTeams(coachId: string, teamIds: string[], current: string[]) {
  const added = teamIds.filter((id) => !current.includes(id));
  const removed = current.filter((id) => !teamIds.includes(id));
  if (added.length) {
    const { error } = await supabase.from('coach_teams').insert(added.map((team_id) => ({ coach_id: coachId, team_id })));
    if (error) throw error;
  }
  if (removed.length) {
    const { error } = await supabase.from('coach_teams').delete().eq('coach_id', coachId).in('team_id', removed);
    if (error) throw error;
  }
}

/** Make a team's coaches exactly `coachIds` (admins only). */
export async function setTeamCoaches(teamId: string, coachIds: string[], current: string[]) {
  const added = coachIds.filter((id) => !current.includes(id));
  const removed = current.filter((id) => !coachIds.includes(id));
  if (added.length) {
    const { error } = await supabase.from('coach_teams').insert(added.map((coach_id) => ({ coach_id, team_id: teamId })));
    if (error) throw error;
  }
  if (removed.length) {
    const { error } = await supabase.from('coach_teams').delete().eq('team_id', teamId).in('coach_id', removed);
    if (error) throw error;
  }
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
