// Degraded-state note (PRD 7.2: a failed data source never blocks the rest
// of the briefing, it just shows this inline instead).
export function UnavailableNote({ label }: { label: string }) {
  return (
    <p style={{ fontSize: 13, fontStyle: "italic", color: "color-mix(in srgb, var(--color-text) 55%, transparent)", margin: 0 }}>
      {label} unavailable right now.
    </p>
  );
}
