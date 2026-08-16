import { RemindersList, type ReminderItem } from "@/app/(shell)/today/reminders-list";

export function RemindersSection({
  id,
  reminders,
  timeZone,
}: {
  id?: string;
  reminders: ReminderItem[];
  timeZone: string;
}) {
  return (
    <section id={id}>
      <h3 style={{ color: "var(--color-text)", margin: "0 0 14px" }}>Reminders</h3>

      {reminders.length === 0 ? (
        <p style={{ fontSize: 15, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
          No open reminders. Try “remind me to…” in the command bar below.
        </p>
      ) : (
        <RemindersList reminders={reminders} timeZone={timeZone} />
      )}
    </section>
  );
}
