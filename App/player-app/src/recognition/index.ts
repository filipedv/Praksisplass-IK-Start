// The ONLY entry point the rest of the app uses for food recognition:
//
//   import { recognizeFood, activeRecognizer } from '@/recognition';
//   const guesses = await recognizeFood({ uri });
//
// Which provider runs is chosen by EXPO_PUBLIC_RECOGNIZER in .env.
// Swapping providers never requires touching screens or nutrition code.

import { fatsecretRecognizer } from './fatsecret-recognizer';
import { mockRecognizer } from './mock-recognizer';
import type { FoodGuess, FoodRecognizer, MealImage } from './types';
import { visionRecognizer } from './vision-recognizer';

export type { FoodGuess, MealImage } from './types';

const recognizers: Record<string, FoodRecognizer> = {
  mock: mockRecognizer,
  fatsecret: fatsecretRecognizer,
  vision: visionRecognizer,
};

const chosen = process.env.EXPO_PUBLIC_RECOGNIZER ?? 'mock';

/** The recognizer in use. Falls back to the mock if the env value is unknown. */
export const activeRecognizer: FoodRecognizer = recognizers[chosen] ?? mockRecognizer;

export function recognizeFood(image: MealImage): Promise<FoodGuess[]> {
  return activeRecognizer.recognizeFood(image);
}
