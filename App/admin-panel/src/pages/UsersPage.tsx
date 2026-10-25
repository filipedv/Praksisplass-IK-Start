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
import { Link, useSearchParams } from 'react-router';

import { useAuth } from '../auth/auth-context';
import { EditUserForm } from '../components/EditUserForm';
import { NewUserForm } from '../components/NewUserForm';
import { Avatar, PageHeader, Segmented } from '../components/ui';
import { useFeedback } from '../feedback/feedback-context';
import { listAccounts, type AccountInfo } from '../lib/admin-users';
import { formatDateTime } from '../lib/format';
import { usePersistentState } from '../lib/persist';
import { supabase } from '../lib/supabase';
import { listTeams, setUserTeam } from '../lib/teams-api';
import { ROLE_LABELS, type Profile, type Role, type Team, PROFILE_COLUMNS } from '../lib/types';
import { t } from '../lib/i18n';

/** All profiles (RLS lets admins see everyone's) + emails/last login from Auth. */
async function fetchUsers() {
  const [profiles, accounts, teams] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLUMNS).order('display_name'),
    listAccounts(),
    listTeams(),
  ]);
  return {
    teams,
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
  const [teams, setTeams] = useState<Team[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Which form is open: none, "new user", or editing one user (by id).
  const [form, setForm] = useState<{ kind: 'none' } | { kind: 'new' } | { kind: 'edit'; userId: string }>({ kind: 'none' });
  // Bump this number to load the list again (e.g. after saving).
  const [reloadKey, setReloadKey] = useState(0);

  // Search + filters (filters are remembered between visits).
  // A link like /users?team=<id> (from the Lag page) overrides the team filter.
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = usePersistentState<Role | 'all'>('users-role', 'all');
  const [statusFilter, setStatusFilter] = usePersistentState<StatusFilter>('users-status', 'active');
  const [savedTeamFilter, setTeamFilter] = usePersistentState<string>('users-team', 'all'); // 'all' | 'none' | team id
  const teamFilter = searchParams.get('team') ?? savedTeamFilter;

  useEffect(() => {
    let cancelled = false; // ignore the answer if we've left the page meanwhile
    void fetchUsers().then((result) => {
      if (cancelled) return;
      if (result.error) toast(`${t('Kunne ikke hente alt', "Couldn't load everything")}: ${result.error}`, 'error');
      setUsers(result.users);
      setAccounts(result.accounts);
      setTeams(result.teams);
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
    if (error || !data?.length) toast(`${t('Kunne ikke lagre', "Couldn't save")}: ${error?.message ?? t('ingen tilgang', 'no access')}`, 'error');
    else toast(okText);
    setReloadKey((k) => k + 1);
  }

  async function changeTeam(user: Profile, teamId: string) {
    setSavingId(user.id);
    try {
      await setUserTeam(user.id, teamId || null);
      const name = teams.find((team) => team.id === teamId)?.name;
      toast(
        name
          ? t(`${user.display_name} er nå på ${name}.`, `${user.display_name} is now on ${name}.`)
          : t(`${user.display_name} er tatt ut av laget.`, `${user.display_name} has been removed from the team.`),
      );
    } catch (e) {
      toast(`${t('Kunne ikke bytte lag', "Couldn't change team")}: ${(e as Error).message}`, 'error');
    } finally {
      setSavingId(null);
      setReloadKey((k) => k + 1);
    }
  }

  async function toggleActive(user: Profile) {
    if (user.is_active) {
      const ok = await confirm({
        title: t(`Deaktivere ${user.display_name}?`, `Deactivate ${user.display_name}?`),
        body: t(
          'Brukeren mister tilgangen til appen og alle sine data, men ingenting slettes. Du kan aktivere kontoen igjen når som helst.',
          'The user loses access to the app and all their data, but nothing is deleted. You can activate the account again at any time.',
        ),
        confirmLabel: t('Deaktiver', 'Deactivate'),
        danger: true,
      });
      if (!ok) return;
    }
    await update(
      user,
      { is_active: !user.is_active },
      user.is_active
        ? t(`${user.display_name} er deaktivert.`, `${user.display_name} has been deactivated.`)
        : t(`${user.display_name} er aktivert igjen.`, `${user.display_name} has been activated again.`),
    );
  }

  // After a form saves: close it, show what happened, reload the list.
  function formDone(summary: string) {
    setForm({ kind: 'none' });
    toast(summary, 'success', { long: true }); // may contain a temporary password to copy
    setReloadKey((k) => k + 1);
  }

  if (users === null) return <p className="muted">{t('Laster brukere…', 'Loading users…')}</p>;
  const editing = form.kind === 'edit' ? users.find((u) => u.id === form.userId) : undefined;

  const q = query.trim().toLowerCase();
  const visible = users.filter((u) => {
    const email = accounts.get(u.id)?.email ?? '';
    if (q && !u.display_name.toLowerCase().includes(q) && !email.toLowerCase().includes(q)) return false;
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter === 'active' && !u.is_active) return false;
    if (statusFilter === 'inactive' && u.is_active) return false;
    if (teamFilter === 'none' && u.team_id) return false;
    if (teamFilter !== 'all' && teamFilter !== 'none' && u.team_id !== teamFilter) return false;
    return true;
  });
  const inactiveCount = users.filter((u) => !u.is_active).length;

  return (
    <div className="stack-lg">
      <PageHeader
        title={t('Brukere', 'Users')}
        subtitle={t(`${users.length} kontoer · ${users.length - inactiveCount} aktive`, `${users.length} accounts · ${users.length - inactiveCount} active`)}
        actions={
          <button className="primary" onClick={() => setForm({ kind: 'new' })}>
            <UserPlus size={15} /> {t('Ny bruker', 'New user')}
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
            <input type="search" placeholder={t('Søk etter navn eller e-post', 'Search by name or email')} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | 'all')} aria-label={t('Filtrer på rolle', 'Filter by role')}>
            <option value="all">{t('Alle roller', 'All roles')}</option>
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} aria-label={t('Filtrer på lag', 'Filter by team')}>
            <option value="all">{t('Alle lag', 'All teams')}</option>
            <option value="none">{t('Uten lag', 'No team')}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <Segmented
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'active', label: t('Aktive', 'Active') },
              { value: 'inactive', label: `${t('Deaktiverte', 'Deactivated')} (${inactiveCount})` },
              { value: 'all', label: t('Alle', 'All') },
            ]}
          />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('Navn', 'Name')}</th>
                <th>{t('E-post', 'Email')}</th>
                <th>{t('Rolle', 'Role')}</th>
                <th>{t('Lag', 'Team')}</th>
                <th>Status</th>
                <th>{t('Sist innlogget', 'Last signed in')}</th>
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
                          {user.display_name || <span className="faint">{t('(uten navn)', '(no name)')}</span>}
                          {isMe && <span className="faint small"> {t('(deg)', '(you)')}</span>}
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
                        title={isMe ? t('Du kan ikke endre din egen rolle', "You can't change your own role") : undefined}
                        aria-label={`${t('Rolle for', 'Role for')} ${user.display_name}`}
                        onChange={(e) => {
                          const role = e.target.value as Role;
                          void update(user, { role }, t(`${user.display_name} er nå ${ROLE_LABELS[role].toLowerCase()}.`, `${user.display_name} is now ${ROLE_LABELS[role].toLowerCase()}.`));
                        }}>
                        {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={user.team_id ?? ''}
                        disabled={busy}
                        aria-label={`${t('Lag for', 'Team for')} ${user.display_name}`}
                        onChange={(e) => void changeTeam(user, e.target.value)}>
                        <option value="">{t('Uten lag', 'No team')}</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`pill ${user.is_active ? 'ok' : 'off'}`}>{user.is_active ? t('Aktiv', 'Active') : t('Deaktivert', 'Deactivated')}</span>
                    </td>
                    <td className="muted small">{account?.last_sign_in_at ? formatDateTime(account.last_sign_in_at) : t('Aldri', 'Never')}</td>
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        <button className="small" disabled={busy} onClick={() => setForm({ kind: 'edit', userId: user.id })}>
                          <Pencil size={12} /> {t('Rediger', 'Edit')}
                        </button>
                        {!isMe && (
                          <button className={`small ${user.is_active ? 'danger' : ''}`} disabled={busy} onClick={() => void toggleActive(user)}>
                            {user.is_active ? t('Deaktiver', 'Deactivate') : t('Aktiver', 'Activate')}
                          </button>
                        )}
                        <Link to={`/users/${user.id}`} aria-label={`${t('Åpne', 'Open')} ${user.display_name}`} className="muted">
                          <ChevronRight size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                    {t('Ingen brukere passer filteret.', 'No users match the filter.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <p className="faint small" style={{ margin: 0 }}>
        {t(
          'Roller for trener og foresatt kan settes allerede nå, men de har ingen egne skjermer ennå.',
          "Coach and guardian roles can already be set, but they don't have their own screens yet.",
        )}
      </p>
    </div>
  );
}
