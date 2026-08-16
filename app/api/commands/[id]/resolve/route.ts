import { NextRequest, NextResponse } from "next/server";
import { resolveCommand } from "@/app/lib/commands/execute";
import { getCurrentUserId } from "@/app/lib/supabase/current-user";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";

// Completes a "pending" command after the user picks one option from the
// command bar's disambiguation picker (PRD 7.3's ambiguous-match
// acceptance criterion) — a single follow-up click, not a text reply, so
// this stays within PRD 3's "single-shot" non-goal (no multi-turn command
// conversations).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { eventId?: string } | null;
  const eventId = body?.eventId;
  if (!eventId) {
    return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();
  const { data: user } = await supabase.from("users").select("timezone").eq("id", userId).single();
  const timeZone = user?.timezone ?? "UTC";

  const result = await resolveCommand(userId, id, eventId, timeZone);
  return NextResponse.json(result);
}
