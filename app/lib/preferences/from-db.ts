import { DEFAULT_PREFERENCES, type DaybreakPreferences } from "@/app/lib/preferences/types";
import type { Tables } from "@/app/lib/supabase/database.types";

/** Postgres `time` values come back as "07:00:00" — the <input type="time"> fields this app uses want "07:00". */
function toHHMM(time: string): string {
  return time.slice(0, 5);
}

type UserScheduleRow = Pick<Tables<"users">, "briefing_time_weekday" | "briefing_time_weekend" | "timezone" | "home_location">;
type PreferencesRow = Pick<
  Tables<"preferences">,
  "news_topics" | "market_tickers" | "style_preference" | "cold_tolerance"
>;

/**
 * Reconstructs the app's `DaybreakPreferences` shape from the signed-in
 * user's real `users`/`preferences` rows — the durable, per-account source
 * of truth that a browser's localStorage cache doesn't share across
 * devices or a cleared cache (see ServerPreferencesHydrator for why this
 * matters). Falls back to `DEFAULT_PREFERENCES`'s per-field defaults
 * wherever the DB value is genuinely unset, so a first-time or
 * partially-onboarded user still sees the wizard's usual sensible
 * pre-checked defaults rather than an empty state for steps they haven't
 * reached yet.
 */
export function preferencesFromRows(user: UserScheduleRow, preferences: PreferencesRow | null): DaybreakPreferences {
  return {
    newsTopics: preferences?.news_topics?.length ? preferences.news_topics : DEFAULT_PREFERENCES.newsTopics,
    marketTickers: preferences?.market_tickers?.length ? preferences.market_tickers : DEFAULT_PREFERENCES.marketTickers,
    schedule: {
      weekdayTime: toHHMM(user.briefing_time_weekday),
      weekendEnabled: Boolean(user.briefing_time_weekend),
      weekendTime: user.briefing_time_weekend ? toHHMM(user.briefing_time_weekend) : DEFAULT_PREFERENCES.schedule.weekendTime,
      timezone: user.timezone,
    },
    homeLocation: user.home_location ?? "",
    outfitStyle: preferences?.style_preference ?? DEFAULT_PREFERENCES.outfitStyle,
    coldTolerance: preferences?.cold_tolerance ?? DEFAULT_PREFERENCES.coldTolerance,
  };
}
