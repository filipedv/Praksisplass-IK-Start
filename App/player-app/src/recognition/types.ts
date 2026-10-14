// THE food-recognition contract. Everything outside src/recognition/ only
// knows about these types and `recognizeFood()` from ./index.ts — never about
// FatSecret, Claude, or any other provider's SDK.
//
// A recognizer only ever produces food LABELS. Nutrition always comes from
// our cached Matvaretabellen table (see src/nutrition/foods-api.ts).

export type FoodGuess = {
  /** Food name as the provider says it, e.g. "banana". Used for matching only. */
  label: string;
  /**
   * 0–1, how sure the provider is. `null` when the provider doesn't give one
   * (FatSecret's image recognition API returns no confidence score).
   */
  confidence: number | null;
  /**
   * The value we're ALLOWED to save in our database for this guess.
   * Some providers' terms forbid storing their food names (FatSecret only
   * allows storing its food_id), so each adapter decides this.
   */
  storableId: string;
};

/** A photo on the phone, as a local file:// URI. */
export type MealImage = { uri: string };

export type RecognizerId = 'mock' | 'fatsecret' | 'vision';

export interface FoodRecognizer {
  id: RecognizerId;
  /** Attribution text we must show wherever this provider's results are used. */
  attribution: string | null;
  recognizeFood(image: MealImage): Promise<FoodGuess[]>;
}
