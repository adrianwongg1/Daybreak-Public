import * as Sentry from "@sentry/nextjs";

export type TodayTimingName =
  | "auth_ms"
  | "dashboard_db_ms"
  | "briefing_read_ms"
  | "weather_ms"
  | "saved_cities_ms"
  | "markets_ms"
  | "news_ms"
  | "gemini_ms";

type TodayRequestMetrics = Record<TodayTimingName, number> & {
  total_ms: number;
  briefing_generation_ms: number;
};

/**
 * Request-scoped, content-free timing for the Today render. Keep this free
 * of user IDs, email addresses, calendar data, prompts, tokens, and secrets.
 */
export class TodayRequestTiming {
  readonly requestId = crypto.randomUUID();
  private readonly startedAt = performance.now();
  private readonly metrics: TodayRequestMetrics = {
    auth_ms: 0,
    dashboard_db_ms: 0,
    briefing_read_ms: 0,
    weather_ms: 0,
    saved_cities_ms: 0,
    markets_ms: 0,
    news_ms: 0,
    gemini_ms: 0,
    briefing_generation_ms: 0,
    total_ms: 0,
  };

  async measure<T>(name: TodayTimingName | "briefing_generation_ms", operation: () => Promise<T>): Promise<T> {
    const startedAt = performance.now();
    try {
      return await operation();
    } finally {
      this.metrics[name] += Math.round(performance.now() - startedAt);
    }
  }

  record(name: TodayTimingName, durationMs: number): void {
    this.metrics[name] += Math.round(durationMs);
  }

  finish(options: { briefingState: "stored" | "generated" | "missing"; failed: boolean }): void {
    this.metrics.total_ms = Math.round(performance.now() - this.startedAt);
    const attributes = {
      request_id: this.requestId,
      route: "/today",
      cache_hit: options.briefingState === "stored",
      briefing_state: options.briefingState,
      failed: options.failed,
      ...this.metrics,
    };

    // Console JSON makes the event usable by the hosting provider's logs;
    // Sentry Logs receives the same structured attributes for dashboards and
    // alerts. The values deliberately contain no user or provider payloads.
    console.info(JSON.stringify({ event: "today.request", ...attributes }));
    Sentry.logger.info("today.request", attributes);
  }
}
