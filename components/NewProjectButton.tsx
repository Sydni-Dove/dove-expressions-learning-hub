"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewProjectButton({ userId }: { userId: string }) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function create() {
    if (!name.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("dp_creative_projects").insert({ student_id: userId, product_name: name, current_phase: "define" });
    setLoading(false);
    if (!error) {
      setName("");
      setOpen(false);
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-sunrise">
        + Start a new product project
      </button>
    );
  }

  return (
    <div className="card flex flex-wrap items-center gap-3 p-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Product name (e.g. “Rooted Devotional Journal”)"
        className="min-w-[240px] flex-1 input"
      />
      <button onClick={create} disabled={loading} className="btn-sunrise">
        {loading ? "Creating…" : "Create"}
      </button>
      <button onClick={() => setOpen(false)} className="font-ui text-sm text-charcoal/50">
        Cancel
      </button>
    </div>
  );
}
