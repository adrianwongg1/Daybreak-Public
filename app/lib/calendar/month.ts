// Pure date-string arithmetic for the Calendar page's month grid. Every
// function here uses Date.UTC/getUTC* exclusively — never `new Date(y, m, d)`
// or a bare `new Date()` — so none of this can accidentally pick up the
// runtime's own local timezone. Callers resolve the *visible* month/day
// against the user's configured timezone (todayInTimeZone) before calling
// in here; this module only does calendar math on the resulting strings.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM" -> {year, month} (month 1-12). */
function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [year, month] = monthKey.split("-").map(Number);
  return { year, month };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Sun-Sat weekday index (0-6) for a YYYY-MM-DD date string. */
function weekdayOf(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function getMonthBounds(monthKey: string): { start: string; end: string } {
  const { year, month } = parseMonthKey(monthKey);
  const lastDay = daysInMonth(year, month);
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

/** Full Sun-Sat grid for the visible month, including leading/trailing adjacent-month days needed to fill whole weeks. */
export function getMonthGridDates(monthKey: string): string[] {
  const { start, end } = getMonthBounds(monthKey);
  const gridStart = shiftDate(start, -weekdayOf(start));
  const gridEnd = shiftDate(end, 6 - weekdayOf(end));

  const dates: string[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    dates.push(cursor);
    cursor = shiftDate(cursor, 1);
  }
  return dates;
}

/** "2026-08" + delta -> "2026-09" / "2026-07", wrapping year boundaries. */
export function getAdjacentMonthKey(monthKey: string, delta: number): string {
  const { year, month } = parseMonthKey(monthKey);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

/** "2026-08" -> "August 2026". */
export function formatMonthLabel(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

/** true if `monthKey` is a syntactically valid "YYYY-MM" string. */
export function isValidMonthKey(monthKey: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey);
}
