function Shimmer({ className }: { className: string }) {
  return <div aria-hidden="true" className={`loading-shimmer ${className}`} />;
}

function FieldSkeleton({ labelWidth = "w-24" }: { labelWidth?: string }) {
  return (
    <div className="field">
      <Shimmer className={`h-3 ${labelWidth} rounded-sm mb-2`} />
      <Shimmer className="h-10 w-full rounded-(--radius-md)" />
    </div>
  );
}

/** A structural stand-in for the Settings page, matching settings-preferences.tsx's real section layout so the loading state doesn't jump when real data arrives. */
export function SettingsSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading settings</span>

      <header style={{ marginBottom: 24 }}>
        <h6 style={{ margin: "0 0 8px", color: "var(--color-accent-700)" }}>Preferences</h6>
        <h1 style={{ margin: 0 }}>Settings</h1>
      </header>

      <h3 style={{ margin: "0 0 14px" }}>Name</h3>
      <FieldSkeleton />

      <hr className="hr" style={{ margin: "28px 0" }} />

      <h3 style={{ margin: "0 0 14px" }}>Briefing schedule</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton />
      </div>

      <hr className="hr" style={{ margin: "28px 0" }} />

      <h3 style={{ margin: "0 0 14px" }}>News topics</h3>
      <div style={{ display: "flex", gap: 8 }}>
        <Shimmer className="h-8 w-20 rounded-full" />
        <Shimmer className="h-8 w-28 rounded-full" />
        <Shimmer className="h-8 w-24 rounded-full" />
      </div>

      <hr className="hr" style={{ margin: "28px 0" }} />

      <h3 style={{ margin: "0 0 14px" }}>Location &amp; outfit</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px 16px" }}>
        <FieldSkeleton />
        <FieldSkeleton />
      </div>

      <hr className="hr" style={{ margin: "28px 0" }} />

      <h3 style={{ margin: "0 0 14px" }}>Today page sections</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {Array.from({ length: 5 }, (_, index) => (
          <Shimmer key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
