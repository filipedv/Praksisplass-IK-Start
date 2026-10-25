// Language: Norwegian (default) or English. Chosen under Innstillinger →
// Språk (and on the login screen), remembered on the phone.
//
// HOW TO WRITE TEXT in a component: get `t` from the hook, and put both
// languages side by side, Norwegian first:
//
//   const { t, locale } = useI18n();
//   <Text>{t('Lagre', 'Save')}</Text>
//   date.toLocaleDateString(locale, …)       // 'nb-NO' or 'en-GB'
//
// Why a hook and not a plain function: the React Compiler (on in this app)
// remembers what a component drew and only redraws when its inputs change.
// `t` from the hook IS an input — a new one per language — so text redraws
// when the language changes. A plain imported function would not be noticed.
//
// Outside components (e.g. notification texts) use `translate(nb, en)`.
// Helpers that format text take the language as an argument (e.g.
// mealName(date, lang)) for the same reason.
//
// Food names come from Matvaretabellen and stay Norwegian.

import 'expo-sqlite/localStorage/install';
import { useMemo, useSyncExternalStore } from 'react';

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
    // storage unavailable: still works until the app is closed
  }
  listeners.forEach((notify) => notify());
}

/** 'nb-NO' or 'en-GB' — for toLocaleDateString / toLocaleTimeString. */
export const localeFor = (language: Language) => (language === 'en' ? 'en-GB' : 'nb-NO');

/** Outside components only (see above). */
export function translate(nb: string, en: string): string {
  return current === 'en' ? en : nb;
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/** The current language, with `t` and `locale` to match. Re-renders on change. */
export function useI18n() {
  const lang = useSyncExternalStore(subscribe, getLanguage);
  const t = useMemo(() => (nb: string, en: string) => (lang === 'en' ? en : nb), [lang]);
  return { lang, t, locale: localeFor(lang) };
}
