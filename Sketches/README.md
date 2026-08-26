# Sketches

Frontend sketches used to explore screens and navigation flow before building
the real app. These are **not part of the app** and are not meant to be run,
imported, or built on directly.

## What these are

- Built with Claude as throwaway visual/flow references, generated as web
  React (JSX + Tailwind CSS), not the project's real stack.
- The real app is **Expo + React Native + TypeScript**. Elements like `<div>`,
  `<button>`, and the Tailwind classes used here are web-only and will not
  run in Expo as-is. Treat these as a reference for layout, flow, and logic
  — not as code to copy in directly.
- No `package.json` or dependencies are included, so these files won't affect
  the app's build in any way just by sitting in this folder.

## Files

- `spiller-app-sketch.jsx` — sketch of the **player (spiller)** role: login,
  camera capture → food recognition → confirm/edit, Dagsoversikt with date
  navigation, Søk, Vann, and Profil/Innstillinger.

More role-specific sketches (e.g. coach/admin) will be added here as they're
made, each named for the role it covers.
