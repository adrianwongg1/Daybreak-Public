import { DEFAULT_STATE, type DaybreakState } from "./types";

// Versioned so a future shape change can detect and reset instead of
// crashing on old JSON.
const STORAGE_KEY = "daybreak.state.v1";

export function loadState(): DaybreakState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<DaybreakState>;
    return {
      preferences: {
        ...DEFAULT_STATE.preferences,
        ...parsed.preferences,
        schedule: {
          ...DEFAULT_STATE.preferences.schedule,
          ...parsed.preferences?.schedule,
        },
      },
      onboarding: {
        ...DEFAULT_STATE.onboarding,
        ...parsed.onboarding,
      },
    };
  } catch {
    return null;
  }
}

export function saveState(state: DaybreakState): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing / quota exceeded — degrade to in-memory only.
  }
}
