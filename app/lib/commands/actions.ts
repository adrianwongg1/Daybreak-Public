"use server";

import { revalidatePath } from "next/cache";
import { completeReminder, deleteReminder, updateReminder } from "@/app/lib/commands/reminders";
import { getCurrentUserId } from "@/app/lib/supabase/current-user";

/** Marks one of the Today page's open reminders done — scoped to the signed-in user by completeReminder's own query. */
export async function completeReminderAction(reminderId: string): Promise<void> {
  const userId = await getCurrentUserId();
  await completeReminder(userId, reminderId);
  revalidatePath("/today");
}

/** Direct-UI delete for a reminder row — the inline counterpart to the command bar's delete_reminder intent. */
export async function deleteReminderAction(reminderId: string): Promise<void> {
  const userId = await getCurrentUserId();
  await deleteReminder(userId, reminderId);
  revalidatePath("/today");
}

/** Direct-UI edit for a reminder row — the inline counterpart to the command bar's edit_reminder intent. */
export async function editReminderAction(reminderId: string, patch: { text?: string; remindAt?: string | null }): Promise<void> {
  const userId = await getCurrentUserId();
  await updateReminder(userId, reminderId, patch);
  revalidatePath("/today");
}
