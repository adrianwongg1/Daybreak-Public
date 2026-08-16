import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredOperationalData, purgeOldBriefings } from "@/app/lib/briefing/purge";

// PRD 7.4: unpinned briefings older than 30 days are auto-purged. Called
// once a day by .github/workflows/briefing-purge.yml — same CRON_SECRET
// bearer-token gate as /api/briefing/cron/route.ts, and for the same
// reason: there's no signed-in user behind a cron trigger, and an
// unguarded delete endpoint would let anyone who found the URL wipe every
// user's briefing history on demand.
//
// Manual test once CRON_SECRET is set:
//   curl -X POST http://localhost:3000/api/briefing/purge -H "Authorization: Bearer $CRON_SECRET"
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [briefings, operational] = await Promise.all([purgeOldBriefings(), purgeExpiredOperationalData()]);
  return NextResponse.json({ purged: { ...operational, briefings } });
}
