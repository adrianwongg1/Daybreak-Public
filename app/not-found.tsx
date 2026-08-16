import Link from "next/link";

// Root app/not-found.tsx per PRD Phase 6's "general UI polish and
// error-state pass" — Next.js renders this for any unmatched URL app-wide
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md),
// not just a notFound() call inside a route segment.
export default function NotFound() {
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
      <h6 style={{ margin: "0 0 8px", color: "var(--color-accent-700)" }}>404</h6>
      <h1 style={{ margin: "0 0 12px" }}>Page not found</h1>
      <p className="text-muted" style={{ fontSize: 14, marginBottom: 28, maxWidth: 360 }}>
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link href="/" className="btn btn-primary">
        Back to Daybreak
      </Link>
    </div>
  );
}
