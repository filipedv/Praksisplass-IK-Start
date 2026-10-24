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

import { Plus, Search } from 'lucide-react';

import { FoodForm, type FoodDraft } from '../components/FoodForm';
import { FoodLinks } from '../components/FoodLinks';
import { PageHeader } from '../components/ui';
import { useFeedback } from '../feedback/feedback-context';
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
  const { toast, confirm } = useFeedback();

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
    setPanel(full.source === 'custom' ? { kind: 'edit', food: full } : { kind: 'view', food: full });
  }

  async function create(draft: FoodDraft) {
    const { error } = await supabase.from('foods').insert({ ...draft, source: 'custom' });
    if (error) return error.message;
    toast(`«${draft.name_nb}» er lagt til.`);
    setPanel({ kind: 'none' });
    void load(query);
    return null;
  }

  async function save(id: string, draft: FoodDraft) {
    const { data, error } = await supabase.from('foods').update(draft).eq('id', id).select('id');
    if (error) return error.message;
    if (!data?.length) return 'Ingen tilgang til å endre denne matvaren.';
    toast(`«${draft.name_nb}» er lagret.`);
    setPanel({ kind: 'none' });
    void load(query);
    return null;
  }

  async function remove(food: Food) {
    const ok = await confirm({
      title: `Slette «${food.name_nb}»?`,
      body: 'Måltider som allerede er logget beholder verdiene sine.',
      confirmLabel: 'Slett',
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('foods').delete().eq('id', food.id);
    if (error) toast(`Kunne ikke slette: ${error.message}`, 'error');
    else toast(`«${food.name_nb}» er slettet.`);
    setPanel({ kind: 'none' });
    void load(query);
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Matvarer"
        subtitle="Matvaretabellen (2 121 matvarer) + egendefinerte"
        actions={
          <button className="primary" onClick={() => setPanel({ kind: 'new', draft: EMPTY_DRAFT })}>
            <Plus size={15} /> Ny egendefinert matvare
          </button>
        }
      />
      <p className="hint">
        Tips: Gir gjenkjenningen en etikett som ikke blir funnet, f.eks. «chicken breast»? <strong>Koble den</strong> til
        riktig matvare — under «Gjenkjenning», eller i panelet til høyre når du har valgt matvaren. Lag bare en
        egendefinert matvare hvis den faktisk mangler i Matvaretabellen.
      </p>

      <div className="split">
        <div className="stack">
          <div className="search">
            <Search size={15} />
            <input
              type="search"
              placeholder="Søk i alle matvarer (norsk eller engelsk) — tomt felt viser egendefinerte"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {foods === null ? (
            <p className="muted">Laster…</p>
          ) : foods.length === 0 ? (
            <p className="muted">{query ? 'Ingen treff.' : 'Ingen egendefinerte matvarer ennå.'}</p>
          ) : (
            <div className="card flush">
              <div className="table-wrap">
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
                            <span className={`pill ${food.source === 'custom' ? 'warn' : ''}`}>
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
              </div>
            </div>
          )}
          <p className="faint small" style={{ margin: 0 }}>Verdier per 100 g.</p>
        </div>

        {/* Pinned while the list scrolls; scrolls by itself if taller than the window. */}
        <aside className="card stack" style={{ position: 'sticky', top: 24, maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
          {panel.kind === 'none' && <p className="muted">Velg en matvare i listen, eller lag en ny.</p>}

          {panel.kind === 'view' && (
            <>
              <h2 style={{ margin: 0 }}>{panel.food.name_nb}</h2>
              <p className="muted small" style={{ margin: 0 }}>
                Fra Matvaretabellen — kan ikke endres her. Lag en kopi for å rette verdier eller navn.
              </p>
              <NutritionTable food={panel.food} />
              <FoodLinks key={panel.food.id} foodId={panel.food.id} foodName={panel.food.name_nb} />
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
              <FoodLinks key={panel.food.id} foodId={panel.food.id} foodName={panel.food.name_nb} />
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
