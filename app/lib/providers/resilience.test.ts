import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

import { resetProviderCircuitsForTest, withProviderFallback } from "@/app/lib/providers/resilience";

describe("provider circuit breaker", () => {
  beforeEach(() => resetProviderCircuitsForTest());

  it("uses the fallback and opens after three consecutive failures", async () => {
    const operation = vi.fn(async () => { throw new Error("upstream unavailable"); });
    const fallback = vi.fn(() => "saved value");

    await expect(withProviderFallback("weather", operation, fallback)).resolves.toBe("saved value");
    await expect(withProviderFallback("weather", operation, fallback)).resolves.toBe("saved value");
    await expect(withProviderFallback("weather", operation, fallback)).resolves.toBe("saved value");
    await expect(withProviderFallback("weather", operation, fallback)).resolves.toBe("saved value");

    expect(operation).toHaveBeenCalledTimes(3);
    expect(fallback).toHaveBeenCalledTimes(4);
  });

  it("closes the circuit again after a successful request", async () => {
    await withProviderFallback("markets", async () => "fresh", () => "saved");
    await expect(withProviderFallback("markets", async () => "fresh again", () => "saved")).resolves.toBe("fresh again");
  });
});
