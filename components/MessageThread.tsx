"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export default function MessageThread({
  conversationId,
  userId,
  messages,
  nameFor
}: {
  conversationId: string;
  userId: string;
  messages: Message[];
  nameFor: (id: string) => string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    const { error: sendError } = await supabase.from("dp_messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      body: body.trim()
    });
    setSending(false);
    if (sendError) {
      setError(sendError.message);
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-card px-4 py-2 ${mine ? "bg-burgundy text-soft" : "bg-white border border-charcoal/10 text-charcoal"}`}>
                {!mine && <p className="font-ui text-xs font-semibold text-charcoal/50">{nameFor(m.sender_id)}</p>}
                <p className="font-body text-sm">{m.body}</p>
                <p className={`mt-1 font-ui text-[10px] ${mine ? "text-soft/70" : "text-charcoal/40"}`}>
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && <p className="font-ui text-sm text-charcoal/50">No messages yet — say hello.</p>}
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder="Write a message…"
          className="flex-1 input"
        />
        <button onClick={send} disabled={sending} className="btn-primary">
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">{error}</p>}
    </div>
  );
}
