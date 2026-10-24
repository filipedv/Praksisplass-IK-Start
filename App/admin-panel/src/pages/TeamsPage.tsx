// LAG: create, rename and delete teams, and set each team's goals.
//
// Goals follow the order  player's own goal → team goal → club default.
// So a team goal applies to everyone on the team who hasn't got their own.
// An empty team-goal field = use the club default.
// Players are put on a team on Brukere or on their own page.

import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { PageHeader } from '../components/ui';
import { useFeedback } from '../feedback/feedback-context';
import { GOAL_FIELDS, fetchAllGoals, type Goals } from '../lib/summary-api';
import { supabase } from '../lib/supabase';
import { deleteTeam, listTeams, saveTeam } from '../lib/teams-api';
import type { Team } from '../lib/types';

type Draft = { id?: string; name: string; sort_order: string } & Record<keyof Goals, string>;

const EMPTY_DRAFT: Draft = {
  name: '',
  sort_order: '0',
  goal_kcal: '',
  goal_protein_g: '',
  goal_carbs_g: '',
  goal_fat_g: '',
  goal_water_ml: '',
};

async function fetchTeamsPage() {
  const [teams, goals, members] = await Promise.all([
    listTeams(),
    fetchAllGoals(),
    supabase.from('profiles').select('team_id').eq('is_active', true),
  ]);
  const counts = new Map<string, number>();
  for (const m of members.data ?? []) if (m.team_id) counts.set(m.team_id, (counts.get(m.team_id) ?? 0) + 1);
  return { teams, defaults: goals.defaults, counts };
}

export function TeamsPage() {
  const { toast, confirm } = useFeedback();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchTeamsPage>> | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null); // the open form, if any
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchTeamsPage()
      .then((result) => !cancelled && setData(result))
      .catch((e) => !cancelled && toast(`Kunne ikke hente lag: ${e.message}`, 'error'));
    return () => {
      cancelled = true;
    };
    // toast is stable for our purposes; we only refetch on reloadKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  function edit(team: Team) {
    const d: Draft = { ...EMPTY_DRAFT, id: team.id, name: team.name, sort_order: String(team.sort_order) };
    for (const { key } of GOAL_FIELDS) d[key] = team[key] != null ? String(team[key]) : '';
    setDraft(d);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!draft.name.trim()) return toast('Laget må ha et navn.', 'error');
    const goals = {} as Record<keyof Goals, number | null>;
    for (const { key, label } of GOAL_FIELDS) {
      const raw = draft[key].trim();
      if (raw === '') {
        goals[key] = null;
        continue;
      }
      const n = Number(raw);
      const min = key === 'goal_kcal' || key === 'goal_water_ml' ? 1 : 0;
      if (!Number.isInteger(n) || n < min) return toast(`${label}: må være et helt tall${min ? ' over 0' : ''}.`, 'error');
      goals[key] = n;
    }
    setBusy(true);
    try {
      await saveTeam({ id: draft.id, name: draft.name.trim(), sort_order: Number(draft.sort_order) || 0, ...goals });
      toast(draft.id ? `${draft.name.trim()} er lagret.` : `Laget ${draft.name.trim()} er opprettet.`);
      setDraft(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      const msg = (err as Error).message;
      toast(msg.includes('duplicate') ? 'Det finnes allerede et lag med det navnet.' : `Kunne ikke lagre: ${msg}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(team: Team) {
    const members = data?.counts.get(team.id) ?? 0;
    const ok = await confirm({
      title: `Slette laget ${team.name}?`,
      body: members
        ? `${members} spiller(e) står på laget. De beholdes, men blir uten lag og følger klubbens standardmål (eller egne mål).`
        : 'Laget har ingen spillere.',
      confirmLabel: 'Slett lag',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteTeam(team.id);
      toast(`Laget ${team.name} er slettet.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(`Kunne ikke slette: ${(err as Error).message}`, 'error');
    }
  }

  if (!data) return <p className="muted">Laster lag…</p>;

  return (
    <div className="stack-lg">
      <PageHeader
        title="Lag"
        subtitle="Mål gjelder i rekkefølgen: spillerens egne → lagets → klubbens standard"
        actions={
          <button className="primary" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
            <Plus size={15} /> Nytt lag
          </button>
        }
      />

      {draft && (
        <form className="card stack" onSubmit={handleSubmit}>
          <h2>{draft.id ? `Rediger ${draft.name}` : 'Nytt lag'}</h2>
          <div className="grid-2">
            <label>
              Navn
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="f.eks. A-lag, G19" autoFocus required />
            </label>
            <label>
              Rekkefølge i lister
              <input inputMode="numeric" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })} />
            </label>
          </div>
          <strong className="small">Lagets dagsmål</strong>
          <p className="faint small" style={{ margin: 0 }}>
            La et felt stå tomt for å bruke klubbens standard (vist i feltet). Plassholderverdier — ikke ernæringsråd.
          </p>
          <div className="grid-2">
            {GOAL_FIELDS.map(({ key, label, unit }) => (
              <label key={key}>
                {label} ({unit})
                <input
                  inputMode="numeric"
                  value={draft[key]}
                  placeholder={String(data.defaults[key])}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <div className="row">
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Lagrer…' : draft.id ? 'Lagre' : 'Opprett lag'}
            </button>
            <button type="button" onClick={() => setDraft(null)} disabled={busy}>
              Avbryt
            </button>
          </div>
        </form>
      )}

      <section className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lag</th>
                <th className="num">Spillere</th>
                {GOAL_FIELDS.map(({ key, label, unit }) => (
                  <th key={key} className="num">
                    {label} ({unit})
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.teams.map((team) => (
                <tr key={team.id}>
                  <td>
                    <strong>{team.name}</strong>
                  </td>
                  <td className="num">
                    <Link to={`/users?team=${team.id}`} className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      <Users size={13} /> {data.counts.get(team.id) ?? 0}
                    </Link>
                  </td>
                  {GOAL_FIELDS.map(({ key }) => (
                    <td key={key} className="num">
                      {team[key] != null ? (
                        <strong>{team[key]!.toLocaleString('nb-NO')}</strong>
                      ) : (
                        <span className="faint" title="Klubbens standard">
                          {data.defaults[key].toLocaleString('nb-NO')}
                        </span>
                      )}
                    </td>
                  ))}
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                      <button className="small" onClick={() => edit(team)}>
                        <Pencil size={12} /> Rediger
                      </button>
                      <button className="small danger" onClick={() => void remove(team)} aria-label={`Slett ${team.name}`}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.teams.length === 0 && (
                <tr>
                  <td colSpan={GOAL_FIELDS.length + 3} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                    Ingen lag ennå. Opprett f.eks. «A-lag» og «G19».
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <p className="faint small" style={{ margin: 0 }}>
        Fete tall = lagets eget mål. Grå tall = klubbens standard (laget har ikke satt noe).
      </p>
    </div>
  );
}
