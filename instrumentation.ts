import type { Instrumentation } from "next";

// Both register() and onRequestError below are gated on the DSN so that a
// deploy with Sentry unconfigured (this fork's default — see
// sentry.server.config.ts) never pulls @sentry/nextjs and its OpenTelemetry
// dependencies into the cold-start path. Static `import * as Sentry` here
// used to load ~3MB of Sentry/OTel code into every Node.js function's entry
// chunk on every cold start regardless of whether a DSN was set; the dynamic
// imports below defer that into an on-demand chunk that's never fetched
// when there's nothing to configure.
const dsnConfigured = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export async function register() {
  if (!dsnConfigured) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError | undefined = dsnConfigured
  ? async (...args) => {
      const Sentry = await import("@sentry/nextjs");
      return Sentry.captureRequestError(...args);
    }
  : undefined;
