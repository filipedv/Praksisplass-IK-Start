// Shared colours and sizes, taken from FinishedSketches/spiller-app-sketch.jsx (repo root)
// (its dark mode, which is the sketch's default). The sketch uses Tailwind,
// so each value names the Tailwind class it comes from.
//
// Change colours HERE, not in individual screens.

export const colors = {
  background: '#020617', // slate-950 — Dagsoversikt / Profil background
  surface: '#0F172A', // slate-900 — cards, tab bar, Kamera + login background
  surfaceRaised: '#1E293B', // slate-800 — inputs, steppers, dividers inside cards
  border: '#334155', // slate-700 — card borders
  text: '#FFFFFF', // white — headings, big numbers
  textSoft: '#F1F5F9', // slate-100 — item names
  textBody: '#E2E8F0', // slate-200 — menu rows, kcal values
  muted: '#64748B', // slate-500 — secondary text
  mutedLight: '#94A3B8', // slate-400 — loading text
  faint: '#475569', // slate-600 — inactive tab icons, trash, chevrons
  iconSoft: '#CBD5E1', // slate-300 — back arrows, stepper icons

  primary: '#4F46E5', // indigo-600 — buttons, active tab, links
  primaryBorder: '#3730A3', // indigo-800 — dashed "add" button border

  danger: '#EF4444', // red-500
  warning: '#FCD34D', // amber-300
  warningBg: '#451A03', // amber-950

  // Pills (rounded badges), e.g. "91% sikker" — Tailwind `<color>-950` bg, `-300` text.
  pill: {
    green: { bg: '#022C22', text: '#6EE7B7' }, // emerald
    amber: { bg: '#451A03', text: '#FCD34D' }, // amber
    slate: { bg: '#1E293B', text: '#CBD5E1' }, // slate-800 / slate-300
  },

  // The coloured dots under each number in "Dagens oversikt".
  macro: {
    kcal: '#10B981', // emerald-500
    protein: '#3B82F6', // blue-500
    carbs: '#FBBF24', // amber-400
    fat: '#8B5CF6', // violet-500
  },

  // Initial-letter circles in "Måltidsvarer" (light tones, as in the sketch).
  avatarTones: [
    { bg: '#D1FAE5', text: '#047857' }, // emerald-100 / emerald-700
    { bg: '#DBEAFE', text: '#1D4ED8' }, // blue-100 / blue-700
    { bg: '#FEF3C7', text: '#B45309' }, // amber-100 / amber-700
    { bg: '#EDE9FE', text: '#6D28D9' }, // violet-100 / violet-700
  ],
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

// rounded-lg = 8, rounded-xl = 12, rounded-2xl = 16, rounded-3xl = 24
export const radius = { sm: 8, md: 12, lg: 16, xl: 24 };

// text-xs = 12, text-sm = 14, text-base = 16, text-lg = 18, text-xl = 20
export const font = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20 };
