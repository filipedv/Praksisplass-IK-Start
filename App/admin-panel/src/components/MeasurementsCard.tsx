// "Vekt og høyde" on a player's page (coach dashboard sketch): a weight chart
// and a height chart, a "rapid weight change" notice, a form to add or
// correct a measurement, and the full history (= the charts' table view).
// Entries come from staff (weigh-ins) and from the player's own app; the
// history shows who entered each one.

import { Pencil, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useFeedback } from '../feedback/feedback-context';
import {
  deleteMeasurement,
  detectWeightChange,
  fetchMeasurements,
  saveMeasurement,
  type Measurement,
} from '../lib/body-api';
import { formatNumber, toISODate } from '../lib/format';
import { LineChart } from './LineChart';
import { locale, t } from '../lib/i18n';

const longDate = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });

/** "72,4" or "72.4" → 72.4; empty → null; anything else → NaN (invalid). */
function parseDecimal(text: string): number | null {
  const t = text.trim().replace(',', '.');
  return t === '' ? null : Number(t);
}

type Draft = { id?: string; date: string; weight: string; height: string };

export function MeasurementsCard({ userId, playerName }: { userId: string; playerName: string }) {
  const { toast, confirm } = useFeedback();
  const [todayIso] = useState(() => toISODate(new Date()));
  const emptyDraft = (): Draft => ({ date: todayIso, weight: '', height: '' });
  const [items, setItems] = useState<Measurement[] | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchMeasurements(userId)
      .then((rows) => !cancelled && setItems(rows))
      .catch((e) => {
        if (cancelled) return;
        setItems([]);
        toast(`${t('Kunne ikke hente målinger', "Couldn't load measurements")}: ${e.message}`, 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey, toast]);

  async function save() {
    const weight = parseDecimal(draft.weight);
    const height = parseDecimal(draft.height);
    if (weight === null && height === null) return toast(t('Fyll inn vekt, høyde eller begge.', 'Fill in weight, height or both.'), 'error');
    if (weight !== null && !(weight >= 20 && weight <= 250)) return toast(t('Vekten må være mellom 20 og 250 kg.', 'Weight must be between 20 and 250 kg.'), 'error');
    if (height !== null && !(height >= 100 && height <= 230)) return toast(t('Høyden må være mellom 100 og 230 cm.', 'Height must be between 100 and 230 cm.'), 'error');
    if (!draft.date || draft.date > todayIso) return toast(t('Velg en dato som ikke er fram i tid.', 'Choose a date that is not in the future.'), 'error');
    setBusy(true);
    try {
      await saveMeasurement(userId, { measured_on: draft.date, weight_kg: weight, height_cm: height }, draft.id);
      toast(draft.id ? t('Målingen er oppdatert.', 'The measurement has been updated.') : t(`Måling lagt til for ${playerName}.`, `Measurement added for ${playerName}.`));
      setDraft(emptyDraft());
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast(`${t('Kunne ikke lagre', "Couldn't save")}: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: Measurement) {
    const ok = await confirm({
      title: t('Slette målingen?', 'Delete the measurement?'),
      body: `${longDate(m.measured_on)}: ${describe(m)}.`,
      confirmLabel: t('Slett', 'Delete'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMeasurement(m.id);
      if (draft.id === m.id) setDraft(emptyDraft());
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast(`${t('Kunne ikke slette', "Couldn't delete")}: ${(e as Error).message}`, 'error');
    }
  }

  const list = items ?? [];
  const point = (m: Measurement, value: number) => ({ key: m.id, date: m.measured_on, value, title: longDate(m.measured_on) });
  const weights = list.filter((m) => m.weight_kg !== null).map((m) => point(m, m.weight_kg!));
  const heights = list.filter((m) => m.height_cm !== null).map((m) => point(m, m.height_cm!));
  const change = detectWeightChange(list);

  return (
    <section className="card stack-lg">
      <div className="card-header" style={{ marginBottom: 0 }}>
        <h2>{t('Vekt og høyde', 'Weight and height')}</h2>
        <span className="faint small">{t('Fra veiinger og spillerens egne registreringer', "From weigh-ins and the player's own entries")}</span>
      </div>

      {change && (
        <div className="notice warn">
          {change.diffKg < 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
          <span>
            {t(
              `${change.diffKg < 0 ? 'Ned' : 'Opp'} ${formatNumber(Math.abs(change.diffKg), 1)} kg på ${change.days} dager — sjekk om dette er forventet vekst eller verdt å følge opp. Ikke en diagnose, bare et varsel.`,
              `${change.diffKg < 0 ? 'Down' : 'Up'} ${formatNumber(Math.abs(change.diffKg), 1)} kg in ${change.days} days — check whether this is expected growth or worth following up. Not a diagnosis, just a flag.`,
            )}
          </span>
        </div>
      )}

      <div className="grid-2">
        <div>
          <h3 className="chart-title">{t('Vekt over tid', 'Weight over time')}</h3>
          <LineChart data={weights} unit="kg" color="var(--series-weight)" ariaLabel={t(`Vekt over tid for ${playerName}`, `Weight over time for ${playerName}`)} />
        </div>
        <div>
          <h3 className="chart-title">{t('Høyde over tid', 'Height over time')}</h3>
          <LineChart data={heights} unit="cm" color="var(--series-height)" ariaLabel={t(`Høyde over tid for ${playerName}`, `Height over time for ${playerName}`)} />
        </div>
      </div>

      <div className="grid-2">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}>
          <h3 className="chart-title">{draft.id ? t('Rediger måling', 'Edit measurement') : t('Legg til måling', 'Add measurement')}</h3>
          <label>
            {t('Dato', 'Date')}
            <input type="date" value={draft.date} max={todayIso} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </label>
          <div className="grid-2" style={{ gap: 12 }}>
            <label>
              {t('Vekt (kg)', 'Weight (kg)')}
              <input inputMode="decimal" placeholder="–" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value })} />
            </label>
            <label>
              {t('Høyde (cm)', 'Height (cm)')}
              <input inputMode="decimal" placeholder="–" value={draft.height} onChange={(e) => setDraft({ ...draft, height: e.target.value })} />
            </label>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button type="submit" className="primary" disabled={busy}>
              <Plus size={14} /> {draft.id ? t('Lagre endring', 'Save change') : t('Legg til måling', 'Add measurement')}
            </button>
            {draft.id && (
              <button type="button" onClick={() => setDraft(emptyDraft())} disabled={busy}>
                {t('Avbryt', 'Cancel')}
              </button>
            )}
          </div>
        </form>

        <div className="stack" style={{ gap: 6 }}>
          <h3 className="chart-title">{t('Målehistorikk', 'Measurement history')}</h3>
          {items === null ? (
            <p className="muted small">{t('Laster…', 'Loading…')}</p>
          ) : list.length === 0 ? (
            <p className="muted small">{t('Ingen målinger registrert ennå.', 'No measurements recorded yet.')}</p>
          ) : (
            <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{t('Dato', 'Date')}</th>
                    <th className="num">{t('Vekt (kg)', 'Weight (kg)')}</th>
                    <th className="num">{t('Høyde (cm)', 'Height (cm)')}</th>
                    <th>{t('Registrert av', 'Entered by')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {[...list].reverse().map((m) => (
                    <tr key={m.id} className={draft.id === m.id ? 'selected' : undefined}>
                      <td>{longDate(m.measured_on)}</td>
                      <td className="num">{m.weight_kg === null ? '–' : formatNumber(m.weight_kg, 1)}</td>
                      <td className="num">{m.height_cm === null ? '–' : formatNumber(m.height_cm, 1)}</td>
                      <td className="muted small">{m.entered_by === userId ? t('Spilleren selv', 'The player') : (m.entered_by_name ?? '–')}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className="small ghost"
                          aria-label={t('Rediger måling', 'Edit measurement')}
                          onClick={() =>
                            setDraft({
                              id: m.id,
                              date: m.measured_on,
                              weight: m.weight_kg === null ? '' : formatNumber(m.weight_kg, 1),
                              height: m.height_cm === null ? '' : formatNumber(m.height_cm, 1),
                            })
                          }>
                          <Pencil size={13} />
                        </button>
                        <button className="small ghost danger" aria-label={t('Slett måling', 'Delete measurement')} onClick={() => void remove(m)}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function describe(m: Measurement) {
  return [
    m.weight_kg !== null ? `${formatNumber(m.weight_kg, 1)} kg` : null,
    m.height_cm !== null ? `${formatNumber(m.height_cm, 1)} cm` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
