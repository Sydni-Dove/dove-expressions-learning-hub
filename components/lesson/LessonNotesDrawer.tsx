"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SaveStatus } from "@/components/ui";
import SidePanel from "@/components/lesson/SidePanel";

/** "My Lesson Notes" drawer — same dp_notes storage (linked_type "lesson") as the
    original sidebar LessonNotesPanel, just presented as a slide-over to match the
    prototype's toolbox-triggered drawer instead of a permanent sidebar card. */
export default function LessonNotesDrawer({ open, onClose, lessonId, userId }: { open: boolean; onClose: () => void; lessonId: string; userId: string }) {
  const [body, setBody] = useState("");
  const [noteId, setNoteId] = useState<string | null>(null);
  const [status, setStatus] = useState<"saving" | "saved" | "failed" | "offline">("saved");
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

  async function save(nextBody: string) {
    setStatus("saving");
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
  }

  function clear() {
    setBody("");
    save("");
  }

  return (
    <SidePanel open={open} onClose={onClose} title="My Lesson Notes">
      <p className="mb-3 font-body text-sm text-charcoal/70">
        These notes belong to the teaching page. Deeper reflection happens in Reflection &amp; Activation below the lesson.
      </p>
      <label className="field-label" htmlFor="global-lesson-notes">
        Lesson notes
      </label>
      <textarea
        id="global-lesson-notes"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Capture key phrases, questions, or Scriptures you want to revisit."
        rows={10}
        className="input"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary" onClick={() => save(body)}>
          Save Notes
        </button>
        <button type="button" className="btn-ghost" onClick={clear}>
          Clear
        </button>
        <SaveStatus status={status} />
      </div>
    </SidePanel>
  );
}
