export interface BriefingSchedule {
  weekdayTime: string;
  weekendEnabled: boolean;
  weekendTime: string;
  timezone: string;
}

export interface DaybreakPreferences {
  displayName: string;
  newsTopics: string[];
  marketTickers: string[];
  schedule: BriefingSchedule;
  homeLocation: string;
  outfitStyle: string;
  coldTolerance: string;
}

// Sign-in ("/login") isn't tracked here or counted as a wizard step — it's
// a standalone page outside app/onboarding/(wizard)/, and its completion is
// real session existence via Supabase Auth, not local state.
export type OnboardingStepId = "name" | "schedule" | "topics" | "location" | "done";

export interface OnboardingState {
  lastCompletedStep: OnboardingStepId | null;
  onboardingComplete: boolean;
}

export interface DaybreakState {
  preferences: DaybreakPreferences;
  onboarding: OnboardingState;
}

// Suggestion catalog for the topic/ticker chip picker (design_handoff_daybreak_app)
// — not an enum: preferences.news_topics/market_tickers are free-text
// columns, and the picker lets users add anything beyond this list too.
export const NEWS_TOPIC_OPTIONS = [
  "World",
  "Technology",
  "Business",
  "Markets",
  "Science",
  "Climate",
  "Politics",
  "Sports",
  "Entertainment",
  "Health",
  "Education",
  "Travel",
] as const;

export const OUTFIT_STYLE_OPTIONS = [
  "Casual",
  "Business casual",
  "Athletic",
  "Formal",
] as const;

export const COLD_TOLERANCE_OPTIONS = [
  "Runs cold",
  "Average",
  "Runs warm",
] as const;

export const DEFAULT_PREFERENCES: DaybreakPreferences = {
  displayName: "",
  newsTopics: ["World", "Technology", "Business"],
  marketTickers: ["SPY", "AAPL", "BTC-USD"],
  schedule: {
    weekdayTime: "07:00",
    weekendEnabled: false,
    weekendTime: "08:00",
    timezone: "UTC",
  },
  homeLocation: "",
  outfitStyle: "Casual",
  coldTolerance: "Average",
};

export const DEFAULT_STATE: DaybreakState = {
  preferences: DEFAULT_PREFERENCES,
  onboarding: {
    lastCompletedStep: null,
    onboardingComplete: false,
  },
};
