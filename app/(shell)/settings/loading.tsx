import { SettingsSkeleton } from "@/app/components/settings-skeleton";

// Overrides app/(shell)/loading.tsx (DashboardSkeleton, built for Today's
// weather/markets/news layout) while this route's data resolves — flashing
// that here, for a plain preferences form, read as a rendering bug. A real
// Settings-shaped skeleton, not just a static header, so the loading state
// reads as "this page is loading" rather than "the wrong page loaded".
export default function SettingsLoading() {
  return <SettingsSkeleton />;
}
