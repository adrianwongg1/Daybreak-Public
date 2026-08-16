export interface CalendarEvent {
  id: string;
  title: string;
  /** Local calendar day this event belongs to, YYYY-MM-DD. */
  eventDate: string;
  /** "HH:MM" 24-hour, or null for an all-day event / no specific time. */
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
}

export interface CalendarEventInput {
  title: string;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
}
