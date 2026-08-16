"use server";

import { revalidatePath } from "next/cache";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getAdjacentEventDate,
  listEventsForDate,
  updateCalendarEvent,
} from "@/app/lib/calendar/events";
import type { CalendarEvent, CalendarEventInput } from "@/app/lib/calendar/types";
import { getCurrentUserId } from "@/app/lib/supabase/current-user";

// Events can show on both /today and /calendar now (unlike reminders,
// which only ever appear on /today) — every mutation revalidates both.
function revalidateCalendarSurfaces(): void {
  revalidatePath("/today");
  revalidatePath("/calendar");
}

export async function createCalendarEventAction(input: CalendarEventInput): Promise<CalendarEvent> {
  const userId = await getCurrentUserId();
  const event = await createCalendarEvent(userId, input);
  revalidateCalendarSurfaces();
  return event;
}

export async function updateCalendarEventAction(eventId: string, patch: Partial<CalendarEventInput>): Promise<void> {
  const userId = await getCurrentUserId();
  await updateCalendarEvent(userId, eventId, patch);
  revalidateCalendarSurfaces();
}

export async function deleteCalendarEventAction(eventId: string): Promise<void> {
  const userId = await getCurrentUserId();
  await deleteCalendarEvent(userId, eventId);
  revalidateCalendarSurfaces();
}

export interface DayDetail {
  events: CalendarEvent[];
  prevDate: string | null;
  nextDate: string | null;
}

/** One round trip for Day Detail's Prev/Next: the target day's events plus its own further prev/next pointers. */
export async function getDayDetailAction(date: string): Promise<DayDetail> {
  const userId = await getCurrentUserId();
  const [events, prevDate, nextDate] = await Promise.all([
    listEventsForDate(userId, date),
    getAdjacentEventDate(userId, date, "prev"),
    getAdjacentEventDate(userId, date, "next"),
  ]);
  return { events, prevDate, nextDate };
}
