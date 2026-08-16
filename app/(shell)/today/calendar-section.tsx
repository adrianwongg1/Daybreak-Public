import { CalendarEventsList } from "@/app/(shell)/today/calendar-events-list";
import type { CalendarEvent } from "@/app/lib/calendar/types";

export function CalendarSection({ id, events, today }: { id?: string; events: CalendarEvent[]; today: string }) {
  return (
    <section id={id}>
      <h3 style={{ color: "var(--color-text)", margin: "0 0 14px" }}>Today&apos;s calendar</h3>
      <CalendarEventsList events={events} today={today} />
    </section>
  );
}
