// Overrides app/(shell)/loading.tsx (DashboardSkeleton, built for Today's
// weather/markets/news layout) while this route's data resolves — flashing
// that here, for a plain preferences form, read as a rendering bug. Mirrors
// Settings' actual static shell so the transition reads as instant instead
// of a mismatched loading state.
export default function SettingsLoading() {
  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h6 style={{ margin: "0 0 8px", color: "var(--color-accent-700)" }}>Preferences</h6>
        <h1 style={{ margin: 0 }}>Settings</h1>
      </header>
    </div>
  );
}
