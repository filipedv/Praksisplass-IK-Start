// The sketch shows meals as "Frokost · 08:10", "Lunsj · 13:15" …
// We don't store a meal name, so we derive one from the time it was eaten.
// Display only — change the boundaries here if they don't fit the squad's day.

import type { Language } from '@/lib/i18n';

export function mealName(eatenAt: Date, lang: Language): string {
  const en = lang === 'en';
  const minutes = eatenAt.getHours() * 60 + eatenAt.getMinutes();
  if (minutes < 4 * 60) return en ? 'Evening meal' : 'Kveldsmat'; // after midnight
  if (minutes < 10 * 60 + 30) return en ? 'Breakfast' : 'Frokost';
  if (minutes < 14 * 60 + 30) return en ? 'Lunch' : 'Lunsj';
  if (minutes < 18 * 60) return en ? 'Dinner' : 'Middag';
  return en ? 'Evening meal' : 'Kveldsmat';
}
