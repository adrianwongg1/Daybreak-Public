// The one source of truth for the Today page's four toggleable/orderable
// sections — shared by the Today page itself, the shell layout (for the
// nav "Sections" dropdown), and the Settings page's show/hide-and-reorder
// editor.
export const TODAY_SECTIONS = [
  { key: "reminders", label: "Reminders" },
  { key: "calendar", label: "Calendar" },
  { key: "weather", label: "Weather" },
  { key: "markets", label: "Markets" },
  { key: "news", label: "News" },
] as const;

export type SectionKey = (typeof TODAY_SECTIONS)[number]["key"];

export const DEFAULT_SECTION_ORDER: SectionKey[] = TODAY_SECTIONS.map((section) => section.key);

const VALID_KEYS = new Set<string>(DEFAULT_SECTION_ORDER);

/** `preferences.section_order` is a plain `text[]` — narrow/dedupe it back to `SectionKey[]`, falling back to the full default order if empty or unrecognized. */
export function parseSectionOrder(value: string[] | null | undefined): SectionKey[] {
  if (!value || value.length === 0) return DEFAULT_SECTION_ORDER;
  const filtered = value.filter((key): key is SectionKey => VALID_KEYS.has(key));
  const deduped = filtered.filter((key, index) => filtered.indexOf(key) === index);
  return deduped.length > 0 ? deduped : DEFAULT_SECTION_ORDER;
}

export function sectionLabel(key: SectionKey): string {
  return TODAY_SECTIONS.find((section) => section.key === key)?.label ?? key;
}
