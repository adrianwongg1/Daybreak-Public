import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Lightweight liveness/readiness check. It intentionally verifies neither users nor provider integrations. */
export async function GET() {
  try {
    const { error } = await getSupabaseServiceClient().from("users").select("id").limit(1);
    if (error) throw error;

    return NextResponse.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    console.error(JSON.stringify({ event: "health.check", status: "unavailable", dependency: "database" }));
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
