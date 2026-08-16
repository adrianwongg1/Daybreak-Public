import { formatHourLabel } from "@/app/lib/briefing/date";
import { computeOutfitSuggestion } from "@/app/lib/briefing/outfit";
import type { HourlyTemp, OutfitSuggestion, WeatherInfo } from "@/app/lib/briefing/types";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";
import type { Json } from "@/app/lib/supabase/database.types";
import { withProviderFallback } from "@/app/lib/providers/resilience";
import { isCacheFresh } from "@/app/lib/cache/freshness";

// None of this file's fetches had a timeout — a slow/hanging Open-Meteo
// response could block the whole Today page indefinitely (this is exactly
// what happened with news.ts's rss-parser default 60s timeout; these calls
// had no bound at all). 8s is generous for a geocode/forecast lookup while
// keeping the page from hanging on one flaky provider.
const EXTERNAL_FETCH_TIMEOUT_MS = 8000;
const WEATHER_CACHE_FRESHNESS_MS = 15 * 60 * 1000;

function locationKey(location: string): string { return location.trim().toLowerCase().replace(/\s+/g, " "); }
function coordinateKey(lat: number, lon: number): string { return `${lat.toFixed(4)},${lon.toFixed(4)}`; }

// Open-Meteo's documented WMO weather-code table — not exhaustive of every
// WMO code, but covers everything its forecast API actually returns.
const WEATHER_CODE_LABELS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Light rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  85: "Light snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with light hail",
  99: "Thunderstorm with heavy hail",
};

// Standard 16-point compass rose, indexed by round(degrees / 22.5) % 16.
const COMPASS_POINTS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

function compassDirection(degrees: number): string {
  return COMPASS_POINTS[Math.round(degrees / 22.5) % 16];
}

interface GeocodedLocation {
  latitude: number;
  longitude: number;
  /** "City, Region, Country" — only as specific as Open-Meteo's match provides. */
  displayName: string;
}

async function geocodeLocation(location: string): Promise<GeocodedLocation | null> {
  const key = locationKey(location);
  try {
    const { data } = await getSupabaseServiceClient().from("geocode_cache").select("latitude, longitude, display_name").eq("location_key", key).maybeSingle();
    if (data) return { latitude: data.latitude, longitude: data.longitude, displayName: data.display_name };
  } catch { /* cache is optional until the migration is deployed */ }
  // Open-Meteo's geocoder does fuzzy name matching, not free-text search —
  // "Cerritos, CA" (onboarding's own "City, State/Country" placeholder,
  // app/onboarding/location/page.tsx) returns zero results, while "Cerritos"
  // alone matches fine. Query with just the part before the first comma.
  const parts = location.split(",").map((part) => part.trim());
  const cityOnly = parts[0] || location;
  // A bare city name is frequently ambiguous ("Mountain View" alone matches
  // Arkansas, California, Hawaii, Missouri, Wyoming, and Oklahoma) — count=1
  // used to just trust whichever one Open-Meteo happened to rank first,
  // silently querying weather for the wrong city while still labeling it
  // with the region the user actually picked (that label comes from the
  // stored `home_location` text itself, not from this result — see
  // weather-section.tsx's home WeatherCard). The onboarding autocomplete
  // already disambiguated once and stored the full "City, Region, Country"
  // string, so re-use that region/country here to pick the matching
  // candidate out of several, instead of discarding it and guessing again.
  const params = new URLSearchParams({ name: cityOnly, count: "10", language: "en", format: "json" });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, {
    signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    results?: { latitude: number; longitude: number; name: string; admin1?: string; country?: string }[];
  };
  const results = data.results ?? [];
  if (results.length === 0) return null;

  // admin1 (state/region) is checked before country — nearly every
  // candidate for a common US city name shares "United States" as its
  // country, so a country-only match would just latch onto whichever
  // result happens to come first, defeating the whole point.
  const restLower = parts.slice(1).join(" ").toLowerCase();
  const adminMatch = restLower && results.find((r) => r.admin1 && restLower.includes(r.admin1.toLowerCase()));
  const countryMatch = restLower && results.find((r) => r.country && restLower.includes(r.country.toLowerCase()));
  const match = adminMatch || countryMatch || results[0];

  const resolved = {
    latitude: match.latitude,
    longitude: match.longitude,
    displayName: [match.name, match.admin1, match.country].filter(Boolean).join(", "),
  };
  void getSupabaseServiceClient().from("geocode_cache").upsert({ location_key: key, latitude: resolved.latitude, longitude: resolved.longitude, display_name: resolved.displayName });
  return resolved;
}

interface ForecastData {
  currentTempF: number;
  feelsLikeF: number;
  currentWeatherCode: number;
  tempHighF: number;
  tempLowF: number;
  weatherCode: number;
  precipitationProbabilityPct: number;
  uvIndexMax: number;
  windSpeedMph: number;
  windDirectionDeg: number;
  /** Local wall-clock ISO strings ("2026-07-26T07:00", no offset) for the forecast range. */
  hourlyTimes: string[];
  hourlyTempsF: number[];
  hourlyWeatherCodes: number[];
}

async function fetchForecast(lat: number, lon: number, timezone: string): Promise<ForecastData | null> {
  const key = coordinateKey(lat, lon);
  let staleForecast: ForecastData | null = null;
  try {
    const { data } = await getSupabaseServiceClient().from("weather_forecast_cache").select("forecast_json, fetched_at").eq("coordinate_key", key).maybeSingle();
    if (data && isCacheFresh(data.fetched_at, WEATHER_CACHE_FRESHNESS_MS)) return data.forecast_json as unknown as ForecastData;
    if (data) staleForecast = data.forecast_json as unknown as ForecastData;
  } catch { /* provider fallback below */ }
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,apparent_temperature,weather_code",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant,uv_index_max",
    hourly: "temperature_2m,weather_code",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone,
    // Keep a third calendar day so a morning briefing still covers a full
    // rolling 24-hour strip late in the evening.
    forecast_days: "3",
  });
  return withProviderFallback("open_meteo_forecast", async () => {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Open-Meteo forecast failed (${res.status})`);

    const data = (await res.json()) as {
    current?: { temperature_2m: number; apparent_temperature: number; weather_code: number };
    daily?: {
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max: number[];
      wind_speed_10m_max: number[];
      wind_direction_10m_dominant: number[];
      uv_index_max: number[];
    };
    hourly?: { time: string[]; temperature_2m: number[]; weather_code: number[] };
    };
    const daily = data.daily;
    if (!daily || daily.temperature_2m_max.length === 0) throw new Error("Open-Meteo forecast was incomplete");

    const forecast = {
    currentTempF: Math.round(data.current?.temperature_2m ?? daily.temperature_2m_max[0]),
    feelsLikeF: Math.round(data.current?.apparent_temperature ?? daily.temperature_2m_max[0]),
    currentWeatherCode: data.current?.weather_code ?? daily.weather_code[0],
    tempHighF: Math.round(daily.temperature_2m_max[0]),
    tempLowF: Math.round(daily.temperature_2m_min[0]),
    weatherCode: daily.weather_code[0],
    precipitationProbabilityPct: daily.precipitation_probability_max[0],
    uvIndexMax: Math.round(daily.uv_index_max[0]),
    windSpeedMph: Math.round(daily.wind_speed_10m_max[0]),
    windDirectionDeg: daily.wind_direction_10m_dominant[0],
    hourlyTimes: data.hourly?.time ?? [],
    hourlyTempsF: data.hourly?.temperature_2m ?? [],
    hourlyWeatherCodes: data.hourly?.weather_code ?? [],
    };
    void getSupabaseServiceClient().from("weather_forecast_cache").upsert({ coordinate_key: key, forecast_json: forecast as unknown as Json, fetched_at: new Date().toISOString() });
    return forecast;
  }, () => staleForecast);
}

/** Preserve all returned forecast hours; the client selects the rolling 24-hour window. */
function extractHourlyForecast(forecast: ForecastData): HourlyTemp[] {
  const hours: HourlyTemp[] = [];
  for (let idx = 0; idx < forecast.hourlyTimes.length; idx++) {
    hours.push({
      // Open-Meteo returns naive local wall-clock strings when a real
      // `timezone` is passed, so the "HH" substring alone is the local hour.
      time: formatHourLabel(Number(forecast.hourlyTimes[idx].slice(11, 13))),
      dateTime: forecast.hourlyTimes[idx],
      tempF: Math.round(forecast.hourlyTempsF[idx]),
      weatherCode: forecast.hourlyWeatherCodes[idx],
    });
  }
  return hours;
}

function toWeatherInfo(forecast: ForecastData, hourly?: HourlyTemp[]): WeatherInfo {
  return {
    currentTempF: forecast.currentTempF,
    feelsLikeF: forecast.feelsLikeF,
    tempHighF: forecast.tempHighF,
    tempLowF: forecast.tempLowF,
    condition: WEATHER_CODE_LABELS[forecast.currentWeatherCode] ?? "Unknown",
    conditionCode: forecast.currentWeatherCode,
    precipitationProbabilityPct: forecast.precipitationProbabilityPct,
    uvIndexMax: forecast.uvIndexMax,
    windSpeedMph: forecast.windSpeedMph,
    windDirection: compassDirection(forecast.windDirectionDeg),
    hourly,
  };
}

/**
 * Weather (Open-Meteo, no API key) and the derived outfit suggestion, for
 * PRD 6.1's "Weather + outfit" section. Returns both as null together on any
 * failure — geocoding a free-text `home_location` and the forecast call are
 * both real network calls that can fail independently of the rest of the
 * briefing (PRD 7.2 degraded-state rule). The response retains enough hours
 * for the client to show a rolling 24-hour forecast throughout the day.
 *
 * Uses `timezone=auto` for the forecast call — same as every other weather
 * lookup in this file (`weatherForCoordinates`) — rather than the user's
 * stored account `timezone`, which this function used to pass. Open-Meteo
 * uses the `timezone` param to decide the "today" boundary for the `daily`
 * high/low/condition figures; if the account's stored timezone ever drifts
 * from the geocoded home location's real timezone, that boundary shifts and
 * the daily figures stop matching the actual place — `auto` derives the
 * correct timezone straight from the coordinates every time, so it can't
 * drift out of sync with `home_location`.
 */
export async function getWeatherAndOutfit(
  homeLocation: string,
  coldTolerance: string,
  stylePreference: string
): Promise<{ weather: WeatherInfo | null; outfit: OutfitSuggestion | null }> {
  if (!homeLocation.trim()) return { weather: null, outfit: null };

  try {
    const location = await geocodeLocation(homeLocation);
    if (!location) return { weather: null, outfit: null };

    const forecast = await fetchForecast(location.latitude, location.longitude, "auto");
    if (!forecast) return { weather: null, outfit: null };

    const hourly = extractHourlyForecast(forecast);
    const weather = toWeatherInfo(forecast, hourly);
    const effectiveHighF = hourly.length > 0 ? Math.max(...hourly.map((h) => h.tempF)) : forecast.tempHighF;
    const effectiveLowF = hourly.length > 0 ? Math.min(...hourly.map((h) => h.tempF)) : forecast.tempLowF;
    const outfit = computeOutfitSuggestion({
      tempHighF: effectiveHighF,
      tempLowF: effectiveLowF,
      precipitationProbabilityPct: forecast.precipitationProbabilityPct,
      windSpeedMph: forecast.windSpeedMph,
      coldTolerance,
      stylePreference,
    });
    return { weather, outfit };
  } catch (error) {
    console.error("Weather fetch failed:", error);
    return { weather: null, outfit: null };
  }
}

export interface CitySuggestion {
  latitude: number;
  longitude: number;
  /** "City, Region, Country" — only as specific as Open-Meteo's match provides. */
  displayName: string;
}

/** A user-saved city for the Today page's multi-city weather — same shape as `CitySuggestion`. */
export type SavedCity = CitySuggestion;

/** `preferences.saved_cities` is stored as jsonb (typed `Json` by Supabase codegen) — narrow it back to `SavedCity[]`, defaulting to empty for anything unexpected. */
export function parseSavedCities(value: unknown): SavedCity[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is SavedCity =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as SavedCity).latitude === "number" &&
      typeof (item as SavedCity).longitude === "number" &&
      typeof (item as SavedCity).displayName === "string"
  );
}

/**
 * Live autocomplete candidates for the Today page's "check another city"
 * search box — called on every debounced keystroke, so this returns several
 * matches (not just the top one `geocodeLocation` picks) letting the user
 * disambiguate "which Springfield" before ever fetching weather.
 */
export async function suggestCities(query: string): Promise<CitySuggestion[]> {
  const cityOnly = query.split(",")[0]?.trim() ?? "";
  if (cityOnly.length < 2) return [];

  try {
    const params = new URLSearchParams({ name: cityOnly, count: "8", language: "en", format: "json" });
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, {
      signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      results?: { latitude: number; longitude: number; name: string; admin1?: string; country?: string }[];
    };
    return (data.results ?? []).map((r) => ({
      latitude: r.latitude,
      longitude: r.longitude,
      displayName: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    }));
  } catch (error) {
    console.error("City suggestion lookup failed:", error);
    return [];
  }
}

interface CityWeatherResult {
  displayName: string;
  latitude: number;
  longitude: number;
  weather: WeatherInfo;
}

async function weatherForCoordinates(
  latitude: number,
  longitude: number,
  displayName: string
): Promise<CityWeatherResult | null> {
  const forecast = await fetchForecast(latitude, longitude, "auto");
  if (!forecast) return null;
  return { displayName, latitude, longitude, weather: toWeatherInfo(forecast) };
}

/**
 * Ad-hoc weather lookup for an arbitrary city (Today page's "check another
 * city" search — not tied to the signed-in user's own `home_location` or
 * preferences, so no outfit suggestion here, just the forecast). Uses
 * `timezone=auto` rather than the signed-in user's timezone, since the
 * searched city can be anywhere — Open-Meteo resolves "today" using the
 * coordinates' own local timezone. Free-text fallback for when the user
 * types and submits without picking a suggestion; picking one goes straight
 * to `getCityWeatherByCoordinates` instead, skipping a second geocode call.
 */
export async function searchCityWeather(query: string): Promise<CityWeatherResult | null> {
  if (!query.trim()) return null;

  try {
    const location = await geocodeLocation(query);
    if (!location) return null;

    return await weatherForCoordinates(location.latitude, location.longitude, location.displayName);
  } catch (error) {
    console.error("City weather search failed:", error);
    return null;
  }
}

/** Weather for a suggestion the user actually picked — no re-geocoding, no ambiguity about which match was meant. */
export async function getCityWeatherByCoordinates(
  latitude: number,
  longitude: number,
  displayName: string
): Promise<CityWeatherResult | null> {
  try {
    return await weatherForCoordinates(latitude, longitude, displayName);
  } catch (error) {
    console.error("City weather lookup failed:", error);
    return null;
  }
}

/**
 * Weather for every one of the user's saved cities, in parallel — shared by
 * the Today page (live, every render) and `buildBriefingSnapshot` (stored
 * once per day, in the generated briefing). A city that fails
 * (bad coordinates, upstream error) is just dropped rather than failing the
 * whole batch, same degrade-independently rule every other source follows.
 */
export async function fetchSavedCitiesWeather(
  cities: SavedCity[]
): Promise<{ displayName: string; weather: WeatherInfo }[]> {
  const results = await Promise.all(
    cities.map((city) => getCityWeatherByCoordinates(city.latitude, city.longitude, city.displayName))
  );
  return results.filter((result): result is CityWeatherResult => result !== null);
}
