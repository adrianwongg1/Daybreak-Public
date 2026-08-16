"use server";

import { todayInTimeZone } from "@/app/lib/briefing/date";
import { fetchNewsHeadlines } from "@/app/lib/briefing/sources/news";
import type { NewsHeadline } from "@/app/lib/briefing/types";
import { getCurrentUserId } from "@/app/lib/supabase/current-user";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";
import type { Json } from "@/app/lib/supabase/database.types";

// A manual refresh had no rate limit — a user could click it as fast as
// they wanted, each click re-running a live RSS pull + Gemini pass. Five
// minutes is generous for a "check again" click while still ruling out
// rapid repeat-clicking.
const NEWS_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

export interface RefreshNewsResult {
  headlines: NewsHeadline[] | null;
  /** Set (and `headlines` left null) when the caller is still on cooldown — distinguishes "too soon" from a genuine pipeline failure. */
  cooldownSecondsRemaining: number | null;
  /** Set (and `headlines` left null) when Gemini's free-tier daily quota is exhausted. */
  quotaExceeded: boolean;
}

/**
 * Re-runs the news pipeline on demand and overwrites today's stored
 * briefing's `news_json` with the fresh result — the RSS pipeline
 * otherwise only runs once a day via cron, so every page reload before
 * this showed the same stale morning snapshot. Reads
 * `preferences.news_topics` fresh too, so a topic change in Settings since
 * this morning's generation is reflected immediately rather than waiting
 * for tomorrow's cron run.
 */
export async function refreshNewsAction(): Promise<RefreshNewsResult> {
  const userId = await getCurrentUserId();
  const supabase = getSupabaseServiceClient();

  const { data: user, error: userError } = await supabase.from("users").select("timezone").eq("id", userId).single();
  if (userError || !user) throw new Error("Couldn't load user");

  const today = todayInTimeZone(user.timezone);
  const { data: briefingRow } = await supabase
    .from("briefings")
    .select("news_refreshed_at")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (briefingRow?.news_refreshed_at) {
    const elapsedMs = Date.now() - new Date(briefingRow.news_refreshed_at).getTime();
    if (elapsedMs < NEWS_REFRESH_COOLDOWN_MS) {
      return {
        headlines: null,
        cooldownSecondsRemaining: Math.ceil((NEWS_REFRESH_COOLDOWN_MS - elapsedMs) / 1000),
        quotaExceeded: false,
      };
    }
  }

  const { data: preferences } = await supabase
    .from("preferences")
    .select("news_topics")
    .eq("user_id", userId)
    .maybeSingle();
  const topics = preferences?.news_topics ?? [];

  const { headlines, quotaExceeded } = await fetchNewsHeadlines(topics);

  // Don't destroy good data with a failed refresh — only overwrite the
  // stored snapshot when the pipeline actually returned something.
  if (headlines !== null) {
    const { error: writeError } = await supabase
      .from("briefings")
      .update({ news_json: headlines as unknown as Json, news_refreshed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("date", today);
    if (writeError) throw new Error("Couldn't save refreshed news");
  }

  return { headlines, cooldownSecondsRemaining: null, quotaExceeded };
}
