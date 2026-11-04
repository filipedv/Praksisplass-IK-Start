// LAG: the teams, each team's goals, and who coaches them.
//
//   - ADMINS create, rename and delete teams, set team goals, and choose
//     each team's coaches ("Trenere"). A coach only sees the players on the
//     teams they coach.
//   - COACHES see "Mine lag": only their own teams, and may change only the
//     team goals (the database refuses anything else).
//
// Goals follow the order  player's own goal → team goal → club default.
// So a team goal applies to everyone on the team who hasn't got their own.
// An empty team-goal field = use the club default.
// Players are put on a team on Brukere or on their own page.

import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { useAuth } from '../auth/auth-context';
import { PageHeader } from '../components/ui';
import { useFeedback } from '../feedback/feedback-context';
import { GOAL_FIELDS, fetchAllGoals, type Goals } from '../lib/summary-api';
import { supabase } from '../lib/supabase';
import { deleteTeam, listCoachTeams, listTeams, saveTeam, saveTeamGoals, setTeamCoaches } from '../lib/teams-api';
import type { Team } from '../lib/types';
import { locale, t } from '../lib/i18n';

type Draft = { id?: string; name: string; sort_order: string; coachIds: string[] } & Record<keyof Goals, string>;

const EMPTY_DRAFT: Draft = {
  name: '',
  sort_order: '0',
  coachIds: [],
  goal_kcal: '',
  goal_protein_g: '',
  goal_carbs_g: '',
  goal_fat_g: '',
  goal_water_ml: '',
};

type Person = { id: string; display_name: string };

async function fetchTeamsPage() {
  const [teams, goals, members, assignments, coaches] = await Promise.all([
    listTeams(),
    fetchAllGoals(),
    // RLS: an admin counts everyone, a coach their own players.
    supabase.from('profiles').select('team_id').eq('role', 'player').eq('is_active', true),
    listCoachTeams(),
    supabase.from('profiles').select('id, display_name').eq('role', 'coach').eq('is_active', true).order('display_name'),
  ]);
  const counts = new Map<string, number>();
  for (const m of members.data ?? []) if (m.team_id) counts.set(m.team_id, (counts.get(m.team_id) ?? 0) + 1);
  const coachesByTeam = new Map<string, string[]>();
  for (const a of assignments) coachesByTeam.set(a.team_id, [...(coachesByTeam.get(a.team_id) ?? []), a.coach_id]);
  return { teams, defaults: goals.defaults, counts, coachesByTeam, coaches: (coaches.data ?? []) as Person[] };
}

export function TeamsPage() {
  const { toast, confirm } = useFeedback();
  const { isCoach, coachTeamIds } = useAuth();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchTeamsPage>> | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null); // the open form, if any
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchTeamsPage()
      .then((result) => !cancelled && setData(result))
      .catch((e) => !cancelled && toast(`${t('Kunne ikke hente lag', "Couldn't load teams")}: ${e.message}`, 'error'));
    return () => {
      cancelled = true;
    };
    // toast is stable for our purposes; we only refetch on reloadKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  function edit(team: Team) {
    const d: Draft = {
      ...EMPTY_DRAFT,
      id: team.id,
      name: team.name,
      sort_order: String(team.sort_order),
      coachIds: data?.coachesByTeam.get(team.id) ?? [],
    };
    for (const { key } of GOAL_FIELDS) d[key] = team[key] != null ? String(team[key]) : '';
    setDraft(d);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!draft.name.trim()) return toast(t('Laget må ha et navn.', 'The team needs a name.'), 'error');
    const goals = {} as Record<keyof Goals, number | null>;
    for (const { key, label } of GOAL_FIELDS) {
      const raw = draft[key].trim();
      if (raw === '') {
        goals[key] = null;
        continue;
      }
      const n = Number(raw);
      const min = key === 'goal_kcal' || key === 'goal_water_ml' ? 1 : 0;
      if (!Number.isInteger(n) || n < min) return toast(`${label}: ${t(`må være et helt tall${min ? ' over 0' : ''}.`, `must be a whole number${min ? ' above 0' : ''}.`)}`, 'error');
      goals[key] = n;
    }
    setBusy(true);
    try {
      if (isCoach && draft.id) {
        await saveTeamGoals(draft.id, goals);
      } else {
        const id = await saveTeam({ id: draft.id, name: draft.name.trim(), sort_order: Number(draft.sort_order) || 0, ...goals });
        await setTeamCoaches(id, draft.coachIds, draft.id ? (data?.coachesByTeam.get(draft.id) ?? []) : []);
      }
      toast(
        draft.id
          ? t(`${draft.name.trim()} er lagret.`, `${draft.name.trim()} has been saved.`)
          : t(`Laget ${draft.name.trim()} er opprettet.`, `The team ${draft.name.trim()} has been created.`),
      );
      setDraft(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      const msg = (err as Error).message;
      toast(
        msg.includes('duplicate')
          ? t('Det finnes allerede et lag med det navnet.', 'There is already a team with that name.')
          : `${t('Kunne ikke lagre', "Couldn't save")}: ${msg}`,
        'error',
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(team: Team) {
    const members = data?.counts.get(team.id) ?? 0;
    const ok = await confirm({
      title: t(`Slette laget ${team.name}?`, `Delete the team ${team.name}?`),
      body: members
        ? t(
            `${members} spiller(e) står på laget. De beholdes, men blir uten lag og følger klubbens standardmål (eller egne mål). Trenerne for laget mister tilgangen til dem.`,
            `${members} player(s) are on the team. They are kept, but end up without a team and follow the club's default goals (or their own). The team's coaches lose access to them.`,
          )
        : t('Laget har ingen spillere.', 'The team has no players.'),
      confirmLabel: t('Slett lag', 'Delete team'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteTeam(team.id);
      toast(t(`Laget ${team.name} er slettet.`, `The team ${team.name} has been deleted.`));
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(`${t('Kunne ikke slette', "Couldn't delete")}: ${(err as Error).message}`, 'error');
    }
  }

  if (!data) return <p className="muted">{t('Laster lag…', 'Loading teams…')}</p>;

  const teams = isCoach ? data.teams.filter((team) => coachTeamIds.includes(team.id)) : data.teams;
  const coachName = new Map(data.coaches.map((c) => [c.id, c.display_name]));
  const coachNames = (teamId: string) =>
    (data.coachesByTeam.get(teamId) ?? [])
      .map((id) => coachName.get(id))
      .filter(Boolean)
      .join(', ');

  return (
    <div className="stack-lg">
      <PageHeader
        title={isCoach ? t('Mine lag', 'My teams') : t('Lag', 'Teams')}
        subtitle={t("Mål gjelder i rekkefølgen: spillerens egne → lagets → klubbens standard", "Goals apply in this order: the player's own → the team's → the club default")}
        actions={
          !isCoach && (
            <button className="primary" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
              <Plus size={15} /> {t('Nytt lag', 'New team')}
            </button>
          )
        }
      />

      {draft && (
        <form className="card stack" onSubmit={handleSubmit}>
          <h2>{draft.id ? `${t('Rediger', 'Edit')} ${draft.name}` : t('Nytt lag', 'New team')}</h2>
          {/* Name, order and coaches are the admin's job. */}
          {!isCoach && (
            <>
              <div className="grid-2">
                <label>
                  {t('Navn', 'Name')}
                  <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t('f.eks. A-lag, G19', 'e.g. A-lag, G19')} autoFocus required />
                </label>
                <label>
                  {t('Rekkefølge i lister', 'Order in lists')}
                  <input inputMode="numeric" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })} />
                </label>
              </div>
              <fieldset className="stack" style={{ gap: 8, border: 0, padding: 0, margin: 0 }}>
                <legend className="stat-label" style={{ marginBottom: 8 }}>
                  {t('Trenere', 'Coaches')}
                </legend>
                {data.coaches.length === 0 ? (
                  <p className="muted small" style={{ margin: 0 }}>
                    {t('Ingen trenere ennå. Gi en bruker rollen «Trener» under Brukere først.', 'No coaches yet. Give a user the “Coach” role under Users first.')}
                  </p>
                ) : (
                  <div className="row" style={{ gap: 16 }}>
                    {data.coaches.map((coach) => (
                      <label key={coach.id} className="checkbox">
                        <input
                          type="checkbox"
                          checked={draft.coachIds.includes(coach.id)}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              coachIds: e.target.checked ? [...draft.coachIds, coach.id] : draft.coachIds.filter((id) => id !== coach.id),
                            })
                          }
                        />
                        {coach.display_name}
                      </label>
                    ))}
                  </div>
                )}
                <p className="faint small" style={{ margin: 0 }}>
                  {t(
                    'Trenerne ser spillerne på laget i sitt eget dashbord: måltider, vann, mål, vekt og notater, og lagets kamper og treninger.',
                    "The coaches see the team's players in their own dashboard: meals, water, goals, weight and notes, and the team's matches and training.",
                  )}
                </p>
              </fieldset>
            </>
          )}
          <strong className="small">{t('Lagets dagsmål', "The team's daily goals")}</strong>
          <p className="faint small" style={{ margin: 0 }}>
            {t(
              'La et felt stå tomt for å bruke klubbens standard (vist i feltet). Plassholderverdier — ikke ernæringsråd.',
              "Leave a field empty to use the club's default (shown in the field). Placeholder values — not nutrition advice.",
            )}
          </p>
          <div className="grid-2">
            {GOAL_FIELDS.map(({ key, label, unit }, i) => (
              <label key={key}>
                {label} ({unit})
                <input
                  inputMode="numeric"
                  value={draft[key]}
                  placeholder={String(data.defaults[key])}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  autoFocus={isCoach && i === 0}
                />
              </label>
            ))}
          </div>
          <div className="row">
            <button type="submit" className="primary" disabled={busy}>
              {busy ? t('Lagrer…', 'Saving…') : draft.id ? t('Lagre', 'Save') : t('Opprett lag', 'Create team')}
            </button>
            <button type="button" onClick={() => setDraft(null)} disabled={busy}>
              {t('Avbryt', 'Cancel')}
            </button>
          </div>
        </form>
      )}

      <section className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('Lag', 'Team')}</th>
                <th className="num">{t('Spillere', 'Players')}</th>
                {!isCoach && <th>{t('Trenere', 'Coaches')}</th>}
                {GOAL_FIELDS.map(({ key, label, unit }) => (
                  <th key={key} className="num">
                    {label} ({unit})
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id}>
                  <td>
                    <strong>{team.name}</strong>
                  </td>
                  <td className="num">
                    {isCoach ? (
                      data.counts.get(team.id) ?? 0
                    ) : (
                      <Link to={`/users?team=${team.id}`} className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                        <Users size={13} /> {data.counts.get(team.id) ?? 0}
                      </Link>
                    )}
                  </td>
                  {!isCoach && (
                    <td>
                      <button className="small ghost" onClick={() => edit(team)} title={t('Velg trenere for laget', 'Choose the team’s coaches')}>
                        {coachNames(team.id) || <span className="faint">{t('+ Legg til trener', '+ Add coach')}</span>}
                      </button>
                    </td>
                  )}
                  {GOAL_FIELDS.map(({ key }) => (
                    <td key={key} className="num">
                      {team[key] != null ? (
                        <strong>{team[key]!.toLocaleString(locale())}</strong>
                      ) : (
                        <span className="faint" title={t('Klubbens standard', "Club default")}>
                          {data.defaults[key].toLocaleString(locale())}
                        </span>
                      )}
                    </td>
                  ))}
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                      <button className="small" onClick={() => edit(team)}>
                        <Pencil size={12} /> {isCoach ? t('Endre mål', 'Edit goals') : t('Rediger', 'Edit')}
                      </button>
                      {!isCoach && (
                        <button className="small danger" onClick={() => void remove(team)} aria-label={`${t('Slett', 'Delete')} ${team.name}`}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {teams.length === 0 && (
                <tr>
                  <td colSpan={GOAL_FIELDS.length + 4} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                    {isCoach
                      ? t('Du er ikke satt opp som trener for noe lag ennå. Be en administrator legge deg til.', "You haven't been set up as a coach for any team yet. Ask an administrator to add you.")
                      : t('Ingen lag ennå. Opprett f.eks. «A-lag» og «G19».', 'No teams yet. Create e.g. “A-lag” and “G19”.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <p className="faint small" style={{ margin: 0 }}>
        {t(
          'Fete tall = lagets eget mål. Grå tall = klubbens standard (laget har ikke satt noe).',
          "Bold numbers = the team's own goal. Grey numbers = the club default (the team hasn't set one).",
        )}
      </p>
    </div>
  );
}
