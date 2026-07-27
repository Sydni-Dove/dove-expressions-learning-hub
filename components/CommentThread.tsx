"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Comment {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export default function CommentThread({
  postId,
  authorId,
  comments,
  nameFor
}: {
  postId: string;
  authorId: string;
  comments: Comment[];
  nameFor: (id: string) => string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!body.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("dp_community_comments").insert({
      post_id: postId,
      author_id: authorId,
      body: body.trim()
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="card p-3">
            <p className="font-ui text-xs font-semibold text-charcoal/50">{nameFor(c.author_id)}</p>
            <p className="mt-1 font-body text-sm text-charcoal/90">{c.body}</p>
          </div>
        ))}
        {comments.length === 0 && <p className="font-ui text-sm text-charcoal/50">No comments yet.</p>}
      </div>
      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Add a comment…"
          className="flex-1 input"
        />
        <button onClick={send} disabled={saving} className="btn-primary">
          {saving ? "Posting…" : "Comment"}
        </button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">{error}</p>}
    </div>
  );
}
