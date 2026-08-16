"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PencilIcon, PlusIcon, SendIcon, XIcon } from "@/app/components/icons";
import { MAX_COMMAND_SUGGESTIONS } from "@/app/lib/commands/suggestions";
import { saveCommandSuggestionsAction } from "@/app/lib/commands/suggestion-actions";

interface EventOption {
  id: string;
  label: string;
}

interface CommandResponse {
  commandId: string;
  status: "auto_executed" | "confirmed" | "rejected" | "pending";
  message: string;
  disambiguation?: { options: EventOption[] };
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export function CommandBar({
  initialText,
  suggestions: initialSuggestions,
}: {
  initialText?: string;
  suggestions: string[];
}) {
  const router = useRouter();
  const [text, setText] = useState(initialText ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState<CommandResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [savedSuggestions, setSavedSuggestions] = useState(initialSuggestions);
  const [editingSuggestion, setEditingSuggestion] = useState<{ index: number | null; value: string } | null>(null);
  const [savingSuggestion, setSavingSuggestion] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const suggestions = savedSuggestions;
  const showSuggestionEditors = !submitting && !text.trim();

  // A command can change data other parts of this Server-rendered page
  // already fetched (a created calendar event, a completed reminder) —
  // router.refresh() re-runs the page's server data fetch so those
  // sections pick it up without the user having to manually reload.
  // Called after every response, not just successful ones: cheap, and
  // simpler than tracking which specific intents mutate something.
  function refreshAfter(result: CommandResponse): CommandResponse {
    router.refresh();
    return result;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          context: messages.map((message) => `${message.role === "user" ? "User" : "Daybreak"}: ${message.text}`),
        }),
      });
      if (!res.ok) {
        setResponse({
          commandId: "",
          status: "rejected",
          message: "Something went wrong — try again.",
        });
        return;
      }
      const result = refreshAfter((await res.json()) as CommandResponse);
      setMessages((previous) => [...previous, { role: "user", text: trimmed }, { role: "assistant", text: result.message }]);
      setResponse(result);
      setText("");
    } catch {
      setResponse({
        commandId: "",
        status: "rejected",
        message: "Something went wrong — try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePickOption(eventId: string) {
    if (!response || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/commands/${response.commandId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) {
        setResponse({
          commandId: response.commandId,
          status: "rejected",
          message: "Something went wrong — try again.",
        });
        return;
      }
      const result = refreshAfter((await res.json()) as CommandResponse);
      setMessages((previous) => [...previous, { role: "assistant", text: result.message }]);
      setResponse(result);
    } catch {
      setResponse({
        commandId: response.commandId,
        status: "rejected",
        message: "Something went wrong — try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleDismiss() {
    setResponse(null);
  }

  async function saveSuggestions(next: string[]) {
    setSavingSuggestion(true);
    setSuggestionError(null);
    try {
      const saved = await saveCommandSuggestionsAction(next);
      setSavedSuggestions(saved);
      setEditingSuggestion(null);
    } catch {
      setSuggestionError("Couldn't save that command — try again.");
    } finally {
      setSavingSuggestion(false);
    }
  }

  async function submitSuggestion(event: React.FormEvent) {
    event.preventDefault();
    if (!editingSuggestion) return;
    const value = editingSuggestion.value.trim();
    if (!value) {
      setSuggestionError("Enter a command first.");
      return;
    }
    const next = editingSuggestion.index === null
      ? [...savedSuggestions, value]
      : savedSuggestions.map((suggestion, index) => index === editingSuggestion.index ? value : suggestion);
    await saveSuggestions(next);
  }

  async function deleteSuggestion() {
    if (editingSuggestion?.index === null || editingSuggestion?.index === undefined) return;
    await saveSuggestions(savedSuggestions.filter((_, index) => index !== editingSuggestion.index));
  }

  return (
    <section className="rounded-2xl border border-(--color-divider) bg-[color-mix(in_srgb,var(--color-surface)_88%,var(--color-bg))] p-4 shadow-(--shadow-sm) sm:p-5">
      <label
        style={{
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "color-mix(in srgb, var(--color-text) 60%, transparent)",
          display: "block",
          marginBottom: 8,
        }}
      >Chat with Daybreak</label>
      {messages.length > 0 ? (
        <div className="mb-4 flex flex-col gap-2" aria-live="polite">
          {messages.map((message, index) => (
            <p
              key={`${message.role}-${index}`}
              style={{
                alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                margin: 0,
                maxWidth: "85%",
                padding: "9px 11px",
                fontSize: 13,
                fontWeight: 600,
                background: message.role === "user" ? "var(--color-chat-user-bg)" : "var(--color-chat-assistant-bg)",
                color: message.role === "user" ? "var(--color-chat-user-text)" : "var(--color-text)",
                border: message.role === "user" ? undefined : "1px solid var(--color-divider)",
                borderRadius: 12,
              }}
            >
              {message.text}
            </p>
          ))}
        </div>
      ) : null}
      <div style={{ marginBottom: 12 }}>
        <p className="mb-2 text-sm text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]">
          Ask naturally about your day, reminders, or events.
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {suggestions.map((example, index) => (
              <div key={`${example}-${index}`} className="command-suggestion group">
                <button
                  type="button"
                  className="command-suggestion-chip"
                  disabled={submitting || savingSuggestion}
                  onClick={() => {
                    setText(example);
                    setResponse(null);
                  }}
                >
                  {example}
                </button>
                {showSuggestionEditors ? (
                  <button
                    type="button"
                    className="command-suggestion-edit"
                    aria-label={`Edit ${example}`}
                    disabled={savingSuggestion}
                    onClick={() => {
                      setSuggestionError(null);
                      setEditingSuggestion({ index, value: example });
                    }}
                  >
                    <PencilIcon size={11} />
                  </button>
                ) : null}
              </div>
          ))}
          <button
            type="button"
            className="command-suggestion-add"
            aria-label="Add command recommendation"
            title={suggestions.length >= MAX_COMMAND_SUGGESTIONS ? `Limit of ${MAX_COMMAND_SUGGESTIONS} commands` : "Add command recommendation"}
            disabled={submitting || savingSuggestion || suggestions.length >= MAX_COMMAND_SUGGESTIONS}
            onClick={() => {
              setSuggestionError(null);
              setEditingSuggestion({ index: null, value: "" });
            }}
          >
            <PlusIcon size={14} />
          </button>
        </div>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (response) setResponse(null);
          }}
          placeholder="Message Daybreak…"
          disabled={submitting}
        />
        <button
          type="submit"
          className="btn btn-primary btn-icon"
          aria-label="Send"
          disabled={submitting || !text.trim()}
        >
          <SendIcon size={14} />
        </button>
      </form>

      {submitting && !response ? (
        <div className="mt-3 flex h-5 items-center" role="status" aria-label="Processing your command">
          <span className="spin h-4 w-4 rounded-full border-2 border-(--color-divider) border-t-(--color-accent)" aria-hidden="true" />
        </div>
      ) : null}

      {response?.status === "pending" && response.disambiguation ? (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            border: "1px solid var(--color-divider)",
            background: "var(--color-bg)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {response.disambiguation.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="btn btn-secondary btn-block"
                disabled={submitting}
                onClick={() => handlePickOption(option.id)}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-ghost"
              style={{ alignSelf: "flex-start" }}
              onClick={handleDismiss}
            >
              Never mind
            </button>
          </div>
        </div>
      ) : null}

      {editingSuggestion ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="command-suggestion-title"
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
        >
          <form
            className="w-full max-w-md rounded-(--radius-lg) border border-(--color-divider) bg-(--color-bg) p-5 shadow-(--shadow-lg)"
            onSubmit={submitSuggestion}
          >
            <div className="flex items-center justify-between gap-4">
              <h3 id="command-suggestion-title" className="mb-0 text-xl">
                {editingSuggestion.index === null ? "Add command" : "Edit command"}
              </h3>
              <button type="button" className="btn btn-icon" aria-label="Close" disabled={savingSuggestion} onClick={() => setEditingSuggestion(null)}>
                <XIcon size={15} />
              </button>
            </div>
            <label className="field mt-5">
              <span>Command</span>
              <input
                autoFocus
                className="input"
                value={editingSuggestion.value}
                maxLength={160}
                disabled={savingSuggestion}
                onChange={(event) => setEditingSuggestion({ ...editingSuggestion, value: event.target.value })}
                placeholder="e.g. Plan my workouts this week"
              />
            </label>
            {suggestionError ? <p className="mt-3 text-sm text-(--color-danger)">{suggestionError}</p> : null}
            <div className="mt-5 flex items-center justify-between gap-3">
              {editingSuggestion.index === null ? <span /> : (
                <button type="button" className="btn btn-ghost text-(--color-danger)" disabled={savingSuggestion} onClick={deleteSuggestion}>
                  Delete
                </button>
              )}
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary" disabled={savingSuggestion} onClick={() => setEditingSuggestion(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingSuggestion}>{savingSuggestion ? "Saving…" : "Save"}</button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

    </section>
  );
}
