import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/app/lib/supabase/auth-server";
import { requireCompletedSession } from "@/app/lib/auth/require-completed-session";

// Signed-in people still land directly in their personal workspace. Everyone
// else gets a public introduction and can explore the privacy-safe demo
// with no account required.
export default async function RootPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    await requireCompletedSession();
    redirect("/today");
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <nav className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-(--color-accent) shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_15%,transparent)]" />
          <span className="font-(--font-heading) text-xl font-semibold tracking-tight text-(--color-text)">Daybreak</span>
        </Link>
        <Link href="/login" className="btn btn-secondary">Sign in</Link>
      </nav>

      <section className="flex flex-1 flex-col justify-center py-20 sm:py-28">
        <p className="mb-5 text-xs font-bold uppercase tracking-[0.16em] text-(--color-accent-700)">Personal daily briefing</p>
        <h1 className="max-w-3xl">A more considered start to the day.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[color-mix(in_srgb,var(--color-text)_68%,transparent)]">
          Daybreak brings together your weather, markets, reminders, and the news that matters into one calm, personalized briefing.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/demo" className="btn btn-primary">Explore the demo</Link>
          <Link href="/signup" className="btn btn-secondary">Create an account</Link>
        </div>
        <p className="mt-5 text-sm text-[color-mix(in_srgb,var(--color-text)_52%,transparent)]">
          The demo uses fictional sample data — no account required.
        </p>
      </section>
    </main>
  );
}
