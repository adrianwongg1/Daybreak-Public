/** The app's earliest supported date (design_handoff_daybreak_app/README.md) — a fixed floor for calendar navigation, not tied to any one user's signup date. */
export const EARLIEST_APP_DATE = "2026-01-01";

/**
 * `Intl.DateTimeFormat` throws a `RangeError` for anything that isn't a
 * real IANA zone name — e.g. "Los Angeles" typed into the onboarding
 * schedule step's free-text field instead of "America/Los_Angeles". A
 * single account with a value like that used to crash not just its own
 * Today page but the whole cron batch (getDueUsers iterates every due
 * user in one pass) — validate/sanitize here so a bad value degrades
 * instead of taking down anyone else.
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** `timeZone` if it's a real IANA zone, otherwise "UTC" — see `isValidTimeZone`. */
export function safeTimeZone(timeZone: string): string {
  return isValidTimeZone(timeZone) ? timeZone : "UTC";
}

/** Local calendar date (YYYY-MM-DD) for `date` in the given IANA `timeZone`. */
export function formatLocalIsoDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today's date (YYYY-MM-DD) in `timeZone` — the user's stored timezone, not the server's. */
export function todayInTimeZone(timeZone: string): string {
  return formatLocalIsoDate(new Date(), timeZone);
}

/** True if `at` falls on Saturday or Sunday in `timeZone`. */
export function isWeekendInTimeZone(timeZone: string, at: Date = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: safeTimeZone(timeZone), weekday: "short" }).format(at);
  return weekday === "Sat" || weekday === "Sun";
}

/** Picks the weekday or weekend briefing time for `at` in `timeZone` — falls back to the weekday time when no weekend time is set (its optional status from onboarding). */
export function resolveBriefingTime(
  weekdayTime: string,
  weekendTime: string | null,
  timeZone: string,
  at: Date = new Date()
): string {
  return isWeekendInTimeZone(timeZone, at) ? (weekendTime ?? weekdayTime) : weekdayTime;
}

/** Local hour-of-day (0-23) for `at` in the given IANA `timeZone`. */
export function currentLocalHour(timeZone: string, at: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", { timeZone: safeTimeZone(timeZone), hourCycle: "h23", hour: "2-digit" })
    .formatToParts(at)
    .find((p) => p.type === "hour")?.value;
  return Number(hour ?? "0");
}

/** 12-hour label for a 24-hour hour value, e.g. 7 -> "7 AM", 13 -> "1 PM" — matches the `HourlyTemp.time` format. */
export function formatHourLabel(hour24: number): string {
  const period = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12} ${period}`;
}
