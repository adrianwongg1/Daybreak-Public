"use server";

import { todayInTimeZone } from "@/app/lib/briefing/date";
import { fetchMarketSummary, fetchQuote, isSupportedTickerSymbol } from "@/app/lib/briefing/sources/market";
import type { MarketQuote } from "@/app/lib/briefing/types";
import { getCurrentUserId } from "@/app/lib/supabase/current-user";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";
import type { Json } from "@/app/lib/supabase/database.types";

export interface AddTickerResult {
  quote: MarketQuote | null;
  alreadyAdded: boolean;
}

/** Refreshes only the Markets section after the page has rendered. */
export async function refreshMarketsAction(): Promise<MarketQuote[] | null> {
  const userId = await getCurrentUserId();
  const supabase = getSupabaseServiceClient();
  const [{ data: user, error: userError }, { data: preferences, error: preferencesError }] = await Promise.all([
    supabase.from("users").select("timezone").eq("id", userId).single(),
    supabase.from("preferences").select("market_tickers").eq("user_id", userId).maybeSingle(),
  ]);
  if (userError || !user || preferencesError) throw new Error("Couldn't load market preferences");

  const quotes = await fetchMarketSummary(preferences?.market_tickers ?? []);
  if (quotes) {
    const { error } = await supabase
      .from("briefings")
      .update({ market_json: quotes as unknown as Json })
      .eq("user_id", userId)
      .eq("date", todayInTimeZone(user.timezone));
    if (error) throw new Error("Couldn't save refreshed markets");
  }
  return quotes;
}

/**
 * Adds a ticker to `preferences.market_tickers` (deduped, case-insensitive)
 * so it's included in every future daily briefing, and returns a live quote
 * so the Today page can show it immediately — the stored `briefings` row
 * itself doesn't get touched, so this ticker only appears in tomorrow's
 * generated snapshot, not today's; until then, the Today page merges this
 * live quote in on top of what's already stored (see market-section.tsx).
 */
export async function addMarketTickerAction(symbol: string, name: string): Promise<AddTickerResult> {
  const userId = await getCurrentUserId();
  const supabase = getSupabaseServiceClient();

  const ticker = symbol.trim().toUpperCase();
  if (!isSupportedTickerSymbol(ticker)) throw new Error("Invalid ticker");

  const { data: preferences, error: readError } = await supabase
    .from("preferences")
    .select("market_tickers")
    .eq("user_id", userId)
    .single();
  if (readError || !preferences) throw new Error("Couldn't load preferences");

  const alreadyAdded = preferences.market_tickers.some((t) => t.toUpperCase() === ticker);
  if (!alreadyAdded) {
    const { error: writeError } = await supabase
      .from("preferences")
      .update({ market_tickers: [...preferences.market_tickers, ticker] })
      .eq("user_id", userId);
    if (writeError) throw new Error("Couldn't save ticker");
  }

  const quote = await fetchQuote(ticker, name);
  return { quote, alreadyAdded };
}

/**
 * Overwrites `preferences.market_tickers` with `tickers` verbatim — backs
 * the Today page's edit mode for both reordering (move up/down) and
 * removing a ticker, since both are really the same operation: "here is
 * the new full ordered list, persist it." Takes the whole list rather than
 * a single move/remove so the caller's local state (already reordered) is
 * the single source of truth, with nothing to reconcile server-side.
 */
export async function setMarketTickerOrderAction(tickers: string[]): Promise<void> {
  const userId = await getCurrentUserId();
  const supabase = getSupabaseServiceClient();

  const normalized = tickers
    .map((ticker) => ticker.trim().toUpperCase())
    .filter((ticker) => Boolean(ticker) && isSupportedTickerSymbol(ticker))
    .filter((ticker, index, list) => list.indexOf(ticker) === index);

  const { error } = await supabase.from("preferences").update({ market_tickers: normalized }).eq("user_id", userId);
  if (error) throw new Error("Couldn't save ticker order");
}
