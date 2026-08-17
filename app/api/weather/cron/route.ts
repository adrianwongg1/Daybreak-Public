import { NextRequest, NextResponse } from "next/server";
import { refreshAllUsersWeather } from "@/app/lib/weather/cron";

export const maxDuration = 60;

// Hourly entry point called by the GitHub Actions workflow in
// .github/workflows/weather-cron.yml — same shared-secret gate as
// /api/briefing/cron (app/api/briefing/cron/route.ts), since there's no
// signed-in user behind this call either.
//
// Manual test once CRON_SECRET is set:
//   curl -X POST http://localhost:3000/api/weather/cron -H "Authorization: Bearer $CRON_SECRET"
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshAllUsersWeather();
  return NextResponse.json(result);
}
