"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function CourseForm({ programId, areaId }: { programId: string; areaId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isStandalone, setIsStandalone] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!title.trim()) {
      setError("Give the course a title.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("dp_courses").insert({
      title: title.trim(),
      slug: slugify(title),
      description: description || null,
      program_id: programId,
      area_id: areaId,
      is_standalone: isStandalone,
      is_published: false
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setTitle("");
    setDescription("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary">
        + New course
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-5">
      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Course title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full input"
        />
      </div>
      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full input"
        />
      </div>
      <label className="flex items-center gap-2 font-ui text-sm text-charcoal">
        <input type="checkbox" checked={isStandalone} onChange={(e) => setIsStandalone(e.target.checked)} />
        Allow this course to be taken standalone (without enrolling in the full program)
      </label>
      {error && <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">{error}</p>}
      <div className="flex gap-2">
        <button onClick={create} disabled={saving} className="btn-primary">
          {saving ? "Creating…" : "Create course"}
        </button>
        <button onClick={() => setOpen(false)} className="font-ui text-sm text-charcoal/50">
          Cancel
        </button>
      </div>
    </div>
  );
}
