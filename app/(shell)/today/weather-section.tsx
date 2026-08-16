"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CityWeatherSearch } from "@/app/(shell)/today/city-weather-search";
import { WeatherCard } from "@/app/(shell)/today/weather-card";
import { UnavailableNote } from "@/app/components/unavailable-note";
import { refreshWeatherAction, removeSavedCityAction } from "@/app/lib/weather/actions";
import { backgroundSectionRefreshEnabled } from "@/app/lib/feature-flags";
import type { OutfitSuggestion, WeatherInfo } from "@/app/lib/briefing/types";

// Today page's Weather section — "Weather" as the section header, with the
// home-location WeatherCard underneath (which itself prints the city name),
// then any saved cities (each its own compact WeatherCard — no hourly
// strip, since only the home location gets that), then the "add a city"
// search. A client component (like MarketSection) so the header's Edit
// toggle and the saved-city list can share `editing` state — the Today
// page itself is a Server Component and can't hold that.
//
// `order` (city display names, in order) is kept as its own state — same
// shape MarketSection uses for `order` — so a future "reorder cities" pass
// only needs to add moveUp/moveDown handlers and a persistence action next
// to `handleRemove` below, not restructure this component.
export function WeatherSection({
  id,
  homeLocation,
  weather,
  outfit,
  savedCities,
  timeZone,
}: {
  id?: string;
  homeLocation: string | null;
  weather: WeatherInfo | null;
  outfit: OutfitSuggestion | null;
  savedCities: { displayName: string; weather: WeatherInfo }[];
  timeZone: string;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(() => savedCities.map((city) => city.displayName));
  const [weatherByCity, setWeatherByCity] = useState(
    () => new Map(savedCities.map((city) => [city.displayName, city.weather]))
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the list aligned with fresh server props after a refresh
    setOrder(savedCities.map((city) => city.displayName));
    setWeatherByCity(new Map(savedCities.map((city) => [city.displayName, city.weather])));
  }, [savedCities]);

  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleRemove(displayName: string) {
    setOrder((prev) => prev.filter((name) => name !== displayName));
    startTransition(async () => {
      await removeSavedCityAction(displayName);
      router.refresh();
    });
  }

  useEffect(() => {
    // Refresh only after the stored dashboard responds; Phase 4's cache
    // avoids a provider call until the forecast becomes stale.
    if (!backgroundSectionRefreshEnabled) return;
    // router.refresh() targets whichever page is current when it fires, not
    // necessarily this one — skip it if the user has already navigated away
    // while the refresh was still in flight, otherwise it refreshes the
    // wrong page and collides with whatever the user clicked next.
    let cancelled = false;
    startTransition(async () => {
      try {
        await refreshWeatherAction();
        if (!cancelled) router.refresh();
      } catch { /* retain the saved weather cards during a background failure */ }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per mount, like the effect it replaces
  }, []);

  return (
    <section id={id}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
        <h3 style={{ color: "var(--color-text)", margin: 0 }}>Weather</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {order.length > 0 ? (
            <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setEditing((e) => !e)} disabled={isPending}>
              {editing ? "Done" : "Edit"}
            </button>
          ) : null}
        </div>
      </div>

      {!weather && !outfit ? (
        <UnavailableNote label="Weather and outfit" />
      ) : weather ? (
        <WeatherCard cityName={homeLocation ?? "Current location"} weather={weather} outfit={outfit} isHome timeZone={timeZone} />
      ) : (
        <UnavailableNote label="Weather" />
      )}

      {order.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
          {order.map((displayName) => {
            const cityWeather = weatherByCity.get(displayName);
            if (!cityWeather) return null;
            return (
              <WeatherCard
                key={displayName}
                cityName={displayName}
                weather={cityWeather}
                compact
                onRemove={editing ? () => handleRemove(displayName) : undefined}
              />
            );
          })}
        </div>
      ) : null}

      <CityWeatherSearch />
    </section>
  );
}
