-- =============================================================================
-- Coach dashboard follow-ups
--   1. reminder_templates.created_by — a coach may add reminder templates,
--      but only change or delete their OWN. The club's shared templates
--      (including the starting library) are changed by admins only, so one
--      coach can't change another team's reminders by accident.
--   2. my_team_info() — the player's team and its coaches' names, for the
--      player app's Profil ("A-lag · Trenere: Kari, Ola"). Players can't read
--      other people's profiles, so this answers only that, about the caller.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Who made a reminder template
-- -----------------------------------------------------------------------------
-- Existing templates get NULL = "the club's" (admins only).
alter table public.reminder_templates
  add column created_by uuid references public.profiles (id) on delete set null;

create function public.reminder_templates_set_owner()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by); -- can't make one in someone else's name
  else
    new.created_by := old.created_by;                       -- ownership never changes
  end if;
  return new;
end;
$$;

create trigger reminder_templates_owner
  before insert or update on public.reminder_templates
  for each row execute function public.reminder_templates_set_owner();

drop policy "reminder_templates: staff" on public.reminder_templates;

create policy "reminder_templates: staff read"
  on public.reminder_templates for select to authenticated
  using (public.is_staff());

create policy "reminder_templates: staff add"
  on public.reminder_templates for insert to authenticated
  with check (public.is_admin() or public.is_coach());

create policy "reminder_templates: admin or own changes"
  on public.reminder_templates for update to authenticated
  using (public.is_admin() or (public.is_coach() and created_by = auth.uid()))
  with check (public.is_admin() or (public.is_coach() and created_by = auth.uid()));

create policy "reminder_templates: admin or own deletes"
  on public.reminder_templates for delete to authenticated
  using (public.is_admin() or (public.is_coach() and created_by = auth.uid()));


-- -----------------------------------------------------------------------------
-- 2. my_team_info(): my team's name and my team's coaches
-- -----------------------------------------------------------------------------
-- One row for an active caller: team_name is NULL when they have no team.
-- Only active users with the coach role who are assigned to the team count.
create function public.my_team_info()
returns table (team_name text, coach_names text[])
language sql stable security definer set search_path = ''
as $$
  select
    t.name,
    coalesce(
      array(
        select c.display_name
        from public.coach_teams ct
        join public.profiles c on c.id = ct.coach_id
        where ct.team_id = t.id and c.role = 'coach' and c.is_active
        order by c.display_name
      ),
      '{}'
    )
  from public.profiles me
  left join public.teams t on t.id = me.team_id
  where me.id = auth.uid() and me.is_active;
$$;
