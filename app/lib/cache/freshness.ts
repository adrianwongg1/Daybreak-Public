/** True only when a cache timestamp is valid and within its freshness window. */
export function isCacheFresh(fetchedAt: string, freshnessMs: number, nowMs = Date.now()): boolean {
  const fetchedAtMs = Date.parse(fetchedAt);
  return Number.isFinite(fetchedAtMs) && nowMs - fetchedAtMs < freshnessMs;
}
