# Scaling and Rendering Performance Plan

## Goal

Make `/today` a fast database read, not a live aggregation pipeline.

```text
User opens /today
  → read saved briefing + short-lived cached data
  → render in under one second

Scheduler / job queue
  → fetch weather, markets, calendar, news, and Gemini summaries
  → retry, cache, and save results independently
```

The page should render saved data immediately. Background workers keep that data fresh.

## Success criteria

| Metric | Target |
| --- | ---: |
| `/today` server p50 | Under 400 ms |
| `/today` server p95 | Under 1.5 s |
| Page behavior during provider outage | Still renders saved data |
| First-time account page | Under 1.5 s with a preparation state |
| Briefing generation | Asynchronous and retried; never blocks page render |
| Provider calls per page view | Zero on the critical path |

## Phase 1: Measure the current system

Add structured timing around the Today route:

```text
today.request
auth_ms
dashboard_db_ms
briefing_read_ms
weather_ms
saved_cities_ms
markets_ms
calendar_ms
news_ms
gemini_ms
total_ms
cache_hit
briefing_state
```

Use a request ID to connect all logs from one page request. Do not log calendar content, prompts, tokens, email addresses, or secrets.

Add dashboards and alerts for:

- `/today` p50, p95, and p99 latency.
- Error and timeout rate.
- Provider latency by provider.
- Briefing-job success and failure rate.
- Age of each user's latest successful briefing.
- Gemini quota and 429 rate.
- Database and API errors.

Add `/api/health`, checking only app availability and basic database connectivity. Monitor it every minute and alert after two consecutive failures.

## Phase 2: Refactor the Today read path

Create one server-side dashboard view-model query for Today that returns:

- Basic user profile and timezone.
- Preferences and section order.
- Reminders.
- Today's stored briefing.
- Latest cached market and weather data where applicable.

This eliminates repeated auth, user, preferences, and briefing reads now split between the shell and page.

Change `/today` to this behavior:

1. Read the stored data.
2. Render immediately.
3. Never call Gemini, news feeds, Google Calendar, weather APIs, or market APIs before responding.
4. If data is stale, show its timestamp and refresh it in the background.

Remove the synchronous `generateBriefing` call from the page route.

For a new user with no briefing:

```text
Today page loads
→ show dashboard shell + “Preparing your first briefing”
→ enqueue one idempotent job
→ page polls or refreshes when the job completes
```

## Phase 3: Move generation to durable background jobs

Replace direct cron generation with this flow:

- Scheduler finds due users.
- Scheduler enqueues jobs.
- Workers claim jobs with bounded concurrency.
- Workers save partial and final results.
- Jobs retry safely on transient errors.

Create a `briefing_jobs` table with fields such as:

```text
id
user_id
briefing_date
status: queued | running | succeeded | failed
attempts
started_at
finished_at
last_error_code
```

Add a unique constraint on `(user_id, briefing_date)` so the same briefing cannot run twice.

Use a durable queue system with retries, delayed retry, concurrency limits, idempotency, and job visibility.

## Phase 4: Cache by the right scope

| Data | Cache scope | Suggested freshness |
| --- | --- | ---: |
| Home and saved-city weather | Shared by normalized coordinates | 10–15 min |
| Geocoding | Normalized location | Days/months |
| Market quotes | Shared by ticker | 1–5 min during market hours |
| News source results | Shared by topic | 15–60 min |
| Gemini news summary | Topic set + day | Daily/short TTL |
| Calendar | Per user | 1–5 min; invalidate after edits |
| Daily briefing | Per user + local date | One daily record |

Store home coordinates once instead of geocoding a location string on every refresh.

Keep the existing market cache, but refresh stale symbols from workers rather than the page render. Cache raw news provider results separately from Gemini summaries. Use a durable shared cache or database table as the source of truth; in-memory cache is only an optional optimization.

## Phase 5: Build resilient provider behavior

Every provider integration needs:

- Short user-facing deadlines.
- Longer background-job deadlines where justified.
- Retry with exponential backoff.
- Circuit breaking after repeated failures.
- Stale cached fallback.
- Quota and rate-limit handling.

Examples:

- If weather times out, display the last successful forecast with an update timestamp.
- If Finnhub is slow, show the cached quote.
- If Gemini is quota-limited, preserve the prior news briefing rather than showing an empty page.
- If Google Calendar fails, show last known events and a reconnect or refresh affordance.

No provider failure should turn into a slow or broken Today page.

## Phase 6: Database and security hardening

Audit common queries with production-like data and `EXPLAIN ANALYZE`.

Ensure indexes support the primary filters:

```text
briefings(user_id, date)
reminders(user_id, completed, remind_at)
preferences(user_id)
oauth_tokens(user_id, provider)
market_quote_cache(symbol)
briefing_jobs(status, scheduled_at)
briefing_jobs(user_id, briefing_date)
```

Keep Row Level Security enabled where applicable, enforce ownership by `user_id`, and keep service-role access server-only.

Add retention policies for old unpinned briefings, expired provider caches, and old job history. Never retain unnecessary AI prompts or calendar payloads in logs.

## Phase 7: Frontend behavior

The user experience should be:

- Page shell and saved briefing appear immediately.
- Each section can show a lightweight stale or refresh status.
- Background refresh is subtle.
- Individual failures affect only that section.
- Users can manually retry a failed section.
- A single slow provider never blocks the whole page.

Use section-level loading states, not a full-page block.

## Phase 8: Load testing and rollout

Before enabling the new flow for everyone:

1. Write tests for cache expiry, job deduplication, retry behavior, and provider failures.
2. Load-test the read path with concurrent `/today` requests.
3. Simulate slow or failed Weather, Google, Finnhub, and Gemini responses.
4. Roll out behind a feature flag.
5. Compare old versus new p95 latency and error rates.
6. Remove the synchronous live-fetch path only after the new path is stable.

Suggested rollout:

```text
Week 1: Observability and timing logs
Week 2: Fast stored-briefing read path
Week 3: Background job queue and no inline generation
Week 4: Weather, market, and news caching plus provider resilience
Week 5: Load test, alerts, and gradual rollout
```

## First implementation priority

Stop awaiting live weather, saved-city forecasts, and market calls inside the `/today` server render. This removes the direct cause of the 10-second page load and establishes the foundation for every later scaling improvement.
