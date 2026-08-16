import type { WeatherInfo } from "@/app/lib/briefing/types";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "color-mix(in srgb, var(--color-text) 55%, transparent)",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// The row of secondary readings next to a WeatherCard's big current temp —
// split out so it's reused identically for every card (home location,
// ad-hoc city search, and any saved city) rather than duplicated. In compact
// cards it sits beside the temp (no top margin needed); the full-size home
// card still stacks it underneath.
export function WeatherStats({
  weather,
  compact = false,
}: {
  weather: WeatherInfo;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: compact ? 14 : 20,
        marginTop: compact ? 0 : 14,
      }}
    >
      <Stat label="Feels like" value={`${weather.feelsLikeF}°`} />
      <Stat label="High" value={`${weather.tempHighF}°`} />
      <Stat label="Low" value={`${weather.tempLowF}°`} />
      <Stat
        label="Chance of rain"
        value={`${Math.round(weather.precipitationProbabilityPct)}%`}
      />
      <Stat label="Max UV index" value={`${weather.uvIndexMax}`} />
    </div>
  );
}
