import { Suspense } from "react";
import { CalendarSection } from "@/app/(shell)/today/calendar-section";
import { CommandBar } from "@/app/(shell)/today/command-bar";
import { HashScrollOnLoad } from "@/app/(shell)/today/hash-scroll-on-load";
import { MarketSection } from "@/app/(shell)/today/market-section";
import { NewsSection } from "@/app/(shell)/today/news-section";
import { PreparingBriefing } from "@/app/(shell)/today/preparing-briefing";
import { RemindersSection } from "@/app/(shell)/today/reminders-section";
import { WeatherSection } from "@/app/(shell)/today/weather-section";
import { currentLocalHour } from "@/app/lib/briefing/date";
import { requireCompletedSession } from "@/app/lib/auth/require-completed-session";
import { TodayBodySkeleton } from "@/app/components/dashboard-skeleton";
import { TodayRequestTiming } from "@/app/lib/observability/today-request";
import { getTodayDashboardViewModel } from "@/app/lib/today/dashboard";
import type { SectionKey } from "@/app/lib/today-sections";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ prefill?: string }>;
}) {
  const timing = new TodayRequestTiming();
  const { session, userId, displayName, timezone, homeLocation } = await timing.measure("auth_ms", () =>
    requireCompletedSession()
  );

  const firstName = displayName?.trim().split(/\s+/)[0] || session.user?.email?.split("@")[0] || "there";
  const kicker = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  const currentHour = currentLocalHour(timezone);
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="mx-auto max-w-5xl">
      <HashScrollOnLoad />
      <header className="mb-5 border-b border-(--color-divider) pb-4 sm:mb-6 sm:pb-5">
        <h6 className="mb-3 text-(--color-accent-700)">{kicker}</h6>
        <h1 className="max-w-2xl text-(--color-text)">{greeting}, {firstName}.</h1>
        <p className="mt-3 max-w-xl text-sm text-[color-mix(in_srgb,var(--color-text)_60%,transparent)] sm:text-base">
          Your considered briefing for the day ahead.
        </p>
      </header>

      <Suspense fallback={<TodayBodySkeleton />}>
        <TodayBody userId={userId} timezone={timezone} homeLocation={homeLocation} searchParams={searchParams} timing={timing} />
      </Suspense>
    </div>
  );
}

async function TodayBody({
  userId,
  timezone,
  homeLocation,
  searchParams,
  timing,
}: {
  userId: string;
  timezone: string;
  homeLocation: string | null;
  searchParams: Promise<{ prefill?: string }>;
  timing: TodayRequestTiming;
}) {
  let briefingState: "stored" | "generated" | "missing" = "missing";
  let failed = true;

  try {
    const { prefill } = await searchParams;
    const dashboard = await getTodayDashboardViewModel(userId, timezone, homeLocation);
    timing.record("dashboard_db_ms", dashboard.timings.dashboardDbMs);
    timing.record("briefing_read_ms", dashboard.timings.briefingReadMs);

    const briefing = dashboard.briefing;
    briefingState = briefing ? "stored" : "missing";

    const weather = briefing?.weather_json ?? null;

    const sectionsByKey: Record<SectionKey, React.ReactNode> | null = briefing
      ? {
          reminders: <RemindersSection id="section-reminders" reminders={dashboard.reminders} timeZone={dashboard.timezone} />,
          calendar: <CalendarSection id="section-calendar" events={dashboard.calendarEvents} today={dashboard.today} />,
          weather: (
            <WeatherSection
              id="section-weather"
              homeLocation={dashboard.homeLocation}
              weather={weather}
              outfit={briefing.outfit_suggestion}
              savedCities={briefing.saved_cities_weather_json ?? []}
              timeZone={dashboard.timezone}
            />
          ),
          markets: (
            <MarketSection
              id="section-markets"
              initialQuotes={dashboard.marketQuotes}
              tickers={dashboard.marketTickers}
              timeZone={dashboard.timezone}
            />
          ),
          news: <NewsSection id="section-news" initialHeadlines={briefing.news_json} />,
        }
      : null;

    failed = false;
    return (
      <>
        <CommandBar initialText={prefill} suggestions={dashboard.commandSuggestions} />

        {!briefing || !sectionsByKey ? (
          <PreparingBriefing />
        ) : (
          dashboard.sectionOrder.map((key) => (
            <div key={key}>
              <hr className="hr my-7 sm:my-8" />
              {sectionsByKey[key]}
            </div>
          ))
        )}
      </>
    );
  } finally {
    timing.finish({ briefingState, failed });
  }
}
