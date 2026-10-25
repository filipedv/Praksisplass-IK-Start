// ONE PLAYER (route /users/:id) — everything an admin needs about one person:
//   - who they are (name, role, team, email, last login, who created the account)
//   - their goals, editable ("Juster mål"; own → team → club)
//   - a date range filter that scopes EVERYTHING below it (remembered)
//   - key numbers, kcal + water per day vs goal, goal status per day
//   - one selected day in detail, where meal items can be CORRECTED
//   - a day-by-day table with every number (the charts' table view)
//   - weight + height over time, and private staff notes (MeasurementsCard, NotesCard)
//   - exports (CSV, and all data as JSON for GDPR access requests)
//   - recent changes about this player (change log)
//   - danger zone: permanent deletion (GDPR right to erasure)
//
// Reading and correcting another user's data works only because RLS lets
// active admins; corrections are recorded in the change log by the database.

import { ArrowLeft, ChevronLeft, ChevronRight, Download, Droplet, FileJson, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { useAuth } from '../auth/auth-context';
import { ChangeList } from '../components/ChangeList';
import { ColumnChart } from '../components/ColumnChart';
import { DayMealsTable } from '../components/DayMealsTable';
import { GoalsCard } from '../components/GoalsCard';
import { MeasurementsCard } from '../components/MeasurementsCard';
import { NotesCard } from '../components/NotesCard';
import { StatusStrip } from '../components/StatusStrip';
import { Avatar, Meter, PageHeader, Segmented, StatTile, StatusLabel } from '../components/ui';
import { useFeedback } from '../feedback/feedback-context';
import { deleteAccount, listAccounts, type AccountInfo } from '../lib/admin-users';
import { fetchAudit } from '../lib/audit-api';
import { addDaysIso, formatDateTime, formatNumber, toISODate } from '../lib/format';
import { usePersistentState } from '../lib/persist';
import { exportAllDataJson, exportDaysCsv, exportMealsCsv } from '../lib/player-export';
import { STATUS_LABELS, computeStatus, type Status } from '../lib/status';
import {
  daysBetween,
  effectiveGoals,
  fetchAllGoals,
  fetchDailySummary,
  type AllGoals,
  type DaySummary,
} from '../lib/summary-api';
import { supabase } from '../lib/supabase';
import { setUserTeam } from '../lib/teams-api';
import { ROLE_LABELS, type AuditEntry, type Meal, type Profile, PROFILE_COLUMNS } from '../lib/types';
import { locale, t } from '../lib/i18n';

const RANGES = [7, 14, 30, 90] as const;
type Range = (typeof RANGES)[number];

type PageData = {
  requestKey: string; // which player/range/reload this data belongs to
  user: Profile | null;
  account: AccountInfo | undefined;
  goals: AllGoals;
  summary: DaySummary[];
  changes: AuditEntry[];
};

async function fetchPageData(id: string, fromIso: string, toIso: string, requestKey: string): Promise<PageData> {
  const [profile, goals, summary, accounts, changes] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle(),
    fetchAllGoals(),
    fetchDailySummary(fromIso, toIso, id),
    listAccounts(),
    fetchAudit({ subjectUserId: id, limit: 15 }),
  ]);
  if (profile.error) throw profile.error;
  return {
    requestKey,
    user: profile.data as Profile | null,
    account: accounts.data?.find((a) => a.id === id),
    goals,
    summary,
    changes,
  };
}

/** The meals of one local day, with items. */
async function fetchDayMeals(userId: string, dayIso: string): Promise<Meal[]> {
  const start = new Date(`${dayIso}T00:00:00`); // local midnight
  const end = new Date(start);
  end.setDate(end.getDate() + 1); // next local midnight (correct on 23/25-hour DST days too)
  const { data, error } = await supabase
    .from('meals')
    .select('id, eaten_at, recognizer, admin_changed_at, meal_items (id, food_name, amount_g, nutrition, detected_label)')
    .eq('user_id', userId)
    .gte('eaten_at', start.toISOString())
    .lt('eaten_at', end.toISOString())
    .order('eaten_at');
  if (error) throw error;
  return ((data ?? []) as Meal[]).map((m) => ({ ...m, meal_items: m.meal_items.map((i) => ({ ...i, amount_g: Number(i.amount_g) })) }));
}

const longDay = (iso: string) => {
  const s = new Date(`${iso}T12:00`).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function PlayerPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast, confirm } = useFeedback();
  const { profile: me } = useAuth();
  const [range, setRange] = usePersistentState<Range>('player-range', 14);
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);

  // Read the clock once when the page opens (not on every render).
  const [todayIso] = useState(() => toISODate(new Date()));
  const fromIso = addDaysIso(todayIso, -(range - 1));
  const [selectedDay, setSelectedDay] = useState(todayIso);
  const [dayMeals, setDayMeals] = useState<Meal[] | null>(null);

  // Page data: reload when the player, the range, or something saved changes.
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

  // The selected day's meals (reloaded after a correction, via reloadKey).
  useEffect(() => {
    let cancelled = false;
    fetchDayMeals(id, selectedDay)
      .then((meals) => !cancelled && setDayMeals(meals))
      .catch(() => !cancelled && setDayMeals([]));
    return () => {
      cancelled = true;
    };
  }, [id, selectedDay, reloadKey]);

  if (error && !data) return <p className="error">{t('Kunne ikke hente data', "Couldn't load data")}: {error}</p>;
  if (!data) return <p className="muted">{t('Laster…', 'Loading…')}</p>;
  if (!data.user) {
    return (
      <div className="stack">
        <Link to="/users">← {t('Brukere', 'Users')}</Link>
        <p className="error">{t('Fant ikke brukeren.', 'User not found.')}</p>
      </div>
    );
  }

  const user = data.user;
  const team = user.team_id ? data.goals.teams.get(user.team_id) : undefined;
  const own = data.goals.byUser.get(user.id);
  const goals = effectiveGoals(data.goals.defaults, own, team);
  const byDay = new Map(data.summary.map((s) => [s.day, s]));
  const days = daysBetween(new Date(`${fromIso}T12:00`), new Date(`${todayIso}T12:00`));
  const reload = () => setReloadKey((k) => k + 1);

  // Who created the account? Only known for accounts made in the admin panel.
  const created = data.changes.find((c) => c.table_name === 'accounts' && c.action === 'insert');

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

  // Names for ids in the change list (teams + this player).
  const names = new Map<string, string>([[user.id, user.display_name], ...[...data.goals.teams.values()].map((team) => [team.id, team.name] as [string, string])]);

  async function changeTeam(teamId: string) {
    try {
      await setUserTeam(user.id, teamId || null);
      const name = teamId ? data!.goals.teams.get(teamId)?.name : null;
      toast(
        name
          ? t(`${user.display_name} er nå på ${name}.`, `${user.display_name} is now on ${name}.`)
          : t(`${user.display_name} er tatt ut av laget.`, `${user.display_name} has been removed from the team.`),
      );
      reload();
    } catch (e) {
      toast(`${t('Kunne ikke bytte lag', "Couldn't change team")}: ${(e as Error).message}`, 'error');
    }
  }

  async function runExport(kind: 'days' | 'meals' | 'all') {
    setExporting(true);
    try {
      if (kind === 'days') {
        exportDaysCsv(user.display_name, fromIso, todayIso, perDay.map((d) => ({ ...d, status: d.status ? STATUS_LABELS[d.status] : t('Pågår', 'In progress') })));
      } else if (kind === 'meals') {
        await exportMealsCsv(user.id, user.display_name, fromIso, todayIso);
      } else {
        await exportAllDataJson(user.id, user.display_name);
      }
    } catch (e) {
      toast(`${t('Eksporten feilet', 'The export failed')}: ${(e as Error).message}`, 'error');
    } finally {
      setExporting(false);
    }
  }

  async function deletePermanently() {
    const ok = await confirm({
      title: t(`Slette ${user.display_name} permanent?`, `Delete ${user.display_name} permanently?`),
      body: t(
        'Kontoen og ALLE data slettes for godt: måltider, vann, mål, målinger, notater og gjenkjenningshistorikk. Dette kan ikke angres. Vurder å laste ned dataene først (knappen over), og bruk heller «Deaktiver» hvis personen kanskje kommer tilbake.',
        'The account and ALL data are deleted for good: meals, water, goals, measurements, notes and recognition history. This cannot be undone. Consider downloading the data first (the button above), and use “Deactivate” instead if the person might come back.',
      ),
      confirmLabel: t('Slett permanent', 'Delete permanently'),
      danger: true,
      requireText: user.display_name,
    });
    if (!ok) return;
    const result = await deleteAccount(user.id);
    if (result.error) return toast(`${t('Kunne ikke slette', "Couldn't delete")}: ${result.error}`, 'error');
    toast(t(`${user.display_name} og alle tilhørende data er slettet.`, `${user.display_name} and all their data have been deleted.`));
    navigate('/users');
  }

  return (
    <div className="stack-lg">
      <Link to="/" className="row muted" style={{ gap: 6 }}>
        <ArrowLeft size={15} /> {t('Oversikt', 'Overview')}
      </Link>

      <PageHeader
        title={
          <span className="row" style={{ gap: 16 }}>
            <Avatar name={user.display_name} id={user.id} large />
            <span>
              {user.display_name}
              <span className="row" style={{ gap: 8, marginTop: 6 }}>
                <span className="pill">{ROLE_LABELS[user.role]}</span>
                <span className={`pill ${user.is_active ? 'ok' : 'off'}`}>{user.is_active ? t('Aktiv', 'Active') : t('Deaktivert', 'Deactivated')}</span>
                <select
                  value={user.team_id ?? ''}
                  onChange={(e) => void changeTeam(e.target.value)}
                  aria-label={t('Lag', 'Team')}
                  style={{ padding: '2px 8px', fontSize: 12, borderRadius: 999 }}>
                  <option value="">{t('Uten lag', 'No team')}</option>
                  {[...data.goals.teams.values()].map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </span>
            </span>
          </span>
        }
        actions={
          <div className="stack" style={{ gap: 2, textAlign: 'right' }}>
            <span className="muted">{data.account?.email ?? ''}</span>
            <span className="faint small">
              {t('Sist innlogget', 'Last signed in')} {data.account?.last_sign_in_at ? formatDateTime(data.account.last_sign_in_at) : t('aldri', 'never')}
            </span>
            <span className="faint small">
              {t('Opprettet', 'Created')} {new Date(user.created_at).toLocaleDateString(locale())}
              {created?.actor_name ? ` ${t('av', 'by')} ${created.actor_name}` : ''}
            </span>
            <Link to="/users" className="small">
              {t('Rediger konto under Brukere', 'Edit the account under Users')}
            </Link>
          </div>
        }
      />

      {/* One filter row, above everything it scopes */}
      <div className="row spread">
        <div className="row">
          <Segmented
            label={t('Periode', 'Period')}
            value={range}
            onChange={setRange}
            options={RANGES.map((r) => ({ value: r, label: `${r} ${t('dager', 'days')}` }))}
          />
          <span className="faint small">
            {longDay(fromIso)} – {t('i dag', 'today')} {loading ? `· ${t('oppdaterer…', 'updating…')}` : ''}
          </span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="small" disabled={exporting} onClick={() => void runExport('days')}>
            <Download size={13} /> {t('Dager (CSV)', 'Days (CSV)')}
          </button>
          <button className="small" disabled={exporting} onClick={() => void runExport('meals')}>
            <Download size={13} /> {t('Måltider (CSV)', 'Meals (CSV)')}
          </button>
        </div>
      </div>

      <div className="kpi-row">
        <StatTile
          label={t('Snitt energi per logget dag', 'Average energy per logged day')}
          value={formatNumber(avg((s) => s.kcal))}
          unit="kcal"
          sub={`${t('Mål', 'Goal')} ${goals.goal_kcal.toLocaleString(locale())} kcal`}
        />
        <StatTile
          label={t('Snitt vann per dag', 'Average water per day')}
          value={formatNumber(avgWaterAll)}
          unit="ml"
          sub={`${t('Mål', 'Goal')} ${goals.goal_water_ml.toLocaleString(locale())} ml`}
        />
        <StatTile
          label={t('Dager logget', 'Days logged')}
          value={logged.length}
          unit={`${t('av', 'of')} ${complete.length}`}
          sub={t('Hele dager (i dag ikke med)', 'Whole days (today not included)')}
        />
        <StatTile
          label={t('Dager med nådd mål', 'Days with goal reached')}
          value={complete.filter((d) => d.status === 'green').length}
          unit={`${t('av', 'of')} ${complete.length}`}
        />
      </div>

      <div className="two-col">
        <div className="stack-lg">
          <section className="card">
            <div className="card-header">
              <h2>{t('Energi per dag', 'Energy per day')}</h2>
              <span className="faint small">{t('kcal · klikk en dag for detaljer', 'kcal · click a day for details')}</span>
            </div>
            <ColumnChart
              ariaLabel={t('Energi per dag i kcal', 'Energy per day in kcal')}
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
              <h2>{t('Vann per dag', 'Water per day')}</h2>
              <span className="faint small">ml</span>
            </div>
            <ColumnChart
              ariaLabel={t('Vann per dag i milliliter', 'Water per day in millilitres')}
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
            defaults={data.goals.defaults}
            own={own}
            team={team}
            onSaved={reload}
          />
          <section className="card">
            <div className="card-header">
              <h2>{t('Måloppnåelse', 'Goal achievement')}</h2>
              <span className="faint small">{t('Energi + vann mot mål', 'Energy + water vs goal')}</span>
            </div>
            <StatusStrip
              days={perDay.map((d) => ({ key: d.day, title: longDay(d.day), status: d.status }))}
              selectedKey={selectedDay}
              onSelect={setSelectedDay}
              showLegend
            />
            <p className="faint small" style={{ margin: '12px 0 0' }}>
              {t(
                'Én rute per dag, eldst til venstre. I dag (åpen rute) telles først når dagen er over.',
                'One square per day, oldest on the left. Today (open square) counts once the day is over.',
              )}
            </p>
          </section>
        </div>
      </div>

      {/* ---- The selected day in detail (with corrections) ---- */}
      <section className="card">
        <div className="card-header">
          <div className="row" style={{ gap: 6 }}>
            <button className="small ghost" onClick={() => shiftDay(-1)} aria-label={t('Forrige dag', 'Previous day')}>
              <ChevronLeft size={16} />
            </button>
            <h2 style={{ minWidth: 190, textAlign: 'center' }}>{selectedDay === todayIso ? t('I dag', 'Today') : longDay(selectedDay)}</h2>
            <button className="small ghost" onClick={() => shiftDay(1)} disabled={selectedDay >= todayIso} aria-label={t('Neste dag', 'Next day')}>
              <ChevronRight size={16} />
            </button>
          </div>
          {selectedDay !== todayIso && (
            <StatusLabel status={computeStatus(sel?.kcal ?? 0, sel?.water_ml ?? 0, goals.goal_kcal, goals.goal_water_ml)} />
          )}
        </div>

        <div className="grid-3">
          <div className="stack" style={{ gap: 12 }}>
            <Meter label={t('Energi', 'Energy')} value={sel?.kcal ?? 0} goal={goals.goal_kcal} unit="kcal" color="var(--series-kcal)" />
            <Meter label="Protein" value={sel?.protein_g ?? 0} goal={goals.goal_protein_g} unit="g" color="var(--text-2)" />
            <Meter label={t('Karbohydrater', 'Carbohydrates')} value={sel?.carbs_g ?? 0} goal={goals.goal_carbs_g} unit="g" color="var(--text-2)" />
            <Meter label={t('Fett', 'Fat')} value={sel?.fat_g ?? 0} goal={goals.goal_fat_g} unit="g" color="var(--text-2)" />
            <div className="row" style={{ gap: 8, marginTop: 4 }}>
              <Droplet size={15} color="var(--series-water)" />
              <div style={{ flex: 1 }}>
                <Meter label={t('Vann', 'Water')} value={sel?.water_ml ?? 0} goal={goals.goal_water_ml} unit="ml" color="var(--series-water)" />
              </div>
            </div>
          </div>

          <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
            {dayMeals === null ? <p className="muted">{t('Laster måltider…', 'Loading meals…')}</p> : <DayMealsTable meals={dayMeals} onChanged={reload} />}
          </div>
        </div>
      </section>

      {/* ---- Weight/height and notes (coach dashboard sketch) ---- */}
      <div className="two-col" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
        <MeasurementsCard key={`m:${user.id}`} userId={user.id} playerName={user.display_name} />
        <NotesCard key={`n:${user.id}`} userId={user.id} />
      </div>

      {/* ---- Table view: every number behind the charts ---- */}
      <section className="card flush">
        <div style={{ padding: '16px 20px 4px' }}>
          <h2>{t('Dag for dag', 'Day by day')}</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('Dag', 'Day')}</th>
                <th>Status</th>
                <th className="num">{t('Måltider', 'Meals')}</th>
                <th className="num">kcal</th>
                <th className="num">Protein (g)</th>
                <th className="num">{t('Karbo (g)', 'Carbs (g)')}</th>
                <th className="num">{t('Fett (g)', 'Fat (g)')}</th>
                <th className="num">{t('Vann (ml)', 'Water (ml)')}</th>
              </tr>
            </thead>
            <tbody>
              {[...perDay].reverse().map(({ day, s, status }) => (
                <tr key={day} className={`clickable ${day === selectedDay ? 'selected' : ''}`} onClick={() => setSelectedDay(day)}>
                  <td>{day === todayIso ? t('I dag', 'Today') : longDay(day)}</td>
                  <td>{status ? <StatusLabel status={status} /> : <span className="faint small">{t('Pågår', 'In progress')}</span>}</td>
                  <td className="num">{s?.meals ?? 0}</td>
                  <td className="num">{formatNumber(s?.kcal ?? 0)}</td>
                  <td className="num">{formatNumber(s?.protein_g ?? 0)}</td>
                  <td className="num">{formatNumber(s?.carbs_g ?? 0)}</td>
                  <td className="num">{formatNumber(s?.fat_g ?? 0)}</td>
                  <td className="num">{(s?.water_ml ?? 0).toLocaleString(locale())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- Recent changes about this player ---- */}
      <section className="card flush">
        <div className="row spread" style={{ padding: '16px 20px 4px' }}>
          <h2>{t('Endringer', 'Changes')}</h2>
          <Link to="/log" className="small">
            {t('Hele endringsloggen', 'The whole change log')}
          </Link>
        </div>
        <ChangeList entries={data.changes} names={names} />
      </section>

      {/* ---- GDPR: access + erasure ---- */}
      <section className="card stack" style={{ borderColor: 'rgba(248, 113, 113, 0.35)' }}>
        <h2>{t('Personvern', 'Privacy')}</h2>
        <div className="row spread">
          <div>
            <strong className="small">{t('Last ned alle data', 'Download all data')}</strong>
            <p className="faint small" style={{ margin: '2px 0 0' }}>
              {t(
                `Alt vi lagrer om ${user.display_name}, som én fil (innsynsrett). Bilder lagres aldri.`,
                `Everything we store about ${user.display_name}, as one file (right of access). Photos are never stored.`,
              )}
            </p>
          </div>
          <button className="small" disabled={exporting} onClick={() => void runExport('all')}>
            <FileJson size={13} /> {t('Last ned (JSON)', 'Download (JSON)')}
          </button>
        </div>
        <div className="row spread" style={{ borderTop: '1px solid var(--raised)', paddingTop: 12 }}>
          <div>
            <strong className="small">{t('Slett permanent', 'Delete permanently')}</strong>
            <p className="faint small" style={{ margin: '2px 0 0' }}>
              {t(
                'Sletter kontoen og alle data for godt (retten til sletting). Kan ikke angres.',
                'Deletes the account and all data for good (right to erasure). Cannot be undone.',
              )}
            </p>
          </div>
          {/* You can't delete your own account (the server refuses too). */}
          <button
            className="small danger"
            disabled={user.id === me?.id}
            title={user.id === me?.id ? t('Du kan ikke slette din egen konto', "You can't delete your own account") : undefined}
            onClick={() => void deletePermanently()}>
            <Trash2 size={13} /> {t('Slett permanent', 'Delete permanently')}
          </button>
        </div>
      </section>
    </div>
  );
}
