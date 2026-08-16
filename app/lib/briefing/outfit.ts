import type { OutfitSuggestion } from "@/app/lib/briefing/types";

export interface OutfitInputs {
  tempHighF: number;
  tempLowF: number;
  precipitationProbabilityPct: number;
  windSpeedMph: number;
  coldTolerance: string;
  stylePreference: string;
}

// Shifts the effective temperature band by the user's self-reported cold
// tolerance (PRD 7.1 onboarding step 4) rather than changing the bands
// themselves.
function toleranceAdjustmentF(coldTolerance: string): number {
  if (coldTolerance === "Runs cold") return -5;
  if (coldTolerance === "Runs warm") return 5;
  return 0;
}

function baseGarment(effectiveTempF: number, stylePreference: string): string {
  const layer =
    stylePreference === "Formal"
      ? "Suit"
      : stylePreference === "Business casual"
        ? "Blazer"
        : stylePreference === "Athletic"
          ? "Performance layer"
          : "Jacket";

  if (effectiveTempF < 32) return "Heavy coat, hat, and gloves";
  if (effectiveTempF < 45) return "Warm coat";
  if (effectiveTempF < 55) return layer;
  if (effectiveTempF < 65) return `Light ${layer.toLowerCase()} or sweater`;
  if (effectiveTempF < 75) return "Light layer";
  if (effectiveTempF < 85) return stylePreference === "Formal" ? "Lightweight suit" : "T-shirt weather";
  return "Light, breathable clothing";
}

/** PRD 7.2's "rule engine (temperature band + precipitation + wind → outfit category)". */
export function computeOutfitSuggestion(inputs: OutfitInputs): OutfitSuggestion {
  const adjustment = toleranceAdjustmentF(inputs.coldTolerance);
  const effectiveHigh = inputs.tempHighF + adjustment;
  const effectiveLow = inputs.tempLowF + adjustment;

  const notes: string[] = [];
  if (inputs.precipitationProbabilityPct >= 40) notes.push("bring a rain jacket");
  if (inputs.windSpeedMph >= 20) notes.push("windy, so something wind-resistant helps");
  if (effectiveHigh - effectiveLow >= 12) notes.push("cool start, warms up by afternoon");

  const garment = baseGarment(effectiveHigh, inputs.stylePreference);
  const summary = notes.length > 0 ? `${garment} — ${notes.join(", ")}.` : `${garment}.`;
  return { summary };
}
