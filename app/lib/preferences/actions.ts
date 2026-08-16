"use server";

import { DEFAULT_SECTION_ORDER, type SectionKey } from "@/app/lib/today-sections";
import { getCurrentUserId } from "@/app/lib/supabase/current-user";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";

const VALID_KEYS = new Set<string>(DEFAULT_SECTION_ORDER);

/**
 * Overwrites `preferences.section_order` with `order` verbatim — same
 * "here is the new full list, persist it" shape as
 * `setMarketTickerOrderAction` (app/lib/markets/actions.ts), backing both
 * the Settings page's show/hide checkboxes and its reorder buttons, since
 * both are really the same operation on this one array.
 */
export async function setSectionOrderAction(order: SectionKey[]): Promise<void> {
  const userId = await getCurrentUserId();
  const supabase = getSupabaseServiceClient();

  const normalized = order
    .filter((key) => VALID_KEYS.has(key))
    .filter((key, index, list) => list.indexOf(key) === index);

  const { error } = await supabase.from("preferences").update({ section_order: normalized }).eq("user_id", userId);
  if (error) throw new Error("Couldn't save section order");
}
