import Parser from "rss-parser";
import type { NewsHeadline } from "@/app/lib/briefing/types";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";
import type { Json } from "@/app/lib/supabase/database.types";
import { withProviderFallback } from "@/app/lib/providers/resilience";
import { isCacheFresh } from "@/app/lib/cache/freshness";

// Google Gemini free tier (Google AI Studio), not Claude — user's explicit
// call to keep this pipeline at zero ongoing cost rather than the ~$0.01-
// 0.02/user/day Opus was running (see DECISIONS.md). Plain `fetch` against
// the REST API rather than a Gemini SDK, matching this file's siblings
// (calendar.ts talks to Calendar v3 the same way) — not worth a dependency
// for one call. Keep news on the same economical model as the command chat.
// A pinned name prevents a rolling alias from silently changing the chosen
// quota and cost characteristics.
const GEMINI_MODEL = "gemini-3.5-flash-lite";

const LOOKBACK_HOURS = 18;

// rss-parser defaults to a 60-SECOND timeout when none is given — confirmed
// live as the exact cause of a Today-page load hanging for ~60s on a slow
// Google News response (the whole page waits on Promise.all/allSettled, so
// one slow topic fetch blocked everything else too). Every other external
// call in this pipeline had no timeout at all, which is worse. 8s here and
// below keeps one flaky provider from ever blocking the page like that again.
const EXTERNAL_FETCH_TIMEOUT_MS = 8000;

// Gemini specifically gets more headroom than the plain REST lookups above —
// confirmed live that condensing a larger 3+3 Guardian/NYT candidate pool
// can genuinely take longer than 8s (real "thinking"/reasoning tokens, not
// just network latency), and an overly-tight timeout here was itself the
// cause of a production "Couldn't refresh" failure.
const GEMINI_TIMEOUT_MS = 20000;
const NEWS_SOURCE_CACHE_FRESHNESS_MS = 30 * 60 * 1000;

interface CandidateHeadline {
  topic: string;
  title: string;
  source: string;
  publishedAt: string | null;
  url: string | null;
  /** Guardian's own dek/standfirst, when available — extra grounding for the summary. */
  trailText?: string;
}

async function cachedTopicCandidates(provider: string, topic: string, fetcher: () => Promise<CandidateHeadline[]>): Promise<CandidateHeadline[]> {
  const topicKey = topic.trim().toLowerCase();
  let staleCandidates: CandidateHeadline[] = [];
  try {
    const { data } = await getSupabaseServiceClient().from("news_source_cache").select("candidates_json, fetched_at").eq("provider", provider).eq("topic_key", topicKey).maybeSingle();
    if (data && isCacheFresh(data.fetched_at, NEWS_SOURCE_CACHE_FRESHNESS_MS)) return data.candidates_json as unknown as CandidateHeadline[];
    if (data) staleCandidates = data.candidates_json as unknown as CandidateHeadline[];
  } catch { /* fetch directly if the cache is unavailable */ }
  const candidates = await withProviderFallback(provider, fetcher, () => staleCandidates);
  if (candidates.length === 0 && staleCandidates.length > 0) return staleCandidates;
  void getSupabaseServiceClient().from("news_source_cache").upsert({ provider, topic_key: topicKey, candidates_json: candidates as unknown as Json, fetched_at: new Date().toISOString() });
  return candidates;
}

interface GoogleNewsItemFields {
  source?: string;
}

const rssParser = new Parser<object, GoogleNewsItemFields>({
  customFields: { item: ["source"] },
  timeout: EXTERNAL_FETCH_TIMEOUT_MS,
});

function splitGoogleNewsTitle(title: string, sourceField?: string): { headline: string; source: string } {
  if (sourceField) return { headline: title, source: sourceField };
  // Fallback: Google News RSS titles are usually "Headline - Source Name".
  const lastDash = title.lastIndexOf(" - ");
  if (lastDash === -1) return { headline: title, source: "Google News" };
  return { headline: title.slice(0, lastDash), source: title.slice(lastDash + 3) };
}

async function fetchTopicFromGoogleNews(topic: string): Promise<CandidateHeadline[]> {
  const query = encodeURIComponent(`${topic} when:1d`);
  const feed = await rssParser.parseURL(
    `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`
  );

  const cutoff = Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000;
  const candidates: CandidateHeadline[] = [];
  for (const item of feed.items) {
    if (!item.title) continue;
    let publishedAt: string | null = null;
    if (item.pubDate) {
      const published = new Date(item.pubDate).getTime();
      if (!Number.isNaN(published)) {
        if (published < cutoff) continue;
        publishedAt = new Date(published).toISOString();
      }
    }
    const { headline, source } = splitGoogleNewsTitle(item.title, item.source);
    candidates.push({ topic, title: headline, source, publishedAt, url: item.link ?? null });
    if (candidates.length >= 5) break;
  }
  return candidates;
}

// The one real source of summary depth (its `trailText` is an actual
// dek/standfirst, unlike Google News RSS's description, which is just the
// headline re-wrapped in an <a> tag with no real content — confirmed by
// inspecting the raw feed). Still skipped entirely when no GUARDIAN_API_KEY
// is configured, so the pipeline stays fully testable on Google News RSS
// alone. page-size bumped from 3 to 5 now that it's a bigger contributor to
// summary quality, not just an optional "depth" add-on.
async function fetchTopicFromGuardian(topic: string): Promise<CandidateHeadline[]> {
  const apiKey = process.env.GUARDIAN_API_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    q: topic,
    "order-by": "newest",
    "page-size": "5",
    "show-fields": "trailText",
    "api-key": apiKey,
  });
  const res = await fetch(`https://content.guardianapis.com/search?${params}`, {
    signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Guardian news search failed (${res.status})`);

  const data = (await res.json()) as {
    response?: {
      results?: { webTitle: string; webUrl: string; webPublicationDate: string; fields?: { trailText?: string } }[];
    };
  };
  const cutoff = Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000;
  return (data.response?.results ?? [])
    .filter((r) => new Date(r.webPublicationDate).getTime() >= cutoff)
    .map((r) => ({
      topic,
      title: r.webTitle,
      source: "The Guardian",
      publishedAt: r.webPublicationDate,
      url: r.webUrl,
      trailText: stripHtml(r.fields?.trailText),
    }));
}

function stripHtml(text: string | undefined): string | undefined {
  return text ? text.replace(/<[^>]+>/g, "").trim() || undefined : undefined;
}

interface NYTArticle {
  headline?: { main?: string };
  web_url: string;
  pub_date: string;
  /** NYT's own dek — real editorial context, same role Guardian's trailText plays. */
  abstract?: string;
}

/** "YYYYMMDD", the only format Article Search's begin_date accepts. */
function formatNytDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Second primary news source alongside Guardian (see fetchTopicFromGuardian
 * above) — replaces TheNewsAPI (2026-07-30, its free-tier quota was hit; see
 * DECISIONS.md). The New York Times' Article Search API (developer.nytimes.com,
 * free registration, single api-key — no OAuth/secret needed for their public
 * REST APIs). Plain full-text `q` search rather than NYT's own section-name
 * taxonomy: unlike TheNewsAPI's documented lowercase category slugs, NYT's
 * exact `section_name` strings aren't reliably known ahead of time, and
 * Guardian's own plain-search approach already works well as a primary
 * source, so this mirrors that instead of risking a silently-empty filter.
 * `begin_date` only has day granularity, so it's a coarse pre-filter — the
 * same precise `cutoff` check Guardian uses narrows it exactly afterward.
 */
async function fetchTopicFromNYT(topic: string): Promise<CandidateHeadline[]> {
  const apiKey = process.env.NYT_API_KEY;
  if (!apiKey) return [];

  const cutoff = Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000;
  const params = new URLSearchParams({
    q: topic,
    sort: "newest",
    begin_date: formatNytDate(new Date(cutoff)),
    "api-key": apiKey,
  });
  const res = await fetch(`https://api.nytimes.com/svc/search/v2/articlesearch.json?${params}`, {
    signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`New York Times news search failed (${res.status})`);

  const data = (await res.json()) as { response?: { docs?: NYTArticle[] } };
  return (data.response?.docs ?? [])
    .filter((d) => d.headline?.main && new Date(d.pub_date).getTime() >= cutoff)
    .slice(0, 5)
    .map((d) => ({
      topic,
      title: d.headline!.main!,
      source: "The New York Times",
      publishedAt: d.pub_date,
      url: d.web_url,
      trailText: d.abstract || undefined,
    }));
}

interface GeminiHeadline {
  topic: string;
  headline: string;
  source: string;
  summary: string;
  sourceIndex: number;
}

const NEWS_SYSTEM_INSTRUCTIONS =
  "You write a morning news briefing from candidates grouped into labeled sections below, numbered " +
  'continuously across every section (a candidate may include extra context after "::"). Build a final list ' +
  "of 6 distinct, genuinely newsworthy stories: prefer exactly 3 from GUARDIAN CANDIDATES and exactly 3 from " +
  "NEW YORK TIMES CANDIDATES. If either of those two sections has fewer usable/newsworthy candidates than its " +
  "target, fill the shortfall from the OTHER of those two sections first. Only reach into GOOGLE NEWS " +
  "CANDIDATES if GUARDIAN and NEW YORK TIMES candidates combined still can't reach 6 genuinely newsworthy, " +
  "distinct stories — that section is a last-resort fallback only, since it's the one pool not from a curated " +
  "newsroom. Favor spreading picks across the represented topics where the news genuinely supports it, " +
  "but don't force an even split or include a weak story just to cover a topic; if genuinely fewer than 6 " +
  "distinct newsworthy stories exist across every candidate, return fewer rather than padding with duplicates " +
  "or minor items.\n\n" +
  "For each pick: condense the headline into a clear, factual one-sentence title under 20 words. Then write the " +
  'summary based ONLY on the candidate\'s own title and its "::" context if present — never invent names, ' +
  "numbers, quotes, or outcomes that aren't there. The summary's length depends on how much real context is " +
  'available: if the candidate has "::" context, write 3-4 sentences of fuller prose actually drawing on that ' +
  "context; if there's nothing beyond the bare title, keep it to 1-2 sentences that restate the headline more " +
  "fully, not padded with invented detail. Preserve the source name from the candidate you picked, and report " +
  "its number as sourceIndex.\n\n" +
  'Respond with ONLY a JSON object of the exact shape {"headlines": [{"topic": string, "headline": string, ' +
  '"source": string, "summary": string, "sourceIndex": number}]} — no markdown fences, no other text.';

/** Renders one labeled section of the candidate pool, numbering continuously via `cursor` (shared across sections so `sourceIndex` in Gemini's response maps back to the flat `allCandidates` array). */
function renderSection(title: string, items: CandidateHeadline[], cursor: { n: number }): string | null {
  if (items.length === 0) return null;
  const lines = items.map((c) => {
    cursor.n += 1;
    return `${cursor.n}. [${c.topic}] "${c.title}" — ${c.source}${c.trailText ? ` :: ${c.trailText}` : ""}`;
  });
  return `${title}\n${lines.join("\n")}`;
}

export interface FetchNewsResult {
  headlines: NewsHeadline[] | null;
  /** Set (with `headlines` left null) when Gemini's free-tier daily quota is exhausted — distinguishes that from a genuine pipeline failure. */
  quotaExceeded: boolean;
}

export interface NewsFetchOptions {
  onGeminiTiming?: (durationMs: number) => void;
  cacheDate?: string;
}

type GeminiCallResult = { ok: true; text: string } | { ok: false; quotaExceeded: boolean };

async function callGemini(model: string, apiKey: string, promptText: string): Promise<GeminiCallResult> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      }
    );
    if (!res.ok) {
      console.error(`Gemini news summarization failed (${model}):`, res.status, await res.text());
      return { ok: false, quotaExceeded: res.status === 429 };
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? { ok: true, text } : { ok: false, quotaExceeded: false };
  } catch (error) {
    console.error(`Gemini news summarization failed (${model}):`, error);
    return { ok: false, quotaExceeded: false };
  }
}

async function condenseHeadlines(
  guardianCandidates: CandidateHeadline[],
  nytCandidates: CandidateHeadline[],
  rssCandidates: CandidateHeadline[],
  onGeminiTiming?: (durationMs: number) => void
): Promise<FetchNewsResult> {
  const allCandidates = [...guardianCandidates, ...nytCandidates, ...rssCandidates];
  if (allCandidates.length === 0) return { headlines: null, quotaExceeded: false };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { headlines: null, quotaExceeded: false };

  const cursor = { n: 0 };
  const pool = [
    renderSection("GUARDIAN CANDIDATES:", guardianCandidates, cursor),
    renderSection("NEW YORK TIMES CANDIDATES:", nytCandidates, cursor),
    renderSection("GOOGLE NEWS CANDIDATES (last resort only):", rssCandidates, cursor),
  ]
    .filter((section): section is string => section !== null)
    .join("\n\n");
  const promptText = `${NEWS_SYSTEM_INSTRUCTIONS}\n\nCandidate headlines:\n${pool}`;

  const geminiStartedAt = performance.now();
  let result: GeminiCallResult;
  try {
    result = await callGemini(GEMINI_MODEL, apiKey, promptText);
  } finally {
    onGeminiTiming?.(performance.now() - geminiStartedAt);
  }
  if (!result.ok) return { headlines: null, quotaExceeded: result.quotaExceeded };

  try {
    // Gemini's JSON mode is reliable but not guaranteed fence-free across all
    // models/versions — strip ```json ... ``` wrapping defensively.
    const cleaned = result.text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(cleaned) as { headlines: GeminiHeadline[] };
    if (parsed.headlines.length === 0) return { headlines: null, quotaExceeded: false };

    return {
      headlines: parsed.headlines.map((item) => ({
        topic: item.topic,
        headline: item.headline,
        source: item.source,
        summary: item.summary,
        publishedAt: allCandidates[item.sourceIndex - 1]?.publishedAt ?? null,
        url: allCandidates[item.sourceIndex - 1]?.url ?? null,
      })),
      quotaExceeded: false,
    };
  } catch (error) {
    console.error("Gemini news summarization failed:", error);
    return { headlines: null, quotaExceeded: false };
  }
}

function flattenSettled(results: PromiseSettledResult<CandidateHeadline[]>[]): CandidateHeadline[] {
  const out: CandidateHeadline[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") out.push(...result.value);
  }
  return out;
}

/**
 * News for the design's News section: a mix of sources per the user's
 * explicit ask (2026-07-28, DECISIONS.md) — The Guardian and The New York
 * Times as the two primary sources (targeting 3 + 3 of the final 6
 * respectively, evened up from 3 + 2 of 5 on 2026-07-30 when NYT replaced
 * TheNewsAPI after its free-tier quota was hit), Google News RSS kept only
 * as a last-resort fallback for whichever of those two is unconfigured or
 * comes up short. Condensed by Gemini into up to 6 grounded headlines (not
 * one-per-topic) with a summary and the original story's timestamp. Each
 * topic's fetch fails independently — a bad feed just means fewer
 * candidates, never a thrown error.
 */
export async function fetchNewsHeadlines(topics: string[], options: NewsFetchOptions = {}): Promise<FetchNewsResult> {
  if (topics.length === 0) return { headlines: null, quotaExceeded: false };

  const cacheDate = options.cacheDate ?? new Date().toISOString().slice(0, 10);
  const topicSetKey = [...topics].map((topic) => topic.trim().toLowerCase()).sort().join("|");
  try {
    const { data } = await getSupabaseServiceClient().from("news_summary_cache").select("headlines_json").eq("topic_set_key", topicSetKey).eq("briefing_date", cacheDate).maybeSingle();
    if (data && Array.isArray(data.headlines_json)) return { headlines: data.headlines_json as unknown as NewsHeadline[], quotaExceeded: false };
  } catch { /* source cache fallback */ }
  const [guardianResults, nytResults, rssResults] = await Promise.all([
    Promise.allSettled(topics.map((topic) => cachedTopicCandidates("guardian", topic, () => fetchTopicFromGuardian(topic)))),
    Promise.allSettled(topics.map((topic) => cachedTopicCandidates("nyt", topic, () => fetchTopicFromNYT(topic)))),
    Promise.allSettled(topics.map((topic) => cachedTopicCandidates("google_news", topic, () => fetchTopicFromGoogleNews(topic)))),
  ]);

  const result = await condenseHeadlines(
    flattenSettled(guardianResults),
    flattenSettled(nytResults),
    flattenSettled(rssResults),
    options.onGeminiTiming
  );
  if (result.headlines) void getSupabaseServiceClient().from("news_summary_cache").upsert({ topic_set_key: topicSetKey, briefing_date: cacheDate, headlines_json: result.headlines as unknown as Json, fetched_at: new Date().toISOString() });
  return result;
}
