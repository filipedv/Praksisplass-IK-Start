-- =============================================================================
-- Food aliases ("link list"): recognizer label → an existing food.
--
-- When a recognizer returns a label that fuzzy matching can't place (e.g.
-- "chicken breast" — Matvaretabellen says "Chicken, fillet"), an admin links
-- the label to the right food ONCE. The player app checks this table before
-- guessing, so from then on the label always maps to that food.
--
-- Why not copy the food (the old workaround)? A copy duplicates the nutrition
-- data, misses Matvaretabellen's yearly updates and clutters the food search.
-- An alias just points at the original row.
--
-- `label` is what the app has for a guess:
--   - a plain label such as "chicken breast" (mock, or any provider's text), or
--   - a storable provider id such as "fatsecret:12345" (FatSecret's terms only
--     allow storing its food_id, so that's what recognition_events contains).
-- Stored lower-cased and trimmed, so "Chicken Breast " and "chicken breast"
-- are the same alias.
-- =============================================================================

create table public.food_aliases (
  id         uuid primary key default gen_random_uuid(),
  label      text not null unique check (label = lower(trim(label)) and label <> ''),
  food_id    uuid not null references public.foods (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index food_aliases_food_idx on public.food_aliases (food_id);

alter table public.food_aliases enable row level security;

-- Every signed-in user may READ aliases: the player app needs them for
-- matching. They contain no personal data (a label and a food id).
create policy "food_aliases: signed-in users read"
  on public.food_aliases for select to authenticated
  using (true);

-- Only active admins may create, change or remove links.
create policy "food_aliases: admin writes"
  on public.food_aliases for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Record who made the link (set by the database, not trusted from the client).
create function public.stamp_food_alias()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.created_by = auth.uid();
  new.label = lower(trim(new.label)); -- normalise before the CHECK runs
  return new;
end;
$$;

create trigger food_aliases_stamp
  before insert or update on public.food_aliases
  for each row execute function public.stamp_food_alias();
