import { getSupabaseServiceClient } from "@/app/lib/supabase/server";

const RETENTION_DAYS = 30;
const COMMAND_LOG_RETENTION_DAYS = 30;
const JOB_RETENTION_DAYS = 30;
const WEATHER_CACHE_RETENTION_DAYS = 2;
const MARKET_CACHE_RETENTION_DAYS = 7;
const NEWS_CACHE_RETENTION_DAYS = 7;
const NEWS_SUMMARY_RETENTION_DAYS = 35;
const GEOCODE_CACHE_RETENTION_DAYS = 180;

/** Today minus RETENTION_DAYS, as a YYYY-MM-DD string — `date` is stored as a plain Postgres `date`, so a lexicographic string comparison is exact. */
function cutoffDateIso(): string {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);
  return cutoff.toISOString().slice(0, 10);
}

function cutoffTimestampIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export interface PurgeResult {
  briefings: number;
  commandLogs: number;
  jobs: number;
  marketQuotes: number;
  weatherForecasts: number;
  newsSources: number;
  newsSummaries: number;
  geocodes: number;
}

/**
 * PRD 7.4: briefings older than 30 days are auto-purged unconditionally
 * (the earlier pin-to-keep exemption was removed along with the pin
 * feature itself). A global cutoff (UTC "today" minus 30 days) rather than
 * a per-user-timezone one — retention is a coarse cost/storage control, not
 * a user-facing precision guarantee, so a few hours of timezone slop at the
 * boundary doesn't matter the way the "who's due now" briefing-generation
 * check (app/lib/briefing/due.ts) does.
 */
export async function purgeOldBriefings(): Promise<number> {
  const supabase = getSupabaseServiceClient();
  const cutoff = cutoffDateIso();

  const { data, error } = await supabase.from("briefings").delete().lt("date", cutoff).select("id");
  if (error) throw new Error(`Failed to purge briefings: ${error.message}`);

  return data?.length ?? 0;
}

/**
 * Removes expired operational data without touching live user data. Command
 * text and parsed AI results are intentionally short-lived; the remaining
 * caches are safe to recreate from their providers when needed.
 */
export async function purgeExpiredOperationalData(): Promise<PurgeResult> {
  const supabase = getSupabaseServiceClient();
  const [commandLogs, jobs, marketQuotes, weatherForecasts, newsSources, newsSummaries, geocodes] = await Promise.all([
    supabase.from("commands_log").delete({ count: "exact" }).lt("created_at", cutoffTimestampIso(COMMAND_LOG_RETENTION_DAYS)),
    supabase.from("briefing_jobs").delete({ count: "exact" }).lt("finished_at", cutoffTimestampIso(JOB_RETENTION_DAYS)),
    supabase.from("market_quote_cache").delete({ count: "exact" }).lt("as_of", cutoffTimestampIso(MARKET_CACHE_RETENTION_DAYS)),
    supabase.from("weather_forecast_cache").delete({ count: "exact" }).lt("fetched_at", cutoffTimestampIso(WEATHER_CACHE_RETENTION_DAYS)),
    supabase.from("news_source_cache").delete({ count: "exact" }).lt("fetched_at", cutoffTimestampIso(NEWS_CACHE_RETENTION_DAYS)),
    supabase.from("news_summary_cache").delete({ count: "exact" }).lt("fetched_at", cutoffTimestampIso(NEWS_SUMMARY_RETENTION_DAYS)),
    supabase.from("geocode_cache").delete({ count: "exact" }).lt("fetched_at", cutoffTimestampIso(GEOCODE_CACHE_RETENTION_DAYS)),
  ]);

  const results = [commandLogs, jobs, marketQuotes, weatherForecasts, newsSources, newsSummaries, geocodes];
  const failure = results.find((result) => result.error);
  if (failure?.error) throw new Error(`Failed to purge operational data: ${failure.error.message}`);

  return {
    briefings: 0,
    commandLogs: commandLogs.count ?? 0,
    jobs: jobs.count ?? 0,
    marketQuotes: marketQuotes.count ?? 0,
    weatherForecasts: weatherForecasts.count ?? 0,
    newsSources: newsSources.count ?? 0,
    newsSummaries: newsSummaries.count ?? 0,
    geocodes: geocodes.count ?? 0,
  };
}
