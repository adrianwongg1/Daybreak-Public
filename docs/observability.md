# Phase 1 observability

The application emits one content-free `today.request` event for each `/today` render to both the server log and Sentry Logs. Its attributes are the request ID, route, `auth_ms`, `dashboard_db_ms`, `briefing_read_ms`, `weather_ms`, `saved_cities_ms`, `markets_ms`, `calendar_ms`, `news_ms`, `gemini_ms`, `total_ms`, `cache_hit`, `briefing_state`, and `failed`.

Create Sentry dashboards from `today.request` using `total_ms` for `/today` p50, p95, and p99, and group the source-duration fields by provider. Alert on elevated `failed`, database/API errors, provider timeouts, briefing-job failures, stale successful briefing age, and Gemini 429s. These are deliberately dashboard configuration steps rather than application configuration because alert recipients and thresholds are deployment-owned.

Create a Sentry uptime monitor for `GET /api/health` at a one-minute interval, alerting after two consecutive failures. The endpoint checks only application availability and basic database connectivity; it returns `200 {"status":"ok"}` or `503 {"status":"unavailable"}` and never returns provider or user data.
