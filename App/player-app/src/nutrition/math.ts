// Small, pure helpers for nutrition numbers. "Pure" = no network, no state:
// same input → same output, which makes them easy to reason about.
//
// NOTE: when a meal is SAVED, the database (log_meal) computes the stored
// nutrition itself. These helpers are only for showing live previews while
// the user edits amounts.

import type { Food, NutrientKey, Nutrition, Portion } from './types';

/** Nutrition for `grams` of a food whose values are per 100 g. */
export function scaleNutrition(per100g: Nutrition, grams: number): Nutrition {
  const result: Nutrition = {};
  for (const key of Object.keys(per100g) as NutrientKey[]) {
    result[key] = ((per100g[key] ?? 0) * grams) / 100;
  }
  return result;
}

/** Add several nutrition objects together (e.g. all items in a meal). */
export function sumNutrition(list: Nutrition[]): Nutrition {
  const total: Nutrition = {};
  for (const n of list) {
    for (const key of Object.keys(n) as NutrientKey[]) {
      total[key] = (total[key] ?? 0) + (n[key] ?? 0);
    }
  }
  return total;
}

/** Norwegian number format: 1 decimal at most, comma as decimal separator. */
export function formatNumber(value: number | undefined, decimals = 0): string {
  if (value === undefined || Number.isNaN(value)) return '–';
  return value.toFixed(decimals).replace('.', ',');
}

/** Sensible starting amount for a food: one preferred portion, else 100 g. */
export function defaultAmountGrams(food: Food): number {
  return food.portions[0]?.grams ?? 100;
}

// Norwegian plurals for the most common Matvaretabellen portion names.
// Names not listed (stk, glass, desiliter, beger …) are the same in plural.
const PLURALS: Record<string, string> = {
  porsjon: 'porsjoner',
  skive: 'skiver',
  kopp: 'kopper',
  pakke: 'pakker',
  spiseskje: 'spiseskjeer',
  teskje: 'teskjeer',
};

/** "porsjon" → "porsjoner", "skive (tynn)" → "skiver (tynn)". */
function pluralize(name: string): string {
  const [first, ...rest] = name.split(' ');
  return [PLURALS[first] ?? first, ...rest].join(' ');
}

/**
 * The portion-equivalent shown next to grams, e.g. "≈ 1 porsjon", "≈ 1,5 porsjoner".
 * Rounded to the nearest half portion. Returns null if the food has no portions.
 */
export function portionEquivalent(grams: number, portions: Portion[]): string | null {
  const portion = portions[0];
  if (!portion || grams <= 0) return null;

  const count = Math.round((grams / portion.grams) * 2) / 2; // nearest 0.5
  if (count === 0) return `< ½ ${portion.name}`;
  const name = count > 1 ? pluralize(portion.name) : portion.name;
  return `≈ ${formatNumber(count, Number.isInteger(count) ? 0 : 1)} ${name}`;
}
