-- =============================================================================
-- IK Start ernæring — initial schema
--
-- Read this file top to bottom: tables first, then the helper functions,
-- then Row Level Security (RLS) policies, then triggers and RPC functions.
--
-- THE SECURITY MODEL IN ONE PARAGRAPH
-- Both apps talk to Postgres directly with the *publishable* (public) key, so
-- we must assume anyone can send any query. RLS is what stops them: every
-- table has RLS enabled, and a row is only visible/writable if a policy below
-- says so. "Admin" is NOT a flag the client sends — it is `profiles.role` in
-- the database, checked by the `is_admin()` function inside the policies.
-- =============================================================================

-- pg_trgm gives us fuzzy text matching ("banana" ≈ "Banana, raw").
-- Supabase convention is to install extensions in the `extensions` schema.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;


-- -----------------------------------------------------------------------------
-- 1. TABLES
-- -----------------------------------------------------------------------------

create type public.user_role as enum ('player', 'coach', 'guardian', 'admin');

-- One row per user. The id IS the auth user's id (Supabase Auth lives in the
-- separate `auth` schema, which we never modify directly).
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text not null default '',
  role            public.user_role not null default 'player',
  is_active       boolean not null default true,  -- soft delete: false = deactivated

  -- Reserved for the later safeguarding session. Nothing reads these yet.
  date_of_birth   date,
  numbers_visible boolean,  -- null = "follow the age rule" (rule not built yet)

  created_at      timestamptz not null default now()
);

-- Cached copy of Matvaretabellen + our own custom entries.
create table public.foods (
  id              uuid primary key default gen_random_uuid(),
  source          text not null check (source in ('matvaretabellen', 'custom')),
  source_id       text,            -- Matvaretabellen foodId, e.g. '06.525'. null for custom.
  name_nb         text not null,   -- shown in the UI
  name_en         text,            -- used to match English labels from recognizers
  search_keywords text[] not null default '{}',

  -- Nutrients per 100 g, with fixed keys (see scripts/seed-foods for mapping):
  -- { "energy_kcal": 88, "protein_g": 1.1, "fat_g": 0.2, "carbs_g": 19.7, ... }
  -- A key is missing when Matvaretabellen has no value for it.
  nutrition       jsonb not null,

  -- Household portions, e.g. [{ "name": "stk", "grams": 120 }]. First = preferred.
  portions        jsonb not null default '[]',

  created_at      timestamptz not null default now(),

  -- Lets the seed script "upsert": re-running it updates rows instead of duplicating.
  unique (source, source_id)
);

-- One row per logged meal. The food items live in meal_items (below).
create table public.meals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  eaten_at    timestamptz not null default now(),
  recognizer  text,  -- which recognizer suggested the items: 'mock', 'fatsecret', … or null
  created_at  timestamptz not null default now()
);

create index meals_user_eaten_idx on public.meals (user_id, eaten_at);

-- One row per food in a meal.
-- `food_name` and `nutrition` are a SNAPSHOT taken at save time, so editing or
-- deleting a food later never silently rewrites meals already logged.
create table public.meal_items (
  id             uuid primary key default gen_random_uuid(),
  meal_id        uuid not null references public.meals (id) on delete cascade,
  food_id        uuid references public.foods (id) on delete set null,
  food_name      text not null,
  amount_g       numeric(7, 1) not null check (amount_g > 0 and amount_g <= 5000),
  nutrition      jsonb not null,  -- same keys as foods.nutrition, but for amount_g (not per 100 g)
  detected_label text,            -- what the recognizer said; null if added by search
  created_at     timestamptz not null default now()
);

create index meal_items_meal_idx on public.meal_items (meal_id);

-- Club-wide settings. Exactly ONE row (id is always 1) — a common pattern for
-- "singleton" config tables. (Deliberately an int, not a uuid, so the app can
-- always fetch `id = 1`.)
create table public.club_settings (
  id                     int primary key default 1 check (id = 1),
  club_name              text not null default 'IK Start',
  -- Default daily goal template. PLACEHOLDER values — not nutrition advice.
  -- A qualified person should set real values from the admin panel.
  default_goal_kcal      int not null default 2800 check (default_goal_kcal > 0),
  default_goal_protein_g int not null default 130  check (default_goal_protein_g >= 0),
  default_goal_carbs_g   int not null default 380  check (default_goal_carbs_g >= 0),
  default_goal_fat_g     int not null default 90   check (default_goal_fat_g >= 0),
  updated_at             timestamptz not null default now()
);

insert into public.club_settings (id) values (1);

-- How well do recognizer labels match Matvaretabellen? One row per photo.
-- Only labels are stored — never the photo.
create table public.recognition_events (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  provider         text not null,
  labels           text[] not null,  -- everything the recognizer returned
  unmatched_labels text[] not null,  -- the subset we could NOT match to a food
  created_at       timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS USED BY THE POLICIES
-- -----------------------------------------------------------------------------
-- Why `security definer`? A policy on `profiles` that itself reads `profiles`
-- would trigger the same policy again → "infinite recursion" error. A security
-- definer function runs with its owner's rights, so it can read profiles
-- without re-entering RLS. It only ever answers about the CALLER (auth.uid()),
-- so it leaks nothing. `set search_path = ''` is a standard hardening step.

-- True if the person making this request is an ACTIVE admin.
create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

-- True if the person making this request has an active (not deactivated) account.
create function public.is_active_user()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active
  );
$$;


-- -----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
-- With RLS enabled and NO matching policy, access is denied. So each policy
-- below is an explicit "allow". Policies for the same action are OR-ed.
-- Note: deactivated users fail `is_active_user()` and therefore see nothing.

alter table public.profiles           enable row level security;
alter table public.foods              enable row level security;
alter table public.meals              enable row level security;
alter table public.meal_items         enable row level security;
alter table public.club_settings      enable row level security;
alter table public.recognition_events enable row level security;

-- ---- profiles ----
create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = auth.uid() and public.is_active_user());

create policy "profiles: admin reads all"
  on public.profiles for select to authenticated
  using (public.is_admin());

-- Users may update their own row (e.g. display_name). Changing role/is_active
-- is blocked separately by the trigger in section 4 — RLS works on whole rows,
-- not columns, so it can't express "you may edit this row but not that column".
create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_active_user())
  with check (id = auth.uid());

create policy "profiles: admin updates all"
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No insert policy: profiles are created by the trigger on auth.users (section 4).
-- No delete policy: we soft-delete with is_active = false.

-- ---- foods ----
create policy "foods: everyone reads"
  on public.foods for select to anon, authenticated
  using (true);

-- Admins may only create/edit/delete CUSTOM foods. Matvaretabellen rows are
-- owned by the seed script (which uses the secret key and bypasses RLS), so
-- an admin edit to one would be overwritten on the next seed anyway.
create policy "foods: admin inserts custom"
  on public.foods for insert to authenticated
  with check (public.is_admin() and source = 'custom');

create policy "foods: admin updates custom"
  on public.foods for update to authenticated
  using (public.is_admin() and source = 'custom')
  with check (public.is_admin() and source = 'custom');

create policy "foods: admin deletes custom"
  on public.foods for delete to authenticated
  using (public.is_admin() and source = 'custom');

-- ---- meals ----
-- `for all` = select, insert, update and delete.
create policy "meals: own rows"
  on public.meals for all to authenticated
  using (user_id = auth.uid() and public.is_active_user())
  with check (user_id = auth.uid() and public.is_active_user());

create policy "meals: admin all rows"
  on public.meals for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- meal_items ----
-- An item has no user_id of its own; access follows its parent meal.
create policy "meal_items: own meals"
  on public.meal_items for all to authenticated
  using (exists (
    select 1 from public.meals m
    where m.id = meal_id and m.user_id = auth.uid() and public.is_active_user()
  ))
  with check (exists (
    select 1 from public.meals m
    where m.id = meal_id and m.user_id = auth.uid() and public.is_active_user()
  ));

create policy "meal_items: admin all"
  on public.meal_items for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- club_settings ----
create policy "club_settings: signed-in users read"
  on public.club_settings for select to authenticated
  using (true);

create policy "club_settings: admin updates"
  on public.club_settings for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- recognition_events ----
create policy "recognition_events: insert own"
  on public.recognition_events for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user());

create policy "recognition_events: read own"
  on public.recognition_events for select to authenticated
  using (user_id = auth.uid() and public.is_active_user());

create policy "recognition_events: admin reads all"
  on public.recognition_events for select to authenticated
  using (public.is_admin());


-- -----------------------------------------------------------------------------
-- 4. TRIGGERS
-- -----------------------------------------------------------------------------

-- (a) Create a profile automatically whenever a user is created in Supabase
--     Auth (e.g. via Dashboard → Authentication → Add user).
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- Use a display_name from sign-up metadata if given, else the part of the
    -- email before the @.
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- (b) Stop non-admins from changing privileged columns on their own profile.
--     Without this, "profiles: update own" would let any player run
--     `update profiles set role = 'admin' where id = <me>`.
--
--     Requests from the apps run as the database role `authenticated` (or
--     `anon`). The Supabase dashboard / SQL editor runs as `postgres`, which is
--     trusted — that is how you make the very first admin by hand.
create function public.protect_profile_privileged_columns()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if new.role            is distinct from old.role
    or new.is_active       is distinct from old.is_active
    or new.date_of_birth   is distinct from old.date_of_birth
    or new.numbers_visible is distinct from old.numbers_visible
    or new.id              is distinct from old.id then
      raise exception 'Only an admin can change role, active status or safeguarding fields'
        using errcode = '42501';  -- 42501 = insufficient_privilege
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_profile_privileged_columns
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- (c) Keep club_settings.updated_at fresh.
create function public.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger club_settings_touch
  before update on public.club_settings
  for each row execute function public.touch_updated_at();


-- -----------------------------------------------------------------------------
-- 5. RPC FUNCTIONS (called from the apps with supabase.rpc('name', {...}))
-- -----------------------------------------------------------------------------
-- These are `security invoker` (the default), so RLS still applies to
-- everything they read and write — they are conveniences, not back doors.

-- Fuzzy search over foods, best match first. Used both for matching
-- recognizer labels (English) and for the manual search box (Norwegian).
-- `score` is between 0 and 1; the player app treats >= 0.7 as "matched".
create function public.search_foods(search_text text, max_results int default 20)
returns table (
  id uuid,
  source text,
  name_nb text,
  name_en text,
  nutrition jsonb,
  portions jsonb,
  score real
)
language sql stable set search_path = public, extensions
as $$
  with q as (select lower(trim(search_text)) as t),
  ranked as (
    select f.*,
      -- (1) Fuzzy similarity. word_similarity(a, b) = how well `a` matches
      --     some run of words inside `b`. Best of NO name, EN name, keywords.
      greatest(
        word_similarity(q.t, lower(f.name_nb)),
        word_similarity(q.t, lower(coalesce(f.name_en, ''))),
        word_similarity(q.t, lower(array_to_string(f.search_keywords, ' ')))
      ) as sim,
      -- (2) "Name shape". Matvaretabellen names look like
      --     "<base food>, <details>", e.g. "Apple, raw". So:
      --       3 = the name IS the query            ("Havregryn")
      --       2 = query, then a comma              ("Apple, raw" — not "Apple jam")
      --       1 = query, then a space              ("Rice flour")
      --       0 = anything else
      greatest(
        case when lower(f.name_nb) = q.t then 3
             when lower(f.name_nb) like q.t || ',%' then 2
             when lower(f.name_nb) like q.t || ' %' then 1 else 0 end,
        case when lower(f.name_en) = q.t then 3
             when lower(f.name_en) like q.t || ',%' then 2
             -- simple English plurals: "potato" → "Potatoes, raw"
             when lower(f.name_en) like q.t || 's,%' or lower(f.name_en) like q.t || 'es,%' then 2
             when lower(f.name_en) like q.t || ' %' then 1 else 0 end
      ) as tier
    from public.foods f, q
    where q.t <> ''
  )
  select r.id, r.source, r.name_nb, r.name_en, r.nutrition, r.portions,
         -- A base-name match (tier 2–3) is as good as a perfect fuzzy match.
         greatest(r.sim, case when r.tier >= 2 then 1 else 0 end)::real as score
  from ranked r
  order by
    score desc,
    r.tier desc,
    -- …then plain, generic versions ("raw", "unspecified") over prepared ones…
    (r.name_en ilike '%unspecified%' or r.name_en ilike '%, raw%') desc,
    -- …then shorter (more generic) names.
    length(r.name_nb) asc
  limit greatest(1, least(max_results, 50));
$$;

-- Save a meal and its items in ONE transaction (all or nothing).
-- The nutrition snapshot is computed HERE from the foods table — the client
-- only sends food ids and grams — so nutrition always comes from our cached
-- Matvaretabellen data, never from a recognizer or the client.
--
-- p_items: [{ "food_id": "<uuid>", "amount_g": 150, "detected_label": "banana" }, ...]
create function public.log_meal(
  p_items      jsonb,
  p_eaten_at   timestamptz default now(),
  p_recognizer text default null
)
returns uuid
language plpgsql set search_path = public
as $$
declare
  v_meal_id uuid;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A meal needs at least one item';
  end if;

  insert into public.meals (user_id, eaten_at, recognizer)
  values (auth.uid(), p_eaten_at, p_recognizer)
  returning id into v_meal_id;

  insert into public.meal_items (meal_id, food_id, food_name, amount_g, nutrition, detected_label)
  select
    v_meal_id,
    f.id,
    f.name_nb,
    (item ->> 'amount_g')::numeric,
    -- Scale every per-100 g value to the eaten amount:  value × grams / 100
    (select coalesce(jsonb_object_agg(n.key, round(n.value::numeric * (item ->> 'amount_g')::numeric / 100, 2)), '{}'::jsonb)
       from jsonb_each_text(f.nutrition) as n),
    item ->> 'detected_label'
  from jsonb_array_elements(p_items) as item
  join public.foods f on f.id = (item ->> 'food_id')::uuid;

  -- If any food_id didn't exist, the join dropped it: fail loudly instead.
  if (select count(*) from public.meal_items where meal_id = v_meal_id) <> jsonb_array_length(p_items) then
    raise exception 'One or more food ids were not found';
  end if;

  return v_meal_id;
end;
$$;
