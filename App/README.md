# IK Start Ernæring

Nutrition-tracking app for IK Start academy and A-team players. Internship
project. **Internal test only** — no real players or guardians until the GDPR
work (guardian consent, DPIA) is done.

| Folder | What it is |
| --- | --- |
| `player-app/` | Player app — React Native + Expo + TypeScript (iOS & Android) |
| `admin-panel/` | Admin web app — React + Vite + TypeScript |
| `supabase/migrations/` | Database schema, Row Level Security policies, functions |
| `scripts/seed-foods/` | Loads Matvaretabellen into the `foods` table |
| `recognition-proxy/` | Small server that calls FatSecret (off by default) |
| `../FinishedSketches/` | Design mockups (repo root) — reference only, never import |

Nutrition data: [Matvaretabellen](https://www.matvaretabellen.no) (Mattilsynet).

---

## One-time setup

### 1. Tools on your Mac

- **Node.js** — v24 LTS recommended (`brew install node@24`). v26 works too.
- **Expo Go** on your phone (App Store / Google Play).
- Supabase CLI runs via `npx supabase` — nothing to install.

### 2. Create the Supabase project (one person does this, then invites the others)

1. Go to <https://supabase.com/dashboard> → **New project**.
2. **Region: `Europe (Stockholm) eu-north-1`** (or Frankfurt `eu-central-1`). Must be in the EU.
3. Save the database password somewhere safe (password manager).
4. **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up"
   (accounts are created by hand for now) and turn **off** "Confirm email".
5. **Project Settings → API Keys**: you'll need the **Project URL**, the
   **publishable key** (`sb_publishable_…`) and the **secret key** (`sb_secret_…`).

### 3. Create the database tables

From the repo root:

```bash
npx supabase login                            # opens the browser once
npx supabase link --project-ref <your-ref>    # the ref is in the project URL
npx supabase db push                          # runs any new supabase/migrations/*.sql
```

(Alternative: paste the migration file into **SQL Editor** in the dashboard and run it.)

### 4. Load Matvaretabellen into `foods`

```bash
cd scripts/seed-foods
cp .env.example .env       # fill in SUPABASE_URL and SUPABASE_SECRET_KEY
npm install
npm run seed               # ~2 100 foods, takes a few seconds
```

Re-run any time (e.g. after Matvaretabellen's yearly update) — it updates in place.

### 5. Deploy the admin-users function

The admin panel creates accounts and changes emails/passwords through a small
Supabase Edge Function (it needs the secret key, which must never be in the web page):

```bash
npx supabase functions deploy admin-users --use-api
```

Re-run after changing `supabase/functions/admin-users/`.

### 6. Create user accounts

Once you are an admin (next step): **admin panel → Brukere → + Ny bruker**.
The very first account has to be made in the dashboard:
**Authentication → Users → Add user → Create new user** — email + password, tick
"Auto Confirm User". A `profiles` row (role `player`) is created automatically.

### 7. Make yourself admin (needed for the admin panel)

**Table Editor → `profiles`** → find your row → set `role` to `admin` → Save.
Or in **SQL Editor**:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

This only works from the dashboard (trusted `postgres` role). From the apps, a
database trigger blocks anyone but an admin from changing roles.

---

## Run the player app on your iPhone (Expo Go)

```bash
cd player-app
cp .env.example .env     # fill in EXPO_PUBLIC_SUPABASE_URL and ..._PUBLISHABLE_KEY
npm install
npx expo start
```

Scan the QR code with the iPhone **Camera** app → opens in Expo Go. Phone and
Mac must be on the same Wi-Fi. If they can't see each other (e.g. university
Wi-Fi), use `npx expo start --tunnel`.

After changing `.env`, restart with `npx expo start --clear`.

Checks before committing: `npx tsc --noEmit` and `npx expo lint`.

## Run the admin panel (on your Mac)

```bash
cd admin-panel
cp .env.example .env     # same URL + publishable key as the player app
npm install
npm run dev              # → http://localhost:5173
```

Log in with an account whose profile has `role = admin` (see step 7 above).
Pages: **Brukere** (create accounts, edit name/email/password, roles,
deactivate/reactivate, view a player's meals and water),
**Matvarer** (search; add/edit custom foods), **Klubbinnstillinger** (club name,
default goals incl. water) and **Gjenkjenning** (how often recognizer labels fail
to match Matvaretabellen).

Checks before committing: `npm run build` (includes the TypeScript check) and `npm run lint`.

The admin panel is not trusted: it uses the same public key as the player app,
and what an admin can see or change is enforced by RLS in the database.

## Using FatSecret instead of the mock recognizer

1. FatSecret dashboard → add your network's **public** IP to the allow-list
   Use the **IPv4** address: `curl -4 ifconfig.me`. It changes if you change network.
   (The proxy is started with `--dns-result-order=ipv4first` so it calls FatSecret
   over IPv4 and matches that entry, even on networks that also have IPv6.)
2. `cd recognition-proxy && cp .env.example .env` → fill in, `npm install`, `npm start`.
3. In `player-app/.env`: `EXPO_PUBLIC_RECOGNIZER=fatsecret` and
   `EXPO_PUBLIC_RECOGNITION_PROXY_URL=http://<your Mac's LAN IP>:8787`
   (System Settings → Wi-Fi → Details → IP address). Restart Expo with `--clear`.

How many FatSecret labels fail to match Matvaretabellen is recorded in the
`recognition_events` table (also printed in the Metro terminal).
