import type { Briefing, MarketQuote } from "@/app/lib/briefing/types";
import { todayInTimeZone } from "@/app/lib/briefing/date";
import { listOpenReminders, type Reminder } from "@/app/lib/commands/reminders";
import { parseSavedCities, type SavedCity } from "@/app/lib/briefing/sources/weather";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";
import { parseSectionOrder, type SectionKey } from "@/app/lib/today-sections";
import { commandSuggestionsForDisplay } from "@/app/lib/commands/suggestions";

export interface TodayDashboardViewModel {
  timezone: string;
  today: string;
  homeLocation: string | null;
  sectionOrder: SectionKey[];
  marketTickers: string[];
  commandSuggestions: string[];
  reminders: Reminder[];
  savedCities: SavedCity[];
  briefing: (Briefing & { generatedAt: string }) | null;
  marketQuotes: MarketQuote[] | null;
  timings: {
    dashboardDbMs: number;
    briefingReadMs: number;
  };
}

function toBriefing(data: {
  date: string;
  weather_json: unknown;
  outfit_suggestion: unknown;
  market_json: unknown;
  news_json: unknown;
  saved_cities_weather_json: unknown;
  generated_at: string;
}): TodayDashboardViewModel["briefing"] {
  return {
    date: data.date,
    weather_json: data.weather_json as Briefing["weather_json"],
    outfit_suggestion: data.outfit_suggestion as Briefing["outfit_suggestion"],
    market_json: data.market_json as Briefing["market_json"],
    news_json: data.news_json as Briefing["news_json"],
    saved_cities_weather_json: data.saved_cities_weather_json as Briefing["saved_cities_weather_json"],
    generatedAt: data.generated_at,
  };
}

/**
 * The sole server-side read model for Today. It intentionally reads only
 * durable application data; no provider client may be imported here.
 */
export async function getTodayDashboardViewModel(userId: string): Promise<TodayDashboardViewModel> {
  const supabase = getSupabaseServiceClient();
  const dashboardStartedAt = performance.now();
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("timezone, home_location")
    .eq("id", userId)
    .single();
  if (userError || !user) throw new Error("Failed to load Today dashboard profile");

  const today = todayInTimeZone(user.timezone);
  const briefingStartedAt = performance.now();
  const [preferencesResult, reminders, briefingResult] = await Promise.all([
    supabase
      .from("preferences")
      .select("market_tickers, saved_cities, section_order, command_suggestions")
      .eq("user_id", userId)
      .maybeSingle(),
    listOpenReminders(userId),
    supabase
      .from("briefings")
      .select("date, weather_json, outfit_suggestion, market_json, news_json, saved_cities_weather_json, generated_at")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle(),
  ]);
  const briefingReadMs = performance.now() - briefingStartedAt;
  if (preferencesResult.error || briefingResult.error) {
    throw new Error("Failed to load Today dashboard data");
  }
  const preferences = preferencesResult.data;
  const marketTickers = preferences?.market_tickers ?? [];

  // The shared quote cache is read-only on this path. Stale values remain
  // useful with their `asOf` timestamp until a background worker refreshes them.
  const { data: cachedQuotes } = marketTickers.length
    ? await supabase
        .from("market_quote_cache")
        .select("symbol, name, price, change_pct, as_of")
        .in("symbol", marketTickers)
    : { data: [] };
  const cachedBySymbol = new Map(
    (cachedQuotes ?? []).map((quote) => [
      quote.symbol.toUpperCase(),
      {
        symbol: quote.symbol,
        name: quote.name,
        price: quote.price,
        changePct: quote.change_pct,
        asOf: quote.as_of,
      } satisfies MarketQuote,
    ])
  );
  const briefing = briefingResult.data ? toBriefing(briefingResult.data) : null;
  const storedBySymbol = new Map((briefing?.market_json ?? []).map((quote) => [quote.symbol.toUpperCase(), quote]));
  const marketQuotes = marketTickers.length
    ? marketTickers.flatMap((ticker) => {
        const quote = cachedBySymbol.get(ticker.toUpperCase()) ?? storedBySymbol.get(ticker.toUpperCase());
        return quote ? [quote] : [];
      })
    : null;

  return {
    timezone: user.timezone,
    today,
    homeLocation: user.home_location,
    sectionOrder: parseSectionOrder(preferences?.section_order),
    marketTickers,
    commandSuggestions: commandSuggestionsForDisplay(preferences?.command_suggestions),
    reminders,
    savedCities: parseSavedCities(preferences?.saved_cities),
    briefing,
    marketQuotes: marketQuotes && marketQuotes.length > 0 ? marketQuotes : null,
    timings: {
      dashboardDbMs: performance.now() - dashboardStartedAt,
      briefingReadMs,
    },
  };
}
