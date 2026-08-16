"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/lib/auth-actions";
import { CalendarIcon, ChevronDownIcon, TodayIcon } from "@/app/components/icons";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { TODAY_SECTIONS, type SectionKey } from "@/app/lib/today-sections";

// Today and Calendar are the only direct nav tabs — Settings has no tab of
// its own, reached solely via the profile menu below.
const NAV_ITEMS = [
  { href: "/today", label: "Today", Icon: TodayIcon },
  { href: "/calendar", label: "Calendar", Icon: CalendarIcon },
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function NavShell({ userName, sectionOrder }: { userName: string; sectionOrder: SectionKey[] }) {
  const pathname = usePathname();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileMenuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [profileMenuOpen]);

  // Same open/close/click-outside/Escape pattern as the profile menu below,
  // just a second independent instance of it for the "Sections" dropdown.
  const [sectionsMenuOpen, setSectionsMenuOpen] = useState(false);
  const sectionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionsMenuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (sectionsMenuRef.current && !sectionsMenuRef.current.contains(event.target as Node)) {
        setSectionsMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSectionsMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sectionsMenuOpen]);

  // Native hash-scroll on navigation handles the cross-page case (landing
  // on /today already scrolled), but clicking a link to a hash on the exact
  // same page doesn't reliably re-trigger it — so also scroll manually
  // whenever the target section is already present in the DOM.
  function handleSectionClick(key: SectionKey) {
    setSectionsMenuOpen(false);
    document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <nav className="sticky top-0 z-10 grid grid-cols-[1fr_auto] items-center gap-x-3 border-b border-(--color-divider) bg-[color-mix(in_srgb,var(--color-bg)_92%,transparent)] px-5 py-3 backdrop-blur-md sm:grid-cols-[1fr_auto_1fr] sm:px-8 lg:px-12">
      <Link
        href="/today"
        className="flex items-center gap-2.5 justify-self-start no-underline"
      >
        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-(--color-accent) shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_15%,transparent)]" />
        <span className="font-(--font-heading) text-xl font-semibold tracking-tight text-(--color-text)">Daybreak</span>
      </Link>

      <div className="order-3 col-span-2 mt-3 flex justify-self-start sm:order-none sm:col-span-1 sm:mt-0 sm:justify-self-center">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] font-semibold text-(--color-accent-700)"
                  : "text-[color-mix(in_srgb,var(--color-text)_68%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-text)_6%,transparent)] hover:text-(--color-text)"
              }`}
            >
              <Icon size={16} className="shrink-0" />
              <span>{label}</span>
              <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-accent) ${active ? "opacity-100" : "opacity-0"}`} />
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-2 justify-self-end">
        <ThemeToggle />

        {sectionOrder.length > 0 ? (
          <div ref={sectionsMenuRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setSectionsMenuOpen((open) => !open)}
              aria-expanded={sectionsMenuOpen}
              className="btn btn-ghost"
              style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              Sections
              <ChevronDownIcon size={14} className="shrink-0" />
            </button>

            {sectionsMenuOpen ? (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  minWidth: 170,
                  background: "var(--color-bg)",
                  border: "2px solid var(--color-divider)",
                  boxShadow: "var(--shadow-md)",
                  zIndex: 20,
                }}
              >
                {sectionOrder.map((key) => (
                  <Link
                    key={key}
                    href={`/today#section-${key}`}
                    onClick={() => handleSectionClick(key)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 14px",
                      fontSize: 13,
                      fontFamily: "var(--font-body)",
                      color: "var(--color-text)",
                    }}
                  >
                    {TODAY_SECTIONS.find((section) => section.key === key)?.label ?? key}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setProfileMenuOpen((open) => !open)}
            aria-expanded={profileMenuOpen}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              cursor: "pointer",
              padding: 4,
              userSelect: "none",
              background: "none",
              border: "none",
              font: "inherit",
              color: "inherit",
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                background: "var(--color-neutral-200)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 800,
                fontFamily: "var(--font-heading)",
                flex: "none",
              }}
            >
              {initials(userName)}
            </span>
            <span className="hidden text-sm font-semibold sm:inline">{userName}</span>
            <ChevronDownIcon size={14} className="shrink-0" />
          </button>

          {profileMenuOpen ? (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                minWidth: 160,
                background: "var(--color-bg)",
                border: "2px solid var(--color-divider)",
                boxShadow: "var(--shadow-md)",
                zIndex: 20,
              }}
            >
              <Link
                href="/settings"
                onClick={() => setProfileMenuOpen(false)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 14px",
                  fontSize: 13,
                  fontFamily: "var(--font-body)",
                  color: "var(--color-text)",
                }}
              >
                Settings
              </Link>
              <div style={{ height: 2, background: "var(--color-divider)" }} />
              <form action={signOutAction}>
                <button
                  type="submit"
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    padding: "10px 14px",
                    fontSize: 13,
                    fontFamily: "var(--font-body)",
                    color: "var(--color-text)",
                    cursor: "pointer",
                  }}
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
