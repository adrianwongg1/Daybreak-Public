import * as Sentry from "@sentry/nextjs";

// Process-local protection against repeatedly calling an unhealthy upstream.
// The durable caches remain the source of truth; this only avoids wasting
// work during an outage in one running worker instance.
const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 60_000;

interface CircuitState {
  failures: number;
  openUntil: number;
}

const circuits = new Map<string, CircuitState>();

/** @internal Enables isolated unit tests without affecting runtime state. */
export function resetProviderCircuitsForTest(): void {
  circuits.clear();
}

/**
 * Runs an external-provider request with a small circuit breaker. Three
 * consecutive failures pause calls to that provider for one minute and use
 * the caller's safe fallback instead. No request payloads are logged.
 */
export async function withProviderFallback<T>(
  provider: string,
  operation: () => Promise<T>,
  fallback: () => T | Promise<T>
): Promise<T> {
  const now = Date.now();
  const current = circuits.get(provider);
  if (current && current.openUntil > now) {
    Sentry.logger.info("provider.circuit_open", { provider });
    return fallback();
  }

  try {
    const value = await operation();
    circuits.delete(provider);
    return value;
  } catch (error) {
    const failures = (current?.failures ?? 0) + 1;
    const openUntil = failures >= FAILURE_THRESHOLD ? now + COOLDOWN_MS : 0;
    circuits.set(provider, { failures, openUntil });
    Sentry.logger.warn("provider.request_failed", {
      provider,
      failures,
      circuit_opened: openUntil > now,
      error_name: error instanceof Error ? error.name : "unknown",
    });
    return fallback();
  }
}
