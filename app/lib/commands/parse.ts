import type { CommandIntent, ParsedCommand } from "@/app/lib/commands/types";

// Commands use the same economical Gemini model as news. Keeping the model
// pinned makes its quota and cost characteristics explicit.
const GEMINI_MODEL = "gemini-3.5-flash-lite";

// No timeout previously — a slow/hanging Gemini response could block a
// typed command indefinitely (see the news.ts rss-parser default-60s-
// timeout incident this fixed the same day).
const EXTERNAL_FETCH_TIMEOUT_MS = 8000;

const VALID_INTENTS: CommandIntent[] = [
  "create_reminder",
  "edit_reminder",
  "delete_reminder",
  "send_email",
  "draft_email",
  "unknown",
];

interface GeminiParsedCommand {
  intent: string;
  summary: string;
  reminderText: string | null;
  reminderAt: string | null;
  reminderReference: string | null;
  newReminderText: string | null;
  newReminderAt: string | null;
}

function buildSystemInstructions(nowLocalIso: string, timeZone: string): string {
  return (
    `You parse one typed command for a personal daily-briefing app into structured JSON. ` +
    `The user's current local date/time is ${nowLocalIso} in the ${timeZone} timezone — resolve every relative ` +
    `date/time ("tomorrow", "next Tuesday", "3pm", "this week") against that instant, not UTC "now".\n\n` +
    `Classify "intent" as exactly one of:\n` +
    `- create_reminder: wants to be reminded of something, or add a personal to-do.\n` +
    `- edit_reminder: wants to change an existing reminder's text and/or time.\n` +
    `- delete_reminder: wants to cancel/delete an existing reminder.\n` +
    `- send_email: wants an email sent to someone.\n` +
    `- draft_email: wants an email drafted, not sent.\n` +
    `- unknown: doesn't fit any of the above, or is too vague to classify.\n\n` +
    `Fields (use null when not applicable to the classified intent):\n` +
    `- summary: one plain-language sentence restating the request, e.g. "Remind you to call the dentist tomorrow at noon."\n` +
    `- reminderText: for create_reminder, the reminder's content.\n` +
    `- reminderAt: for create_reminder, the local instant "YYYY-MM-DDTHH:mm" if the user gave one, else null.\n` +
    `- reminderReference: for edit_reminder/delete_reminder, free text identifying which existing reminder the user means, e.g. "dentist reminder" or "call mom".\n` +
    `- newReminderText: for edit_reminder, the reminder's new content if the user is changing what it says, else null.\n` +
    `- newReminderAt: for edit_reminder, the new local instant "YYYY-MM-DDTHH:mm" if the user is changing when it fires, else null.\n\n` +
    `Respond with ONLY a JSON object of the exact shape {"intent": string, "summary": string, "reminderText": string|null, ` +
    `"reminderAt": string|null, "reminderReference": string|null, "newReminderText": string|null, "newReminderAt": string|null} — ` +
    `no markdown fences, no other text.`
  );
}

export interface ParseCommandResult {
  parsed: ParsedCommand | null;
  /** Set (with `parsed` left null) when Gemini's free-tier daily quota is exhausted — distinguishes that from a genuine parse failure. */
  quotaExceeded: boolean;
}

const CHAT_SYSTEM_INSTRUCTIONS =
  "You are Daybreak, a warm, concise personal daily-briefing assistant. Answer the user's question naturally, " +
  "without mentioning intent parsing, JSON, tools, or internal implementation. You can explain Daybreak's reminder, " +
  "weather, market, news, and settings features. Do not claim you viewed, created, edited, or deleted " +
  "personal data unless the app has explicitly completed that action. If asked what you can do, explain that you can " +
  "help with reminders, answer questions about Daybreak, and show daily briefing information. " +
  "Keep the response under 100 words.";

/**
 * Normal Gemini chat path for conversation that is not an actionable
 * Daybreak request. Actions continue through `parseCommand` and the
 * server-side handlers, so a friendly model response can never itself
 * mutate Calendar or reminder data.
 */
export async function chatWithGemini(text: string, conversationContext: string[] = []): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    `${CHAT_SYSTEM_INSTRUCTIONS}\n\n` +
                    (conversationContext.length > 0
                      ? `Earlier chat messages:\n${conversationContext.map((message) => `- ${message}`).join("\n")}\n\n`
                      : "") +
                    `Latest user message: "${text}"`,
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
      }
    );
    if (!res.ok) {
      console.error("Gemini chat failed:", res.status, await res.text());
      return null;
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (error) {
    console.error("Gemini chat failed:", error);
    return null;
  }
}

/**
 * Parses one typed command (PRD 7.3) into structured intent via Gemini's
 * free tier — same plain-fetch + JSON-mode pattern as news.ts's headline
 * condensing, since this is also a single cheap structured-output call.
 * Returns `parsed: null` on any parse/API failure so the caller can fall
 * back to a friendly "couldn't understand that" response rather than
 * crashing the command bar.
 */
export async function parseCommand(
  text: string,
  nowLocalIso: string,
  timeZone: string,
  conversationContext: string[] = []
): Promise<ParseCommandResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { parsed: null, quotaExceeded: false };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    `${buildSystemInstructions(nowLocalIso, timeZone)}\n\n` +
                    (conversationContext.length > 0
                      ? `Earlier chat messages, which may help resolve references such as "it" or "that event":\n${conversationContext
                          .map((message) => `- ${message}`)
                          .join("\n")}\n\n`
                      : "") +
                    `Latest user message: "${text}"`,
                },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
      }
    );
    if (!res.ok) {
      console.error("Gemini command parse failed:", res.status, await res.text());
      return { parsed: null, quotaExceeded: res.status === 429 };
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) return { parsed: null, quotaExceeded: false };

    const cleaned = responseText.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(cleaned) as GeminiParsedCommand;
    const intent: CommandIntent = VALID_INTENTS.includes(parsed.intent as CommandIntent)
      ? (parsed.intent as CommandIntent)
      : "unknown";

    return {
      parsed: {
        intent,
        summary: parsed.summary || text,
        reminderText: parsed.reminderText ?? undefined,
        reminderAt: parsed.reminderAt ?? undefined,
        reminderReference: parsed.reminderReference ?? undefined,
        newReminderText: parsed.newReminderText ?? undefined,
        newReminderAt: parsed.newReminderAt ?? undefined,
      },
      quotaExceeded: false,
    };
  } catch (error) {
    console.error("Gemini command parse failed:", error);
    return { parsed: null, quotaExceeded: false };
  }
}
