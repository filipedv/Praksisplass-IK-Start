// Fake recognizer for development: no network, no API key, no cost.
// It ignores the photo and cycles through a few canned meals, so you can test
// the whole flow (including a label that DOESN'T match Matvaretabellen).
//
// Labels are in English on purpose, to behave like a real provider.

import type { FoodGuess, FoodRecognizer } from './types';

const CANNED_MEALS: { label: string; confidence: number }[][] = [
  [
    { label: 'chicken breast', confidence: 0.91 }, // won't match → tests the "not found" path
    { label: 'rice', confidence: 0.88 },
    { label: 'broccoli', confidence: 0.79 },
  ],
  [
    { label: 'banana', confidence: 0.95 },
    { label: 'yogurt', confidence: 0.84 },
    { label: 'orange juice', confidence: 0.72 },
  ],
  [
    { label: 'bread', confidence: 0.9 },
    { label: 'cheese', confidence: 0.86 },
    { label: 'egg', confidence: 0.81 },
  ],
];

// Start at a random meal: the counter resets every time the app reloads, so
// starting at 0 would always show the same example meal first.
let nextMeal = Math.floor(Math.random() * CANNED_MEALS.length);

export const mockRecognizer: FoodRecognizer = {
  id: 'mock',
  attribution: null,

  async recognizeFood(_image) {
    // Pretend to think for a moment, like a real API call would.
    await new Promise((resolve) => setTimeout(resolve, 800));

    const meal = CANNED_MEALS[nextMeal % CANNED_MEALS.length];
    nextMeal += 1;

    // The mock's labels aren't from any provider, so storing them is fine.
    return meal.map((g): FoodGuess => ({ ...g, storableId: g.label }));
  },
};
