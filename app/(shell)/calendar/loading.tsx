import { CalendarSkeleton } from "@/app/components/calendar-skeleton";

// Overrides app/(shell)/loading.tsx's Today-shaped DashboardSkeleton while
// this route's data resolves — same fix as app/(shell)/settings/loading.tsx,
// applied from the start so this new route doesn't introduce the bug. A real
// month-grid-shaped skeleton, not just a static header, so the loading state
// reads as "this page is loading" rather than "the wrong page loaded".
export default function CalendarLoading() {
  return <CalendarSkeleton />;
}
