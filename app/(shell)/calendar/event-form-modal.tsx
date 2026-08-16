"use client";

import { useState } from "react";
import { createCalendarEventAction, deleteCalendarEventAction, updateCalendarEventAction } from "@/app/lib/calendar/actions";
import type { CalendarEvent, CalendarEventInput } from "@/app/lib/calendar/types";
import { useModalNavKeys } from "@/app/components/use-modal-nav-keys";

interface EventFormModalProps {
  mode: "create" | "edit";
  /** Pre-fills the date field in create mode (e.g. today, or whichever day is currently open in Day Detail). */
  initialDate?: string;
  event?: CalendarEvent;
  onSaved: (event: CalendarEvent) => void;
  onDeleted?: () => void;
  onClose: () => void;
}

// The one shared create/edit form, used from all four entry points that can
// add or edit an event: Today's "+ Add", Today's row-level edit, Day
// Detail's "+ Add", Day Detail's row-level edit.
export function EventFormModal({ mode, initialDate, event, onSaved, onDeleted, onClose }: EventFormModalProps) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [eventDate, setEventDate] = useState(event?.eventDate ?? initialDate ?? "");
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startTime, setStartTime] = useState(event?.startTime ?? "");
  const [endTime, setEndTime] = useState(event?.endTime ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalNavKeys({ onClose });

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !eventDate) {
      setError("Title and date are required.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    const input: CalendarEventInput = {
      title: trimmedTitle,
      eventDate,
      startTime: allDay ? null : startTime || null,
      endTime: allDay ? null : endTime || null,
      allDay,
      location: location.trim() || null,
      description: description.trim() || null,
    };

    try {
      if (mode === "create") {
        const created = await createCalendarEventAction(input);
        onSaved(created);
      } else if (event) {
        await updateCalendarEventAction(event.id, input);
        onSaved({ ...event, ...input });
      }
      onClose();
    } catch {
      setError("Couldn't save that event — try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!event) return;
    setIsSubmitting(true);
    try {
      await deleteCalendarEventAction(event.id);
      onDeleted?.();
      onClose();
    } catch {
      setError("Couldn't delete that event — try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" style={{ maxWidth: 440, width: "92%" }} onClick={(event) => event.stopPropagation()}>
        <div className="dialog-title">{mode === "create" ? "Add event" : "Edit event"}</div>
        <form onSubmit={handleSubmit}>
          <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="field">
              <label>Title</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
            </div>

            <div className="field">
              <label>Date</label>
              <input type="date" className="input" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
              All day
            </label>

            {!allDay ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field">
                  <label>Start time</label>
                  <input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className="field">
                  <label>End time</label>
                  <input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
            ) : null}

            <div className="field">
              <label>Location</label>
              <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>

            <div className="field">
              <label>Description</label>
              <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            {error ? <p style={{ color: "var(--color-danger)", fontSize: 13, margin: 0 }}>{error}</p> : null}
          </div>

          <div className="dialog-actions" style={{ justifyContent: mode === "edit" ? "space-between" : "flex-end" }}>
            {mode === "edit" ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDelete}
                disabled={isSubmitting}
                style={{ color: "var(--color-danger)" }}
              >
                Delete
              </button>
            ) : null}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
