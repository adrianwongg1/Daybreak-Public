import { NextResponse } from "next/server";
import { EARLIEST_APP_DATE } from "@/app/lib/briefing/date";
import { getBriefingForDate } from "@/app/lib/briefing/read";
import { getCurrentUserId } from "@/app/lib/supabase/current-user";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Plain calendar-date arithmetic (no timezone conversion needed — these are already local calendar dates). */
function addDays(dateIso: string, delta: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

// Currently unused by any page — this backed the original app's Calendar
// tab Day Detail modal, which this fork dropped along with Google Calendar
// entirely. Left in place (and getBriefingForDate/[date] read path stays
// live) since a "browse past days' weather/news" feature would be a natural,
// much simpler v2 addition and this route is cheap to revive for it.
export async function GET(_request: Request, { params }: { params: Promise<{ date: string }> }) {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { date } = await params;
  if (!DATE_PATTERN.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const [briefing, homeLocationRow] = await Promise.all([
    getBriefingForDate(userId, date),
    getSupabaseServiceClient().from("users").select("home_location").eq("id", userId).single(),
  ]);
  const homeLocation = homeLocationRow.data?.home_location ?? null;
  const prevDate = date > EARLIEST_APP_DATE ? addDays(date, -1) : null;
  const nextDate = addDays(date, 1);

  return NextResponse.json({ date, briefing, prevDate, nextDate, homeLocation });
}
