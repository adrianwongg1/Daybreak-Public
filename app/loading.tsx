import { DashboardSkeleton } from "@/app/components/dashboard-skeleton";

/** Immediate fallback for the root redirect while its session is resolved. */
export default function RootLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-8 sm:px-8 sm:pt-12 lg:px-12">
      <DashboardSkeleton />
    </main>
  );
}
