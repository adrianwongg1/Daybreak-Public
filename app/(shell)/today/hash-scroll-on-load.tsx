"use client";

import { useEffect } from "react";

// The browser's native scroll-to-#hash-on-load only fires once, at the
// initial paint — this page's sections render from server data and
// hydrate a beat later, so arriving at /today#section-weather via a fresh
// navigation (not a same-page nav dropdown click, which scrolls itself)
// misses that first scroll. Retry once after mount instead.
export function HashScrollOnLoad() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView();
  }, []);

  return null;
}
