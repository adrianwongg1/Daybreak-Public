import { getSupabaseServiceClient } from "@/app/lib/supabase/server";
import type { TablesInsert, TablesUpdate } from "@/app/lib/supabase/database.types";

export interface Reminder {
  id: string;
  text: string;
  /** UTC ISO instant, or null if the user didn't give a time (a plain to-do). */
  remindAt: string | null;
  createdAt: string;
}

/** PRD 7.3's one auto-execute command that's a real write under this app's read-only Calendar grant — app-local state, not a Google API call. */
export async function createReminder(userId: string, text: string, remindAtUtcIso: string | null): Promise<Reminder> {
  const supabase = getSupabaseServiceClient();
  const row: TablesInsert<"reminders"> = { user_id: userId, text, remind_at: remindAtUtcIso };
  const { data, error } = await supabase.from("reminders").insert(row).select("id, text, remind_at, created_at").single();
  if (error || !data) throw new Error(`Failed to create reminder: ${error?.message}`);
  return { id: data.id, text: data.text, remindAt: data.remind_at, createdAt: data.created_at };
}

/** Backs the Today page's small open-reminders list — most recent first. */
export async function listOpenReminders(userId: string): Promise<Reminder[]> {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("reminders")
    .select("id, text, remind_at, created_at")
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => ({ id: row.id, text: row.text, remindAt: row.remind_at, createdAt: row.created_at }));
}

export async function completeReminder(userId: string, reminderId: string): Promise<void> {
  const supabase = getSupabaseServiceClient();
  await supabase
    .from("reminders")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", reminderId)
    .eq("user_id", userId);
}

export async function deleteReminder(userId: string, reminderId: string): Promise<void> {
  const supabase = getSupabaseServiceClient();
  await supabase.from("reminders").delete().eq("id", reminderId).eq("user_id", userId);
}

/** Only the provided keys are updated — omit a field entirely to leave it untouched, rather than clearing it. */
export async function updateReminder(
  userId: string,
  reminderId: string,
  patch: { text?: string; remindAt?: string | null }
): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const update: TablesUpdate<"reminders"> = {};
  if (patch.text !== undefined) update.text = patch.text;
  if (patch.remindAt !== undefined) update.remind_at = patch.remindAt;
  await supabase.from("reminders").update(update).eq("id", reminderId).eq("user_id", userId);
}
