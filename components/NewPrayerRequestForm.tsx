"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private (just you and staff you choose to tell)" },
  { value: "mentor", label: "My mentor" },
  { value: "cohort", label: "My cohort" },
  { value: "community", label: "Community (visible to everyone)" }
];

export default function NewPrayerRequestForm({ authorId }: { authorId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!title.trim()) {
      setError("Give your request a short title.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("dp_prayer_requests").insert({
      author_id: authorId,
      title: title.trim(),
      body: body || null,
      visibility,
      is_anonymous: isAnonymous
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setTitle("");
    setBody("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + New prayer request
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-5">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full input"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Details (optional)"
        className="w-full input"
      />
      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Who can see this</label>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          className="w-full input"
        >
          {VISIBILITY_OPTIONS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      {visibility !== "private" && (
        <label className="flex items-center gap-2 font-ui text-sm text-charcoal">
          <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
          Post without showing my name (staff can still see who posted, for safety)
        </label>
      )}
      {error && <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">{error}</p>}
      <div className="flex gap-2">
        <button onClick={create} disabled={saving} className="btn-primary">
          {saving ? "Posting…" : "Post request"}
        </button>
        <button onClick={() => setOpen(false)} className="font-ui text-sm text-charcoal/50">
          Cancel
        </button>
      </div>
    </div>
  );
}
