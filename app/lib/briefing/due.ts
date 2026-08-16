import { formatLocalIsoDate, resolveBriefingTime, safeTimeZone } from "@/app/lib/briefing/date";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";

export interface DueUser {
  userId: string;
  date: string;
}

function minutesSinceMidnight(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function localMinutesNow(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timeZone),
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

/**
 * Users whose configured briefing time has passed in their own local time
 * and who don't yet have a briefing generated at or after that time for
 * local "today". Called every 15 min by the GitHub Actions cron
 * (.github/workflows/briefing-cron.yml).
 *
 * Deliberately "time has passed" rather than a tight time-window match — a
 * delayed or skipped cron tick just catches overdue users on the next tick
 * instead of permanently missing them.
 *
 * "Not yet generated today" is judged against `briefings.generated_at`
 * rather than mere row presence: a row can exist for today before the
 * scheduled time (e.g. the Today page's generate-if-missing fallback firing
 * on an early page view, or the user pushing their briefing time later
 * same-day), and that early row must not block the real generation once the
 * scheduled time actually arrives. Once a row's `generated_at` is at or
 * after that day's scheduled time, it counts as done and won't be
 * regenerated again on subsequent ticks the same day.
 */
export async function getDueUsers(now: Date = new Date()): Promise<DueUser[]> {
  const supabase = getSupabaseServiceClient();

  const { data: users } = await supabase
    .from("users")
    .select("id, timezone, briefing_time_weekday, briefing_time_weekend")
    .not("onboarding_completed_at", "is", null);
  if (!users || users.length === 0) return [];

  const candidates = users
    .map((user) => {
      const scheduledTime = resolveBriefingTime(user.briefing_time_weekday, user.briefing_time_weekend, user.timezone, now);
      return {
        userId: user.id,
        timezone: user.timezone,
        date: formatLocalIsoDate(now, user.timezone),
        scheduledMinutes: minutesSinceMidnight(scheduledTime),
        due: localMinutesNow(user.timezone, now) >= minutesSinceMidnight(scheduledTime),
      };
    })
    .filter((candidate) => candidate.due);
  if (candidates.length === 0) return [];

  const dates = candidates.map((c) => c.date).sort();
  const { data: existing } = await supabase
    .from("briefings")
    .select("user_id, date, generated_at")
    .in(
      "user_id",
      candidates.map((c) => c.userId)
    )
    .gte("date", dates[0])
    .lte("date", dates[dates.length - 1]);
  const generatedAtByKey = new Map((existing ?? []).map((row) => [`${row.user_id}:${row.date}`, row.generated_at]));

  return candidates
    .filter((c) => {
      const generatedAt = generatedAtByKey.get(`${c.userId}:${c.date}`);
      if (!generatedAt) return true;
      return localMinutesNow(c.timezone, new Date(generatedAt)) < c.scheduledMinutes;
    })
    .map(({ userId, date }) => ({ userId, date }));
}
