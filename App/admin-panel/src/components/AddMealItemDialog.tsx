// "Legg til matvare" in a player's meal — for when the player forgot
// something (e.g. the sauce). Step 1: search (same search_foods() as the
// app). Step 2: grams. The database (add_meal_item) computes the nutrition
// from `foods`, marks the meal "Endret av administrator" for the player and
// writes the change log.

import { ArrowLeft, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useFeedback } from '../feedback/feedback-context';
import { formatNumber, formatTime } from '../lib/format';
import { supabase } from '../lib/supabase';
import { toSearchFood, type SearchFood } from '../lib/types';
import { t } from '../lib/i18n';

type Props = {
  mealId: string;
  mealTime: string; // eaten_at, for the title
  onClose: (added: boolean) => void;
};

export function AddMealItemDialog({ mealId, mealTime, onClose }: Props) {
  const { toast } = useFeedback();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchFood[]>([]);
  const [chosen, setChosen] = useState<SearchFood | null>(null);
  const [grams, setGrams] = useState('');
  const [busy, setBusy] = useState(false);

  // Open as a modal (focus trap + Esc to close) as soon as we mount.
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Search 300 ms after typing stops.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        if (!cancelled) setResults([]);
        return;
      }
      const { data } = await supabase.rpc('search_foods', { search_text: query, max_results: 12 });
      if (!cancelled) setResults((data ?? []).map(toSearchFood));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function choose(food: SearchFood) {
    setChosen(food);
    setGrams(String(food.portions[0]?.grams ?? 100)); // the food's default portion
  }

  async function add() {
    if (!chosen) return;
    const amount = Number(grams.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) {
      toast(t('Mengden må være mellom 1 og 5000 g.', 'The amount must be between 1 and 5000 g.'), 'error');
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc('add_meal_item', { p_meal_id: mealId, p_food_id: chosen.id, p_amount_g: amount });
    if (error) {
      setBusy(false);
      toast(`${t('Kunne ikke legge til', "Couldn't add")}: ${error.message}`, 'error');
      return;
    }
    toast(t(`${formatNumber(amount)} g ${chosen.name_nb} er lagt til i måltidet.`, `${formatNumber(amount)} g ${chosen.name_nb} was added to the meal.`));
    dialogRef.current?.close();
    onClose(true);
  }

  function cancel() {
    dialogRef.current?.close();
    onClose(false);
  }

  const kcal = chosen ? ((chosen.nutrition.energy_kcal ?? 0) * (Number(grams.replace(',', '.')) || 0)) / 100 : 0;

  return (
    <dialog ref={dialogRef} onCancel={cancel} style={{ width: 'min(620px, 94vw)' }}>
      <h2>{t(`Legg til matvare i måltidet kl. ${formatTime(mealTime)}`, `Add a food to the ${formatTime(mealTime)} meal`)}</h2>
      <p style={{ marginBottom: 14 }}>
        {t(
          'Spilleren ser at måltidet er endret av en administrator, og endringen lagres i endringsloggen.',
          'The player sees that the meal was changed by an administrator, and the change is saved in the change log.',
        )}
      </p>

      {!chosen ? (
        <>
          <div className="search">
            <Search size={15} />
            <input
              type="search"
              autoFocus
              placeholder={t('Søk i Matvaretabellen, f.eks. «brun saus»', 'Search Matvaretabellen, e.g. “brun saus” (brown sauce)')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="stack" style={{ gap: 6, marginTop: 12, maxHeight: 340, overflowY: 'auto' }}>
            {results.map((food) => (
              <button key={food.id} type="button" className="link-result" onClick={() => choose(food)}>
                <span>
                  {food.name_nb}
                  {food.name_en && <span className="faint small"> · {food.name_en}</span>}
                </span>
                <span className="faint small num" style={{ whiteSpace: 'nowrap' }}>
                  {formatNumber(food.nutrition.energy_kcal)} kcal/100 g
                </span>
              </button>
            ))}
            {query.trim() && results.length === 0 && <p className="muted small">{t('Ingen treff.', 'No results.')}</p>}
          </div>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}>
          <button type="button" className="small ghost" onClick={() => setChosen(null)} style={{ marginBottom: 10 }}>
            <ArrowLeft size={13} /> {t('Velg en annen matvare', 'Choose another food')}
          </button>
          <p style={{ margin: '0 0 10px' }}>
            <strong>{chosen.name_nb}</strong>
          </p>
          <label>
            {t('Mengde (g)', 'Amount (g)')}
            <input
              className="num"
              inputMode="decimal"
              autoFocus
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              style={{ width: 120 }}
            />
          </label>
          {chosen.portions.length > 0 && (
            <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {chosen.portions.slice(0, 4).map((p) => (
                <button key={p.name} type="button" className="small" onClick={() => setGrams(String(p.grams))}>
                  1 {p.name} ({formatNumber(p.grams)} g)
                </button>
              ))}
            </div>
          )}
          <p className="faint small" style={{ margin: '10px 0 0' }}>
            ≈ {formatNumber(kcal)} kcal {t('(regnes ut i databasen fra Matvaretabellen)', '(calculated in the database from Matvaretabellen)')}
          </p>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" onClick={cancel} disabled={busy}>
              {t('Avbryt', 'Cancel')}
            </button>
            <button type="submit" className="primary" disabled={busy}>
              {t('Legg til', 'Add')}
            </button>
          </div>
        </form>
      )}

      {!chosen && (
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={cancel}>
            {t('Avbryt', 'Cancel')}
          </button>
        </div>
      )}
    </dialog>
  );
}
