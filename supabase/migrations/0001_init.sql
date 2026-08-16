-- Daybreak Public initial schema.
--
-- How to run this: Supabase Dashboard -> your project -> SQL Editor -> New
-- query -> paste this whole file -> Run. Safe to re-run (every statement is
-- idempotent).
--
-- This is a fresh, single-migration schema for the public fork — it mirrors
-- the private "Daily Brief Web" project's schema after 13 migrations, minus
-- everything Google/Calendar-specific (this fork has no Google integration
-- at all) and with Supabase Auth as the sole identity layer instead of
-- Auth.js + Google OAuth.

create extension if not exists "pgcrypto";

-- `users.id` IS `auth.users.id` — Supabase Auth is the sole identity layer,
-- so there's no separate provider/provider_user_id pairing to track (see
-- handle_new_auth_user() below, which populates this row the instant
-- Supabase Auth creates the auth.users row).
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  home_location text,
  briefing_time_weekday time not null default '07:00',
  briefing_time_weekend time,
  timezone text not null default 'UTC',
  onboarding_completed_at timestamptz,
  onboarding_last_step text check (onboarding_last_step in ('schedule', 'topics', 'location', 'notify', 'done'))
);

-- 1:1 with users.
create table if not exists public.preferences (
  user_id uuid primary key references public.users (id) on delete cascade,
  news_topics text[] not null default '{}',
  market_tickers text[] not null default '{}',
  news_sources text[] not null default '{}',
  cold_tolerance text,
  style_preference text,
  notification_email text,
  saved_cities jsonb not null default '[]',
  section_order text[] not null default '{}',
  command_suggestions text[] not null default array['Add a reminder', 'Summarize my week']::text[]
);

create table if not exists public.briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  date date not null,
  weather_json jsonb,
  outfit_suggestion jsonb,
  saved_cities_weather_json jsonb,
  market_json jsonb,
  news_json jsonb,
  news_refreshed_at timestamptz,
  generated_at timestamptz not null default now(),
  -- Enforces "one briefing per user per day" at the DB level.
  unique (user_id, date)
);

create table if not exists public.commands_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  input_text text not null,
  parsed_intent_json jsonb,
  status text not null check (status in ('auto_executed', 'confirmed', 'rejected', 'pending')),
  created_at timestamptz not null default now()
);

-- Typed-command reminders — app-local state, no external provider involved.
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  text text not null,
  remind_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Shared, time-gated quote cache: a live Finnhub/CoinGecko call only happens
-- when a symbol's cached row is missing or stale; the result is reused by
-- every user watching that symbol in the meantime.
create table if not exists public.market_quote_cache (
  symbol text primary key,
  name text not null,
  price numeric not null,
  change_pct numeric not null,
  as_of timestamptz not null default now()
);

-- Durable, database-backed queue for daily briefing generation.
create table if not exists public.briefing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  briefing_date date not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  locked_until timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, briefing_date)
);

-- Shared/provider caches. Values are server-only and retain only normalized
-- lookup keys and provider responses needed for refreshes.
create table if not exists public.geocode_cache (
  location_key text primary key,
  latitude double precision not null,
  longitude double precision not null,
  display_name text not null,
  fetched_at timestamptz not null default now()
);

create table if not exists public.weather_forecast_cache (
  coordinate_key text primary key,
  forecast_json jsonb not null,
  fetched_at timestamptz not null default now()
);

create table if not exists public.news_source_cache (
  provider text not null,
  topic_key text not null,
  candidates_json jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (provider, topic_key)
);

create table if not exists public.news_summary_cache (
  topic_set_key text not null,
  briefing_date date not null,
  headlines_json jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (topic_set_key, briefing_date)
);

create index if not exists briefing_jobs_ready_idx on public.briefing_jobs (status, scheduled_at);
create index if not exists briefing_jobs_user_date_idx on public.briefing_jobs (user_id, briefing_date);
create index if not exists briefing_jobs_finished_idx on public.briefing_jobs (finished_at) where finished_at is not null;
create index if not exists reminders_open_by_user_created_idx on public.reminders (user_id, created_at desc) where completed_at is null;
create index if not exists reminders_by_user_completion_due_idx on public.reminders (user_id, completed_at, remind_at);
create index if not exists commands_log_user_created_idx on public.commands_log (user_id, created_at desc);
create index if not exists market_quote_cache_as_of_idx on public.market_quote_cache (as_of);
create index if not exists geocode_cache_fetched_idx on public.geocode_cache (fetched_at);
create index if not exists weather_forecast_cache_fetched_idx on public.weather_forecast_cache (fetched_at);
create index if not exists news_source_cache_fetched_idx on public.news_source_cache (fetched_at);
create index if not exists news_summary_cache_fetched_idx on public.news_summary_cache (fetched_at);

-- Enqueue without reopening a completed job. Safe to call repeatedly from a
-- scheduler or first-time account preparation flow.
create or replace function public.enqueue_briefing_job(
  p_user_id uuid,
  p_briefing_date date,
  p_scheduled_at timestamptz default now()
)
returns setof public.briefing_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  insert into public.briefing_jobs (user_id, briefing_date, scheduled_at)
  values (p_user_id, p_briefing_date, p_scheduled_at)
  on conflict (user_id, briefing_date) do update
    set updated_at = now(),
        scheduled_at = case
          when public.briefing_jobs.status = 'queued'
            then least(public.briefing_jobs.scheduled_at, excluded.scheduled_at)
          else public.briefing_jobs.scheduled_at
        end
  returning public.briefing_jobs.*;
end;
$$;

-- Atomically claim ready work. SKIP LOCKED lets multiple worker instances
-- run concurrently without processing one job twice; expired leases recover
-- work abandoned by a terminated worker.
create or replace function public.claim_briefing_jobs(
  p_limit integer,
  p_user_id uuid default null
)
returns setof public.briefing_jobs
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select id
    from public.briefing_jobs
    where (
      (status = 'queued' and scheduled_at <= now())
      or (status = 'running' and locked_until < now())
    )
    and (p_user_id is null or user_id = p_user_id)
    order by scheduled_at asc, created_at asc
    for update skip locked
    limit greatest(p_limit, 0)
  )
  update public.briefing_jobs as job
  set status = 'running',
      attempts = job.attempts + 1,
      started_at = now(),
      locked_until = now() + interval '5 minutes',
      updated_at = now()
  from candidates
  where job.id = candidates.id
  returning job.*;
$$;

revoke execute on function public.enqueue_briefing_job(uuid, date, timestamptz) from public;
revoke execute on function public.claim_briefing_jobs(integer, uuid) from public;
grant execute on function public.enqueue_briefing_job(uuid, date, timestamptz) to service_role;
grant execute on function public.claim_briefing_jobs(integer, uuid) to service_role;

-- Deny-all RLS on every table. No policies added on purpose: the app only
-- ever accesses these tables server-side via the secret key
-- (app/lib/supabase/server.ts), which bypasses RLS regardless. This closes
-- off the publishable key (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) — which
-- @supabase/ssr's browser client puts in the browser bundle for the first
-- time in this app's history, for .auth.* calls only (see
-- app/lib/supabase/browser.ts) — from being able to read/write anything
-- directly via PostgREST, even though it's now a real public key.
alter table public.users enable row level security;
alter table public.preferences enable row level security;
alter table public.briefings enable row level security;
alter table public.commands_log enable row level security;
alter table public.reminders enable row level security;
alter table public.market_quote_cache enable row level security;
alter table public.briefing_jobs enable row level security;
alter table public.geocode_cache enable row level security;
alter table public.weather_forecast_cache enable row level security;
alter table public.news_source_cache enable row level security;
alter table public.news_summary_cache enable row level security;

-- The instant Supabase Auth creates an auth.users row (on sign-up, before
-- email confirmation), mirror it into public.users/public.preferences so
-- getCurrentUserId() can treat auth.uid() as the app's own primary key with
-- no separate email lookup or app-level insert in the sign-up Server
-- Action — and no race where auth succeeds but the app-side row doesn't
-- get created.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email) values (new.id, new.email);
  insert into public.preferences (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
