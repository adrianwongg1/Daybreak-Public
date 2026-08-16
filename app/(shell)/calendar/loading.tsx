// Overrides app/(shell)/loading.tsx's Today-shaped DashboardSkeleton while
// this route's data resolves — same fix as app/(shell)/settings/loading.tsx,
// applied from the start so this new route doesn't introduce the bug.
export default function CalendarLoading() {
  return (
    <div>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>&nbsp;</h1>
      </header>
    </div>
  );
}
