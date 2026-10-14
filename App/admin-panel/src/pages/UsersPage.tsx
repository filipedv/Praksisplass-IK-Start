// BRUKERE: every user, their role, and whether the account is active.
//
// - Change role: a plain UPDATE on profiles. The database only allows it
//   because WE are an admin (RLS policy + the protect_profile_privileged_columns
//   trigger). A player sending the same request would get an error.
// - Deactivate = soft delete (is_active = false). The user can still log in,
//   but RLS hides all data from them and blocks new entries. Nothing is deleted.
//
// - Create accounts and change email/password: through the admin-users Edge
//   Function (needs the secret key, so it can't run in this page). See
//   src/lib/admin-users.ts and supabase/functions/admin-users.

import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { useAuth } from '../auth/auth-context';
import { EditUserForm } from '../components/EditUserForm';
import { NewUserForm } from '../components/NewUserForm';
import { listAccounts, type AccountInfo } from '../lib/admin-users';
import { formatDateTime } from '../lib/format';
import { supabase } from '../lib/supabase';
import { ROLE_LABELS, type Profile, type Role } from '../lib/types';

/** All profiles (RLS lets admins see everyone's) + emails/last login from Auth. */
async function fetchUsers() {
  const [profiles, accounts] = await Promise.all([
    supabase.from('profiles').select('id, display_name, role, is_active, created_at').order('display_name'),
    listAccounts(),
  ]);
  return {
    users: (profiles.data ?? []) as Profile[],
    accounts: new Map((accounts.data ?? []).map((a) => [a.id, a])),
    error: profiles.error?.message ?? accounts.error,
  };
}

export function UsersPage() {
  const { profile: me } = useAuth();
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [accounts, setAccounts] = useState<Map<string, AccountInfo>>(new Map());
  // Which form is open: none, "new user", or editing one user (by id).
  const [form, setForm] = useState<{ kind: 'none' } | { kind: 'new' } | { kind: 'edit'; userId: string }>({
    kind: 'none',
  });
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Bump this number to load the list again (e.g. after saving).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false; // ignore the answer if we've left the page meanwhile
    void fetchUsers().then((result) => {
      if (cancelled) return;
      if (result.error) setMessage({ text: `Kunne ikke hente alt: ${result.error}`, ok: false });
      setUsers(result.users);
      setAccounts(result.accounts);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function update(user: Profile, changes: Partial<Pick<Profile, 'role' | 'is_active'>>, okText: string) {
    setSavingId(user.id);
    setMessage(null);
    // .select() makes Supabase return the updated row, so we can tell
    // "saved" apart from "silently blocked by RLS" (0 rows).
    const { data, error } = await supabase.from('profiles').update(changes).eq('id', user.id).select('id');
    setSavingId(null);
    if (error || !data?.length) {
      setMessage({ text: `Kunne ikke lagre: ${error?.message ?? 'ingen tilgang'}`, ok: false });
    } else {
      setMessage({ text: okText, ok: true });
    }
    setReloadKey((k) => k + 1);
  }

  // After a form saves: close it, show what happened, reload the list.
  function formDone(summary: string) {
    setForm({ kind: 'none' });
    setMessage({ text: summary, ok: true });
    setReloadKey((k) => k + 1);
  }

  if (users === null) return <p className="muted">Laster brukere…</p>;
  const editing = form.kind === 'edit' ? users.find((u) => u.id === form.userId) : undefined;

  return (
    <div className="stack">
      <div className="row spread">
        <h1 style={{ margin: 0 }}>Brukere</h1>
        <button className="primary" onClick={() => setForm({ kind: 'new' })}>
          + Ny bruker
        </button>
      </div>
      <p className="muted">Deaktivering sletter ingen data — brukeren mister bare tilgangen.</p>
      {message && <p className={message.ok ? 'success' : 'error'}>{message.text}</p>}

      {form.kind === 'new' && <NewUserForm onCreated={formDone} onCancel={() => setForm({ kind: 'none' })} />}
      {editing && (
        <EditUserForm
          key={editing.id}
          user={editing}
          currentEmail={accounts.get(editing.id)?.email ?? null}
          onSaved={formDone}
          onCancel={() => setForm({ kind: 'none' })}
        />
      )}

      <table>
        <thead>
          <tr>
            <th>Navn</th>
            <th>E-post</th>
            <th>Rolle</th>
            <th>Status</th>
            <th>Sist innlogget</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isMe = user.id === me?.id;
            const busy = savingId === user.id;
            return (
              <tr key={user.id}>
                <td>
                  {user.display_name || <span className="muted">(uten navn)</span>}
                  {isMe && <span className="muted small"> (deg)</span>}
                </td>
                <td className="muted">{accounts.get(user.id)?.email ?? '–'}</td>
                <td>
                  <select
                    value={user.role}
                    // You can't change your own role here — otherwise it's easy
                    // to lock yourself (or the last admin) out by mistake.
                    disabled={isMe || busy}
                    onChange={(e) => {
                      const role = e.target.value as Role;
                      update(user, { role }, `${user.display_name} er nå ${ROLE_LABELS[role].toLowerCase()}.`);
                    }}>
                    {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <span className={`badge ${user.is_active ? 'ok' : 'off'}`}>
                    {user.is_active ? 'Aktiv' : 'Deaktivert'}
                  </span>
                </td>
                <td className="muted">
                  {accounts.get(user.id)?.last_sign_in_at ? formatDateTime(accounts.get(user.id)!.last_sign_in_at!) : 'Aldri'}
                </td>
                <td>
                  <div className="row">
                    <Link to={`/users/${user.id}`}>Se data</Link>
                    <button disabled={busy} onClick={() => setForm({ kind: 'edit', userId: user.id })}>
                      Rediger
                    </button>
                    {!isMe && (
                      <button
                        className={user.is_active ? 'danger' : ''}
                        disabled={busy}
                        onClick={() => {
                          if (user.is_active && !window.confirm(`Deaktivere ${user.display_name}?`)) return;
                          update(
                            user,
                            { is_active: !user.is_active },
                            user.is_active ? `${user.display_name} er deaktivert.` : `${user.display_name} er aktivert igjen.`,
                          );
                        }}>
                        {user.is_active ? 'Deaktiver' : 'Aktiver'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">
        Roller for trener og foresatt kan settes allerede nå, men de har ingen egne skjermer ennå.
      </p>
    </div>
  );
}
