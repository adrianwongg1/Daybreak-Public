import { Suspense } from "react";
import { NavShell } from "@/app/components/nav-shell";
import BackToTop from "@/app/components/backtotop";
import { ShellNavigation } from "@/app/(shell)/shell-navigation";

// The page can stream immediately. Personal navigation is resolved in its
// own Suspense boundary rather than blocking the loading skeleton.
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-(--color-bg)">
      <Suspense fallback={<NavShell userName="Account" sectionOrder={[]} />}>
        <ShellNavigation />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-8 sm:px-8 sm:pt-12 lg:px-12">{children}</main>
      <BackToTop />
    </div>
  );
}
