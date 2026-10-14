// The sketch shows meals as "Frokost · 08:10", "Lunsj · 13:15" …
// We don't store a meal name, so we derive one from the time it was eaten.
// Display only — change the boundaries here if they don't fit the squad's day.

export function mealName(eatenAt: Date): string {
  const minutes = eatenAt.getHours() * 60 + eatenAt.getMinutes();
  if (minutes < 4 * 60) return 'Kveldsmat'; // after midnight
  if (minutes < 10 * 60 + 30) return 'Frokost';
  if (minutes < 14 * 60 + 30) return 'Lunsj';
  if (minutes < 18 * 60) return 'Middag';
  return 'Kveldsmat';
}
