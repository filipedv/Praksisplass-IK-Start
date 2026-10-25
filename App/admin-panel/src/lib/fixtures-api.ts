// Fixtures (matches + trainings), their reminders, and the reminder template
// library. See supabase/migrations/20261028120000_fixtures.sql.
//
// The send time of each reminder is worked out BY THE DATABASE (Norwegian
// local time); sendAtPreview() below only mirrors it for the form preview.
// Players get the reminders as local notifications scheduled by the app the
// next time they open it.

import { locale, t } from './i18n';
import { supabase } from './supabase';

export type FixtureKind = 'match' | 'training';
export type Anchor = 'before_start' | 'after_end' | 'day_before' | 'same_day';

/** When a reminder goes out, relative to the fixture. */
export type Timing = { anchor: Anchor; offset_minutes: number | null; at_time: string | null };

export type ReminderTemplate = Timing & {
  id: string;
  kind: FixtureKind;
  name: string;
  body_nb: string;
  body_en: string | null;
  default_selected: boolean;
  sort_order: number;
};

export type FixtureReminder = Timing & {
  id: string;
  template_id: string | null;
  body_nb: string;
  body_en: string | null;
  send_at: string;
};

export type Fixture = {
  id: string;
  kind: FixtureKind;
  title: string | null;
  opponent: string | null;
  home_away: 'home' | 'away' | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  team_ids: string[];
  reminders: FixtureReminder[];
};

// ---- Reading and writing ----

export async function fetchTemplates(): Promise<ReminderTemplate[]> {
  const { data, error } = await supabase.from('reminder_templates').select('*').order('kind').order('sort_order');
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, at_time: shortTime(row.at_time) })) as ReminderTemplate[];
}

export async function saveTemplate(template: Omit<ReminderTemplate, 'id'>, id?: string) {
  const { error } = id
    ? await supabase.from('reminder_templates').update(template).eq('id', id)
    : await supabase.from('reminder_templates').insert(template);
  if (error) throw error;
}

export async function deleteTemplate(id: string) {
  const { error } = await supabase.from('reminder_templates').delete().eq('id', id);
  if (error) throw error;
}

/** Fixtures ending after `fromIso` (upcoming), or before it (past, newest first). */
export async function fetchFixtures(nowIso: string, past: boolean): Promise<Fixture[]> {
  let query = supabase
    .from('fixtures')
    .select(
      'id, kind, title, opponent, home_away, location, starts_at, ends_at, fixture_teams (team_id), fixture_reminders (id, template_id, anchor, offset_minutes, at_time, body_nb, body_en, send_at)',
    )
    .order('starts_at', { ascending: !past })
    .limit(past ? 50 : 200);
  query = past ? query.lt('ends_at', nowIso) : query.gte('ends_at', nowIso);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(({ fixture_teams, fixture_reminders, ...f }) => ({
    ...(f as Omit<Fixture, 'team_ids' | 'reminders'>),
    team_ids: fixture_teams.map((ft) => ft.team_id),
    reminders: (fixture_reminders as FixtureReminder[])
      .map((r) => ({ ...r, at_time: shortTime(r.at_time) }))
      .sort((a, b) => a.send_at.localeCompare(b.send_at)),
  }));
}

export type FixtureInput = Pick<Fixture, 'kind' | 'title' | 'opponent' | 'home_away' | 'location' | 'starts_at' | 'ends_at'>;
export type ReminderInput = Timing & { template_id: string | null; body_nb: string; body_en: string | null };

/** Saves the fixture, its teams and its reminders in one transaction (save_fixture()). */
export async function saveFixture(id: string | null, fixture: FixtureInput, teamIds: string[], reminders: ReminderInput[]) {
  const { error } = await supabase.rpc('save_fixture', {
    // The generated types say "string" for uuid arguments; null = create new.
    p_id: id as string,
    p_fixture: fixture,
    p_team_ids: teamIds,
    p_reminders: reminders,
  });
  if (error) throw error;
}

export async function deleteFixture(id: string) {
  const { error } = await supabase.from('fixtures').delete().eq('id', id);
  if (error) throw error;
}

// ---- Display helpers ----

/** "19:00:00" → "19:00". */
function shortTime(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}

/** "3 t før start", "Dagen før kl. 19:00" … */
export function timingLabel(timing: Timing): string {
  const minutes = timing.offset_minutes ?? 0;
  const duration =
    minutes % 60 === 0 && minutes > 0
      ? t(`${minutes / 60} t`, `${minutes / 60} h`)
      : minutes >= 60
        ? t(`${Math.floor(minutes / 60)} t ${minutes % 60} min`, `${Math.floor(minutes / 60)} h ${minutes % 60} min`)
        : `${minutes} min`;
  switch (timing.anchor) {
    case 'before_start':
      return t(`${duration} før start`, `${duration} before start`);
    case 'after_end':
      return minutes === 0 ? t('Rett etter slutt', 'Right after the end') : t(`${duration} etter slutt`, `${duration} after the end`);
    case 'day_before':
      return t(`Dagen før kl. ${timing.at_time}`, `The day before at ${timing.at_time}`);
    case 'same_day':
      return t(`Samme dag kl. ${timing.at_time}`, `Same day at ${timing.at_time}`);
  }
}

/** The send time, worked out like the database does — for the form preview. */
export function sendAtPreview(timing: Timing, start: Date, end: Date): Date {
  const minutes = timing.offset_minutes ?? 0;
  if (timing.anchor === 'before_start') return new Date(start.getTime() - minutes * 60_000);
  if (timing.anchor === 'after_end') return new Date(end.getTime() + minutes * 60_000);
  const [h, m] = (timing.at_time ?? '00:00').split(':').map(Number);
  const day = new Date(start);
  if (timing.anchor === 'day_before') day.setDate(day.getDate() - 1);
  day.setHours(h, m, 0, 0);
  return day;
}

export const formatWhen = (date: Date) =>
  date.toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** The fields a reminder text can contain. Filled in on each player's phone. */
export const PLACEHOLDERS = ['{lag}', '{motstander}', '{tid}', '{dag}', '{sted}'];

export type PlaceholderValues = { team: string | null; opponent: string | null; start: Date; location: string | null };

/**
 * "Kamp i morgen kl. {tid} mot {motstander}" → "Kamp i morgen kl. 18:00 mot Vålerenga".
 * Same rules as the player app (player-app/src/fixtures/fixtures.ts).
 */
export function fillPlaceholders(text: string, values: PlaceholderValues, lang: 'nb' | 'en'): string {
  const en = lang === 'en';
  const loc = en ? 'en-GB' : 'nb-NO';
  const map: Record<string, string> = {
    lag: values.team ?? (en ? 'the team' : 'laget'),
    motstander: values.opponent ?? (en ? 'the opponent' : 'motstanderen'),
    tid: values.start.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }),
    dag: values.start.toLocaleDateString(loc, { weekday: 'long' }),
    sted: values.location ?? '',
  };
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => map[key] ?? whole).replace(/\s{2,}/g, ' ').trim();
}

/** "Kamp mot Vålerenga (hjemme)", "Trening", or the title if set. */
export function fixtureHeading(f: Pick<Fixture, 'kind' | 'title' | 'opponent' | 'home_away'>): string {
  const base =
    f.kind === 'match'
      ? f.opponent
        ? t(`Kamp mot ${f.opponent}`, `Match vs ${f.opponent}`)
        : t('Kamp', 'Match')
      : t('Trening', 'Training');
  const where = f.home_away === 'home' ? t(' (hjemme)', ' (home)') : f.home_away === 'away' ? t(' (borte)', ' (away)') : '';
  return f.title ? `${f.title} · ${base}${where}` : `${base}${where}`;
}
