"use client";

import Link from "next/link";
import { ChipPicker } from "@/app/components/chip-picker";
import { MarketTickerAutocomplete } from "@/app/components/market-ticker-autocomplete";
import { usePreferences } from "@/app/lib/preferences/context";
import { NEWS_TOPIC_OPTIONS } from "@/app/lib/preferences/types";
import { useStepNav } from "@/app/onboarding/use-step-nav";
import { getPrevStepHref } from "@/app/onboarding/steps";
import { saveTopicsStep } from "@/app/lib/onboarding/actions";

export default function TopicsStepPage() {
  const { preferences, updatePreferences, isHydrated } = usePreferences();
  const { isEditing, buttonLabel, submitStep, isSubmitting, error } = useStepNav("topics");
  const prevHref = getPrevStepHref("topics");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    submitStep(() => saveTopicsStep(preferences.newsTopics, preferences.marketTickers));
  }

  return (
    <form style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }} onSubmit={handleSubmit}>
      <div>
        <h2 style={{ margin: "0 0 8px" }}>News topics &amp; tickers</h2>
        <p style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 70%, transparent)", margin: "0 0 20px" }}>
          Pick what you want covered in your news and market summary.
        </p>
      </div>

      <div>
        <label style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 65%, transparent)", display: "block", marginBottom: 8 }}>
          Topics
        </label>
        {isHydrated ? (
          <ChipPicker
            values={preferences.newsTopics}
            onAdd={(topic) => updatePreferences({ newsTopics: [...preferences.newsTopics, topic] })}
            onRemove={(topic) => updatePreferences({ newsTopics: preferences.newsTopics.filter((t) => t !== topic) })}
            catalog={NEWS_TOPIC_OPTIONS}
            addLabel="+ Add topic"
            searchPlaceholder="Search or type a topic"
          />
        ) : null}
      </div>

      <div>
        <label style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 65%, transparent)", display: "block", marginBottom: 8 }}>
          Market tickers
        </label>
        {isHydrated ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {preferences.marketTickers.map((ticker) => (
                <span key={ticker} className="tag tag-outline" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {ticker}
                  <button
                    type="button"
                    onClick={() => updatePreferences({ marketTickers: preferences.marketTickers.filter((item) => item !== ticker) })}
                    aria-label={`Remove ${ticker}`}
                    style={{ display: "inline-flex", background: "none", border: "none", padding: 0, color: "inherit", cursor: "pointer" }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <MarketTickerAutocomplete
              onSelect={(suggestion) => {
                const next = preferences.marketTickers.some((item) => item.toUpperCase() === suggestion.symbol.toUpperCase())
                  ? preferences.marketTickers
                  : [...preferences.marketTickers, suggestion.symbol.toUpperCase()];
                updatePreferences({ marketTickers: next });
              }}
            />
            <p style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 65%, transparent)", margin: 0 }}>
              Choose a ticker from the dropdown so only valid symbols are saved.
            </p>
          </div>
        ) : null}
      </div>

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
