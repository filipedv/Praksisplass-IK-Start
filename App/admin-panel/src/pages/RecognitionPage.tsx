// GJENKJENNING: how well recognizer labels match Matvaretabellen.
// Every photo the player app recognizes writes one row to recognition_events
// (labels only — never the photo). This page summarises the latest rows, so
// we can judge e.g. whether FatSecret's (US) labels cover Norwegian food.
//
// FatSecret's terms only allow storing its food_id, so its labels appear as
// "fatsecret:<id>". The mock's labels are plain text.
//
// Fixing a label = linking it to the right food ("Koble til matvare"). Links
// live in food_aliases; the player app checks them before fuzzy matching.

import { Link2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { LinkFoodDialog } from '../components/LinkFoodDialog';
import { PageHeader, StatTile } from '../components/ui';
import { useFeedback } from '../feedback/feedback-context';
import { listAliases, normalizeLabel, removeAlias, type FoodAlias } from '../lib/aliases-api';
import { formatDateTime, formatNumber } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { RecognitionEvent } from '../lib/types';

const LIMIT = 1000; // most recent events to analyse

type ProviderStats = { provider: string; photos: number; labels: number; unmatched: number };

export function RecognitionPage() {
  const { toast, confirm } = useFeedback();
  const [events, setEvents] = useState<RecognitionEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aliases, setAliases] = useState<FoodAlias[]>([]);
  const [aliasesKey, setAliasesKey] = useState(0); // bump to reload the links
  const [linking, setLinking] = useState<string | null>(null); // label in the dialog

  // The link list — reloaded after every change.
  useEffect(() => {
    let cancelled = false;
    listAliases()
      .then((rows) => !cancelled && setAliases(rows))
      .catch((e) => !cancelled && toast(`Kunne ikke hente koblinger: ${e.message}`, 'error'));
    return () => {
      cancelled = true;
    };
    // toast is stable for our purposes; we only refetch on aliasesKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aliasesKey]);

  async function unlink(alias: FoodAlias) {
    const ok = await confirm({
      title: `Fjerne koblingen for «${alias.label}»?`,
      body: 'Appen går tilbake til å gjette matvaren for denne etiketten.',
      confirmLabel: 'Fjern kobling',
      danger: true,
    });
    if (!ok) return;
    try {
      await removeAlias(alias.id);
      toast(`Koblingen for «${alias.label}» er fjernet.`);
    } catch (e) {
      toast(`Kunne ikke fjerne: ${(e as Error).message}`, 'error');
    }
    setAliasesKey((k) => k + 1);
  }

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
  // Labels already linked are fixed from now on — show the unfixed ones first.
  const aliasByLabel = new Map(aliases.map((a) => [a.label, a]));
  const topUnmatched = [...unmatchedCounts.entries()]
    .map(([key, count]) => {
      const [provider, label] = key.split('|');
      return { key, provider, label, count, alias: aliasByLabel.get(normalizeLabel(label)) };
    })
    .sort((a, b) => Number(!!a.alias) - Number(!!b.alias) || b.count - a.count)
    .slice(0, 30);
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
                Koble etiketten til riktig matvare — appen bruker koblingen fra neste bilde. Historikken under endres ikke.
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
                      <th>Kobling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topUnmatched.map(({ key, provider, label, count, alias }) => (
                      <tr key={key}>
                        <td>{label}</td>
                        <td className="muted">{provider}</td>
                        <td className="num">{count}</td>
                        <td>
                          {alias ? (
                            <span className="row" style={{ gap: 8 }}>
                              <span className="pill ok">✓ {alias.food?.name_nb ?? 'slettet matvare'}</span>
                              <button className="small ghost" onClick={() => setLinking(label)}>
                                Endre
                              </button>
                            </span>
                          ) : (
                            <button className="small" onClick={() => setLinking(label)}>
                              <Link2 size={13} /> Koble til matvare
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card flush">
            <div style={{ padding: '16px 20px 4px' }}>
              <h2>Koblinger ({aliases.length})</h2>
              <p className="faint small" style={{ margin: '4px 0 0' }}>
                Etiketter som alltid blir til en bestemt matvare. Sjekkes før appen gjetter.
              </p>
            </div>
            {aliases.length === 0 ? (
              <p className="muted" style={{ padding: '8px 20px 20px', margin: 0 }}>
                Ingen koblinger ennå.
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Etikett</th>
                      <th>Blir til</th>
                      <th>Opprettet</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {aliases.map((a) => (
                      <tr key={a.id}>
                        <td>{a.label}</td>
                        <td>
                          {a.food ? (
                            <>
                              {a.food.name_nb}
                              {a.food.source === 'custom' && <span className="pill warn" style={{ marginLeft: 8 }}>Egendefinert</span>}
                            </>
                          ) : (
                            <span className="faint">(matvaren er slettet)</span>
                          )}
                        </td>
                        <td className="muted small">{formatDateTime(a.created_at)}</td>
                        <td>
                          <div className="row" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                            <button className="small" onClick={() => setLinking(a.label)}>
                              Endre
                            </button>
                            <button className="small danger" onClick={() => void unlink(a)} aria-label={`Fjern koblingen for ${a.label}`}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
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

      {/* The dialog is mounted only while open; `key` starts it fresh per label. */}
      {linking && (
        <LinkFoodDialog
          key={linking}
          label={linking}
          onClose={(linked) => {
            setLinking(null);
            if (linked) setAliasesKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
