import { SectionOrderEditor } from "@/app/(shell)/settings/section-order-editor";
import { SettingsPreferences } from "@/app/(shell)/settings/settings-preferences";
import { signOutAction } from "@/app/lib/auth-actions";
import { preferencesFromRows } from "@/app/lib/preferences/from-db";
import { ServerPreferencesHydrator } from "@/app/lib/preferences/server-hydrator";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";
import { parseSectionOrder } from "@/app/lib/today-sections";
import { requireCompletedSession } from "@/app/lib/auth/require-completed-session";

export default async function SettingsPage() {
  const { session, userId } = await requireCompletedSession();

  let hydrateWith = null;
  let sectionOrder = parseSectionOrder(null);
  if (userId) {
    const supabase = getSupabaseServiceClient();
    const [userRow, preferencesRow] = await Promise.all([
      supabase
        .from("users")
        .select("briefing_time_weekday, briefing_time_weekend, timezone, home_location, display_name")
        .eq("id", userId)
        .single(),
      supabase
        .from("preferences")
        .select("news_topics, market_tickers, style_preference, cold_tolerance, section_order")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    // Unconditional (unlike the onboarding wizard's gated hydration) — this
    // is Settings, a plain display+edit page, not a multi-step first-run
    // flow with defaults worth protecting. Showing the account's real
    // current state (with sensible per-field fallbacks for anything never
    // set) is always correct here, on any device.
    if (userRow.data) hydrateWith = preferencesFromRows(userRow.data, preferencesRow.data);
    sectionOrder = parseSectionOrder(preferencesRow.data?.section_order);
  }

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h6 style={{ margin: "0 0 8px", color: "var(--color-accent-700)" }}>Preferences</h6>
        <h1 style={{ margin: 0 }}>Settings</h1>
      </header>

      {hydrateWith ? <ServerPreferencesHydrator preferences={hydrateWith} /> : null}
      <SettingsPreferences />

      <hr className="hr" style={{ margin: "28px 0" }} />

      <h3 style={{ margin: "0 0 14px" }}>Today page sections</h3>
      <SectionOrderEditor initialOrder={sectionOrder} />

      <hr className="hr" style={{ margin: "28px 0" }} />

      <h3 style={{ margin: "0 0 14px" }}>Account</h3>
      <p style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginBottom: 14 }}>
        Signed in as {session?.user?.email ?? "unknown"}
      </p>
      <form action={signOutAction}>
        <button type="submit" className="btn btn-secondary">
          Sign out
        </button>
      </form>
    </div>
  );
}
