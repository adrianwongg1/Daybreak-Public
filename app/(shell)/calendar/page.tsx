import { Suspense } from "react";
import Link from "next/link";
import { CalendarGrid } from "@/app/(shell)/calendar/calendar-grid";
import { CalendarGridSkeleton } from "@/app/components/calendar-skeleton";
import { ChevronLeftIcon, ChevronRightIcon } from "@/app/components/icons";
import { EARLIEST_APP_DATE, todayInTimeZone } from "@/app/lib/briefing/date";
import { listEventsInRange } from "@/app/lib/calendar/events";
import { formatMonthLabel, getAdjacentMonthKey, getMonthBounds, isValidMonthKey } from "@/app/lib/calendar/month";
import { requireCompletedSession } from "@/app/lib/auth/require-completed-session";

const EARLIEST_MONTH_KEY = EARLIEST_APP_DATE.slice(0, 7);

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { userId, timezone } = await requireCompletedSession();
  // The visible month defaults off the user's own configured timezone, not
  // the server's UTC clock -- a PST user at 9pm Jan 31 is still in January
  // locally but already Feb 1 UTC, and a naive server-clock default would
  // open the grid on the wrong month.
  const today = todayInTimeZone(timezone);

  const { month } = await searchParams;
  const monthKey = month && isValidMonthKey(month) ? month : today.slice(0, 7);

  const { start, end } = getMonthBounds(monthKey);

  const prevMonthKey = getAdjacentMonthKey(monthKey, -1);
  const nextMonthKey = getAdjacentMonthKey(monthKey, 1);
  const canGoPrev = prevMonthKey >= EARLIEST_MONTH_KEY;

  return (
    <div>
      <header style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 12, marginBottom: 20 }}>
        {canGoPrev ? (
          <Link href={`/calendar?month=${prevMonthKey}`} className="btn btn-secondary" aria-label="Previous month" style={{ padding: "6px 10px", justifySelf: "start" }}>
            <ChevronLeftIcon size={16} />
          </Link>
        ) : (
          <button type="button" className="btn btn-secondary" disabled aria-label="Previous month" style={{ padding: "6px 10px", justifySelf: "start" }}>
            <ChevronLeftIcon size={16} />
          </button>
        )}

        <h1 style={{ margin: 0, textAlign: "center" }}>{formatMonthLabel(monthKey)}</h1>

        <Link href={`/calendar?month=${nextMonthKey}`} className="btn btn-secondary" aria-label="Next month" style={{ padding: "6px 10px", justifySelf: "end" }}>
          <ChevronRightIcon size={16} />
        </Link>
      </header>

      <Suspense key={monthKey} fallback={<CalendarGridSkeleton />}>
        <CalendarEvents userId={userId} monthKey={monthKey} today={today} start={start} end={end} />
      </Suspense>
    </div>
  );
}

async function CalendarEvents({
  userId,
  monthKey,
  today,
  start,
  end,
}: {
  userId: string;
  monthKey: string;
  today: string;
  start: string;
  end: string;
}) {
  const events = await listEventsInRange(userId, start, end);
  return <CalendarGrid monthKey={monthKey} today={today} events={events} />;
}
