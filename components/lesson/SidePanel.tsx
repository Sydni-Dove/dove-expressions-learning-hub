"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Shared slide-over drawer used by ScriptureDrawer and LessonNotesDrawer.
    Handles backdrop, Escape-to-close, body scroll lock while open, and
    returns focus to whatever triggered it when it closes. */
export default function SidePanel({
  open,
  onClose,
  title,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-charcoal/35 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        aria-hidden={!open}
        aria-labelledby={`panel-title-${title.replace(/\s+/g, "-").toLowerCase()}`}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col overflow-y-auto bg-white shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-charcoal/10 bg-white/95 p-4 backdrop-blur">
          <h2 id={`panel-title-${title.replace(/\s+/g, "-").toLowerCase()}`} className="font-display text-xl text-burgundy">
            {title}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-charcoal/15 text-charcoal/60 transition hover:border-burgundy/40 hover:text-burgundy"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </aside>
    </>
  );
}
