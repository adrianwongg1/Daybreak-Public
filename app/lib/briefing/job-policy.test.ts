import { describe, expect, it } from "vitest";
import { isTerminalJobAttempt, retryDelayMinutes } from "@/app/lib/briefing/job-policy";

describe("briefing job retry policy", () => {
  it("uses bounded exponential backoff", () => {
    expect([1, 2, 3, 4, 7].map(retryDelayMinutes)).toEqual([1, 2, 4, 8, 60]);
  });

  it("stops after the third claimed attempt", () => {
    expect(isTerminalJobAttempt(2)).toBe(false);
    expect(isTerminalJobAttempt(3)).toBe(true);
  });
});
