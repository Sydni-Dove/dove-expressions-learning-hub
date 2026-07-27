"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Response {
  id: string;
  responder_id: string;
  body: string | null;
  created_at: string;
}

export default function PrayerResponseThread({
  requestId,
  userId,
  responses,
  nameFor
}: {
  requestId: string;
  userId: string;
  responses: Response[];
  nameFor: (id: string) => string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function pray(withNote: boolean) {
    setSaving(true);
    await supabase.from("dp_prayer_responses").insert({
      request_id: requestId,
      responder_id: userId,
      body: withNote ? note.trim() || null : null
    });
    setSaving(false);
    setNote("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {responses.map((r) => (
          <div key={r.id} className="card p-3">
            <p className="font-ui text-xs font-semibold text-charcoal/50">{nameFor(r.responder_id)} is praying</p>
            {r.body && <p className="mt-1 font-body text-sm text-charcoal/80">{r.body}</p>}
          </div>
        ))}
        {responses.length === 0 && <p className="font-ui text-sm text-charcoal/50">No one has responded yet.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => pray(false)} disabled={saving} className="btn-secondary">
          🙏 I'm praying
        </button>
      </div>
      <div className="flex items-end gap-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Add an encouragement or testimony (optional)…"
          className="flex-1 input"
        />
        <button onClick={() => pray(true)} disabled={saving || !note.trim()} className="btn-primary">
          Send
        </button>
      </div>
    </div>
  );
}
