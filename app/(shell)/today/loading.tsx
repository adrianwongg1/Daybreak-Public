import { DashboardSkeleton } from "@/app/components/dashboard-skeleton";

/** Route-level fallback so Today has its own boundary for sibling navigations (e.g. from Settings), not just the shared shell fallback. */
export default function TodayLoading() {
  return <DashboardSkeleton />;
}
