// The LINK LIST (table food_aliases): recognizer label → the food it means.
// Admins create links here; the player app checks them before fuzzy matching.
// Only active admins may write (RLS); every signed-in user may read.

import { supabase } from './supabase';

export type FoodAlias = {
  id: string;
  label: string; // lower-cased, e.g. "chicken breast" or "fatsecret:12345"
  created_at: string;
  food: { id: string; name_nb: string; source: 'matvaretabellen' | 'custom' } | null;
};

/** Same normalisation as the database trigger, so lookups line up. */
export const normalizeLabel = (label: string) => label.trim().toLowerCase();

export async function listAliases(): Promise<FoodAlias[]> {
  const { data, error } = await supabase
    .from('food_aliases')
    .select('id, label, created_at, food:foods (id, name_nb, source)')
    .order('label');
  if (error) throw error;
  return (data ?? []) as unknown as FoodAlias[];
}

/** Link a label to a food. If the label is already linked, it's re-pointed. */
export async function linkLabel(label: string, foodId: string) {
  const { error } = await supabase
    .from('food_aliases')
    .upsert({ label: normalizeLabel(label), food_id: foodId }, { onConflict: 'label' });
  if (error) throw error;
}

export async function removeAlias(id: string) {
  const { error } = await supabase.from('food_aliases').delete().eq('id', id);
  if (error) throw error;
}
