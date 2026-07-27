"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Area {
  id: string;
  name: string;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function ProgramForm({ areas }: { areas: Area[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim() || !areaId) {
      setError("Give the program a name and choose a learning area.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("dp_programs").insert({
      name: name.trim(),
      slug: slugify(name),
      area_id: areaId,
      description: description || null
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setName("");
    setDescription("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + New program
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-5">
      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Program name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full input"
        />
      </div>
      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Learning area</label>
        <select
          value={areaId}
          onChange={(e) => setAreaId(e.target.value)}
          className="w-full input"
        >
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
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
      {error && <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">{error}</p>}
      <div className="flex gap-2">
        <button onClick={create} disabled={saving} className="btn-primary">
          {saving ? "Creating…" : "Create program"}
        </button>
        <button onClick={() => setOpen(false)} className="font-ui text-sm text-charcoal/50">
          Cancel
        </button>
      </div>
    </div>
  );
}
