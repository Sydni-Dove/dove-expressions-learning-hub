"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Pill } from "@/components/ui";

interface AssignmentRow {
  id: string;
  title: string;
  assignment_type: string;
  due_at: string | null;
}

const TYPES = ["written", "reflection", "scripture_study", "checklist", "file", "voice_memo", "project", "discussion", "testimony", "quiz"];

export default function AssignmentQuickForm({
  lessonId,
  courseId,
  assignments
}: {
  lessonId: string;
  courseId: string;
  assignments: AssignmentRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("written");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function create() {
    if (!title.trim()) {
      setError("Give the assignment a title.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("dp_assignments").insert({
      lesson_id: lessonId,
      course_id: courseId,
      title: title.trim(),
      description: description || null,
      assignment_type: type,
      due_at: dueAt || null
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setTitle("");
    setDescription("");
    setDueAt("");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {assignments.map((a) => (
        <div key={a.id} className="card flex items-center justify-between p-4">
          <span className="font-body text-sm text-charcoal">{a.title}</span>
          <div className="flex items-center gap-2">
            <Pill tone="neutral">{a.assignment_type.replace(/_/g, " ")}</Pill>
            {a.due_at && <span className="font-ui text-xs text-charcoal/50">due {new Date(a.due_at).toLocaleDateString()}</span>}
          </div>
        </div>
      ))}
      {assignments.length === 0 && !open && <p className="font-ui text-sm text-charcoal/50">No assignments attached to this lesson yet.</p>}

      {!open ? (
        <button onClick={() => setOpen(true)} className="btn-secondary">
          + Add assignment
        </button>
      ) : (
        <div className="card space-y-3 p-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Assignment title"
            className="w-full input"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Instructions for the student"
            rows={3}
            className="w-full input"
          />
          <div className="flex flex-wrap gap-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="input"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="input"
            />
          </div>
          {error && <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">{error}</p>}
          <div className="flex gap-2">
            <button onClick={create} disabled={saving} className="btn-primary">
              {saving ? "Creating…" : "Create assignment"}
            </button>
            <button onClick={() => setOpen(false)} className="font-ui text-sm text-charcoal/50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
