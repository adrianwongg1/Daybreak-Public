"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/app/lib/preferences/context";
import { completeOnboarding } from "@/app/lib/onboarding/actions";

function formatTime12h(time24: string): string {
  const [hoursStr, minutes] = time24.split(":");
  const hours = Number(hoursStr);
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hours12}:${minutes} ${period}`;
}

export default function DoneStepPage() {
  const router = useRouter();
  const { preferences, markOnboardingComplete, isHydrated } = usePreferences();
  const [saveError, setSaveError] = useState(false);
  // /today's requireCompletedSession() redirects back into the wizard until
  // onboarding_completed_at is set, so "Go to Today" can't go live until
  // that write is confirmed — otherwise an early click bounces the user
  // right back here instead of landing on /today.
  const [saved, setSaved] = useState(false);

  // Best-effort matters less here than every other step: this is the write
  // that actually makes the user eligible for tomorrow's scheduled briefing
  // (PRD 7.2's "who's due now" query reads onboarding_completed_at), so a
  // failure gets a visible retry rather than a silent console.error.
  const persist = useCallback(async () => {
    setSaveError(false);
    try {
      await completeOnboarding();
      setSaved(true);
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") {
        router.push("/login");
        return;
      }
      setSaveError(true);
    }
  }, [router]);

  useEffect(() => {
    if (!isHydrated) return;
    markOnboardingComplete();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-mount completion call (mirrors the hydration effect in app/lib/preferences/context.tsx), not a derived-state cascade
    persist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, markOnboardingComplete]);

  return (
    <div style={{ width: "100%" }}>
      <h2 style={{ margin: "0 0 8px" }}>You&apos;re all set</h2>
      <p style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 70%, transparent)", margin: "0 0 32px" }}>
        Your first briefing arrives at {formatTime12h(preferences.schedule.weekdayTime)} tomorrow. You can revisit any
        of these steps later from Settings.
      </p>

      {saveError ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: "var(--color-danger)" }}>
            Couldn&apos;t confirm that with the server — you may not be scheduled for tomorrow&apos;s briefing yet.
          </p>
          <button type="button" onClick={persist} className="btn btn-secondary" style={{ alignSelf: "flex-start" }}>
            Retry
          </button>
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {saved ? (
          <Link href="/today" className="btn btn-primary">
            Go to Today
          </Link>
        ) : (
          <button type="button" className="btn btn-primary" disabled aria-busy="true">
            Go to Today
          </button>
        )}
      </div>
    </div>
  );
}
