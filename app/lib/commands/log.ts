import { getSupabaseServiceClient } from "@/app/lib/supabase/server";
import type { Json, TablesInsert } from "@/app/lib/supabase/database.types";
import type { CommandStatus, ParsedCommand } from "@/app/lib/commands/types";

/** Inserts one commands_log row (PRD Section 8) and returns its id. */
export async function logCommand(
  userId: string,
  inputText: string,
  parsedCommand: ParsedCommand | null,
  status: CommandStatus
): Promise<string> {
  const supabase = getSupabaseServiceClient();
  const row: TablesInsert<"commands_log"> = {
    user_id: userId,
    input_text: inputText,
    // Cast through Json: ParsedCommand is a plain TS interface, and Supabase's
    // generated Json type requires an index signature a plain interface
    // doesn't structurally have — same pattern as app/lib/briefing/generate.ts.
    parsed_intent_json: parsedCommand as unknown as Json,
    status,
  };
  const { data, error } = await supabase.from("commands_log").insert(row).select("id").single();
  if (error || !data) throw new Error(`Failed to log command: ${error?.message}`);
  return data.id;
}

/** Moves a "pending" (ambiguous) command to its final status once the user resolves the disambiguation picker. */
export async function updateCommandStatus(commandId: string, status: CommandStatus): Promise<void> {
  const supabase = getSupabaseServiceClient();
  await supabase.from("commands_log").update({ status }).eq("id", commandId);
}

/** Loads a previously-logged command, scoped to `userId` so one user can't resolve another's pending command by guessing its id. */
export async function getCommandLogRow(
  userId: string,
  commandId: string
): Promise<{ inputText: string; parsedCommand: ParsedCommand | null; status: string } | null> {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("commands_log")
    .select("input_text, parsed_intent_json, status")
    .eq("id", commandId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    inputText: data.input_text,
    parsedCommand: data.parsed_intent_json as unknown as ParsedCommand | null,
    status: data.status,
  };
}
