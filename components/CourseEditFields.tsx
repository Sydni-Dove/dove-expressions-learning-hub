"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SaveStatus } from "@/components/ui";

const PATHWAY_OPTIONS = [
  { code: "draw_near", label: "Draw Near" },
  { code: "hear_god", label: "Hear God" },
  { code: "rooted", label: "Rooted" },
  { code: "kingdom_mandate", label: "Kingdom Mandate" }
];

const CONTENT_STATUS_OPTIONS = ["draft", "published", "scheduled", "archived", "coming_soon"];

export default function CourseEditFields({
  courseId,
  initialTitle,
  initialSubtitle,
  initialDescription,
  initialPublished,
  initialStandalone,
  initialPathways,
  initialContentStatus,
  initialContentFormat,
  initialDifficultyLevel,
  initialEstimatedDuration
}: {
  courseId: string;
  initialTitle: string;
  initialSubtitle?: string;
  initialDescription: string;
  initialPublished: boolean;
  initialStandalone: boolean;
  initialPathways?: string[];
  initialContentStatus?: string;
  initialContentFormat?: string;
  initialDifficultyLevel?: string;
  initialEstimatedDuration?: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle || "");
  const [description, setDescription] = useState(initialDescription);
  const [published, setPublished] = useState(initialPublished);
  const [standalone, setStandalone] = useState(initialStandalone);
  const [pathways, setPathways] = useState<string[]>(initialPathways || []);
  const [contentStatus, setContentStatus] = useState(initialContentStatus || "draft");
  const [contentFormat, setContentFormat] = useState(initialContentFormat || "course");
  const [difficultyLevel, setDifficultyLevel] = useState(initialDifficultyLevel || "");
  const [estimatedDuration, setEstimatedDuration] = useState(initialEstimatedDuration || "");
  const [status, setStatus] = useState<"saving" | "saved" | "failed" | "offline">("saved");

  async function save(fields: Record<string, unknown>) {
    setStatus("saving");
    const { error } = await supabase.from("dp_courses").update(fields).eq("id", courseId);
    setStatus(error ? "failed" : "saved");
    router.refresh();
  }

  function togglePathway(code: string) {
    const next = pathways.includes(code) ? pathways.filter((p) => p !== code) : [...pathways, code];
    setPathways(next);
    save({ pathways: next });
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-burgundy">Course details</h2>
        <SaveStatus status={status} />
      </div>
      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => save({ title })} className="w-full input" />
      </div>
      <div>
        <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Subtitle</label>
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          onBlur={() => save({ subtitle })}
          placeholder="e.g. Learning to Think, Discern, and Respond From Christ's Perspective"
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

      <div>
        <label className="mb-1.5 block font-ui text-sm font-semibold text-charcoal">Pathways</label>
        <div className="flex flex-wrap gap-3">
          {PATHWAY_OPTIONS.map((p) => (
            <label key={p.code} className="checkbox-row">
              <input type="checkbox" checked={pathways.includes(p.code)} onChange={() => togglePathway(p.code)} />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Content status</label>
          <select
            value={contentStatus}
            onChange={(e) => {
              setContentStatus(e.target.value);
              save({ content_status: e.target.value });
            }}
            className="w-full input"
          >
            {CONTENT_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Format</label>
          <select
            value={contentFormat}
            onChange={(e) => {
              setContentFormat(e.target.value);
              save({ content_format: e.target.value });
            }}
            className="w-full input"
          >
            <option value="course">Course</option>
            <option value="series">Teaching series</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Maturity level</label>
          <select
            value={difficultyLevel}
            onChange={(e) => {
              setDifficultyLevel(e.target.value);
              save({ difficulty_level: e.target.value || null });
            }}
            className="w-full input"
          >
            <option value="">Not set</option>
            <option value="foundational">Foundational</option>
            <option value="growing">Growing</option>
            <option value="deepening">Deepening</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block font-ui text-sm font-semibold text-charcoal">Estimated duration</label>
          <input
            value={estimatedDuration}
            onChange={(e) => setEstimatedDuration(e.target.value)}
            onBlur={() => save({ estimated_duration: estimatedDuration })}
            placeholder="e.g. 6 weeks"
            className="w-full input"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 font-ui text-sm text-charcoal">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => {
              setPublished(e.target.checked);
              save({ is_published: e.target.checked });
            }}
          />
          Published (visible to enrolled students)
        </label>
        <label className="flex items-center gap-2 font-ui text-sm text-charcoal">
          <input
            type="checkbox"
            checked={standalone}
            onChange={(e) => {
              setStandalone(e.target.checked);
              save({ is_standalone: e.target.checked });
            }}
          />
          Standalone-enrollable
        </label>
      </div>
    </div>
  );
}
