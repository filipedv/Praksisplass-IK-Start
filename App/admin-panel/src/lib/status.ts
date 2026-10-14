// Daily goal status — the same four states as the coach dashboard sketch
// (FinishedSketches/trener-dashboard-sketch.jsx, computeStatus):
//
//   gray   = Ikke logget         (no meals that day — a follow-up, not a nutrition problem)
//   red    = Langt fra målet     (logged, but far from kcal + water goals)
//   orange = Nesten nådde målet
//   green  = Nådde målet
//
// Score = average of (kcal / kcal goal) and (water / water goal), each capped
// at 100 %. >= 85 % → green, >= 50 % → orange, otherwise red.
// Colours are reserved for status and ALWAYS shown with an icon + label.

export type Status = 'gray' | 'red' | 'orange' | 'green';

/** Display order: worst → best, as in the sketch. */
export const STATUS_ORDER: Status[] = ['gray', 'red', 'orange', 'green'];

export const STATUS_LABELS: Record<Status, string> = {
  gray: 'Ikke logget',
  red: 'Langt fra målet',
  orange: 'Nesten nådde målet',
  green: 'Nådde målet',
};

export const STATUS_EXPLANATIONS: Record<Status, string> = {
  gray: 'Ingen registrering denne dagen — en oppfølgingssak, ikke nødvendigvis et ernæringsproblem.',
  red: 'Logget, men langt unna ernærings- og væskemålet.',
  orange: 'Kom et stykke på vei, men nådde ikke hele målet.',
  green: 'Nådde både ernærings- og væskemålet for dagen.',
};

/** CSS variable for each status (defined in index.css). */
export const STATUS_COLORS: Record<Status, string> = {
  gray: 'var(--status-gray)',
  red: 'var(--status-red)',
  orange: 'var(--status-orange)',
  green: 'var(--status-green)',
};

export function computeStatus(kcal: number, waterMl: number, kcalGoal: number, waterGoal: number): Status {
  if (!kcal) return 'gray'; // nothing logged
  const kcalShare = Math.min(kcal / kcalGoal, 1);
  const waterShare = Math.min((waterMl || 0) / waterGoal, 1);
  const score = (kcalShare + waterShare) / 2;
  if (score >= 0.85) return 'green';
  if (score >= 0.5) return 'orange';
  return 'red';
}
