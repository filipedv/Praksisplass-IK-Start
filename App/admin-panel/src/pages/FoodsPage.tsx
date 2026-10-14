// MATVARER: search the cached foods table, and add/edit CUSTOM entries.
//
// Matvaretabellen rows are read-only: the database only lets admins change
// rows with source = 'custom' (RLS), because the seed script would overwrite
// edits to seeded rows anyway. To "fix" a seeded food, make a custom copy.
//
// Fixing a bad match from the recognizer: create a custom food whose ENGLISH
// name is exactly the label (e.g. "chicken breast"). search_foods() ranks an
// exact name match first, so the app will pick it from then on.

import { useCallback, useEffect, useState } from 'react';

import { FoodForm, type FoodDraft } from '../components/FoodForm';
import { formatNumber } from '../lib/format';
import { supabase } from '../lib/supabase';
import { NUTRIENTS, type Food } from '../lib/types';

const FOOD_COLUMNS = 'id, source, name_nb, name_en, search_keywords, nutrition, portions';

const EMPTY_DRAFT: FoodDraft = { name_nb: '', name_en: null, search_keywords: [], nutrition: {}, portions: [] };

// What the right-hand panel shows.
type Panel =
  | { kind: 'none' }
  | { kind: 'view'; food: Food } // a Matvaretabellen food (read-only)
  | { kind: 'edit'; food: Food } // a custom food
  | { kind: 'new'; draft: FoodDraft; copiedFrom?: string };

export function FoodsPage() {
  const [query, setQuery] = useState('');
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [panel, setPanel] = useState<Panel>({ kind: 'none' });
  const [message, setMessage] = useState<string | null>(null);

  // Empty search → list our custom foods. Otherwise → the same fuzzy search
  // the player app uses, so you see what players would see.
  const load = useCallback(async (text: string) => {
    if (text.trim()) {
      const { data } = await supabase.rpc('search_foods', { search_text: text, max_results: 50 });
      setFoods((data ?? []) as Food[]);
    } else {
      const { data } = await supabase
        .from('foods')
        .select(FOOD_COLUMNS)
        .eq('source', 'custom')
        .order('created_at', { ascending: false });
      setFoods((data ?? []) as Food[]);
    }
  }, []);

  // Search 300 ms after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => void load(query), 300);
    return () => clearTimeout(timer);
  }, [query, load]);

  // search_foods() doesn't return search_keywords, so fetch the full row on click.
  async function openFood(food: Food) {
    const { data } = await supabase.from('foods').select(FOOD_COLUMNS).eq('id', food.id).single();
    const full = (data ?? food) as Food;
    setMessage(null);
    setPanel(full.source === 'custom' ? { kind: 'edit', food: full } : { kind: 'view', food: full });
  }

  async function create(draft: FoodDraft) {
    const { error } = await supabase.from('foods').insert({ ...draft, source: 'custom' });
    if (error) return error.message;
    setMessage(`«${draft.name_nb}» er lagt til.`);
    setPanel({ kind: 'none' });
    void load(query);
    return null;
  }

  async function save(id: string, draft: FoodDraft) {
    const { data, error } = await supabase.from('foods').update(draft).eq('id', id).select('id');
    if (error) return error.message;
    if (!data?.length) return 'Ingen tilgang til å endre denne matvaren.';
    setMessage(`«${draft.name_nb}» er lagret.`);
    setPanel({ kind: 'none' });
    void load(query);
    return null;
  }

  async function remove(food: Food) {
    if (!window.confirm(`Slette «${food.name_nb}»? Måltider som allerede er logget beholder verdiene sine.`)) return;
    const { error } = await supabase.from('foods').delete().eq('id', food.id);
    setMessage(error ? `Kunne ikke slette: ${error.message}` : `«${food.name_nb}» er slettet.`);
    setPanel({ kind: 'none' });
    void load(query);
  }

  return (
    <div className="stack">
      <div className="row spread">
        <h1 style={{ margin: 0 }}>Matvarer</h1>
        <button className="primary" onClick={() => setPanel({ kind: 'new', draft: EMPTY_DRAFT })}>
          + Ny egendefinert matvare
        </button>
      </div>
      <p className="hint">
        Tips: Hvis gjenkjenningen gir en etikett som ikke finnes (se «Gjenkjenning»), lag en egendefinert matvare med{' '}
        <strong>engelsk navn lik etiketten</strong>, f.eks. «chicken breast». Appen velger den automatisk etter det.
      </p>
      {message && <p className="success">{message}</p>}

      <div className="split">
        <div className="stack">
          <input
            type="search"
            placeholder="Søk i alle matvarer (norsk eller engelsk) — tomt felt viser egendefinerte"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {foods === null ? (
            <p className="muted">Laster…</p>
          ) : foods.length === 0 ? (
            <p className="muted">{query ? 'Ingen treff.' : 'Ingen egendefinerte matvarer ennå.'}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Navn</th>
                  <th>Kilde</th>
                  <th className="num">kcal</th>
                  <th className="num">Protein</th>
                  <th className="num">Karbo</th>
                  <th className="num">Fett</th>
                  <th>Porsjon</th>
                </tr>
              </thead>
              <tbody>
                {foods.map((food) => {
                  const selected = 'food' in panel && panel.food.id === food.id;
                  return (
                    <tr
                      key={food.id}
                      className={`clickable ${selected ? 'selected' : ''}`}
                      onClick={() => void openFood(food)}>
                      <td>
                        {food.name_nb}
                        {food.name_en && <div className="muted small">{food.name_en}</div>}
                      </td>
                      <td>
                        <span className={`badge ${food.source === 'custom' ? 'custom' : ''}`}>
                          {food.source === 'custom' ? 'Egendefinert' : 'Matvaretabellen'}
                        </span>
                      </td>
                      <td className="num">{formatNumber(food.nutrition.energy_kcal)}</td>
                      <td className="num">{formatNumber(food.nutrition.protein_g, 1)}</td>
                      <td className="num">{formatNumber(food.nutrition.carbs_g, 1)}</td>
                      <td className="num">{formatNumber(food.nutrition.fat_g, 1)}</td>
                      <td className="muted small">
                        {food.portions[0] ? `${food.portions[0].name} = ${formatNumber(food.portions[0].grams)} g` : '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="muted small">Verdier per 100 g.</p>
        </div>

        <aside className="card stack">
          {panel.kind === 'none' && <p className="muted">Velg en matvare i listen, eller lag en ny.</p>}

          {panel.kind === 'view' && (
            <>
              <h2 style={{ margin: 0 }}>{panel.food.name_nb}</h2>
              <p className="muted small" style={{ margin: 0 }}>
                Fra Matvaretabellen — kan ikke endres her. Lag en kopi for å rette verdier eller navn.
              </p>
              <NutritionTable food={panel.food} />
              <button
                className="primary"
                onClick={() =>
                  setPanel({
                    kind: 'new',
                    copiedFrom: panel.food.name_nb,
                    draft: {
                      name_nb: panel.food.name_nb,
                      name_en: panel.food.name_en,
                      search_keywords: panel.food.search_keywords,
                      nutrition: panel.food.nutrition,
                      portions: panel.food.portions,
                    },
                  })
                }>
                Lag egendefinert kopi
              </button>
            </>
          )}

          {panel.kind === 'new' && (
            <>
              <h2 style={{ margin: 0 }}>Ny egendefinert matvare</h2>
              {panel.copiedFrom && <p className="muted small">Kopi av «{panel.copiedFrom}». Endre det som er feil.</p>}
              <FoodForm
                // A new key per draft makes React start the form fresh.
                key={panel.copiedFrom ?? 'new'}
                initial={panel.draft}
                submitLabel="Legg til"
                onSubmit={create}
                onCancel={() => setPanel({ kind: 'none' })}
              />
            </>
          )}

          {panel.kind === 'edit' && (
            <>
              <h2 style={{ margin: 0 }}>Rediger matvare</h2>
              <FoodForm
                key={panel.food.id}
                initial={panel.food}
                submitLabel="Lagre"
                onSubmit={(draft) => save(panel.food.id, draft)}
                onCancel={() => setPanel({ kind: 'none' })}
                onDelete={() => void remove(panel.food)}
              />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function NutritionTable({ food }: { food: Food }) {
  return (
    <table>
      <tbody>
        {NUTRIENTS.map(({ key, label, unit }) => (
          <tr key={key}>
            <td>
              {label} ({unit})
            </td>
            <td className="num">{formatNumber(food.nutrition[key], 1)}</td>
          </tr>
        ))}
        <tr>
          <td>Porsjoner</td>
          <td className="num">
            {food.portions.length ? food.portions.map((p) => `${p.name} ${formatNumber(p.grams)} g`).join(', ') : '–'}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
