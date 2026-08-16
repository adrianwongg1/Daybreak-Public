"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ONBOARDING_STEPS } from "@/app/onboarding/steps";

export function OnboardingProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isEditing = searchParams.get("from") === "settings";

  const stepIndex = ONBOARDING_STEPS.findIndex((step) => step.href === pathname);
  const currentStep = ONBOARDING_STEPS[stepIndex];

  if (isEditing) {
    return (
      <div style={{ marginBottom: 24 }}>
        <Link href="/settings" className="btn btn-ghost" style={{ fontSize: 12, paddingInline: 0 }}>
          ← Cancel
        </Link>
        <h6 style={{ color: "var(--color-accent-700)", margin: "12px 0 8px" }}>Editing</h6>
        <h2 style={{ margin: 0 }}>{currentStep?.label ?? "Settings"}</h2>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
        <span style={{ width: 10, height: 10, background: "var(--color-accent)", display: "inline-block" }} />
        <span style={{ fontSize: 16, fontFamily: "var(--font-heading)", fontWeight: 800 }}>Daybreak setup</span>
      </div>
      <div style={{ height: 2, background: "var(--color-divider)", margin: "16px 0 8px", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: 2,
            width: `${currentStep?.percent ?? 0}%`,
            background: "var(--color-accent)",
          }}
        />
      </div>
      <h6 style={{ color: "var(--color-accent-700)", margin: "0 0 32px" }}>
        Step {stepIndex + 1} of {ONBOARDING_STEPS.length} · {currentStep?.percent ?? 0}%
      </h6>
    </>
  );
}
