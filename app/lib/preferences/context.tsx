"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loadState, saveState } from "./storage";
import {
  DEFAULT_STATE,
  type DaybreakPreferences,
  type DaybreakState,
  type OnboardingStepId,
} from "./types";

interface PreferencesContextValue {
  preferences: DaybreakPreferences;
  lastCompletedStep: OnboardingStepId | null;
  onboardingComplete: boolean;
  /** False until localStorage has been read on the client. */
  isHydrated: boolean;
  updatePreferences: (patch: Partial<DaybreakPreferences>) => void;
  /** Marks a step as the furthest completed one, for resuming onboarding later. */
  completeStep: (step: OnboardingStepId) => void;
  markOnboardingComplete: () => void;
  /** One-time correction from real Supabase data — see ServerPreferencesHydrator. */
  hydrateFromServer: (preferences: DaybreakPreferences) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DaybreakState>(DEFAULT_STATE);
  const [isHydrated, setIsHydrated] = useState(false);

  // Runs once on mount only — the server render always uses DEFAULT_STATE so
  // there's nothing browser-only to read during the render the server also
  // produces (localStorage doesn't exist there).
  useEffect(() => {
    const loaded = loadState();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-mount hydration from localStorage (unavailable during SSR), not a derived-state cascade
    setState((prev) => {
      if (loaded) return loaded;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return {
        ...prev,
        preferences: {
          ...prev.preferences,
          schedule: { ...prev.preferences.schedule, timezone },
        },
      };
    });
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) saveState(state);
  }, [state, isHydrated]);

  const updatePreferences = useCallback((patch: Partial<DaybreakPreferences>) => {
    setState((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        ...patch,
        schedule: patch.schedule ? { ...prev.preferences.schedule, ...patch.schedule } : prev.preferences.schedule,
      },
    }));
  }, []);

  const completeStep = useCallback((step: OnboardingStepId) => {
    setState((prev) => ({
      ...prev,
      onboarding: { ...prev.onboarding, lastCompletedStep: step },
    }));
  }, []);

  const markOnboardingComplete = useCallback(() => {
    setState((prev) => ({
      ...prev,
      onboarding: { ...prev.onboarding, onboardingComplete: true },
    }));
  }, []);

  const hydrateFromServer = useCallback((preferences: DaybreakPreferences) => {
    setState((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        ...preferences,
        schedule: {
          ...prev.preferences.schedule,
          ...preferences.schedule,
        },
      },
    }));
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences: state.preferences,
      lastCompletedStep: state.onboarding.lastCompletedStep,
      onboardingComplete: state.onboarding.onboardingComplete,
      isHydrated,
      updatePreferences,
      completeStep,
      markOnboardingComplete,
      hydrateFromServer,
    }),
    [state, isHydrated, updatePreferences, completeStep, markOnboardingComplete, hydrateFromServer]
  );

  return (
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return ctx;
}
