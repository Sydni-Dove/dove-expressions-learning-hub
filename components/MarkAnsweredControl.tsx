"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MarkAnsweredControl({ requestId, currentStatus }: { requestId: string; currentStatus: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  async function markAnswered() {
    setSaving(true);
    await supabase.from("dp_prayer_requests").update({ status: "answered", answered_note: note || null }).eq("id", requestId);
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  if (currentStatus === "answered") {
    return <p className="font-ui text-sm text-green-700">Marked as answered — thank God with the people who prayed.</p>;
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary">
        Mark as answered
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-4">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="How did God answer this? (optional — becomes a testimony others can see)"
        className="w-full input"
      />
      <div className="flex gap-2">
        <button onClick={markAnswered} disabled={saving} className="btn-primary">
          {saving ? "Saving…" : "Confirm"}
        </button>
        <button onClick={() => setOpen(false)} className="font-ui text-sm text-charcoal/50">
          Cancel
        </button>
      </div>
    </div>
  );
}
