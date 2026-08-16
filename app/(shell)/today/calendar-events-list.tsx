"use client";

import { useEffect, useState } from "react";
import { PencilIcon, PlusIcon, XIcon } from "@/app/components/icons";
import { deleteCalendarEventAction } from "@/app/lib/calendar/actions";
import { formatEventTime } from "@/app/lib/calendar/format";
import type { CalendarEvent } from "@/app/lib/calendar/types";
import { CalendarEventPopup } from "@/app/(shell)/today/calendar-event-popup";
import { EventFormModal } from "@/app/(shell)/calendar/event-form-modal";

function RowIconButton({ onClick, label, children }: { onClick: (event: React.MouseEvent) => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        border: "none",
        background: "none",
        padding: 4,
        cursor: "pointer",
        opacity: 0.6,
        color: "inherit",
        display: "inline-flex",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

export function CalendarEventsList({ events, today }: { events: CalendarEvent[]; today: string }) {
  const [items, setItems] = useState(events);
  const [popupIndex, setPopupIndex] = useState<number | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the list aligned with fresh server props after a revalidate
    setItems(events);
  }, [events]);

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setPopupIndex(null);
    void deleteCalendarEventAction(id);
  }

  const popupEvent = popupIndex !== null ? items[popupIndex] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
      {items.length === 0 ? (
        <p style={{ fontSize: 15, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
          Nothing on your calendar today.
        </p>
      ) : (
        items.map((item, index) => (
          <div
            key={item.id}
            className="btn btn-secondary btn-block"
            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
            onClick={() => setPopupIndex(index)}
          >
            <span style={{ flex: 1, textAlign: "left" }}>
              {item.title}
              {!item.allDay && item.startTime ? (
                <span style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}> — {formatEventTime(item.startTime)}</span>
              ) : item.allDay ? (
                <span style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}> — All day</span>
              ) : null}
            </span>
            <RowIconButton
              onClick={(mouseEvent) => {
                mouseEvent.stopPropagation();
                setEditingEvent(item);
              }}
              label={`Edit ${item.title}`}
            >
              <PencilIcon size={13} />
            </RowIconButton>
            <RowIconButton
              onClick={(mouseEvent) => {
                mouseEvent.stopPropagation();
                handleDelete(item.id);
              }}
              label={`Delete ${item.title}`}
            >
              <XIcon size={13} />
            </RowIconButton>
          </div>
        ))
      )}

      <button
        type="button"
        className="btn btn-ghost"
        style={{ alignSelf: "flex-start", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
        onClick={() => setCreating(true)}
      >
        <PlusIcon size={13} /> Add event
      </button>

      {popupEvent ? (
        <CalendarEventPopup
          event={popupEvent}
          hasPrev={popupIndex !== null && popupIndex > 0}
          hasNext={popupIndex !== null && popupIndex < items.length - 1}
          onPrev={() => setPopupIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setPopupIndex((i) => (i !== null && i < items.length - 1 ? i + 1 : i))}
          onEdit={() => {
            setEditingEvent(popupEvent);
            setPopupIndex(null);
          }}
          onDelete={() => handleDelete(popupEvent.id)}
          onClose={() => setPopupIndex(null)}
        />
      ) : null}

      {editingEvent ? (
        <EventFormModal
          mode="edit"
          event={editingEvent}
          onSaved={(updated) => setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))}
          onDeleted={() => setItems((prev) => prev.filter((item) => item.id !== editingEvent.id))}
          onClose={() => setEditingEvent(null)}
        />
      ) : null}

      {creating ? (
        <EventFormModal
          mode="create"
          initialDate={today}
          onSaved={(created) => setItems((prev) => [...prev, created])}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </div>
  );
}
