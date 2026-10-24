// ENDRINGSLOGG: who changed what, and when — filled by the database itself
// (triggers + the admin-users Edge Function), so it can't be skipped or faked
// from an app. Only admins can read it.
//
// Logged: changes to accounts, profiles (role, team, active, name), goals,
// teams, links, foods and club settings, plus admins' corrections of other
// people's meals. NOT logged: players logging their own meals and water.

import { Download, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ChangeList } from '../components/ChangeList';
import { PageHeader } from '../components/ui';
import { useFeedback } from '../feedback/feedback-context';
import { ACTION_LABELS, FIELD_LABELS, TABLE_LABELS, fetchAudit, formatValue } from '../lib/audit-api';
import { downloadFile, toCsv } from '../lib/download';
import { usePersistentState } from '../lib/persist';
import { supabase } from '../lib/supabase';
import type { AuditEntry } from '../lib/types';

const PAGE_SIZE = 100;

export function AuditPage() {
  const { toast } = useFeedback();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [tableFilter, setTableFilter] = usePersistentState<string>('log-table', 'all');
  const [query, setQuery] = useState('');

  // First page + names for ids (users, teams, foods referenced in links).
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchAudit({ limit: PAGE_SIZE }),
      supabase.from('profiles').select('id, display_name'),
      supabase.from('teams').select('id, name'),
    ])
      .then(([rows, profiles, teams]) => {
        if (cancelled) return;
        setEntries(rows);
        setHasMore(rows.length === PAGE_SIZE);
        setNames(
          new Map([
            ...(profiles.data ?? []).map((p) => [p.id, p.display_name] as [string, string]),
            ...(teams.data ?? []).map((t) => [t.id, t.name] as [string, string]),
          ]),
        );
      })
      .catch((e) => !cancelled && toast(`Kunne ikke hente loggen: ${e.message}`, 'error'));
    return () => {
      cancelled = true;
    };
    // toast is stable for our purposes; load once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMore() {
    if (!entries?.length) return;
    try {
      const more = await fetchAudit({ limit: PAGE_SIZE, before: entries[entries.length - 1].id });
      setEntries([...entries, ...more]);
      setHasMore(more.length === PAGE_SIZE);
    } catch (e) {
      toast(`Kunne ikke hente flere: ${(e as Error).message}`, 'error');
    }
  }

  if (entries === null) return <p className="muted">Laster endringslogg…</p>;

  const q = query.trim().toLowerCase();
  const visible = entries.filter((e) => {
    if (tableFilter !== 'all' && e.table_name !== tableFilter) return false;
    if (!q) return true;
    const haystack = [e.actor_name, e.subject_user_id ? names.get(e.subject_user_id) : '', JSON.stringify(e.changes)]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  function exportCsv() {
    const csv = toCsv(visible, [
      { header: 'Tid', value: (e) => new Date(e.at).toLocaleString('nb-NO') },
      { header: 'Hvem', value: (e) => e.actor_name ?? '' },
      { header: 'Handling', value: (e) => ACTION_LABELS[e.action] },
      { header: 'Hva', value: (e) => TABLE_LABELS[e.table_name] ?? e.table_name },
      { header: 'Gjelder', value: (e) => (e.subject_user_id ? (names.get(e.subject_user_id) ?? 'slettet bruker') : '') },
      {
        header: 'Endring',
        value: (e) =>
          Object.entries(e.changes)
            .map(([f, [a, b]]) => `${FIELD_LABELS[f] ?? f}: ${formatValue(a, f)} → ${formatValue(b, f)}`)
            .join(', '),
      },
    ]);
    downloadFile(`endringslogg_${new Date().toISOString().slice(0, 10)}.csv`, csv, 'csv');
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Endringslogg"
        subtitle="Hvem som endret hva — føres automatisk av databasen og kan ikke redigeres"
        actions={
          <button onClick={exportCsv}>
            <Download size={14} /> Eksporter (CSV)
          </button>
        }
      />
      <section className="card flush">
        <div className="row" style={{ padding: '16px 20px', gap: 14 }}>
          <div className="search" style={{ width: 300 }}>
            <Search size={15} />
            <input type="search" placeholder="Søk på person eller endring" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select value={tableFilter} onChange={(e) => setTableFilter(e.target.value)} aria-label="Type endring">
            <option value="all">Alle typer</option>
            {Object.entries(TABLE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <span className="faint small">
            Viser {visible.length} av {entries.length} hentede
          </span>
        </div>
        <ChangeList entries={visible} names={names} showSubject />
        {hasMore && (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <button onClick={() => void loadMore()}>Vis eldre endringer</button>
          </div>
        )}
      </section>
      <p className="faint small" style={{ margin: 0 }}>
        Logges ikke: spillere som fører egne måltider og vann, og endringer gjort direkte i Supabase-dashboardet.
      </p>
    </div>
  );
}
