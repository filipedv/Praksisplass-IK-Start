// "Ny bruker": create a login account. The admin picks (or generates) a
// temporary password and hands it to the person — no email is sent.
// In the same form: the team for a player, or the teams a coach coaches, so
// a new person is set up in one go (both can be changed later).

import { useState, type FormEvent } from 'react';

import { createAccount, generatePassword } from '../lib/admin-users';
import { setCoachTeams, setUserTeam } from '../lib/teams-api';
import { ROLE_LABELS, type Role, type Team } from '../lib/types';
import { t } from '../lib/i18n';

type Props = {
  teams: Team[];
  onCreated: (summary: string) => void;
  onCancel: () => void;
};

export function NewUserForm({ teams, onCreated, onCancel }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [role, setRole] = useState<Role>('player');
  const [teamId, setTeamId] = useState(''); // a player's team ('' = none)
  const [coachTeamIds, setCoachTeamIds] = useState<string[]>([]); // a coach's teams
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await createAccount({ email: email.trim(), password, display_name: displayName.trim(), role });
    if (result.error !== null) {
      setBusy(false);
      return setError(result.error);
    }
    // The account exists now; a failed team choice is reported, not fatal.
    let teamProblem = '';
    try {
      if (role === 'player' && teamId) await setUserTeam(result.data.id, teamId);
      if (role === 'coach' && coachTeamIds.length) await setCoachTeams(result.data.id, coachTeamIds, []);
    } catch (err) {
      teamProblem = t(
        ` Laget kunne ikke lagres (${(err as Error).message}) — velg det på nytt i listen.`,
        ` The team couldn't be saved (${(err as Error).message}) — choose it again in the list.`,
      );
    }
    setBusy(false);
    onCreated(
      t(
        `${displayName.trim()} er opprettet. Gi personen e-post (${email.trim()}) og passordet «${password}» på en trygg måte — det vises ikke igjen.`,
        `${displayName.trim()} has been created. Give the person the email (${email.trim()}) and the password “${password}” in a safe way — it won't be shown again.`,
      ) + teamProblem,
    );
  }

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <h2 style={{ margin: 0 }}>{t('Ny bruker', 'New user')}</h2>
      <div className="grid-2">
        <label>
          {t('Navn', 'Name')}
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required autoFocus />
        </label>
        <label>
          {t('E-post', 'Email')}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
        </label>
        <label>
          {t('Midlertidig passord (minst 8 tegn)', 'Temporary password (at least 8 characters)')}
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
              style={{ flex: 1, fontFamily: 'ui-monospace, monospace' }}
            />
            <button type="button" onClick={() => setPassword(generatePassword())}>
              {t('Nytt', 'New')}
            </button>
          </div>
        </label>
        <label>
          {t('Rolle', 'Role')}
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        {role === 'player' && (
          <label>
            {t('Lag', 'Team')}
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">{t('Uten lag (velg senere)', 'No team (choose later)')}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {role === 'coach' && (
        <fieldset className="stack" style={{ gap: 8, border: 0, padding: 0, margin: 0 }}>
          <legend className="stat-label" style={{ marginBottom: 8 }}>
            {t('Trener for', 'Coach of')}
          </legend>
          {teams.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>
              {t('Ingen lag ennå — opprett lag under «Lag» først.', 'No teams yet — create teams under “Teams” first.')}
            </p>
          ) : (
            <div className="row" style={{ gap: 16 }}>
              {teams.map((team) => (
                <label key={team.id} className="checkbox">
                  <input
                    type="checkbox"
                    checked={coachTeamIds.includes(team.id)}
                    onChange={(e) => setCoachTeamIds(e.target.checked ? [...coachTeamIds, team.id] : coachTeamIds.filter((id) => id !== team.id))}
                  />
                  {team.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}
      <p className="muted small" style={{ margin: 0 }}>
        {t(
          'Kontoen kan brukes med en gang (ingen bekreftelses-e-post). Ikke opprett kontoer for ekte akademispillere før samtykke og personvernvurdering er på plass.',
          'The account can be used right away (no confirmation email). Do not create accounts for real academy players until consent and a privacy assessment are in place.',
        )}
      </p>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? t('Oppretter…', 'Creating…') : t('Opprett bruker', 'Create user')}
        </button>
        <button type="button" onClick={onCancel}>
          {t('Avbryt', 'Cancel')}
        </button>
      </div>
    </form>
  );
}
