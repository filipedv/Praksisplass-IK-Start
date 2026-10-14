// Reading and writing meals.

import { getCached, setCached } from '@/lib/cache';
import { dayRange, toISODate } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import type { Nutrition } from '@/nutrition/types';

export type MealItem = {
  id: string;
  food_name: string;
  amount_g: number;
  nutrition: Nutrition; // already scaled to amount_g
};

export type Meal = {
  id: string;
  eaten_at: string;
  meal_items: MealItem[];
};

/** What the capture flow sends when saving. */
export type NewMealItem = {
  food_id: string;
  amount_g: number;
  detected_label: string | null; // a storableId from the recognizer, or null
};

/**
 * Save a meal. The database function log_meal() computes the nutrition from
 * the foods table and inserts meal + items in one transaction.
 */
export async function saveMeal(items: NewMealItem[], recognizer: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('log_meal', {
    p_items: items,
    p_recognizer: recognizer,
  });
  if (error) throw error;
  return data as string;
}

/** One day's meals for the logged-in user (phone's local day), oldest first. */
export async function fetchMealsForDay(userId: string, day: Date): Promise<Meal[]> {
  const { start, end } = dayRange(day);

  const { data, error } = await supabase
    .from('meals')
    .select('id, eaten_at, meal_items (id, food_name, amount_g, nutrition)')
    // RLS already limits a player to their own meals, but an ADMIN can read
    // everyone's — so we always filter on our own id explicitly.
    .eq('user_id', userId)
    .gte('eaten_at', start)
    .lt('eaten_at', end)
    .order('eaten_at', { ascending: true });

  if (error) throw error;
  const meals = (data ?? []).map((meal) => ({
    ...meal,
    // Postgres numeric comes back as a string — convert to a number.
    meal_items: meal.meal_items.map((item) => ({ ...item, amount_g: Number(item.amount_g) })),
  }));

  // Remember the result, so screens can show it instantly next time.
  for (const meal of meals) setCached(`meal:${meal.id}`, meal);
  return setCached(dayKey(userId, day), meals);
}

const dayKey = (userId: string, day: Date) => `meals:${userId}:${toISODate(day)}`;

/** What fetchMealsForDay returned last time for this day (or undefined). */
export const getCachedMealsForDay = (userId: string, day: Date) => getCached<Meal[]>(dayKey(userId, day));

/** A meal we already fetched (e.g. from Dagsoversikt's list), or undefined. */
export const getCachedMeal = (mealId: string) => getCached<Meal>(`meal:${mealId}`);

export async function deleteMeal(mealId: string) {
  // Items are removed automatically (on delete cascade).
  const { error } = await supabase.from('meals').delete().eq('id', mealId);
  if (error) throw error;
}

/** One meal with its items, for the meal detail screen. RLS decides access. */
export async function fetchMeal(mealId: string): Promise<Meal | null> {
  const { data, error } = await supabase
    .from('meals')
    .select('id, eaten_at, meal_items (id, food_name, amount_g, nutrition)')
    .eq('id', mealId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const meal = { ...data, meal_items: data.meal_items.map((item) => ({ ...item, amount_g: Number(item.amount_g) })) };
  return setCached(`meal:${meal.id}`, meal);
}
