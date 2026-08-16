# Today dashboard rollout

## Pre-production checks

1. Apply pending Supabase migrations, then run `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
2. Verify `/api/health` returns `200` against the production deployment.
3. Confirm one scheduled briefing creates exactly one `briefing_jobs` row and reaches `succeeded`.
4. Simulate unavailable Weather, Google Calendar, Finnhub/CoinGecko, and Gemini credentials. `/today` must continue to render saved data.

## Load test

Use a non-production account and its authenticated session cookie:

```bash
BASE_URL=https://staging.example.com \
SESSION_COOKIE='next-auth.session-token=…' \
CONCURRENCY=20 REQUESTS=200 npm run load:today
```

Target p50 is under 400 ms and p95 under 1.5 s. Confirm no provider request is made while the server renders `/today`; post-render section syncs are expected only when the feature flag is enabled.

## Gradual rollout and rollback

`NEXT_PUBLIC_BACKGROUND_SECTION_REFRESH` defaults to enabled. Set it to `false` in the deployment environment and redeploy to disable post-render Weather, Markets, and Calendar refreshes immediately; the stored Today dashboard and scheduled job flow remain active.

Roll out to a small group first, then compare Sentry's `today.request`, `briefing.job_*`, and `provider.*` events against the baseline. Watch p95 latency, job success rate, provider timeout/rate-limit events, and briefing age before expanding access.
