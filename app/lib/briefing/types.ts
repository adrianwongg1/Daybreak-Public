// Canonical briefing content shapes — mirrors the `briefings` table's JSON
// columns (app/lib/supabase/database.types.ts). Supersedes the old
// app/lib/mock-briefings.ts type definitions now that Today/Calendar read
// real data instead of mock data (design_handoff_daybreak_app redesign).

export interface HourlyTemp {
  /** 12-hour label, e.g. "7 AM". */
  time: string;
  /** Local forecast hour (`YYYY-MM-DDTHH:00`) used to keep the strip rolling. */
  dateTime?: string;
  tempF: number;
  /** Open-Meteo WMO weather code for this hour — drives the per-hour condition icon. */
  weatherCode: number;
}

export interface WeatherInfo {
  /** Right-now reading (Open-Meteo's `current` block), not the day's high. */
  currentTempF: number;
  feelsLikeF: number;
  tempHighF: number;
  tempLowF: number;
  condition: string;
  /** Open-Meteo WMO weather code for the current reading — drives the condition icon. */
  conditionCode: number;
  precipitationProbabilityPct: number;
  uvIndexMax: number;
  windSpeedMph: number;
  /** 16-point compass abbreviation, e.g. "NW". */
  windDirection: string;
  /** Forecast hours for the current and upcoming days. The client displays a rolling 24-hour slice. */
  hourly?: HourlyTemp[];
}

export interface OutfitSuggestion {
  summary: string;
}

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  /** ISO timestamp of when this quote was fetched — absent on rows stored before this field existed. */
  asOf?: string;
}

export interface NewsHeadline {
  topic: string;
  headline: string;
  source: string;
  summary: string;
  /** ISO timestamp of the original story, or null if unknown. */
  publishedAt: string | null;
  /** Link to the original article, or null if the source didn't provide one. */
  url: string | null;
}

export interface Briefing {
  date: string; // local calendar date, YYYY-MM-DD
  weather_json: WeatherInfo | null;
  outfit_suggestion: OutfitSuggestion | null;
  market_json: MarketQuote[] | null;
  news_json: NewsHeadline[] | null;
  /** Saved-city weather as of this day's generation — null on rows stored before this field existed, or for a user with no saved cities. Home-city weather stays in `weather_json` above; this is purely additive. */
  saved_cities_weather_json: { displayName: string; weather: WeatherInfo }[] | null;
}
