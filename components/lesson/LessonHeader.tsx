"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function LessonHeader({
  courseTitle,
  courseId,
  lessonTitle,
  progressPercent,
  onOpenNotes
}: {
  courseTitle: string;
  courseId: string;
  lessonTitle: string;
  progressPercent: number;
  onOpenNotes: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 grid min-h-[72px] grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-burgundy/10 bg-soft/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-10">
        <Link href="/dashboard" className="flex flex-col gap-0.5" aria-label="Dove Expressions home">
          <strong className="font-display text-sm uppercase tracking-[0.34em] text-burgundy">Dove Expressions</strong>
          <span className="font-ui text-[0.62rem] uppercase tracking-[0.22em] text-charcoal/40">Discipleship LMS</span>
        </Link>

        <nav aria-label="Breadcrumb" className="hidden items-center justify-center gap-2 font-ui text-sm text-charcoal/50 sm:flex">
          <Link href={`/courses/${courseId}`} className="font-bold text-burgundy no-underline hover:underline">
            {courseTitle}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="truncate">{lessonTitle}</span>
        </nav>

        <div className="flex items-center justify-end gap-3">
          <div className="hidden min-w-[150px] sm:block">
            <div className="mb-1 flex justify-between font-ui text-[0.68rem] uppercase tracking-wide text-charcoal/50">
              <span>Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-pill bg-burgundy/10">
              <div
                className="h-full rounded-pill bg-gradient-to-r from-burgundy via-coral to-sunrise transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <Link href="/discipleship/journey" className="btn-ghost hidden !min-h-[40px] !px-3 !text-xs sm:inline-flex">
            My Journey
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? "Close mobile navigation" : "Open mobile navigation"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-burgundy/20 text-burgundy sm:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="sticky top-[72px] z-30 grid gap-2 border-b border-burgundy/10 bg-soft p-4 shadow-card sm:hidden" aria-label="Mobile navigation">
          <Link href={`/courses/${courseId}`} className="btn-secondary" onClick={() => setMobileOpen(false)}>
            {courseTitle} / {lessonTitle}
          </Link>
          <Link href="/discipleship/journey" className="btn-secondary" onClick={() => setMobileOpen(false)}>
            My Journey
          </Link>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setMobileOpen(false);
              onOpenNotes();
            }}
          >
            My Lesson Notes
          </button>
        </div>
      )}
    </>
  );
}
