// Small formatting helpers (Norwegian style: comma as decimal separator).

import type { NutrientKey, Nutrition } from './types';

export function formatNumber(value: number | undefined | null, decimals = 0): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '–';
  return value.toFixed(decimals).replace('.', ',');
}

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });

export const formatDay = (date: Date) =>
  date.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

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
