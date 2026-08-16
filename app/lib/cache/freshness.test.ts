import { describe, expect, it } from "vitest";
import { isCacheFresh } from "@/app/lib/cache/freshness";

describe("isCacheFresh", () => {
  const now = Date.parse("2026-08-04T12:00:00Z");

  it("accepts a cache entry inside its freshness window", () => {
    expect(isCacheFresh("2026-08-04T11:55:01Z", 5 * 60_000, now)).toBe(true);
  });

  it("expires an entry at the freshness boundary", () => {
    expect(isCacheFresh("2026-08-04T11:55:00Z", 5 * 60_000, now)).toBe(false);
  });

  it("rejects malformed timestamps", () => {
    expect(isCacheFresh("not-a-date", 5 * 60_000, now)).toBe(false);
  });
});
