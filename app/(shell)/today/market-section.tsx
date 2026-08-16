"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { MarketTickerSearch } from "@/app/(shell)/today/market-ticker-search";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  TrendDownIcon,
  TrendUpIcon,
  XIcon,
} from "@/app/components/icons";
import { UnavailableNote } from "@/app/components/unavailable-note";
import { refreshMarketsAction, setMarketTickerOrderAction } from "@/app/lib/markets/actions";
import { backgroundSectionRefreshEnabled } from "@/app/lib/feature-flags";
import type { MarketQuote } from "@/app/lib/briefing/types";

function changeColor(changePct: number): string {
  return changePct > 0
    ? "var(--color-success)"
    : changePct < 0
      ? "var(--color-danger)"
      : "var(--color-text)";
}

function formatChange(changePct: number): string {
  const sign = changePct > 0 ? "+" : "";
  return `${sign}${changePct.toFixed(1)}%`;
}

function formatAsOf(iso: string | undefined, timeZone: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

type SortKey = "symbol" | "name" | "price" | "change" | null;

// Missing quotes (a tracked ticker whose fetch failed today) always sort to
// the bottom regardless of direction — an unknown price/change isn't
// meaningfully "low" or "high", it's just absent.
function compareRows(
  aSymbol: string,
  bSymbol: string,
  key: SortKey,
  quotesBySymbol: Map<string, MarketQuote>,
): number {
  const a = quotesBySymbol.get(aSymbol);
  const b = quotesBySymbol.get(bSymbol);
  switch (key) {
    case "symbol":
      return aSymbol.localeCompare(bSymbol);
    case "name":
      return (a?.name ?? aSymbol).localeCompare(b?.name ?? bSymbol);
    case "price":
      if (!a || !b) return a ? -1 : b ? 1 : 0;
      return a.price - b.price;
    case "change":
      if (!a || !b) return a ? -1 : b ? 1 : 0;
      return a.changePct - b.changePct;
    default:
      return 0;
  }
}

function SortableHeader({
  label,
  sortKeyName,
  activeSortKey,
  direction,
  onClick,
}: {
  label: string;
  sortKeyName: Exclude<SortKey, null>;
  activeSortKey: SortKey;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  const isActive = activeSortKey === sortKeyName;
  return (
    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={onClick}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        {isActive ? (
          direction === "asc" ? (
            <ChevronUpIcon size={11} />
          ) : (
            <ChevronDownIcon size={11} />
          )
        ) : null}
      </span>
    </th>
  );
}

function RowButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        border: "none",
        background: "none",
        padding: 4,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.3 : 0.75,
        color: "inherit",
        display: "inline-flex",
      }}
    >
      {children}
    </button>
  );
}

// Wraps the Markets header and table together, rather than splitting the
// search control and the table into separate components — adding, removing,
// or reordering a ticker all need to update the very table sitting below
// the header controls, and the Today page itself (a Server Component) can't
// hold that state.
//
// `tickers` (preferences.market_tickers, in order) is the authoritative
// membership/order list — not derived from `initialQuotes`, since a ticker
// whose quote fetch failed that day is still a real tracked ticker and
// would otherwise get silently dropped the moment the user reorders or
// removes any other row. `initialQuotes` only supplies the price/change/
// as-of data to display alongside each tracked symbol.
export function MarketSection({
  id,
  initialQuotes,
  tickers,
  timeZone,
}: {
  id?: string;
  initialQuotes: MarketQuote[] | null;
  tickers: string[];
  timeZone: string;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(tickers);
  const [quotesBySymbol, setQuotesBySymbol] = useState(
    () => new Map((initialQuotes ?? []).map((quote) => [quote.symbol, quote])),
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the table state aligned with fresh server props after a refresh
    setOrder(tickers);
    setQuotesBySymbol(
      new Map((initialQuotes ?? []).map((quote) => [quote.symbol, quote])),
    );
  }, [initialQuotes, tickers]);
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();
  const [saveError, setSaveError] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const displayOrder = sortKey
    ? [...order].sort((a, b) => {
        const cmp = compareRows(a, b, sortKey, quotesBySymbol);
        return sortDirection === "asc" ? cmp : -cmp;
      })
    : order;

  function handleSort(key: Exclude<SortKey, null>) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection("asc");
    } else if (sortDirection === "asc") {
      setSortDirection("desc");
    } else {
      setSortKey(null);
    }
  }

  function persistOrder(next: string[]) {
    setOrder(next);
    setSaveError(false);
    startTransition(async () => {
      try {
        await setMarketTickerOrderAction(next);
        router.refresh();
      } catch {
        setSaveError(true);
      }
    });
  }

  function handleAdd(quote: MarketQuote) {
    setQuotesBySymbol((prev) => new Map(prev).set(quote.symbol, quote));
    setOrder((prev) =>
      prev.includes(quote.symbol) ? prev : [...prev, quote.symbol],
    );
  }

  useEffect(() => {
    // Runs after the initial stored-data render. The provider cache keeps
    // this inexpensive until quotes are stale; users never wait on it.
    if (!backgroundSectionRefreshEnabled) return;
    // router.refresh() targets whichever page is current when it fires, not
    // necessarily this one — skip it if the user has already navigated away
    // while the refresh was still in flight, otherwise it refreshes the
    // wrong page and collides with whatever the user clicked next.
    let cancelled = false;
    startTransition(async () => {
      try {
        const quotes = await refreshMarketsAction();
        if (!quotes || cancelled) return;
        setQuotesBySymbol(new Map(quotes.map((quote) => [quote.symbol, quote])));
        router.refresh();
      } catch { /* retain the saved market table during a background failure */ }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per mount, like the effect it replaces
  }, []);

  function moveUp(index: number) {
    if (index <= 0) return;
    const next = [...order];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    persistOrder(next);
  }

  function moveDown(index: number) {
    if (index >= order.length - 1) return;
    const next = [...order];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    persistOrder(next);
  }

  function removeTicker(symbol: string) {
    persistOrder(order.filter((s) => s !== symbol));
  }

  return (
    <section id={id}>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <h3 style={{ color: "var(--color-text)", margin: 0 }}>Markets</h3>
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          {order.length > 0 ? (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 13 }}
              onClick={() => setEditing((e) => !e)}
            >
              {editing ? "Done" : "Edit"}
            </button>
          ) : null}
          <MarketTickerSearch onAdd={handleAdd} />
        </div>
      </div>

      {order.length === 0 ? (
        <UnavailableNote label="Market data" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-(--color-divider)">
          <table className="table min-w-160">
            <thead>
              <tr>
                <SortableHeader
                  label="Symbol"
                  sortKeyName="symbol"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onClick={() => handleSort("symbol")}
                />
                <SortableHeader
                  label="Name"
                  sortKeyName="name"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onClick={() => handleSort("name")}
                />
                <SortableHeader
                  label="Price"
                  sortKeyName="price"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onClick={() => handleSort("price")}
                />
                <SortableHeader
                  label="Change"
                  sortKeyName="change"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onClick={() => handleSort("change")}
                />
                <th>As of</th>
                {editing ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {displayOrder.map((symbol) => {
                const quote = quotesBySymbol.get(symbol);
                const index = order.indexOf(symbol);
                return (
                  <tr key={symbol}>
                    <td
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 800,
                      }}
                    >
                      {symbol}
                    </td>
                    <td
                      style={{
                        color:
                          "color-mix(in srgb, var(--color-text) 65%, transparent)",
                      }}
                    >
                      {quote?.name ?? symbol}
                    </td>
                    <td>{quote ? `$${quote.price.toLocaleString()}` : "—"}</td>
                    <td>
                      {quote ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            color: changeColor(quote.changePct),
                            fontWeight: 600,
                          }}
                        >
                          {quote.changePct >= 0 ? (
                            <TrendUpIcon size={12} />
                          ) : (
                            <TrendDownIcon size={12} />
                          )}
                          {formatChange(quote.changePct)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      style={{
                        fontSize: 13.5,
                        color:
                          "color-mix(in srgb, var(--color-text) 55%, transparent)",
                      }}
                    >
                      {formatAsOf(quote?.asOf, timeZone)}
                    </td>
                    {editing ? (
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          {sortKey === null ? (
                            <>
                              <RowButton
                                onClick={() => moveUp(index)}
                                disabled={index === 0}
                                label={`Move ${symbol} up`}
                              >
                                <ChevronUpIcon size={14} />
                              </RowButton>
                              <RowButton
                                onClick={() => moveDown(index)}
                                disabled={index === order.length - 1}
                                label={`Move ${symbol} down`}
                              >
                                <ChevronDownIcon size={14} />
                              </RowButton>
                            </>
                          ) : null}
                          <RowButton
                            onClick={() => removeTicker(symbol)}
                            label={`Remove ${symbol}`}
                          >
                            <XIcon size={14} />
                          </RowButton>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {saveError ? (
        <p style={{ color: "var(--color-danger)", fontSize: 13, marginTop: 8 }}>
          Couldn&apos;t save — check your connection.
        </p>
      ) : null}
    </section>
  );
}
