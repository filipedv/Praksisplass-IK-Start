// "Hva spillerne valgte" — learn from the players' corrections.
//
// Every saved meal item remembers the recognizer's label (detected_label) and
// the food the player finally kept. Grouping those shows, per label, what
// players actually choose. If that differs from what the app picks today
// (an admin's link, or the automatic fuzzy match), one click links the label
// to the players' choice, so the next player gets it right automatically.

import { Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useFeedback } from '../feedback/feedback-context';
import { linkLabel, normalizeLabel, type FoodAlias } from '../lib/aliases-api';
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';

/** Same threshold as the player app's MATCH_THRESHOLD. */
const MATCH_THRESHOLD = 0.7;

type Choice = { foodId: string; foodName: string; count: number };
type Row = { label: string; total: number; choices: Choice[]; auto: { id: string; name: string } | null };

async function fetchCorrections(): Promise<Row[]> {
  // Every recognised item (not hand-picked ones), newest first.
  const { data, error } = await supabase
    .from('meal_items')
    .select('detected_label, food_id, food_name')
    .not('detected_label', 'is', null)
    .not('food_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw error;

  const byLabel = new Map<string, Map<string, Choice>>();
  for (const item of data ?? []) {
    const label = normalizeLabel(item.detected_label as string);
    const foods = byLabel.get(label) ?? new Map<string, Choice>();
    const c = foods.get(item.food_id as string) ?? { foodId: item.food_id as string, foodName: item.food_name as string, count: 0 };
    c.count += 1;
    foods.set(c.foodId, c);
    byLabel.set(label, foods);
  }

  // What would the app pick automatically today? (Not possible for FatSecret
  // ids — there's no text to search.)
  const rows = await Promise.all(
    [...byLabel.entries()].map(async ([label, foods]) => {
      const choices = [...foods.values()].sort((a, b) => b.count - a.count);
      let auto: Row['auto'] = null;
      if (!label.includes(':')) {
        const { data: hits } = await supabase.rpc('search_foods', { search_text: label, max_results: 1 });
        const best = (hits ?? [])[0] as { id: string; name_nb: string; score: number } | undefined;
        if (best && best.score >= MATCH_THRESHOLD) auto = { id: best.id, name: best.name_nb };
      }
      return { label, total: choices.reduce((s, c) => s + c.count, 0), choices, auto };
    }),
  );
  return rows.sort((a, b) => b.total - a.total);
}

export function CorrectionsCard({ aliases, onLinked }: { aliases: FoodAlias[]; onLinked: () => void }) {
  const { toast } = useFeedback();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCorrections()
      .then((r) => !cancelled && setRows(r))
      .catch((e) => !cancelled && toast(`${t('Kunne ikke hente spillernes valg', "Couldn't load the players' choices")}: ${e.message}`, 'error'));
    return () => {
      cancelled = true;
    };
    // toast is stable for our purposes; load once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function link(label: string, choice: Choice) {
    setBusy(label);
    try {
      await linkLabel(label, choice.foodId);
      toast(t(`«${label}» er koblet til ${choice.foodName}.`, `“${label}” is now linked to ${choice.foodName}.`));
      onLinked();
    } catch (e) {
      toast(`${t('Kunne ikke lagre koblingen', "Couldn't save the link")}: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  }

  const aliasByLabel = new Map(aliases.map((a) => [a.label, a]));

  return (
    <section className="card flush">
      <div style={{ padding: '16px 20px 4px' }}>
        <h2>{t('Hva spillerne valgte', 'What the players chose')}</h2>
        <p className="faint small" style={{ margin: '4px 0 0' }}>
          {t(
            'For hver etikett: hva appen velger i dag, og hva spillerne faktisk endte med. Velger spillerne ofte noe annet, kan du koble etiketten til deres valg med ett klikk.',
            "For each label: what the app picks today, and what the players actually ended up with. If players often choose something else, you can link the label to their choice with one click.",
          )}
        </p>
      </div>
      {rows === null ? (
        <p className="muted" style={{ padding: '8px 20px 20px', margin: 0 }}>
          {t('Laster…', 'Loading…')}
        </p>
      ) : rows.length === 0 ? (
        <p className="muted" style={{ padding: '8px 20px 20px', margin: 0 }}>
          {t('Ingen lagrede måltider fra gjenkjenning ennå.', 'No saved meals from recognition yet.')}
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('Etikett', 'Label')}</th>
                <th>{t('Appen velger nå', 'The app picks now')}</th>
                <th>{t('Spillerne valgte', 'Players chose')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const alias = aliasByLabel.get(row.label);
                const current = alias?.food ? { id: alias.food.id, name: alias.food.name_nb } : row.auto;
                const top = row.choices[0];
                // Players disagree with the app if their favourite isn't what the app picks.
                const disagree = top && top.foodId !== current?.id;
                return (
                  <tr key={row.label} style={disagree ? { background: 'rgba(245, 158, 11, 0.06)' } : undefined}>
                    <td>
                      {row.label}
                      <div className="faint small">
                        {row.total} {t('gang(er)', row.total === 1 ? 'time' : 'times')}
                      </div>
                    </td>
                    <td>
                      {current ? (
                        <>
                          {current.name}
                          <div className="faint small">{alias ? t('Koblet av admin', 'Linked by an admin') : t('Automatisk gjetning', 'Automatic guess')}</div>
                        </>
                      ) : (
                        <span className="faint">{t('Ingen — spilleren må velge', 'None — the player has to choose')}</span>
                      )}
                    </td>
                    <td>
                      {row.choices.slice(0, 3).map((c) => (
                        <div key={c.foodId} className="small">
                          {c.foodName} <span className="faint">× {c.count}</span>
                        </div>
                      ))}
                      {row.choices.length > 3 && <span className="faint small">+{row.choices.length - 3} {t('andre', 'others')}</span>}
                    </td>
                    <td>
                      {disagree ? (
                        <button className="small" disabled={busy === row.label} onClick={() => void link(row.label, top)}>
                          <Link2 size={13} /> {t(`Koble til «${top.foodName}»`, `Link to “${top.foodName}”`)}
                        </button>
                      ) : (
                        <span className="pill ok">✓ {t('Stemmer', 'Matches')}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
