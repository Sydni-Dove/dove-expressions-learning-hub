"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Person {
  id: string;
  full_name: string | null;
  email: string;
}

export default function NewConversationForm({ userId, people }: { userId: string; people: Person[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState(people[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (!recipientId || !body.trim()) {
      setError("Choose someone to message and write a first message.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data: conversation, error: convError } = await supabase
      .from("dp_conversations")
      .insert({ created_by: userId, is_group: false })
      .select("id")
      .single();

    if (convError || !conversation) {
      setSaving(false);
      setError(convError?.message || "Couldn't start the conversation.");
      return;
    }

    const { error: participantsError } = await supabase.from("dp_conversation_participants").insert([
      { conversation_id: conversation.id, user_id: userId },
      { conversation_id: conversation.id, user_id: recipientId }
    ]);
    if (participantsError) {
      setSaving(false);
      setError(participantsError.message);
      return;
    }

    const { error: messageError } = await supabase.from("dp_messages").insert({
      conversation_id: conversation.id,
      sender_id: userId,
      body: body.trim()
    });
    setSaving(false);
    if (messageError) {
      setError(messageError.message);
      return;
    }

    router.push(`/messages/${conversation.id}`);
  }

  if (people.length === 0) {
    return (
      <p className="font-ui text-sm text-charcoal/50">
        You don't have any mentors, teachers, or students connected yet to start a new conversation with.
      </p>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + New message
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-5">
      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">To</label>
        <select
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          className="w-full input"
        >
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name || p.email}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Write your first message…"
        className="w-full input"
      />
      {error && <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">{error}</p>}
      <div className="flex gap-2">
        <button onClick={start} disabled={saving} className="btn-primary">
          {saving ? "Sending…" : "Send"}
        </button>
        <button onClick={() => setOpen(false)} className="font-ui text-sm text-charcoal/50">
          Cancel
        </button>
      </div>
    </div>
  );
}
