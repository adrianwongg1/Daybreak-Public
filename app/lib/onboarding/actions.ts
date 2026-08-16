"use server";

import { isValidTimeZone } from "@/app/lib/briefing/date";
import { isSupportedTickerSymbol } from "@/app/lib/briefing/sources/market";
import { NEWS_TOPIC_OPTIONS, type BriefingSchedule, type OnboardingStepId } from "@/app/lib/preferences/types";
import { getCurrentUserId } from "@/app/lib/supabase/current-user";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";

// A `users` + `preferences` row is guaranteed to exist by the time any of
// these run (created at sign-in — see auth.ts's jwt callback), so every
// write here is a plain UPDATE, never an upsert. That sidesteps any
// ambiguity about whether a partial-column upsert would clobber sibling
// columns it didn't mention.

async function setOnboardingStep(userId: string, step: OnboardingStepId): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from("users")
    .update({ onboarding_last_step: step })
    .eq("id", userId);
  if (error) throw error;
}

export async function saveNameStep(displayName: string): Promise<void> {
  const userId = await getCurrentUserId();
  const supabase = getSupabaseServiceClient();
  const normalized = displayName.trim();
  if (!normalized) throw new Error("Name is required");

  const { error } = await supabase
    .from("users")
    .update({ display_name: normalized, onboarding_last_step: "name" })
    .eq("id", userId);
  if (error) throw error;
}

export async function saveScheduleStep(schedule: BriefingSchedule): Promise<void> {
  const userId = await getCurrentUserId();
  const supabase = getSupabaseServiceClient();

  // The timezone field is free text ("adjust if this isn't right") — a
  // typo like "Los Angeles" instead of "America/Los_Angeles" isn't just a
  // cosmetic wrong value, it's an invalid IANA zone that crashes every
  // Intl.DateTimeFormat call downstream (this account's own Today page,
  // and the cron batch that iterates every due user in one pass). Reject
  // it here rather than saving it — this is the only place `timezone` is
  // ever written.
  if (!isValidTimeZone(schedule.timezone)) {
    throw new Error("Invalid timezone");
  }

  const { error } = await supabase
    .from("users")
    .update({
      briefing_time_weekday: schedule.weekdayTime,
      briefing_time_weekend: schedule.weekendEnabled ? schedule.weekendTime : null,
      timezone: schedule.timezone,
      onboarding_last_step: "schedule",
    })
    .eq("id", userId);
  if (error) throw error;
}

export async function saveTopicsStep(newsTopics: string[], marketTickers: string[]): Promise<void> {
  const userId = await getCurrentUserId();
  const supabase = getSupabaseServiceClient();

  const normalizedTopics = [...new Set(newsTopics.map((topic) => topic.trim()).filter((topic) => NEWS_TOPIC_OPTIONS.includes(topic as (typeof NEWS_TOPIC_OPTIONS)[number])))]
  const normalizedTickers = [...new Set(marketTickers.map((ticker) => ticker.trim().toUpperCase()).filter((ticker) => isSupportedTickerSymbol(ticker)))];

  const { error } = await supabase
    .from("preferences")
    .update({ news_topics: normalizedTopics, market_tickers: normalizedTickers })
    .eq("user_id", userId);
  if (error) throw error;

  await setOnboardingStep(userId, "topics");
}

export async function saveLocationStep(
  homeLocation: string,
  outfitStyle: string,
  coldTolerance: string
): Promise<void> {
  const userId = await getCurrentUserId();
  const supabase = getSupabaseServiceClient();
  const normalizedLocation = homeLocation.trim();

  const { error: userError } = await supabase
    .from("users")
    .update({ home_location: normalizedLocation || null, onboarding_last_step: "location" })
    .eq("id", userId);
  if (userError) throw userError;

  const { error: prefError } = await supabase
    .from("preferences")
    .update({ style_preference: outfitStyle, cold_tolerance: coldTolerance })
    .eq("user_id", userId);
  if (prefError) throw prefError;
}

export async function completeOnboarding(): Promise<void> {
  const userId = await getCurrentUserId();
  const supabase = getSupabaseServiceClient();

  const { error } = await supabase
    .from("users")
    .update({ onboarding_completed_at: new Date().toISOString(), onboarding_last_step: "done" })
    .eq("id", userId);
  if (error) throw error;
}
