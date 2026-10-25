// One day's meals with CORRECTION tools for admins:
//   - change an item's grams (type a new value, press Enter or leave the field)
//   - delete an item (the meal disappears with its last item)
//   - add a food the player forgot ("Legg til matvare", AddMealItemDialog)
// The player then sees "Endret av administrator" on that meal.
// Implausible amounts (> 1000 g) are highlighted so typos like "1500 g ris"
// are easy to spot. All changes go through SQL functions that rescale the
// saved nutrition, and are written to the change log by the database.

import { Plus, Trash2 } from 'lucide-react';
import { Fragment, useState } from 'react';

import { AddMealItemDialog } from './AddMealItemDialog';
import { useFeedback } from '../feedback/feedback-context';
import { formatNumber, formatTime } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { Meal, MealItem } from '../lib/types';
import { t } from '../lib/i18n';

/** Above this, an amount is flagged as "check this" (also used on Oversikt). */
export const IMPLAUSIBLE_ITEM_G = 1000;

export function DayMealsTable({ meals, onChanged }: { meals: Meal[]; onChanged: () => void }) {
  const { toast, confirm } = useFeedback();
  // Text being typed per item id (so the input can be edited freely).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<Meal | null>(null);

  async function saveAmount(item: MealItem) {
    const raw = drafts[item.id];
    if (raw === undefined) return; // nothing typed
    const grams = Number(raw.replace(',', '.'));
    if (!Number.isFinite(grams) || grams <= 0 || grams > 5000) {
      toast(t('Mengden må være mellom 1 og 5000 g.', 'The amount must be between 1 and 5000 g.'), 'error');
      return;
    }
    if (grams === item.amount_g) return clearDraft(item.id);
    setBusyId(item.id);
    const { error } = await supabase.rpc('update_meal_item_amount', { p_item_id: item.id, p_amount_g: grams });
    setBusyId(null);
    if (error) return toast(`${t('Kunne ikke lagre', "Couldn't save")}: ${error.message}`, 'error');
    toast(
      `${item.food_name}: ${formatNumber(item.amount_g)} g → ${formatNumber(grams)} g. ${t('Næringsverdiene er justert.', 'The nutrition values have been adjusted.')}`,
    );
    clearDraft(item.id);
    onChanged();
  }

  async function deleteItem(item: MealItem, isLast: boolean) {
    const ok = await confirm({
      title: t(`Slette «${item.food_name}»?`, `Delete “${item.food_name}”?`),
      body: isLast
        ? t(
            'Dette er siste matvare i måltidet, så hele måltidet slettes. Endringen lagres i endringsloggen.',
            'This is the last food in the meal, so the whole meal is deleted. The change is saved in the change log.',
          )
        : t('Matvaren fjernes fra måltidet. Endringen lagres i endringsloggen.', 'The food is removed from the meal. The change is saved in the change log.'),
      confirmLabel: t('Slett', 'Delete'),
      danger: true,
    });
    if (!ok) return;
    setBusyId(item.id);
    const { error } = await supabase.rpc('delete_meal_item', { p_item_id: item.id });
    setBusyId(null);
    if (error) return toast(`${t('Kunne ikke slette', "Couldn't delete")}: ${error.message}`, 'error');
    toast(t(`«${item.food_name}» er slettet.`, `“${item.food_name}” has been deleted.`));
    onChanged();
  }

  function clearDraft(id: string) {
    setDrafts((all) => {
      const next = { ...all };
      delete next[id];
      return next;
    });
  }

  if (meals.length === 0) return <p className="muted">{t('Ingen måltider registrert denne dagen.', 'No meals logged this day.')}</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t('Tid', 'Time')}</th>
            <th>{t('Matvare', 'Food')}</th>
            <th className="num">{t('Mengde (g)', 'Amount (g)')}</th>
            <th className="num">kcal</th>
            <th className="num">Protein</th>
            <th className="num">{t('Karbo', 'Carbs')}</th>
            <th className="num">{t('Fett', 'Fat')}</th>
            <th>{t('Kilde', 'Source')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {meals.map((meal) => (
            <Fragment key={meal.id}>
            {meal.meal_items.map((item, i) => {
              const suspicious = item.amount_g > IMPLAUSIBLE_ITEM_G;
              return (
                <tr key={item.id} style={suspicious ? { background: 'rgba(245, 158, 11, 0.08)' } : undefined}>
                  <td className="faint">{i === 0 ? formatTime(meal.eaten_at) : ''}</td>
                  <td>
                    {item.food_name}
                    {suspicious && <span className="pill warn" style={{ marginLeft: 8 }}>{t('Uvanlig mengde', 'Unusual amount')}</span>}
                  </td>
                  <td className="num">
                    <input
                      className="num"
                      inputMode="decimal"
                      aria-label={`${t('Mengde for', 'Amount for')} ${item.food_name}`}
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
                  <td className="faint small">{item.detected_label ? (meal.recognizer ?? t('gjenkjent', 'recognized')) : t('manuelt', 'manual')}</td>
                  <td>
                    <button
                      className="small ghost danger"
                      disabled={busyId === item.id}
                      onClick={() => void deleteItem(item, meal.meal_items.length === 1)}
                      aria-label={`${t('Slett', 'Delete')} ${item.food_name}`}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
            <tr>
              <td></td>
              <td colSpan={8}>
                <button className="small ghost" onClick={() => setAddingTo(meal)}>
                  <Plus size={13} /> {t('Legg til matvare', 'Add food')}
                </button>
                {meal.admin_changed_at && <span className="faint small" style={{ marginLeft: 8 }}>{t('Endret av administrator', 'Changed by an administrator')}</span>}
              </td>
            </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
      {addingTo && (
        <AddMealItemDialog
          mealId={addingTo.id}
          mealTime={addingTo.eaten_at}
          onClose={(added) => {
            setAddingTo(null);
            if (added) onChanged();
          }}
        />
      )}
      <p className="faint small" style={{ margin: '8px 0 0' }}>
        {t(
          'Endre mengden direkte i feltet (Enter for å lagre, Esc for å angre). Næringsverdiene justeres automatisk.',
          'Change the amount directly in the field (Enter to save, Esc to undo). Nutrition values are adjusted automatically.',
        )}
      </p>
    </div>
  );
}
