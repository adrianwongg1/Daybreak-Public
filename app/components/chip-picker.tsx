"use client";

import { useEffect, useRef, useState } from "react";
import { XIcon } from "@/app/components/icons";

interface ChipPickerProps {
  values: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  catalog: readonly string[];
  addLabel: string; // "+ Add topic" / "+ Add ticker"
  searchPlaceholder: string; // "Search a topic"
}

// Shared add/remove chip picker (design_handoff_daybreak_app) — used for
// both News topics and Market tickers, in both Settings and onboarding. The
// app now treats these selections as controlled, validated choices rather
// than free-form strings for the briefing experience.
export function ChipPicker({ values, onAdd, onRemove, catalog, addLabel, searchPlaceholder }: ChipPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function add(value: string) {
    const trimmed = value.trim();
    if (!trimmed || values.includes(trimmed)) return;
    onAdd(trimmed);
    setOpen(false);
    setQuery("");
  }

  const queryLower = query.trim().toLowerCase();
  const suggestions = catalog.filter((c) => !values.includes(c) && c.toLowerCase().includes(queryLower)).slice(0, 8);

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {values.map((value) => (
        <span key={value} className="tag tag-outline" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {value}
          <button
            type="button"
            onClick={() => onRemove(value)}
            aria-label={`Remove ${value}`}
            style={{ display: "inline-flex", background: "none", border: "none", padding: 0, color: "inherit", cursor: "pointer" }}
          >
            <XIcon size={10} />
          </button>
        </span>
      ))}
      <div ref={containerRef} style={{ position: "relative" }}>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setOpen((o) => !o)}>
          {addLabel}
        </button>
        {open ? (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              minWidth: 220,
              background: "var(--color-bg)",
              border: "2px solid var(--color-divider)",
              boxShadow: "var(--shadow-md)",
              zIndex: 20,
              padding: 10,
            }}
          >
            <input
              ref={inputRef}
              className="input"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ marginBottom: 8 }}
            />
            <div style={{ display: "flex", flexDirection: "column", maxHeight: 180, overflowY: "auto" }}>
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => add(s)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    padding: "8px 6px",
                    fontSize: 13,
                    fontFamily: "var(--font-body)",
                    color: "var(--color-text)",
                    cursor: "pointer",
                  }}
                >
                  {s}
                </button>
              ))}
              {query.trim().length > 0 && suggestions.length === 0 ? (
                <div style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 55%, transparent)", padding: "8px 6px" }}>
                  Choose one of the available options.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
