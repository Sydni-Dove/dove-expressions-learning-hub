"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SaveStatus } from "@/components/ui";

type Status = "draft" | "scheduled" | "published";

export default function LessonEditFields({
  lessonId,
  initialTitle,
  initialSubtitle,
  initialStatus,
  initialDuration
}: {
  lessonId: string;
  initialTitle: string;
  initialSubtitle?: string | null;
  initialStatus: Status;
  initialDuration: number | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle || "");
  const [status, setStatus] = useState<Status>(initialStatus);
  const [duration, setDuration] = useState(initialDuration ? String(initialDuration) : "");
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "failed" | "offline">("saved");

  async function save(fields: Record<string, unknown>) {
    setSaveStatus("saving");
    const { error } = await supabase.from("dp_lessons").update(fields).eq("id", lessonId);
    setSaveStatus(error ? "failed" : "saved");
    router.refresh();
  }

  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-burgundy">Lesson details</h2>
        <SaveStatus status={saveStatus} />
      </div>
      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => save({ title })}
          className="w-full input"
        />
      </div>
      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Subtitle (optional)</label>
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          onBlur={() => save({ subtitle: subtitle || null })}
          placeholder="e.g. What happens when God says go"
          className="w-full input"
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Status</label>
          <select
            value={status}
            onChange={(e) => {
              const v = e.target.value as Status;
              setStatus(v);
              save({ status: v });
            }}
            className="input"
          >
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Estimated minutes</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            onBlur={() => save({ estimated_duration_minutes: duration ? Number(duration) : null })}
            className="w-28 input"
          />
        </div>
      </div>
      {status === "published" && (
        <p className="font-ui text-xs text-charcoal/50">
          A lesson only counts as complete for a student once they meet the completion criteria you've set — not
          just from being opened.
        </p>
      )}
    </div>
  );
}
