import type { Reminder } from "@/app/lib/commands/reminders";
import { formatEventDateLabel, formatEventTime } from "@/app/lib/calendar/format";
import type { CalendarEvent } from "@/app/lib/calendar/types";

/**
 * Converts a naive local wall-clock instant (Gemini's "YYYY-MM-DD" or
 * "YYYY-MM-DDTHH:mm" output, no UTC offset) into the real UTC instant it
 * represents in `timeZone`. Single-pass offset approximation — fine at this
 * project's scale (a DST-boundary edge case would be off by an hour, same
 * level of rigor as the rest of this codebase's hand-rolled timezone math,
 * no date library in use anywhere else either).
 */
export function localNaiveToUtcDate(naiveLocalIso: string, timeZone: string): Date {
  const [datePart, timePart] = naiveLocalIso.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart ?? "00:00").split(":").map(Number);
  const approxUtcMs = Date.UTC(year, month - 1, day, hour || 0, minute || 0);
  const offsetMin = timeZoneOffsetMinutes(new Date(approxUtcMs), timeZone);
  return new Date(approxUtcMs - offsetMin * 60000);
}

function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (asUTC - date.getTime()) / 60000;
}

/** "Thu, Jul 30 at 2:00 PM" style label for an arbitrary instant — used for reminder confirmations. */
export function formatInstantLabel(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

const REFERENCE_STOPWORDS = new Set([
  "my", "the", "a", "an", "with", "meeting", "event", "appointment", "call", "about",
]);

function referenceKeywords(reference: string): string[] {
  return reference
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !REFERENCE_STOPWORDS.has(word));
}

/**
 * Fuzzy-matches a free-text reminder reference ("dentist reminder") against
 * open reminders by keyword substring. Deliberately simple (no
 * fuzzy-distance library) — this only has to distinguish "how many real
 * candidates" for the disambiguation picker, not rank a large corpus.
 */
export function matchRemindersByReference(reminders: Reminder[], reference: string): Reminder[] {
  const keywords = referenceKeywords(reference);
  if (keywords.length === 0) return [];
  return reminders.filter((reminder) => {
    const haystack = reminder.text.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });
}

/** Same fuzzy keyword-substring approach as matchRemindersByReference, applied to calendar events' titles instead of reminder text. */
export function matchEventsByReference(events: CalendarEvent[], reference: string): CalendarEvent[] {
  const keywords = referenceKeywords(reference);
  if (keywords.length === 0) return [];
  return events.filter((event) => {
    const haystack = event.title.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });
}

/** "Lunch — Sunday, August 16, 12:00 PM" style label for a disambiguation picker row. */
export function formatEventLabel(event: CalendarEvent): string {
  const when = event.allDay
    ? formatEventDateLabel(event.eventDate)
    : `${formatEventDateLabel(event.eventDate)}${event.startTime ? `, ${formatEventTime(event.startTime)}` : ""}`;
  return `${event.title} — ${when}`;
}
