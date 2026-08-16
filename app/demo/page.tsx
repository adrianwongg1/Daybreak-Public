import Link from "next/link";

const stories = [
  {
    topic: "World",
    source: "The Guardian",
    headline: "Leaders gather as markets and policy take center stage",
    summary: "A concise view of the developments shaping the global conversation this morning.",
  },
  {
    topic: "Technology",
    source: "The New York Times",
    headline: "The next chapter of AI moves from experiments to everyday work",
    summary: "What the latest wave of tools means for people, teams, and the way work gets done.",
  },
  {
    topic: "Business",
    source: "The Guardian",
    headline: "Investors look ahead to a busy week of economic signals",
    summary: "The essential context behind the numbers worth watching today.",
  },
];

const quotes = [
  ["SPY", "S&P 500 ETF", "$634.42", "+0.6%"],
  ["NVDA", "NVIDIA", "$178.31", "+1.2%"],
  ["BTC-USD", "Bitcoin", "$116,820", "−0.4%"],
];

// This route deliberately has no dependency on auth, Supabase, or live
// providers. It is a shareable product walkthrough, not a shortcut around
// the signed-in experience or a window into anyone's real briefing.
export default function DemoPage() {
  return (
    <div className="min-h-dvh bg-(--color-bg)">
      <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-(--color-divider) bg-[color-mix(in_srgb,var(--color-bg)_92%,transparent)] px-5 py-3 backdrop-blur-md sm:px-8 lg:px-12">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-(--color-accent) shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_15%,transparent)]" />
          <span className="font-(--font-heading) text-xl font-semibold tracking-tight text-(--color-text)">Daybreak</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-[color-mix(in_srgb,var(--color-text)_58%,transparent)] sm:inline">Interactive product preview</span>
          <Link href="/login" className="btn btn-secondary">Sign in</Link>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-5xl px-5 pb-20 pt-8 sm:px-8 sm:pt-12 lg:px-12">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-(--color-divider) pb-5">
          <div>
            <h6 className="mb-3 text-(--color-accent-700)">Friday, August 8</h6>
            <h1>Good morning, Alex.</h1>
            <p className="mt-3 text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">Your considered briefing for the day ahead.</p>
          </div>
          <span className="tag tag-accent">Demo data</span>
        </div>

        <section className="rounded-[var(--radius-lg)] border border-(--color-divider) bg-(--color-surface) p-5 sm:p-6">
          <p className="text-sm font-semibold">Ask Daybreak</p>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-(--color-divider) bg-(--color-bg) px-4 py-3 text-sm text-[color-mix(in_srgb,var(--color-text)_52%,transparent)]">
            <span>Try: “Remind me to call the dentist tomorrow at noon.”</span>
            <span className="rounded-full bg-(--color-accent-100) px-2 py-0.5 text-xs font-semibold text-(--color-accent-700)">Preview</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {["What should I wear?", "Summarize my day", "Add a reminder"].map((prompt) => (
              <span key={prompt} className="command-suggestion-chip">{prompt}</span>
            ))}
          </div>
        </section>

        <hr className="hr my-7 sm:my-8" />
        <section>
          <div className="mb-4 flex items-center justify-between"><h3>Reminders</h3></div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[["Today", "Call the dentist", "12:00 PM"], ["Tomorrow", "Portfolio review", "9:00 AM"], ["Fri", "Pick up dry cleaning", "5:30 PM"]].map(([when, title, time]) => (
              <article key={title} className="rounded-[var(--radius-md)] border border-(--color-divider) bg-(--color-surface) p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-(--color-accent-700)">{when} · {time}</p>
                <h4 className="text-lg">{title}</h4>
              </article>
            ))}
          </div>
        </section>

        <hr className="hr my-7 sm:my-8" />
        <section>
          <h3 className="mb-4">Weather</h3>
          <div className="rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] bg-[color-mix(in_srgb,var(--color-accent)_10%,var(--color-surface))] p-6 sm:flex sm:items-center sm:justify-between">
            <div><div className="mb-2 flex items-center gap-2"><h4 className="mb-0 text-2xl">San Francisco</h4><span className="tag tag-accent">Home</span></div><p className="mb-0 text-6xl font-(--font-heading) font-bold leading-none">64°</p></div>
            <div className="mt-6 sm:mt-0 sm:text-right"><p className="mb-1 text-3xl">☀️</p><p className="mb-0 font-medium">Clear skies</p><p className="mt-1 text-sm text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">High 68° · Low 54° · Light wind</p></div>
          </div>
          <p className="mt-3 text-sm text-[color-mix(in_srgb,var(--color-text)_65%,transparent)]">A light layer will be useful near the bay this evening.</p>
        </section>

        <hr className="hr my-7 sm:my-8" />
        <section>
          <h3 className="mb-4">Markets</h3>
          <div className="overflow-hidden rounded-[var(--radius-md)] border border-(--color-divider)">
            <table className="w-full text-left text-sm"><thead className="bg-(--color-surface) text-xs uppercase tracking-wide text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]"><tr><th className="px-4 py-3">Ticker</th><th className="px-4 py-3">Name</th><th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3 text-right">Today</th></tr></thead><tbody>{quotes.map(([symbol, name, price, change]) => <tr key={symbol} className="border-t border-(--color-divider)"><td className="px-4 py-3 font-semibold">{symbol}</td><td className="px-4 py-3 text-[color-mix(in_srgb,var(--color-text)_65%,transparent)]">{name}</td><td className="px-4 py-3 text-right">{price}</td><td className={`px-4 py-3 text-right font-semibold ${change.startsWith("+") ? "text-(--color-success)" : "text-(--color-danger)"}`}>{change}</td></tr>)}</tbody></table>
          </div>
        </section>

        <hr className="hr my-7 sm:my-8" />
        <section>
          <h3 className="mb-4">News</h3>
          <div className="flex flex-col gap-6">{stories.map((story) => <article key={story.headline}><div className="mb-2 flex gap-2"><span className="tag tag-accent">{story.topic}</span><span className="tag tag-neutral">{story.source}</span></div><h4 className="text-xl">{story.headline}</h4><p className="mb-0 max-w-2xl text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">{story.summary}</p></article>)}</div>
        </section>

        <footer className="mt-12 border-t border-(--color-divider) pt-6 text-center"><p className="text-sm text-[color-mix(in_srgb,var(--color-text)_58%,transparent)]">This is a fictional Daybreak briefing, built to show the product experience.</p><Link href="/signup" className="btn btn-primary mt-2">Create your account</Link></footer>
      </main>
    </div>
  );
}
