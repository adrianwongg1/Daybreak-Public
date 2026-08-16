"use client";

import Link from "next/link";
import { useState } from "react";
import { usePreferences } from "@/app/lib/preferences/context";
import { useStepNav } from "@/app/onboarding/use-step-nav";
import { getPrevStepHref } from "@/app/onboarding/steps";
import { saveNameStep } from "@/app/lib/onboarding/actions";

export default function NameStepPage() {
  const { preferences, updatePreferences, isHydrated } = usePreferences();
  const { isEditing, buttonLabel, submitStep, isSubmitting, error } = useStepNav("name");
  const prevHref = getPrevStepHref("name");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = preferences.displayName.trim();
    if (!trimmed) {
      setValidationError("Tell us what to call you.");
      return;
    }
    setValidationError(null);
    submitStep(() => saveNameStep(trimmed));
  }

  return (
    <form style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }} onSubmit={handleSubmit}>
      <div>
        <h2 style={{ margin: "0 0 8px" }}>What should we call you?</h2>
        <p style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 70%, transparent)", margin: "0 0 20px" }}>
          Used for your greeting and to personalize your account.
        </p>
      </div>

      <div className="field">
        <label>Your name</label>
        <input
          type="text"
          required
          autoFocus
          value={preferences.displayName}
          onChange={(event) => updatePreferences({ displayName: event.target.value })}
          className="input"
          disabled={!isHydrated}
        />
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
