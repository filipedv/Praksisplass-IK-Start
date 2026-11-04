// "Ny bruker": create a login account. The admin picks (or generates) a
// temporary password and hands it to the person — no email is sent.

import { useState, type FormEvent } from 'react';

import { createAccount, generatePassword } from '../lib/admin-users';
import { ROLE_LABELS, type Role } from '../lib/types';
import { t } from '../lib/i18n';

type Props = {
  onCreated: (summary: string) => void;
  onCancel: () => void;
};

export function NewUserForm({ onCreated, onCancel }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [role, setRole] = useState<Role>('player');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await createAccount({ email: email.trim(), password, display_name: displayName.trim(), role });
    setBusy(false);
    if (result.error) return setError(result.error);
    onCreated(
      t(
        `${displayName.trim()} er opprettet. Gi personen e-post (${email.trim()}) og passordet «${password}» på en trygg måte — det vises ikke igjen.`,
        `${displayName.trim()} has been created. Give the person the email (${email.trim()}) and the password “${password}” in a safe way — it won't be shown again.`,
      ),
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
      </div>
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
