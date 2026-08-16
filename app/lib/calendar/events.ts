import { getSupabaseServiceClient } from "@/app/lib/supabase/server";
import type { TablesInsert, TablesUpdate } from "@/app/lib/supabase/database.types";
import type { CalendarEvent, CalendarEventInput } from "@/app/lib/calendar/types";

/** Postgres `time` values come back as "07:00:00" — trim to "07:00" for <input type="time">/display. */
function toHHMM(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}

function toCalendarEvent(row: {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  location: string | null;
  description: string | null;
}): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    eventDate: row.event_date,
    startTime: toHHMM(row.start_time),
    endTime: toHHMM(row.end_time),
    allDay: row.all_day,
    location: row.location,
    description: row.description,
  };
}

const EVENT_COLUMNS = "id, title, event_date, start_time, end_time, all_day, location, description";

export async function createCalendarEvent(userId: string, input: CalendarEventInput): Promise<CalendarEvent> {
  const supabase = getSupabaseServiceClient();
  const row: TablesInsert<"calendar_events"> = {
    user_id: userId,
    title: input.title,
    event_date: input.eventDate,
    start_time: input.allDay ? null : input.startTime,
    end_time: input.allDay ? null : input.endTime,
    all_day: input.allDay,
    location: input.location,
    description: input.description,
  };
  const { data, error } = await supabase.from("calendar_events").insert(row).select(EVENT_COLUMNS).single();
  if (error || !data) throw new Error(`Failed to create calendar event: ${error?.message}`);
  return toCalendarEvent(data);
}

/** Backs the Today page's compact calendar section — one day's events, all-day first, then by start time. */
export async function listEventsForDate(userId: string, date: string): Promise<CalendarEvent[]> {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("calendar_events")
    .select(EVENT_COLUMNS)
    .eq("user_id", userId)
    .eq("event_date", date)
    .order("all_day", { ascending: false })
    .order("start_time", { ascending: true, nullsFirst: false });
  return (data ?? []).map(toCalendarEvent);
}

/** Backs the command bar's edit/delete-by-reference matching ("delete my lunch event") — today's and future events only, since referring to a past event by voice/text isn't a realistic use case reminders' equivalent (open-only) doesn't have to consider either. */
export async function listUpcomingEvents(userId: string, today: string): Promise<CalendarEvent[]> {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("calendar_events")
    .select(EVENT_COLUMNS)
    .eq("user_id", userId)
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .order("all_day", { ascending: false })
    .order("start_time", { ascending: true, nullsFirst: false });
  return (data ?? []).map(toCalendarEvent);
}

/** Backs the Calendar page's month grid — one query per visible month. */
export async function listEventsInRange(userId: string, startDate: string, endDate: string): Promise<CalendarEvent[]> {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("calendar_events")
    .select(EVENT_COLUMNS)
    .eq("user_id", userId)
    .gte("event_date", startDate)
    .lte("event_date", endDate)
    .order("event_date", { ascending: true })
    .order("all_day", { ascending: false })
    .order("start_time", { ascending: true, nullsFirst: false });
  return (data ?? []).map(toCalendarEvent);
}

/** Only the provided keys are updated — omit a field entirely to leave it untouched, same contract as updateReminder. */
export async function updateCalendarEvent(userId: string, eventId: string, patch: Partial<CalendarEventInput>): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const update: TablesUpdate<"calendar_events"> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.eventDate !== undefined) update.event_date = patch.eventDate;
  if (patch.startTime !== undefined) update.start_time = patch.startTime;
  if (patch.endTime !== undefined) update.end_time = patch.endTime;
  if (patch.allDay !== undefined) update.all_day = patch.allDay;
  if (patch.location !== undefined) update.location = patch.location;
  if (patch.description !== undefined) update.description = patch.description;

  const { error } = await supabase.from("calendar_events").update(update).eq("id", eventId).eq("user_id", userId);
  if (error) throw new Error(`Failed to update calendar event: ${error.message}`);
}

export async function deleteCalendarEvent(userId: string, eventId: string): Promise<void> {
  const supabase = getSupabaseServiceClient();
  await supabase.from("calendar_events").delete().eq("id", eventId).eq("user_id", userId);
}

/**
 * Nearest earlier/later date (any month) that has at least one event for
 * this user — backs Day Detail's Prev/Next. A real query, not client-side
 * array math, since it can cross a month boundary the grid hasn't loaded
 * (same reasoning as the old app's getAdjacentBriefingDate).
 */
export async function getAdjacentEventDate(userId: string, date: string, direction: "prev" | "next"): Promise<string | null> {
  const supabase = getSupabaseServiceClient();
  const query = supabase.from("calendar_events").select("event_date").eq("user_id", userId);
  const { data } =
    direction === "next"
      ? await query.gt("event_date", date).order("event_date", { ascending: true }).limit(1)
      : await query.lt("event_date", date).order("event_date", { ascending: false }).limit(1);
  return data?.[0]?.event_date ?? null;
}
