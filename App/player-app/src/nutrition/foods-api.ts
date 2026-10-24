// Everything that reads the cached Matvaretabellen `foods` table.
// This is where recognizer labels get turned into real nutrition data.

import { supabase } from '@/lib/supabase';
import type { FoodGuess } from '@/recognition';

import type { FoodSearchResult } from './types';

/**
 * A guess counts as "matched" if the best food scores at least this much
 * (0–1). Below it, we'd rather ask the user than log the wrong food.
 * See search_foods() in the migration for how the score is computed.
 */
export const MATCH_THRESHOLD = 0.7;

/** Fuzzy search, best match first. Works with Norwegian or English text. */
export async function searchFoods(text: string, maxResults = 20): Promise<FoodSearchResult[]> {
  if (!text.trim()) return [];
  const { data, error } = await supabase.rpc('search_foods', { search_text: text, max_results: maxResults });
  if (error) throw error;
  return data as FoodSearchResult[];
}

export type MatchedGuess = {
  guess: FoodGuess;
  /** Best matching food, or null if nothing scored above MATCH_THRESHOLD. */
  food: FoodSearchResult | null;
};

/** Aliases are stored lower-cased and trimmed — look them up the same way. */
const normalizeLabel = (label: string) => label.trim().toLowerCase();

/**
 * The admins' LINK LIST (table food_aliases): label → the food it means.
 * Admins fix labels that fuzzy matching gets wrong or can't place, e.g.
 * "chicken breast" → «Kylling, filet, uten skinn, rå». Keys can be plain
 * labels or storable ids such as "fatsecret:12345".
 * If this request fails we just fall back to fuzzy matching.
 */
async function fetchAliases(keys: string[]): Promise<Map<string, FoodSearchResult>> {
  const links = new Map<string, FoodSearchResult>();
  if (keys.length === 0) return links;
  const { data, error } = await supabase
    .from('food_aliases')
    .select('label, food:foods (id, source, name_nb, name_en, nutrition, portions)')
    .in('label', keys);
  if (error) {
    console.warn('Could not load food links, using fuzzy matching only:', error.message);
    return links;
  }
  for (const row of (data ?? []) as unknown as { label: string; food: Omit<FoodSearchResult, 'score'> | null }[]) {
    // An admin chose this food on purpose, so it's a certain match (score 1).
    if (row.food) links.set(row.label, { ...row.food, score: 1 });
  }
  return links;
}

/**
 * Turn every recognizer guess into a food:
 *   1. an admin's link for the guess (its storable id first, then its label), else
 *   2. the best fuzzy match in Matvaretabellen, if it scores >= MATCH_THRESHOLD, else
 *   3. null → the user picks the food themselves.
 */
export async function matchGuesses(guesses: FoodGuess[]): Promise<MatchedGuess[]> {
  const keys = [...new Set(guesses.flatMap((g) => [normalizeLabel(g.storableId), normalizeLabel(g.label)]))];
  const links = await fetchAliases(keys);

  return Promise.all(
    guesses.map(async (guess) => {
      const linked = links.get(normalizeLabel(guess.storableId)) ?? links.get(normalizeLabel(guess.label));
      if (linked) return { guess, food: linked };

      const [best] = await searchFoods(guess.label, 1);
      return { guess, food: best && best.score >= MATCH_THRESHOLD ? best : null };
    }),
  );
}

/**
 * Record how many labels matched, so we can judge Matvaretabellen coverage
 * for each recognizer. Stores only storable ids — never the photo.
 * Failure here must never block the user, so errors are only logged.
 */
export async function logRecognitionEvent(provider: string, matches: MatchedGuess[]) {
  const labels = matches.map((m) => m.guess.storableId);
  const unmatched = matches.filter((m) => !m.food).map((m) => m.guess.storableId);

  // Visible in the Metro terminal while developing.
  console.log(`[recognition] ${provider}: ${unmatched.length}/${labels.length} labels unmatched`, unmatched);

  const { error } = await supabase
    .from('recognition_events')
    .insert({ provider, labels, unmatched_labels: unmatched });
  if (error) console.warn('Could not save recognition event:', error.message);
}
