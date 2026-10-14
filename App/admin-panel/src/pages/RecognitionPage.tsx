// GJENKJENNING: how well recognizer labels match Matvaretabellen.
// Every photo the player app recognizes writes one row to recognition_events
// (labels only — never the photo). This page summarises the latest rows, so
// we can judge e.g. whether FatSecret's (US) labels cover Norwegian food.
//
// FatSecret's terms only allow storing its food_id, so its labels appear as
// "fatsecret:<id>". The mock's labels are plain text.

import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { PageHeader, StatTile } from '../components/ui';
import { formatDateTime, formatNumber } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { RecognitionEvent } from '../lib/types';

const LIMIT = 1000; // most recent events to analyse

type ProviderStats = { provider: string; photos: number; labels: number; unmatched: number };

export function RecognitionPage() {
  const [events, setEvents] = useState<RecognitionEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from('recognition_events')
      .select('id, provider, labels, unmatched_labels, created_at')
      .order('created_at', { ascending: false })
      .limit(LIMIT)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        setEvents((data ?? []) as RecognitionEvent[]);
      });
    return () => {
      cancelled = true;
    };
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
  const totalLabels = events.reduce((s, e) => s + e.labels.length, 0);
  const totalUnmatched = events.reduce((s, e) => s + e.unmatched_labels.length, 0);

  return (
    <div className="stack-lg">
      <PageHeader
        title="Gjenkjenning"
        subtitle={`Basert på de siste ${Math.min(events.length, LIMIT)} bildene. «Ikke funnet» = etiketten fikk ingen god match i Matvaretabellen, og spilleren måtte velge selv.`}
      />

      {events.length === 0 ? (
        <p className="muted">Ingen bilder er gjenkjent ennå.</p>
      ) : (
        <>
          <div className="kpi-row">
            <StatTile label="Bilder" value={events.length} />
            <StatTile label="Etiketter" value={totalLabels} />
            <StatTile
              label="Funnet i Matvaretabellen"
              value={totalLabels ? `${formatNumber(((totalLabels - totalUnmatched) / totalLabels) * 100)} %` : '–'}
              sub={`${totalUnmatched} ikke funnet`}
            />
          </div>

          <section className="card flush">
            <div style={{ padding: '16px 20px 4px' }}>
              <h2>Per gjenkjenner</h2>
            </div>
            <div className="table-wrap">
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
            </div>
          </section>

          <section className="card flush">
            <div style={{ padding: '16px 20px 4px' }}>
              <h2>Etiketter som oftest ikke blir funnet</h2>
              <p className="faint small" style={{ margin: '4px 0 0' }}>
                Rett opp med en egendefinert matvare under <Link to="/foods">Matvarer</Link> (engelsk navn = etiketten).
              </p>
            </div>
            {topUnmatched.length === 0 ? (
              <p className="muted" style={{ padding: '8px 20px 20px', margin: 0 }}>
                Alle etiketter har fått en match.
              </p>
            ) : (
              <div className="table-wrap">
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
              </div>
            )}
          </section>

          <section className="card flush">
            <div style={{ padding: '16px 20px 4px' }}>
              <h2>Siste bilder</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tid</th>
                    <th>Gjenkjenner</th>
                    <th>Etiketter (grønn = funnet, rød = ikke funnet)</th>
                  </tr>
                </thead>
                <tbody>
                  {events.slice(0, 20).map((e) => (
                    <tr key={e.id}>
                      <td className="muted">{formatDateTime(e.created_at)}</td>
                      <td>{e.provider}</td>
                      <td>
                        <div className="row" style={{ gap: 4 }}>
                          {e.labels.map((label, i) => {
                            const miss = e.unmatched_labels.includes(label);
                            return (
                              <span key={i} className={`pill ${miss ? 'off' : 'ok'}`}>
                                {miss ? '✕' : '✓'} {label}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
