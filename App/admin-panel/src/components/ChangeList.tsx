// A list of change-log entries ("who changed what, when"), used on the
// Endringslogg page and on each player's page.

import { ACTION_LABELS, FIELD_LABELS, TABLE_LABELS, formatValue } from '../lib/audit-api';
import { formatDateTime } from '../lib/format';
import type { AuditEntry } from '../lib/types';

type Props = {
  entries: AuditEntry[];
  /** id → readable name (teams, users, foods) so ids show as names. */
  names?: Map<string, string>;
  showSubject?: boolean;
};

export function ChangeList({ entries, names, showSubject }: Props) {
  if (entries.length === 0) return <p className="muted" style={{ margin: 0 }}>Ingen endringer registrert.</p>;

  // Show a value: a known id → its name, otherwise the short format.
  const show = (value: unknown, field: string) =>
    typeof value === 'string' && names?.has(value) ? names.get(value)! : formatValue(value, field);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tid</th>
            <th>Hvem</th>
            <th>Hva</th>
            {showSubject && <th>Gjelder</th>}
            <th>Endring</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const fields = Object.entries(e.changes);
            return (
              <tr key={e.id}>
                <td className="muted small" style={{ whiteSpace: 'nowrap' }}>
                  {formatDateTime(e.at)}
                </td>
                <td>{e.actor_name ?? <span className="faint">ukjent</span>}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <span className={`pill ${e.action === 'delete' ? 'off' : e.action === 'insert' ? 'ok' : ''}`}>
                    {ACTION_LABELS[e.action]}
                  </span>{' '}
                  {TABLE_LABELS[e.table_name] ?? e.table_name}
                </td>
                {showSubject && (
                  <td className="muted">
                    {e.subject_user_id ? (names?.get(e.subject_user_id) ?? <span className="faint">slettet bruker</span>) : '–'}
                  </td>
                )}
                <td className="small">
                  {fields.length === 0 ? (
                    <span className="faint">–</span>
                  ) : (
                    fields.slice(0, 4).map(([field, [before, after]]) => (
                      <div key={field}>
                        <span className="muted">{FIELD_LABELS[field] ?? field}:</span>{' '}
                        {e.action === 'insert' ? (
                          show(after, field)
                        ) : e.action === 'delete' ? (
                          <s className="faint">{show(before, field)}</s>
                        ) : (
                          <>
                            {show(before, field)} → <strong>{show(after, field)}</strong>
                          </>
                        )}
                      </div>
                    ))
                  )}
                  {fields.length > 4 && <span className="faint">+{fields.length - 4} til</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
