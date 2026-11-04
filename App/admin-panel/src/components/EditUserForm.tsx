// "Rediger bruker": change name, email or password.
//   - Name lives in `profiles` → updated directly (RLS lets admins do it).
//   - Email and password live in Supabase Auth → changed via the admin-users
//     Edge Function, which holds the secret key.
//   - For a COACH: which teams they coach ("Trener for", coach_teams). They
//     then see those teams' players in their coach dashboard.
// Role and active status are changed in the table itself, not here.

import { useState, type FormEvent } from 'react';

import { generatePassword, updateAccount } from '../lib/admin-users';
import { supabase } from '../lib/supabase';
import { setCoachTeams } from '../lib/teams-api';
import type { Profile, Team } from '../lib/types';
import { t } from '../lib/i18n';

type Props = {
  user: Profile;
  currentEmail: string | null;
  teams: Team[];
  /** The teams this user coaches now (only used for coaches). */
  coachedTeamIds: string[];
  onSaved: (summary: string) => void;
  onCancel: () => void;
};

export function EditUserForm({ user, currentEmail, teams, coachedTeamIds, onSaved, onCancel }: Props) {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [email, setEmail] = useState(currentEmail ?? '');
  const [newPassword, setNewPassword] = useState(''); // empty = keep current password
  const [teamIds, setTeamIds] = useState<string[]>(coachedTeamIds);
  const isCoach = user.role === 'coach';
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const nameChanged = displayName.trim() !== user.display_name;
    const emailChanged = email.trim().toLowerCase() !== (currentEmail ?? '').toLowerCase();
    const passwordChanged = newPassword !== '';
    const teamsChanged = isCoach && (teamIds.length !== coachedTeamIds.length || teamIds.some((id) => !coachedTeamIds.includes(id)));
    if (!displayName.trim()) return setError(t('Navn kan ikke være tomt.', 'Name cannot be empty.'));
    if (!nameChanged && !emailChanged && !passwordChanged && !teamsChanged) return onCancel();

    setBusy(true);
    if (nameChanged) {
      const { data, error: nameError } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() })
        .eq('id', user.id)
        .select('id');
      if (nameError || !data?.length) {
        setBusy(false);
        return setError(`${t('Kunne ikke lagre navnet', "Couldn't save the name")}: ${nameError?.message ?? t('ingen tilgang', 'no access')}`);
      }
    }
    if (teamsChanged) {
      try {
        await setCoachTeams(user.id, teamIds, coachedTeamIds);
      } catch (e) {
        setBusy(false);
        return setError(`${t('Kunne ikke lagre lagene', "Couldn't save the teams")}: ${(e as Error).message}`);
      }
    }
    if (emailChanged || passwordChanged) {
      const result = await updateAccount(user.id, {
        email: emailChanged ? email.trim() : undefined,
        password: passwordChanged ? newPassword : undefined,
      });
      if (result.error) {
        setBusy(false);
        return setError(result.error);
      }
    }
    setBusy(false);

    const done = [
      nameChanged && t('navn', 'name'),
      emailChanged && t('e-post', 'email'),
      passwordChanged && t('passord', 'password'),
      teamsChanged && t('lag', 'teams'),
    ].filter(Boolean);
    onSaved(
      t(`Lagret (${done.join(', ')}) for ${displayName.trim()}.`, `Saved (${done.join(', ')}) for ${displayName.trim()}.`) +
        (passwordChanged
          ? t(
              ` Nytt passord: «${newPassword}» — gi det til personen på en trygg måte.`,
              ` New password: “${newPassword}” — give it to the person in a safe way.`,
            )
          : ''),
    );
  }

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <h2 style={{ margin: 0 }}>
        {t('Rediger', 'Edit')} {user.display_name}
      </h2>
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
          {t('Nytt passord (la stå tomt for å beholde)', 'New password (leave empty to keep)')}
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              style={{ flex: 1, fontFamily: 'ui-monospace, monospace' }}
            />
            <button type="button" onClick={() => setNewPassword(generatePassword())}>
              {t('Generer', 'Generate')}
            </button>
          </div>
        </label>
      </div>
      {isCoach && (
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
                    checked={teamIds.includes(team.id)}
                    onChange={(e) => setTeamIds(e.target.checked ? [...teamIds, team.id] : teamIds.filter((id) => id !== team.id))}
                  />
                  {team.name}
                </label>
              ))}
            </div>
          )}
          <p className="faint small" style={{ margin: 0 }}>
            {t(
              'Treneren ser spillerne på disse lagene i sitt eget dashbord, og lagenes kamper og treninger.',
              "The coach sees these teams' players in their own dashboard, and the teams' matches and training.",
            )}
          </p>
        </fieldset>
      )}
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? t('Lagrer…', 'Saving…') : t('Lagre', 'Save')}
        </button>
        <button type="button" onClick={onCancel}>
          {t('Avbryt', 'Cancel')}
        </button>
      </div>
    </form>
  );
}
