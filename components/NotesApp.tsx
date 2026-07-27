"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SaveStatus, Pill } from "@/components/ui";
import type { DpNote } from "@/lib/types";

const VISIBILITY_LABELS: Record<string, string> = {
  private: "Private",
  mentor: "Shared with mentor",
  teacher: "Shared with teacher",
  cohort: "Shared with cohort",
  selected_students: "Shared with selected students",
  community: "Shared with community"
};

export default function NotesApp({ userId }: { userId: string }) {
  const supabase = createClient();
  const [notes, setNotes] = useState<DpNote[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [status, setStatus] = useState<"saving" | "saved" | "failed" | "offline">("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadNotes() {
    const { data } = await supabase
      .from("dp_notes")
      .select("id,author_id,title,body,note_kind,tags,visibility,save_status,is_pinned,updated_at")
      .eq("author_id", userId)
      .neq("note_kind", "folder")
      .order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false });
    setNotes((data as DpNote[]) ?? []);
  }

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectNote(note: DpNote) {
    setActiveId(note.id);
    setTitle(note.title || "");
    setBody(note.body || "");
    setVisibility(note.visibility);
  }

  async function createNote() {
    setStatus("saving");
    const { data, error } = await supabase
      .from("dp_notes")
      .insert({ author_id: userId, title: "Untitled note", body: "", note_kind: "personal", visibility: "private", save_status: "saved" })
      .select("*")
      .single();
    if (!error && data) {
      setStatus("saved");
      await loadNotes();
      selectNote(data as DpNote);
    } else {
      setStatus("failed");
    }
  }

  function scheduleSave(nextTitle: string, nextBody: string, nextVisibility: string) {
    if (!activeId) return;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("dp_notes")
        .update({ title: nextTitle, body: nextBody, visibility: nextVisibility })
        .eq("id", activeId);
      if (error) {
        setStatus("failed");
      } else {
        setStatus("saved");
        loadNotes();
      }
    }, 800);
  }

  return (
    <div className="grid gap-6 pb-16 lg:grid-cols-[280px_1fr]">
      <div>
        <button onClick={createNote} className="btn-primary w-full">
          + New note
        </button>
        <ul className="mt-4 space-y-2">
          {notes.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => selectNote(n)}
                className={`w-full rounded-lg border px-3 py-2 text-left font-ui text-sm transition ${
                  activeId === n.id ? "border-burgundy bg-pale-pink/40" : "border-charcoal/10 hover:border-burgundy/40"
                }`}
              >
                <span className="block truncate font-semibold text-charcoal">{n.title || "Untitled note"}</span>
                <span className="mt-0.5 block text-xs text-charcoal/50">{VISIBILITY_LABELS[n.visibility]}</span>
              </button>
            </li>
          ))}
          {notes.length === 0 && <p className="font-ui text-xs text-charcoal/50">No notes yet. Create your first one.</p>}
        </ul>
      </div>

      <div className="card p-6">
        {activeId ? (
          <>
            <div className="mb-3 flex items-center justify-between">
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  scheduleSave(e.target.value, body, visibility);
                }}
                placeholder="Note title"
                className="w-full border-none bg-transparent font-display text-xl text-burgundy focus:outline-none"
              />
              <SaveStatus status={status} />
            </div>
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                scheduleSave(title, e.target.value, visibility);
              }}
              rows={14}
              placeholder="Write freely. Your quotation marks and formatting are preserved exactly as entered."
              className="w-full resize-none rounded-lg border border-charcoal/15 p-4 font-body leading-relaxed focus:border-burgundy focus:outline-none"
            />
            <div className="mt-4 flex items-center gap-3">
              <label htmlFor="visibility" className="font-ui text-xs font-semibold text-charcoal/60">
                Visibility
              </label>
              <select
                id="visibility"
                value={visibility}
                onChange={(e) => {
                  setVisibility(e.target.value);
                  scheduleSave(title, body, e.target.value);
                }}
                className="input"
              >
                {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Pill tone={visibility === "private" ? "neutral" : "burgundy"}>{VISIBILITY_LABELS[visibility]}</Pill>
            </div>
          </>
        ) : (
          <p className="font-body text-charcoal/60">Select a note, or create a new one to begin.</p>
        )}
      </div>
    </div>
  );
}
