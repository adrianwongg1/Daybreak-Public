-- Native (non-Google) calendar events -- user-authored, local CRUD only,
-- no external sync of any kind. Mirrors `reminders`' exact shape/security
-- pattern: app-local state, RLS enabled with zero policies (server-only
-- access via the service-role key, see app/lib/supabase/server.ts).
--
-- event_date is a plain date (not timestamptz) -- an event's defining
-- property is which local calendar day it's on, the same modeling
-- `users.briefing_time_weekday` already uses. This avoids all UTC
-- conversion/DST complexity entirely: the user picks a date/time and
-- that's already correct, no timezone math needed at write time.
-- Single-day events only (no end_date/span column) -- a deliberate,
-- stated limitation, easy to extend later if needed.
--
-- Safe to re-run.
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  event_date date not null,
  start_time time,
  end_time time,
  all_day boolean not null default false,
  location text,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists calendar_events_user_date_idx on public.calendar_events (user_id, event_date);

alter table public.calendar_events enable row level security;

-- One-time backfill: the app's existing real account(s) already saved an
-- explicit section_order before "calendar" existed as a section -- append
-- it so the new section shows up without needing to be manually enabled in
-- Settings. Only touches non-empty, already-customized arrays; an empty
-- array already falls back to the full default order (including
-- "calendar") via parseSectionOrder, so nothing to do there.
update public.preferences
set section_order = array_append(section_order, 'calendar')
where section_order <> '{}'
  and not ('calendar' = any(section_order));
