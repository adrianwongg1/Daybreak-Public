"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ChipPicker } from "@/app/components/chip-picker";
import { saveTopicsStep } from "@/app/lib/onboarding/actions";
import { usePreferences } from "@/app/lib/preferences/context";
import { NEWS_TOPIC_OPTIONS } from "@/app/lib/preferences/types";

function SectionHeading({ title, editHref }: { title: string; editHref: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <Link href={editHref} className="btn btn-ghost" style={{ fontSize: 12 }}>
        Edit
      </Link>
    </div>
  );
}

// Name/schedule/location stay read-only-with-an-Edit-link (real editing
// happens on the matching onboarding step, via ?from=settings — see
// app/onboarding/use-step-nav.ts). Topics is the one section that edits in
// place: the design wires its add/remove chips to real state directly (no
// separate "Save"), so this saves through saveTopicsStep on every change
// instead of routing through a step page. Market tickers are managed only
// on the Today page's Markets section now (add/remove/reorder there) — this
// still passes the current ticker list through unchanged on every topics
// save, since saveTopicsStep writes both columns in one update.
export function SettingsPreferences() {
  const { preferences, updatePreferences, isHydrated } = usePreferences();
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState(false);

  function persist(nextTopics: string[]) {
    setSaveError(false);
    startTransition(async () => {
      try {
        await saveTopicsStep(nextTopics, preferences.marketTickers);
      } catch {
        setSaveError(true);
      }
    });
  }

  function addTopic(topic: string) {
    const next = [...preferences.newsTopics, topic];
    updatePreferences({ newsTopics: next });
    persist(next);
  }
  function removeTopic(topic: string) {
    const next = preferences.newsTopics.filter((t) => t !== topic);
    updatePreferences({ newsTopics: next });
    persist(next);
  }

  if (!isHydrated) {
    return (
      <p className="text-muted" style={{ fontSize: 14 }}>
        Loading preferences…
      </p>
    );
  }

  const { schedule } = preferences;

  return (
    <div>
      <SectionHeading title="Name" editHref="/onboarding/name?from=settings" />
      <div className="field">
        <label>Display name</label>
        <input className="input" value={preferences.displayName || "Not set"} readOnly />
      </div>

      <hr className="hr" style={{ margin: "28px 0" }} />

      <SectionHeading title="Briefing schedule" editHref="/onboarding/schedule?from=settings" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div className="field">
          <label>Weekday time</label>
          <input className="input" value={schedule.weekdayTime} readOnly />
        </div>
        <div className="field">
          <label>Weekend time</label>
          <input className="input" value={schedule.weekendEnabled ? schedule.weekendTime : "Not set"} readOnly />
        </div>
        <div className="field">
          <label>Timezone</label>
          <input className="input" value={schedule.timezone} readOnly />
        </div>
      </div>

      <hr className="hr" style={{ margin: "28px 0" }} />

      <h3 style={{ margin: "0 0 14px" }}>News topics</h3>
      <ChipPicker
        values={preferences.newsTopics}
        onAdd={addTopic}
        onRemove={removeTopic}
        catalog={NEWS_TOPIC_OPTIONS}
        addLabel="+ Add topic"
        searchPlaceholder="Search or type a topic"
      />

      {saveError ? (
        <p style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 8 }}>Couldn&apos;t save — check your connection.</p>
      ) : isPending ? (
        <p className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
          Saving…
        </p>
      ) : null}

      <hr className="hr" style={{ margin: "28px 0" }} />

      <SectionHeading title="Location & outfit" editHref="/onboarding/location?from=settings" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px 16px" }}>
        <div className="field">
          <label>Home location</label>
          <input className="input" value={preferences.homeLocation || "Not set"} readOnly />
        </div>
        <div className="field">
          <label>Cold tolerance</label>
          <input className="input" value={preferences.coldTolerance} readOnly />
        </div>
      </div>
      <div className="field" style={{ marginTop: 16 }}>
        <label>Style preference</label>
        <input className="input" value={preferences.outfitStyle} readOnly />
      </div>
    </div>
  );
}
