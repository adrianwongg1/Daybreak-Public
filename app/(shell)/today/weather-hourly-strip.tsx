"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, WeatherConditionIcon } from "@/app/components/icons";
import type { HourlyTemp } from "@/app/lib/briefing/types";

function EdgeArrow({ direction, onClick }: { direction: "left" | "right"; onClick: () => void }) {
  const isLeft = direction === "left";
  return (
    <button
      type="button"
      aria-label={isLeft ? "Show earlier hours" : "Show later hours"}
      onClick={onClick}
      style={{
        position: "absolute",
        top: "50%",
        [isLeft ? "left" : "right"]: -6,
        transform: "translateY(-50%)",
        width: 28,
        height: 28,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        border: "1px solid var(--color-divider)",
        background: "var(--color-bg)",
        boxShadow: "var(--shadow-sm)",
        color: "var(--color-text)",
        cursor: "pointer",
        zIndex: 2,
      }}
    >
      {isLeft ? <ChevronLeftIcon size={14} /> : <ChevronRightIcon size={14} />}
    </button>
  );
}

function localHourKey(timeZone: string | undefined, now: Date): string | null {
  if (!timeZone) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  return year && month && day && hour ? `${year}-${month}-${day}T${hour}:00` : null;
}

// The scrollable hour-by-hour row below a WeatherCard's main panel. Split
// out so it can sit under any card (not just the home-location one) once
// saved cities get their own hourly data.
//
// Edge arrows are the only affordance that this row scrolls (there's no
// visible scrollbar — see .scroll-x-bare) — each one only shows while
// there's actually more content in that direction, so a left arrow appears
// once the user has scrolled away from the start and disappears again at
// the far edges instead of both arrows just sitting there always enabled.
export function WeatherHourlyStrip({
  hourly,
  currentTempF,
  currentConditionCode,
  timeZone,
}: {
  hourly: HourlyTemp[];
  /** The same live reading shown as the card's big current-temp number — the "Now" entry below reuses it instead of the hourly forecast value for this hour, since those two are separate Open-Meteo figures (an instantaneous reading vs. an hourly-bucket forecast) that can legitimately disagree by a couple degrees. */
  currentTempF: number;
  currentConditionCode: number;
  timeZone?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const visibleHourly = useMemo(() => {
    const hourKey = localHourKey(timeZone, now);
    if (!hourKey || !hourly.some((hour) => hour.dateTime)) return hourly.slice(0, 24);
    return hourly.filter((hour) => !hour.dateTime || hour.dateTime >= hourKey).slice(0, 24);
  }, [hourly, now, timeZone]);

  function updateArrows() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }

  useEffect(() => {
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [visibleHourly]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function scrollByPage(direction: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direction * 220, behavior: "smooth" });
  }

  if (visibleHourly.length === 0) return null;

  return (
    <div style={{ position: "relative" }}>
      {canScrollLeft ? <EdgeArrow direction="left" onClick={() => scrollByPage(-1)} /> : null}

      <div
        ref={scrollRef}
        className="scroll-x-bare"
        onScroll={updateArrows}
        style={{ display: "flex", gap: 22, overflowX: "auto", padding: "18px 2px 4px" }}
      >
        {visibleHourly.map((hour, i) => (
          <div
            key={hour.dateTime ?? `${hour.time}-${i}`}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0, minWidth: 46 }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: i === 0 ? 700 : 400,
                color: i === 0 ? "var(--color-accent-700)" : "color-mix(in srgb, var(--color-text) 55%, transparent)",
              }}
            >
              {i === 0 ? "Now" : hour.time}
            </div>
            <WeatherConditionIcon code={i === 0 ? currentConditionCode : hour.weatherCode} size={22} className="shrink-0" />
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 15 }}>
              {i === 0 ? currentTempF : hour.tempF}°
            </div>
          </div>
        ))}
      </div>

      {canScrollRight ? <EdgeArrow direction="right" onClick={() => scrollByPage(1)} /> : null}
    </div>
  );
}
