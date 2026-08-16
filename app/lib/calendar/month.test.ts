import { describe, expect, it } from "vitest";
import { formatMonthLabel, getAdjacentMonthKey, getMonthBounds, getMonthGridDates, isValidMonthKey } from "@/app/lib/calendar/month";

describe("calendar month arithmetic", () => {
  it("computes month start/end, including a leap-year February", () => {
    expect(getMonthBounds("2026-08")).toEqual({ start: "2026-08-01", end: "2026-08-31" });
    expect(getMonthBounds("2024-02")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
    expect(getMonthBounds("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });

  it("builds a Sun-Sat grid that starts on Sunday, ends on Saturday, and covers the whole month", () => {
    for (const monthKey of ["2026-08", "2026-02", "2024-02", "2027-01"]) {
      const grid = getMonthGridDates(monthKey);
      expect(grid.length % 7).toBe(0);
      expect(new Date(`${grid[0]}T00:00:00Z`).getUTCDay()).toBe(0);
      expect(new Date(`${grid[grid.length - 1]}T00:00:00Z`).getUTCDay()).toBe(6);

      const { start, end } = getMonthBounds(monthKey);
      expect(grid).toContain(start);
      expect(grid).toContain(end);
    }
  });

  it("shifts months across year boundaries", () => {
    expect(getAdjacentMonthKey("2026-08", 1)).toBe("2026-09");
    expect(getAdjacentMonthKey("2026-01", -1)).toBe("2025-12");
    expect(getAdjacentMonthKey("2026-12", 1)).toBe("2027-01");
  });

  it("formats a human-readable month label", () => {
    expect(formatMonthLabel("2026-08")).toBe("August 2026");
  });

  it("validates month key syntax", () => {
    expect(isValidMonthKey("2026-08")).toBe(true);
    expect(isValidMonthKey("2026-13")).toBe(false);
    expect(isValidMonthKey("2026-8")).toBe(false);
    expect(isValidMonthKey("not-a-month")).toBe(false);
  });
});
