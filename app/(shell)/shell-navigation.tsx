import { NavShell } from "@/app/components/nav-shell";
import { requireCompletedSession } from "@/app/lib/auth/require-completed-session";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";
import { parseSectionOrder } from "@/app/lib/today-sections";

/** Fetches personal navigation details without holding up the page skeleton. */
export async function ShellNavigation() {
  const { session, userId } = await requireCompletedSession();

  const supabase = getSupabaseServiceClient();
  const { data: preferences } = await supabase.from("preferences").select("section_order").eq("user_id", userId).maybeSingle();

  return <NavShell userName={session?.user?.email ?? "Account"} sectionOrder={parseSectionOrder(preferences?.section_order)} />;
}
