// BRUKERE: every account — search, filter, change role, deactivate, edit.
//
// - Change role: a plain UPDATE on profiles. The database only allows it
//   because WE are an admin (RLS policy + the protect_profile_privileged_columns
//   trigger). A player sending the same request would get an error.
// - Deactivate = soft delete (is_active = false). The user can still log in,
//   but RLS hides all data from them and blocks new entries. Nothing is deleted.
// - Create accounts and change email/password: through the admin-users Edge
//   Function (needs the secret key, so it can't run in this page). See
//   src/lib/admin-users.ts and supabase/functions/admin-users.

import { ChevronRight, Pencil, Search, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { useAuth } from '../auth/auth-context';
import { EditUserForm } from '../components/EditUserForm';
import { NewUserForm } from '../components/NewUserForm';
import { Avatar, PageHeader, Segmented } from '../components/ui';
import { useFeedback } from '../feedback/feedback-context';
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

type StatusFilter = 'active' | 'inactive' | 'all';

export function UsersPage() {
  const { profile: me } = useAuth();
  const { toast, confirm } = useFeedback();
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [accounts, setAccounts] = useState<Map<string, AccountInfo>>(new Map());
  const [savingId, setSavingId] = useState<string | null>(null);
  // Which form is open: none, "new user", or editing one user (by id).
  const [form, setForm] = useState<{ kind: 'none' } | { kind: 'new' } | { kind: 'edit'; userId: string }>({ kind: 'none' });
  // Bump this number to load the list again (e.g. after saving).
  const [reloadKey, setReloadKey] = useState(0);

  // Search + filters
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  useEffect(() => {
    let cancelled = false; // ignore the answer if we've left the page meanwhile
    void fetchUsers().then((result) => {
      if (cancelled) return;
      if (result.error) toast(`Kunne ikke hente alt: ${result.error}`, 'error');
      setUsers(result.users);
      setAccounts(result.accounts);
    });
    return () => {
      cancelled = true;
    };
    // toast is stable for our purposes; we only refetch on reloadKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  async function update(user: Profile, changes: Partial<Pick<Profile, 'role' | 'is_active'>>, okText: string) {
    setSavingId(user.id);
    // .select() makes Supabase return the updated row, so we can tell
    // "saved" apart from "silently blocked by RLS" (0 rows).
    const { data, error } = await supabase.from('profiles').update(changes).eq('id', user.id).select('id');
    setSavingId(null);
    if (error || !data?.length) toast(`Kunne ikke lagre: ${error?.message ?? 'ingen tilgang'}`, 'error');
    else toast(okText);
    setReloadKey((k) => k + 1);
  }

  async function toggleActive(user: Profile) {
    if (user.is_active) {
      const ok = await confirm({
        title: `Deaktivere ${user.display_name}?`,
        body: 'Brukeren mister tilgangen til appen og alle sine data, men ingenting slettes. Du kan aktivere kontoen igjen når som helst.',
        confirmLabel: 'Deaktiver',
        danger: true,
      });
      if (!ok) return;
    }
    await update(
      user,
      { is_active: !user.is_active },
      user.is_active ? `${user.display_name} er deaktivert.` : `${user.display_name} er aktivert igjen.`,
    );
  }

  // After a form saves: close it, show what happened, reload the list.
  function formDone(summary: string) {
    setForm({ kind: 'none' });
    toast(summary, 'success', { long: true }); // may contain a temporary password to copy
    setReloadKey((k) => k + 1);
  }

  if (users === null) return <p className="muted">Laster brukere…</p>;
  const editing = form.kind === 'edit' ? users.find((u) => u.id === form.userId) : undefined;

  const q = query.trim().toLowerCase();
  const visible = users.filter((u) => {
    const email = accounts.get(u.id)?.email ?? '';
    if (q && !u.display_name.toLowerCase().includes(q) && !email.toLowerCase().includes(q)) return false;
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter === 'active' && !u.is_active) return false;
    if (statusFilter === 'inactive' && u.is_active) return false;
    return true;
  });
  const inactiveCount = users.filter((u) => !u.is_active).length;

  return (
    <div className="stack-lg">
      <PageHeader
        title="Brukere"
        subtitle={`${users.length} kontoer · ${users.length - inactiveCount} aktive`}
        actions={
          <button className="primary" onClick={() => setForm({ kind: 'new' })}>
            <UserPlus size={15} /> Ny bruker
          </button>
        }
      />

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

      <section className="card flush">
        <div className="row" style={{ padding: '16px 20px', gap: 14 }}>
          <div className="search" style={{ width: 280 }}>
            <Search size={15} />
            <input type="search" placeholder="Søk etter navn eller e-post" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | 'all')} aria-label="Filtrer på rolle">
            <option value="all">Alle roller</option>
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <Segmented
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'active', label: 'Aktive' },
              { value: 'inactive', label: `Deaktiverte (${inactiveCount})` },
              { value: 'all', label: 'Alle' },
            ]}
          />
        </div>

        <div className="table-wrap">
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
              {visible.map((user) => {
                const isMe = user.id === me?.id;
                const busy = savingId === user.id;
                const account = accounts.get(user.id);
                return (
                  <tr key={user.id}>
                    <td>
                      <Link to={`/users/${user.id}`} className="row" style={{ gap: 12, flexWrap: 'nowrap', color: 'var(--text)' }}>
                        <Avatar name={user.display_name} id={user.id} />
                        <span>
                          {user.display_name || <span className="faint">(uten navn)</span>}
                          {isMe && <span className="faint small"> (deg)</span>}
                        </span>
                      </Link>
                    </td>
                    <td className="muted">{account?.email ?? '–'}</td>
                    <td>
                      <select
                        value={user.role}
                        // You can't change your own role here — otherwise it's easy
                        // to lock yourself (or the last admin) out by mistake.
                        disabled={isMe || busy}
                        title={isMe ? 'Du kan ikke endre din egen rolle' : undefined}
                        aria-label={`Rolle for ${user.display_name}`}
                        onChange={(e) => {
                          const role = e.target.value as Role;
                          void update(user, { role }, `${user.display_name} er nå ${ROLE_LABELS[role].toLowerCase()}.`);
                        }}>
                        {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`pill ${user.is_active ? 'ok' : 'off'}`}>{user.is_active ? 'Aktiv' : 'Deaktivert'}</span>
                    </td>
                    <td className="muted small">{account?.last_sign_in_at ? formatDateTime(account.last_sign_in_at) : 'Aldri'}</td>
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        <button className="small" disabled={busy} onClick={() => setForm({ kind: 'edit', userId: user.id })}>
                          <Pencil size={12} /> Rediger
                        </button>
                        {!isMe && (
                          <button className={`small ${user.is_active ? 'danger' : ''}`} disabled={busy} onClick={() => void toggleActive(user)}>
                            {user.is_active ? 'Deaktiver' : 'Aktiver'}
                          </button>
                        )}
                        <Link to={`/users/${user.id}`} aria-label={`Åpne ${user.display_name}`} className="muted">
                          <ChevronRight size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                    Ingen brukere passer filteret.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <p className="faint small" style={{ margin: 0 }}>
        Roller for trener og foresatt kan settes allerede nå, men de har ingen egne skjermer ennå.
      </p>
    </div>
  );
}
