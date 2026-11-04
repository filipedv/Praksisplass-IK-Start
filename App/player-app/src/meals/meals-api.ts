// Reading and writing meals.
//
// Nutrition is never computed here for saving: the database functions
// (log_meal, add_meal_item, update_meal_item_amount) work it out from the
// foods table, so values always come from Matvaretabellen.

import { getCached, setCached } from '@/lib/cache';
import type { Json } from '@/lib/database.types';
import { dayRange, toISODate } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import type { Food, Nutrition, Portion } from '@/nutrition/types';

export type MealItem = {
  id: string;
  food_id: string | null; // null if the food was deleted later (the snapshot stays)
  food_name: string;
  amount_g: number;
  nutrition: Nutrition; // already scaled to amount_g
};

export type Meal = {
  id: string;
  eaten_at: string;
  /** Set when an administrator added/changed/removed something in this meal. */
  admin_changed_at: string | null;
  meal_items: MealItem[];
};

/** What the capture flow sends when saving. */
export type NewMealItem = {
  food_id: string;
  amount_g: number;
  detected_label: string | null; // a storableId from the recognizer, or null
};

const MEAL_COLUMNS = 'id, eaten_at, admin_changed_at, meal_items (id, food_id, food_name, amount_g, nutrition)';

type RawItem = { id: string; food_id: string | null; food_name: string; amount_g: number | string; nutrition: Json };
type RawMeal = { id: string; eaten_at: string; admin_changed_at: string | null; meal_items: RawItem[] };

/** Database row → our types (jsonb comes back as generic JSON, numeric as text). */
function toMeal(raw: RawMeal): Meal {
  return {
    ...raw,
    meal_items: raw.meal_items.map((item) => ({
      ...item,
      amount_g: Number(item.amount_g),
      nutrition: (item.nutrition ?? {}) as Nutrition,
    })),
  };
}

/**
 * Save a meal. The database function log_meal() computes the nutrition from
 * the foods table and inserts meal + items in one transaction.
 * `eatenAt` lets the player log a meal after the fact (default: now).
 */
export async function saveMeal(items: NewMealItem[], recognizer: string | null, eatenAt?: Date): Promise<string> {
  const { data, error } = await supabase.rpc('log_meal', {
    p_items: items,
    p_recognizer: recognizer ?? undefined, // undefined = use the database default (null)
    p_eaten_at: eatenAt?.toISOString(),
  });
  if (error) throw error;
  return data;
}

/** One day's meals for the logged-in user (phone's local day), oldest first. */
export async function fetchMealsForDay(userId: string, day: Date): Promise<Meal[]> {
  const { start, end } = dayRange(day);

  const { data, error } = await supabase
    .from('meals')
    .select(MEAL_COLUMNS)
    // RLS already limits a player to their own meals, but an ADMIN can read
    // everyone's — so we always filter on our own id explicitly.
    .eq('user_id', userId)
    .gte('eaten_at', start)
    .lt('eaten_at', end)
    .order('eaten_at', { ascending: true });

  if (error) throw error;
  const meals = (data ?? []).map(toMeal);

  // Remember the result, so screens can show it instantly next time.
  for (const meal of meals) setCached(`meal:${meal.id}`, meal);
  return setCached(dayKey(userId, day), meals);
}

const dayKey = (userId: string, day: Date) => `meals:${userId}:${toISODate(day)}`;

/** What fetchMealsForDay returned last time for this day (or undefined). */
export const getCachedMealsForDay = (userId: string, day: Date) => getCached<Meal[]>(dayKey(userId, day));

/** A meal we already fetched (e.g. from Dagsoversikt's list), or undefined. */
export const getCachedMeal = (mealId: string) => getCached<Meal>(`meal:${mealId}`);

/** One meal with its items, for the meal detail screen. RLS decides access. */
export async function fetchMeal(mealId: string): Promise<Meal | null> {
  const { data, error } = await supabase.from('meals').select(MEAL_COLUMNS).eq('id', mealId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return setCached(`meal:${data.id}`, toMeal(data));
}

export async function deleteMeal(mealId: string) {
  // Items are removed automatically (on delete cascade).
  const { error } = await supabase.from('meals').delete().eq('id', mealId);
  if (error) throw error;
}

// ---- Editing a saved meal (the player's own) ----

/** Change an item's grams; the saved nutrition is rescaled in the database. */
export async function updateItemAmount(itemId: string, grams: number) {
  const { error } = await supabase.rpc('update_meal_item_amount', { p_item_id: itemId, p_amount_g: grams });
  if (error) throw error;
}

/** Remove an item; if it was the last one, the meal is removed too. */
export async function deleteItem(itemId: string) {
  const { error } = await supabase.rpc('delete_meal_item', { p_item_id: itemId });
  if (error) throw error;
}

/** Add a food to an existing meal (nutrition computed in the database). */
export async function addItem(mealId: string, foodId: string, grams: number) {
  const { error } = await supabase.rpc('add_meal_item', { p_meal_id: mealId, p_food_id: foodId, p_amount_g: grams });
  if (error) throw error;
}

/** Move a meal to another time (e.g. "this was yesterday's dinner"). */
export async function updateMealTime(mealId: string, eatenAt: Date) {
  const { error } = await supabase.from('meals').update({ eaten_at: eatenAt.toISOString() }).eq('id', mealId);
  if (error) throw error;
}

// ---- Quick logging ----

export type RecentFood = Food & { timesUsed: number; typicalAmountG: number };

/** My most-used foods over the last 90 days, with my usual amount. */
export async function fetchRecentFoods(limit = 8): Promise<RecentFood[]> {
  const { data, error } = await supabase.rpc('recent_foods', { p_limit: limit });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    source: row.source as Food['source'],
    name_nb: row.name_nb,
    name_en: row.name_en,
    nutrition: row.nutrition as Nutrition,
    portions: row.portions as Portion[],
    timesUsed: row.times_used,
    typicalAmountG: Number(row.typical_amount_g),
  }));
}

/** Full food rows by id — used by "Logg igjen" to rebuild a meal as a draft. */
export async function fetchFoodsByIds(ids: string[]): Promise<Map<string, Food>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from('foods').select('id, source, name_nb, name_en, nutrition, portions').in('id', ids);
  if (error) throw error;
  return new Map(
    (data ?? []).map((row) => [
      row.id,
      { ...row, source: row.source as Food['source'], nutrition: row.nutrition as Nutrition, portions: row.portions as Portion[] },
    ]),
  );
}
