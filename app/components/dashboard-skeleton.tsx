function Shimmer({ className }: { className: string }) {
  return <div aria-hidden="true" className={`loading-shimmer ${className}`} />;
}

/**
 * A structural stand-in for the Today page. It contains no user data or API
 * work, so it can stream immediately while the server resolves the session
 * and stored briefing.
 */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-5xl">
      <span className="sr-only">Loading your briefing</span>

      <header className="mb-5 border-b border-(--color-divider) pb-4 sm:mb-6 sm:pb-5">
        <h6 className="mb-3 text-(--color-accent-700)">Your daily briefing</h6>
        <h1 className="max-w-2xl text-(--color-text)">Good day.</h1>
        <p className="mt-3 max-w-xl text-sm text-[color-mix(in_srgb,var(--color-text)_60%,transparent)] sm:text-base">
          Your considered briefing for the day ahead.
        </p>
      </header>

      <section className="rounded-(--radius-lg) border border-(--color-divider) bg-(--color-surface) p-5 sm:p-6">
        <label className="block text-[11px] uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">Chat with Daybreak</label>
        <p className="mt-2 text-sm text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]">
          Ask naturally about your day, reminders, or events.
        </p>
        <div className="mt-5 flex gap-2 overflow-hidden">
          <button type="button" className="btn btn-secondary shrink-0 rounded-full px-3 py-1.5 text-xs" disabled>Add a reminder</button>
          <button type="button" className="btn btn-secondary shrink-0 rounded-full px-3 py-1.5 text-xs" disabled>Summarize my week</button>
          <button type="button" className="btn btn-secondary btn-icon shrink-0 rounded-full" disabled aria-label="Add command recommendation">+</button>
        </div>
        <div className="mt-3 flex gap-2">
          <div className="input flex-1 text-[color-mix(in_srgb,var(--color-text)_50%,transparent)]">Message Daybreak…</div>
          <button type="button" className="btn btn-primary btn-icon" disabled aria-label="Send">↑</button>
        </div>
      </section>

      <section className="border-t border-(--color-divider) py-7 sm:py-8">
        <div className="flex items-center justify-between gap-4">
          <h3 className="mb-0">Reminders</h3>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <Shimmer className="h-11 rounded-(--radius-md)" />
          <Shimmer className="h-11 rounded-(--radius-md)" />
        </div>
      </section>

      <section className="border-t border-(--color-divider) py-7 sm:py-8">
        <div className="flex items-center justify-between gap-4">
          <h3 className="mb-0">Weather</h3>
          <button type="button" className="btn btn-ghost text-xs" disabled>Edit</button>
        </div>
        <div className="mt-5 rounded-(--radius-lg) border border-(--color-divider) p-5 sm:p-6">
          <div className="flex items-start justify-between gap-5">
            <Shimmer className="h-16 w-28 rounded-md" />
            <Shimmer className="h-14 w-14 rounded-full" />
          </div>
          <div className="mt-6 flex gap-4 overflow-hidden">
            {Array.from({ length: 8 }, (_, index) => (
              <Shimmer key={index} className="h-16 w-12 shrink-0 rounded-(--radius-sm)" />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-(--color-divider) py-7 sm:py-8">
        <div className="flex items-center justify-between gap-4">
          <h3 className="mb-0">Markets</h3>
          <button type="button" className="btn btn-ghost text-xs" disabled>Edit</button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Shimmer key={index} className="h-24 rounded-(--radius-md)" />
          ))}
        </div>
      </section>

      <section className="border-t border-(--color-divider) py-7 sm:py-8">
        <div className="flex items-center justify-between gap-4">
          <h3 className="mb-0">News</h3>
          <button type="button" className="btn btn-ghost text-xs" disabled>Refresh</button>
        </div>
        <div className="mt-5 space-y-3">
          <Shimmer className="h-16 w-full rounded-(--radius-md)" />
          <Shimmer className="h-16 w-full rounded-(--radius-md)" />
          <Shimmer className="h-16 w-11/12 rounded-(--radius-md)" />
        </div>
      </section>
    </div>
  );
}
