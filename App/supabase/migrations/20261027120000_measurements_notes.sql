-- =============================================================================
-- Weight/height measurements and private staff notes (coach dashboard sketch)
-- =============================================================================
--   1. is_staff()            — admin OR coach (active)
--   2. body_measurements     — weigh-ins / height, by staff or by the player
--   3. player_notes          — notes about a player, visible to staff only
--
-- Only ADDS things (see the Git workflow in CLAUDE.md).
--
-- SAFEGUARDING: weight and height are health data. Fine for the adults in the
-- internal test; before youth players join, who may see/enter them must be
-- part of the age-based safeguarding work and the DPIA.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. is_staff(): the caller is an active admin or coach
-- -----------------------------------------------------------------------------
-- Security definer for the same reason as is_admin(): a policy that reads
-- profiles from inside a profiles policy would recurse.
create function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'coach') and is_active
  );
$$;


-- -----------------------------------------------------------------------------
-- 2. body_measurements
-- -----------------------------------------------------------------------------
-- One row per entry. Several on the same day are allowed (e.g. the player
-- types their weight and a coach weighs them at training) — nothing is
-- silently overwritten. Each row has weight, height, or both.
create table public.body_measurements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  measured_on date not null default (now() at time zone 'Europe/Oslo')::date,
  weight_kg   numeric(5, 1) check (weight_kg between 20 and 250),
  height_cm   numeric(5, 1) check (height_cm between 100 and 230),
  -- Who typed it in (the player or a staff member). Set by the trigger below,
  -- so nobody can pretend a self-reported value was a coach's weigh-in.
  entered_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (weight_kg is not null or height_cm is not null)
);

create index body_measurements_user_day on public.body_measurements (user_id, measured_on);

create function public.set_entered_by()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  -- Whoever saves the row is "entered by". (auth.uid() is null for the
  -- database owner, e.g. an import — then the given value is kept.)
  new.entered_by := coalesce(auth.uid(), new.entered_by);
  return new;
end;
$$;

create trigger body_measurements_entered_by
  before insert or update on public.body_measurements
  for each row execute function public.set_entered_by();

alter table public.body_measurements enable row level security;

-- Players see all their own measurements (also a coach's weigh-ins: it's
-- their data). Staff see everyone's.
create policy "body_measurements: read own or staff"
  on public.body_measurements for select to authenticated
  using ((user_id = auth.uid() and public.is_active_user()) or public.is_staff());

-- Players add their own; staff add for anyone.
create policy "body_measurements: add own or staff"
  on public.body_measurements for insert to authenticated
  with check ((user_id = auth.uid() and public.is_active_user()) or public.is_staff());

-- Players may change/delete only what THEY entered (not a coach's weigh-in).
create policy "body_measurements: change own entries or staff"
  on public.body_measurements for update to authenticated
  using ((user_id = auth.uid() and entered_by = auth.uid() and public.is_active_user()) or public.is_staff())
  with check ((user_id = auth.uid() and public.is_active_user()) or public.is_staff());

create policy "body_measurements: delete own entries or staff"
  on public.body_measurements for delete to authenticated
  using ((user_id = auth.uid() and entered_by = auth.uid() and public.is_active_user()) or public.is_staff());


-- -----------------------------------------------------------------------------
-- 3. player_notes — staff only, never visible to the player in the app
-- -----------------------------------------------------------------------------
-- GDPR: the player still has a right of access to notes about them, so they
-- are included in the admin panel's "Last ned alle data" export, and deleted
-- with the account (cascade). Write them as if the player might read them.
create table public.player_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  author_id  uuid default auth.uid() references public.profiles (id) on delete set null,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index player_notes_user on public.player_notes (user_id, created_at desc);

create function public.player_notes_before_write()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.author_id := coalesce(auth.uid(), new.author_id); -- can't sign as someone else
  else
    new.author_id := old.author_id;                       -- authorship never changes
    new.user_id := old.user_id;                           -- nor who the note is about
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger player_notes_before_write
  before insert or update on public.player_notes
  for each row execute function public.player_notes_before_write();

alter table public.player_notes enable row level security;

create policy "player_notes: staff read"
  on public.player_notes for select to authenticated
  using (public.is_staff());

create policy "player_notes: staff add"
  on public.player_notes for insert to authenticated
  with check (public.is_staff());

-- Only the author edits their note; the author or an admin may delete it.
create policy "player_notes: author edits"
  on public.player_notes for update to authenticated
  using (public.is_staff() and author_id = auth.uid())
  with check (public.is_staff() and author_id = auth.uid());

create policy "player_notes: author or admin deletes"
  on public.player_notes for delete to authenticated
  using ((public.is_staff() and author_id = auth.uid()) or public.is_admin());
