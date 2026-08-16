"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { WeatherCard } from "@/app/(shell)/today/weather-card";
import { addSavedCityAction } from "@/app/lib/weather/actions";
import type { WeatherInfo } from "@/app/lib/briefing/types";

interface SearchResult {
  displayName: string;
  latitude: number;
  longitude: number;
  weather: WeatherInfo;
}

interface CitySuggestion {
  latitude: number;
  longitude: number;
  displayName: string;
}

// Ad-hoc lookup, separate from the user's own home_location/outfit — for
// checking weather somewhere else (a trip, a call with someone out of town),
// not for changing what the daily briefing generates. Hits
// app/api/weather/search, which wraps searchCityWeather()/getCityWeatherByCoordinates().
export function CityWeatherSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<CitySuggestion | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const [isAdding, startAdding] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  // Selecting a suggestion sets `query` to its full display name, which
  // would otherwise re-trigger the debounced fetch below and reopen the
  // dropdown right after we just closed it. Skip exactly one fetch when set.
  const justSelectedRef = useRef(false);

  // Debounced autocomplete — fires on every keystroke so the user can see
  // exactly which city they're about to search (disambiguates "which
  // Springfield") before any weather lookup happens.
  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const timeout = setTimeout(() => {
      fetch(`/api/weather/suggest?q=${encodeURIComponent(trimmed)}`)
        .then((res) => (res.ok ? res.json() : { suggestions: [] }))
        .then((data: { suggestions: CitySuggestion[] }) => {
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
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function runSearch(params: URLSearchParams, label: string) {
    setLoading(true);
    setError(null);
    setAdded(false);
    try {
      const res = await fetch(`/api/weather/search?${params}`);
      if (!res.ok) {
        setError(
          res.status === 404
            ? `Couldn't find "${label}".`
            : "Something went wrong — try again.",
        );
        setResult(null);
        return;
      }
      setResult((await res.json()) as SearchResult);
    } catch {
      setError("Something went wrong — try again.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function handleAdd() {
    if (!result) return;
    startAdding(async () => {
      try {
        await addSavedCityAction(
          result.latitude,
          result.longitude,
          result.displayName,
        );
        // Reset back to an empty search rather than leaving the just-added
        // city's card sitting here too — it now has its own card in the
        // saved-cities list above, so showing it a second time here is just
        // clutter to clear before searching for the next one.
        setQuery("");
        setSelectedSuggestion(null);
        setResult(null);
        setAdded(false);
        router.refresh();
      } catch {
        setError("Couldn't add that city — try again.");
      }
    });
  }

  function selectSuggestion(suggestion: CitySuggestion) {
    justSelectedRef.current = true;
    setSelectedSuggestion(suggestion);
    setQuery(suggestion.displayName);
    setShowSuggestions(false);
    setSuggestions([]);
    if (loading) return;
    void runSearch(
      new URLSearchParams({
        lat: String(suggestion.latitude),
        lon: String(suggestion.longitude),
        name: suggestion.displayName,
      }),
      suggestion.displayName,
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || loading) return;
    if (!selectedSuggestion || query !== selectedSuggestion.displayName) {
      setError("Select a city from the suggestions before searching.");
      setResult(null);
      return;
    }
    setShowSuggestions(false);
    setError(null);
    void runSearch(new URLSearchParams({ city: trimmed }), trimmed);
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
    <div
      style={{
        marginTop: 24,
        paddingTop: 20,
        borderTop: "1px solid var(--color-divider)",
      }}
    >
      <label
        style={{
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "color-mix(in srgb, var(--color-text) 60%, transparent)",
          display: "block",
          marginBottom: 8,
        }}
      >
        Search for another city
      </label>
      <div ref={containerRef} style={{ position: "relative", maxWidth: 360 }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="e.g. Tokyo"
            value={query}
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedSuggestion(null);
            }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="submit"
            className="btn btn-secondary"
            disabled={loading}
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        {showSuggestions &&
        suggestions.length > 0 &&
        query.trim().length >= 2 ? (
          <ul
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              marginTop: 4,
              listStyle: "none",
              padding: 0,
              margin: "4px 0 0",
              background: "var(--color-bg)",
              border: "1px solid var(--color-divider)",
              maxHeight: 220,
              overflowY: "auto",
              zIndex: 10,
            }}
          >
            {suggestions.map((suggestion, i) => (
              <li key={`${suggestion.latitude},${suggestion.longitude}`}>
                <button
                  type="button"
                  onClick={() => selectSuggestion(suggestion)}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  style={{
                    border: "none",
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    background:
                      i === highlightedIndex
                        ? "color-mix(in srgb, var(--color-accent) 8%, transparent)"
                        : "none",
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
      </div>

      {error ? (
        <p
          style={{ fontSize: 13, color: "var(--color-danger)", marginTop: 10 }}
        >
          {error}
        </p>
      ) : result ? (
        <div style={{ marginTop: 16 }}>
          <WeatherCard
            cityName={result.displayName}
            weather={result.weather}
            compact
            onAdd={added || isAdding ? undefined : handleAdd}
          />
          {added ? (
            <p
              style={{
                fontSize: 12.5,
                color: "color-mix(in srgb, var(--color-text) 55%, transparent)",
                margin: "8px 2px 0",
              }}
            >
              Added to Weather.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
