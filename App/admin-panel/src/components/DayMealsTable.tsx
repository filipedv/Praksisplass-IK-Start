// One day's meals with CORRECTION tools for admins:
//   - change an item's grams (type a new value, press Enter or leave the field)
//   - delete an item (the meal disappears with its last item)
// Implausible amounts (> 1000 g) are highlighted so typos like "1500 g ris"
// are easy to spot. All changes go through SQL functions that rescale the
// saved nutrition, and are written to the change log by the database.

import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { useFeedback } from '../feedback/feedback-context';
import { formatNumber, formatTime } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { Meal, MealItem } from '../lib/types';

/** Above this, an amount is flagged as "check this" (also used on Oversikt). */
export const IMPLAUSIBLE_ITEM_G = 1000;

export function DayMealsTable({ meals, onChanged }: { meals: Meal[]; onChanged: () => void }) {
  const { toast, confirm } = useFeedback();
  // Text being typed per item id (so the input can be edited freely).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function saveAmount(item: MealItem) {
    const raw = drafts[item.id];
    if (raw === undefined) return; // nothing typed
    const grams = Number(raw.replace(',', '.'));
    if (!Number.isFinite(grams) || grams <= 0 || grams > 5000) {
      toast('Mengden må være mellom 1 og 5000 g.', 'error');
      return;
    }
    if (grams === item.amount_g) return clearDraft(item.id);
    setBusyId(item.id);
    const { error } = await supabase.rpc('update_meal_item_amount', { p_item_id: item.id, p_amount_g: grams });
    setBusyId(null);
    if (error) return toast(`Kunne ikke lagre: ${error.message}`, 'error');
    toast(`${item.food_name}: ${formatNumber(item.amount_g)} g → ${formatNumber(grams)} g. Næringsverdiene er justert.`);
    clearDraft(item.id);
    onChanged();
  }

  async function deleteItem(item: MealItem, isLast: boolean) {
    const ok = await confirm({
      title: `Slette «${item.food_name}»?`,
      body: isLast
        ? 'Dette er siste matvare i måltidet, så hele måltidet slettes. Endringen lagres i endringsloggen.'
        : 'Matvaren fjernes fra måltidet. Endringen lagres i endringsloggen.',
      confirmLabel: 'Slett',
      danger: true,
    });
    if (!ok) return;
    setBusyId(item.id);
    const { error } = await supabase.rpc('delete_meal_item', { p_item_id: item.id });
    setBusyId(null);
    if (error) return toast(`Kunne ikke slette: ${error.message}`, 'error');
    toast(`«${item.food_name}» er slettet.`);
    onChanged();
  }

  function clearDraft(id: string) {
    setDrafts((all) => {
      const next = { ...all };
      delete next[id];
      return next;
    });
  }

  if (meals.length === 0) return <p className="muted">Ingen måltider registrert denne dagen.</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tid</th>
            <th>Matvare</th>
            <th className="num">Mengde (g)</th>
            <th className="num">kcal</th>
            <th className="num">Protein</th>
            <th className="num">Karbo</th>
            <th className="num">Fett</th>
            <th>Kilde</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {meals.flatMap((meal) =>
            meal.meal_items.map((item, i) => {
              const suspicious = item.amount_g > IMPLAUSIBLE_ITEM_G;
              return (
                <tr key={item.id} style={suspicious ? { background: 'rgba(245, 158, 11, 0.08)' } : undefined}>
                  <td className="faint">{i === 0 ? formatTime(meal.eaten_at) : ''}</td>
                  <td>
                    {item.food_name}
                    {suspicious && <span className="pill warn" style={{ marginLeft: 8 }}>Uvanlig mengde</span>}
                  </td>
                  <td className="num">
                    <input
                      className="num"
                      inputMode="decimal"
                      aria-label={`Mengde for ${item.food_name}`}
                      value={drafts[item.id] ?? String(item.amount_g)}
                      disabled={busyId === item.id}
                      onChange={(e) => setDrafts({ ...drafts, [item.id]: e.target.value })}
                      onBlur={() => void saveAmount(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); // saves via onBlur
                        if (e.key === 'Escape') clearDraft(item.id);
                      }}
                      style={{ width: 80, textAlign: 'right', padding: '4px 8px' }}
                    />
                  </td>
                  <td className="num">{formatNumber(item.nutrition.energy_kcal)}</td>
                  <td className="num">{formatNumber(item.nutrition.protein_g, 1)}</td>
                  <td className="num">{formatNumber(item.nutrition.carbs_g, 1)}</td>
                  <td className="num">{formatNumber(item.nutrition.fat_g, 1)}</td>
                  <td className="faint small">{item.detected_label ? (meal.recognizer ?? 'gjenkjent') : 'manuelt'}</td>
                  <td>
                    <button
                      className="small ghost danger"
                      disabled={busyId === item.id}
                      onClick={() => void deleteItem(item, meal.meal_items.length === 1)}
                      aria-label={`Slett ${item.food_name}`}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
      <p className="faint small" style={{ margin: '8px 0 0' }}>
        Endre mengden direkte i feltet (Enter for å lagre, Esc for å angre). Næringsverdiene justeres automatisk.
      </p>
    </div>
  );
}
