"use client";

import Link from "next/link";
import { useState } from "react";
import { isValidTimeZone } from "@/app/lib/briefing/date";
import { usePreferences } from "@/app/lib/preferences/context";
import { useStepNav } from "@/app/onboarding/use-step-nav";
import { getPrevStepHref } from "@/app/onboarding/steps";
import { saveScheduleStep } from "@/app/lib/onboarding/actions";

export default function ScheduleStepPage() {
  const { preferences, updatePreferences, isHydrated } = usePreferences();
  const { isEditing, buttonLabel, submitStep, isSubmitting, error } = useStepNav("schedule");
  const { schedule } = preferences;
  const prevHref = getPrevStepHref("schedule");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValidTimeZone(schedule.timezone)) {
      setValidationError('Enter a real timezone name, like "America/Los_Angeles".');
      return;
    }
    setValidationError(null);
    submitStep(() => saveScheduleStep(schedule));
  }

  return (
    <form style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }} onSubmit={handleSubmit}>
      <div>
        <h2 style={{ margin: "0 0 8px" }}>Set your briefing schedule</h2>
        <p style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 70%, transparent)", margin: "0 0 20px" }}>
          Pick when it lands on weekdays, and optionally a separate weekend time.
        </p>
      </div>

      <div className="field">
        <label>Weekday time</label>
        <input
          type="time"
          required
          value={schedule.weekdayTime}
          onChange={(event) => updatePreferences({ schedule: { ...schedule, weekdayTime: event.target.value } })}
          className="input"
          disabled={!isHydrated}
        />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <input
          type="checkbox"
          checked={schedule.weekendEnabled}
          onChange={(event) => updatePreferences({ schedule: { ...schedule, weekendEnabled: event.target.checked } })}
          disabled={!isHydrated}
        />
        Different time on weekends
      </label>

      {schedule.weekendEnabled ? (
        <div className="field">
          <label>Weekend time</label>
          <input
            type="time"
            required
            value={schedule.weekendTime}
            onChange={(event) => updatePreferences({ schedule: { ...schedule, weekendTime: event.target.value } })}
            className="input"
            disabled={!isHydrated}
          />
        </div>
      ) : null}

      <div className="field">
        <label>Timezone</label>
        <input
          type="text"
          required
          value={schedule.timezone}
          onChange={(event) => updatePreferences({ schedule: { ...schedule, timezone: event.target.value } })}
          className="input"
          disabled={!isHydrated}
        />
        <span className="text-muted" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
          Detected automatically — adjust if this isn&apos;t right.
        </span>
      </div>

      {validationError ? <p style={{ color: "var(--color-danger)", fontSize: 13 }}>{validationError}</p> : null}
      {error ? <p style={{ color: "var(--color-danger)", fontSize: 13 }}>{error}</p> : null}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        {!isEditing && prevHref ? (
          <Link href={prevHref} className="btn btn-secondary">
            Back
          </Link>
        ) : (
          <span />
        )}
        <button type="submit" className="btn btn-primary" disabled={!isHydrated || isSubmitting}>
          {isSubmitting ? "Saving…" : buttonLabel}
        </button>
      </div>
    </form>
  );
}
