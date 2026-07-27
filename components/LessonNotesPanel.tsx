"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SaveStatus } from "@/components/ui";

export default function LessonNotesPanel({ lessonId, userId }: { lessonId: string; userId: string }) {
  const [body, setBody] = useState("");
  const [noteId, setNoteId] = useState<string | null>(null);
  const [status, setStatus] = useState<"saving" | "saved" | "failed" | "offline">("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("dp_notes")
        .select("id,body")
        .eq("author_id", userId)
        .eq("linked_type", "lesson")
        .eq("linked_id", lessonId)
        .maybeSingle();
      if (data) {
        setNoteId(data.id);
        setBody(data.body || "");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  function scheduleSave(nextBody: string) {
    setBody(nextBody);
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        if (!navigator.onLine) {
          setStatus("offline");
          return;
        }
        if (noteId) {
          const { error } = await supabase.from("dp_notes").update({ body: nextBody, save_status: "saved" }).eq("id", noteId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("dp_notes")
            .insert({
              author_id: userId,
              title: "Lesson note",
              body: nextBody,
              note_kind: "personal",
              linked_type: "lesson",
              linked_id: lessonId,
              visibility: "private",
              save_status: "saved"
            })
            .select("id")
            .single();
          if (error) throw error;
          setNoteId(data.id);
        }
        setStatus("saved");
      } catch {
        setStatus("failed");
      }
    }, 900);
  }

  return (
    <div className="card sticky top-8 p-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-base text-burgundy">Notes on this lesson</h3>
        <SaveStatus status={status} />
      </div>
      <textarea
        aria-label="Notes on this lesson"
        value={body}
        onChange={(e) => scheduleSave(e.target.value)}
        rows={10}
        placeholder="Record what stands out, what you're hearing, and any questions for your mentor…"
        className="w-full resize-none input"
      />
      <p className="mt-2 font-ui text-xs text-charcoal/50">Private by default. You can share this note later from Notes &amp; Journal.</p>
    </div>
  );
}
