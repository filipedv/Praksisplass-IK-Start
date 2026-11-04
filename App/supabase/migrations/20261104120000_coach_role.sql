-- =============================================================================
-- The coach role: coaches get their own dashboard for THEIR teams' players
--
--   1. coach_teams           — which teams each coach coaches (admins assign)
--   2. helper functions      — is_coach(), coaches_team(), can_manage_player()
--   3. what a coach may do   — for players on their teams: read meals, water,
--                              goals and status; correct meals; set goals;
--                              weigh-ins and notes; follow-up list. For their
--                              teams: the team goals and the fixtures.
--   4. tightening            — weigh-ins and notes were open to EVERY coach
--                              (is_staff()); now only to the player's coaches
--   5. fixtures              — a coach manages fixtures for their own teams
--
-- Admins keep everything (their policies are untouched). Everything else —
-- users, teams, coach assignments, foods, club settings, recognition, the
-- change log — stays admin-only.
--
-- A coach must have role 'coach', be active AND be assigned to the team. A
-- coach who is deactivated, or changed to another role, loses access at once
-- (the assignments are kept, so changing back restores it).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. coach_teams
-- -----------------------------------------------------------------------------
create table public.coach_teams (
  coach_id   uuid not null references public.profiles (id) on delete cascade,
  team_id    uuid not null references public.teams (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (coach_id, team_id)
);

create index coach_teams_team on public.coach_teams (team_id);

alter table public.coach_teams enable row level security;

create policy "coach_teams: admin all"
  on public.coach_teams for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- A coach may see their own assignments (the panel shows "your teams").
create policy "coach_teams: coach reads own"
  on public.coach_teams for select to authenticated
  using (coach_id = auth.uid() and public.is_active_user());

-- Only coaches can be assigned (catches a mix-up in the admin panel).
create function public.check_coach_team()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = new.coach_id and role = 'coach') then
    raise exception 'Only users with the coach role can be assigned to a team'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger coach_teams_check
  before insert or update on public.coach_teams
  for each row execute function public.check_coach_team();


-- -----------------------------------------------------------------------------
-- 2. Helper functions (security definer, like is_admin(): they read profiles
--    and coach_teams without RLS, and only ever answer about the CALLER)
-- -----------------------------------------------------------------------------

-- The caller is an ACTIVE coach.
create function public.is_coach()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'coach' and is_active
  );
$$;

-- The caller is an active coach assigned to this team.
create function public.coaches_team(p_team_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.coach_teams ct
    join public.profiles me on me.id = ct.coach_id
    where ct.coach_id = auth.uid() and ct.team_id = p_team_id
      and me.role = 'coach' and me.is_active
  );
$$;

-- The caller may see and help with this person: an active admin (anyone), or
-- an active coach of the team this ACTIVE PLAYER is on. (Not other coaches,
-- admins or guardians, and not deactivated players.)
create function public.can_manage_player(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.profiles pl
    join public.coach_teams ct on ct.team_id = pl.team_id
    join public.profiles me on me.id = ct.coach_id
    where pl.id = p_user_id and pl.role = 'player' and pl.is_active
      and ct.coach_id = auth.uid() and me.role = 'coach' and me.is_active
  );
$$;


-- -----------------------------------------------------------------------------
-- 3. What a coach may do with their players
-- -----------------------------------------------------------------------------

-- ---- profiles ----
create policy "profiles: coach reads own players"
  on public.profiles for select to authenticated
  using (public.can_manage_player(id));

-- Staff may see each other's profile row (names on notes and weigh-ins).
create policy "profiles: staff read staff"
  on public.profiles for select to authenticated
  using (public.is_staff() and role in ('admin', 'coach'));

-- ---- meals + items: read and correct ----
create policy "meals: coach own players"
  on public.meals for all to authenticated
  using (public.can_manage_player(user_id))
  with check (public.can_manage_player(user_id));

create policy "meal_items: coach own players"
  on public.meal_items for all to authenticated
  using (exists (select 1 from public.meals m where m.id = meal_id and public.can_manage_player(m.user_id)))
  with check (exists (select 1 from public.meals m where m.id = meal_id and public.can_manage_player(m.user_id)));

-- ---- water: read only ----
create policy "water_logs: coach reads own players"
  on public.water_logs for select to authenticated
  using (public.can_manage_player(user_id));

-- ---- individual goals ----
create policy "player_goals: coach own players"
  on public.player_goals for all to authenticated
  using (public.can_manage_player(user_id))
  with check (public.can_manage_player(user_id));

-- ---- team goals (not the name, order or anything else) ----
create policy "teams: coach updates own team"
  on public.teams for update to authenticated
  using (public.coaches_team(id))
  with check (public.coaches_team(id));

create function public.protect_team_columns()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and not public.is_admin()
     and (new.id, new.name, new.sort_order) is distinct from (old.id, old.name, old.sort_order) then
    raise exception 'Coaches can only change the team goals'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_team_columns
  before update on public.teams
  for each row execute function public.protect_team_columns();

-- ---- "Trenger oppfølging" ----
-- The list is shared by everyone who follows the player up: an admin's
-- "Fulgt opp" also hides the item for the player's coach, and the other way
-- round. subject_user_id = whose item it is (sent by the panel; existing rows
-- get it from the key, e.g. "logging:<user id>").
alter table public.followup_dismissals
  add column subject_user_id uuid references public.profiles (id) on delete cascade;

update public.followup_dismissals
set subject_user_id = split_part(item_key, ':', 2)::uuid
where split_part(item_key, ':', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (select 1 from public.profiles p where p.id::text = split_part(item_key, ':', 2));

create policy "followup_dismissals: coach own players"
  on public.followup_dismissals for all to authenticated
  using (subject_user_id is not null and public.can_manage_player(subject_user_id))
  with check (subject_user_id is not null and public.can_manage_player(subject_user_id));


-- -----------------------------------------------------------------------------
-- 4. Weigh-ins and notes: only the player's own coaches (not every coach)
-- -----------------------------------------------------------------------------
drop policy "body_measurements: read own or staff" on public.body_measurements;
drop policy "body_measurements: add own or staff" on public.body_measurements;
drop policy "body_measurements: change own entries or staff" on public.body_measurements;
drop policy "body_measurements: delete own entries or staff" on public.body_measurements;

create policy "body_measurements: read own or their staff"
  on public.body_measurements for select to authenticated
  using ((user_id = auth.uid() and public.is_active_user()) or public.can_manage_player(user_id));

create policy "body_measurements: add own or their staff"
  on public.body_measurements for insert to authenticated
  with check ((user_id = auth.uid() and public.is_active_user()) or public.can_manage_player(user_id));

create policy "body_measurements: change own entries or their staff"
  on public.body_measurements for update to authenticated
  using ((user_id = auth.uid() and entered_by = auth.uid() and public.is_active_user()) or public.can_manage_player(user_id))
  with check ((user_id = auth.uid() and public.is_active_user()) or public.can_manage_player(user_id));

create policy "body_measurements: delete own entries or their staff"
  on public.body_measurements for delete to authenticated
  using ((user_id = auth.uid() and entered_by = auth.uid() and public.is_active_user()) or public.can_manage_player(user_id));

drop policy "player_notes: staff read" on public.player_notes;
drop policy "player_notes: staff add" on public.player_notes;
drop policy "player_notes: author edits" on public.player_notes;
drop policy "player_notes: author or admin deletes" on public.player_notes;

create policy "player_notes: their staff read"
  on public.player_notes for select to authenticated
  using (public.can_manage_player(user_id));

create policy "player_notes: their staff add"
  on public.player_notes for insert to authenticated
  with check (public.can_manage_player(user_id));

-- Only the author edits their note; the author or an admin may delete it.
create policy "player_notes: author edits"
  on public.player_notes for update to authenticated
  using (author_id = auth.uid() and public.can_manage_player(user_id))
  with check (author_id = auth.uid() and public.can_manage_player(user_id));

create policy "player_notes: author or admin deletes"
  on public.player_notes for delete to authenticated
  using ((author_id = auth.uid() and public.can_manage_player(user_id)) or public.is_admin());


-- -----------------------------------------------------------------------------
-- 5. Fixtures: a coach sees and manages the fixtures of their own teams
-- -----------------------------------------------------------------------------
-- A fixture for several teams (say A-lag + G19) can only be changed by an
-- admin or a coach of ALL of them, so nobody changes another team's plans.

-- The caller is an active coach of at least one of the fixture's teams.
create function public.coach_sees_fixture(p_fixture_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.fixture_teams ft
    where ft.fixture_id = p_fixture_id and public.coaches_team(ft.team_id)
  );
$$;

-- The caller may change the fixture: an admin, or a coach of every team on
-- it. (A coach's brand-new fixture has no teams for a moment while
-- save_fixture() runs — then the one who created it may.)
create function public.can_edit_fixture(p_fixture_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or (
    public.is_coach()
    and case
      when exists (select 1 from public.fixture_teams ft where ft.fixture_id = p_fixture_id)
        then not exists (
          select 1 from public.fixture_teams ft
          where ft.fixture_id = p_fixture_id and not public.coaches_team(ft.team_id)
        )
      else exists (select 1 from public.fixtures f where f.id = p_fixture_id and f.created_by = auth.uid())
    end
  );
$$;

drop policy "fixtures: own team or staff read" on public.fixtures;
drop policy "fixtures: staff write" on public.fixtures;
drop policy "fixture_teams: own team or staff read" on public.fixture_teams;
drop policy "fixture_teams: staff write" on public.fixture_teams;
drop policy "fixture_reminders: own team or staff read" on public.fixture_reminders;
drop policy "fixture_reminders: staff write" on public.fixture_reminders;

-- ---- fixtures ----
-- `created_by = auth.uid()` is checked on the row itself (not in a function),
-- so a coach can read back the row they just inserted.
create policy "fixtures: read own team, coached teams or admin"
  on public.fixtures for select to authenticated
  using (
    public.is_admin()
    or (public.is_coach() and created_by = auth.uid())
    or public.coach_sees_fixture(id)
    or exists (select 1 from public.fixture_teams ft where ft.fixture_id = fixtures.id and ft.team_id = public.my_team_id())
  );

create policy "fixtures: staff add"
  on public.fixtures for insert to authenticated
  with check (public.is_admin() or (public.is_coach() and created_by = auth.uid()));

create policy "fixtures: change if allowed"
  on public.fixtures for update to authenticated
  using (public.can_edit_fixture(id))
  with check (public.can_edit_fixture(id));

create policy "fixtures: delete if allowed"
  on public.fixtures for delete to authenticated
  using (public.can_edit_fixture(id));

-- ---- fixture_teams ----
create policy "fixture_teams: read own team, coached fixtures or admin"
  on public.fixture_teams for select to authenticated
  using (public.is_admin() or public.coach_sees_fixture(fixture_id) or team_id = public.my_team_id());

create policy "fixture_teams: admin all"
  on public.fixture_teams for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "fixture_teams: coach adds own team"
  on public.fixture_teams for insert to authenticated
  with check (public.coaches_team(team_id) and public.can_edit_fixture(fixture_id));

create policy "fixture_teams: coach removes"
  on public.fixture_teams for delete to authenticated
  using (public.can_edit_fixture(fixture_id));

-- ---- fixture_reminders ----
create policy "fixture_reminders: read own team, coached fixtures or admin"
  on public.fixture_reminders for select to authenticated
  using (
    public.is_admin()
    or public.coach_sees_fixture(fixture_id)
    or exists (
      select 1 from public.fixture_teams ft
      where ft.fixture_id = fixture_reminders.fixture_id and ft.team_id = public.my_team_id()
    )
  );

create policy "fixture_reminders: write if allowed"
  on public.fixture_reminders for all to authenticated
  using (public.can_edit_fixture(fixture_id))
  with check (public.can_edit_fixture(fixture_id));

-- ---- save_fixture(): clear messages for coaches, and a safe order ----
-- Same as before, plus: a coach may only choose their own teams, and may
-- only change a fixture they're allowed to. New teams are added BEFORE the
-- old ones are removed, so the fixture never loses all its teams halfway
-- (which would lock a coach out of their own change).
create or replace function public.save_fixture(p_id uuid, p_fixture jsonb, p_team_ids uuid[], p_reminders jsonb)
returns uuid
language plpgsql security invoker set search_path = public
as $$
declare
  v_id uuid;
begin
  if coalesce(array_length(p_team_ids, 1), 0) = 0 then
    raise exception 'Choose at least one team';
  end if;

  if not is_admin() then
    if not is_coach() then
      raise exception 'Only admins and coaches can save fixtures' using errcode = '42501';
    end if;
    if exists (select 1 from unnest(p_team_ids) as team_id where not coaches_team(team_id)) then
      raise exception 'You can only choose your own teams' using errcode = '42501';
    end if;
    if p_id is not null and not can_edit_fixture(p_id) then
      raise exception 'This fixture is also for a team you don''t coach — ask an admin to change it' using errcode = '42501';
    end if;
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

  insert into fixture_teams (fixture_id, team_id)
  select v_id, team_id from unnest(p_team_ids) as team_id
  on conflict do nothing;
  delete from fixture_teams where fixture_id = v_id and team_id <> all (p_team_ids);

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


-- -----------------------------------------------------------------------------
-- 6. Change log: coach assignments are logged too
-- -----------------------------------------------------------------------------
-- Same function as before, plus coach_teams (whose data: the coach's).
create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor   uuid := auth.uid();
  v_old     jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end;
  v_new     jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  v_row     jsonb := case when tg_op = 'DELETE' then v_old else v_new end;
  v_subject uuid;
  v_changes jsonb := '{}'::jsonb;
  v_key     text;
begin
  -- Only changes made by a logged-in person are logged.
  if v_actor is null then
    return null;
  end if;

  -- Whose data is this?
  v_subject := case tg_table_name
    when 'profiles' then (v_row ->> 'id')::uuid
    when 'player_goals' then (v_row ->> 'user_id')::uuid
    when 'meals' then (v_row ->> 'user_id')::uuid
    when 'meal_items' then (select m.user_id from public.meals m where m.id = (v_row ->> 'meal_id')::uuid)
    when 'coach_teams' then (v_row ->> 'coach_id')::uuid
    else null
  end;

  -- Meals: only log someone ELSE editing a person's meals (an admin's or
  -- coach's correction) — never players logging their own food.
  if tg_table_name in ('meals', 'meal_items') and v_subject is not distinct from v_actor then
    return null;
  end if;

  -- Collect the fields that changed (or all fields on insert/delete).
  for v_key in select jsonb_object_keys(v_old || v_new) loop
    continue when v_key = any (tg_argv);
    -- On insert/delete, leave out empty fields (they'd only be noise).
    continue when tg_op <> 'UPDATE' and jsonb_typeof(v_row -> v_key) = 'null';
    if v_old -> v_key is distinct from v_new -> v_key then
      v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_array(v_old -> v_key, v_new -> v_key));
    end if;
  end loop;

  if tg_op = 'UPDATE' and v_changes = '{}'::jsonb then
    return null; -- nothing that matters changed
  end if;

  insert into public.audit_log (actor_id, actor_name, action, table_name, record_id, subject_user_id, changes)
  values (
    v_actor,
    (select p.display_name from public.profiles p where p.id = v_actor),
    lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'user_id', v_row ->> 'team_id'),
    v_subject,
    v_changes
  );
  return null; -- AFTER trigger: the return value is ignored
end;
$$;

create trigger audit_coach_teams after insert or delete on public.coach_teams
  for each row execute function public.audit_row_change('created_at');
