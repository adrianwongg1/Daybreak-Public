import * as Sentry from "@sentry/nextjs";
import { generateBriefing } from "@/app/lib/briefing/generate";
import { isTerminalJobAttempt, MAX_BRIEFING_JOB_ATTEMPTS, retryDelayMinutes } from "@/app/lib/briefing/job-policy";
import { getSupabaseServiceClient } from "@/app/lib/supabase/server";
import type { Tables } from "@/app/lib/supabase/database.types";

const MAX_WORKER_CONCURRENCY = 3;

export type BriefingJob = Tables<"briefing_jobs">;

export async function enqueueBriefingJob(userId: string, briefingDate: string): Promise<BriefingJob> {
  const { data, error } = await getSupabaseServiceClient().rpc("enqueue_briefing_job", {
    p_user_id: userId,
    p_briefing_date: briefingDate,
  });
  const job = data?.[0];
  if (error || !job) throw new Error("Failed to enqueue briefing job");
  return job;
}

async function claimBriefingJobs(limit: number, userId?: string): Promise<BriefingJob[]> {
  const { data, error } = await getSupabaseServiceClient().rpc("claim_briefing_jobs", {
    p_limit: Math.min(Math.max(limit, 0), MAX_WORKER_CONCURRENCY),
    p_user_id: userId,
  });
  if (error) throw new Error("Failed to claim briefing jobs");
  return data ?? [];
}

function errorCode(error: unknown): string {
  if (error instanceof DOMException && error.name === "TimeoutError") return "timeout";
  if (error instanceof TypeError) return "network_error";
  return "generation_failed";
}

async function completeJob(job: BriefingJob): Promise<void> {
  const { error } = await getSupabaseServiceClient()
    .from("briefing_jobs")
    .update({
      status: "succeeded",
      finished_at: new Date().toISOString(),
      locked_until: null,
      last_error_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "running")
    .eq("locked_until", job.locked_until ?? "");
  if (error) throw new Error("Failed to complete briefing job");
}

async function retryOrFailJob(job: BriefingJob, error: unknown): Promise<void> {
  const terminal = isTerminalJobAttempt(job.attempts);
  const retryDelay = retryDelayMinutes(job.attempts);
  const now = new Date();
  const { error: updateError } = await getSupabaseServiceClient()
    .from("briefing_jobs")
    .update({
      status: terminal ? "failed" : "queued",
      scheduled_at: terminal ? job.scheduled_at : new Date(now.getTime() + retryDelay * 60_000).toISOString(),
      finished_at: terminal ? now.toISOString() : null,
      locked_until: null,
      last_error_code: errorCode(error),
      updated_at: now.toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "running")
    .eq("locked_until", job.locked_until ?? "");
  if (updateError) throw new Error("Failed to update failed briefing job");

  Sentry.logger.warn("briefing.job_failed", {
    job_id: job.id,
    attempt: job.attempts,
    terminal,
    error_code: errorCode(error),
  });
}

async function processBriefingJob(job: BriefingJob): Promise<"succeeded" | "retried" | "failed"> {
  try {
    await generateBriefing(job.user_id, undefined, job.briefing_date);
    await completeJob(job);
    Sentry.logger.info("briefing.job_succeeded", { job_id: job.id, attempt: job.attempts });
    return "succeeded";
  } catch (error) {
    await retryOrFailJob(job, error);
    return job.attempts >= MAX_BRIEFING_JOB_ATTEMPTS ? "failed" : "retried";
  }
}

export async function runDueBriefingJobs(options: { limit?: number; userId?: string } = {}) {
  const jobs = await claimBriefingJobs(options.limit ?? MAX_WORKER_CONCURRENCY, options.userId);
  const outcomes = await Promise.all(jobs.map(processBriefingJob));
  return {
    claimed: jobs.length,
    succeeded: outcomes.filter((outcome) => outcome === "succeeded").length,
    retried: outcomes.filter((outcome) => outcome === "retried").length,
    failed: outcomes.filter((outcome) => outcome === "failed").length,
  };
}
