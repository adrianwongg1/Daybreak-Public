const baseUrl = process.env.BASE_URL?.replace(/\/$/, "");
const sessionCookie = process.env.SESSION_COOKIE;
const concurrency = Number(process.env.CONCURRENCY ?? "20");
const requests = Number(process.env.REQUESTS ?? "200");

if (!baseUrl || !sessionCookie) {
  throw new Error("Set BASE_URL and SESSION_COOKIE before running this authenticated /today load test.");
}

const durations = [];
const statuses = new Map();
let nextRequest = 0;

async function worker() {
  while (nextRequest < requests) {
    nextRequest += 1;
    const started = performance.now();
    try {
      const response = await fetch(`${baseUrl}/today`, {
        headers: { cookie: sessionCookie },
        redirect: "manual",
      });
      statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
      await response.arrayBuffer();
    } catch {
      statuses.set(0, (statuses.get(0) ?? 0) + 1);
    } finally {
      durations.push(performance.now() - started);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
durations.sort((a, b) => a - b);
const percentile = (p) => durations[Math.min(durations.length - 1, Math.ceil(durations.length * p) - 1)] ?? 0;
console.log(JSON.stringify({
  requests,
  concurrency,
  statuses: Object.fromEntries(statuses),
  p50_ms: Math.round(percentile(0.5)),
  p95_ms: Math.round(percentile(0.95)),
  p99_ms: Math.round(percentile(0.99)),
}, null, 2));
