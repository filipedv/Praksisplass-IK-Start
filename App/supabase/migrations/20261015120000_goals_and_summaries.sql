-- =============================================================================
-- Per-player nutrition goals + daily summaries for the admin panel
--
-- 1. player_goals: optional per-player goals. Every column is nullable:
--    NULL = "use the club default" from club_settings. So a player with no
--    row (or an empty field) simply follows the club template.
-- 2. goals_for(): the EFFECTIVE goals for one player (own value, else club default).
-- 3. daily_summary(): totals per player per day (meals, kcal, macros, water),
--    computed in the database instead of downloading every meal item.
-- 4. last_activity(): when each player last logged a meal / water.
--
-- All functions are `security invoker`, so RLS still decides what the caller
-- sees: an admin gets everyone, a player only themselves.
-- =============================================================================

create table public.player_goals (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  goal_kcal      int check (goal_kcal > 0),
  goal_protein_g int check (goal_protein_g >= 0),
  goal_carbs_g   int check (goal_carbs_g >= 0),
  goal_fat_g     int check (goal_fat_g >= 0),
  goal_water_ml  int check (goal_water_ml > 0),
  updated_at     timestamptz not null default now(),
  -- Who last changed the goals (filled in automatically, see trigger below).
  updated_by     uuid references public.profiles (id) on delete set null
);

alter table public.player_goals enable row level security;

-- A player may SEE their own goals (the app uses the water goal)…
create policy "player_goals: read own"
  on public.player_goals for select to authenticated
  using (user_id = auth.uid() and public.is_active_user());

-- …but only admins may set them. (Coaches get a policy in the coach session.)
create policy "player_goals: admin all"
  on public.player_goals for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Stamp updated_at / updated_by on every change, so nobody can fake them.
create function public.stamp_player_goals()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger player_goals_stamp
  before insert or update on public.player_goals
  for each row execute function public.stamp_player_goals();


-- Effective goals for one player: their own value where set, else the club
-- default. If the caller may not see that player's row (RLS), they simply
-- get the club defaults — nothing leaks.
create function public.goals_for(p_user_id uuid default auth.uid())
returns table (
  goal_kcal      int,
  goal_protein_g int,
  goal_carbs_g   int,
  goal_fat_g     int,
  goal_water_ml  int,
  has_custom     boolean -- true if the player has ANY own goal set
)
language sql stable set search_path = public
as $$
  select
    coalesce(g.goal_kcal,      c.default_goal_kcal),
    coalesce(g.goal_protein_g, c.default_goal_protein_g),
    coalesce(g.goal_carbs_g,   c.default_goal_carbs_g),
    coalesce(g.goal_fat_g,     c.default_goal_fat_g),
    coalesce(g.goal_water_ml,  c.default_goal_water_ml),
    (g.user_id is not null and num_nonnulls(g.goal_kcal, g.goal_protein_g, g.goal_carbs_g, g.goal_fat_g, g.goal_water_ml) > 0)
  from public.club_settings c
  left join public.player_goals g on g.user_id = p_user_id
  where c.id = 1;
$$;


-- Totals per player per LOCAL day (default Norwegian time), from p_from to
-- p_to inclusive. Pass p_user_id to get one player only.
create function public.daily_summary(
  p_from    date,
  p_to      date,
  p_user_id uuid default null,
  p_tz      text default 'Europe/Oslo'
)
returns table (
  user_id   uuid,
  day       date,
  meals     int,
  kcal      numeric,
  protein_g numeric,
  carbs_g   numeric,
  fat_g     numeric,
  water_ml  int
)
language sql stable set search_path = public
as $$
  with bounds as (
    -- Local midnight at the start of p_from and after p_to, as real timestamps.
    select (p_from::timestamp at time zone p_tz) as t0,
           ((p_to + 1)::timestamp at time zone p_tz) as t1
  ),
  meal_days as (
    select m.user_id,
           (m.eaten_at at time zone p_tz)::date as day,
           count(distinct m.id)::int as meals,
           coalesce(sum((i.nutrition ->> 'energy_kcal')::numeric), 0) as kcal,
           coalesce(sum((i.nutrition ->> 'protein_g')::numeric), 0) as protein_g,
           coalesce(sum((i.nutrition ->> 'carbs_g')::numeric), 0) as carbs_g,
           coalesce(sum((i.nutrition ->> 'fat_g')::numeric), 0) as fat_g
    from public.meals m
    join public.meal_items i on i.meal_id = m.id
    cross join bounds b
    where m.eaten_at >= b.t0 and m.eaten_at < b.t1
      and (p_user_id is null or m.user_id = p_user_id)
    group by 1, 2
  ),
  water_days as (
    select w.user_id,
           (w.logged_at at time zone p_tz)::date as day,
           sum(w.amount_ml)::int as water_ml
    from public.water_logs w
    cross join bounds b
    where w.logged_at >= b.t0 and w.logged_at < b.t1
      and (p_user_id is null or w.user_id = p_user_id)
    group by 1, 2
  )
  -- A day can have meals but no water, or the other way round.
  select coalesce(md.user_id, wd.user_id),
         coalesce(md.day, wd.day),
         coalesce(md.meals, 0),
         round(coalesce(md.kcal, 0), 1),
         round(coalesce(md.protein_g, 0), 1),
         round(coalesce(md.carbs_g, 0), 1),
         round(coalesce(md.fat_g, 0), 1),
         coalesce(wd.water_ml, 0)
  from meal_days md
  full outer join water_days wd on wd.user_id = md.user_id and wd.day = md.day
  order by 2, 1;
$$;


-- When each player last logged anything (for "hasn't logged in N days").
create function public.last_activity()
returns table (user_id uuid, last_meal_at timestamptz, last_water_at timestamptz)
language sql stable set search_path = public
as $$
  select p.id,
         (select max(m.eaten_at) from public.meals m where m.user_id = p.id),
         (select max(w.logged_at) from public.water_logs w where w.user_id = p.id)
  from public.profiles p;
$$;
