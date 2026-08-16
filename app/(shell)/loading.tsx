import { DashboardSkeleton } from "@/app/components/dashboard-skeleton";

// Shown while Today/Settings stream in their server-fetched data.
export default function ShellLoading() {
  return <DashboardSkeleton />;
}
