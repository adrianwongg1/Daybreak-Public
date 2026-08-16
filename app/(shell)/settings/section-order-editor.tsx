"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@/app/components/icons";
import { setSectionOrderAction } from "@/app/lib/preferences/actions";
import { TODAY_SECTIONS, type SectionKey } from "@/app/lib/today-sections";

function RowButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        border: "none",
        background: "none",
        padding: 4,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.3 : 0.75,
        color: "inherit",
        display: "inline-flex",
      }}
    >
      {children}
    </button>
  );
}

// Show/hide and reorder for the Today page's four sections. `order` holds
// only the currently-visible keys, in render order — checking a box appends
// it, unchecking filters it out, and the up/down buttons swap adjacent
// entries — the exact same "here is the new full list, persist it" shape
// market-section.tsx uses for ticker reordering, just with a checkbox
// standing in for its remove (X) button.
export function SectionOrderEditor({ initialOrder }: { initialOrder: SectionKey[] }) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState(false);

  function persist(next: SectionKey[]) {
    setOrder(next);
    setSaveError(false);
    startTransition(async () => {
      try {
        await setSectionOrderAction(next);
        router.refresh();
      } catch {
        setSaveError(true);
      }
    });
  }

  function toggle(key: SectionKey, checked: boolean) {
    if (checked) {
      if (order.includes(key)) return;
      persist([...order, key]);
    } else {
      persist(order.filter((existing) => existing !== key));
    }
  }

  function moveUp(index: number) {
    if (index <= 0) return;
    const next = [...order];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    persist(next);
  }

  function moveDown(index: number) {
    if (index >= order.length - 1) return;
    const next = [...order];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    persist(next);
  }

  // Rows follow `order` itself for included sections (so the up/down
  // buttons visibly move the row they act on), with excluded sections
  // trailing at the bottom in their fixed TODAY_SECTIONS order — otherwise
  // the list never visibly changes when reordering, even though the
  // persisted order (and the Today page) does.
  const includedRows = order.map((key) => TODAY_SECTIONS.find((section) => section.key === key)!);
  const excludedRows = TODAY_SECTIONS.filter((section) => !order.includes(section.key));
  const rows = [...includedRows, ...excludedRows];

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {rows.map(({ key, label }) => {
          const included = order.includes(key);
          const index = order.indexOf(key);
          return (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px solid var(--color-divider)",
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={included}
                  onChange={(event) => toggle(key, event.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--color-accent)", cursor: "pointer" }}
                />
                {label}
              </label>
              {included ? (
                <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <RowButton onClick={() => moveUp(index)} disabled={index === 0} label={`Move ${label} up`}>
                    <ChevronUpIcon size={14} />
                  </RowButton>
                  <RowButton onClick={() => moveDown(index)} disabled={index === order.length - 1} label={`Move ${label} down`}>
                    <ChevronDownIcon size={14} />
                  </RowButton>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {saveError ? (
        <p style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 8 }}>Couldn&apos;t save — check your connection.</p>
      ) : isPending ? (
        <p className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
          Saving…
        </p>
      ) : null}
    </div>
  );
}
