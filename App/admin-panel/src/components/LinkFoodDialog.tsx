// "Koble til matvare": pick the food a recognizer label should mean.
// Search uses the same search_foods() as the player app. Choosing a food
// saves the link immediately (food_aliases), so from then on the app maps
// that label straight to this food.

import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useFeedback } from '../feedback/feedback-context';
import { linkLabel } from '../lib/aliases-api';
import { formatNumber } from '../lib/format';
import { supabase } from '../lib/supabase';
import { toSearchFood, type SearchFood } from '../lib/types';
import { t } from '../lib/i18n';

type Props = {
  label: string; // the recognizer label being linked, e.g. "chicken breast"
  onClose: (linked: boolean) => void;
};

export function LinkFoodDialog({ label, onClose }: Props) {
  const { toast } = useFeedback();
  const dialogRef = useRef<HTMLDialogElement>(null);
  // FatSecret labels are ids ("fatsecret:123") — there's no text to search for.
  const [query, setQuery] = useState(label.includes(':') ? '' : label);
  const [results, setResults] = useState<SearchFood[]>([]);
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

  async function choose(food: SearchFood) {
    setBusy(true);
    try {
      await linkLabel(label, food.id);
      toast(t(`«${label}» er koblet til ${food.name_nb}.`, `“${label}” is now linked to ${food.name_nb}.`));
      dialogRef.current?.close();
      onClose(true);
    } catch (e) {
      toast(`${t('Kunne ikke lagre koblingen', "Couldn't save the link")}: ${(e as Error).message}`, 'error');
      setBusy(false);
    }
  }

  function cancel() {
    dialogRef.current?.close();
    onClose(false);
  }

  return (
    <dialog ref={dialogRef} onCancel={cancel} style={{ width: 'min(620px, 94vw)' }}>
      <h2>{t(`Koble «${label}» til en matvare`, `Link “${label}” to a food`)}</h2>
      <p style={{ marginBottom: 14 }}>
        {t(
          'Velg matvaren etiketten betyr. Appen bruker den automatisk fra nå av — ingen kopi, så verdiene følger Matvaretabellen.',
          'Choose the food the label means. The app uses it automatically from now on — no copy, so the values follow Matvaretabellen.',
        )}
      </p>
      <div className="search">
        <Search size={15} />
        <input
          type="search"
          autoFocus
          placeholder={t('Søk på norsk eller engelsk, f.eks. «kylling filet»', 'Search in Norwegian or English, e.g. “kylling filet”')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="stack" style={{ gap: 6, marginTop: 12, maxHeight: 340, overflowY: 'auto' }}>
        {results.map((food) => (
          <button
            key={food.id}
            type="button"
            className="link-result"
            disabled={busy}
            onClick={() => void choose(food)}>
            <span>
              {food.name_nb}
              {food.name_en && <span className="faint small"> · {food.name_en}</span>}
            </span>
            <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <span className="faint small num" style={{ whiteSpace: 'nowrap' }}>
                {formatNumber(food.nutrition.energy_kcal)} kcal/100 g
              </span>
              {food.source === 'custom' && <span className="pill warn">{t('Egendefinert', 'Custom')}</span>}
            </span>
          </button>
        ))}
        {query.trim() && results.length === 0 && <p className="muted small">{t('Ingen treff.', 'No results.')}</p>}
      </div>
      <p className="faint small" style={{ margin: '10px 0 0' }}>
        {t(
          'Finner du ikke riktig matvare? Matvaretabellen bruker ofte andre ord enn etiketten — søk på norsk, f.eks. «kylling filet» for «chicken breast».',
          "Can't find the right food? Matvaretabellen often uses other words than the label — search in Norwegian, e.g. “kylling filet” for “chicken breast”.",
        )}
      </p>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" onClick={cancel}>
          {t('Avbryt', 'Cancel')}
        </button>
      </div>
    </dialog>
  );
}
