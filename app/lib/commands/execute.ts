import { todayInTimeZone } from "@/app/lib/briefing/date";
import { createCalendarEvent, deleteCalendarEvent, listUpcomingEvents, updateCalendarEvent } from "@/app/lib/calendar/events";
import { formatEventDateLabel, formatEventTime } from "@/app/lib/calendar/format";
import type { CalendarEvent, CalendarEventInput } from "@/app/lib/calendar/types";
import { getCommandLogRow, logCommand, updateCommandStatus } from "@/app/lib/commands/log";
import { chatWithGemini, parseCommand } from "@/app/lib/commands/parse";
import { createReminder, deleteReminder, listOpenReminders, updateReminder } from "@/app/lib/commands/reminders";
import { classifyIntent } from "@/app/lib/commands/risk";
import {
  formatEventLabel,
  formatInstantLabel,
  localNaiveToUtcDate,
  matchEventsByReference,
  matchRemindersByReference,
} from "@/app/lib/commands/resolve";
import type { CommandResponse, ParsedCommand } from "@/app/lib/commands/types";

function nowLocalNaiveIso(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// This fork has no Google Calendar or Gmail integration at all — reminders
// (their own `reminders` table, no external provider) are the only real
// write-side command. send_email/draft_email stay "unsupported" since
// there's no email provider integration.
const UNSUPPORTED_SUFFIX =
  " — Daybreak can't do this yet: there's no email access at all, so nothing was done. No changes were made.";

const CLARIFY_INTENT_MESSAGE =
  "I'm not sure what you're asking. Try something like \"remind me to call the dentist tomorrow at noon.\"";

/**
 * Cheaply recognizes questions about Daybreak itself before invoking the
 * structured action parser. This keeps ordinary chat to one Gemini request,
 * while requests about a user's reminders still reach the existing
 * data-aware command handlers.
 */
function isGeneralConversation(text: string): boolean {
  return /^(?:hi|hello|hey|help|thanks?|what can you do|who are you|how (?:do|does|can)\b|explain\b|tell me about\b)/i.test(
    text.trim()
  );
}

async function handleCreateReminder(
  userId: string,
  parsed: ParsedCommand,
  timeZone: string
): Promise<{ status: "auto_executed" | "rejected"; message: string }> {
  if (!parsed.reminderText) {
    return { status: "rejected", message: 'I couldn\'t tell what to remind you about — try "remind me to call the dentist tomorrow at noon."' };
  }

  const remindAtUtc = parsed.reminderAt ? localNaiveToUtcDate(parsed.reminderAt, timeZone) : null;
  await createReminder(userId, parsed.reminderText, remindAtUtc ? remindAtUtc.toISOString() : null);
  const whenSuffix = remindAtUtc ? ` for ${formatInstantLabel(remindAtUtc, timeZone)}` : "";
  return { status: "auto_executed", message: `Reminder set: "${parsed.reminderText}"${whenSuffix}.` };
}

/** Actually deletes the reminder — shared by the single-match auto-execute path and the multi-match disambiguation-pick path. reminders.ts's own functions don't surface Supabase errors (see completeReminder), so there's no failure branch to report here. */
async function performDeleteReminder(userId: string, reminderId: string, reminderText: string): Promise<{ success: boolean; message: string }> {
  await deleteReminder(userId, reminderId);
  return { success: true, message: `Deleted reminder: "${reminderText}".` };
}

/**
 * A single unambiguous match deletes immediately — typing the command is
 * already the deliberate decision, so requiring a second "confirm to
 * delete" click on top of that is redundant. Only genuine ambiguity (more
 * than one match) still needs a picker, since there the open question isn't
 * "are you sure" but "which one do you mean" — picking an option there
 * deletes it right away too, with no further confirm step. Matches against
 * open reminders only (a completed reminder isn't something you'd naturally
 * ask to delete).
 */
async function handleDeleteReminder(
  userId: string,
  parsed: ParsedCommand
): Promise<{ status: "auto_executed" | "pending" | "rejected"; message: string; disambiguationOptions?: { id: string; label: string }[] }> {
  if (!parsed.reminderReference) {
    return { status: "rejected", message: 'I need to know which reminder to delete — try "delete my dentist reminder."' };
  }

  const reminders = await listOpenReminders(userId);
  const matches = matchRemindersByReference(reminders, parsed.reminderReference);
  if (matches.length === 0) {
    return { status: "rejected", message: `I couldn't find an open reminder matching "${parsed.reminderReference}".` };
  }

  if (matches.length === 1) {
    const outcome = await performDeleteReminder(userId, matches[0].id, matches[0].text);
    return { status: outcome.success ? "auto_executed" : "rejected", message: outcome.message };
  }

  return {
    status: "pending",
    message: `A few reminders match "${parsed.reminderReference}" — which one do you want to delete? This can't be undone.`,
    disambiguationOptions: matches.map((reminder) => ({ id: reminder.id, label: `Delete "${reminder.text}"` })),
  };
}

/** Actually updates the reminder — shared by the single-match auto-execute path and the multi-match disambiguation-pick path. `newReminderAt`, if given, goes through the same local→UTC conversion handleCreateReminder already uses. */
async function performEditReminder(
  userId: string,
  reminderId: string,
  currentText: string,
  parsed: ParsedCommand,
  timeZone: string
): Promise<{ success: boolean; message: string }> {
  const remindAtUtc = parsed.newReminderAt ? localNaiveToUtcDate(parsed.newReminderAt, timeZone) : undefined;
  await updateReminder(userId, reminderId, {
    text: parsed.newReminderText,
    remindAt: remindAtUtc ? remindAtUtc.toISOString() : undefined,
  });
  const newText = parsed.newReminderText ?? currentText;
  const whenSuffix = remindAtUtc ? ` for ${formatInstantLabel(remindAtUtc, timeZone)}` : "";
  return { success: true, message: `Updated reminder: "${newText}"${whenSuffix}.` };
}

/** Same "single match acts immediately, only genuine ambiguity needs a picker" shape as handleDeleteReminder. Also rejects up front when the command gave nothing to actually change. */
async function handleEditReminder(
  userId: string,
  parsed: ParsedCommand,
  timeZone: string
): Promise<{ status: "auto_executed" | "pending" | "rejected"; message: string; disambiguationOptions?: { id: string; label: string }[] }> {
  if (!parsed.reminderReference) {
    return {
      status: "rejected",
      message: 'I need to know which reminder to edit — try "change my dentist reminder to 5pm" or "edit my grocery reminder to say buy milk."',
    };
  }
  if (!parsed.newReminderText && !parsed.newReminderAt) {
    return { status: "rejected", message: "I need something to change it to — a new time or new text." };
  }

  const reminders = await listOpenReminders(userId);
  const matches = matchRemindersByReference(reminders, parsed.reminderReference);
  if (matches.length === 0) {
    return { status: "rejected", message: `I couldn't find an open reminder matching "${parsed.reminderReference}".` };
  }

  if (matches.length === 1) {
    const outcome = await performEditReminder(userId, matches[0].id, matches[0].text, parsed, timeZone);
    return { status: outcome.success ? "auto_executed" : "rejected", message: outcome.message };
  }

  return {
    status: "pending",
    message: `A few reminders match "${parsed.reminderReference}" — which one do you want to edit?`,
    disambiguationOptions: matches.map((reminder) => ({ id: reminder.id, label: `Edit "${reminder.text}"` })),
  };
}

/** "on Monday, August 17, 12:00 PM – 2:00 PM" style suffix, covering every combination of all-day/start-only/start-and-end that a parsed or freshly-created event might have. */
function formatEventWhenSuffix(event: CalendarEvent): string {
  const dateLabel = formatEventDateLabel(event.eventDate);
  if (event.allDay || !event.startTime) return ` on ${dateLabel}`;
  if (event.endTime) return ` on ${dateLabel}, ${formatEventTime(event.startTime)} – ${formatEventTime(event.endTime)}`;
  return ` on ${dateLabel} at ${formatEventTime(event.startTime)}`;
}

async function handleCreateCalendarEvent(
  userId: string,
  parsed: ParsedCommand,
  today: string
): Promise<{ status: "auto_executed" | "rejected"; message: string }> {
  if (!parsed.eventTitle) {
    return {
      status: "rejected",
      message: 'I couldn\'t tell what the event is — try "add lunch with Sam at noon" or "schedule a dentist appointment tomorrow at 3pm."',
    };
  }

  const allDay = parsed.eventAllDay ?? false;
  const event = await createCalendarEvent(userId, {
    title: parsed.eventTitle,
    eventDate: parsed.eventDate || today,
    startTime: allDay ? null : parsed.eventStartTime ?? null,
    endTime: allDay ? null : parsed.eventEndTime ?? null,
    allDay,
    location: parsed.eventLocation ?? null,
    description: null,
  });
  return { status: "auto_executed", message: `Event added: "${event.title}"${formatEventWhenSuffix(event)}.` };
}

/** Actually deletes the event — shared by the single-match auto-execute path and the multi-match disambiguation-pick path. */
async function performDeleteCalendarEvent(userId: string, eventId: string, eventTitle: string): Promise<{ success: boolean; message: string }> {
  await deleteCalendarEvent(userId, eventId);
  return { success: true, message: `Deleted event: "${eventTitle}".` };
}

/** Same "single match acts immediately, only genuine ambiguity needs a picker" shape as handleDeleteReminder, scoped to today's-and-future events only (see listUpcomingEvents). */
async function handleDeleteCalendarEvent(
  userId: string,
  parsed: ParsedCommand,
  today: string
): Promise<{ status: "auto_executed" | "pending" | "rejected"; message: string; disambiguationOptions?: { id: string; label: string }[] }> {
  if (!parsed.eventReference) {
    return { status: "rejected", message: 'I need to know which event to delete — try "delete my lunch event."' };
  }

  const events = await listUpcomingEvents(userId, today);
  const matches = matchEventsByReference(events, parsed.eventReference);
  if (matches.length === 0) {
    return { status: "rejected", message: `I couldn't find an upcoming event matching "${parsed.eventReference}".` };
  }

  if (matches.length === 1) {
    const outcome = await performDeleteCalendarEvent(userId, matches[0].id, matches[0].title);
    return { status: outcome.success ? "auto_executed" : "rejected", message: outcome.message };
  }

  return {
    status: "pending",
    message: `A few events match "${parsed.eventReference}" — which one do you want to delete? This can't be undone.`,
    disambiguationOptions: matches.map((event) => ({ id: event.id, label: `Delete "${formatEventLabel(event)}"` })),
  };
}

/** Actually updates the event — shared by the single-match auto-execute path and the multi-match disambiguation-pick path. Only the provided newEvent* fields change; everything else on `current` is left as-is. */
async function performEditCalendarEvent(
  userId: string,
  eventId: string,
  current: CalendarEvent,
  parsed: ParsedCommand
): Promise<{ success: boolean; message: string }> {
  const patch: Partial<CalendarEventInput> = {};
  if (parsed.newEventTitle !== undefined) patch.title = parsed.newEventTitle;
  if (parsed.newEventDate !== undefined) patch.eventDate = parsed.newEventDate;
  if (parsed.newEventStartTime !== undefined) patch.startTime = parsed.newEventStartTime;
  if (parsed.newEventEndTime !== undefined) patch.endTime = parsed.newEventEndTime;
  if (parsed.newEventLocation !== undefined) patch.location = parsed.newEventLocation;

  await updateCalendarEvent(userId, eventId, patch);
  const updated: CalendarEvent = { ...current, ...patch };
  return { success: true, message: `Updated event: "${updated.title}"${formatEventWhenSuffix(updated)}.` };
}

/** Same "single match acts immediately, only genuine ambiguity needs a picker" shape as handleEditReminder. Also rejects up front when the command gave nothing to actually change. */
async function handleEditCalendarEvent(
  userId: string,
  parsed: ParsedCommand,
  today: string
): Promise<{ status: "auto_executed" | "pending" | "rejected"; message: string; disambiguationOptions?: { id: string; label: string }[] }> {
  if (!parsed.eventReference) {
    return {
      status: "rejected",
      message: 'I need to know which event to edit — try "move my lunch event to 1pm" or "change my dentist appointment to Friday."',
    };
  }
  if (!parsed.newEventTitle && !parsed.newEventDate && !parsed.newEventStartTime && !parsed.newEventEndTime && !parsed.newEventLocation) {
    return { status: "rejected", message: "I need something to change it to — a new time, date, title, or location." };
  }

  const events = await listUpcomingEvents(userId, today);
  const matches = matchEventsByReference(events, parsed.eventReference);
  if (matches.length === 0) {
    return { status: "rejected", message: `I couldn't find an upcoming event matching "${parsed.eventReference}".` };
  }

  if (matches.length === 1) {
    const outcome = await performEditCalendarEvent(userId, matches[0].id, matches[0], parsed);
    return { status: outcome.success ? "auto_executed" : "rejected", message: outcome.message };
  }

  return {
    status: "pending",
    message: `A few events match "${parsed.eventReference}" — which one do you want to edit?`,
    disambiguationOptions: matches.map((event) => ({ id: event.id, label: `Edit "${formatEventLabel(event)}"` })),
  };
}

/**
 * Entry point for a freshly-typed command: parse → classify →
 * execute-if-possible → log. Every branch ends in a `commands_log` row, so
 * the log is a complete record of what was asked even when nothing
 * executed.
 */
export async function runCommand(userId: string, text: string, timeZone: string, conversationContext: string[] = []): Promise<CommandResponse> {
  if (isGeneralConversation(text)) {
    const reply = await chatWithGemini(text, conversationContext);
    const commandId = await logCommand(userId, text, null, reply ? "confirmed" : "rejected");
    return {
      commandId,
      status: reply ? "confirmed" : "rejected",
      message: reply ?? "Sorry, something went wrong responding — try again in a moment.",
    };
  }

  const today = todayInTimeZone(timeZone);
  const { parsed, quotaExceeded } = await parseCommand(text, nowLocalNaiveIso(timeZone), timeZone, conversationContext);

  if (!parsed) {
    const commandId = await logCommand(userId, text, null, "rejected");
    const message = quotaExceeded
      ? "Command parsing has hit today's free AI quota — try again later."
      : "Sorry, something went wrong understanding that — try again in a moment.";
    return { commandId, status: "rejected", message };
  }

  const executability = classifyIntent(parsed.intent);

  if (parsed.intent === "unknown") {
    const reply = await chatWithGemini(text, conversationContext);
    const commandId = await logCommand(userId, text, parsed, reply ? "confirmed" : "rejected");
    return {
      commandId,
      status: reply ? "confirmed" : "rejected",
      message: reply ?? CLARIFY_INTENT_MESSAGE,
    };
  }

  if (executability === "unsupported") {
    const commandId = await logCommand(userId, text, parsed, "rejected");
    return { commandId, status: "rejected", message: `${parsed.summary.replace(/[.\s]+$/, "")}${UNSUPPORTED_SUFFIX}` };
  }

  if (parsed.intent === "create_reminder") {
    const result = await handleCreateReminder(userId, parsed, timeZone);
    const commandId = await logCommand(userId, text, parsed, result.status);
    return { commandId, status: result.status, message: result.message };
  }

  if (parsed.intent === "edit_reminder") {
    const result = await handleEditReminder(userId, parsed, timeZone);
    const commandId = await logCommand(userId, text, parsed, result.status);
    return {
      commandId,
      status: result.status,
      message: result.message,
      disambiguation: result.disambiguationOptions ? { options: result.disambiguationOptions } : undefined,
    };
  }

  if (parsed.intent === "delete_reminder") {
    const result = await handleDeleteReminder(userId, parsed);
    const commandId = await logCommand(userId, text, parsed, result.status);
    return {
      commandId,
      status: result.status,
      message: result.message,
      disambiguation: result.disambiguationOptions ? { options: result.disambiguationOptions } : undefined,
    };
  }

  if (parsed.intent === "create_calendar_event") {
    const result = await handleCreateCalendarEvent(userId, parsed, today);
    const commandId = await logCommand(userId, text, parsed, result.status);
    return { commandId, status: result.status, message: result.message };
  }

  if (parsed.intent === "edit_calendar_event") {
    const result = await handleEditCalendarEvent(userId, parsed, today);
    const commandId = await logCommand(userId, text, parsed, result.status);
    return {
      commandId,
      status: result.status,
      message: result.message,
      disambiguation: result.disambiguationOptions ? { options: result.disambiguationOptions } : undefined,
    };
  }

  // delete_calendar_event
  const result = await handleDeleteCalendarEvent(userId, parsed, today);
  const commandId = await logCommand(userId, text, parsed, result.status);
  return {
    commandId,
    status: result.status,
    message: result.message,
    disambiguation: result.disambiguationOptions ? { options: result.disambiguationOptions } : undefined,
  };
}

/**
 * Completes a "pending" command once the user picks an option from the
 * disambiguation picker. By this point "pending" only ever means genuine
 * ambiguity (see handleDeleteReminder — an unambiguous single match already
 * auto-executed and never reaches here), so the picker click is purely
 * "which one do you mean," not a second confirmation of the action itself.
 */
export async function resolveCommand(
  userId: string,
  commandId: string,
  selectedEventId: string,
  timeZone: string
): Promise<CommandResponse> {
  const row = await getCommandLogRow(userId, commandId);
  if (!row || row.status !== "pending" || !row.parsedCommand) {
    return { commandId, status: "rejected", message: "This request is no longer available — try asking again." };
  }

  const parsed = row.parsedCommand;

  if (parsed.intent === "delete_calendar_event" || parsed.intent === "edit_calendar_event") {
    const events = await listUpcomingEvents(userId, todayInTimeZone(timeZone));
    const selected = events.find((event) => event.id === selectedEventId);
    if (!selected) {
      await updateCommandStatus(commandId, "rejected");
      return { commandId, status: "rejected", message: "That event couldn't be found anymore." };
    }

    const outcome =
      parsed.intent === "delete_calendar_event"
        ? await performDeleteCalendarEvent(userId, selected.id, selected.title)
        : await performEditCalendarEvent(userId, selected.id, selected, parsed);
    await updateCommandStatus(commandId, outcome.success ? "confirmed" : "rejected");
    return { commandId, status: outcome.success ? "confirmed" : "rejected", message: outcome.message };
  }

  const reminders = await listOpenReminders(userId);
  const selected = reminders.find((reminder) => reminder.id === selectedEventId);
  if (!selected) {
    await updateCommandStatus(commandId, "rejected");
    return { commandId, status: "rejected", message: "That reminder couldn't be found anymore." };
  }

  const outcome =
    parsed.intent === "delete_reminder"
      ? await performDeleteReminder(userId, selected.id, selected.text)
      : await performEditReminder(userId, selected.id, selected.text, parsed, timeZone);
  await updateCommandStatus(commandId, outcome.success ? "confirmed" : "rejected");
  return { commandId, status: outcome.success ? "confirmed" : "rejected", message: outcome.message };
}
