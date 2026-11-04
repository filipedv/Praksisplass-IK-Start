-- =============================================================================
-- Fixtures (matches + trainings) and reminders to the players before/after
-- =============================================================================
--   1. reminder_templates  — the club's library of reminder texts + timing
--   2. fixtures            — a match or a training, for one or more teams
--   3. fixture_teams       — which teams a fixture is for
--   4. fixture_reminders   — the reminders chosen for ONE fixture (a copy of
--                            the template text, or a custom text), with the
--                            exact send time worked out by the database
--   5. save_fixture()      — saves a fixture, its teams and reminders in one go
--
-- HOW REMINDERS REACH THE PLAYER: the player app reads the upcoming fixtures
-- of the player's team and schedules them as LOCAL notifications on the
-- phone (works in Expo Go, no push tokens stored). A fixture added after the
-- player last opened the app is scheduled the next time they open it.
--
-- Only ADDS things (see the Git workflow in CLAUDE.md).
-- The template texts below are PLACEHOLDERS — nutrition advice to young
-- athletes should be checked by a qualified person before real use.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Helper: the caller's team (security definer, like is_admin()).
-- -----------------------------------------------------------------------------
create function public.my_team_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select team_id from public.profiles where id = auth.uid() and is_active;
$$;


-- -----------------------------------------------------------------------------
-- Timing of a reminder. Four kinds ("anchors"):
--   before_start  — offset_minutes before the start   (e.g. 180 = 3 h before)
--   after_end     — offset_minutes after the end      (e.g. 30)
--   day_before    — the day before, at at_time        (e.g. 19:00)
--   same_day      — the same day, at at_time          (e.g. 09:00)
-- Days are Norwegian local days (Europe/Oslo), also across DST changes.
-- -----------------------------------------------------------------------------
create function public.reminder_send_at(
  p_anchor text, p_offset int, p_at time, p_start timestamptz, p_end timestamptz
)
returns timestamptz
language sql stable set search_path = ''
as $$
  select case p_anchor
    when 'before_start' then p_start - make_interval(mins => p_offset)
    when 'after_end'    then p_end + make_interval(mins => p_offset)
    when 'day_before'   then (((p_start at time zone 'Europe/Oslo')::date - 1) + p_at) at time zone 'Europe/Oslo'
    when 'same_day'     then (((p_start at time zone 'Europe/Oslo')::date) + p_at) at time zone 'Europe/Oslo'
  end;
$$;


-- -----------------------------------------------------------------------------
-- 1. reminder_templates
-- -----------------------------------------------------------------------------
create table public.reminder_templates (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null check (kind in ('match', 'training')),
  name             text not null check (char_length(btrim(name)) between 1 and 60),  -- for staff, e.g. "Kvelden før"
  anchor           text not null,
  offset_minutes   int,
  at_time          time,
  body_nb          text not null check (char_length(btrim(body_nb)) between 1 and 300),
  body_en          text check (body_en is null or char_length(btrim(body_en)) between 1 and 300),
  default_selected boolean not null default true,  -- ticked automatically on a new fixture
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (
    (anchor in ('before_start', 'after_end') and offset_minutes between 0 and 2880 and at_time is null)
    or (anchor in ('day_before', 'same_day') and at_time is not null and offset_minutes is null)
  )
);

alter table public.reminder_templates enable row level security;

-- Staff (admins + coaches) manage the library. Players never need it: each
-- fixture keeps its own copy of the texts.
create policy "reminder_templates: staff"
  on public.reminder_templates for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Starting library. Placeholders: {lag} {motstander} {tid} {dag} {sted}
insert into public.reminder_templates (kind, name, anchor, offset_minutes, at_time, body_nb, body_en, default_selected, sort_order) values
  ('match', 'Kvelden før', 'day_before', null, '19:00',
   'Kamp i morgen kl. {tid} mot {motstander} ⚽ Fyll lagrene i kveld: en god porsjon pasta, ris eller poteter til middag.',
   'Match tomorrow at {tid} vs {motstander} ⚽ Fill up tonight: a good portion of pasta, rice or potatoes for dinner.',
   true, 10),
  ('match', 'Kampdag morgen', 'same_day', null, '09:00',
   'Kampdag! Spis en frokost du kjenner godt, og drikk jevnt gjennom dagen 💧',
   'Match day! Eat a breakfast you know well, and drink steadily through the day 💧',
   true, 20),
  ('match', '3 timer før', 'before_start', 180, null,
   '3 timer til avspark. Siste store måltid nå: mye karbohydrater, litt protein, lite fett og fiber.',
   '3 hours to kick-off. Last big meal now: plenty of carbs, some protein, little fat and fibre.',
   true, 30),
  ('match', '1 time før', 'before_start', 60, null,
   'En time igjen. Ta en banan eller en liten bolle og et glass vann – ikke noe nytt i dag.',
   'One hour to go. Have a banana or a small bun and a glass of water – nothing new today.',
   true, 40),
  ('match', 'Etter kampen', 'after_end', 30, null,
   'Godt jobbet! Spis noe med karbohydrater og protein innen en time – f.eks. sjokolademelk og en bolle – og drikk godt.',
   'Well played! Eat something with carbs and protein within an hour – e.g. chocolate milk and a bun – and drink plenty.',
   true, 50),
  ('training', '2 timer før', 'before_start', 120, null,
   'Trening kl. {tid}. Spis et måltid nå hvis det er lenge siden sist, og pakk vannflaska.',
   'Training at {tid}. Have a meal now if it''s been a while, and pack your water bottle.',
   true, 10),
  ('training', 'Hard økt: ekstra karbohydrater', 'same_day', null, '12:00',
   'Tøff økt i dag kl. {tid} 💪 Legg inn litt ekstra karbohydrater til lunsj – brød, ris eller pasta.',
   'Hard session today at {tid} 💪 Add some extra carbs at lunch – bread, rice or pasta.',
   false, 20),
  ('training', 'Rett etter', 'after_end', 0, null,
   'Bra økt! Husk mat og drikke innen en time.',
   'Good session! Remember food and drink within an hour.',
   true, 30);


-- -----------------------------------------------------------------------------
-- 2. fixtures + 3. fixture_teams
-- -----------------------------------------------------------------------------
create table public.fixtures (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('match', 'training')),
  title       text check (title is null or char_length(title) <= 80),   -- e.g. "Seriekamp", "Styrkeøkt"
  opponent    text check (opponent is null or char_length(opponent) <= 80),
  home_away   text check (home_away is null or home_away in ('home', 'away')),
  location    text check (location is null or char_length(location) <= 120),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index fixtures_starts_at on public.fixtures (starts_at);

create table public.fixture_teams (
  fixture_id uuid not null references public.fixtures (id) on delete cascade,
  team_id    uuid not null references public.teams (id) on delete cascade,
  primary key (fixture_id, team_id)
);

create index fixture_teams_team on public.fixture_teams (team_id);

alter table public.fixtures enable row level security;
alter table public.fixture_teams enable row level security;

-- Players see the fixtures of their own team; staff see all.
create policy "fixtures: own team or staff read"
  on public.fixtures for select to authenticated
  using (
    public.is_staff()
    or exists (select 1 from public.fixture_teams ft where ft.fixture_id = fixtures.id and ft.team_id = public.my_team_id())
  );

create policy "fixtures: staff write"
  on public.fixtures for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "fixture_teams: own team or staff read"
  on public.fixture_teams for select to authenticated
  using (public.is_staff() or team_id = public.my_team_id());

create policy "fixture_teams: staff write"
  on public.fixture_teams for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());


-- -----------------------------------------------------------------------------
-- 4. fixture_reminders
-- -----------------------------------------------------------------------------
create table public.fixture_reminders (
  id             uuid primary key default gen_random_uuid(),
  fixture_id     uuid not null references public.fixtures (id) on delete cascade,
  template_id    uuid references public.reminder_templates (id) on delete set null,  -- null = "Egendefinert"
  anchor         text not null,
  offset_minutes int,
  at_time        time,
  body_nb        text not null check (char_length(btrim(body_nb)) between 1 and 300),
  body_en        text check (body_en is null or char_length(btrim(body_en)) between 1 and 300),
  send_at        timestamptz not null,  -- worked out by the trigger below
  check (
    (anchor in ('before_start', 'after_end') and offset_minutes between 0 and 2880 and at_time is null)
    or (anchor in ('day_before', 'same_day') and at_time is not null and offset_minutes is null)
  )
);

create index fixture_reminders_fixture on public.fixture_reminders (fixture_id);

alter table public.fixture_reminders enable row level security;

create policy "fixture_reminders: own team or staff read"
  on public.fixture_reminders for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.fixture_teams ft
      where ft.fixture_id = fixture_reminders.fixture_id and ft.team_id = public.my_team_id()
    )
  );

create policy "fixture_reminders: staff write"
  on public.fixture_reminders for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- send_at follows the fixture's times automatically.
create function public.fixture_reminder_set_send_at()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end   timestamptz;
begin
  select starts_at, ends_at into v_start, v_end from public.fixtures where id = new.fixture_id;
  new.send_at := public.reminder_send_at(new.anchor, new.offset_minutes, new.at_time, v_start, v_end);
  return new;
end;
$$;

create trigger fixture_reminders_send_at
  before insert or update on public.fixture_reminders
  for each row execute function public.fixture_reminder_set_send_at();

-- Moving a fixture moves its reminders.
create function public.fixtures_after_time_change()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  update public.fixture_reminders set anchor = anchor where fixture_id = new.id;  -- re-runs the trigger above
  return null;
end;
$$;

create trigger fixtures_time_change
  after update of starts_at, ends_at on public.fixtures
  for each row execute function public.fixtures_after_time_change();

-- touch_updated_at() already exists (init migration).
create trigger fixtures_touch before update on public.fixtures
  for each row execute function public.touch_updated_at();
create trigger reminder_templates_touch before update on public.reminder_templates
  for each row execute function public.touch_updated_at();


-- -----------------------------------------------------------------------------
-- 5. save_fixture(): fixture + teams + reminders in ONE transaction
-- -----------------------------------------------------------------------------
-- p_fixture:   {kind, title, opponent, home_away, location, starts_at, ends_at}
-- p_reminders: [{template_id?, anchor, offset_minutes?, at_time?, body_nb, body_en?}]
-- The reminder list REPLACES the fixture's reminders. Security invoker:
-- RLS decides (staff only).
create function public.save_fixture(p_id uuid, p_fixture jsonb, p_team_ids uuid[], p_reminders jsonb)
returns uuid
language plpgsql security invoker set search_path = public
as $$
declare
  v_id uuid;
begin
  if coalesce(array_length(p_team_ids, 1), 0) = 0 then
    raise exception 'Choose at least one team';
  end if;

  if p_id is null then
    insert into fixtures (kind, title, opponent, home_away, location, starts_at, ends_at)
    values (
      p_fixture ->> 'kind', nullif(btrim(p_fixture ->> 'title'), ''), nullif(btrim(p_fixture ->> 'opponent'), ''),
      nullif(p_fixture ->> 'home_away', ''), nullif(btrim(p_fixture ->> 'location'), ''),
      (p_fixture ->> 'starts_at')::timestamptz, (p_fixture ->> 'ends_at')::timestamptz
    )
    returning id into v_id;
  else
    update fixtures set
      kind = p_fixture ->> 'kind',
      title = nullif(btrim(p_fixture ->> 'title'), ''),
      opponent = nullif(btrim(p_fixture ->> 'opponent'), ''),
      home_away = nullif(p_fixture ->> 'home_away', ''),
      location = nullif(btrim(p_fixture ->> 'location'), ''),
      starts_at = (p_fixture ->> 'starts_at')::timestamptz,
      ends_at = (p_fixture ->> 'ends_at')::timestamptz
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Fixture not found (or no access)';
    end if;
  end if;

  delete from fixture_teams where fixture_id = v_id;
  insert into fixture_teams (fixture_id, team_id) select v_id, unnest(p_team_ids);

  delete from fixture_reminders where fixture_id = v_id;
  insert into fixture_reminders (fixture_id, template_id, anchor, offset_minutes, at_time, body_nb, body_en)
  select v_id,
         nullif(r ->> 'template_id', '')::uuid,
         r ->> 'anchor',
         (r ->> 'offset_minutes')::int,
         (r ->> 'at_time')::time,
         btrim(r ->> 'body_nb'),
         nullif(btrim(r ->> 'body_en'), '')
  from jsonb_array_elements(coalesce(p_reminders, '[]'::jsonb)) r;

  return v_id;
end;
$$;
