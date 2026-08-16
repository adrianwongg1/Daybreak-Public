import type { OnboardingStepId } from "@/app/lib/preferences/types";

export interface OnboardingStepConfig {
  id: OnboardingStepId;
  href: string;
  label: string;
  percent: number;
}

// Single source of truth for onboarding sequencing (PRD 7.1) — every step's
// href, label, and progress-bar percent lives here once. Sign-in
// ("/onboarding/provider") is deliberately not included — it's a
// standalone page outside the wizard's layout/progress bar, not step 1 of
// it (see app/onboarding/provider/page.tsx).
export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  { id: "name", href: "/onboarding/name", label: "Your name", percent: 20 },
  { id: "schedule", href: "/onboarding/schedule", label: "Briefing schedule", percent: 40 },
  { id: "topics", href: "/onboarding/topics", label: "Topics & tickers", percent: 60 },
  { id: "location", href: "/onboarding/location", label: "Location & outfit", percent: 80 },
  { id: "done", href: "/onboarding/done", label: "Done", percent: 100 },
];

function stepAfter(id: OnboardingStepId): OnboardingStepConfig {
  const index = ONBOARDING_STEPS.findIndex((step) => step.id === id);
  return ONBOARDING_STEPS[index + 1] ?? ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1];
}

export function getNextStepHref(currentStepId: OnboardingStepId): string {
  return stepAfter(currentStepId).href;
}

/** null on the first step — nothing to go back to. */
export function getPrevStepHref(currentStepId: OnboardingStepId): string | null {
  const index = ONBOARDING_STEPS.findIndex((step) => step.id === currentStepId);
  return index > 0 ? ONBOARDING_STEPS[index - 1].href : null;
}

// Where a signed-in user should resume: the step after the last one they
// completed, or the first real wizard step ("schedule") if they haven't
// started it yet.
export function getResumeHref(lastCompletedStep: OnboardingStepId | null): string {
  if (!lastCompletedStep) return ONBOARDING_STEPS[0].href;
  return stepAfter(lastCompletedStep).href;
}
