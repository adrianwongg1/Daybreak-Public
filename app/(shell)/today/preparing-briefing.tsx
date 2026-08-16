"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Posts an idempotent queue job, then polls until its background worker completes. */
export function PreparingBriefing() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      const response = await fetch("/api/briefing/generate", { method: "POST" });
      if (!response.ok) throw new Error("Briefing generation failed");
      const { job } = (await response.json()) as { job: { status?: string } | null };
      if (job?.status === "succeeded") {
        if (!cancelled) router.refresh();
        return;
      }
      if (job?.status === "failed") throw new Error("Briefing generation failed");

      const poll = window.setInterval(async () => {
        const statusResponse = await fetch("/api/briefing/generate", { cache: "no-store" });
        if (!statusResponse.ok || cancelled) return;
        const { job: current } = (await statusResponse.json()) as { job: { status?: string } | null };
        if (current?.status === "succeeded") {
          window.clearInterval(poll);
          router.refresh();
        } else if (current?.status === "failed") {
          window.clearInterval(poll);
          setFailed(true);
        }
      }, 3_000);
      return () => window.clearInterval(poll);
    }

    let stopPolling: (() => void) | undefined;
    void prepare()
      .then((stop) => {
        if (cancelled) stop?.();
        else stopPolling = stop;
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      stopPolling?.();
    };
  }, [attempt, router]);

  return (
    <section aria-live="polite" className="py-12 text-center">
      <h2 className="text-xl text-(--color-text)">Preparing your first briefing</h2>
      <p className="mt-3 text-muted">Your dashboard will refresh automatically when it&apos;s ready.</p>
      {failed ? (
        <button
          type="button"
          className="btn btn-secondary mt-5"
          onClick={() => {
            setFailed(false);
            setAttempt((value) => value + 1);
          }}
        >
          Try again
        </button>
      ) : null}
    </section>
  );
}
