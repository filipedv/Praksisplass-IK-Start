// ONE PLAYER (route /users/:id) — everything an admin needs about one person:
//   - who they are (name, role, email, last login)
//   - their goals, editable ("Juster mål")
//   - a date range filter that scopes EVERYTHING below it
//   - key numbers, kcal + water per day vs goal, goal status per day
//   - one selected day in detail (totals vs goals, the meals)
//   - a day-by-day table with every number (the charts' table view)
//
// Reading another user's data works only because RLS lets active admins.
// Meals are view-only here (editing other users' meals is a later session).

import { ArrowLeft, ChevronLeft, ChevronRight, Droplet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

import { ColumnChart } from '../components/ColumnChart';
import { GoalsCard } from '../components/GoalsCard';
import { StatusStrip } from '../components/StatusStrip';
import { Avatar, Meter, PageHeader, Segmented, StatTile, StatusLabel } from '../components/ui';
import { listAccounts, type AccountInfo } from '../lib/admin-users';
import { addDaysIso, formatDateTime, formatNumber, formatTime, toISODate } from '../lib/format';
import { computeStatus, type Status } from '../lib/status';
import {
  daysBetween,
  effectiveGoals,
  fetchAllGoals,
  fetchDailySummary,
  type DaySummary,
  type Goals,
  type PlayerGoalsRow,
} from '../lib/summary-api';
import { supabase } from '../lib/supabase';
import { ROLE_LABELS, type Meal, type Profile } from '../lib/types';

const RANGES = [7, 14, 30, 90] as const;
type Range = (typeof RANGES)[number];

type PageData = {
  requestKey: string; // which player/range/reload this data belongs to
  user: Profile | null;
  account: AccountInfo | undefined;
  defaults: Goals;
  own: PlayerGoalsRow | undefined;
  summary: DaySummary[];
};

async function fetchPageData(id: string, fromIso: string, toIso: string, requestKey: string): Promise<PageData> {
  const [profile, goals, summary, accounts] = await Promise.all([
    supabase.from('profiles').select('id, display_name, role, is_active, created_at').eq('id', id).maybeSingle(),
    fetchAllGoals(),
    fetchDailySummary(fromIso, toIso, id),
    listAccounts(),
  ]);
  if (profile.error) throw profile.error;
  return {
    requestKey,
    user: profile.data as Profile | null,
    account: accounts.data?.find((a) => a.id === id),
    defaults: goals.defaults,
    own: goals.byUser.get(id),
    summary,
  };
}

/** The meals of one local day, with items. */
async function fetchDayMeals(userId: string, dayIso: string): Promise<Meal[]> {
  const start = new Date(`${dayIso}T00:00:00`); // local midnight
  const end = new Date(start);
  end.setDate(end.getDate() + 1); // next local midnight (correct on 23/25-hour DST days too)
  const { data, error } = await supabase
    .from('meals')
    .select('id, eaten_at, recognizer, meal_items (id, food_name, amount_g, nutrition, detected_label)')
    .eq('user_id', userId)
    .gte('eaten_at', start.toISOString())
    .lt('eaten_at', end.toISOString())
    .order('eaten_at');
  if (error) throw error;
  return ((data ?? []) as Meal[]).map((m) => ({ ...m, meal_items: m.meal_items.map((i) => ({ ...i, amount_g: Number(i.amount_g) })) }));
}

const longDay = (iso: string) => {
  const s = new Date(`${iso}T12:00`).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function PlayerPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [range, setRange] = useState<Range>(14);
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Read the clock once when the page opens (not on every render).
  const [todayIso] = useState(() => toISODate(new Date()));
  const fromIso = addDaysIso(todayIso, -(range - 1));
  const [selectedDay, setSelectedDay] = useState(todayIso);
  const [dayMeals, setDayMeals] = useState<Meal[] | null>(null);

  // Page data: reload when the player, the range, or saved goals change.
  // While a new request runs we keep showing the previous data, dimmed —
  // "loading" simply means "the data on screen is for another request".
  const requestKey = `${id}|${fromIso}|${todayIso}|${reloadKey}`;
  const loading = data?.requestKey !== requestKey;
  useEffect(() => {
    let cancelled = false;
    fetchPageData(id, fromIso, todayIso, requestKey)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e.message ?? String(e)));
    return () => {
      cancelled = true;
    };
  }, [id, fromIso, todayIso, requestKey]);

  // The selected day's meals.
  useEffect(() => {
    let cancelled = false;
    fetchDayMeals(id, selectedDay)
      .then((meals) => !cancelled && setDayMeals(meals))
      .catch(() => !cancelled && setDayMeals([]));
    return () => {
      cancelled = true;
    };
  }, [id, selectedDay]);

  if (error && !data) return <p className="error">Kunne ikke hente data: {error}</p>;
  if (!data) return <p className="muted">Laster…</p>;
  if (!data.user) {
    return (
      <div className="stack">
        <Link to="/users">← Brukere</Link>
        <p className="error">Fant ikke brukeren.</p>
      </div>
    );
  }

  const user = data.user;
  const goals = effectiveGoals(data.defaults, data.own);
  const byDay = new Map(data.summary.map((s) => [s.day, s]));
  const days = daysBetween(new Date(`${fromIso}T12:00`), new Date(`${todayIso}T12:00`));

  // Per day: totals + status. Today is still in progress → no status yet.
  const perDay = days.map((day) => {
    const s = byDay.get(day);
    const status: Status | null =
      day === todayIso ? null : computeStatus(s?.kcal ?? 0, s?.water_ml ?? 0, goals.goal_kcal, goals.goal_water_ml);
    return { day, s, status };
  });
  const complete = perDay.filter((d) => d.status !== null);
  const logged = complete.filter((d) => d.status !== 'gray');
  const avg = (pick: (s: DaySummary) => number) =>
    logged.length ? logged.reduce((sum, d) => sum + (d.s ? pick(d.s) : 0), 0) / logged.length : 0;
  const avgWaterAll = complete.length ? complete.reduce((sum, d) => sum + (d.s?.water_ml ?? 0), 0) / complete.length : 0;

  const shortLabel = (iso: string) => `${Number(iso.slice(8, 10))}.`;
  const chartData = (pick: (s: DaySummary) => number) =>
    days.map((day) => ({ key: day, label: shortLabel(day), title: longDay(day), value: byDay.get(day) ? pick(byDay.get(day)!) : 0 }));

  const sel = byDay.get(selectedDay);
  const shiftDay = (delta: number) => {
    const next = addDaysIso(selectedDay, delta);
    if (next <= todayIso) setSelectedDay(next);
  };

  return (
    <div className="stack-lg">
      <Link to="/" className="row muted" style={{ gap: 6 }}>
        <ArrowLeft size={15} /> Oversikt
      </Link>

      <PageHeader
        title={
          <span className="row" style={{ gap: 16 }}>
            <Avatar name={user.display_name} id={user.id} large />
            <span>
              {user.display_name}
              <span className="row" style={{ gap: 8, marginTop: 6 }}>
                <span className="pill">{ROLE_LABELS[user.role]}</span>
                <span className={`pill ${user.is_active ? 'ok' : 'off'}`}>{user.is_active ? 'Aktiv' : 'Deaktivert'}</span>
              </span>
            </span>
          </span>
        }
        actions={
          <div className="stack" style={{ gap: 2, textAlign: 'right' }}>
            <span className="muted">{data.account?.email ?? ''}</span>
            <span className="faint small">
              Sist innlogget {data.account?.last_sign_in_at ? formatDateTime(data.account.last_sign_in_at) : 'aldri'}
            </span>
            <Link to="/users" className="small">
              Rediger konto under Brukere
            </Link>
          </div>
        }
      />

      {/* One filter row, above everything it scopes */}
      <div className="row">
        <Segmented
          label="Periode"
          value={range}
          onChange={setRange}
          options={RANGES.map((r) => ({ value: r, label: `${r} dager` }))}
        />
        <span className="faint small">
          {longDay(fromIso)} – i dag {loading ? '· oppdaterer…' : ''}
        </span>
      </div>

      <div className="kpi-row">
        <StatTile
          label="Snitt energi per logget dag"
          value={formatNumber(avg((s) => s.kcal))}
          unit="kcal"
          sub={`Mål ${goals.goal_kcal.toLocaleString('nb-NO')} kcal`}
        />
        <StatTile label="Snitt vann per dag" value={formatNumber(avgWaterAll)} unit="ml" sub={`Mål ${goals.goal_water_ml.toLocaleString('nb-NO')} ml`} />
        <StatTile label="Dager logget" value={logged.length} unit={`av ${complete.length}`} sub="Hele dager (i dag ikke med)" />
        <StatTile label="Dager med nådd mål" value={complete.filter((d) => d.status === 'green').length} unit={`av ${complete.length}`} />
      </div>

      <div className="two-col">
        <div className="stack-lg">
          <section className="card">
            <div className="card-header">
              <h2>Energi per dag</h2>
              <span className="faint small">kcal · klikk en dag for detaljer</span>
            </div>
            <ColumnChart
              ariaLabel="Energi per dag i kcal"
              data={chartData((s) => s.kcal)}
              unit="kcal"
              color="var(--series-kcal)"
              goal={goals.goal_kcal}
              loading={loading}
              selectedKey={selectedDay}
              onSelect={setSelectedDay}
            />
          </section>
          <section className="card">
            <div className="card-header">
              <h2>Vann per dag</h2>
              <span className="faint small">ml</span>
            </div>
            <ColumnChart
              ariaLabel="Vann per dag i milliliter"
              data={chartData((s) => s.water_ml)}
              unit="ml"
              color="var(--series-water)"
              goal={goals.goal_water_ml}
              height={160}
              loading={loading}
              selectedKey={selectedDay}
              onSelect={setSelectedDay}
            />
          </section>
        </div>

        <div className="stack-lg">
          <GoalsCard
            key={`${user.id}:${reloadKey}`}
            userId={user.id}
            playerName={user.display_name}
            defaults={data.defaults}
            own={data.own}
            onSaved={() => setReloadKey((k) => k + 1)}
          />
          <section className="card">
            <div className="card-header">
              <h2>Måloppnåelse</h2>
              <span className="faint small">Energi + vann mot mål</span>
            </div>
            <StatusStrip
              days={perDay.map((d) => ({ key: d.day, title: longDay(d.day), status: d.status }))}
              selectedKey={selectedDay}
              onSelect={setSelectedDay}
              showLegend
            />
            <p className="faint small" style={{ margin: '12px 0 0' }}>
              Én rute per dag, eldst til venstre. I dag (åpen rute) telles først når dagen er over.
            </p>
          </section>
        </div>
      </div>

      {/* ---- The selected day in detail ---- */}
      <section className="card">
        <div className="card-header">
          <div className="row" style={{ gap: 6 }}>
            <button className="small ghost" onClick={() => shiftDay(-1)} aria-label="Forrige dag">
              <ChevronLeft size={16} />
            </button>
            <h2 style={{ minWidth: 190, textAlign: 'center' }}>{selectedDay === todayIso ? 'I dag' : longDay(selectedDay)}</h2>
            <button className="small ghost" onClick={() => shiftDay(1)} disabled={selectedDay >= todayIso} aria-label="Neste dag">
              <ChevronRight size={16} />
            </button>
          </div>
          {selectedDay !== todayIso && (
            <StatusLabel status={computeStatus(sel?.kcal ?? 0, sel?.water_ml ?? 0, goals.goal_kcal, goals.goal_water_ml)} />
          )}
        </div>

        <div className="grid-3">
          <div className="stack" style={{ gap: 12 }}>
            <Meter label="Energi" value={sel?.kcal ?? 0} goal={goals.goal_kcal} unit="kcal" color="var(--series-kcal)" />
            <Meter label="Protein" value={sel?.protein_g ?? 0} goal={goals.goal_protein_g} unit="g" color="var(--text-2)" />
            <Meter label="Karbohydrater" value={sel?.carbs_g ?? 0} goal={goals.goal_carbs_g} unit="g" color="var(--text-2)" />
            <Meter label="Fett" value={sel?.fat_g ?? 0} goal={goals.goal_fat_g} unit="g" color="var(--text-2)" />
            <div className="row" style={{ gap: 8, marginTop: 4 }}>
              <Droplet size={15} color="var(--series-water)" />
              <div style={{ flex: 1 }}>
                <Meter label="Vann" value={sel?.water_ml ?? 0} goal={goals.goal_water_ml} unit="ml" color="var(--series-water)" />
              </div>
            </div>
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            {dayMeals === null ? (
              <p className="muted">Laster måltider…</p>
            ) : dayMeals.length === 0 ? (
              <p className="muted">Ingen måltider registrert denne dagen.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tid</th>
                      <th>Matvare</th>
                      <th className="num">Mengde</th>
                      <th className="num">kcal</th>
                      <th className="num">Protein</th>
                      <th className="num">Karbo</th>
                      <th className="num">Fett</th>
                      <th>Kilde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayMeals.flatMap((meal) =>
                      meal.meal_items.map((item, i) => (
                        <tr key={item.id}>
                          <td className="faint">{i === 0 ? formatTime(meal.eaten_at) : ''}</td>
                          <td>{item.food_name}</td>
                          <td className="num">{formatNumber(item.amount_g)} g</td>
                          <td className="num">{formatNumber(item.nutrition.energy_kcal)}</td>
                          <td className="num">{formatNumber(item.nutrition.protein_g, 1)}</td>
                          <td className="num">{formatNumber(item.nutrition.carbs_g, 1)}</td>
                          <td className="num">{formatNumber(item.nutrition.fat_g, 1)}</td>
                          <td className="faint small">{item.detected_label ? (meal.recognizer ?? 'gjenkjent') : 'manuelt'}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---- Table view: every number behind the charts ---- */}
      <section className="card flush">
        <div style={{ padding: '16px 20px 4px' }}>
          <h2>Dag for dag</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dag</th>
                <th>Status</th>
                <th className="num">Måltider</th>
                <th className="num">kcal</th>
                <th className="num">Protein (g)</th>
                <th className="num">Karbo (g)</th>
                <th className="num">Fett (g)</th>
                <th className="num">Vann (ml)</th>
              </tr>
            </thead>
            <tbody>
              {[...perDay].reverse().map(({ day, s, status }) => (
                <tr key={day} className={`clickable ${day === selectedDay ? 'selected' : ''}`} onClick={() => setSelectedDay(day)}>
                  <td>{day === todayIso ? 'I dag' : longDay(day)}</td>
                  <td>{status ? <StatusLabel status={status} /> : <span className="faint small">Pågår</span>}</td>
                  <td className="num">{s?.meals ?? 0}</td>
                  <td className="num">{formatNumber(s?.kcal ?? 0)}</td>
                  <td className="num">{formatNumber(s?.protein_g ?? 0)}</td>
                  <td className="num">{formatNumber(s?.carbs_g ?? 0)}</td>
                  <td className="num">{formatNumber(s?.fat_g ?? 0)}</td>
                  <td className="num">{(s?.water_ml ?? 0).toLocaleString('nb-NO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
