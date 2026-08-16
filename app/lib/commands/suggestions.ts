export const DEFAULT_COMMAND_SUGGESTIONS = [
  "Add a reminder",
  "Summarize my week",
] as const;

export const MAX_COMMAND_SUGGESTIONS = 6;
const MAX_COMMAND_LENGTH = 160;

/** Normalizes untrusted preference data into the visible command list. */
export function normalizeCommandSuggestions(value: readonly string[] | null | undefined): string[] {
  const suggestions: string[] = [];
  for (const item of value ?? []) {
    const normalized = item.trim().replace(/\s+/g, " ").slice(0, MAX_COMMAND_LENGTH);
    if (!normalized || suggestions.some((existing) => existing.localeCompare(normalized, undefined, { sensitivity: "accent" }) === 0)) continue;
    suggestions.push(normalized);
    if (suggestions.length === MAX_COMMAND_SUGGESTIONS) break;
  }
  return suggestions;
}

/** Adds the stock prompts to older preference rows that only contain custom commands. */
export function commandSuggestionsForDisplay(value: readonly string[] | null | undefined): string[] {
  const stored = normalizeCommandSuggestions(value);
  const stockKeys = new Set(DEFAULT_COMMAND_SUGGESTIONS.map((suggestion) => suggestion.toLocaleLowerCase()));
  return [...DEFAULT_COMMAND_SUGGESTIONS, ...stored.filter((suggestion) => !stockKeys.has(suggestion.toLocaleLowerCase()))]
    .slice(0, MAX_COMMAND_SUGGESTIONS);
}
