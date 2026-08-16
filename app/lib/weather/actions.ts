"use server";

import { todayInTimeZone } from "@/app/lib/briefing/date";
import { fetchSavedCitiesWeather, getWeatherAndOutfit, parseSavedCities, type SavedCity } from "@/app/lib/briefing/sources/weather";
import type { OutfitSuggestion, WeatherInfo } from "@/app/lib/briefing/types";
import { getCurrentUserId } from "@/app/lib/supabase/current-user";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";
import type { Json, TablesUpdate } from "@/app/lib/supabase/database.types";

// SavedCity is plain JSON-serializable data (numbers/strings only), but
// lacks the index signature TypeScript's generated `Json` union requires —
// this cast is the one place that gap is bridged for the jsonb column write.
function toJson(cities: SavedCity[]): Json {
  return cities as unknown as Json;
}

export interface WeatherRefreshResult {
  weather: WeatherInfo | null;
  outfit: OutfitSuggestion | null;
  savedCities: { displayName: string; weather: WeatherInfo }[] | null;
}

/** Refreshes only the Weather section after the page has rendered. */
export async function refreshWeatherAction(): Promise<WeatherRefreshResult> {
  const userId = await getCurrentUserId();
  const supabase = getSupabaseServiceClient();
  const [{ data: user, error: userError }, { data: preferences, error: preferencesError }] = await Promise.all([
    supabase.from("users").select("home_location, timezone").eq("id", userId).single(),
    supabase.from("preferences").select("cold_tolerance, style_preference, saved_cities").eq("user_id", userId).maybeSingle(),
  ]);
  if (userError || !user || preferencesError) throw new Error("Couldn't load weather preferences");

  const savedCities = parseSavedCities(preferences?.saved_cities);
  const [weatherAndOutfit, savedCityWeather] = await Promise.all([
    getWeatherAndOutfit(
      user.home_location ?? "",
      preferences?.cold_tolerance ?? "Average",
      preferences?.style_preference ?? "Casual"
    ),
    fetchSavedCitiesWeather(savedCities),
  ]);
  const result: WeatherRefreshResult = {
    weather: weatherAndOutfit.weather,
    outfit: weatherAndOutfit.outfit,
    savedCities: savedCityWeather.length > 0 ? savedCityWeather : null,
  };
  // Never replace a useful stored forecast with null after an upstream
  // failure. A partial success may still update the section that succeeded.
  const update: TablesUpdate<"briefings"> = {};
  if (result.weather) update.weather_json = result.weather as unknown as Json;
  if (result.outfit) update.outfit_suggestion = result.outfit as unknown as Json;
  if (result.savedCities) update.saved_cities_weather_json = result.savedCities as unknown as Json;
  if (Object.keys(update).length > 0) {
    const { error } = await supabase
      .from("briefings")
      .update(update)
      .eq("user_id", userId)
      .eq("date", todayInTimeZone(user.timezone));
    if (error) throw new Error("Couldn't save refreshed weather");
  }
  return result;
}

/**
 * Adds a city to `preferences.saved_cities` (deduped by display name) so it
 * renders as its own WeatherCard on the Today page going forward — mirrors
 * `addMarketTickerAction`'s read-dedupe-write shape.
 */
export async function addSavedCityAction(latitude: number, longitude: number, displayName: string): Promise<void> {
  const userId = await getCurrentUserId();
  const supabase = getSupabaseServiceClient();

  const [{ data: preferences, error: readError }, { data: user, error: userError }] = await Promise.all([
    supabase.from("preferences").select("saved_cities").eq("user_id", userId).single(),
    supabase.from("users").select("timezone").eq("id", userId).single(),
  ]);
  if (readError || !preferences || userError || !user) throw new Error("Couldn't load weather preferences");

  const savedCities = parseSavedCities(preferences.saved_cities);
  const alreadyAdded = savedCities.some((city) => city.displayName === displayName);
  const next: SavedCity[] = alreadyAdded ? savedCities : [...savedCities, { latitude, longitude, displayName }];
  if (!alreadyAdded) {
    const { error: writeError } = await supabase.from("preferences").update({ saved_cities: toJson(next) }).eq("user_id", userId);
    if (writeError) throw new Error("Couldn't save city");
  }

  // Saving the preference alone only affects tomorrow's generated briefing.
  // Refresh today's stored section as well so the new city appears at once.
  const savedCityWeather = await fetchSavedCitiesWeather(next);
  if (savedCityWeather.length > 0) {
    const { error: briefingError } = await supabase
      .from("briefings")
      .update({ saved_cities_weather_json: savedCityWeather as unknown as Json })
      .eq("user_id", userId)
      .eq("date", todayInTimeZone(user.timezone));
    if (briefingError) throw new Error("Couldn't update today's saved cities");
  }
}

/** Removes a city from `preferences.saved_cities` by display name. */
export async function removeSavedCityAction(displayName: string): Promise<void> {
  const userId = await getCurrentUserId();
  const supabase = getSupabaseServiceClient();

  const { data: preferences, error: readError } = await supabase
    .from("preferences")
    .select("saved_cities")
    .eq("user_id", userId)
    .single();
  if (readError || !preferences) throw new Error("Couldn't load preferences");

  const next = parseSavedCities(preferences.saved_cities).filter((city) => city.displayName !== displayName);
  const { error: writeError } = await supabase.from("preferences").update({ saved_cities: toJson(next) }).eq("user_id", userId);
  if (writeError) throw new Error("Couldn't remove city");
}
