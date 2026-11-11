# IK Start Ernæring — handover

Nutrition and recovery tracking for **IK Start** (Eliteserien, Kristiansand).
Players log meals by photo and track water; coaches and admins follow up from a
web dashboard. Built as an internship project (*praksisprosjekt*), autumn 2026,
by **Øyvind Birkeland, Sivert Dørum and Filip Edvardsen**.

This file is the starting point for whoever takes over. Read it top to bottom
once; it points to the more detailed documents.

> **Status: internal test only.** The app has only been used by the three of
> us. **No real academy player or guardian may be onboarded** until the GDPR
> work is done (see [Before real players](#before-real-players-hard-requirements)).

---

## 1. What exists today

| Part | Folder | Stack | Who uses it |
| --- | --- | --- | --- |
| Player app | `App/player-app/` | React Native, Expo SDK 58, TypeScript, Expo Router | Players (iOS/Android, tested in Expo Go) |
| Admin panel / coach dashboard | `App/admin-panel/` | React, Vite, TypeScript, React Router | Admins and coaches (desktop browser) |
| Database + auth | `App/supabase/` | Supabase (Postgres, Auth, Row Level Security), EU region | Both apps |
| Account management | `App/supabase/functions/admin-users/` | Supabase Edge Function (Deno) | Admin panel |
| Food data import | `App/scripts/seed-foods/` | Node script | Run by a developer, about once a year |
| Food recognition proxy | `App/recognition-proxy/` | Node/Express → FatSecret | **Off by default** |
| Design sketches | `FinishedSketches/`, `Sketches/` | React + Tailwind mockups | Reference only, never import |
| Project website | `docs/` | Static HTML (GitHub Pages) | Project diary, status reports, reflection |

**Player app:** camera → food recognition → confirm/edit amounts → save (also
afterwards, with a chosen time); "Nylig brukt" and "Logg igjen"; Dagsoversikt
with calendar, goals and water; meal editing; food search; meal reminders;
"Neste kamp" card with food tips before/after matches and training;
weight/height; privacy notes; Norwegian/English.

**Admin panel:** Oversikt (follow-up list, goal status, weekly trend), users,
roles and teams, the player page (charts, meal corrections, goals,
weight/height, private notes, CSV/JSON export, GDPR erasure), matches and
training with reminders, foods and recognition links, change log, club
settings.

**Coach dashboard:** the same web app with a smaller menu (role `coach`). A
coach sees only the players on the teams an admin has assigned them.

**Nutrition data** comes from [Matvaretabellen](https://www.matvaretabellen.no)
(Mattilsynet), cached in the `foods` table. It must be credited in the app.

## 2. Where to read more

| Document | Read it for |
| --- | --- |
| [`App/README.md`](App/README.md) | **Setup**: Supabase project, migrations, seeding foods, running both apps, FatSecret |
| [`App/CLAUDE.md`](App/CLAUDE.md) | **Architecture and rules**: data model, security model, conventions, decisions already made, roadmap. Written for Claude Code, but it is the most complete technical description and is worth reading as a person too |
| [`App/player-app/AGENTS.md`](App/player-app/AGENTS.md) | Expo-specific rules (use `npx expo install`, versioned docs) |
| [`FinishedSketches/README.md`](FinishedSketches/README.md) | The validated designs per role, including features not built yet |
| [`docs/`](docs/) | Project diary and status reports: the *why* behind many decisions |

## 3. Handover checklist

These are the things that are tied to us personally and must be moved before
we leave. **Tick them off together with the new owner.**

- [ ] **GitHub repository**: currently `filipedv/Praksisplass-IK-Start` (a personal
      account). Transfer it to the club's organisation, or add the new owner as
      admin. *TODO: decide where it goes.*
- [ ] **Branch protection on `main`**: require a pull request and passing CI
      (check after the transfer; settings don't always follow).
- [ ] **Supabase project** (EU region): invite the new owner as *Owner* in the
      organisation, then remove our accounts. *TODO: project name/ref and
      current owner.*
- [ ] **Supabase admin accounts in the app**: create an admin account for the
      new owner, then **deactivate** ours under Brukere (deactivate, don't delete,
      so the change log keeps its history).
- [ ] **Secrets**: hand over the database password and the `sb_secret_…` key in
      a password manager, never by chat or email. Afterwards, **rotate the secret
      key** in Supabase (Project Settings → API Keys) so ours stop working.
- [ ] **FatSecret account** (Platform API): transfer or recreate it under the
      club. The 14-day image-recognition trial has **not** been started. *TODO:
      who owns the account.*
- [ ] **Expo account** (only needed once you move from Expo Go to real builds
      with EAS). *TODO: none created yet / owner.*
- [ ] **GitHub Pages** (`docs/`): decide whether the project website stays up.
- [ ] Walk through this README and `App/README.md` with the new owner on their
      own machine, from a clean clone, until both apps run.

## 4. Getting it running (short version)

Full steps are in [`App/README.md`](App/README.md). In short:

```bash
# Node 24 LTS, and Expo Go on your phone
cd App/player-app   && cp .env.example .env && npm install && npx expo start
cd App/admin-panel  && cp .env.example .env && npm install && npm run dev
```

Both `.env` files need the Supabase **URL** and **publishable key** (public by
design). The **secret key** is used *only* in `App/scripts/seed-foods/.env`, on
your own machine. All `.env` files are git-ignored; each part has a committed
`.env.example`.

Recognition uses a **mock** by default (`EXPO_PUBLIC_RECOGNIZER=mock`): it
ignores the photo and returns example foods, and the app shows a "Testmodus"
banner. This is expected, not a bug.

## 5. How we work (please keep it)

- **Never commit to `main`.** One branch per task, merged by pull request,
  reviewed by someone else.
- **CI** (`.github/workflows/ci.yml`) runs on every PR: database tests, admin
  build + lint, player typecheck + lint, proxy/seed typecheck, Edge Function
  check. It needs no secrets and never touches the real database.
- **The Supabase project is shared by every branch.** A migration or function
  deploy affects everyone immediately. Always add a **new** migration file
  (later timestamp); never edit one that has been applied.
- After every migration, regenerate the types in **both** apps:
  `npm run gen:types` in `App/player-app/` and `App/admin-panel/`.
- When you change SQL, add a test in `App/supabase/tests/` (PGlite, runs
  in CI). `npm install && npm test` there.
- **Security lives in the database (RLS), not in the apps.** Both apps are
  untrusted and use the public key. Hiding a button is a UI choice; the RLS
  policy is the real rule.
- All visible text is bilingual, Norwegian first: `t('Lagre', 'Save')`.
- Before calling something done: see "Checks before calling something done"
  in `App/CLAUDE.md`.

## 6. Decisions already made (and why)

- **Supabase in an EU region**: GDPR; managed auth + Postgres + RLS.
- **Matvaretabellen is the only source of nutrition numbers.** A recognizer
  (FatSecret, a vision model) only *suggests a food name*; we never store or use
  its nutrition numbers. FatSecret's terms also only allow storing its `food_id`.
- **The meal photo is never stored**: deleted from the phone right after
  recognition, never uploaded.
- **Nutrition is computed in the database** (`log_meal()`), from food ids and
  grams. Saved meals keep a snapshot, so later food edits don't rewrite history.
- **Reminders are local notifications**, scheduled on the phone (work in Expo
  Go, no push server). Limitation: a fixture added after a player last opened
  the app isn't scheduled until they open it again.
- **Goals are placeholders, not advice.** Club defaults, team goals and
  per-player goals (own → team → club) exist, but the numbers must be set by
  qualified staff.
- **Matching recognizer labels to foods:** fix a bad match by *linking* the
  label to an existing food (admin → Gjenkjenning / Matvarer), not by copying
  foods. Details in `App/CLAUDE.md`.

## Before real players (hard requirements)

Do **not** onboard real academy players or guardians before all of these are done:

1. **Guardian consent flow** for players under 18.
2. **DPIA** (data protection impact assessment). The app processes health
   data (food intake, weight, height) about minors.
3. **EU-region processing for the recognition call** (FatSecret is US-based;
   a vision model must also go through an EU route and a proxy).
4. **Age-based safeguarding**: date of birth decides whether numbers (kcal,
   weight) are shown to youth players, with a coach override. The columns
   `profiles.date_of_birth` and `numbers_visible` are reserved for this but unused.
5. A **separate test database** (second Supabase project or Supabase
   branching), so development never touches real players' data.
6. A **retention policy** for the change log and meal data.

## 7. Known issues

Found in a review at handover and **not fixed yet**. Each one is small.

| Where | Issue |
| --- | --- |
| `player-app/src/fixtures/fixtures.ts` (`syncNow`) | Opening the app **offline deletes all match/training reminders**: it cancels them before fetching, and the fetch fails. Fix: fetch first, then cancel and reschedule. |
| `player-app/src/app/meal/[id].tsx` (`handleAdd`) | In edit mode, "Legg til matvare" is saved immediately, so "Avbryt" doesn't undo it. "Lagre endringer" runs several calls in a row, so a failure halfway leaves the meal partly changed. |
| Accounts | The admin sets a temporary password and the player is **never asked to change it**. There is also no "forgot password" flow. |
| `player-app/src/app/water.tsx` | Water can only be logged for today, though meals can be added to earlier days. (The limit is only in the UI.) |
| `player-app/src/app/search.tsx` | "Legg til" from search logs the food as eaten now, even when you came from an earlier day; a failed search isn't caught. |
| `admin-panel/src/pages/OverviewPage.tsx` (trend) | "Logging per uke" counts weeks before a player's account existed as missed days, so the trend dips when new players are added. |
| `App/README.md` | The admin panel section lists only the early pages (no coach role, fixtures, change log). `App/CLAUDE.md` is up to date. |

## 8. Suggested next steps

In rough order of value. The longer list is under "Roadmap" in `App/CLAUDE.md`.

1. **Fix the known issues above.**
2. **Real food recognition.** This is the app's core promise and has only run
   on the mock. Fix FatSecret's `image-recognition` OAuth scope (the key
   currently has `basic premier barcode`), build the Claude-vision adapter,
   and run the same 30–50 Norwegian meal photos through both. *Then* start the
   14-day FatSecret trial and decide on match rate, accuracy and price.
3. **Smarter meal reminders** that skip a meal already logged. This is possible
   without a server: schedule one-off reminders for the next 7 days and cancel
   today's when the meal is saved. iOS allows 64 scheduled notifications in
   total, so lower the fixture cap (`MAX_SCHEDULED`) to make room.
4. **Coaches:** repeating trainings ("every Tuesday until …"), and showing
   match/training days on the player charts, so food around matches can be
   followed up.
5. **Players:** quick "+1 glass" on Dagsoversikt, saved favourite meals,
   meal names linked to training ("Før trening" / "Etter kamp"), a short
   message from the coach back to the player.
6. **Coach mobile layout**, guardian role and emergency contacts (designs
   exist in `FinishedSketches/`).
7. The GDPR work in [Before real players](#before-real-players-hard-requirements),
   and a move from Expo Go to real builds (EAS), before any real launch.

## 9. Contact

*TODO: whether and how the new owner can reach us after the internship, and
the contact person at IK Start.*

| Name | Main areas | Contact |
| --- | --- | --- |
| Øyvind Birkeland | *TODO* | *TODO* |
| Sivert Dørum | *TODO* | *TODO* |
| Filip Edvardsen | *TODO* | *TODO* |
