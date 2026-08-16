import { todayInTimeZone } from "@/app/lib/briefing/date";
import { fetchMarketSummary } from "@/app/lib/briefing/sources/market";
import { fetchNewsHeadlines } from "@/app/lib/briefing/sources/news";
import { fetchSavedCitiesWeather, getWeatherAndOutfit, parseSavedCities } from "@/app/lib/briefing/sources/weather";
import type { Briefing } from "@/app/lib/briefing/types";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";
import type { Json, TablesInsert } from "@/app/lib/supabase/database.types";

export interface BriefingGenerationTiming {
  record(name: "weather_ms" | "saved_cities_ms" | "markets_ms" | "news_ms" | "gemini_ms", durationMs: number): void;
}

async function measureBriefingSource<T>(
  timing: BriefingGenerationTiming | undefined,
  name: "weather_ms" | "saved_cities_ms" | "markets_ms" | "news_ms",
  operation: () => Promise<T>
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    timing?.record(name, performance.now() - startedAt);
  }
}

/**
 * Builds the live briefing payload for one user without writing anything —
 * the pure "fetch everything" half of generateBriefing below. Not called
 * directly by the Today page: a briefing that's never persisted means any
 * same-day `.update(...).eq("date", today)` action (News refresh) would
 * silently affect zero rows the first time a user is seen that day.
 * generateBriefing is the one that should be called when there's no stored
 * row yet, since it builds this and saves it.
 */
export async function buildBriefingSnapshot(
  userId: string,
  timing?: BriefingGenerationTiming,
  briefingDate?: string
): Promise<Briefing> {
  const supabase = getSupabaseServiceClient();

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("home_location, timezone")
    .eq("id", userId)
    .single();
  if (userError || !user) throw new Error("User not found");

  const { data: preferences } = await supabase
    .from("preferences")
    .select("news_topics, market_tickers, cold_tolerance, style_preference, saved_cities")
    .eq("user_id", userId)
    .maybeSingle();

  const newsTopics = preferences?.news_topics ?? [];
  const marketTickers = preferences?.market_tickers ?? [];
  const coldTolerance = preferences?.cold_tolerance ?? "Average";
  const stylePreference = preferences?.style_preference ?? "Casual";
  const savedCities = parseSavedCities(preferences?.saved_cities);

  // Independently degrading sources — Promise.allSettled so one slow/failed
  // API never blocks the others; a rejected promise here would only happen
  // for a bug in the source module itself, since each module already
  // catches its own network/parsing errors and resolves to null.
  const [weatherOutcome, marketOutcome, newsOutcome, savedCitiesWeatherOutcome] = await Promise.allSettled([
    measureBriefingSource(timing, "weather_ms", () => getWeatherAndOutfit(user.home_location ?? "", coldTolerance, stylePreference)),
    measureBriefingSource(timing, "markets_ms", () => fetchMarketSummary(marketTickers)),
    measureBriefingSource(timing, "news_ms", () =>
      fetchNewsHeadlines(newsTopics, { cacheDate: briefingDate ?? todayInTimeZone(user.timezone), onGeminiTiming: (durationMs) => timing?.record("gemini_ms", durationMs) })
    ),
    measureBriefingSource(timing, "saved_cities_ms", () => fetchSavedCitiesWeather(savedCities)),
  ]);

  const weatherAndOutfit = weatherOutcome.status === "fulfilled" ? weatherOutcome.value : { weather: null, outfit: null };
  const market = marketOutcome.status === "fulfilled" ? marketOutcome.value : null;
  const news = newsOutcome.status === "fulfilled" ? newsOutcome.value.headlines : null;
  const savedCitiesWeather =
    savedCitiesWeatherOutcome.status === "fulfilled" && savedCitiesWeatherOutcome.value.length > 0
      ? savedCitiesWeatherOutcome.value
      : null;

  const date = briefingDate ?? todayInTimeZone(user.timezone);

  return {
    date,
    weather_json: weatherAndOutfit.weather,
    outfit_suggestion: weatherAndOutfit.outfit,
    market_json: market,
    news_json: news,
    saved_cities_weather_json: savedCitiesWeather,
  };
}

/**
 * Runs the full briefing pipeline for one user and upserts the result into
 * `briefings`.
 */
export async function generateBriefing(
  userId: string,
  timing?: BriefingGenerationTiming,
  briefingDate?: string
): Promise<Briefing> {
  const supabase = getSupabaseServiceClient();
  const briefing = await buildBriefingSnapshot(userId, timing, briefingDate);
  const row: TablesInsert<"briefings"> = {
    user_id: userId,
    date: briefing.date,
    weather_json: briefing.weather_json as unknown as Json,
    outfit_suggestion: briefing.outfit_suggestion as unknown as Json,
    market_json: briefing.market_json as unknown as Json,
    news_json: briefing.news_json as unknown as Json,
    saved_cities_weather_json: briefing.saved_cities_weather_json as unknown as Json,
  };
  const { error: saveError } = await supabase.from("briefings").upsert(row, { onConflict: "user_id,date" });
  if (saveError) throw new Error(`Failed to save briefing: ${saveError.message}`);
  return briefing;
}
