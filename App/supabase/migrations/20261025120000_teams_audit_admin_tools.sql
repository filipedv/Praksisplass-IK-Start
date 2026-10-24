-- =============================================================================
-- Admin tools: teams, team goals, change log, meal corrections, system status
--
-- Everything here only ADDS things (new tables, columns, functions and
-- triggers), so it is safe to apply from a branch (see Git workflow in
-- CLAUDE.md). Existing functions are left untouched; where behaviour changes
-- (goals now have a team layer) we add a NEW function, effective_goals().
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. TEAMS (A-lag, G19, G17 …) with optional team goals
-- -----------------------------------------------------------------------------
-- Goal columns are nullable: NULL = "use the club default". So the order a
-- player's goal is decided in is:  own goal → team goal → club default.

create table public.teams (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique check (length(trim(name)) > 0),
  sort_order     int not null default 0,
  goal_kcal      int check (goal_kcal > 0),
  goal_protein_g int check (goal_protein_g >= 0),
  goal_carbs_g   int check (goal_carbs_g >= 0),
  goal_fat_g     int check (goal_fat_g >= 0),
  goal_water_ml  int check (goal_water_ml > 0),
  created_at     timestamptz not null default now()
);

alter table public.teams enable row level security;

-- Team names aren't personal data; every signed-in user may read them
-- (the player app needs the team's goals for the effective goal).
create policy "teams: signed-in users read"
  on public.teams for select to authenticated
  using (true);

create policy "teams: admin writes"
  on public.teams for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Which team a person belongs to (NULL = no team).
alter table public.profiles
  add column team_id uuid references public.teams (id) on delete set null;

-- Players may edit their own profile row (display_name), but must not move
-- themselves to another team. A NEW trigger (the existing
-- protect_profile_privileged_columns trigger is left as it is).
create function public.protect_profile_team()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and not public.is_admin()
     and new.team_id is distinct from old.team_id then
    raise exception 'Only an admin can change which team a user is on'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_profile_team
  before update on public.profiles
  for each row execute function public.protect_profile_team();


-- -----------------------------------------------------------------------------
-- 2. EFFECTIVE GOALS: own → team → club
-- -----------------------------------------------------------------------------
-- Replaces goals_for() for new code (goals_for() is kept so the app on `main`
-- keeps working until this branch is merged). RLS still applies: a caller
-- who may not see a player's profile/goals just gets the club defaults.

create function public.effective_goals(p_user_id uuid default auth.uid())
returns table (
  goal_kcal      int,
  goal_protein_g int,
  goal_carbs_g   int,
  goal_fat_g     int,
  goal_water_ml  int
)
language sql stable set search_path = public
as $$
  select
    coalesce(g.goal_kcal,      t.goal_kcal,      c.default_goal_kcal),
    coalesce(g.goal_protein_g, t.goal_protein_g, c.default_goal_protein_g),
    coalesce(g.goal_carbs_g,   t.goal_carbs_g,   c.default_goal_carbs_g),
    coalesce(g.goal_fat_g,     t.goal_fat_g,     c.default_goal_fat_g),
    coalesce(g.goal_water_ml,  t.goal_water_ml,  c.default_goal_water_ml)
  from public.club_settings c
  left join public.profiles p on p.id = p_user_id
  left join public.teams t on t.id = p.team_id
  left join public.player_goals g on g.user_id = p_user_id
  where c.id = 1;
$$;


-- -----------------------------------------------------------------------------
-- 3. CHANGE LOG ("who changed what")
-- -----------------------------------------------------------------------------
-- Filled ONLY by the database (triggers below, and the admin-users Edge
-- Function for login accounts) — there is no insert policy, so nobody can
-- write or fake entries from an app. Only admins can read it.
--
-- What is logged: changes made by a logged-in user (auth.uid() not null) to
-- profiles, player goals, teams, links, foods and club settings — and an
-- ADMIN's edits of someone else's meals. Players logging their own meals are
-- NOT logged (noise, and privacy). Changes from the Supabase dashboard or the
-- seed script (no logged-in user) are not logged.

create table public.audit_log (
  id              bigint generated always as identity primary key,
  at              timestamptz not null default now(),
  actor_id        uuid,  -- who did it (no FK: the log outlives deleted users)
  actor_name      text,  -- their display name at the time
  action          text not null check (action in ('insert', 'update', 'delete')),
  table_name      text not null,
  record_id       text,
  subject_user_id uuid,  -- whose data it is (for "changes about this player")
  changes         jsonb not null default '{}'  -- { field: [old, new] }
);

create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_subject_idx on public.audit_log (subject_user_id, at desc);

alter table public.audit_log enable row level security;

create policy "audit_log: admin reads"
  on public.audit_log for select to authenticated
  using (public.is_admin());

-- One generic trigger function for every audited table.
-- TG_ARGV = column names to leave out of the diff (e.g. timestamps).
create function public.audit_row_change()
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
    else null
  end;

  -- Meals: only log someone ELSE editing a person's meals (an admin
  -- correction) — never players logging their own food.
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
    coalesce(v_row ->> 'id', v_row ->> 'user_id'),
    v_subject,
    v_changes
  );
  return null; -- AFTER trigger: the return value is ignored
end;
$$;

create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change('created_at');
create trigger audit_player_goals after insert or update or delete on public.player_goals
  for each row execute function public.audit_row_change('updated_at', 'updated_by');
create trigger audit_teams after insert or update or delete on public.teams
  for each row execute function public.audit_row_change('created_at');
create trigger audit_food_aliases after insert or update or delete on public.food_aliases
  for each row execute function public.audit_row_change('created_at', 'created_by');
create trigger audit_foods after insert or update or delete on public.foods
  for each row execute function public.audit_row_change('created_at');
create trigger audit_club_settings after update on public.club_settings
  for each row execute function public.audit_row_change('updated_at');
create trigger audit_meals after update or delete on public.meals
  for each row execute function public.audit_row_change('created_at');
create trigger audit_meal_items after update or delete on public.meal_items
  for each row execute function public.audit_row_change('created_at');


-- -----------------------------------------------------------------------------
-- 4. CORRECTING A LOGGED MEAL ITEM
-- -----------------------------------------------------------------------------
-- security invoker: RLS decides who may do this (a player their own items,
-- an admin anyone's). Changes by an admin to someone else's meal are logged
-- by the audit triggers above.

-- Change the grams of one item. The saved nutrition snapshot is scaled by the
-- same factor, so it stays consistent with the amount (e.g. 1500 g → 150 g
-- divides every value by 10). We never re-read the food: the snapshot is what
-- was eaten, even if the food has been edited since.
create function public.update_meal_item_amount(p_item_id uuid, p_amount_g numeric)
returns void
language plpgsql set search_path = public
as $$
begin
  if p_amount_g is null or p_amount_g <= 0 or p_amount_g > 5000 then
    raise exception 'Amount must be between 0 and 5000 g';
  end if;

  update public.meal_items i
  set nutrition = coalesce(
        (select jsonb_object_agg(n.key, round(n.value::numeric * p_amount_g / i.amount_g, 2))
           from jsonb_each_text(i.nutrition) as n),
        '{}'::jsonb),
      amount_g = p_amount_g
  where i.id = p_item_id;

  if not found then
    raise exception 'Meal item not found (or no access)';
  end if;
end;
$$;

-- Delete one item; if that was the meal's last item, delete the meal too
-- (an empty meal would show up as "0 kcal" in the log).
create function public.delete_meal_item(p_item_id uuid)
returns void
language plpgsql set search_path = public
as $$
declare
  v_meal_id uuid;
begin
  delete from public.meal_items where id = p_item_id returning meal_id into v_meal_id;
  if v_meal_id is null then
    raise exception 'Meal item not found (or no access)';
  end if;
  delete from public.meals m
  where m.id = v_meal_id
    and not exists (select 1 from public.meal_items i where i.meal_id = v_meal_id);
end;
$$;


-- -----------------------------------------------------------------------------
-- 5. SYSTEM STATUS fields
-- -----------------------------------------------------------------------------
-- foods_seeded_at: set by the seed script after loading Matvaretabellen.
-- fatsecret_trial_started_on: set by an admin when the 14-day trial starts,
-- so the admin panel can count the days left.
alter table public.club_settings
  add column foods_seeded_at timestamptz,
  add column fatsecret_trial_started_on date;
