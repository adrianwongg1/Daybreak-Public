"use client";

import { useEffect, useRef, useState } from "react";

interface CitySuggestion {
  latitude: number;
  longitude: number;
  displayName: string;
}

interface LocationAutocompleteProps {
  placeholder?: string;
  disabled?: boolean;
  initialValue?: string;
  onSelect: (displayName: string) => void;
}

export function LocationAutocomplete({ placeholder = "City, State/Country", disabled = false, initialValue = "", onSelect }: LocationAutocompleteProps) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the autocomplete input in sync with the parent selection while preserving local typing state
    setQuery(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- this effect is the debounced fetch trigger; clearing suggestions is part of that sync
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      fetch(`/api/weather/suggest?q=${encodeURIComponent(trimmed)}`)
        .then((res) => (res.ok ? res.json() : { suggestions: [] }))
        .then((data: { suggestions: CitySuggestion[] }) => {
          setSuggestions(data.suggestions);
          setShowSuggestions(data.suggestions.length > 0);
          setHighlightedIndex(-1);
          setError(null);
        })
        .catch(() => {
          setSuggestions([]);
          setError("Couldn't load city suggestions right now.");
        });
    }, 250);

    return () => window.clearTimeout(timeout);
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

  function selectSuggestion(suggestion: CitySuggestion) {
    justSelectedRef.current = true;
    setQuery(suggestion.displayName);
    setSuggestions([]);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    onSelect(suggestion.displayName);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
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
        type="text"
        className="input"
        placeholder={placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoComplete="off"
      />

      {showSuggestions && suggestions.length > 0 && query.trim().length >= 2 ? (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            listStyle: "none",
            padding: 0,
            background: "var(--color-bg)",
            border: "1px solid var(--color-divider)",
            maxHeight: 220,
            overflowY: "auto",
            zIndex: 20,
          }}
        >
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.latitude},${suggestion.longitude}`}>
              <button
                type="button"
                onClick={() => selectSuggestion(suggestion)}
                onMouseEnter={() => setHighlightedIndex(index)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  background: index === highlightedIndex ? "color-mix(in srgb, var(--color-accent) 8%, transparent)" : "none",
                  padding: "8px 12px",
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: 13.5,
                  color: "inherit",
                }}
              >
                {suggestion.displayName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p style={{ fontSize: 12, color: "var(--color-danger)", marginTop: 6 }}>{error}</p> : null}
    </div>
  );
}
