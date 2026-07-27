"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SaveStatus } from "@/components/ui";

export default function ProgramEditFields({
  programId,
  initialName,
  initialDescription
}: {
  programId: string;
  initialName: string;
  initialDescription: string;
}) {
  const supabase = createClient();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [status, setStatus] = useState<"saving" | "saved" | "failed" | "offline">("saved");

  async function save(fields: Partial<{ name: string; description: string }>) {
    setStatus("saving");
    const { error } = await supabase.from("dp_programs").update(fields).eq("id", programId);
    setStatus(error ? "failed" : "saved");
  }

  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-burgundy">Program details</h2>
        <SaveStatus status={status} />
      </div>
      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => save({ name })}
          className="w-full input"
        />
      </div>
      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => save({ description })}
          rows={3}
          className="w-full input"
        />
      </div>
    </div>
  );
}
