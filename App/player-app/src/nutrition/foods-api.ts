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

/** Look up every recognizer label in Matvaretabellen (in parallel). */
export async function matchGuesses(guesses: FoodGuess[]): Promise<MatchedGuess[]> {
  return Promise.all(
    guesses.map(async (guess) => {
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
