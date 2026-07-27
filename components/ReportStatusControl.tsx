"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SaveStatus } from "@/components/ui";

const STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;

export default function ReportStatusControl({ reportId, currentStatus }: { reportId: string; currentStatus: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState(currentStatus);
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "failed" | "offline">("saved");

  async function update(next: string) {
    setStatus(next);
    setSaveStatus("saving");
    const { error } = await supabase
      .from("dp_reports")
      .update({ status: next, resolved_at: next === "resolved" || next === "dismissed" ? new Date().toISOString() : null })
      .eq("id", reportId);
    setSaveStatus(error ? "failed" : "saved");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={status}
        onChange={(e) => update(e.target.value)}
        className="input"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <SaveStatus status={saveStatus} />
    </div>
  );
}
