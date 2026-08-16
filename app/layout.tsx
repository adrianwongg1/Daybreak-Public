import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { PreferencesProvider } from "@/app/lib/preferences/context";
import "./globals.css";

// Inter — the de facto industry-standard UI typeface (Linear, Vercel,
// Notion, Stripe Dashboard all use it or a close relative) for the redesign
// away from the previous "Modernist" Archivo-only system. Variable font, so
// no `weight` array — headings and body both read `--font-inter` and pick
// their own weight in globals.css, same CSS-variable-on-<html> pattern the
// old Archivo setup already used.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Daybreak",
  description: "Your personalized morning briefing.",
};

// Runs before hydration (strategy="beforeInteractive" — see
// node_modules/next/dist/docs/01-app/02-guides/scripts.md) so the correct
// theme is already on <html> when CSS first applies, avoiding a flash of
// the wrong theme. A raw <script> tag here instead of next/script's managed
// injection logs "scripts inside React components are never executed when
// rendering on the client" and doesn't actually run reliably. Mirrors the
// localStorage lookup in app/components/theme-toggle.tsx; keep the two in
// sync if the storage key or values ever change. Wrapped in try/catch since
// localStorage can throw in some privacy-mode configurations.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the theme-init script above sets
    // data-theme on this element before React hydrates, which is an
    // intentional, expected mismatch against the server-rendered markup
    // (the server has no access to the client's localStorage) — the
    // standard companion setting for this technique, scoped to just this
    // element rather than disabling hydration warnings app-wide.
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <PreferencesProvider>{children}</PreferencesProvider>
      </body>
    </html>
  );
}
