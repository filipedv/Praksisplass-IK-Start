// Small, pure helpers for nutrition numbers. "Pure" = no network, no state:
// same input → same output, which makes them easy to reason about.
//
// NOTE: when a meal is SAVED, the database (log_meal) computes the stored
// nutrition itself. These helpers are only for showing live previews while
// the user edits amounts.

import type { Food, NutrientKey, Nutrition, Portion } from './types';
import type { Language } from '@/lib/i18n';

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

/** A number with `decimals` decimals: "1,5" in Norwegian, "1.5" in English. */
export function formatNumber(value: number | undefined, decimals = 0, lang: Language = 'nb'): string {
  if (value === undefined || Number.isNaN(value)) return '–';
  const text = value.toFixed(decimals);
  return lang === 'en' ? text : text.replace('.', ',');
}

/** Sensible starting amount for a food: one preferred portion, else 100 g. */
export function defaultAmountGrams(food: Food): number {
  return food.portions[0]?.grams ?? 100;
}

// Matvaretabellen's portion names are Norwegian. The common ones get a
// plural and an English name: [plural, English, English plural].
// Names not listed (e.g. "stk", "beger") are shown as they are.
const PORTION_WORDS: Record<string, [string, string, string]> = {
  porsjon: ['porsjoner', 'portion', 'portions'],
  skive: ['skiver', 'slice', 'slices'],
  kopp: ['kopper', 'cup', 'cups'],
  pakke: ['pakker', 'pack', 'packs'],
  spiseskje: ['spiseskjeer', 'tablespoon', 'tablespoons'],
  teskje: ['teskjeer', 'teaspoon', 'teaspoons'],
  stk: ['stk', 'piece', 'pieces'],
  glass: ['glass', 'glass', 'glasses'],
  desiliter: ['desiliter', 'decilitre', 'decilitres'],
  beger: ['beger', 'tub', 'tubs'],
};

/** "porsjon" → "porsjoner" / "portion" / "portions"; "skive (tynn)" → "slices (tynn)". */
export function portionName(name: string, plural: boolean, lang: Language): string {
  const [first, ...rest] = name.split(' ');
  const words = PORTION_WORDS[first];
  if (!words) return name;
  const word = lang === 'en' ? (plural ? words[2] : words[1]) : plural ? words[0] : first;
  return [word, ...rest].join(' ');
}

/**
 * The portion-equivalent shown next to grams, e.g. "≈ 1 porsjon", "≈ 1,5 porsjoner".
 * Rounded to the nearest half portion. Returns null if the food has no portions.
 */
export function portionEquivalent(grams: number, portions: Portion[], lang: Language): string | null {
  const portion = portions[0];
  if (!portion || grams <= 0) return null;

  const count = Math.round((grams / portion.grams) * 2) / 2; // nearest 0.5
  if (count === 0) return `< ½ ${portionName(portion.name, false, lang)}`;
  const name = portionName(portion.name, count > 1, lang);
  return `≈ ${formatNumber(count, Number.isInteger(count) ? 0 : 1, lang)} ${name}`;
}
