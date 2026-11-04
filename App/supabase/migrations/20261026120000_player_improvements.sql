-- =============================================================================
-- Player & admin improvements
--   1. meals.admin_changed_at — so the PLAYER can see "Endret av administrator"
--      (players can't read the change log; that's admin-only)
--   2. add_meal_item()        — add a food to an existing meal (player: own meal,
--                               admin: anyone's; nutrition computed in the DB)
--   3. recent_foods()         — the player's most-used foods, for quick logging
--   4. followup_dismissals    — admins mark "Trenger oppfølging" items as handled
--
-- Only ADDS things (see the Git workflow in CLAUDE.md).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. "Endret av administrator"
-- -----------------------------------------------------------------------------
-- Set whenever someone OTHER than the meal's owner (i.e. an admin) adds,
-- changes or removes an item, or changes the meal itself. The player app
-- shows it on the meal. What exactly changed is in the admin-only change log.

alter table public.meals add column admin_changed_at timestamptz;

-- Item changes → stamp the parent meal.
create function public.mark_meal_changed_by_other()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_meal_id uuid := coalesce(new.meal_id, old.meal_id);
begin
  if auth.uid() is not null then
    update public.meals m
    set admin_changed_at = now()
    where m.id = v_meal_id
      and m.user_id is distinct from auth.uid();
  end if;
  return null; -- AFTER trigger
end;
$$;

create trigger meal_items_mark_changed_by_other
  after insert or update or delete on public.meal_items
  for each row execute function public.mark_meal_changed_by_other();

-- Changes to the meal row itself (e.g. its time) by someone else.
create function public.stamp_meal_changed_by_other()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is not null
     and new.user_id is distinct from auth.uid()
     and (new.eaten_at, new.recognizer) is distinct from (old.eaten_at, old.recognizer) then
    new.admin_changed_at = now();
  end if;
  return new;
end;
$$;

create trigger meals_stamp_changed_by_other
  before update on public.meals
  for each row execute function public.stamp_meal_changed_by_other();


-- -----------------------------------------------------------------------------
-- 2. Add a food to an existing meal
-- -----------------------------------------------------------------------------
-- security invoker: RLS decides — a player may add to their own meals, an
-- admin to anyone's. Like log_meal(), the client only sends ids + grams and
-- the nutrition snapshot is computed here from the foods table.
create function public.add_meal_item(p_meal_id uuid, p_food_id uuid, p_amount_g numeric)
returns uuid
language plpgsql set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_amount_g is null or p_amount_g <= 0 or p_amount_g > 5000 then
    raise exception 'Amount must be between 0 and 5000 g';
  end if;
  if not exists (select 1 from public.meals where id = p_meal_id) then
    raise exception 'Meal not found (or no access)';
  end if;

  insert into public.meal_items (meal_id, food_id, food_name, amount_g, nutrition, detected_label)
  select
    p_meal_id,
    f.id,
    f.name_nb,
    p_amount_g,
    (select coalesce(jsonb_object_agg(n.key, round(n.value::numeric * p_amount_g / 100, 2)), '{}'::jsonb)
       from jsonb_each_text(f.nutrition) as n),
    null
  from public.foods f
  where f.id = p_food_id
  returning id into v_id;

  if v_id is null then
    raise exception 'Food not found';
  end if;
  return v_id;
end;
$$;


-- The change log's meal_items trigger (previous migration) only covers
-- update/delete. Admins can now ADD foods to someone's meal, so log inserts
-- too. audit_row_change() skips a player's own logging, so this only records
-- someone else (an admin) adding to a person's meal.
create trigger audit_meal_items_insert
  after insert on public.meal_items
  for each row execute function public.audit_row_change('created_at');


-- -----------------------------------------------------------------------------
-- 3. The caller's most-used foods (last 90 days)
-- -----------------------------------------------------------------------------
-- Always the CALLER's own items (auth.uid()), even for admins. Also returns the
-- player's typical amount (median), so "add again" starts from a sensible size.
create function public.recent_foods(p_limit int default 8)
returns table (
  id uuid,
  source text,
  name_nb text,
  name_en text,
  nutrition jsonb,
  portions jsonb,
  times_used int,
  last_used timestamptz,
  typical_amount_g numeric
)
language sql stable set search_path = public
as $$
  select f.id, f.source, f.name_nb, f.name_en, f.nutrition, f.portions,
         count(*)::int as times_used,
         max(m.eaten_at) as last_used,
         round(percentile_cont(0.5) within group (order by i.amount_g)::numeric) as typical_amount_g
  from public.meal_items i
  join public.meals m on m.id = i.meal_id
  join public.foods f on f.id = i.food_id
  where m.user_id = auth.uid()
    and m.eaten_at > now() - interval '90 days'
  group by f.id
  order by count(*) desc, max(m.eaten_at) desc
  limit greatest(1, least(p_limit, 30));
$$;


-- -----------------------------------------------------------------------------
-- 4. "Trenger oppfølging" — marked as handled
-- -----------------------------------------------------------------------------
-- One row per handled item. `item_key` identifies the reason, e.g.
-- "logging:<user id>" or "item:<user id>:<time>:<food>" (built by the admin
-- panel). expires_at = when the item may show up again if the situation is
-- unchanged (NULL = never — used for one-off data issues).
create table public.followup_dismissals (
  item_key     text primary key,
  dismissed_by uuid default auth.uid() references public.profiles (id) on delete set null,
  dismissed_at timestamptz not null default now(),
  expires_at   timestamptz
);

alter table public.followup_dismissals enable row level security;

-- Admin-only: it's part of the admins' shared follow-up list.
create policy "followup_dismissals: admin all"
  on public.followup_dismissals for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
