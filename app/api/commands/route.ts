import { NextRequest, NextResponse } from "next/server";
import { runCommand } from "@/app/lib/commands/execute";
import { getCurrentUserId } from "@/app/lib/supabase/current-user";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";

// Backs the Today page's command bar — one typed command in, one
// parsed-and-classified response out. This fork has no Google Calendar or
// email integration at all, so only reminder intents and general chat
// actually execute (see app/lib/commands/types.ts).
export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { text?: string; context?: unknown } | null;
  const text = body?.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();
  const { data: user } = await supabase.from("users").select("timezone").eq("id", userId).single();
  const timeZone = user?.timezone ?? "UTC";

  const context = Array.isArray(body?.context)
    ? body.context.filter((message): message is string => typeof message === "string").slice(-8)
    : [];
  const result = await runCommand(userId, text, timeZone, context);
  return NextResponse.json(result);
}
