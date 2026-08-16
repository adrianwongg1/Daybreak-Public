"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getNextStepHref } from "@/app/onboarding/steps";
import { usePreferences } from "@/app/lib/preferences/context";
import type { OnboardingStepId } from "@/app/lib/preferences/types";

// Lets one step screen serve two contexts: first-run onboarding ("Continue"
// -> the next step) and revisiting from Settings via ?from=settings ("Save"
// -> back to Settings). No resumable state machine, just a query flag.
export function useStepNav(stepId: OnboardingStepId) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeStep } = usePreferences();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = searchParams.get("from") === "settings";

  // `persist` is the Server Action call for this step (see
  // app/lib/onboarding/actions.ts) — local/mock state (completeStep) and
  // navigation only happen once the real Supabase write succeeds, so the
  // wizard never advances past a step it failed to save.
  async function submitStep(persist: () => Promise<void>): Promise<void> {
    setError(null);
    setIsSubmitting(true);
    try {
      await persist();
      completeStep(stepId);
      router.push(isEditing ? "/settings" : getNextStepHref(stepId));
      // The nav shell (NavShell's userName) is a separate Server Component
      // fetch under the (shell) layout — a plain router.push reuses Next's
      // cached copy of it, so e.g. editing your name from Settings landed
      // back on Settings with the new name in the form but the old one
      // still showing in the nav until the next hard navigation. Force it
      // to refetch too.
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") {
        router.push("/login");
        return;
      }
      setError("Couldn't save that — check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    isEditing,
    buttonLabel: isEditing ? "Save" : "Continue",
    submitStep,
    isSubmitting,
    error,
  };
}
