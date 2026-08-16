"use client";

import { ChevronLeftIcon, ChevronRightIcon, PencilIcon, XIcon } from "@/app/components/icons";
import { useModalNavKeys } from "@/app/components/use-modal-nav-keys";
import { formatEventTime } from "@/app/lib/calendar/format";
import type { CalendarEvent } from "@/app/lib/calendar/types";

// Single-event detail, Prev/Next between *today's other events* — pure
// client-side array indexing (the parent already has the whole day's
// events loaded), unlike the Calendar page's Day Detail modal, whose
// Prev/Next moves between days and needs a real query.
export function CalendarEventPopup({
  event,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onEdit,
  onDelete,
  onClose,
}: {
  event: CalendarEvent;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  useModalNavKeys({ onClose, onPrev: hasPrev ? onPrev : undefined, onNext: hasNext ? onNext : undefined });

  const timeLabel = event.allDay
    ? "All day"
    : event.startTime && event.endTime
      ? `${formatEventTime(event.startTime)} – ${formatEventTime(event.endTime)}`
      : event.startTime
        ? formatEventTime(event.startTime)
        : null;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" style={{ maxWidth: 420, width: "92%" }} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{event.title}</span>
          <div style={{ display: "flex", gap: 2 }}>
            <button type="button" className="btn btn-ghost" onClick={onPrev} disabled={!hasPrev} aria-label="Previous event" style={{ padding: 4 }}>
              <ChevronLeftIcon size={14} />
            </button>
            <button type="button" className="btn btn-ghost" onClick={onNext} disabled={!hasNext} aria-label="Next event" style={{ padding: 4 }}>
              <ChevronRightIcon size={14} />
            </button>
          </div>
        </div>
        <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {timeLabel ? <p style={{ margin: 0, fontSize: 14 }}>{timeLabel}</p> : null}
          {event.location ? (
            <p style={{ margin: 0, fontSize: 14, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>{event.location}</p>
          ) : null}
          {event.description ? <p style={{ margin: 0, fontSize: 14 }}>{event.description}</p> : null}
        </div>
        <div className="dialog-actions" style={{ justifyContent: "space-between" }}>
          <button type="button" className="btn btn-secondary" onClick={onDelete} style={{ color: "var(--color-danger)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <XIcon size={13} /> Delete
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onEdit} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <PencilIcon size={13} /> Edit
            </button>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
