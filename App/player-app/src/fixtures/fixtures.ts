// Matches and trainings for MY team, and their reminders ("Kamp i morgen kl.
// 18:00 mot Vålerenga …"), set up by the staff in the admin panel.
//
// HOW THE REMINDERS ARRIVE: each time the app opens (or comes back to the
// front), syncFixtureReminders() fetches the next two weeks and schedules
// the reminders as LOCAL notifications on this phone — no server, no push
// tokens, works in Expo Go. A fixture added after the player last opened the
// app is picked up the next time they open it.
//
// The player can turn these off under Innstillinger. Meal reminders
// (src/reminders) are separate and use their own notification ids.

import * as Notifications from 'expo-notifications';

import { getCached, setCached } from '@/lib/cache';
import { getLanguage, type Language } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { cancelScheduled, ensureAndroidChannel } from '@/reminders/reminders';

export type FixtureReminder = { id: string; send_at: string; body_nb: string; body_en: string | null };

export type Fixture = {
  id: string;
  kind: 'match' | 'training';
  title: string | null;
  opponent: string | null;
  home_away: 'home' | 'away' | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  teamName: string | null; // my team's name, for {lag}
  reminders: FixtureReminder[];
};

const DAYS_AHEAD = 14;
// iOS keeps at most 64 scheduled notifications per app; leave room for the
// meal reminders.
const MAX_SCHEDULED = 50;
const ID_PREFIX = 'fixture-';
const SETTING_KEY = 'fixture-reminders-enabled';

// ---- On/off (Innstillinger) — on unless the player turned it off ----

export function fixtureRemindersEnabled(): boolean {
  try {
    return localStorage.getItem(SETTING_KEY) !== 'off';
  } catch {
    return true;
  }
}

export async function setFixtureRemindersEnabled(on: boolean, userId: string) {
  try {
    localStorage.setItem(SETTING_KEY, on ? 'on' : 'off');
  } catch {
    // storage unavailable
  }
  await syncFixtureReminders(userId);
}

// ---- Reading ----

/** My team's fixtures from now and two weeks ahead, soonest first. */
export async function fetchUpcomingFixtures(userId: string): Promise<Fixture[]> {
  // Filter on MY team explicitly: staff can read every team's fixtures.
  const { data: me, error: meError } = await supabase.from('profiles').select('team_id, teams (name)').eq('id', userId).maybeSingle();
  if (meError) throw meError;
  if (!me?.team_id) return setCached(`fixtures:${userId}`, []);

  const now = new Date();
  const until = new Date(now.getTime() + DAYS_AHEAD * 86_400_000);
  const { data, error } = await supabase
    .from('fixtures')
    .select(
      'id, kind, title, opponent, home_away, location, starts_at, ends_at, fixture_teams!inner (team_id), fixture_reminders (id, send_at, body_nb, body_en)',
    )
    .eq('fixture_teams.team_id', me.team_id)
    .gte('ends_at', now.toISOString())
    .lte('starts_at', until.toISOString())
    .order('starts_at');
  if (error) throw error;

  const teamName = (me.teams as { name: string } | null)?.name ?? null;
  const fixtures = (data ?? []).map(({ fixture_teams: _teams, fixture_reminders, ...f }) => ({
    ...(f as Omit<Fixture, 'teamName' | 'reminders'>),
    teamName,
    reminders: [...fixture_reminders].sort((a, b) => a.send_at.localeCompare(b.send_at)),
  }));
  return setCached(`fixtures:${userId}`, fixtures);
}

export const getCachedFixtures = (userId: string) => getCached<Fixture[]>(`fixtures:${userId}`);

// ---- Texts ----

/** "Kamp mot Vålerenga", "Trening", or the title. */
export function fixtureHeading(f: Pick<Fixture, 'kind' | 'title' | 'opponent'>, lang: Language): string {
  const en = lang === 'en';
  if (f.kind === 'training') return f.title || (en ? 'Training' : 'Trening');
  return f.opponent ? (en ? `Match vs ${f.opponent}` : `Kamp mot ${f.opponent}`) : f.title || (en ? 'Match' : 'Kamp');
}

/**
 * Fill in {lag} {motstander} {tid} {dag} {sted}.
 * Same rules as the admin panel's preview (admin-panel/src/lib/fixtures-api.ts).
 */
export function reminderText(r: FixtureReminder, f: Fixture, lang: Language): string {
  const en = lang === 'en';
  const loc = en ? 'en-GB' : 'nb-NO';
  const start = new Date(f.starts_at);
  const values: Record<string, string> = {
    lag: f.teamName ?? (en ? 'the team' : 'laget'),
    motstander: f.opponent ?? (en ? 'the opponent' : 'motstanderen'),
    tid: start.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }),
    dag: start.toLocaleDateString(loc, { weekday: 'long' }),
    sted: f.location ?? '',
  };
  const text = en && r.body_en ? r.body_en : r.body_nb;
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole).replace(/\s{2,}/g, ' ').trim();
}

// ---- Scheduling on the phone ----

// Syncs run one after another, never at the same time (app start and "back
// to the front" can happen together, and both remove + re-add reminders).
let queue: Promise<void> = Promise.resolve();

/**
 * Make the phone's scheduled fixture reminders match the database: remove
 * ours, then add every future reminder of the next two weeks. Safe to call
 * often. Does nothing (except clearing) if turned off or not allowed.
 */
export function syncFixtureReminders(userId: string): Promise<void> {
  const run = queue.then(() => syncNow(userId));
  queue = run.catch(() => {}); // a failed sync mustn't block the next one
  return run;
}

async function syncNow(userId: string) {
  await cancelScheduled(ID_PREFIX);
  if (!fixtureRemindersEnabled()) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return; // the "Neste kamp" card offers to turn them on
  const channelId = await ensureAndroidChannel();

  const lang = getLanguage();
  const now = Date.now();
  const fixtures = await fetchUpcomingFixtures(userId);
  const upcoming = fixtures
    .flatMap((f) => f.reminders.map((r) => ({ f, r })))
    .filter(({ r }) => new Date(r.send_at).getTime() > now + 60_000)
    .slice(0, MAX_SCHEDULED);

  for (const { f, r } of upcoming) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}${r.id}`,
      content: {
        title: `${f.kind === 'match' ? '⚽' : '🏃'} ${fixtureHeading(f, lang)}`,
        body: reminderText(r, f, lang),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.send_at), channelId },
    });
  }
}
