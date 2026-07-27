"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function LessonToolbox({
  lessonId,
  userId,
  lessonTitle,
  lessonNotesText,
  transcriptText,
  initiallyBookmarked,
  onOpenNotes,
  onOpenScriptureList
}: {
  lessonId: string;
  userId: string;
  lessonTitle: string;
  lessonNotesText: string;
  transcriptText: string;
  initiallyBookmarked: boolean;
  onOpenNotes: () => void;
  onOpenScriptureList: () => void;
}) {
  const [bookmarked, setBookmarked] = useState(initiallyBookmarked);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [status, setStatus] = useState("");
  const supabase = createClient();

  async function toggleBookmark() {
    setBookmarkBusy(true);
    if (bookmarked) {
      const { error } = await supabase.from("dp_lesson_bookmarks").delete().eq("user_id", userId).eq("lesson_id", lessonId);
      if (!error) {
        setBookmarked(false);
        setStatus("Bookmark removed");
      }
    } else {
      const { error } = await supabase.from("dp_lesson_bookmarks").insert({ user_id: userId, lesson_id: lessonId });
      if (!error) {
        setBookmarked(true);
        setStatus("Lesson bookmarked");
      }
    }
    setBookmarkBusy(false);
    setTimeout(() => setStatus(""), 2200);
  }

  return (
    <aside aria-labelledby="tools-heading" className="card grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:sticky lg:top-24 lg:grid-cols-1 lg:self-start">
      <h2 id="tools-heading" className="col-span-full mb-1 font-ui text-sm font-bold uppercase tracking-wide text-charcoal/70">
        Lesson Tools
      </h2>
      <button type="button" onClick={onOpenNotes} className="min-h-[42px] rounded-control border border-charcoal/10 bg-white px-3 py-2.5 text-left font-body text-sm text-charcoal/75 transition hover:border-burgundy/30 hover:text-burgundy">
        My Lesson Notes
      </button>
      <button
        type="button"
        onClick={() => {
          downloadText(`${lessonTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-notes.txt`, lessonNotesText);
          setStatus("Lesson notes downloaded");
          setTimeout(() => setStatus(""), 2200);
        }}
        disabled={!lessonNotesText}
        className="min-h-[42px] rounded-control border border-charcoal/10 bg-white px-3 py-2.5 text-left font-body text-sm text-charcoal/75 transition hover:border-burgundy/30 hover:text-burgundy disabled:opacity-40"
      >
        Download Lesson Notes
      </button>
      <button
        type="button"
        onClick={() => {
          downloadText(`${lessonTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-transcript.txt`, transcriptText);
          setStatus("Transcript downloaded");
          setTimeout(() => setStatus(""), 2200);
        }}
        disabled={!transcriptText}
        className="min-h-[42px] rounded-control border border-charcoal/10 bg-white px-3 py-2.5 text-left font-body text-sm text-charcoal/75 transition hover:border-burgundy/30 hover:text-burgundy disabled:opacity-40"
      >
        Download Transcript
      </button>
      <button type="button" onClick={onOpenScriptureList} className="min-h-[42px] rounded-control border border-charcoal/10 bg-white px-3 py-2.5 text-left font-body text-sm text-charcoal/75 transition hover:border-burgundy/30 hover:text-burgundy">
        Scripture List
      </button>
      <Link href="/library" className="min-h-[42px] rounded-control border border-charcoal/10 bg-white px-3 py-2.5 text-left font-body text-sm text-charcoal/75 transition hover:border-burgundy/30 hover:text-burgundy">
        Related Resources
      </Link>
      <button
        type="button"
        onClick={toggleBookmark}
        disabled={bookmarkBusy}
        className="min-h-[42px] rounded-control border border-charcoal/10 bg-white px-3 py-2.5 text-left font-body text-sm text-charcoal/75 transition hover:border-burgundy/30 hover:text-burgundy disabled:opacity-60"
      >
        {bookmarked ? "Bookmarked ✓" : "Bookmark Lesson"}
      </button>
      <span aria-live="polite" className="col-span-full min-h-[1.1rem] font-ui text-xs font-bold text-burgundy">
        {status}
      </span>
    </aside>
  );
}
