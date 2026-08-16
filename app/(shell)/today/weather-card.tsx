import { PlusIcon, WeatherConditionIcon, XIcon } from "@/app/components/icons";
import { WeatherHourlyStrip } from "@/app/(shell)/today/weather-hourly-strip";
import { WeatherStats } from "@/app/(shell)/today/weather-stats";
import { formatCityName } from "@/app/lib/format-city-name";
import type { OutfitSuggestion, WeatherInfo } from "@/app/lib/briefing/types";

function CornerButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        width: 24,
        height: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        border: "none",
        background: "color-mix(in srgb, var(--color-text) 8%, transparent)",
        color: "color-mix(in srgb, var(--color-text) 65%, transparent)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// The full weather panel for one city — current conditions, stats, outfit
// note, and hourly strip. Deliberately self-contained (city name, data, and
// panel color are all props, nothing reaches into page-level state) so the
// Today page can render more than one of these side by side for saved
// cities later without changing this component at all. `accentColor`
// exists for that same forward-compat reason — a future per-city color
// just becomes a different prop value, not a new component. `onRemove`/
// `onAdd` stay optional and generic (not "onRemoveSavedCity") so this same
// card still works unchanged for the home location, which passes neither.
export function WeatherCard({
  cityName,
  weather,
  outfit,
  compact = false,
  accentColor = "var(--color-accent)",
  onRemove,
  onAdd,
  isHome = false,
  timeZone,
}: {
  cityName: string;
  weather: WeatherInfo;
  outfit?: OutfitSuggestion | null;
  compact?: boolean;
  accentColor?: string;
  onRemove?: () => void;
  onAdd?: () => void;
  isHome?: boolean;
  timeZone?: string;
}) {
  return (
    <div>
      <div
        style={{
          position: "relative",
          padding: compact ? "16px 18px 12px" : "22px 26px",
          borderRadius: "var(--radius-lg)",
          background: `color-mix(in srgb, ${accentColor} 10%, var(--color-surface))`,
          border:
            "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
        }}
      >
        {onRemove ? (
          <CornerButton onClick={onRemove} label={`Remove ${cityName}`}>
            <XIcon size={12} />
          </CornerButton>
        ) : onAdd ? (
          <CornerButton onClick={onAdd} label={`Add ${cityName} to Weather`}>
            <PlusIcon size={12} />
          </CornerButton>
        ) : null}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: compact ? 10 : 14,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: compact ? 20 : 24,
              fontWeight: 700,
            }}
          >
            {formatCityName(cityName)}
          </div>
          {isHome ? <span className="tag tag-accent">Home</span> : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: compact ? "flex-start" : "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: compact ? "row" : "column",
              alignItems: compact ? "center" : "stretch",
              gap: compact ? 18 : 0,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 800,
                fontSize: compact ? 36 : 56,
                lineHeight: 1,
              }}
            >
              {weather.currentTempF}°
            </div>
            <WeatherStats weather={weather} compact={compact} />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: compact ? "row" : "column",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <WeatherConditionIcon
              code={weather.conditionCode}
              size={compact ? 32 : 52}
            />
            <div style={{ fontSize: compact ? 16 : 13, fontWeight: 500, whiteSpace: "nowrap" }}>
              {weather.condition}
            </div>
          </div>
        </div>
      </div>

      {outfit ? (
        <p
          style={{
            margin: "10px 2px 0",
            fontSize: 14,
            color: "color-mix(in srgb, var(--color-text) 65%, transparent)",
          }}
        >
          {outfit.summary}
        </p>
      ) : null}

      {weather.hourly && weather.hourly.length > 0 ? (
        <WeatherHourlyStrip
          hourly={weather.hourly}
          currentTempF={weather.currentTempF}
          currentConditionCode={weather.conditionCode}
          timeZone={timeZone}
        />
      ) : null}
    </div>
  );
}
