// MATVARER: search the cached foods table, and add/edit CUSTOM entries.
//
// Matvaretabellen rows are read-only: the database only lets admins change
// rows with source = 'custom' (RLS), because the seed script would overwrite
// edits to seeded rows anyway. To "fix" a seeded food, make a custom copy.
//
// Fixing a bad match from the recognizer: create a custom food whose ENGLISH
// name is exactly the label (e.g. "chicken breast"). search_foods() ranks an
// exact name match first, so the app will pick it from then on.

import { Plus, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { FoodForm, type FoodDraft } from '../components/FoodForm';
import { FoodLinks } from '../components/FoodLinks';
import { PageHeader } from '../components/ui';
import { useFeedback } from '../feedback/feedback-context';
import { formatNumber } from '../lib/format';
import { supabase } from '../lib/supabase';
import { NUTRIENTS, toSearchFood, type Food } from '../lib/types';
import { t } from '../lib/i18n';

const FOOD_COLUMNS = 'id, source, name_nb, name_en, search_keywords, nutrition, portions';

const EMPTY_DRAFT: FoodDraft = { name_nb: '', name_en: null, search_keywords: [], nutrition: {}, portions: [] };

// What the right-hand panel shows.
type Panel =
  | { kind: 'none' }
  | { kind: 'view'; food: Food } // a Matvaretabellen food (read-only)
  | { kind: 'edit'; food: Food } // a custom food
  | { kind: 'new'; draft: FoodDraft; copiedFrom?: string };

/**
 * /foods?q=<text> (used by ⌘K quick search) starts the search with that text.
 * The `key` makes React start the page fresh whenever ?q= changes.
 */
export function FoodsPage() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  return <FoodsPageContent key={q} initialQuery={q} />;
}

function FoodsPageContent({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [panel, setPanel] = useState<Panel>({ kind: 'none' });
  const { toast, confirm } = useFeedback();

  // Empty search → list our custom foods. Otherwise → the same fuzzy search
  // the player app uses, so you see what players would see.
  const load = useCallback(async (text: string) => {
    if (text.trim()) {
      const { data } = await supabase.rpc('search_foods', { search_text: text, max_results: 50 });
      // Search results have no keywords; the full row is fetched when one is opened.
      setFoods((data ?? []).map((row) => ({ ...toSearchFood(row), search_keywords: [] })));
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
    toast(t(`«${draft.name_nb}» er lagt til.`, `“${draft.name_nb}” has been added.`));
    setPanel({ kind: 'none' });
    void load(query);
    return null;
  }

  async function save(id: string, draft: FoodDraft) {
    const { data, error } = await supabase.from('foods').update(draft).eq('id', id).select('id');
    if (error) return error.message;
    if (!data?.length) return t('Ingen tilgang til å endre denne matvaren.', 'No access to change this food.');
    toast(t(`«${draft.name_nb}» er lagret.`, `“${draft.name_nb}” has been saved.`));
    setPanel({ kind: 'none' });
    void load(query);
    return null;
  }

  async function remove(food: Food) {
    const ok = await confirm({
      title: t(`Slette «${food.name_nb}»?`, `Delete “${food.name_nb}”?`),
      body: t('Måltider som allerede er logget beholder verdiene sine.', 'Meals already logged keep their values.'),
      confirmLabel: t('Slett', 'Delete'),
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('foods').delete().eq('id', food.id);
    if (error) toast(`${t('Kunne ikke slette', "Couldn't delete")}: ${error.message}`, 'error');
    else toast(t(`«${food.name_nb}» er slettet.`, `“${food.name_nb}” has been deleted.`));
    setPanel({ kind: 'none' });
    void load(query);
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title={t('Matvarer', 'Foods')}
        subtitle={t('Matvaretabellen (2 121 matvarer) + egendefinerte', 'Matvaretabellen (2,121 foods) + custom')}
        actions={
          <button className="primary" onClick={() => setPanel({ kind: 'new', draft: EMPTY_DRAFT })}>
            <Plus size={15} /> {t('Ny egendefinert matvare', 'New custom food')}
          </button>
        }
      />
      <p className="hint">
        {t('Tips: Gir gjenkjenningen en etikett som ikke blir funnet, f.eks. «chicken breast»?', 'Tip: does recognition return a label that isn’t found, e.g. “chicken breast”?')}{' '}
        <strong>{t('Koble den', 'Link it')}</strong>{' '}
        {t(
          'til riktig matvare — under «Gjenkjenning», eller i panelet til høyre når du har valgt matvaren. Lag bare en egendefinert matvare hvis den faktisk mangler i Matvaretabellen.',
          'to the right food — under “Recognition”, or in the panel on the right once you have chosen the food. Only make a custom food if it is really missing from Matvaretabellen.',
        )}
      </p>

      <div className="split">
        <div className="stack">
          <div className="search">
            <Search size={15} />
            <input
              type="search"
              placeholder={t('Søk i alle matvarer (norsk eller engelsk) — tomt felt viser egendefinerte', 'Search all foods (Norwegian or English) — an empty field shows custom foods')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {foods === null ? (
            <p className="muted">{t('Laster…', 'Loading…')}</p>
          ) : foods.length === 0 ? (
            <p className="muted">{query ? t('Ingen treff.', 'No results.') : t('Ingen egendefinerte matvarer ennå.', 'No custom foods yet.')}</p>
          ) : (
            <div className="card flush">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('Navn', 'Name')}</th>
                      <th>{t('Kilde', 'Source')}</th>
                      <th className="num">kcal</th>
                      <th className="num">Protein</th>
                      <th className="num">{t('Karbo', 'Carbs')}</th>
                      <th className="num">{t('Fett', 'Fat')}</th>
                      <th>{t('Porsjon', 'Portion')}</th>
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
                              {food.source === 'custom' ? t('Egendefinert', 'Custom') : 'Matvaretabellen'}
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
          <p className="faint small" style={{ margin: 0 }}>
            {t('Verdier per 100 g.', 'Values per 100 g.')}
          </p>
        </div>

        {/* Pinned while the list scrolls; scrolls by itself if taller than the window. */}
        <aside className="card stack" style={{ position: 'sticky', top: 24, maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
          {panel.kind === 'none' && <p className="muted">{t('Velg en matvare i listen, eller lag en ny.', 'Choose a food in the list, or make a new one.')}</p>}

          {panel.kind === 'view' && (
            <>
              <h2 style={{ margin: 0 }}>{panel.food.name_nb}</h2>
              <p className="muted small" style={{ margin: 0 }}>
                {t(
                  'Fra Matvaretabellen — kan ikke endres her. Lag en kopi for å rette verdier eller navn.',
                  'From Matvaretabellen — cannot be changed here. Make a copy to correct values or the name.',
                )}
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
                {t('Lag egendefinert kopi', 'Make a custom copy')}
              </button>
            </>
          )}

          {panel.kind === 'new' && (
            <>
              <h2 style={{ margin: 0 }}>{t('Ny egendefinert matvare', 'New custom food')}</h2>
              {panel.copiedFrom && (
                <p className="muted small">
                  {t(`Kopi av «${panel.copiedFrom}». Endre det som er feil.`, `Copy of “${panel.copiedFrom}”. Change what is wrong.`)}
                </p>
              )}
              <FoodForm
                // A new key per draft makes React start the form fresh.
                key={panel.copiedFrom ?? 'new'}
                initial={panel.draft}
                submitLabel={t('Legg til', 'Add')}
                onSubmit={create}
                onCancel={() => setPanel({ kind: 'none' })}
              />
            </>
          )}

          {panel.kind === 'edit' && (
            <>
              <h2 style={{ margin: 0 }}>{t('Rediger matvare', 'Edit food')}</h2>
              <FoodForm
                key={panel.food.id}
                initial={panel.food}
                submitLabel={t('Lagre', 'Save')}
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
          <td>{t('Porsjoner', 'Portions')}</td>
          <td className="num">
            {food.portions.length ? food.portions.map((p) => `${p.name} ${formatNumber(p.grams)} g`).join(', ') : '–'}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
