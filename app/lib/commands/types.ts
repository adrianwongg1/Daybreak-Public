// Shapes for the typed command pipeline. This fork has no Google Calendar
// integration, but does have a fully native calendar_events table (its own
// table, no external provider — see app/lib/calendar/), so calendar events
// are a real command target alongside reminders. send_email/draft_email
// remain unsupported (no email provider integration).

export type CommandIntent =
  | "create_reminder"
  | "edit_reminder"
  | "delete_reminder"
  | "create_calendar_event"
  | "edit_calendar_event"
  | "delete_calendar_event"
  | "send_email"
  | "draft_email"
  | "unknown";

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
  /** create_calendar_event: the event's title. */
  eventTitle?: string;
  /** create_calendar_event: local calendar date "YYYY-MM-DD" the event is on. */
  eventDate?: string;
  /** create_calendar_event: local "HH:mm" start time, if the user gave one (omitted for an all-day event). */
  eventStartTime?: string;
  /** create_calendar_event: local "HH:mm" end time, if the user gave one. */
  eventEndTime?: string;
  /** create_calendar_event: true if the user described it as an all-day event with no specific time. */
  eventAllDay?: boolean;
  /** create_calendar_event: location, if given. */
  eventLocation?: string;
  /** Free-text description of a specific existing event the user referred to (edit_calendar_event/delete_calendar_event), e.g. "lunch event" or "dentist appointment". */
  eventReference?: string;
  /** edit_calendar_event: new title, if changing. */
  newEventTitle?: string;
  /** edit_calendar_event: new date, if changing. */
  newEventDate?: string;
  /** edit_calendar_event: new start time, if changing. */
  newEventStartTime?: string;
  /** edit_calendar_event: new end time, if changing. */
  newEventEndTime?: string;
  /** edit_calendar_event: new location, if changing. */
  newEventLocation?: string;
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
