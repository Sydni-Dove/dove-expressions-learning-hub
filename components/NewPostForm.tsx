"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewPostForm({
  spaceId,
  authorId,
  requiresApproval
}: {
  spaceId: string;
  authorId: string;
  requiresApproval: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  async function post() {
    if (!body.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("dp_community_posts").insert({
      space_id: spaceId,
      author_id: authorId,
      body: body.trim(),
      status: requiresApproval ? "pending" : "published"
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setBody("");
    setPosted(true);
    router.refresh();
  }

  return (
    <div className="card space-y-3 p-5">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder={requiresApproval ? "Share here — a moderator reviews posts in this space before they're visible to everyone." : "Share something…"}
        className="w-full input"
      />
      {error && <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">{error}</p>}
      {posted && requiresApproval && (
        <p role="status" className="rounded-lg bg-gold/10 px-3 py-2 font-ui text-sm text-[#5c3d00]">
          Posted — awaiting moderator approval before others can see it.
        </p>
      )}
      <button onClick={post} disabled={saving} className="btn-primary">
        {saving ? "Posting…" : "Post"}
      </button>
    </div>
  );
}
