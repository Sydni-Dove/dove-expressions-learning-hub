"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PROVIDERS = ["zoom", "meet", "youtube", "vimeo", "other"];

export default function LiveSessionForm({ teacherId }: { teacherId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("zoom");
  const [joinUrl, setJoinUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [description, setDescription] = useState("");
  const [prepInstructions, setPrepInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!title.trim()) {
      setError("Give the session a title.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("dp_live_sessions").insert({
      title: title.trim(),
      teacher_id: teacherId,
      provider,
      join_url: joinUrl.trim() || null,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      description: description.trim() || null,
      prep_instructions: prepInstructions.trim() || null
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setTitle("");
    setJoinUrl("");
    setStartsAt("");
    setDescription("");
    setPrepInstructions("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Schedule a live session
      </button>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="font-display text-lg text-burgundy">Schedule a live session</h3>
      <div className="mt-3 space-y-3">
        <div>
          <label className="field-label" htmlFor="ls-title">Title</label>
          <input id="ls-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Week 4 Live Q&A" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="ls-provider">Provider</label>
            <select id="ls-provider" className="input" value={provider} onChange={(e) => setProvider(e.target.value)}>
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="ls-starts">Starts at</label>
            <input id="ls-starts" type="datetime-local" className="input" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="ls-join">Join link</label>
          <input id="ls-join" className="input" value={joinUrl} onChange={(e) => setJoinUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div>
          <label className="field-label" htmlFor="ls-desc">Description</label>
          <textarea id="ls-desc" className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="ls-prep">Prep instructions</label>
          <textarea id="ls-prep" className="input" rows={2} value={prepInstructions} onChange={(e) => setPrepInstructions(e.target.value)} placeholder="What students should do before joining" />
        </div>
        {error && <p role="alert" className="field-error">{error}</p>}
        <div className="flex gap-2">
          <button onClick={create} disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Schedule session"}
          </button>
          <button onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  );
}
