/** 12-hour AM/PM label for a "HH:MM" 24-hour time string, e.g. "13:30" -> "1:30 PM". */
export function formatEventTime(time24: string): string {
  const [hoursStr, minutes] = time24.split(":");
  const hours = Number(hoursStr);
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hours12}:${minutes} ${period}`;
}

/** "2026-08-17" -> "Monday, August 17". Parsed/formatted in UTC so a pure date string never drifts a day from the caller's local timezone. */
export function formatEventDateLabel(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(
    new Date(`${dateStr}T00:00:00Z`)
  );
}
