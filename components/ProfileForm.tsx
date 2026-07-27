"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SaveStatus } from "@/components/ui";

export default function ProfileForm({
  userId,
  initialFullName,
  email
}: {
  userId: string;
  initialFullName: string;
  email: string;
}) {
  const supabase = createClient();
  const [fullName, setFullName] = useState(initialFullName);
  const [status, setStatus] = useState<"saving" | "saved" | "failed" | "offline">("saved");

  async function save() {
    setStatus("saving");
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", userId);
    setStatus(error ? "failed" : "saved");
  }

  return (
    <div className="card max-w-xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg text-burgundy">Basic information</h2>
        <SaveStatus status={status} />
      </div>
      <label htmlFor="fullName" className="mb-1 block font-ui text-sm font-semibold text-charcoal">
        Preferred name
      </label>
      <input
        id="fullName"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        onBlur={save}
        className="w-full input"
      />
      <p className="mt-4 font-ui text-xs text-charcoal/50">Email: {email} (contact an administrator to change your email)</p>
    </div>
  );
}
