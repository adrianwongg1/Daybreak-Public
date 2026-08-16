-- Adds users.display_name (nullable -- onboarding requires it going
-- forward, but accounts that onboarded before this field existed have
-- none) and widens onboarding_last_step's check constraint to accept the
-- new 'name' step.
--
-- Safe to re-run.

alter table public.users
  add column if not exists display_name text;

-- The original check constraint on onboarding_last_step (0001_init.sql)
-- was declared inline with no explicit name, so Postgres auto-named it.
-- Rather than hardcode a guessed name (risk: guess wrong, and
-- `drop constraint if exists <wrong name>` silently no-ops, then
-- `add constraint` creates a second, additive constraint that still
-- rejects 'name' since both must pass), look it up by definition.
do $$
declare
  existing_constraint text;
begin
  select con.conname into existing_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'users'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%onboarding_last_step%';

  if existing_constraint is not null then
    execute format('alter table public.users drop constraint %I', existing_constraint);
  end if;
end $$;

alter table public.users
  add constraint users_onboarding_last_step_check
  check (onboarding_last_step in ('name', 'schedule', 'topics', 'location', 'notify', 'done'));
