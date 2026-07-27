"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NEXT_STATUS = [
  { value: "approved", label: "Approve" },
  { value: "returned", label: "Return for revision" },
  { value: "exempt", label: "Mark exempt" }
];

export default function FeedbackForm({ submissionId, authorId }: { submissionId: string; authorId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("approved");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!content.trim()) {
      setError("Write a note for the student before sending.");
      return;
    }
    setSaving(true);
    setError(null);

    const { error: feedbackError } = await supabase.from("dp_feedback").insert({
      submission_id: submissionId,
      author_id: authorId,
      content: content.trim(),
      is_private: false
    });
    if (feedbackError) {
      setSaving(false);
      setError(feedbackError.message);
      return;
    }

    const { error: statusError } = await supabase.from("dp_submissions").update({ status }).eq("id", submissionId);
    setSaving(false);
    if (statusError) {
      setError(statusError.message);
      return;
    }

    setContent("");
    router.refresh();
  }

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-display text-lg text-burgundy">Leave feedback</h2>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        placeholder="Visible to the student."
        className="w-full input"
      />
      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Update status to</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="input"
        >
          {NEXT_STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {error && <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">{error}</p>}
      <button onClick={send} disabled={saving} className="btn-primary">
        {saving ? "Sending…" : "Send feedback"}
      </button>
    </div>
  );
}
