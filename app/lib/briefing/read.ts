import type { Briefing } from "@/app/lib/briefing/types";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";

/** The stored briefing for one user/date, or null if it hasn't been generated yet. */
export async function getBriefingForDate(userId: string, date: string): Promise<Briefing | null> {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("briefings")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (!data) return null;

  return {
    date: data.date,
    weather_json: data.weather_json as unknown as Briefing["weather_json"],
    outfit_suggestion: data.outfit_suggestion as unknown as Briefing["outfit_suggestion"],
    market_json: data.market_json as unknown as Briefing["market_json"],
    news_json: data.news_json as unknown as Briefing["news_json"],
    saved_cities_weather_json: data.saved_cities_weather_json as unknown as Briefing["saved_cities_weather_json"],
  };
}

export async function getUserTimezone(userId: string): Promise<string> {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase.from("users").select("timezone").eq("id", userId).single();
  return data?.timezone ?? "UTC";
}
