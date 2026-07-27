"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CONTENT_TYPES = [
  { value: "user_conduct", label: "Another user's conduct" },
  { value: "message", label: "A message" },
  { value: "community_post", label: "A community post" },
  { value: "session", label: "A mentoring session" },
  { value: "other", label: "Something else" }
];

export default function ReportForm({ reporterId }: { reporterId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [contentType, setContentType] = useState(CONTENT_TYPES[0].value);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError("Describe what happened so faculty can review it.");
      return;
    }

    setSaving(true);
    const { error: insertError } = await supabase.from("dp_reports").insert({
      reporter_id: reporterId,
      content_type: contentType,
      reason: reason.trim()
    });
    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setReason("");
    setSubmitted(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">This report is about</label>
        <select
          value={contentType}
          onChange={(e) => setContentType(e.target.value)}
          className="w-full input"
        >
          {CONTENT_TYPES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">What happened</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={5}
          placeholder="Include who was involved, when it happened, and anything else that would help faculty understand the situation."
          className="w-full input"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">
          {error}
        </p>
      )}
      {submitted && (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 font-ui text-sm text-green-800">
          Report submitted. You can see its status below.
        </p>
      )}

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Submitting…" : "Submit report"}
      </button>
    </form>
  );
}
