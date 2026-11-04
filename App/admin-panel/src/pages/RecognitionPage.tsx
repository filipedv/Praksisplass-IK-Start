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

import { CorrectionsCard } from '../components/CorrectionsCard';
import { LinkFoodDialog } from '../components/LinkFoodDialog';
import { PageHeader, StatTile } from '../components/ui';
import { useFeedback } from '../feedback/feedback-context';
import { listAliases, normalizeLabel, removeAlias, type FoodAlias } from '../lib/aliases-api';
import { formatDateTime, formatNumber } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { RecognitionEvent } from '../lib/types';
import { t } from '../lib/i18n';

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
      .catch((e) => !cancelled && toast(`${t('Kunne ikke hente koblinger', "Couldn't load links")}: ${e.message}`, 'error'));
    return () => {
      cancelled = true;
    };
    // toast is stable for our purposes; we only refetch on aliasesKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aliasesKey]);

  async function unlink(alias: FoodAlias) {
    const ok = await confirm({
      title: t(`Fjerne koblingen for «${alias.label}»?`, `Remove the link for “${alias.label}”?`),
      body: t('Appen går tilbake til å gjette matvaren for denne etiketten.', 'The app goes back to guessing the food for this label.'),
      confirmLabel: t('Fjern kobling', 'Remove link'),
      danger: true,
    });
    if (!ok) return;
    try {
      await removeAlias(alias.id);
      toast(t(`Koblingen for «${alias.label}» er fjernet.`, `The link for “${alias.label}” was removed.`));
    } catch (e) {
      toast(`${t('Kunne ikke fjerne', "Couldn't remove")}: ${(e as Error).message}`, 'error');
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

  if (error) return <p className="error">{t('Kunne ikke hente data', "Couldn't load data")}: {error}</p>;
  if (events === null) return <p className="muted">{t('Laster…', 'Loading…')}</p>;

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
        title={t('Gjenkjenning', 'Recognition')}
        subtitle={t(
          `Basert på de siste ${Math.min(events.length, LIMIT)} bildene. «Ikke funnet» = etiketten fikk ingen god match i Matvaretabellen, og spilleren måtte velge selv.`,
          `Based on the last ${Math.min(events.length, LIMIT)} photos. “Not found” = the label got no good match in Matvaretabellen, and the player had to choose.`,
        )}
      />

      {events.length === 0 ? (
        <p className="muted">{t('Ingen bilder er gjenkjent ennå.', 'No photos recognized yet.')}</p>
      ) : (
        <>
          <div className="kpi-row">
            <StatTile label={t('Bilder', 'Photos')} value={events.length} />
            <StatTile label={t('Etiketter', 'Labels')} value={totalLabels} />
            <StatTile
              label={t('Funnet i Matvaretabellen', 'Found in Matvaretabellen')}
              value={totalLabels ? `${formatNumber(((totalLabels - totalUnmatched) / totalLabels) * 100)} %` : '–'}
              sub={`${totalUnmatched} ${t('ikke funnet', 'not found')}`}
            />
          </div>

          <section className="card flush">
            <div style={{ padding: '16px 20px 4px' }}>
              <h2>{t('Per gjenkjenner', 'Per recognizer')}</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('Gjenkjenner', 'Recognizer')}</th>
                    <th className="num">{t('Bilder', 'Photos')}</th>
                    <th className="num">{t('Etiketter', 'Labels')}</th>
                    <th className="num">{t('Ikke funnet', 'Not found')}</th>
                    <th className="num">{t('Andel ikke funnet', 'Share not found')}</th>
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
              <h2>{t('Etiketter som oftest ikke blir funnet', 'Labels most often not found')}</h2>
              <p className="faint small" style={{ margin: '4px 0 0' }}>
                {t(
                  'Koble etiketten til riktig matvare — appen bruker koblingen fra neste bilde. Historikken under endres ikke.',
                  'Link the label to the right food — the app uses the link from the next photo. The history below does not change.',
                )}
              </p>
            </div>
            {topUnmatched.length === 0 ? (
              <p className="muted" style={{ padding: '8px 20px 20px', margin: 0 }}>
                {t('Alle etiketter har fått en match.', 'Every label got a match.')}
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('Etikett', 'Label')}</th>
                      <th>{t('Gjenkjenner', 'Recognizer')}</th>
                      <th className="num">{t('Antall', 'Count')}</th>
                      <th>{t('Kobling', 'Link')}</th>
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
                              <span className="pill ok">✓ {alias.food?.name_nb ?? t('slettet matvare', 'deleted food')}</span>
                              <button className="small ghost" onClick={() => setLinking(label)}>
                                {t('Endre', 'Change')}
                              </button>
                            </span>
                          ) : (
                            <button className="small" onClick={() => setLinking(label)}>
                              <Link2 size={13} /> {t('Koble til matvare', 'Link to food')}
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

          <CorrectionsCard aliases={aliases} onLinked={() => setAliasesKey((k) => k + 1)} />

          <section className="card flush">
            <div style={{ padding: '16px 20px 4px' }}>
              <h2>
                {t('Koblinger', 'Links')} ({aliases.length})
              </h2>
              <p className="faint small" style={{ margin: '4px 0 0' }}>
                {t('Etiketter som alltid blir til en bestemt matvare. Sjekkes før appen gjetter.', 'Labels that always become a specific food. Checked before the app guesses.')}
              </p>
            </div>
            {aliases.length === 0 ? (
              <p className="muted" style={{ padding: '8px 20px 20px', margin: 0 }}>
                {t('Ingen koblinger ennå.', 'No links yet.')}
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('Etikett', 'Label')}</th>
                      <th>{t('Blir til', 'Becomes')}</th>
                      <th>{t('Opprettet', 'Created')}</th>
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
                              {a.food.source === 'custom' && <span className="pill warn" style={{ marginLeft: 8 }}>{t('Egendefinert', 'Custom')}</span>}
                            </>
                          ) : (
                            <span className="faint">{t('(matvaren er slettet)', '(the food was deleted)')}</span>
                          )}
                        </td>
                        <td className="muted small">{formatDateTime(a.created_at)}</td>
                        <td>
                          <div className="row" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                            <button className="small" onClick={() => setLinking(a.label)}>
                              {t('Endre', 'Change')}
                            </button>
                            <button className="small danger" onClick={() => void unlink(a)} aria-label={`${t('Fjern koblingen for', 'Remove the link for')} ${a.label}`}>
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
              <h2>{t('Siste bilder', 'Latest photos')}</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('Tid', 'Time')}</th>
                    <th>{t('Gjenkjenner', 'Recognizer')}</th>
                    <th>{t('Etiketter (grønn = funnet, rød = ikke funnet)', 'Labels (green = found, red = not found)')}</th>
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
