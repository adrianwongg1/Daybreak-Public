import type { MarketQuote } from "@/app/lib/briefing/types";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";
import { withProviderFallback } from "@/app/lib/providers/resilience";
import { isCacheFresh } from "@/app/lib/cache/freshness";

// Every user's Today-page render previously triggered its own live
// Finnhub/CoinGecko call per tracked ticker — no staleness check, no
// sharing across users watching the same symbol. market_quote_cache backs
// a shared, time-gated cache: a symbol only gets a live call when its
// cached row is missing or older than this window; every other request for
// that symbol in the meantime (any user) reuses the cached row instead.
const QUOTE_CACHE_FRESHNESS_MS = 5 * 60 * 1000;

const MARKET_TIME_ZONE = "America/New_York";
const MARKET_OPEN_MINUTES = 9 * 60 + 30; // 09:30
const MARKET_CLOSE_MINUTES = 16 * 60; // 16:00

/**
 * NYSE/Nasdaq regular trading hours — Mon-Fri 09:30-16:00 America/New_York.
 * No holiday calendar (this codebase has no holiday data source): a market
 * holiday is treated as a normal trading day, which just risks an
 * occasional unneeded live quote call, not a correctness problem.
 */
export function isUsEquityMarketOpen(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TIME_ZONE,
    weekday: "short",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  if (weekday === "Sat" || weekday === "Sun") return false;

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const minutesSinceMidnight = hour * 60 + minute;
  return minutesSinceMidnight >= MARKET_OPEN_MINUTES && minutesSinceMidnight < MARKET_CLOSE_MINUTES;
}

// None of this file's fetches had a timeout — a slow/hanging Finnhub or
// CoinGecko response could block the whole Today page indefinitely (see the
// news.ts rss-parser default-60s-timeout incident this fixed the same day).
const EXTERNAL_FETCH_TIMEOUT_MS = 8000;

// Onboarding's ticker catalog (app/lib/preferences/types.ts) plus a few
// wireframe additions; free-typed tickers outside this map just fall back
// to showing the symbol as its own name.
const TICKER_NAMES: Record<string, string> = {
  SPY: "S&P 500 ETF",
  QQQ: "Nasdaq 100 ETF",
  AAPL: "Apple",
  NVDA: "Nvidia",
  MSFT: "Microsoft",
  GOOGL: "Alphabet (Google)",
  AMZN: "Amazon",
  TSLA: "Tesla",
  META: "Meta",
  DIS: "Disney",
};

const CRYPTO_COINGECKO_IDS: Record<string, string> = {
  "BTC-USD": "bitcoin",
  "ETH-USD": "ethereum",
};

const CRYPTO_NAMES: Record<string, string> = {
  "BTC-USD": "Bitcoin",
  "ETH-USD": "Ethereum",
};

interface Quote {
  price: number;
  changePct: number;
}

async function fetchEquityQuote(ticker: string): Promise<Quote | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({ symbol: ticker, token: apiKey });
  const res = await fetch(`https://finnhub.io/api/v1/quote?${params}`, {
    signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Finnhub quote failed (${res.status})`);

  const data = (await res.json()) as { c?: number; dp?: number };
  // Finnhub returns c: 0 for an unknown/unsupported symbol rather than an error status.
  if (!data.c) return null;
  return { price: data.c, changePct: data.dp ?? 0 };
}

/**
 * Real company name for a ticker outside the static TICKER_NAMES catalog —
 * without this, any ticker added via live search (not one of the ~10
 * hardcoded ones) shows its own symbol as the "name" on every subsequent
 * fetch, since the real name Finnhub's search returned at add-time was
 * only ever used for that one optimistic render, never persisted anywhere
 * (preferences.market_tickers is a plain string array). Finnhub's Company
 * Profile endpoint is free-tier and keyed by the same FINNHUB_API_KEY.
 */
async function fetchCompanyName(ticker: string): Promise<string | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({ symbol: ticker, token: apiKey });
  const res = await fetch(`https://finnhub.io/api/v1/stock/profile2?${params}`, {
    signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { name?: string };
  return data.name || null;
}

async function fetchCryptoQuote(coingeckoId: string): Promise<Quote | null> {
  const params = new URLSearchParams({
    ids: coingeckoId,
    vs_currencies: "usd",
    include_24hr_change: "true",
  });
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?${params}`, {
    signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`CoinGecko quote failed (${res.status})`);

  const data = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
  const entry = data[coingeckoId];
  if (!entry?.usd) return null;
  return { price: entry.usd, changePct: entry.usd_24h_change ?? 0 };
}

/**
 * `nameOverride` lets a caller that already knows a better display name
 * (e.g. Finnhub search's own company name at add-time) skip the lookups
 * below. Otherwise: the static catalog for the handful of common tickers
 * it covers, or — for any other equity — a live Company Profile lookup,
 * since a batch refresh (fetchMarketSummary, called on every Today-page
 * load and by the daily cron) has no add-time name to fall back on and
 * would otherwise just show the bare symbol as its own "name" forever.
 */
export async function fetchQuote(ticker: string, nameOverride?: string): Promise<MarketQuote | null> {
  const coingeckoId = CRYPTO_COINGECKO_IDS[ticker];
  const quote = coingeckoId ? await fetchCryptoQuote(coingeckoId) : await fetchEquityQuote(ticker);
  if (!quote) return null;

  let name: string | undefined = nameOverride ?? TICKER_NAMES[ticker] ?? CRYPTO_NAMES[ticker];
  if (!name && !coingeckoId) {
    name = (await fetchCompanyName(ticker)) ?? undefined;
  }

  return { symbol: ticker, name: name ?? ticker, price: quote.price, changePct: quote.changePct, asOf: new Date().toISOString() };
}

export interface TickerSuggestion {
  symbol: string;
  name: string;
}

// Only plain US-style symbols ("AAPL", "BRK.B") — Finnhub's search also
// returns foreign-exchange listings ("AAPL.MX", "BINANCE:BTCUSDT") that
// either don't work or mean something different against the plain
// `/quote?symbol=` call fetchEquityQuote makes above.
const PLAIN_SYMBOL_PATTERN = /^[A-Z]{1,5}(\.[A-Z])?$/;
const SUPPORTED_CRYPTO_TICKERS = new Set(["BTC-USD", "ETH-USD"]);

export function isSupportedTickerSymbol(symbol: string): boolean {
  const trimmed = symbol.trim().toUpperCase();
  return SUPPORTED_CRYPTO_TICKERS.has(trimmed) || PLAIN_SYMBOL_PATTERN.test(trimmed);
}

/**
 * Backs the Today page's "add a ticker" search (Finnhub's free Symbol
 * Lookup endpoint) — a real search across Finnhub's whole symbol database,
 * not just the ~10 tickers in this file's own TICKER_NAMES catalog, so a
 * user can add any real equity/ETF.
 *
 * Checks the static catalog for a prefix match first: Finnhub's own search
 * ranks by relevance, not by "does the symbol start with this query," so a
 * well-known ticker can silently vanish mid-typing the moment the query
 * text collides with a *different* real ticker — e.g. "NVD" is itself a
 * leveraged NVDA ETF plus several foreign NVIDIA listings (NVD.DE, NVD.F,
 * etc.), so Finnhub's page of results for "NVD" doesn't include "NVDA" at
 * all, even though "NVD" is a plain prefix of it (confirmed live against
 * Finnhub's API). Catalog matches are cheap and exact, so they're added
 * first regardless of what Finnhub itself returns.
 */
export async function searchTickers(query: string): Promise<TickerSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const upperQuery = trimmed.toUpperCase();
  const seen = new Set<string>();
  const suggestions: TickerSuggestion[] = [];
  for (const [symbol, name] of Object.entries({ ...TICKER_NAMES, ...CRYPTO_NAMES })) {
    if (symbol.startsWith(upperQuery)) {
      seen.add(symbol);
      suggestions.push({ symbol, name });
    }
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return suggestions.slice(0, 8);

  const params = new URLSearchParams({ q: trimmed, token: apiKey });
  const res = await fetch(`https://finnhub.io/api/v1/search?${params}`, {
    signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
  });
  if (res.ok) {
    const data = (await res.json()) as { result?: { symbol?: string; description?: string }[] };
    for (const item of data.result ?? []) {
      const symbol = item.symbol?.toUpperCase();
      if (!symbol || !PLAIN_SYMBOL_PATTERN.test(symbol) || seen.has(symbol)) continue;
      seen.add(symbol);
      suggestions.push({ symbol, name: item.description || symbol });
      if (suggestions.length >= 8) break;
    }
  }
  return suggestions.slice(0, 8);
}

/**
 * Market quotes for the design's single flat Markets table (Symbol / Name /
 * Price / Change) — one row per `preferences.market_tickers` entry, in the
 * user's own order. Equities/ETFs go through Finnhub (needs
 * FINNHUB_API_KEY); crypto goes through CoinGecko's free, keyless endpoint.
 * Each ticker degrades independently — one bad symbol never drops the rest.
 *
 * Live calls only happen for tickers whose `market_quote_cache` row is
 * missing or stale (see QUOTE_CACHE_FRESHNESS_MS) — a fresh cached row is
 * reused as-is, including its original fetch-time `asOf`, since it reflects
 * when the price was actually observed, not when this particular caller
 * asked for it.
 */
export async function fetchMarketSummary(tickers: string[]): Promise<MarketQuote[] | null> {
  if (tickers.length === 0) return null;

  const supabase = getSupabaseServiceClient();
  const { data: cachedRows } = await supabase
    .from("market_quote_cache")
    .select("symbol, name, price, change_pct, as_of")
    .in("symbol", tickers);

  const freshBySymbol = new Map(
    (cachedRows ?? [])
      .filter((row) => isCacheFresh(row.as_of, QUOTE_CACHE_FRESHNESS_MS))
      .map((row): [string, MarketQuote] => [
        row.symbol,
        { symbol: row.symbol, name: row.name, price: row.price, changePct: row.change_pct, asOf: row.as_of },
      ])
  );
  const staleBySymbol = new Map(
    (cachedRows ?? []).map((row): [string, MarketQuote] => [
      row.symbol,
      { symbol: row.symbol, name: row.name, price: row.price, changePct: row.change_pct, asOf: row.as_of },
    ])
  );

  // Equities only get a live call during real trading hours — outside
  // that window they fall through to staleBySymbol below, same as a
  // provider failure. Crypto trades 24/7, so it's exempt from this gate
  // and stays bounded by the freshness window alone.
  const marketOpen = isUsEquityMarketOpen();
  const staleTickers = tickers.filter(
    (ticker) => !freshBySymbol.has(ticker) && (marketOpen || Boolean(CRYPTO_COINGECKO_IDS[ticker]))
  );
  const results = await Promise.allSettled(staleTickers.map((ticker) =>
    withProviderFallback(
      CRYPTO_COINGECKO_IDS[ticker] ? "coingecko" : "finnhub",
      () => fetchQuote(ticker),
      () => null
    )
  ));
  const freshlyFetched: MarketQuote[] = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) freshlyFetched.push(result.value);
  }

  if (freshlyFetched.length > 0) {
    await supabase.from("market_quote_cache").upsert(
      freshlyFetched.map((quote) => ({
        symbol: quote.symbol,
        name: quote.name,
        price: quote.price,
        change_pct: quote.changePct,
        as_of: quote.asOf,
      }))
    );
  }

  const quotes = tickers.flatMap((ticker) => {
    // A stale quote is better than a missing market section during a
    // provider outage. Its original `asOf` remains visible to the UI.
    const quote = freshBySymbol.get(ticker) ?? freshlyFetched.find((q) => q.symbol === ticker) ?? staleBySymbol.get(ticker);
    return quote ? [quote] : [];
  });

  return quotes.length > 0 ? quotes : null;
}
