// OVERSIKT — the admin's start page. Answers, in this order:
//   1. Key numbers (stat tiles): how many are active, logged today, logging habit, recognition.
//   2. "Trenger oppfølging": concrete reasons to talk to someone (from the coach sketch).
//   3. Yesterday's goal status for the whole group (yesterday = the last FULL day;
//      a live "today" status would show almost everyone red in the morning).
//   4. One row per person: today vs. goal, the last 7 days, when they last logged.
//
// All data is read through RLS as the logged-in admin. Sums come from the
// daily_summary() SQL function.

import { Clock, Search, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { StatusStrip, type StripDay } from '../components/StatusStrip';
import { Avatar, Meter, PageHeader, Segmented, StatTile, StatusIcon } from '../components/ui';
import { addDaysIso, formatNumber, toISODate } from '../lib/format';
import { STATUS_COLORS, STATUS_LABELS, STATUS_ORDER, computeStatus, type Status } from '../lib/status';
import {
  daysBetween,
  effectiveGoals,
  fetchAllGoals,
  fetchDailySummary,
  fetchLastActivity,
  type DaySummary,
  type Goals,
  type LastActivity,
} from '../lib/summary-api';
import { supabase } from '../lib/supabase';
import { ROLE_LABELS, type Profile } from '../lib/types';

const DAY_MS = 86_400_000;

type OverviewData = {
  profiles: Profile[];
  defaults: Goals;
  goalsByUser: Awaited<ReturnType<typeof fetchAllGoals>>['byUser'];
  summary: DaySummary[];
  activity: LastActivity[];
  matchRate: { labels: number; unmatched: number };
};

/** Everything the page needs, fetched in parallel. */
async function fetchOverview(fromIso: string, toIso: string): Promise<OverviewData> {
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const [profiles, goals, summary, activity, events] = await Promise.all([
    supabase.from('profiles').select('id, display_name, role, is_active, created_at').eq('is_active', true).order('display_name'),
    fetchAllGoals(),
    fetchDailySummary(fromIso, toIso),
    fetchLastActivity(),
    supabase.from('recognition_events').select('labels, unmatched_labels').gte('created_at', since).limit(2000),
  ]);
  if (profiles.error) throw profiles.error;
  const matchRate = { labels: 0, unmatched: 0 };
  for (const e of events.data ?? []) {
    matchRate.labels += e.labels.length;
    matchRate.unmatched += e.unmatched_labels.length;
  }
  return {
    profiles: (profiles.data ?? []) as Profile[],
    defaults: goals.defaults,
    goalsByUser: goals.byUser,
    summary,
    activity,
    matchRate,
  };
}

/** "I dag 12:30", "I går", "for 4 dager siden", "Aldri". */
function lastLoggedText(iso: string | null): string {
  if (!iso) return 'Aldri';
  const then = new Date(iso);
  const days = Math.round((new Date(toISODate(new Date())).getTime() - new Date(toISODate(then)).getTime()) / DAY_MS);
  if (days === 0) return `I dag ${then.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`;
  if (days === 1) return 'I går';
  return `For ${days} dager siden`;
}

type SortMode = 'attention' | 'name' | 'recent';
type RoleFilter = 'all' | 'player';

export function OverviewPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('attention');
  // During the internal test most of us are admins, so show everyone by default.
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  // The window: the last 7 FULL days + today. The clock is read once, when the page opens.
  const [today] = useState(() => new Date());
  const todayIso = toISODate(today);
  const fromIso = addDaysIso(todayIso, -7);

  useEffect(() => {
    let cancelled = false;
    fetchOverview(fromIso, todayIso)
      .then((result) => !cancelled && setData(result))
      .catch((e) => !cancelled && setError(e.message ?? String(e)));
    return () => {
      cancelled = true;
    };
  }, [fromIso, todayIso]);

  // ---- Derive one row per person (memoised: only recomputed when data changes) ----
  const rows = useMemo(() => {
    if (!data) return [];
    const pastDays = daysBetween(new Date(`${fromIso}T12:00`), new Date(`${addDaysIso(todayIso, -1)}T12:00`)); // 7 full days
    const byUserDay = new Map(data.summary.map((s) => [`${s.user_id}|${s.day}`, s]));
    const activity = new Map(data.activity.map((a) => [a.user_id, a]));

    return data.profiles.map((p) => {
      const goals = effectiveGoals(data.defaults, data.goalsByUser.get(p.id));
      const todaySum = byUserDay.get(`${p.id}|${todayIso}`);
      const history: StripDay[] = pastDays.map((day) => {
        const s = byUserDay.get(`${p.id}|${day}`);
        return {
          key: day,
          title: new Date(`${day}T12:00`).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }),
          status: computeStatus(s?.kcal ?? 0, s?.water_ml ?? 0, goals.goal_kcal, goals.goal_water_ml),
        };
      });
      const lastMealAt = activity.get(p.id)?.last_meal_at ?? null;
      const daysSinceMeal = lastMealAt
        ? Math.round((new Date(todayIso).getTime() - new Date(toISODate(new Date(lastMealAt))).getTime()) / DAY_MS)
        : Infinity;
      return {
        profile: p,
        goals,
        todayKcal: todaySum?.kcal ?? 0,
        todayWater: todaySum?.water_ml ?? 0,
        history,
        yesterday: history[history.length - 1]?.status ?? 'gray',
        daysLogged: history.filter((h) => h.status !== 'gray').length,
        redDays: history.filter((h) => h.status === 'red').length,
        lastMealAt,
        daysSinceMeal,
      };
    });
  }, [data, fromIso, todayIso]);

  if (error) return <p className="error">Kunne ikke hente oversikten: {error}</p>;
  if (!data) return <p className="muted">Laster oversikt…</p>;

  const visible = rows.filter((r) => roleFilter === 'all' || r.profile.role === 'player');

  // ---- "Trenger oppfølging": concrete, prioritised reasons (from the coach sketch) ----
  const todos: { id: string; userId: string; icon: 'clock' | 'alert'; text: string; priority: number }[] = [];
  for (const r of visible) {
    const name = r.profile.display_name;
    if (r.daysSinceMeal === Infinity) {
      todos.push({ id: `never:${r.profile.id}`, userId: r.profile.id, icon: 'clock', priority: 300, text: `${name} har aldri logget et måltid.` });
    } else if (r.daysSinceMeal >= 3) {
      todos.push({
        id: `logging:${r.profile.id}`,
        userId: r.profile.id,
        icon: 'clock',
        priority: 100 + r.daysSinceMeal,
        text: `${name} har ikke logget på ${r.daysSinceMeal} dager.`,
      });
    }
    if (r.redDays >= 4) {
      todos.push({
        id: `nutrition:${r.profile.id}`,
        userId: r.profile.id,
        icon: 'alert',
        priority: 70 + r.redDays,
        text: `${name} har vært langt fra målet ${r.redDays} av de siste 7 dagene.`,
      });
    }
  }
  todos.sort((a, b) => b.priority - a.priority);

  // ---- Group numbers ----
  const loggedToday = visible.filter((r) => r.todayKcal > 0).length;
  const avgDaysLogged = visible.length ? visible.reduce((s, r) => s + r.daysLogged, 0) / visible.length : 0;
  const yesterdayCounts: Record<Status, number> = { gray: 0, red: 0, orange: 0, green: 0 };
  for (const r of visible) yesterdayCounts[r.yesterday] += 1;
  const matched = data.matchRate.labels ? 1 - data.matchRate.unmatched / data.matchRate.labels : null;

  // ---- Table: search + sort ----
  const filtered = visible.filter((r) => r.profile.display_name.toLowerCase().includes(query.trim().toLowerCase()));
  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'name') return a.profile.display_name.localeCompare(b.profile.display_name, 'nb');
    if (sortMode === 'recent') return (a.daysSinceMeal - b.daysSinceMeal) || a.profile.display_name.localeCompare(b.profile.display_name, 'nb');
    // "attention": longest without logging first, then most red days
    return b.daysSinceMeal - a.daysSinceMeal || b.redDays - a.redDays || a.profile.display_name.localeCompare(b.profile.display_name, 'nb');
  });

  return (
    <div className="stack-lg">
      <PageHeader
        title="Oversikt"
        subtitle={today.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={
          <Segmented
            label="Hvem vises"
            value={roleFilter}
            onChange={setRoleFilter}
            options={[
              { value: 'all', label: 'Alle aktive' },
              { value: 'player', label: 'Kun spillere' },
            ]}
          />
        }
      />

      <div className="kpi-row">
        <StatTile label="Aktive brukere" value={visible.length} sub={roleFilter === 'player' ? 'Rolle: spiller' : 'Alle roller'} />
        <StatTile label="Logget i dag" value={loggedToday} unit={`av ${visible.length}`} sub="Minst ett måltid i dag" />
        <StatTile label="Logget siste 7 dager" value={formatNumber(avgDaysLogged, 1)} unit="av 7 dager" sub="Snitt per bruker" />
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
              Ingen å følge opp nå — alle har logget de siste dagene.
            </p>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {todos.map((t) => (
                <Link key={t.id} to={`/users/${t.userId}`} className="todo">
                  {t.icon === 'clock' ? <Clock size={16} /> : <TriangleAlert size={16} />}
                  <span>{t.text}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <h2>I går</h2>
            <span className="faint small">Hele dagen, mot hver brukers mål</span>
          </div>
          <div className="squad-bar" aria-hidden>
            {STATUS_ORDER.map((s) =>
              yesterdayCounts[s] ? (
                <span key={s} style={{ width: `${(yesterdayCounts[s] / Math.max(visible.length, 1)) * 100}%`, background: STATUS_COLORS[s] }} />
              ) : null,
            )}
          </div>
          <div className="stack" style={{ gap: 8, marginTop: 16 }}>
            {STATUS_ORDER.map((s) => (
              <div key={s} className="row spread">
                <span className="legend-item">
                  <StatusIcon status={s} /> {STATUS_LABELS[s]}
                </span>
                <strong className="num">{yesterdayCounts[s]}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

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
                <th>Energi i dag</th>
                <th>Vann i dag</th>
                <th>Siste 7 dager</th>
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
                        <div className="faint small">{ROLE_LABELS[r.profile.role]}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ minWidth: 170 }}>
                    <Meter value={r.todayKcal} goal={r.goals.goal_kcal} unit="kcal" color="var(--series-kcal)" />
                  </td>
                  <td style={{ minWidth: 160 }}>
                    <Meter value={r.todayWater} goal={r.goals.goal_water_ml} unit="ml" color="var(--series-water)" />
                  </td>
                  <td>
                    <StatusStrip days={r.history} small />
                    <div className="faint small" style={{ marginTop: 4 }}>
                      Logget {r.daysLogged} av 7
                    </div>
                  </td>
                  <td>
                    <span className={`pill ${r.daysSinceMeal === 0 ? 'ok' : r.daysSinceMeal >= 3 ? 'warn' : ''}`}>
                      {lastLoggedText(r.lastMealAt)}
                    </span>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                    {query ? `Ingen treff på «${query}».` : 'Ingen aktive brukere med denne rollen ennå.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
