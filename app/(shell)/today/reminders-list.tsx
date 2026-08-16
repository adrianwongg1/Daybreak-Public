"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckIcon, PencilIcon, XIcon } from "@/app/components/icons";
import { completeReminderAction, deleteReminderAction, editReminderAction } from "@/app/lib/commands/actions";

export interface ReminderItem {
  id: string;
  text: string;
  /** UTC ISO instant, or null for a plain to-do with no specific time. */
  remindAt: string | null;
}

function formatRemindAt(remindAtIso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(remindAtIso));
}

function RowIconButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
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

// The command bar's write actions ("remind me to...", "delete my dentist
// reminder...", PRD 7.3) need somewhere to actually show up — otherwise
// they'd be indistinguishable from doing nothing. Each row now has three
// independent actions (complete/edit/delete), so the row itself is a plain
// div rather than one big button — only the leading circle completes it.
// Edit reuses the app's existing .dialog-backdrop/.dialog modal styling
// rather than inventing a new inline-edit pattern; it only edits text, not
// the reminder's time —
// changing the time stays a command-bar-only capability for now.
export function RemindersList({ reminders, timeZone }: { reminders: ReminderItem[]; timeZone: string }) {
  const [items, setItems] = useState(reminders);
  const [error, setError] = useState(false);
  const [, startTransition] = useTransition();
  const [editingItem, setEditingItem] = useState<ReminderItem | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the list aligned with fresh server props after a refresh (e.g. a command-bar edit/delete, which mutates data outside this component's own optimistic updates)
    setItems(reminders);
  }, [reminders]);

  if (items.length === 0) return null;

  function handleComplete(id: string) {
    const removed = items.find((item) => item.id === id);
    setError(false);
    setItems((prev) => prev.filter((item) => item.id !== id));
    startTransition(async () => {
      try {
        await completeReminderAction(id);
      } catch {
        // Restore the reminder rather than leaving the user thinking it's
        // done when the write actually failed — it would otherwise
        // silently reappear on the next page load with no explanation.
        if (removed) setItems((prev) => [...prev, removed]);
        setError(true);
      }
    });
  }

  function handleDelete(id: string) {
    const removed = items.find((item) => item.id === id);
    setError(false);
    setItems((prev) => prev.filter((item) => item.id !== id));
    startTransition(async () => {
      try {
        await deleteReminderAction(id);
      } catch {
        if (removed) setItems((prev) => [...prev, removed]);
        setError(true);
      }
    });
  }

  function openEdit(item: ReminderItem) {
    setEditingItem(item);
    setEditText(item.text);
  }

  function handleSaveEdit() {
    if (!editingItem) return;
    const trimmed = editText.trim();
    if (!trimmed) return;
    const id = editingItem.id;
    const previousText = editingItem.text;
    setError(false);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, text: trimmed } : item)));
    setEditingItem(null);
    startTransition(async () => {
      try {
        await editReminderAction(id, { text: trimmed });
      } catch {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, text: previousText } : item)));
        setError(true);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
      {items.map((item) => (
        <div key={item.id} className="btn btn-secondary btn-block" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={() => handleComplete(item.id)}
            aria-label={`Complete ${item.text}`}
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              border: "1px solid var(--color-divider)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              padding: 0,
              background: "none",
              cursor: "pointer",
              color: "color-mix(in srgb, var(--color-text) 45%, transparent)",
            }}
          >
            <CheckIcon size={10} />
          </button>
          <span style={{ flex: 1 }}>
            {item.text}
            {item.remindAt ? (
              <span style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                {" "}
                — {formatRemindAt(item.remindAt, timeZone)}
              </span>
            ) : null}
          </span>
          <RowIconButton onClick={() => openEdit(item)} label={`Edit ${item.text}`}>
            <PencilIcon size={13} />
          </RowIconButton>
          <RowIconButton onClick={() => handleDelete(item.id)} label={`Delete ${item.text}`}>
            <XIcon size={13} />
          </RowIconButton>
        </div>
      ))}
      {error ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--color-danger)" }}>Couldn&apos;t save that reminder change — try again.</p>
      ) : null}

      {editingItem ? (
        <div className="dialog-backdrop" onClick={() => setEditingItem(null)}>
          <div className="dialog" style={{ maxWidth: 420, width: "92%" }} onClick={(event) => event.stopPropagation()}>
            <div className="dialog-title">Edit reminder</div>
            <div className="dialog-body">
              <input
                className="input"
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && handleSaveEdit()}
                autoFocus
              />
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setEditingItem(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveEdit} disabled={!editText.trim()}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
