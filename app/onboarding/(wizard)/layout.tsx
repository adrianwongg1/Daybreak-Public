import { Suspense } from "react";
import { createClient } from "@/app/lib/supabase/auth-server";
import { OnboardingProgress } from "@/app/onboarding/onboarding-progress";
import { preferencesFromRows } from "@/app/lib/preferences/from-db";
import { ServerPreferencesHydrator } from "@/app/lib/preferences/server-hydrator";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";

// Both OnboardingProgress and every step page read the `from=settings` query
// flag via useSearchParams(), which Next.js requires a Suspense boundary for
// in production static builds — wrapping once here covers all of them.
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getUser();
  const userId = authData.user?.id;
  let hydrateWith = null;

  if (userId) {
    const supabase = getSupabaseServiceClient();
    const { data: user } = await supabase
      .from("users")
      .select("briefing_time_weekday, briefing_time_weekend, timezone, home_location, display_name, onboarding_last_step")
      .eq("id", userId)
      .single();

    // Only trust the DB over local state once this account has actually
    // saved a real onboarding step before (onboarding_last_step is set).
    // A genuinely first-time user has no real data to trust yet — their
    // preferences row is still all empty-array/null defaults, and
    // hydrating from that would stomp the wizard's own nice touches
    // (pre-checked topic/ticker defaults, the browser's auto-detected
    // timezone) with an empty/UTC state.
    if (user?.onboarding_last_step) {
      const { data: preferences } = await supabase
        .from("preferences")
        .select("news_topics, market_tickers, style_preference, cold_tolerance")
        .eq("user_id", userId)
        .maybeSingle();
      hydrateWith = preferencesFromRows(user, preferences);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "56px 24px" }}>
      {hydrateWith ? <ServerPreferencesHydrator preferences={hydrateWith} /> : null}
      <div style={{ width: "100%", maxWidth: 560 }}>
        <Suspense fallback={<div style={{ height: 2, background: "var(--color-divider)", margin: "16px 0 40px" }} />}>
          <OnboardingProgress />
        </Suspense>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
          <Suspense fallback={null}>{children}</Suspense>
        </div>
      </div>
    </div>
  );
}
