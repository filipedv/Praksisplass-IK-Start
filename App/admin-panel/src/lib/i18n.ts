// Language: Norwegian (default) or English. Chosen per browser in the
// sidebar ("Norsk / English") and remembered in localStorage.
//
// HOW TO WRITE TEXT: put both languages side by side, Norwegian first:
//
//   t('Lagre', 'Save')
//   t(`${name} er lagt til.`, `${name} has been added.`)
//
// Dates and numbers: use `locale()` instead of a fixed 'nb-NO'.
//
// Why a plain function works everywhere (also in lib/ files): when the
// language changes, App.tsx re-mounts the whole panel (`key={language}`),
// so every text is produced again. The URL — and so the page — stays.
//
// Food names come from Matvaretabellen and stay Norwegian (name_en is
// shown where we already show it).

import { useSyncExternalStore } from 'react';

export type Language = 'nb' | 'en';

const STORAGE_KEY = 'language';

function load(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'nb';
  } catch {
    return 'nb';
  }
}

let current: Language = load();
const listeners = new Set<() => void>();

export const getLanguage = () => current;

export function setLanguage(language: Language) {
  current = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // private window etc. — still works for this visit
  }
  document.documentElement.lang = language === 'en' ? 'en' : 'nb';
  listeners.forEach((notify) => notify());
}

/** The text for the current language. */
export function t(nb: string, en: string): string {
  return current === 'en' ? en : nb;
}

/**
 * A lookup table whose texts follow the language — for label lists:
 *   const ACTION_LABELS = labels({ insert: ['Opprettet', 'Created'], … });
 *   ACTION_LABELS.insert  // "Opprettet" or "Created", whichever is current
 * (A plain object would be filled in once, in one language, at start-up.)
 */
export function labels<K extends string>(table: Record<K, [nb: string, en: string]>): Record<K, string> {
  const result = {} as Record<K, string>;
  for (const key of Object.keys(table) as K[]) {
    const [nb, en] = table[key];
    Object.defineProperty(result, key, { enumerable: true, get: () => t(nb, en) });
  }
  return result;
}

/** For toLocaleDateString / toLocaleString: 'nb-NO' or 'en-GB'. */
export const locale = () => (current === 'en' ? 'en-GB' : 'nb-NO');

/** The current language, re-rendering when it changes (used by App.tsx and the switch). */
export function useLanguage(): Language {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    getLanguage,
  );
}

document.documentElement.lang = current === 'en' ? 'en' : 'nb';
