import { NextRequest, NextResponse } from "next/server";
import { getDueUsers } from "@/app/lib/briefing/due";
import { enqueueBriefingJob, runDueBriefingJobs } from "@/app/lib/briefing/jobs";

export const maxDuration = 60;

// Phase 4 (PRD 7.2/10): batch entry point called every 15 min by the GitHub
// Actions workflow in .github/workflows/briefing-cron.yml — there's no
// signed-in user behind this call, so it's gated by a shared secret
// (CRON_SECRET) instead of the session check every other route here uses.
// Without this gate, anyone who found the URL could trigger paid generation
// (Claude/Finnhub calls) for every user in the app — see PRD 9 cost control.
//
// No notification email — that half of PRD 7.2 step 8 was built (Resend)
// and then deliberately dropped (see DECISIONS.md): the user doesn't own a
// domain to verify, and wasn't willing to send from an unverified sender
// that would only reach their own inbox. The briefing itself still
// generates on schedule; users just have to open the app to see it.
//
// Manual test once CRON_SECRET is set:
//   curl -X POST http://localhost:3000/api/briefing/cron -H "Authorization: Bearer $CRON_SECRET"
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dueUsers = await getDueUsers();
  const enqueueResults = await Promise.allSettled(dueUsers.map((user) => enqueueBriefingJob(user.userId, user.date)));
  const enqueueFailures = enqueueResults.filter((result) => result.status === "rejected").length;
  const worker = await runDueBriefingJobs();

  if (enqueueFailures > 0 || worker.failed > 0) {
    console.error(JSON.stringify({ event: "briefing.scheduler_failed", due: dueUsers.length, enqueue_failures: enqueueFailures, ...worker }));
  }

  return NextResponse.json({ due: dueUsers.length, enqueued: dueUsers.length - enqueueFailures, enqueueFailures, ...worker });
}
