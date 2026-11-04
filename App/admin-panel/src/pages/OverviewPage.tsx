// OVERSIKT — the admin's start page. Answers, in this order:
//   1. Key numbers (stat tiles) for the chosen day: active, logged, habit, recognition.
//   2. "Trenger oppfølging": concrete reasons to act — not logging, far from
//      goal, and suspicious data (huge amounts) that may need correcting.
//      "Fulgt opp" hides an item (saved in followup_dismissals, shared by all
//      admins). Habit items come back after 7 days if still true; data
//      items stay hidden (that exact item/day was checked), and so does a
//      weight-change flag until there is a NEW weigh-in.
//   3. Goal status for the group on one FULL day (yesterday by default; a live
//      "today" status would show almost everyone red in the morning).
//   4. Logging trend per week (last 8 weeks).
//   5. One row per person: the day vs. goal, the 7 days before, last logged.
//   6. System status.
//
// Filters (team, role, sort) are remembered between visits. Everything is
// read through RLS as the logged-in admin; sums come from daily_summary().

import { Check, Clock, Download, Scale, Search, TrendingDown, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useFeedback } from '../feedback/feedback-context';
import { Link, useNavigate } from 'react-router';

import { ColumnChart } from '../components/ColumnChart';
import { IMPLAUSIBLE_ITEM_G } from '../components/DayMealsTable';
import { StatusStrip, type StripDay } from '../components/StatusStrip';
import { SystemStatus } from '../components/SystemStatus';
import { Avatar, Meter, PageHeader, Segmented, StatTile, StatusIcon } from '../components/ui';
import { detectWeightChange, fetchRecentWeights, type Measurement } from '../lib/body-api';
import { downloadFile, toCsv } from '../lib/download';
import { addDaysIso, formatNumber, toISODate } from '../lib/format';
import { usePersistentState } from '../lib/persist';
import { STATUS_COLORS, STATUS_LABELS, STATUS_ORDER, computeStatus, type Status } from '../lib/status';
import {
  daysBetween,
  effectiveGoals,
  fetchAllGoals,
  fetchDailySummary,
  fetchLastActivity,
  type AllGoals,
  type DaySummary,
  type LastActivity,
} from '../lib/summary-api';
import { supabase } from '../lib/supabase';
import { ROLE_LABELS, type Profile, PROFILE_COLUMNS } from '../lib/types';
import { locale, t } from '../lib/i18n';

const DAY_MS = 86_400_000;
const TREND_WEEKS = 8;
/** A day above this many kcal is flagged as "check this" (probably a typo). */
const IMPLAUSIBLE_DAY_KCAL = 7000;
/** How long "Fulgt opp" hides a habit item (not logging / far from goal). */
const DISMISS_DAYS = 7;

/**
 * When a "Fulgt opp" runs out: never for data items (that exact item/day
 * was checked) and weight flags (keyed by the weigh-in), and after 7 days
 * for habits, which can recur.
 */
const isPermanentDismissal = (key: string) => key.startsWith('item:') || key.startsWith('day:') || key.startsWith('weight:');

function dismissalRow(key: string) {
  const permanent = isPermanentDismissal(key);
  const now = Date.now();
  return {
    item_key: key,
    dismissed_at: new Date(now).toISOString(), // set again if an expired row is re-used
    expires_at: permanent ? null : new Date(now + DISMISS_DAYS * DAY_MS).toISOString(),
  };
}

type BigItem = { user_id: string; eaten_at: string; food_name: string; amount_g: number };

type OverviewData = {
  requestKey: string;
  profiles: Profile[];
  goals: AllGoals;
  summary: DaySummary[];
  activity: LastActivity[];
  bigItems: BigItem[];
  matchRate: { labels: number; unmatched: number };
  /** Weigh-ins of the last ~7 weeks (for the "rapid weight change" flag). */
  weights: Measurement[];
  /** item key → when the "Fulgt opp" runs out (null = never). Only unexpired ones. */
  dismissed: Map<string, string | null>;
};

/** Everything the page needs, fetched in parallel. */
async function fetchOverview(fromIso: string, toIso: string, flagsFromIso: string, requestKey: string): Promise<OverviewData> {
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const nowIso = new Date().toISOString();
  const [profiles, goals, summary, activity, events, items, dismissals, weights] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLUMNS).eq('is_active', true).order('display_name'),
    fetchAllGoals(),
    fetchDailySummary(fromIso, toIso),
    fetchLastActivity(),
    supabase.from('recognition_events').select('labels, unmatched_labels').gte('created_at', since).limit(2000),
    // Suspiciously large single items in the flag window (likely typos).
    supabase
      .from('meal_items')
      .select('food_name, amount_g, meals!inner (user_id, eaten_at)')
      .gt('amount_g', IMPLAUSIBLE_ITEM_G)
      .gte('meals.eaten_at', new Date(`${flagsFromIso}T00:00:00`).toISOString())
      .limit(200),
    supabase.from('followup_dismissals').select('item_key, expires_at').or(`expires_at.is.null,expires_at.gt.${nowIso}`),
    fetchRecentWeights(toISODate(new Date(Date.now() - 50 * DAY_MS))).catch(() => [] as Measurement[]),
  ]);
  if (profiles.error) throw profiles.error;
  const matchRate = { labels: 0, unmatched: 0 };
  for (const e of events.data ?? []) {
    matchRate.labels += e.labels.length;
    matchRate.unmatched += e.unmatched_labels.length;
  }
  type ItemRow = { food_name: string; amount_g: number; meals: { user_id: string; eaten_at: string } };
  return {
    requestKey,
    profiles: (profiles.data ?? []) as Profile[],
    goals,
    summary,
    activity,
    bigItems: ((items.data ?? []) as unknown as ItemRow[]).map((i) => ({
      user_id: i.meals.user_id,
      eaten_at: i.meals.eaten_at,
      food_name: i.food_name,
      amount_g: Number(i.amount_g),
    })),
    matchRate,
    weights,
    dismissed: new Map((dismissals.data ?? []).map((d) => [d.item_key, d.expires_at])),
  };
}

const longDay = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
const shortDay = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });

/** "I dag 12:30", "I går", "for 4 dager siden", "Aldri" (relative to the real today). */
function lastLoggedText(iso: string | null, todayIso: string): string {
  if (!iso) return t('Aldri', 'Never');
  const then = new Date(iso);
  const days = Math.round((new Date(todayIso).getTime() - new Date(toISODate(then)).getTime()) / DAY_MS);
  if (days === 0) return `${t('I dag', 'Today')} ${then.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}`;
  if (days === 1) return t('I går', 'Yesterday');
  return t(`For ${days} dager siden`, `${days} days ago`);
}

/** ISO week number (what Norwegian calendars show): the week containing Thursday. */
function isoWeek(iso: string): number {
  const d = new Date(`${iso}T12:00`);
  const thursday = new Date(d);
  thursday.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
  const yearStart = new Date(thursday.getFullYear(), 0, 1, 12); // noon, like `thursday`
  return Math.ceil(((thursday.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}

/** Monday of the week containing `iso`. */
function mondayOf(iso: string): string {
  const d = new Date(`${iso}T12:00`);
  return addDaysIso(iso, -((d.getDay() + 6) % 7));
}

type SortMode = 'attention' | 'name' | 'recent';
type RoleFilter = 'all' | 'player';

export function OverviewPage() {
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const [showHandled, setShowHandled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OverviewData | null>(null);
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = usePersistentState<SortMode>('overview-sort', 'attention');
  // During the internal test most of us are admins, so show everyone by default.
  const [roleFilter, setRoleFilter] = usePersistentState<RoleFilter>('overview-role', 'all');
  const [teamFilter, setTeamFilter] = usePersistentState<string>('overview-team', 'all'); // 'all' | 'none' | id

  // The clock is read once, when the page opens. `day` = the day being looked at.
  const [todayIso] = useState(() => toISODate(new Date()));
  const [day, setDay] = useState(todayIso);
  const isToday = day === todayIso;
  // The day whose goal status we show: the chosen day, or yesterday if it's today.
  const statusDay = isToday ? addDaysIso(todayIso, -1) : day;
  const historyFrom = addDaysIso(day, -7); // the 7 days before `day`
  const trendFrom = mondayOf(addDaysIso(todayIso, -(TREND_WEEKS - 1) * 7));
  const fromIso = historyFrom < trendFrom ? historyFrom : trendFrom;

  const requestKey = `${fromIso}|${historyFrom}`;
  const loading = data?.requestKey !== requestKey;
  useEffect(() => {
    let cancelled = false;
    fetchOverview(fromIso, todayIso, historyFrom, requestKey)
      .then((result) => !cancelled && setData(result))
      .catch((e) => !cancelled && setError(e.message ?? String(e)));
    return () => {
      cancelled = true;
    };
  }, [fromIso, todayIso, historyFrom, requestKey]);

  // ---- "Fulgt opp" (saved for all admins; RLS: admins only) ----
  function setDismissed(update: (m: Map<string, string | null>) => void) {
    setData((prev) => {
      if (!prev) return prev;
      const dismissed = new Map(prev.dismissed);
      update(dismissed);
      return { ...prev, dismissed };
    });
  }

  async function dismissTodo(key: string) {
    const row = dismissalRow(key);
    setDismissed((m) => m.set(key, row.expires_at));
    const { error: e } = await supabase.from('followup_dismissals').upsert(row); // dismissed_by = me (database default)
    if (e) {
      setDismissed((m) => m.delete(key));
      toast(`${t('Kunne ikke lagre', "Couldn't save")}: ${e.message}`, 'error');
    }
  }

  async function reopenTodo(key: string) {
    const before = data?.dismissed.get(key) ?? null;
    setDismissed((m) => m.delete(key));
    const { error: e } = await supabase.from('followup_dismissals').delete().eq('item_key', key);
    if (e) {
      setDismissed((m) => m.set(key, before));
      toast(`${t('Kunne ikke angre', "Couldn't undo")}: ${e.message}`, 'error');
    }
  }

  // ---- One row per person (only recomputed when data or the day changes) ----
  const rows = useMemo(() => {
    if (!data) return [];
    const pastDays = daysBetween(new Date(`${historyFrom}T12:00`), new Date(`${addDaysIso(day, -1)}T12:00`)); // 7 days
    const byUserDay = new Map(data.summary.map((s) => [`${s.user_id}|${s.day}`, s]));
    const activity = new Map(data.activity.map((a) => [a.user_id, a]));

    return data.profiles.map((p) => {
      const team = p.team_id ? data.goals.teams.get(p.team_id) : undefined;
      const goals = effectiveGoals(data.goals.defaults, data.goals.byUser.get(p.id), team);
      const daySum = byUserDay.get(`${p.id}|${day}`);
      const status = (iso: string) => {
        const s = byUserDay.get(`${p.id}|${iso}`);
        return computeStatus(s?.kcal ?? 0, s?.water_ml ?? 0, goals.goal_kcal, goals.goal_water_ml);
      };
      const history: StripDay[] = pastDays.map((iso) => ({ key: iso, title: longDay(iso), status: status(iso) }));
      const lastMealAt = activity.get(p.id)?.last_meal_at ?? null;
      const daysSinceMeal = lastMealAt
        ? Math.round((new Date(todayIso).getTime() - new Date(toISODate(new Date(lastMealAt))).getTime()) / DAY_MS)
        : Infinity;
      return {
        profile: p,
        team,
        goals,
        dayKcal: daySum?.kcal ?? 0,
        dayWater: daySum?.water_ml ?? 0,
        history,
        dayStatus: status(statusDay),
        daysLogged: history.filter((h) => h.status !== 'gray').length,
        redDays: history.filter((h) => h.status === 'red').length,
        lastMealAt,
        daysSinceMeal,
      };
    });
  }, [data, day, historyFrom, statusDay, todayIso]);

  if (error) return <p className="error">{t('Kunne ikke hente oversikten', "Couldn't load the overview")}: {error}</p>;
  if (!data) return <p className="muted">{t('Laster oversikt…', 'Loading overview…')}</p>;

  const teams = [...data.goals.teams.values()];
  const visible = rows.filter(
    (r) =>
      (roleFilter === 'all' || r.profile.role === 'player') &&
      (teamFilter === 'all' || (teamFilter === 'none' ? !r.profile.team_id : r.profile.team_id === teamFilter)),
  );
  const visibleIds = new Set(visible.map((r) => r.profile.id));
  const nameOf = new Map(data.profiles.map((p) => [p.id, p.display_name]));

  // ---- "Trenger oppfølging": concrete, prioritised reasons ----
  type Todo = { id: string; userId: string; icon: 'clock' | 'alert' | 'data' | 'weight'; text: string; priority: number };
  const todos: Todo[] = [];
  for (const r of visible) {
    const name = r.profile.display_name;
    if (r.daysSinceMeal === Infinity) {
      todos.push({ id: `never:${r.profile.id}`, userId: r.profile.id, icon: 'clock', priority: 300, text: t(`${name} har aldri logget et måltid.`, `${name} has never logged a meal.`) });
    } else if (r.daysSinceMeal >= 3) {
      todos.push({ id: `logging:${r.profile.id}`, userId: r.profile.id, icon: 'clock', priority: 100 + r.daysSinceMeal, text: t(`${name} har ikke logget på ${r.daysSinceMeal} dager.`, `${name} hasn't logged for ${r.daysSinceMeal} days.`) });
    }
    if (r.redDays >= 4) {
      todos.push({ id: `nutrition:${r.profile.id}`, userId: r.profile.id, icon: 'alert', priority: 70 + r.redDays, text: t(`${name} har vært langt fra målet ${r.redDays} av de 7 siste dagene.`, `${name} has been far from the goal ${r.redDays} of the last 7 days.`) });
    }
  }
  // Rapid weight change (coach dashboard sketch): ±2 kg over ~3 weeks. A
  // nudge to check in, not a diagnosis. Keyed by the latest weigh-in, so
  // "Fulgt opp" lasts until someone is weighed again.
  const weightsByUser = new Map<string, Measurement[]>();
  for (const m of data.weights) weightsByUser.set(m.user_id, [...(weightsByUser.get(m.user_id) ?? []), m]);
  for (const r of visible) {
    const change = detectWeightChange(weightsByUser.get(r.profile.id) ?? []);
    if (!change) continue;
    const kg = formatNumber(Math.abs(change.diffKg), 1);
    todos.push({
      id: `weight:${r.profile.id}:${change.latestOn}`,
      userId: r.profile.id,
      icon: 'weight',
      priority: 90 + Math.abs(change.diffKg),
      text: t(
        `${r.profile.display_name} har ${change.diffKg < 0 ? 'gått ned' : 'gått opp'} ${kg} kg på ${change.days} dager — verdt å sjekke inn.`,
        `${r.profile.display_name} has ${change.diffKg < 0 ? 'lost' : 'gained'} ${kg} kg in ${change.days} days — worth checking in.`,
      ),
    });
  }
  // Data quality: single items over 1 kg, and whole days over 7000 kcal.
  for (const item of data.bigItems) {
    if (!visibleIds.has(item.user_id)) continue;
    todos.push({
      id: `item:${item.user_id}:${item.eaten_at}:${item.food_name}`,
      userId: item.user_id,
      icon: 'data',
      priority: 200,
      text: `${nameOf.get(item.user_id)}: ${formatNumber(item.amount_g)} g ${item.food_name} (${shortDay(toISODate(new Date(item.eaten_at)))}) — ${t('sjekk mengden.', 'check the amount.')}`,
    });
  }
  for (const s of data.summary) {
    if (!visibleIds.has(s.user_id) || s.day < historyFrom || s.kcal <= IMPLAUSIBLE_DAY_KCAL) continue;
    todos.push({
      id: `day:${s.user_id}:${s.day}`,
      userId: s.user_id,
      icon: 'data',
      priority: 190,
      text: `${nameOf.get(s.user_id)}: ${formatNumber(s.kcal)} kcal ${shortDay(s.day)} — ${t('uvanlig mye, sjekk dagen.', 'unusually high, check the day.')}`,
    });
  }
  todos.sort((a, b) => b.priority - a.priority);
  const openTodos = todos.filter((todo) => !data.dismissed.has(todo.id));
  const handledTodos = todos.filter((todo) => data.dismissed.has(todo.id));
  const shownTodos = showHandled ? handledTodos : openTodos;

  // ---- Group numbers for the chosen day ----
  const loggedOnDay = visible.filter((r) => r.dayKcal > 0).length;
  const avgDaysLogged = visible.length ? visible.reduce((s, r) => s + r.daysLogged, 0) / visible.length : 0;
  const statusCounts: Record<Status, number> = { gray: 0, red: 0, orange: 0, green: 0 };
  for (const r of visible) statusCounts[r.dayStatus] += 1;
  const matched = data.matchRate.labels ? 1 - data.matchRate.unmatched / data.matchRate.labels : null;

  // ---- Trend: share of possible user-days with a logged meal, per week ----
  const loggedDays = new Set(data.summary.filter((s) => s.meals > 0 && visibleIds.has(s.user_id)).map((s) => `${s.user_id}|${s.day}`));
  const trend = Array.from({ length: TREND_WEEKS }, (_, w) => {
    const monday = addDaysIso(trendFrom, w * 7);
    // Only count days that have happened (the current week is partial).
    const weekDays = daysBetween(new Date(`${monday}T12:00`), new Date(`${addDaysIso(monday, 6)}T12:00`)).filter((d) => d <= todayIso);
    let hit = 0;
    for (const r of visible) for (const d of weekDays) if (loggedDays.has(`${r.profile.id}|${d}`)) hit++;
    const possible = visible.length * weekDays.length;
    return {
      key: monday,
      label: `${t('u', 'w')}${isoWeek(monday)}`,
      title: t(`Uke fra ${shortDay(monday)}${weekDays.length < 7 ? ' (pågår)' : ''}`, `Week from ${shortDay(monday)}${weekDays.length < 7 ? ' (in progress)' : ''}`),
      value: possible ? Math.round((hit / possible) * 100) : 0,
    };
  });

  // ---- Table: search + sort ----
  const filtered = visible.filter((r) => r.profile.display_name.toLowerCase().includes(query.trim().toLowerCase()));
  const sorted = [...filtered].sort((a, b) => {
    const byName = a.profile.display_name.localeCompare(b.profile.display_name, 'nb');
    if (sortMode === 'name') return byName;
    if (sortMode === 'recent') return a.daysSinceMeal - b.daysSinceMeal || byName;
    return b.daysSinceMeal - a.daysSinceMeal || b.redDays - a.redDays || byName; // "attention"
  });

  // ---- Export the visible group's last 7 days (one row per person per day) ----
  function exportGroup() {
    const byUserDay = new Map(data!.summary.map((s) => [`${s.user_id}|${s.day}`, s]));
    const rowsOut = visible.flatMap((r) =>
      r.history.map((h) => ({ r, iso: h.key, status: h.status, s: byUserDay.get(`${r.profile.id}|${h.key}`) })),
    );
    const csv = toCsv(rowsOut, [
      { header: t('Navn', 'Name'), value: (x) => x.r.profile.display_name },
      { header: t('Lag', 'Team'), value: (x) => x.r.team?.name ?? '' },
      { header: t('Dato', 'Date'), value: (x) => x.iso },
      { header: 'Status', value: (x) => (x.status ? STATUS_LABELS[x.status] : '') },
      { header: t('Energi (kcal)', 'Energy (kcal)'), value: (x) => x.s?.kcal ?? 0 },
      { header: t('Energimål (kcal)', 'Energy goal (kcal)'), value: (x) => x.r.goals.goal_kcal },
      { header: 'Protein (g)', value: (x) => x.s?.protein_g ?? 0 },
      { header: t('Karbohydrater (g)', 'Carbohydrates (g)'), value: (x) => x.s?.carbs_g ?? 0 },
      { header: t('Fett (g)', 'Fat (g)'), value: (x) => x.s?.fat_g ?? 0 },
      { header: t('Vann (ml)', 'Water (ml)'), value: (x) => x.s?.water_ml ?? 0 },
      { header: t('Vannmål (ml)', 'Water goal (ml)'), value: (x) => x.r.goals.goal_water_ml },
    ]);
    const teamName =
      teamFilter === 'all'
        ? t('alle', 'all')
        : teamFilter === 'none'
          ? t('uten-lag', 'no-team')
          : (data!.goals.teams.get(teamFilter)?.name ?? t('lag', 'team'));
    downloadFile(`${t('oversikt', 'overview')}_${teamName.toLowerCase().replace(/\s+/g, '-')}_${historyFrom}_${addDaysIso(day, -1)}.csv`, csv, 'csv');
  }

  const dayLabel = isToday ? t('i dag', 'today') : shortDay(day);

  return (
    <div className="stack-lg">
      <PageHeader
        title={t('Oversikt', 'Overview')}
        subtitle={new Date(`${day}T12:00`).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      />

      {/* One filter row, above everything it scopes */}
      <div className="row" style={{ gap: 10 }}>
        <label className="row" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {t('Dag', 'Day')}
          <input type="date" value={day} max={todayIso} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </label>
        {!isToday && (
          <button className="small ghost" onClick={() => setDay(todayIso)}>
            {t('Til i dag', 'Back to today')}
          </button>
        )}
        <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} aria-label={t('Lag', 'Team')}>
          <option value="all">{t('Alle lag', 'All teams')}</option>
          <option value="none">{t('Uten lag', 'No team')}</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        <Segmented
          label={t('Hvem vises', 'Who is shown')}
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: 'all', label: t('Alle aktive', 'All active') },
            { value: 'player', label: t('Kun spillere', 'Players only') },
          ]}
        />
        <button className="small" onClick={exportGroup} style={{ marginLeft: 'auto' }}>
          <Download size={13} /> {t('Eksporter 7 dager (CSV)', 'Export 7 days (CSV)')}
        </button>
      </div>

      <div className="kpi-row" style={{ opacity: loading ? 0.6 : 1 }}>
        <StatTile
          label={t('Aktive brukere', 'Active users')}
          value={visible.length}
          sub={teamFilter === 'all' ? t('Alle lag', 'All teams') : t('Filtrert på lag', 'Filtered by team')}
        />
        <StatTile
          label={`${t('Logget', 'Logged')} ${dayLabel}`}
          value={loggedOnDay}
          unit={`${t('av', 'of')} ${visible.length}`}
          sub={t('Minst ett måltid', 'At least one meal')}
        />
        <StatTile
          label={t('Logget, 7 dager før', 'Logged, previous 7 days')}
          value={formatNumber(avgDaysLogged, 1)}
          unit={t('av 7 dager', 'of 7 days')}
          sub={t('Snitt per bruker', 'Average per user')}
        />
        <StatTile
          label={t('Gjenkjenning, siste 30 dager', 'Recognition, last 30 days')}
          value={matched === null ? '–' : `${formatNumber(matched * 100)} %`}
          sub={matched === null ? t('Ingen bilder ennå', 'No photos yet') : `${data.matchRate.labels} ${t('etiketter', 'labels')}`}
        />
      </div>

      <div className="two-col">
        <section className="card">
          <div className="card-header">
            <h2>{t('Trenger oppfølging', 'Needs follow-up')}</h2>
            <span className="faint small">{t('Oppdateres automatisk', 'Updates automatically')}</span>
          </div>
          {shownTodos.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              {showHandled
                ? t('Ingen punkter er markert som fulgt opp.', 'No items are marked as followed up.')
                : t(
                    'Ingen å følge opp nå — alle har logget de siste dagene, og ingen tall ser rare ut.',
                    'Nobody to follow up right now — everyone has logged in the last few days, and no numbers look odd.',
                  )}
            </p>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {shownTodos.slice(0, 12).map((todo) => (
                <div key={todo.id} className={`todo-row${showHandled ? ' handled' : ''}`}>
                  <Link to={`/users/${todo.userId}`} className="todo">
                    {todo.icon === 'clock' ? (
                      <Clock size={16} />
                    ) : todo.icon === 'data' ? (
                      <Scale size={16} />
                    ) : todo.icon === 'weight' ? (
                      <TrendingDown size={16} />
                    ) : (
                      <TriangleAlert size={16} />
                    )}
                    <span>{todo.text}</span>
                  </Link>
                  <button
                    className="small ghost"
                    onClick={() => void (showHandled ? reopenTodo(todo.id) : dismissTodo(todo.id))}
                    title={
                      showHandled
                        ? t('Vis punktet igjen', 'Show the item again')
                        : isPermanentDismissal(todo.id)
                          ? t('Skjul dette punktet', 'Hide this item')
                          : t(`Skjul i ${DISMISS_DAYS} dager`, `Hide for ${DISMISS_DAYS} days`)
                    }>
                    {showHandled ? (
                      t('Angre', 'Undo')
                    ) : (
                      <>
                        <Check size={13} /> {t('Fulgt opp', 'Followed up')}
                      </>
                    )}
                  </button>
                </div>
              ))}
              {shownTodos.length > 12 && <span className="faint small">+{shownTodos.length - 12} {t('til', 'more')}</span>}
            </div>
          )}
          {(handledTodos.length > 0 || showHandled) && (
            <button className="small ghost" style={{ marginTop: 10, alignSelf: 'flex-start' }} onClick={() => setShowHandled(!showHandled)}>
              {showHandled ? t('Tilbake til åpne punkter', 'Back to open items') : `${t('Vis fulgt opp', 'Show followed up')} (${handledTodos.length})`}
            </button>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <h2>{isToday ? t('I går', 'Yesterday') : shortDay(statusDay)}</h2>
            <span className="faint small">{t('Hele dagen, mot hver brukers mål', "The whole day, against each user's goals")}</span>
          </div>
          <div className="squad-bar" aria-hidden>
            {STATUS_ORDER.map((s) =>
              statusCounts[s] ? (
                <span key={s} style={{ width: `${(statusCounts[s] / Math.max(visible.length, 1)) * 100}%`, background: STATUS_COLORS[s] }} />
              ) : null,
            )}
          </div>
          <div className="stack" style={{ gap: 8, marginTop: 16 }}>
            {STATUS_ORDER.map((s) => (
              <div key={s} className="row spread">
                <span className="legend-item">
                  <StatusIcon status={s} /> {STATUS_LABELS[s]}
                </span>
                <strong className="num">{statusCounts[s]}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <h2>{t('Logging per uke', 'Logging per week')}</h2>
          <span className="faint small">
            {t(
              `Andel av mulige dager med minst ett måltid · siste ${TREND_WEEKS} uker`,
              `Share of possible days with at least one meal · last ${TREND_WEEKS} weeks`,
            )}
          </span>
        </div>
        <ColumnChart ariaLabel={t('Andel loggede dager per uke', 'Share of logged days per week')} data={trend} unit="%" color="var(--primary-hover)" height={160} loading={loading} />
      </section>

      <section className="card flush">
        <div className="row spread" style={{ padding: '16px 20px' }}>
          <div className="search" style={{ width: 280 }}>
            <Search size={15} />
            <input type="search" placeholder={t('Søk etter navn', 'Search by name')} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="faint small">{t('Sorter', 'Sort')}</span>
            <Segmented
              label={t('Sortering', 'Sorting')}
              value={sortMode}
              onChange={setSortMode}
              options={[
                { value: 'attention', label: t('Trenger oppfølging', 'Needs follow-up') },
                { value: 'name', label: t('Navn (A–Å)', 'Name (A–Z)') },
                { value: 'recent', label: t('Nylig aktive', 'Recently active') },
              ]}
            />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('Navn', 'Name')}</th>
                <th>
                  {t('Energi', 'Energy')} {dayLabel}
                </th>
                <th>
                  {t('Vann', 'Water')} {dayLabel}
                </th>
                <th>{t('7 dager før', 'Previous 7 days')}</th>
                <th>{t('Sist logget', 'Last logged')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.profile.id} className="clickable" onClick={() => navigate(`/users/${r.profile.id}`)}>
                  <td>
                    <div className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
                      <Avatar name={r.profile.display_name} id={r.profile.id} />
                      <div>
                        <Link to={`/users/${r.profile.id}`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--text)' }}>
                          {r.profile.display_name}
                        </Link>
                        <div className="faint small">
                          {ROLE_LABELS[r.profile.role]}
                          {r.team ? ` · ${r.team.name}` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ minWidth: 170 }}>
                    <Meter value={r.dayKcal} goal={r.goals.goal_kcal} unit="kcal" color="var(--series-kcal)" />
                  </td>
                  <td style={{ minWidth: 160 }}>
                    <Meter value={r.dayWater} goal={r.goals.goal_water_ml} unit="ml" color="var(--series-water)" />
                  </td>
                  <td>
                    <StatusStrip days={r.history} small />
                    <div className="faint small" style={{ marginTop: 4 }}>
                      {t(`Logget ${r.daysLogged} av 7`, `Logged ${r.daysLogged} of 7`)}
                    </div>
                  </td>
                  <td>
                    <span className={`pill ${r.daysSinceMeal === 0 ? 'ok' : r.daysSinceMeal >= 3 ? 'warn' : ''}`}>
                      {lastLoggedText(r.lastMealAt, todayIso)}
                    </span>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                    {query ? t(`Ingen treff på «${query}».`, `No results for “${query}”.`) : t('Ingen aktive brukere passer filteret.', 'No active users match the filter.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <SystemStatus todayIso={todayIso} />
    </div>
  );
}
