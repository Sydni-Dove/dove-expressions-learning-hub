"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SaveStatus } from "@/components/ui";

/** "Pause and Reflect" — a short, lightweight note tied to one specific point in the
    teaching, distinct from the full Reflection & Activation form at the end of the
    lesson. Persists to dp_notes (linked_type "lesson_block") so it belongs only to
    the signed-in student, reusing the same private-notes storage as the rest of the
    app rather than introducing a parallel table. */
export default function ReflectionPrompt({
  blockId,
  userId,
  prompt
}: {
  blockId: string;
  userId: string;
  prompt: string;
}) {
  const [body, setBody] = useState("");
  const [noteId, setNoteId] = useState<string | null>(null);
  const [status, setStatus] = useState<"saving" | "saved" | "failed" | "offline" | null>(null);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("dp_notes")
        .select("id,body")
        .eq("author_id", userId)
        .eq("linked_type", "lesson_block")
        .eq("linked_id", blockId)
        .maybeSingle();
      if (data) {
        setNoteId(data.id);
        setBody(data.body || "");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId]);

  async function save() {
    setStatus("saving");
    try {
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      if (noteId) {
        const { error } = await supabase.from("dp_notes").update({ body }).eq("id", noteId);
        if (error) throw error;
      } else if (body.trim()) {
        const { data, error } = await supabase
          .from("dp_notes")
          .insert({
            author_id: userId,
            title: "Pause and Reflect",
            body,
            note_kind: "personal",
            linked_type: "lesson_block",
            linked_id: blockId,
            visibility: "private"
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

  return (
    <div className="my-6 max-w-[760px] rounded-card border border-burgundy/10 bg-white p-5 shadow-soft">
      <h3 className="mb-1.5 font-display text-lg text-burgundy">Pause and Reflect</h3>
      <p className="mb-3 font-body text-charcoal/80">{prompt}</p>
      <label className="field-label" htmlFor={`note-${blockId}`}>
        Lesson note, optional
      </label>
      <textarea
        id={`note-${blockId}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={save}
        placeholder="Write a brief note for yourself."
        rows={3}
        className="input"
      />
      {status && (
        <div className="mt-2">
          <SaveStatus status={status} />
        </div>
      )}
    </div>
  );
}
