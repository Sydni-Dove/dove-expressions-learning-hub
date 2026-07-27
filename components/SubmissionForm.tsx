"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SubmissionForm({ assignmentId, studentId }: { assignmentId: string; studentId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [response, setResponse] = useState("");
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function submit() {
    if (!response.trim() && !link.trim()) {
      setError("Add a written response or a link before submitting.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("dp_submissions").insert({
      assignment_id: assignmentId,
      student_id: studentId,
      content: { response },
      file_urls: link ? [link] : []
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary mt-3">
        Submit this assignment
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-3 card p-4">
      <div>
        <label className="mb-1 block font-ui text-xs font-semibold text-charcoal">Your response</label>
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={4}
          className="w-full input"
        />
      </div>
      <div>
        <label className="mb-1 block font-ui text-xs font-semibold text-charcoal">Link (optional — file, recording, etc.)</label>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://…"
          className="w-full input"
        />
      </div>
      {error && <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">{error}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving} className="btn-primary">
          {saving ? "Submitting…" : "Submit"}
        </button>
        <button onClick={() => setOpen(false)} className="font-ui text-sm text-charcoal/50">
          Cancel
        </button>
      </div>
    </div>
  );
}
