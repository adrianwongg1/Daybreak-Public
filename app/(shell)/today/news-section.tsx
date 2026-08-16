"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { RefreshIcon } from "@/app/components/icons";
import { UnavailableNote } from "@/app/components/unavailable-note";
import { refreshNewsAction } from "@/app/lib/news/actions";
import type { NewsHeadline } from "@/app/lib/briefing/types";

function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// A client component (not just inline in page.tsx) because the Refresh
// button needs somewhere to hold the fetched-just-now headlines — the News
// pipeline otherwise only runs once a day via cron, so every reload before
// this showed the same stale morning snapshot (user's report: "the same 3
// articles" every time). Refresh re-runs the real pipeline (fresh RSS pull
// + fresh Gemini pass) and persists the result to today's stored briefing
// (app/lib/news/actions.ts), so the fix survives a reload too — not just a
// one-time client-side swap.
export function NewsSection({ id, initialHeadlines }: { id?: string; initialHeadlines: NewsHeadline[] | null }) {
  const [headlines, setHeadlines] = useState(initialHeadlines);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const refreshNews = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await refreshNewsAction();
        if (result.cooldownSecondsRemaining !== null) {
          const minutes = Math.ceil(result.cooldownSecondsRemaining / 60);
          setError(`You can refresh again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`);
        } else if (result.quotaExceeded) {
          setError("News summarization has hit today's free AI quota — try again later.");
        } else if (result.headlines) {
          setHeadlines(result.headlines);
        } else {
          setError("Couldn't refresh — try again.");
        }
      } catch {
        setError("Couldn't refresh — try again.");
      }
    });
  }, [startTransition]);

  // A stored briefing can legitimately have no news when its original
  // background generation hit Gemini's quota or a provider outage. Recover
  // after the page responds rather than making the Today server render wait.
  useEffect(() => {
    if (initialHeadlines !== null) return;
    const timer = window.setTimeout(refreshNews, 0);
    return () => window.clearTimeout(timer);
  }, [initialHeadlines, refreshNews]);

  return (
    <section id={id} style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h3 style={{ color: "var(--color-text)", margin: 0 }}>News</h3>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
          onClick={refreshNews}
          disabled={isPending}
        >
          <RefreshIcon size={12} className={isPending ? "spin" : undefined} />
          {isPending ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <p style={{ color: "var(--color-danger)", fontSize: 13, marginBottom: 10 }}>{error}</p>
      ) : null}

      {headlines === null ? (
        isPending ? <p className="text-muted" style={{ fontSize: 13 }}>Loading the latest news…</p> : <UnavailableNote label="News" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {headlines.map((item, i) => (
            <div key={i}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span className="tag tag-accent">{item.topic}</span>
                <span className="tag tag-neutral">{item.source}</span>
                {relativeTime(item.publishedAt) ? (
                  <span style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
                    {relativeTime(item.publishedAt)}
                  </span>
                ) : null}
              </div>
              <h4 style={{ margin: "0 0 4px", fontSize: 18.5 }}>
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.headline}
                  </a>
                ) : (
                  item.headline
                )}
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  color: "color-mix(in srgb, var(--color-text) 72%, transparent)",
                  maxWidth: "64ch",
                }}
              >
                {item.summary}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
