"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@/app/components/icons";

type Theme = "light" | "dark";

// Not a real pub-sub store — dispatched by toggle() below (this tab) and
// listened to via matchMedia's own "change" event (system preference
// changing while the page is open). useSyncExternalStore handles the
// server/client snapshot mismatch itself (falls back to getServerSnapshot
// during SSR and the initial client render, then re-reads getSnapshot right
// after hydration) — no useEffect/setState needed, which the project's
// lint config flags even for a one-time mount read.
const THEME_CHANGE_EVENT = "daybreak:theme-change";

function readTheme(): Theme {
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(callback: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  media.addEventListener("change", callback);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    media.removeEventListener("change", callback);
  };
}

function getServerSnapshot(): Theme {
  return "light";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, getServerSnapshot);

  function toggle() {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-icon btn-ghost"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  );
}
