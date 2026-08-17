import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/app/lib/supabase/auth-server";
import { getResumeHref } from "@/app/onboarding/steps";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";
import type { OnboardingStepId } from "@/app/lib/preferences/types";

/**
 * Enforces the shell's original authentication and onboarding boundary from
 * a page (or a suspended shell component), without making the layout itself
 * wait before it can stream a loading skeleton.
 *
 * Wrapped in React's `cache()` so the shell nav and the page it wraps share
 * one Auth + DB round trip per request instead of each paying for their own.
 */
export const requireCompletedSession = cache(async function requireCompletedSession() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");

  const userId = data.user.id;
  const { data: user } = await getSupabaseServiceClient()
    .from("users")
    .select("display_name, onboarding_completed_at, onboarding_last_step, timezone, home_location")
    .eq("id", userId)
    .single();

  if (!user?.onboarding_completed_at) {
    redirect(getResumeHref((user?.onboarding_last_step as OnboardingStepId | null) ?? null));
  }

  return {
    session: { user: data.user },
    userId,
    displayName: user?.display_name ?? null,
    timezone: user?.timezone ?? "UTC",
    homeLocation: user?.home_location ?? null,
  };
});
