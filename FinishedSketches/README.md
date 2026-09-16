# Sketches

Frontend sketches used to explore screens, navigation flow, and role-specific
features before building the real app. These are **not part of the app** and
are not meant to be run, imported, or built on directly.

## What these are

- Built with Claude as throwaway visual/flow references, generated as web
  React (JSX + Tailwind CSS), not the project's real stack.
- The real app is **Expo + React Native + TypeScript**. Elements like `<div>`,
  `<button>`, and the Tailwind classes used here are web-only and will not
  run in Expo as-is. Treat these as a reference for layout, flow, and logic
  — not as code to copy in directly.
- No `package.json` or dependencies are included, so these files won't affect
  the app's build in any way just by sitting in this folder. To actually run
  one locally (e.g. to demo it), see "Running a sketch" below.
- Each file is fully self-contained with its own mock data — there is no
  shared backend between them. Where two sketches show the same player (e.g.
  Kasper Dahl's allergy or phone number), that's mock data kept in sync by
  hand for the demo, not an actual data connection.

## Files

- **`spiller-app-sketch.jsx`** — the **player (spiller)** role. Login →
  camera capture → food recognition → confirm/edit, Dagsoversikt with date
  navigation (day arrows + month calendar), meal detail, Søk, Vann, and
  Profil with Innstillinger/Profilinnstillinger.

- **`foresatte-app-sketch.jsx`** — the **guardian (foresatte)** role. Same
  app and access as the player, plus a "Foresatte" section on Profil where a
  guardian registers height and phone number for Mor/Far (the phone numbers
  are what feed the coach apps' emergency contact display).

- **`trener-dashboard-sketch.jsx`** — the **coach desktop dashboard**. A
  "Trenger oppfølging" to-do list (not-logged, rapid weight-change, and
  nutrition-streak alerts, each dismissible), a squad-wide status overview,
  a searchable/sortable player list, and a per-player page with Dagsoversikt,
  weight/height graphs, editable nutrition goals, a critical-info (allergy)
  panel, a collapsible emergency-contact section, and private coach notes.

- **`trener-mobile-sketch.jsx`** — a **stripped-down mobile companion** for
  coaches, since the desktop dashboard assumes a laptop a coach won't always
  have on the pitch or bus. Same to-do list and player lookup, plus critical
  info, emergency contact, a simplified Dagsoversikt, and quick notes — but
  deliberately **no** graphs, measurement entry, or goal-tuning, which stay
  desktop-only.

All four support **dark mode** (on by default, toggle top-right) and
**Norwegian/English** (toggle top-right, next to dark mode).

## Running a sketch

These aren't runnable as-is, but any single file can be previewed in a few
minutes:

1. `npm create vite@latest sketch-preview -- --template react`, then
   `cd sketch-preview && npm install`
2. `npm install lucide-react recharts` (recharts is only used by the coach
   dashboard's graphs, but harmless to install regardless)
3. In `index.html`, add `<script src="https://cdn.tailwindcss.com"></script>`
   inside `<head>` — gives every Tailwind class with zero config
4. Paste a sketch file's full contents into `src/App.jsx`
5. `npm run dev` and open the printed localhost URL

Swap in a different sketch at any time by replacing `App.jsx`'s contents —
no restart needed, Vite hot-reloads on save.
