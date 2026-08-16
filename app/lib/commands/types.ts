// Shapes for the typed command pipeline. This fork has no Google Calendar
// integration at all, so the command taxonomy is narrowed to what's fully
// buildable without it: reminders (app-local state) plus general chat.
// send_email/draft_email remain unsupported (no email provider integration).

export type CommandIntent = "create_reminder" | "edit_reminder" | "delete_reminder" | "send_email" | "draft_email" | "unknown";

/** Gemini's structured parse of one typed command — see app/lib/commands/parse.ts. */
export interface ParsedCommand {
  intent: CommandIntent;
  /** One-sentence plain-language restatement, shown in the response/confirm card. */
  summary: string;
  /** create_reminder: the reminder's content. */
  reminderText?: string;
  /** create_reminder: local wall-clock instant, "YYYY-MM-DDTHH:mm", if the user gave one. */
  reminderAt?: string;
  /** Free-text description of a specific existing open reminder the user referred to (edit_reminder/delete_reminder), e.g. "dentist reminder". */
  reminderReference?: string;
  /** edit_reminder: the reminder's new content, if the user is changing what it says. */
  newReminderText?: string;
  /** edit_reminder: local wall-clock instant, "YYYY-MM-DDTHH:mm", if the user is changing when it fires. */
  newReminderAt?: string;
}

export type CommandStatus = "auto_executed" | "confirmed" | "rejected" | "pending";

export interface EventOption {
  id: string;
  /** "Call the dentist — due Thu, Jul 30, 2:00 PM" style label for a disambiguation picker row. */
  label: string;
}

export interface CommandResponse {
  commandId: string;
  status: CommandStatus;
  message: string;
  /** Present only when status is "pending" — a reminderReference matched more than one open reminder. */
  disambiguation?: { options: EventOption[] };
}
