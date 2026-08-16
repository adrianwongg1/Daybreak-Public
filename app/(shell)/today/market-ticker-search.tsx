"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { addMarketTickerAction } from "@/app/lib/markets/actions";
import type { MarketQuote } from "@/app/lib/briefing/types";

interface TickerSuggestion {
  symbol: string;
  name: string;
}

// Real-time symbol search (Finnhub's Symbol Lookup, via /api/markets/search)
// rather than the static ~10-ticker catalog Settings' ChipPicker offers —
// same debounced-dropdown UX as app/(shell)/today/city-weather-search.tsx,
// adapted to add straight into the Markets table below instead of showing a
// separate result card.
export function MarketTickerSearch({ onAdd }: { onAdd: (quote: MarketQuote) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<TickerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < 1) return;

    const timeout = setTimeout(() => {
      fetch(`/api/markets/search?q=${encodeURIComponent(trimmed)}`)
        .then((res) => (res.ok ? res.json() : { suggestions: [] }))
        .then((data: { suggestions: TickerSuggestion[] }) => {
          setSuggestions(data.suggestions);
          setShowSuggestions(data.suggestions.length > 0);
          setHighlightedIndex(-1);
        })
        .catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function selectSuggestion(suggestion: TickerSuggestion) {
    justSelectedRef.current = true;
    setShowSuggestions(false);
    setSuggestions([]);
    setError(null);
    startTransition(async () => {
      try {
        const result = await addMarketTickerAction(suggestion.symbol, suggestion.name);
        if (result.quote) {
          onAdd(result.quote);
          setQuery("");
          router.refresh();
        } else {
          setError(`Couldn't get a quote for ${suggestion.symbol}.`);
        }
      } catch {
        setError("Something went wrong — try again.");
      }
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[highlightedIndex]);
    } else if (event.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        className="input"
        style={{ width: 180, fontSize: 13, padding: "6px 10px" }}
        placeholder="Add ticker…"
        value={query}
        autoComplete="off"
        disabled={isPending}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
      />

      {showSuggestions && suggestions.length > 0 && query.trim().length >= 1 ? (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            listStyle: "none",
            padding: 0,
            width: 260,
            background: "var(--color-bg)",
            border: "1px solid var(--color-divider)",
            maxHeight: 240,
            overflowY: "auto",
            zIndex: 10,
          }}
        >
          {suggestions.map((suggestion, i) => (
            <li key={suggestion.symbol}>
              <button
                type="button"
                onClick={() => selectSuggestion(suggestion)}
                onMouseEnter={() => setHighlightedIndex(i)}
                style={{
                  border: "none",
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 12px",
                  background: i === highlightedIndex ? "color-mix(in srgb, var(--color-accent) 8%, transparent)" : "none",
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: 13,
                  color: "inherit",
                }}
              >
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700 }}>{suggestion.symbol}</span>
                <span
                  style={{
                    color: "color-mix(in srgb, var(--color-text) 60%, transparent)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {suggestion.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, fontSize: 11.5, color: "var(--color-danger)", width: 200, textAlign: "right" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
