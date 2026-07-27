"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ActionStepToggle({
  step
}: {
  step: { id: string; title: string; description: string | null; due_date: string | null; status: string };
}) {
  const [status, setStatus] = useState(step.status);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function toggle() {
    setLoading(true);
    const next = status === "completed" ? "pending" : "completed";
    const { error } = await supabase
      .from("dp_action_steps")
      .update({ status: next, completed_at: next === "completed" ? new Date().toISOString() : null })
      .eq("id", step.id);
    setLoading(false);
    if (!error) setStatus(next);
  }

  return (
    <label className="flex items-start gap-3 rounded-lg border border-charcoal/10 px-3 py-2.5">
      <input
        type="checkbox"
        checked={status === "completed"}
        onChange={toggle}
        disabled={loading}
        className="mt-1 h-5 w-5 shrink-0 accent-[#630000]"
        aria-label={`Mark "${step.title}" ${status === "completed" ? "incomplete" : "complete"}`}
      />
      <span>
        <span className={`font-body text-sm ${status === "completed" ? "text-charcoal/40 line-through" : "text-charcoal"}`}>
          {step.title}
        </span>
        {step.due_date && <span className="ml-2 font-ui text-xs text-charcoal/40">due {new Date(step.due_date).toLocaleDateString()}</span>}
      </span>
    </label>
  );
}
