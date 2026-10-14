// "Rediger bruker": change name, email or password.
//   - Name lives in `profiles` → updated directly (RLS lets admins do it).
//   - Email and password live in Supabase Auth → changed via the admin-users
//     Edge Function, which holds the secret key.
// Role and active status are changed in the table itself, not here.

import { useState, type FormEvent } from 'react';

import { generatePassword, updateAccount } from '../lib/admin-users';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

type Props = {
  user: Profile;
  currentEmail: string | null;
  onSaved: (summary: string) => void;
  onCancel: () => void;
};

export function EditUserForm({ user, currentEmail, onSaved, onCancel }: Props) {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [email, setEmail] = useState(currentEmail ?? '');
  const [newPassword, setNewPassword] = useState(''); // empty = keep current password
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const nameChanged = displayName.trim() !== user.display_name;
    const emailChanged = email.trim().toLowerCase() !== (currentEmail ?? '').toLowerCase();
    const passwordChanged = newPassword !== '';
    if (!displayName.trim()) return setError('Navn kan ikke være tomt.');
    if (!nameChanged && !emailChanged && !passwordChanged) return onCancel();

    setBusy(true);
    if (nameChanged) {
      const { data, error: nameError } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() })
        .eq('id', user.id)
        .select('id');
      if (nameError || !data?.length) {
        setBusy(false);
        return setError(`Kunne ikke lagre navnet: ${nameError?.message ?? 'ingen tilgang'}`);
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

    const done = [nameChanged && 'navn', emailChanged && 'e-post', passwordChanged && 'passord'].filter(Boolean);
    onSaved(
      `Lagret (${done.join(', ')}) for ${displayName.trim()}.` +
        (passwordChanged ? ` Nytt passord: «${newPassword}» — gi det til personen på en trygg måte.` : ''),
    );
  }

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <h2 style={{ margin: 0 }}>Rediger {user.display_name}</h2>
      <div className="grid-2">
        <label>
          Navn
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required autoFocus />
        </label>
        <label>
          E-post
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
        </label>
        <label>
          Nytt passord (la stå tomt for å beholde)
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              style={{ flex: 1, fontFamily: 'ui-monospace, monospace' }}
            />
            <button type="button" onClick={() => setNewPassword(generatePassword())}>
              Generer
            </button>
          </div>
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Lagrer…' : 'Lagre'}
        </button>
        <button type="button" onClick={onCancel}>
          Avbryt
        </button>
      </div>
    </form>
  );
}
