// GJENKJENNING: how well recognizer labels match Matvaretabellen.
// Every photo the player app recognizes writes one row to recognition_events
// (labels only — never the photo). This page summarises the latest rows, so
// we can judge e.g. whether FatSecret's (US) labels cover Norwegian food.
//
// FatSecret's terms only allow storing its food_id, so its labels appear as
// "fatsecret:<id>". The mock's labels are plain text.

import { useEffect, useState } from 'react';

import { formatDateTime, formatNumber } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { RecognitionEvent } from '../lib/types';

const LIMIT = 1000; // most recent events to analyse

type ProviderStats = { provider: string; photos: number; labels: number; unmatched: number };

export function RecognitionPage() {
  const [events, setEvents] = useState<RecognitionEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase
      .from('recognition_events')
      .select('id, provider, labels, unmatched_labels, created_at')
      .order('created_at', { ascending: false })
      .limit(LIMIT)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setEvents((data ?? []) as RecognitionEvent[]);
      });
  }, []);

  if (error) return <p className="error">Kunne ikke hente data: {error}</p>;
  if (events === null) return <p className="muted">Laster…</p>;

  // ---- Per provider: how many labels failed to match? ----
  const byProvider = new Map<string, ProviderStats>();
  // ---- Which labels fail most often? ----
  const unmatchedCounts = new Map<string, number>();

  for (const e of events) {
    const stats = byProvider.get(e.provider) ?? { provider: e.provider, photos: 0, labels: 0, unmatched: 0 };
    stats.photos += 1;
    stats.labels += e.labels.length;
    stats.unmatched += e.unmatched_labels.length;
    byProvider.set(e.provider, stats);
    for (const label of e.unmatched_labels) {
      const key = `${e.provider}|${label}`;
      unmatchedCounts.set(key, (unmatchedCounts.get(key) ?? 0) + 1);
    }
  }
  const topUnmatched = [...unmatchedCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);

  return (
    <div className="stack">
      <h1>Gjenkjenning</h1>
      <p className="muted">
        Basert på de siste {Math.min(events.length, LIMIT)} bildene. «Ikke funnet» = etiketten fikk ingen god match i
        Matvaretabellen, og spilleren måtte velge selv.
      </p>

      {events.length === 0 ? (
        <p className="muted">Ingen bilder er gjenkjent ennå.</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Gjenkjenner</th>
                <th className="num">Bilder</th>
                <th className="num">Etiketter</th>
                <th className="num">Ikke funnet</th>
                <th className="num">Andel ikke funnet</th>
              </tr>
            </thead>
            <tbody>
              {[...byProvider.values()].map((s) => (
                <tr key={s.provider}>
                  <td>{s.provider}</td>
                  <td className="num">{s.photos}</td>
                  <td className="num">{s.labels}</td>
                  <td className="num">{s.unmatched}</td>
                  <td className="num">{s.labels ? `${formatNumber((s.unmatched / s.labels) * 100)} %` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Etiketter som oftest ikke blir funnet</h2>
          <p className="muted small" style={{ margin: 0 }}>
            Rett opp med en egendefinert matvare under «Matvarer» (engelsk navn = etiketten).
          </p>
          {topUnmatched.length === 0 ? (
            <p className="muted">Alle etiketter har fått en match.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Etikett</th>
                  <th>Gjenkjenner</th>
                  <th className="num">Antall</th>
                </tr>
              </thead>
              <tbody>
                {topUnmatched.map(([key, count]) => {
                  const [provider, label] = key.split('|');
                  return (
                    <tr key={key}>
                      <td>{label}</td>
                      <td className="muted">{provider}</td>
                      <td className="num">{count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <h2>Siste bilder</h2>
          <table>
            <thead>
              <tr>
                <th>Tid</th>
                <th>Gjenkjenner</th>
                <th>Etiketter</th>
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 20).map((e) => (
                <tr key={e.id}>
                  <td className="muted">{formatDateTime(e.created_at)}</td>
                  <td>{e.provider}</td>
                  <td>
                    {e.labels.map((label, i) => (
                      <span key={i} className={`badge ${e.unmatched_labels.includes(label) ? 'off' : 'ok'}`} style={{ marginRight: 4 }}>
                        {label}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
