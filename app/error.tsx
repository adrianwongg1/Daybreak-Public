"use client";

import { useEffect } from "react";

// Root app/error.tsx per PRD Phase 6's "general UI polish and error-state
// pass" — a React error boundary for uncaught exceptions in any route
// segment that doesn't have its own error.tsx, so a rendering bug shows an
// on-brand fallback instead of Next's raw default. `unstable_retry` (not
// the older `reset`) is this Next version's documented recovery function —
// see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md's
// version history: added in v16.2.0, which this app is on (16.2.11).
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <h6 style={{ margin: "0 0 8px", color: "var(--color-danger)" }}>Error</h6>
      <h1 style={{ margin: "0 0 12px" }}>Something went wrong</h1>
      <p className="text-muted" style={{ fontSize: 14, marginBottom: 28, maxWidth: 360 }}>
        An unexpected error occurred loading this page. This has been logged.
      </p>
      <button type="button" className="btn btn-primary" onClick={() => unstable_retry()}>
        Try again
      </button>
    </div>
  );
}
