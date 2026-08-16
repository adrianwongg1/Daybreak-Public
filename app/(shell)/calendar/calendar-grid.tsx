"use client";

import { useState } from "react";
import { getMonthGridDates } from "@/app/lib/calendar/month";
import type { CalendarEvent } from "@/app/lib/calendar/types";
import { DayDetailModal } from "@/app/(shell)/calendar/day-detail-modal";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarGrid({ monthKey, today, events }: { monthKey: string; today: string; events: CalendarEvent[] }) {
  const [openDate, setOpenDate] = useState<string | null>(null);
  const dates = getMonthGridDates(monthKey);

  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const existing = eventsByDate.get(event.eventDate);
    if (existing) existing.push(event);
    else eventsByDate.set(event.eventDate, [event]);
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            style={{ padding: "8px 0", textAlign: "center", fontSize: 12, fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}
          >
            {label}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {dates.map((date) => {
          const inMonth = date.slice(0, 7) === monthKey;
          const isToday = date === today;
          const dayEvents = eventsByDate.get(date) ?? [];
          return (
            <button
              key={date}
              type="button"
              onClick={() => setOpenDate(date)}
              aria-label={`${date}${dayEvents.length > 0 ? `, ${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}` : ""}`}
              style={{
                border: "none",
                borderTop: "1px solid var(--color-divider)",
                borderLeft: "1px solid var(--color-divider)",
                background: isToday ? "color-mix(in srgb, var(--color-accent) 10%, transparent)" : "none",
                minHeight: 72,
                padding: 8,
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                opacity: inMonth ? 1 : 0.4,
                fontFamily: "inherit",
                color: "inherit",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? "var(--color-accent-700)" : "inherit" }}>
                {Number(date.slice(8, 10))}
              </span>
              {dayEvents.length > 0 ? (
                <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-accent)" }} />
              ) : null}
            </button>
          );
        })}
      </div>

      {openDate ? <DayDetailModal date={openDate} onClose={() => setOpenDate(null)} /> : null}
    </div>
  );
}
