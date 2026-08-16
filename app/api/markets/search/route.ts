import { NextRequest, NextResponse } from "next/server";
import { searchTickers } from "@/app/lib/briefing/sources/market";
import { getCurrentUserId } from "@/app/lib/supabase/current-user";

// Backs the Today page's "add a ticker" autocomplete dropdown — same auth
// gating as /api/weather/suggest, for the same reason (not sensitive data,
// just keeps this from sitting as an open proxy onto Finnhub).
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

  const suggestions = await searchTickers(q);
  return NextResponse.json({ suggestions });
}
