"use server";

import { normalizeCommandSuggestions } from "@/app/lib/commands/suggestions";
import { getCurrentUserId } from "@/app/lib/supabase/current-user";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";

/** Persists the complete visible command list after an add, edit, or delete. */
export async function saveCommandSuggestionsAction(suggestions: string[]): Promise<string[]> {
  const userId = await getCurrentUserId();
  const normalized = normalizeCommandSuggestions(suggestions);
  const { error } = await getSupabaseServiceClient()
    .from("preferences")
    .update({ command_suggestions: normalized })
    .eq("user_id", userId);
  if (error) throw new Error("Couldn't save command suggestions");
  return normalized;
}
