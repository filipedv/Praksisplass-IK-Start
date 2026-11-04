// Small formatting helpers. Norwegian uses a decimal comma (72,4), English
// a decimal point (72.4) — formatNumber follows the chosen language.

import { getLanguage, locale, t } from './i18n';
import type { NutrientKey, Nutrition } from './types';

export function formatNumber(value: number | undefined | null, decimals = 0): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '–';
  const text = value.toFixed(decimals);
  return getLanguage() === 'en' ? text : text.replace('.', ',');
}

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });

export const formatDay = (date: Date) =>
  date.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Date → "2026-10-14" in local time (what <input type="date"> uses). */
export function toISODate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-10-14" + n days → "2026-10-14"-style string (calendar days, DST-safe). */
export function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`); // noon: never near a DST switch
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Add several nutrition objects together. */
export function sumNutrition(list: Nutrition[]): Nutrition {
  const total: Nutrition = {};
  for (const n of list) {
    for (const key of Object.keys(n) as NutrientKey[]) {
      total[key] = (total[key] ?? 0) + (n[key] ?? 0);
    }
  }
  return total;
}

/** "I dag 12:30", "I går", "For 4 dager siden", "Aldri" (relative to `todayIso`). */
export function lastLoggedText(iso: string | null, todayIso: string): string {
  if (!iso) return t('Aldri', 'Never');
  const then = new Date(iso);
  const days = Math.round((new Date(todayIso).getTime() - new Date(toISODate(then)).getTime()) / 86_400_000);
  if (days === 0) return `${t('I dag', 'Today')} ${then.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}`;
  if (days === 1) return t('I går', 'Yesterday');
  return t(`For ${days} dager siden`, `${days} days ago`);
}
