import { refreshWeatherForUser } from "@/app/lib/weather/actions";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";

// Small batches rather than one query-per-user job queue — proportionate to
// this app's actual user count, and the shared weather_forecast_cache /
// geocode_cache tables already dedupe redundant provider calls across users
// at the same location, so raising this later costs nothing structural.
const BATCH_SIZE = 5;

export interface WeatherCronResult {
  total: number;
  succeeded: number;
  failed: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Called every hour by the GitHub Actions cron (.github/workflows/weather-cron.yml)
 * via app/api/weather/cron/route.ts — refreshes every onboarded user's home
 * and saved-city weather into today's stored briefing, replacing the old
 * per-page-view client refresh (which re-fetched on every Today mount).
 */
export async function refreshAllUsersWeather(): Promise<WeatherCronResult> {
  const { data: users } = await getSupabaseServiceClient()
    .from("users")
    .select("id")
    .not("onboarding_completed_at", "is", null);
  const userIds = (users ?? []).map((user) => user.id);

  let succeeded = 0;
  let failed = 0;
  for (const batch of chunk(userIds, BATCH_SIZE)) {
    const results = await Promise.allSettled(batch.map((userId) => refreshWeatherForUser(userId)));
    for (const result of results) {
      if (result.status === "fulfilled") succeeded++;
      else failed++;
    }
  }

  return { total: userIds.length, succeeded, failed };
}
