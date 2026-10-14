// Date helpers, ported from the sketch. All "days" are in the PHONE'S local
// timezone: a meal at 23:30 belongs to that evening, not to UTC's next day.
//
// We pass days between screens as ISO strings like "2026-10-14" (in the URL,
// e.g. /today?date=2026-10-14) because they're simple and unambiguous.

const pad2 = (n: number) => n.toString().padStart(2, '0');

/** Date → "2026-10-14" (local day). */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** "2026-10-14" → Date at local midnight. Falls back to today if the text is invalid. */
export function parseISODate(iso: string | undefined): Date {
  const match = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return startOfDay(new Date());
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isToday(date: Date): boolean {
  return toISODate(date) === toISODate(new Date());
}

/**
 * Start (inclusive) and end (exclusive) of a local day, as ISO timestamps
 * for database queries: `eaten_at >= start and eaten_at < end`.
 */
export function dayRange(date: Date): { start: string; end: string } {
  const start = startOfDay(date);
  return { start: start.toISOString(), end: addDays(start, 1).toISOString() };
}

/** "Onsdag 14. oktober" */
export function formatDayDate(date: Date): string {
  const s = date.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Oktober 2026" */
export function formatMonthYear(date: Date): string {
  const s = date.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "14:05" */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}
