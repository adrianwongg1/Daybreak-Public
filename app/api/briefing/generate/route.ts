import * as Sentry from "@sentry/nextjs";
import { after, NextResponse } from "next/server";
import { todayInTimeZone } from "@/app/lib/briefing/date";
import { enqueueBriefingJob, runDueBriefingJobs } from "@/app/lib/briefing/jobs";
import { getUserTimezone } from "@/app/lib/briefing/read";
import { getCurrentUserId } from "@/app/lib/supabase/current-user";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";

async function getTodayJob(userId: string) {
  const timezone = await getUserTimezone(userId);
  const briefingDate = todayInTimeZone(timezone);
  const { data, error } = await getSupabaseServiceClient()
    .from("briefing_jobs")
    .select("id, status, attempts, scheduled_at, finished_at, last_error_code")
    .eq("user_id", userId)
    .eq("briefing_date", briefingDate)
    .maybeSingle();
  if (error) throw new Error("Failed to read briefing job");
  return { briefingDate, job: data };
}

export const maxDuration = 60;

/**
 * Enqueue first so the browser can render its preparation state immediately.
 * `after` starts one bounded worker after the HTTP response; the scheduled
 * worker remains the durable fallback if this invocation ends early.
 */
export async function POST() {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { briefingDate } = await getTodayJob(userId);
    const job = await enqueueBriefingJob(userId, briefingDate);

    if (job.status !== "succeeded") {
      after(async () => {
        try {
          await runDueBriefingJobs({ limit: 1, userId });
        } catch (error) {
          Sentry.captureException(error, { tags: { operation: "briefing.first_briefing_worker" } });
          Sentry.logger.error("briefing.first_briefing_worker_failed");
        }
      });
    }

    return NextResponse.json({ job }, { status: job.status === "succeeded" ? 200 : 202 });
  } catch (error) {
    console.error("Briefing job enqueue failed:", error);
    return NextResponse.json({ error: "Failed to prepare briefing" }, { status: 500 });
  }
}

/** Short polling endpoint for the first-time preparation state. */
export async function GET() {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { job } = await getTodayJob(userId);
    return NextResponse.json({ job });
  } catch {
    return NextResponse.json({ error: "Failed to read briefing status" }, { status: 500 });
  }
}
