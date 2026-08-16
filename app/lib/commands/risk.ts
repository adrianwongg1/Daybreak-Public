import type { CommandIntent } from "@/app/lib/commands/types";

export type Executability = "executable" | "unsupported";

/**
 * Which typed-command intents actually have code behind them. Reminders and
 * calendar events are both fully real (their own tables, no external
 * provider). An unambiguous single match auto-executes immediately in
 * execute.ts — typing the command is already the user's deliberate
 * decision, so a further "confirm" click was found to be redundant
 * friction. A "pending" step only happens for genuine ambiguity (more than
 * one match) — that picker is about identifying which reminder/event is
 * meant, not confirming the action, and picking an option executes
 * immediately with no further confirm step. `send_email`/`draft_email`
 * remain "unsupported": no email provider integration at all.
 */
export function classifyIntent(intent: CommandIntent): Executability {
  switch (intent) {
    case "create_reminder":
    case "edit_reminder":
    case "delete_reminder":
    case "create_calendar_event":
    case "edit_calendar_event":
    case "delete_calendar_event":
      return "executable";
    case "send_email":
    case "draft_email":
    case "unknown":
      return "unsupported";
  }
}
