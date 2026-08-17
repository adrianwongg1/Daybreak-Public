import { ChevronLeftIcon, ChevronRightIcon } from "@/app/components/icons";

function Shimmer({ className }: { className: string }) {
  return <div aria-hidden="true" className={`loading-shimmer ${className}`} />;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A structural stand-in for the Calendar page's month grid, matching calendar-grid.tsx's exact layout so the loading state doesn't jump when real data arrives. Used both as the nested fallback while events stream in and inside the full-page CalendarSkeleton. */
export function CalendarGridSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading calendar</span>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            style={{ padding: "8px 0", textAlign: "center", fontSize: 12, fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}
          >
            {label}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {Array.from({ length: 35 }, (_, index) => (
          <div
            key={index}
            style={{
              border: "none",
              borderTop: "1px solid var(--color-divider)",
              borderLeft: "1px solid var(--color-divider)",
              minHeight: 72,
              padding: 8,
            }}
          >
            <Shimmer className="h-4 w-6 rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Full-page fallback for calendar/loading.tsx — the header itself needs data too on a hard load/refresh, so it stays shimmered here. */
export function CalendarSkeleton() {
  return (
    <div>
      <header style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button type="button" className="btn btn-secondary" disabled aria-hidden style={{ padding: "6px 10px", justifySelf: "start" }}>
          <ChevronLeftIcon size={16} />
        </button>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Shimmer className="h-9 w-48 rounded-(--radius-md)" />
        </div>
        <button type="button" className="btn btn-secondary" disabled aria-hidden style={{ padding: "6px 10px", justifySelf: "end" }}>
          <ChevronRightIcon size={16} />
        </button>
      </header>

      <CalendarGridSkeleton />
    </div>
  );
}
