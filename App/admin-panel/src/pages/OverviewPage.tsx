// OVERSIKT — the admin's start page. Answers, in this order:
//   1. Key numbers (stat tiles) for the chosen day: active, logged, habit, recognition.
//   2. "Trenger oppfølging": concrete reasons to act — not logging, far from
//      goal, and suspicious data (huge amounts) that may need correcting.
//   3. Goal status for the group on one FULL day (yesterday by default; a live
//      "today" status would show almost everyone red in the morning).
//   4. Logging trend per week (last 8 weeks).
//   5. One row per person: the day vs. goal, the 7 days before, last logged.
//   6. System status.
//
// Filters (team, role, sort) are remembered between visits. Everything is
// read through RLS as the logged-in admin; sums come from daily_summary().

import { Clock, Download, Scale, Search, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { ColumnChart } from '../components/ColumnChart';
import { IMPLAUSIBLE_ITEM_G } from '../components/DayMealsTable';
import { StatusStrip, type StripDay } from '../components/StatusStrip';
import { SystemStatus } from '../components/SystemStatus';
import { Avatar, Meter, PageHeader, Segmented, StatTile, StatusIcon } from '../components/ui';
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

const DAY_MS = 86_400_000;
const TREND_WEEKS = 8;
/** A day above this many kcal is flagged as "check this" (probably a typo). */
const IMPLAUSIBLE_DAY_KCAL = 7000;

type BigItem = { user_id: string; eaten_at: string; food_name: string; amount_g: number };

type OverviewData = {
  requestKey: string;
  profiles: Profile[];
  goals: AllGoals;
  summary: DaySummary[];
  activity: LastActivity[];
  bigItems: BigItem[];
  matchRate: { labels: number; unmatched: number };
};

/** Everything the page needs, fetched in parallel. */
async function fetchOverview(fromIso: string, toIso: string, flagsFromIso: string, requestKey: string): Promise<OverviewData> {
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const [profiles, goals, summary, activity, events, items] = await Promise.all([
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
  };
}

const longDay = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
const shortDay = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });

/** "I dag 12:30", "I går", "for 4 dager siden", "Aldri" (relative to the real today). */
function lastLoggedText(iso: string | null, todayIso: string): string {
  if (!iso) return 'Aldri';
  const then = new Date(iso);
  const days = Math.round((new Date(todayIso).getTime() - new Date(toISODate(then)).getTime()) / DAY_MS);
  if (days === 0) return `I dag ${then.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`;
  if (days === 1) return 'I går';
  return `For ${days} dager siden`;
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

  if (error) return <p className="error">Kunne ikke hente oversikten: {error}</p>;
  if (!data) return <p className="muted">Laster oversikt…</p>;

  const teams = [...data.goals.teams.values()];
  const visible = rows.filter(
    (r) =>
      (roleFilter === 'all' || r.profile.role === 'player') &&
      (teamFilter === 'all' || (teamFilter === 'none' ? !r.profile.team_id : r.profile.team_id === teamFilter)),
  );
  const visibleIds = new Set(visible.map((r) => r.profile.id));
  const nameOf = new Map(data.profiles.map((p) => [p.id, p.display_name]));

  // ---- "Trenger oppfølging": concrete, prioritised reasons ----
  type Todo = { id: string; userId: string; icon: 'clock' | 'alert' | 'data'; text: string; priority: number };
  const todos: Todo[] = [];
  for (const r of visible) {
    const name = r.profile.display_name;
    if (r.daysSinceMeal === Infinity) {
      todos.push({ id: `never:${r.profile.id}`, userId: r.profile.id, icon: 'clock', priority: 300, text: `${name} har aldri logget et måltid.` });
    } else if (r.daysSinceMeal >= 3) {
      todos.push({ id: `logging:${r.profile.id}`, userId: r.profile.id, icon: 'clock', priority: 100 + r.daysSinceMeal, text: `${name} har ikke logget på ${r.daysSinceMeal} dager.` });
    }
    if (r.redDays >= 4) {
      todos.push({ id: `nutrition:${r.profile.id}`, userId: r.profile.id, icon: 'alert', priority: 70 + r.redDays, text: `${name} har vært langt fra målet ${r.redDays} av de 7 siste dagene.` });
    }
  }
  // Data quality: single items over 1 kg, and whole days over 7000 kcal.
  for (const item of data.bigItems) {
    if (!visibleIds.has(item.user_id)) continue;
    todos.push({
      id: `item:${item.user_id}:${item.eaten_at}:${item.food_name}`,
      userId: item.user_id,
      icon: 'data',
      priority: 200,
      text: `${nameOf.get(item.user_id)}: ${formatNumber(item.amount_g)} g ${item.food_name} (${shortDay(toISODate(new Date(item.eaten_at)))}) — sjekk mengden.`,
    });
  }
  for (const s of data.summary) {
    if (!visibleIds.has(s.user_id) || s.day < historyFrom || s.kcal <= IMPLAUSIBLE_DAY_KCAL) continue;
    todos.push({
      id: `day:${s.user_id}:${s.day}`,
      userId: s.user_id,
      icon: 'data',
      priority: 190,
      text: `${nameOf.get(s.user_id)}: ${formatNumber(s.kcal)} kcal ${shortDay(s.day)} — uvanlig mye, sjekk dagen.`,
    });
  }
  todos.sort((a, b) => b.priority - a.priority);

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
      label: `u${isoWeek(monday)}`,
      title: `Uke fra ${shortDay(monday)}${weekDays.length < 7 ? ' (pågår)' : ''}`,
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
      { header: 'Navn', value: (x) => x.r.profile.display_name },
      { header: 'Lag', value: (x) => x.r.team?.name ?? '' },
      { header: 'Dato', value: (x) => x.iso },
      { header: 'Status', value: (x) => (x.status ? STATUS_LABELS[x.status] : '') },
      { header: 'Energi (kcal)', value: (x) => x.s?.kcal ?? 0 },
      { header: 'Energimål (kcal)', value: (x) => x.r.goals.goal_kcal },
      { header: 'Protein (g)', value: (x) => x.s?.protein_g ?? 0 },
      { header: 'Karbohydrater (g)', value: (x) => x.s?.carbs_g ?? 0 },
      { header: 'Fett (g)', value: (x) => x.s?.fat_g ?? 0 },
      { header: 'Vann (ml)', value: (x) => x.s?.water_ml ?? 0 },
      { header: 'Vannmål (ml)', value: (x) => x.r.goals.goal_water_ml },
    ]);
    const teamName = teamFilter === 'all' ? 'alle' : teamFilter === 'none' ? 'uten-lag' : (data!.goals.teams.get(teamFilter)?.name ?? 'lag');
    downloadFile(`oversikt_${teamName.toLowerCase().replace(/\s+/g, '-')}_${historyFrom}_${addDaysIso(day, -1)}.csv`, csv, 'csv');
  }

  const dayLabel = isToday ? 'i dag' : shortDay(day);

  return (
    <div className="stack-lg">
      <PageHeader
        title="Oversikt"
        subtitle={new Date(`${day}T12:00`).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      />

      {/* One filter row, above everything it scopes */}
      <div className="row" style={{ gap: 10 }}>
        <label className="row" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          Dag
          <input type="date" value={day} max={todayIso} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </label>
        {!isToday && (
          <button className="small ghost" onClick={() => setDay(todayIso)}>
            Til i dag
          </button>
        )}
        <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} aria-label="Lag">
          <option value="all">Alle lag</option>
          <option value="none">Uten lag</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <Segmented
          label="Hvem vises"
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: 'all', label: 'Alle aktive' },
            { value: 'player', label: 'Kun spillere' },
          ]}
        />
        <button className="small" onClick={exportGroup} style={{ marginLeft: 'auto' }}>
          <Download size={13} /> Eksporter 7 dager (CSV)
        </button>
      </div>

      <div className="kpi-row" style={{ opacity: loading ? 0.6 : 1 }}>
        <StatTile label="Aktive brukere" value={visible.length} sub={teamFilter === 'all' ? 'Alle lag' : 'Filtrert på lag'} />
        <StatTile label={`Logget ${dayLabel}`} value={loggedOnDay} unit={`av ${visible.length}`} sub="Minst ett måltid" />
        <StatTile label="Logget, 7 dager før" value={formatNumber(avgDaysLogged, 1)} unit="av 7 dager" sub="Snitt per bruker" />
        <StatTile
          label="Gjenkjenning, siste 30 dager"
          value={matched === null ? '–' : `${formatNumber(matched * 100)} %`}
          sub={matched === null ? 'Ingen bilder ennå' : `${data.matchRate.labels} etiketter`}
        />
      </div>

      <div className="two-col">
        <section className="card">
          <div className="card-header">
            <h2>Trenger oppfølging</h2>
            <span className="faint small">Oppdateres automatisk</span>
          </div>
          {todos.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              Ingen å følge opp nå — alle har logget de siste dagene, og ingen tall ser rare ut.
            </p>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {todos.slice(0, 12).map((t) => (
                <Link key={t.id} to={`/users/${t.userId}`} className="todo">
                  {t.icon === 'clock' ? <Clock size={16} /> : t.icon === 'data' ? <Scale size={16} /> : <TriangleAlert size={16} />}
                  <span>{t.text}</span>
                </Link>
              ))}
              {todos.length > 12 && <span className="faint small">+{todos.length - 12} til</span>}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <h2>{isToday ? 'I går' : shortDay(statusDay)}</h2>
            <span className="faint small">Hele dagen, mot hver brukers mål</span>
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
          <h2>Logging per uke</h2>
          <span className="faint small">Andel av mulige dager med minst ett måltid · siste {TREND_WEEKS} uker</span>
        </div>
        <ColumnChart ariaLabel="Andel loggede dager per uke" data={trend} unit="%" color="var(--primary-hover)" height={160} loading={loading} />
      </section>

      <section className="card flush">
        <div className="row spread" style={{ padding: '16px 20px' }}>
          <div className="search" style={{ width: 280 }}>
            <Search size={15} />
            <input type="search" placeholder="Søk etter navn" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="faint small">Sorter</span>
            <Segmented
              label="Sortering"
              value={sortMode}
              onChange={setSortMode}
              options={[
                { value: 'attention', label: 'Trenger oppfølging' },
                { value: 'name', label: 'Navn (A–Å)' },
                { value: 'recent', label: 'Nylig aktive' },
              ]}
            />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Navn</th>
                <th>Energi {dayLabel}</th>
                <th>Vann {dayLabel}</th>
                <th>7 dager før</th>
                <th>Sist logget</th>
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
                      Logget {r.daysLogged} av 7
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
                    {query ? `Ingen treff på «${query}».` : 'Ingen aktive brukere passer filteret.'}
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
