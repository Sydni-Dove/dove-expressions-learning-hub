"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TARGETS = ["everyone", "students", "faculty", "teachers"];

export default function AnnouncementForm({ createdBy }: { createdBy: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState("everyone");
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!title.trim()) {
      setError("Give the announcement a title.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("dp_announcements").insert({
      title: title.trim(),
      body: body.trim() || null,
      target_type: targetType,
      is_pinned: isPinned,
      created_by: createdBy
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setTitle("");
    setBody("");
    setTargetType("everyone");
    setIsPinned(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + New announcement
      </button>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="font-display text-lg text-burgundy">New announcement</h3>
      <div className="mt-3 space-y-3">
        <div>
          <label className="field-label" htmlFor="an-title">Title</label>
          <input id="an-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="an-body">Message</label>
          <textarea id="an-body" className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="an-target">Audience</label>
            <select id="an-target" className="input" value={targetType} onChange={(e) => setTargetType(e.target.value)}>
              {TARGETS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <label className="checkbox-row mt-6">
            <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
            Pin to top
          </label>
        </div>
        {error && <p role="alert" className="field-error">{error}</p>}
        <div className="flex gap-2">
          <button onClick={create} disabled={saving} className="btn-primary">
            {saving ? "Posting…" : "Post announcement"}
          </button>
          <button onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  );
}
