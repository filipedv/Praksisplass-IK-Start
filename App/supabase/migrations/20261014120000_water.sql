-- =============================================================================
-- Water tracking (Vann in the player sketch)
--
-- One row per "+200 ml"-style tap. Same security model as meals: a user sees
-- and writes only their own rows; an active admin sees and writes all.
-- (is_admin() / is_active_user() come from the first migration.)
-- =============================================================================

create table public.water_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  amount_ml  int not null check (amount_ml > 0 and amount_ml <= 2000),
  logged_at  timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index water_logs_user_logged_idx on public.water_logs (user_id, logged_at);

alter table public.water_logs enable row level security;

create policy "water_logs: own rows"
  on public.water_logs for all to authenticated
  using (user_id = auth.uid() and public.is_active_user())
  with check (user_id = auth.uid() and public.is_active_user());

create policy "water_logs: admin all rows"
  on public.water_logs for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Daily water goal for the club, editable by admins (the sketch uses 2500 ml).
-- PLACEHOLDER value — not hydration advice.
alter table public.club_settings
  add column default_goal_water_ml int not null default 2500 check (default_goal_water_ml > 0);
