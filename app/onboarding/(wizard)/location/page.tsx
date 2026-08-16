"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LocationAutocomplete } from "@/app/components/location-autocomplete";
import { usePreferences } from "@/app/lib/preferences/context";
import { COLD_TOLERANCE_OPTIONS, OUTFIT_STYLE_OPTIONS } from "@/app/lib/preferences/types";
import { useStepNav } from "@/app/onboarding/use-step-nav";
import { getPrevStepHref } from "@/app/onboarding/steps";
import { saveLocationStep } from "@/app/lib/onboarding/actions";

export default function LocationStepPage() {
  const { preferences, updatePreferences, isHydrated } = usePreferences();
  const { isEditing, buttonLabel, submitStep, isSubmitting, error } = useStepNav("location");
  const prevHref = getPrevStepHref("location");
  const [selectedLocation, setSelectedLocation] = useState(preferences.homeLocation);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the selected location in sync with the shared preferences state after hydration or a parent update
    setSelectedLocation(preferences.homeLocation);
  }, [preferences.homeLocation]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedLocation.trim()) {
      setValidationError("Choose a city from the suggestions.");
      return;
    }
    setValidationError(null);
    updatePreferences({ homeLocation: selectedLocation });
    submitStep(() => saveLocationStep(selectedLocation, preferences.outfitStyle, preferences.coldTolerance));
  }

  return (
    <form style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }} onSubmit={handleSubmit}>
      <div>
        <h2 style={{ margin: "0 0 8px" }}>Home location &amp; outfit style</h2>
        <p style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 70%, transparent)", margin: "0 0 20px" }}>
          Used for weather and the outfit suggestion.
        </p>
      </div>

      <div className="field">
        <label>Home location</label>
        <LocationAutocomplete
          placeholder="City, State/Country"
          initialValue={selectedLocation}
          disabled={!isHydrated}
          onSelect={(displayName) => {
            setSelectedLocation(displayName);
            updatePreferences({ homeLocation: displayName });
          }}
        />
        <p style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 65%, transparent)", marginTop: 6 }}>
          Start typing and choose a city from the dropdown.
        </p>
      </div>

      <div className="field">
        <label id="cold-label">Cold tolerance</label>
        <div className="seg" role="radiogroup" aria-labelledby="cold-label">
          {COLD_TOLERANCE_OPTIONS.map((option) => (
            <label key={option} className="seg-opt">
              <input
                type="radio"
                name="cold"
                checked={preferences.coldTolerance === option}
                onChange={() => updatePreferences({ coldTolerance: option })}
                disabled={!isHydrated}
              />
              {option}
            </label>
          ))}
        </div>
      </div>

      <div className="field" role="radiogroup" aria-label="Style preference">
        <label>Style preference</label>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {OUTFIT_STYLE_OPTIONS.map((option) => (
            <label key={option} className="radio">
              <input
                type="radio"
                name="style"
                checked={preferences.outfitStyle === option}
                onChange={() => updatePreferences({ outfitStyle: option })}
                disabled={!isHydrated}
              />
              <span className="dot" />
              {option}
            </label>
          ))}
        </div>
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
