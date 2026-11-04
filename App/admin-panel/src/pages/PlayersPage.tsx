// SPILLERE (route /players, coach dashboard): the players on the coach's
// teams, one card per team (the coach sketch's player list). Per player:
// when they last logged, the last 7 full days against their goals,
// yesterday's status, and the latest weight and height. Click a player to
// open their page.
//
// RLS returns only the coach's own (active) players; the team cards follow
// the coach's assignments (coach_teams). Search and sort are kept per browser.

import { ChevronRight, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useAuth } from '../auth/auth-context';
import { StatusStrip, type StripDay } from '../components/StatusStrip';
import { Avatar, PageHeader, Segmented, StatusLabel } from '../components/ui';
import { fetchLatestMeasurements, type Latest } from '../lib/body-api';
import { addDaysIso, formatNumber, lastLoggedText, toISODate } from '../lib/format';
import { locale, t } from '../lib/i18n';
import { usePersistentState } from '../lib/persist';
import { computeStatus } from '../lib/status';
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
import { PROFILE_COLUMNS, type Profile } from '../lib/types';

type SortMode = 'name' | 'recent' | 'attention';

type PageData = {
  players: Profile[];
  goals: AllGoals;
  summary: DaySummary[];
  activity: LastActivity[];
  latest: Map<string, Latest>;
};

async function fetchPlayers(fromIso: string, toIso: string): Promise<PageData> {
  const [players, goals, summary, activity, latest] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLUMNS).eq('role', 'player').eq('is_active', true).order('display_name'),
    fetchAllGoals(),
    fetchDailySummary(fromIso, toIso),
    fetchLastActivity(),
    fetchLatestMeasurements().catch(() => new Map<string, Latest>()),
  ]);
  if (players.error) throw players.error;
  return { players: (players.data ?? []) as Profile[], goals, summary, activity, latest };
}

const longDay = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });

export function PlayersPage() {
  const navigate = useNavigate();
  const { coachTeamIds } = useAuth();
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = usePersistentState<SortMode>('players-sort', 'name');

  // The clock is read once, when the page opens. The 7 days = the last full days.
  const [todayIso] = useState(() => toISODate(new Date()));
  const yesterday = addDaysIso(todayIso, -1);
  const fromIso = addDaysIso(todayIso, -7);

  useEffect(() => {
    let cancelled = false;
    fetchPlayers(fromIso, yesterday)
      .then((result) => !cancelled && setData(result))
      .catch((e) => !cancelled && setError(e.message ?? String(e)));
    return () => {
      cancelled = true;
    };
  }, [fromIso, yesterday]);

  if (error) return <p className="error">{t('Kunne ikke hente spillerne', "Couldn't load the players")}: {error}</p>;
  if (!data) return <p className="muted">{t('Laster spillere…', 'Loading players…')}</p>;

  const days = daysBetween(new Date(`${fromIso}T12:00`), new Date(`${yesterday}T12:00`));
  const byUserDay = new Map(data.summary.map((s) => [`${s.user_id}|${s.day}`, s]));
  const lastMeal = new Map(data.activity.map((a) => [a.user_id, a.last_meal_at]));

  const rows = data.players.map((p) => {
    const team = p.team_id ? data.goals.teams.get(p.team_id) : undefined;
    const goals = effectiveGoals(data.goals.defaults, data.goals.byUser.get(p.id), team);
    const history: StripDay[] = days.map((iso) => {
      const s = byUserDay.get(`${p.id}|${iso}`);
      return { key: iso, title: longDay(iso), status: computeStatus(s?.kcal ?? 0, s?.water_ml ?? 0, goals.goal_kcal, goals.goal_water_ml) };
    });
    const lastMealAt = lastMeal.get(p.id) ?? null;
    const daysSince = lastMealAt
      ? Math.round((new Date(todayIso).getTime() - new Date(toISODate(new Date(lastMealAt))).getTime()) / 86_400_000)
      : Infinity;
    return {
      profile: p,
      history,
      yesterdayStatus: history[history.length - 1].status!,
      daysLogged: history.filter((h) => h.status !== 'gray').length,
      redDays: history.filter((h) => h.status === 'red').length,
      lastMealAt,
      daysSince,
      latest: data.latest.get(p.id),
    };
  });

  const q = query.trim().toLowerCase();
  const sorted = rows
    .filter((r) => r.profile.display_name.toLowerCase().includes(q))
    .sort((a, b) => {
      const byName = a.profile.display_name.localeCompare(b.profile.display_name, 'nb');
      if (sortMode === 'name') return byName;
      if (sortMode === 'recent') return a.daysSince - b.daysSince || byName;
      return b.daysSince - a.daysSince || b.redDays - a.redDays || byName; // "attention"
    });

  // One card per team the coach coaches, in the club's team order.
  const teams = [...data.goals.teams.values()]
    .filter((team) => coachTeamIds.includes(team.id))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'nb'));

  return (
    <div className="stack-lg">
      <PageHeader
        title={t('Spillere', 'Players')}
        subtitle={t(`${rows.length} spillere på lagene dine`, `${rows.length} players on your teams`)}
      />

      {teams.length === 0 ? (
        <section className="card">
          <p className="muted" style={{ margin: 0 }}>
            {t(
              'Du er ikke satt opp som trener for noe lag ennå. Be en administrator legge deg til under «Lag».',
              "You haven't been set up as a coach for any team yet. Ask an administrator to add you under “Teams”.",
            )}
          </p>
        </section>
      ) : (
        <>
          {/* One filter row, above everything it scopes */}
          <div className="row spread">
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
                  { value: 'name', label: t('Navn (A–Å)', 'Name (A–Z)') },
                  { value: 'recent', label: t('Nylig aktive', 'Recently active') },
                  { value: 'attention', label: t('Trenger oppfølging', 'Needs follow-up') },
                ]}
              />
            </div>
          </div>

          {teams.map((team) => {
            const members = sorted.filter((r) => r.profile.team_id === team.id);
            const total = rows.filter((r) => r.profile.team_id === team.id).length;
            return (
              <section key={team.id} className="card flush">
                <div className="row spread" style={{ padding: '16px 20px 4px' }}>
                  <h2>{team.name}</h2>
                  <span className="faint small">{t(`${total} spillere`, `${total} players`)}</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t('Navn', 'Name')}</th>
                        <th>{t('Sist logget', 'Last logged')}</th>
                        <th>{t('Siste 7 dager', 'Last 7 days')}</th>
                        <th>{t('I går', 'Yesterday')}</th>
                        <th className="num">{t('Vekt', 'Weight')}</th>
                        <th className="num">{t('Høyde', 'Height')}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((r) => (
                        <tr key={r.profile.id} className="clickable" onClick={() => navigate(`/users/${r.profile.id}`)}>
                          <td>
                            <div className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
                              <Avatar name={r.profile.display_name} id={r.profile.id} />
                              <Link to={`/users/${r.profile.id}`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--text)' }}>
                                {r.profile.display_name}
                              </Link>
                            </div>
                          </td>
                          <td>
                            <span className={`pill ${r.daysSince === 0 ? 'ok' : r.daysSince >= 3 ? 'warn' : ''}`}>{lastLoggedText(r.lastMealAt, todayIso)}</span>
                          </td>
                          <td>
                            <StatusStrip days={r.history} small />
                            <div className="faint small" style={{ marginTop: 4 }}>
                              {t(`Logget ${r.daysLogged} av 7`, `Logged ${r.daysLogged} of 7`)}
                            </div>
                          </td>
                          <td>
                            <StatusLabel status={r.yesterdayStatus} />
                          </td>
                          <td className="num">
                            {r.latest?.weightKg != null ? (
                              <>
                                {formatNumber(r.latest.weightKg, 1)} kg
                                <div className="faint small">
                                  {new Date(`${r.latest.weightOn}T12:00`).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}
                                </div>
                              </>
                            ) : (
                              <span className="faint">–</span>
                            )}
                          </td>
                          <td className="num">{r.latest?.heightCm != null ? `${formatNumber(r.latest.heightCm)} cm` : <span className="faint">–</span>}</td>
                          <td>
                            <ChevronRight size={16} className="faint" />
                          </td>
                        </tr>
                      ))}
                      {members.length === 0 && (
                        <tr>
                          <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                            {q
                              ? t(`Ingen treff på «${query}» på dette laget.`, `No results for “${query}” on this team.`)
                              : t('Ingen aktive spillere på laget ennå. En administrator legger spillere på laget under Brukere.', 'No active players on the team yet. An administrator puts players on the team under Users.')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
          <p className="faint small" style={{ margin: 0 }}>
            {t(
              'Siste 7 dager = hele dager (i dag ikke med), én rute per dag mot spillerens mål for energi og vann. Vekt og høyde = siste registrering.',
              "Last 7 days = whole days (today not included), one square per day against the player's energy and water goals. Weight and height = the latest entry.",
            )}
          </p>
        </>
      )}
    </div>
  );
}
