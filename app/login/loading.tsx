// Same fix as app/signup/loading.tsx, same root cause: this route's
// getUser() call suspends, and with no route-local loading.tsx the root
// app/loading.tsx (DashboardSkeleton, built for the Today dashboard) showed
// instead. Mirrors the real page's static shell so the transition reads as
// instant instead of a mismatched loading state.
export default function LoginLoading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "center", padding: "48px 24px 0" }}>
        <span style={{ width: 20, height: 20, background: "var(--color-accent)", display: "inline-block" }} />
        <span className="nav-brand" style={{ fontSize: 32, marginRight: 0 }}>Daybreak</span>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <h2 style={{ margin: "0 0 32px", textAlign: "center" }}>Sign in</h2>
        </div>
      </div>
    </div>
  );
}
