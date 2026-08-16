"use client";

import { useEffect, useRef } from "react";
import { usePreferences } from "@/app/lib/preferences/context";
import type { DaybreakPreferences } from "@/app/lib/preferences/types";

/**
 * One-time correction: overwrites the localStorage-backed preferences
 * context with real values fetched server-side from Supabase. Fixes a real
 * data-loss bug — localStorage is per-browser, not per-account, so signing
 * in on a new device (or after a cleared cache) showed default topics/
 * tickers instead of the account's real saved ones, and resubmitting a
 * step in that state overwrote the real Supabase values with those
 * defaults. See app/onboarding/layout.tsx and app/(shell)/settings/page.tsx
 * for the two call sites and app/lib/preferences/from-db.ts for how the
 * server values are computed.
 *
 * Runs once per mount (a `key`/remount at the call site is what triggers a
 * fresh hydration, e.g. Settings remounting on every visit), and only
 * after the provider's own localStorage read finishes, so this write
 * always wins over whatever localStorage had.
 */
export function ServerPreferencesHydrator({ preferences }: { preferences: DaybreakPreferences }) {
  const { isHydrated, hydrateFromServer } = usePreferences();
  const didHydrate = useRef(false);

  useEffect(() => {
    if (!isHydrated || didHydrate.current) return;
    didHydrate.current = true;
    hydrateFromServer(preferences);
  }, [isHydrated, preferences, hydrateFromServer]);

  return null;
}
