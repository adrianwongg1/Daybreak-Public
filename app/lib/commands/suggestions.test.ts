import { describe, expect, it } from "vitest";
import {
  commandSuggestionsForDisplay,
  DEFAULT_COMMAND_SUGGESTIONS,
  MAX_COMMAND_SUGGESTIONS,
  normalizeCommandSuggestions,
} from "@/app/lib/commands/suggestions";

describe("normalizeCommandSuggestions", () => {
  it("trims, deduplicates, and caps visible commands", () => {
    expect(normalizeCommandSuggestions(["  Plan dinner  ", "plan dinner", "Review budget", "Book travel", "Read later", "Extra", "One more"])).toEqual([
      "Plan dinner",
      "Review budget",
      "Book travel",
      "Read later",
      "Extra",
      "One more",
    ]);
  });

  it("allows an intentionally empty list", () => {
    expect(normalizeCommandSuggestions([])).toHaveLength(0);
  });

  it("allows exactly the visible capacity", () => {
    expect(normalizeCommandSuggestions(["One", "Two", "Three", "Four", "Five", "Six"])).toHaveLength(MAX_COMMAND_SUGGESTIONS);
  });

  it("restores stock prompts ahead of older custom-only preference rows", () => {
    expect(commandSuggestionsForDisplay(["Plan my workouts for the week", "Sleep"])).toEqual([
      ...DEFAULT_COMMAND_SUGGESTIONS,
      "Plan my workouts for the week",
      "Sleep",
    ]);
  });
});
