import { NextRequest, NextResponse } from "next/server";
import { suggestCities } from "@/app/lib/briefing/sources/weather";
import { getCurrentUserId } from "@/app/lib/supabase/current-user";

// Backs the Today page's "check another city" autocomplete dropdown — fired
// on every debounced keystroke from app/(shell)/today/city-weather-search.tsx.
// Same auth gating as /api/weather/search, for the same reason (not sensitive
// data, just keeps this from sitting as an open proxy onto Open-Meteo).
export async function GET(request: NextRequest) {
  try {
    await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = await suggestCities(q);
  return NextResponse.json({ suggestions });
}
