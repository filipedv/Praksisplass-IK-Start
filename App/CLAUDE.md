# IK Start Ernæring — context for Claude Code

Nutrition-tracking app for **IK Start** (Eliteserien football club, Kristiansand):
academy and A-team players log meals by photo and track nutrition and water.
Built by three IT/information-systems students as an internship project.

**We are learners.** Favour simple, clearly structured, well-commented,
beginner-friendly code over clever code. Explain decisions when you make them.

## Status and hard limits

- **Internal test only.** The three of us use it on our own phones. **No real
  academy player or guardian may be onboarded** until the GDPR work is done:
  guardian consent flow, a DPIA (data protection impact assessment), and EU-region
  routing for the vision API call. Don't build features that assume real minors.
- Built so far: the **player app** (camera → recognize → confirm/edit → save,
  Dagsoversikt with date navigation + calendar, water tracking, meal detail,
  Profil, Personvernnotater) and the **admin panel** (Oversikt dashboard with
  "Trenger oppfølging", users/roles/accounts, per-player page with editable
  goals + charts, foods editor, club settings, recognition coverage).
- Recognition runs on the **mock** by default. The FatSecret key currently lacks
  the `image-recognition` OAuth scope (it grants `basic premier barcode`), and
  FatSecret image recognition is a **14-day trial** — don't start it until we're
  ready to measure (see Roadmap).

## Repo layout

| Folder | What |
| --- | --- |
| `player-app/` | React Native + **Expo SDK 57** + TypeScript, Expo Router. Tested via **Expo Go**. Read `player-app/AGENTS.md` (Expo's own rules: use `npx expo install`, check versioned docs — Expo changes every SDK). |
| `admin-panel/` | React + Vite + TypeScript + React Router 8 + lucide-react icons. Desk tool, plain CSS (dark, after the coach dashboard sketch), not mobile-optimised. |
| `supabase/migrations/` | Schema, RLS, triggers, RPC functions. Apply with `npx supabase db push` (CLI is linked). |
| `supabase/functions/admin-users/` | Edge Function (Deno) for account management from the admin panel. Deploy: `npx supabase functions deploy admin-users --use-api`. Typecheck: `npx deno check --config deno.json index.ts` in its folder. |
| `scripts/seed-foods/` | Downloads Matvaretabellen (`/api/nb` + `/api/en` foods.json) and upserts into `foods`. Uses the **secret** key — local only. |
| `recognition-proxy/` | Small Express server that calls FatSecret (OAuth 2.0 + IP allow-list). Off by default. |
| `../FinishedSketches/` | (Repo root, next to `App/`.) Validated React+Tailwind mockups per role, with its own README. **Reference only — never import or copy code from them.** `spiller-app-sketch.jsx` is the player design (dark theme is its default). `../Sketches/` holds older drafts. |

This folder is `App/` inside the team repo `Praksisplass-IK-Start` (GitHub: filipedv/Praksisplass-IK-Start). The repo root also has `docs/` (the project website/diary). Run commands from `App/` (or its subfolders).

How to run everything: see `README.md`.

## Tech decisions (already made — don't relitigate)

- **Supabase** (Postgres + Auth) in an **EU region**. Email/password login; no
  sign-up flow yet (accounts are made in the dashboard; public sign-up is off).
- **Nutrition source of truth = Matvaretabellen** (Mattilsynet), cached in the
  `foods` table (2,121 foods, updates yearly). Credit it in the app. **Never use
  a vision API's own nutrition numbers.**
- Keys: `sb_publishable_…` in the apps (public by design), `sb_secret_…` only in
  `scripts/seed-foods/.env`. All `.env` files are git-ignored; each part has a
  committed `.env.example`.

## Git workflow (team of three)

- **Never commit to `main`.** Work happens on a branch, one per task or
  person (e.g. `AdminPanelFilip`, `feature/sok-i-matvarer`, `fix/vann-maal`).
  Before starting, check the current branch (`git status -sb`). If it's
  `main`, stop and ask which branch to use.
- Start branches from an up-to-date `main`; keep them small and short-lived.
- Merge into `main` only through a **pull request**, reviewed by a teammate.
  `main` should be protected on GitHub (require a PR before merging).
- Commit only when asked. The students commit and push themselves, usually
  from GitHub Desktop.
- **The Supabase project is shared by every branch and every teammate.**
  Branches separate code, not the database. So:
  - Migrations (`npx supabase db push`) and Edge Function deploys hit everyone
    at once, whatever branch is checked out. Ask before running them.
  - Changes that only **add** things (new tables/columns/functions) may be
    pushed from a branch while testing. Changes that **alter or remove**
    existing things wait until the PR is merged into `main`.
  - Always add a **new** migration file; never edit one that has already been
    applied. Give it a timestamp later than every existing migration, on
    `main` and on open branches.
  - Before real players are onboarded: use a separate test database (a second
    Supabase project, or Supabase branching).

## Architecture

### Food recognition (swappable)
- The app only ever calls `recognizeFood(image)` from `player-app/src/recognition/index.ts`.
  `FoodGuess = { label, confidence: number | null, storableId }`.
  - `confidence` is nullable because FatSecret returns no score.
  - `storableId` = the value we're allowed to save. **FatSecret's terms only allow
    storing `food_id`**, so its guesses use `fatsecret:<id>`; FatSecret names may
    be shown on screen but never stored.
- Adapters: `mock` (default, canned English labels, ignores the photo — the UI
  shows a "Testmodus" banner), `fatsecret` (via `recognition-proxy`, never
  called from the phone), `vision` (empty slot for e.g. Claude vision — must go
  through a proxy and an EU region before real use).
- Selected by `EXPO_PUBLIC_RECOGNIZER`. Images are compressed (512 px JPEG)
  before sending. Show "Powered by fatsecret" wherever its results are used.
- The proxy requires a valid Supabase access token of an **active** user, logs
  counts only, and warns at startup if the current public IP isn't in
  `FATSECRET_ALLOWED_IPS`. It runs with `--dns-result-order=ipv4first` so it
  reaches FatSecret over IPv4 (the allow-list holds IPv4 addresses).
  For production: a small EU VPS or Fly.io with a static egress IP — Supabase
  Edge Functions have no fixed outgoing IP.

### Matching labels → foods
- `search_foods(search_text, max_results)` (SQL, pg_trgm `word_similarity`)
  matches against `name_nb`, `name_en` (seeded from the English API — recognizer
  labels are English) and `search_keywords`. Ranking tie-breakers follow
  Matvaretabellen's naming ("Apple, raw"): exact name > "label," > "label " >
  plural > generic ("raw"/"unspecified") > shorter name.
- **Matching order** (`matchGuesses` in `player-app/src/nutrition/foods-api.ts`):
  1. an admin's **link** in `food_aliases` for the guess's `storableId`, then
     its `label`
  2. the best `search_foods()` hit if `score >= 0.7` (`MATCH_THRESHOLD`)
  3. otherwise null, and the user picks the food
  If the link lookup fails, it silently falls back to step 2.
- Every recognition writes a `recognition_events` row (storable ids only), so
  coverage can be measured on the admin panel's **Gjenkjenning** page. A
  linked label counts as matched from then on; past events are not rewritten.
- **Fixing a bad or missing match = linking the label** to the right existing
  food. Use "Koble til matvare" on Gjenkjenning, or "Koble hit" in a food's
  panel on Matvarer. Don't copy foods for this: a copy duplicates the
  nutrition data and misses Matvaretabellen's yearly updates. Make a
  **custom** food only when the food really is missing from Matvaretabellen.
  Seeded rows are never edited (the seed would overwrite them).

### Privacy by design
- The meal photo is **never stored**: it's deleted from the phone right after
  recognition (`deleteLocalFile`), never uploaded to our DB.
- Store only the food-log entry. No analytics or trackers. No personal data in
  URLs or query strings (an ISO date like `?date=2026-10-14` in in-app routes is fine).

### Data model (`supabase/migrations/`)
- `profiles` — id = `auth.users.id`; `role` enum (player/coach/guardian/admin,
  default player); `is_active` (soft delete). `date_of_birth` and
  `numbers_visible` are **reserved, unused** (for the safeguarding session).
  Created automatically by a trigger on `auth.users`.
- `foods` — `source` ('matvaretabellen' | 'custom'), `source_id`, `name_nb`,
  `name_en`, `search_keywords`, `nutrition` (jsonb, **per 100 g**, fixed keys
  like `energy_kcal`, `protein_g`, … — missing key = no value, not 0),
  `portions` (jsonb `[{name, grams}]`, first = default amount).
- `meals` + `meal_items` — items store a **snapshot** (`food_name`, scaled
  `nutrition`) so later food edits never rewrite history. Saved only through
  the `log_meal()` RPC: one transaction, and **nutrition is computed in the
  database** from `foods` (the client sends only food ids + grams).
- `water_logs` — one row per tap (1–2000 ml).
- `club_settings` — single row, `id = 1` (int on purpose). The club's DEFAULT
  goals — **placeholders, not advice**.
- `player_goals` — optional per-player goals (admin-only write; player reads own).
  Every column nullable: NULL = follow the club default. `updated_by/at` are set
  by a trigger. `goals_for(user)` returns the effective goals (own value, else
  club default; a caller who can't see the row just gets the defaults). The
  player app's water goal comes from `goals_for()`.
- Summary functions (security invoker → RLS applies):
  `daily_summary(from, to, user?, tz='Europe/Oslo')` = totals per player per
  **Norwegian local day** (meals, kcal, macros, water);
  `last_activity()` = last meal/water timestamp per profile.
- `recognition_events` — labels / unmatched labels per photo.
- `food_aliases` — the link list: `label` (unique, lower-cased and trimmed by a
  trigger; a plain label or a storable id like `fatsecret:123`) → `food_id`
  (cascade on food delete). Any signed-in user may read (the app needs it);
  only active admins may write. `created_by` is set by the trigger.

### Security: admin access is enforced by RLS, never by the client
- **Both apps are untrusted** and use the public key. RLS is enabled on every table.
- `is_admin()` and `is_active_user()` are `security definer` SQL functions that
  answer only about the caller (`auth.uid()`). They exist because a policy on
  `profiles` that queries `profiles` would recurse infinitely.
- Pattern per table: "own rows" policy (`user_id = auth.uid() and is_active_user()`)
  OR "admin" policy (`is_admin()`). `foods` and `club_settings`: readable by
  signed-in users (foods also anon), writable by admins only — and admins may
  only write `source = 'custom'` foods.
- RLS can't restrict columns, so the trigger `protect_profile_privileged_columns`
  blocks non-admins from changing `role`, `is_active`, `date_of_birth`,
  `numbers_visible`. It lets the trusted `postgres` role through — that's how
  the first admin is made in the dashboard.
- Deactivated users (including admins) fail `is_active_user()` / `is_admin()`
  and lose all access.
- **Because admins can read everyone's rows, player-app queries always filter
  `.eq('user_id', myId)` explicitly** — RLS alone would show an admin everyone's meals.
- The admin panel's `isAdmin` only decides which screens to show. It also
  stops admins from changing their own role / deactivating themselves (UX
  guard against lockout — not a DB rule).
- **Account management (`admin-users` Edge Function).** Creating logins and
  changing email/password need the secret key, so the admin panel calls this
  function instead.
  - Three gates: the platform login check (`verify_jwt = true`),
    `withSupabase({ auth: 'user' })` from `@supabase/server`, and then
    `ctx.supabase.rpc('is_admin')` **as the caller**. It never trusts the client.
  - Only then does it use `ctx.supabaseAdmin`. Actions: `list` (emails + last
    login), `create` (confirmed account with an admin-chosen temporary password,
    no email sent), `update` (email/password).
  - Names, roles and active status are NOT changed there: the panel updates
    `profiles` directly under RLS.
  - Invoked with `region: eu-central-1` (GDPR; Stockholm isn't a function region).
    That makes supabase-js send an `x-region` header, which is NOT in the
    standard CORS allow-list. The function therefore adds it (`CORS` in
    `index.ts`); without it, browsers block every call with "Failed to send a
    request to the Edge Function". Node-based tests don't enforce CORS, so test
    the preflight with `curl -X OPTIONS … -H "Access-Control-Request-Headers: …,x-region"`.
  - Never log request bodies.
  - Hard-deleting accounts is deliberately not offered (soft delete via `is_active`).
- When changing SQL, test RLS before pushing. We've done this with PGlite
  (Postgres in WASM) plus a stubbed `auth` schema (`auth.users`,
  `auth.uid()` reading `request.jwt.claim.sub`), running queries under
  `set role authenticated`.

## Conventions

- **UI text in Norwegian (bokmål), code and comments in English.** Comment the
  *why*; match the existing comment density.
- **Player look = the sketch.** Colours/sizes live in `player-app/src/lib/theme.ts`,
  mapped from the sketch's Tailwind classes (dark, slate + indigo `#4F46E5`).
  Use the shared `Card`, `Pill`, `MenuRow`, `SectionTitle`, `ScreenHeader`
  components; don't hard-code colours in screens. Navigation stays camera-first
  with bottom tabs **Dagsoversikt / Kamera / Profil** (`(tabs)/index.tsx` is
  Kamera so it opens first; tab *order* is set in `(tabs)/_layout.tsx`).
- **Smoothness matters** (users noticed jank before):
  - the navigation theme is dark (no white flashes);
  - tabs cross-fade;
  - screens start from the in-memory cache (`src/lib/cache.ts`, cleared on sign-out) and refresh quietly;
  - the pull-to-refresh spinner appears only on an actual pull;
  - never blank a screen while loading;
  - guard against out-of-order responses.
- Dagsoversikt's selected day lives in the URL (`/today?date=YYYY-MM-DD`). Days
  are the phone's **local** day (`src/lib/dates.ts`, DST-safe).
- Pages fetch with a plain async function, and an effect applies the result
  (with a `cancelled` flag). Don't `setState` synchronously inside effects.
- Expo: add packages with `npx expo install`; only use modules that work in
  Expo Go (no custom native code) unless we decide to move to dev builds.

### Admin panel conventions
- **Look = the coach dashboard sketch** (dark slate + indigo). All colours are
  CSS variables in `admin-panel/src/index.css`; shared pieces in
  `src/components/ui.tsx` (PageHeader, StatTile, Meter, StatusLabel, Avatar, Segmented).
- **Feedback:** `useFeedback()` → `toast(text, tone, {long})` and
  `await confirm({...})`. Never use `window.alert/confirm`.
- **Goal status** (`src/lib/status.ts`) is the coach sketch's four states:
  Ikke logget / Langt fra målet / Nesten / Nådde målet, from kcal + water vs
  goal (score ≥ 0.85 green, ≥ 0.5 orange). Status colours are reserved and
  ALWAYS shown with icon + label. Today has no status until the day is over.
  The Oversikt status bar uses **yesterday** (the last full day).
- **Charts** are hand-built SVG (`ColumnChart`, `StatusStrip`), following the
  dataviz skill:
  - one series per chart, and never two y-axes
  - columns ≤ 24 px, 4 px rounded tops, 2 px gaps
  - the goal is a solid line with a direct label
  - hover and keyboard tooltips; dimmed (not blanked) while reloading
  - every chart has a table with the same numbers
  - series colours `--series-kcal` (orange) and `--series-water` (blue) were
    validated against the card surface with the skill's palette checker
- Read the clock once per page (`useState(() => new Date())`), never in render.
- Visual check: a temporary `@example.invalid` admin made with the secret key,
  Playwright (headless Chromium) screenshots of every page, account deleted after.

### Checks before calling something done
- Player app: `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor`. To be sure
  it bundles, run `npx expo export --platform ios --platform android` (with dummy
  env vars if needed).
- Admin panel: `npm run build` (includes `tsc`), `npm run lint`.
- Edge Functions: `npx deno check` (see above). After deploying, test the
  refusal paths (no token, player, deactivated admin) as well as the admin
  path. This was done with temporary `@example.invalid` accounts created with
  the secret key and deleted afterwards.
- After adding/renaming routes, typed routes in `player-app/.expo/types` are only
  regenerated while `npx expo start` runs — start it briefly before `tsc`.
- Known React Compiler lint quirk: compute initial state lazily
  (`useState(() => …)`); a non-lazy computed initial value can make it reject a
  `useCallback`'s dependencies.
- macOS has no `timeout` command.

## Roadmap (later sessions — not built yet)

1. **Before the FatSecret trial:** fix FatSecret's `image-recognition` scope,
   build the Claude-vision adapter for comparison, and a script that runs a
   fixed set of ~30–50 test meal photos through both. Then start the 14-day
   trial and decide on match rate, accuracy on Norwegian meals, and price.
2. **Søk i matvarer** page (portion/grams lookup outside the capture flow) — designed in the sketch.
3. Sketch screens not built yet: Profilinnstillinger (weight/height/age),
   Innstillinger (varsler, måleenhet), light mode + language toggle.
4. **Club-code signup + age-based safeguarding**: date of birth decides whether
   numbers are shown (with coach override) — plus the real GDPR work listed above.
5. **Coach dashboard** (desktop) and **coach mobile** — designed in the sketches
   (follow-up list, per-player tracking and goals, weight/height graphs,
   allergy/critical info, emergency contacts, private notes).
6. **Guardian role**: height registration, emergency-contact numbers (feeding the coach view).
7. Admin: editing other users' meals, audit logging (who changed what) if needed.
