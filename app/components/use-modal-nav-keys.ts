"use client";

import { useEffect } from "react";

interface UseModalNavKeysOptions {
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

/** Escape closes, Left/Right navigate when provided -- shared by every .dialog-based popup that supports Prev/Next (the Today calendar event popup between events, the Calendar page's Day Detail modal between days). */
export function useModalNavKeys({ onClose, onPrev, onNext }: UseModalNavKeysOptions): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft" && onPrev) onPrev();
      else if (event.key === "ArrowRight" && onNext) onNext();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, onPrev, onNext]);
}
