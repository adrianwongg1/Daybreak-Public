"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronLeftIcon, ChevronRightIcon, PencilIcon, PlusIcon, XIcon } from "@/app/components/icons";
import { useModalNavKeys } from "@/app/components/use-modal-nav-keys";
import { deleteCalendarEventAction, getDayDetailAction } from "@/app/lib/calendar/actions";
import { formatEventDateLabel, formatEventTime } from "@/app/lib/calendar/format";
import type { CalendarEvent } from "@/app/lib/calendar/types";
import { EventFormModal } from "@/app/(shell)/calendar/event-form-modal";

// Always fetches on open/navigate, rather than trying to reuse the month
// grid's already-loaded events — the grid only has events for days *inside*
// the visible month, but its leading/trailing cells show adjacent-month
// days too, and Prev/Next here can land on any day with events regardless
// of month. One real query per day keeps this correct in every case
// instead of needing to special-case "did we already have this day loaded."
export function DayDetailModal({ date: initialDate, onClose }: { date: string; onClose: () => void }) {
  const [date, setDate] = useState(initialDate);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [prevDate, setPrevDate] = useState<string | null>(null);
  const [nextDate, setNextDate] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      const detail = await getDayDetailAction(date);
      if (cancelled) return;
      setEvents(detail.events);
      setPrevDate(detail.prevDate);
      setNextDate(detail.nextDate);
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  useModalNavKeys({
    onClose,
    onPrev: prevDate ? () => setDate(prevDate) : undefined,
    onNext: nextDate ? () => setDate(nextDate) : undefined,
  });

  function handleDelete(id: string) {
    setEvents((prev) => prev.filter((event) => event.id !== id));
    void deleteCalendarEventAction(id);
  }

  return (
    <>
      <div className="dialog-backdrop" onClick={onClose}>
        <div className="dialog" style={{ maxWidth: 480, width: "92%" }} onClick={(e) => e.stopPropagation()}>
          <div className="dialog-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>{formatEventDateLabel(date)}</span>
            <div style={{ display: "flex", gap: 2 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => prevDate && setDate(prevDate)}
                disabled={!prevDate}
                aria-label="Previous day with events"
                style={{ padding: 4 }}
              >
                <ChevronLeftIcon size={14} />
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => nextDate && setDate(nextDate)}
                disabled={!nextDate}
                aria-label="Next day with events"
                style={{ padding: 4 }}
              >
                <ChevronRightIcon size={14} />
              </button>
            </div>
          </div>

          <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {isPending ? (
              <p className="text-muted" style={{ fontSize: 13 }}>
                Loading…
              </p>
            ) : events.length === 0 ? (
              <p style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>No events this day.</p>
            ) : (
              events.map((event) => {
                const timeLabel = event.allDay
                  ? "All day"
                  : event.startTime && event.endTime
                    ? `${formatEventTime(event.startTime)} – ${formatEventTime(event.endTime)}`
                    : event.startTime
                      ? formatEventTime(event.startTime)
                      : null;
                return (
                  <div
                    key={event.id}
                    style={{ display: "flex", alignItems: "flex-start", gap: 10, paddingBottom: 10, borderBottom: "1px solid var(--color-divider)" }}
                  >
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>{event.title}</p>
                      {timeLabel ? (
                        <p style={{ margin: "2px 0 0", fontSize: 13, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>{timeLabel}</p>
                      ) : null}
                      {event.location ? <p style={{ margin: "2px 0 0", fontSize: 13 }}>{event.location}</p> : null}
                      {event.description ? <p style={{ margin: "4px 0 0", fontSize: 13 }}>{event.description}</p> : null}
                    </div>
                    <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setEditingEvent(event)}
                        aria-label={`Edit ${event.title}`}
                        style={{ border: "none", background: "none", padding: 4, cursor: "pointer", opacity: 0.6, color: "inherit" }}
                      >
                        <PencilIcon size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(event.id)}
                        aria-label={`Delete ${event.title}`}
                        style={{ border: "none", background: "none", padding: 4, cursor: "pointer", opacity: 0.6, color: "inherit" }}
                      >
                        <XIcon size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="dialog-actions">
            <button
              type="button"
              className="btn btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              onClick={() => setCreating(true)}
            >
              <PlusIcon size={13} /> Add event
            </button>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      {editingEvent ? (
        <EventFormModal
          mode="edit"
          event={editingEvent}
          onSaved={(updated) => setEvents((prev) => prev.map((event) => (event.id === updated.id ? updated : event)))}
          onDeleted={() => setEvents((prev) => prev.filter((event) => event.id !== editingEvent.id))}
          onClose={() => setEditingEvent(null)}
        />
      ) : null}

      {creating ? (
        <EventFormModal
          mode="create"
          initialDate={date}
          onSaved={(created) => setEvents((prev) => [...prev, created])}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </>
  );
}
