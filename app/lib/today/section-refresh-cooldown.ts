"use client";

// Matches market.ts's QUOTE_CACHE_FRESHNESS_MS — no reason for the client-side
// cooldown that gates *triggering* a background refresh to be shorter than the
// server-side cache window that would make a same-window refresh a no-op anyway.
const COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Background section refreshes (weather, markets) are meant to run once
 * after the stored briefing renders, not every time Today remounts — e.g.
 * every time a user switches away to Calendar and back. sessionStorage
 * survives that remount (unlike component state) while still resetting per
 * tab/session, so returns true at most once per COOLDOWN_MS per `key`.
 */
export function shouldRunBackgroundRefresh(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const storageKey = `daybreak:bg-refresh:${key}`;
    const last = Number(window.sessionStorage.getItem(storageKey) ?? 0);
    if (Date.now() - last < COOLDOWN_MS) return false;
    window.sessionStorage.setItem(storageKey, String(Date.now()));
    return true;
  } catch {
    // Private browsing or storage disabled — fall back to the old always-run behavior.
    return true;
  }
}
